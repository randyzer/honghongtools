import {
  ASRClient,
  Config,
  HeaderUtils,
  LLMClient,
  TTSClient,
} from 'coze-coding-dev-sdk';

import { getAiConfig } from '@/lib/ai/config';
import { ProviderRequestError } from '@/lib/ai/errors';
import {
  MessageContentPart,
  ProviderMessage,
  SpeechProvider,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  SpeechTranscriptionRequest,
  SpeechTranscriptionResult,
  TextGenerationProvider,
  TextGenerationRequest,
  TextGenerationResult,
} from '@/lib/ai/types';

function normalizeCozeContentPart(part: MessageContentPart) {
  if (part.type === 'text') {
    return { type: 'text' as const, text: part.text };
  }

  if (part.type === 'image_url') {
    return {
      type: 'image_url' as const,
      image_url: {
        url: part.url,
        detail: part.detail,
      },
    };
  }

  return {
    type: 'video_url' as const,
    video_url: {
      url: part.url,
      fps: part.fps ?? null,
    },
  };
}

function normalizeMessages(messages: ProviderMessage[]) {
  return messages.map(message => ({
    role: message.role,
    content: Array.isArray(message.content)
      ? message.content.map(normalizeCozeContentPart)
      : message.content,
  }));
}

function extractForwardHeaders(requestHeaders?: Headers) {
  if (!requestHeaders) {
    return undefined;
  }

  return HeaderUtils.extractForwardHeaders(requestHeaders);
}

function normalizeError(error: unknown, provider: 'coze'): ProviderRequestError {
  if (error instanceof ProviderRequestError) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Coze provider request failed';
  const statusCode =
    error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : undefined;

  return new ProviderRequestError({
    provider,
    message,
    statusCode,
    details: error,
  });
}

export class CozeProvider implements TextGenerationProvider, SpeechProvider {
  readonly name = 'coze' as const;

  isAvailable(): boolean {
    return true;
  }

  async generateText(input: TextGenerationRequest): Promise<TextGenerationResult> {
    try {
      const config = new Config();
      const client = new LLMClient(config, extractForwardHeaders(input.requestHeaders));
      const response = await client.invoke(normalizeMessages(input.messages), {
        model: input.model || getAiConfig().cozeModel,
        temperature: input.temperature,
      });

      return {
        provider: this.name,
        model: input.model || getAiConfig().cozeModel,
        text: response.content,
        raw: response,
      };
    } catch (error) {
      throw normalizeError(error, this.name);
    }
  }

  async synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    try {
      const config = new Config();
      const client = new TTSClient(config, extractForwardHeaders(input.requestHeaders));
      const response = await client.synthesize({
        uid: input.uid,
        text: input.text,
        speaker: input.voiceId,
        audioFormat: input.audioFormat || 'mp3',
        sampleRate: (input.sampleRate as 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000) || 24000,
      });

      return {
        provider: this.name,
        audioUrl: response.audioUri,
        contentType: 'audio/mpeg',
        raw: response,
      };
    } catch (error) {
      throw normalizeError(error, this.name);
    }
  }

  async transcribeSpeech(
    input: SpeechTranscriptionRequest,
  ): Promise<SpeechTranscriptionResult> {
    try {
      const config = new Config();
      const client = new ASRClient(config, extractForwardHeaders(input.requestHeaders));
      const response = await client.recognize({
        uid: input.uid,
        url: input.audioUrl,
        base64Data: input.base64Data,
      });

      return {
        provider: this.name,
        text: response.text,
        duration: response.duration,
        utterances: response.utterances,
        raw: response.rawData,
      };
    } catch (error) {
      throw normalizeError(error, this.name);
    }
  }
}
