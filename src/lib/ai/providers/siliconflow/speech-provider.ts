import { Buffer } from 'node:buffer';

import { getAiConfig, isSiliconFlowSpeechConfigured } from '@/lib/ai/config';
import { ProviderRequestError } from '@/lib/ai/errors';
import { logAiEvent } from '@/lib/ai/logger';
import {
  SpeechProvider,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  SpeechTranscriptionRequest,
  SpeechTranscriptionResult,
} from '@/lib/ai/types';

import {
  buildSiliconFlowSpeechProfile,
  contentTypeToExtension,
  parseBase64AudioPayload,
  resolveAudioContentType,
  resolveSiliconFlowResponseFormat,
  resolveSiliconFlowSampleRate,
} from './speech-utils';

const SILICONFLOW_TTS_MAX_ATTEMPTS = 2;

async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;

      if (record.error && typeof record.error === 'object' && record.error !== null) {
        const errorRecord = record.error as Record<string, unknown>;

        if (typeof errorRecord.message === 'string') {
          return errorRecord.message;
        }
      }

      if (typeof record.message === 'string') {
        return record.message;
      }
    }
  }

  return response.text();
}

async function buildAudioUpload(
  input: SpeechTranscriptionRequest,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  if (input.base64Data) {
    const parsed = parseBase64AudioPayload(input.base64Data);

    return {
      blob: new Blob([Uint8Array.from(parsed.bytes)], { type: parsed.contentType }),
      filename: `speech-input.${parsed.extension}`,
    };
  }

  if (!input.audioUrl) {
    throw new ProviderRequestError({
      provider: 'siliconflow',
      message: 'Speech transcription requires base64Data or audioUrl',
      statusCode: 400,
    });
  }

  const sourceResponse = await fetch(input.audioUrl, { signal });

  if (!sourceResponse.ok) {
    throw new ProviderRequestError({
      provider: 'siliconflow',
      message: `Failed to download source audio: ${sourceResponse.status}`,
      statusCode: 502,
    });
  }

  const arrayBuffer = await sourceResponse.arrayBuffer();
  const contentType = sourceResponse.headers.get('content-type') || 'audio/mpeg';

  return {
    blob: new Blob([arrayBuffer], { type: contentType }),
    filename: `speech-input.${contentTypeToExtension(contentType)}`,
  };
}

export class SiliconFlowSpeechProvider implements SpeechProvider {
  readonly name = 'siliconflow' as const;

  isAvailable(): boolean {
    return isSiliconFlowSpeechConfigured();
  }

  async synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    const config = getAiConfig();

    if (!config.siliconflowApiKey) {
      throw new ProviderRequestError({
        provider: this.name,
        message: 'SiliconFlow API key is not configured',
        statusCode: 401,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.requestTimeoutMs,
    );

    try {
      const responseFormat = resolveSiliconFlowResponseFormat(input.audioFormat || 'mp3');
      const speechProfile = buildSiliconFlowSpeechProfile({
        text: input.text,
        personalityId: input.personalityId,
        emotionState: input.emotionState,
        legacyVoiceId: input.voiceId,
        model: config.siliconflowTtsModel,
        defaultVoice: config.siliconflowTtsDefaultVoice,
      });
      for (let attempt = 1; attempt <= SILICONFLOW_TTS_MAX_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch(config.siliconflowTtsUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.siliconflowApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.siliconflowTtsModel,
              input: speechProfile.text,
              voice: speechProfile.voice,
              speed: speechProfile.speed,
              gain: speechProfile.gain,
              response_format: responseFormat,
              sample_rate: resolveSiliconFlowSampleRate(responseFormat, input.sampleRate),
              stream: config.siliconflowTtsStream,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new ProviderRequestError({
              provider: this.name,
              message: await readErrorDetail(response),
              statusCode: response.status,
            });
          }

          const arrayBuffer = await response.arrayBuffer();

          if (arrayBuffer.byteLength === 0) {
            throw new ProviderRequestError({
              provider: this.name,
              message: 'SiliconFlow TTS returned empty audio data',
              statusCode: 502,
            });
          }

          const contentType = resolveAudioContentType(
            responseFormat,
            response.headers.get('content-type'),
          );

          return {
            provider: this.name,
            audioUrl: `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`,
            contentType,
            statusCode: response.status,
            raw: {
              traceId: response.headers.get('x-siliconcloud-trace-id') || undefined,
              byteLength: arrayBuffer.byteLength,
              attempts: attempt,
            },
          };
        } catch (error) {
          if (
            error instanceof ProviderRequestError &&
            typeof error.statusCode === 'number' &&
            error.statusCode >= 500 &&
            error.statusCode < 600 &&
            attempt < SILICONFLOW_TTS_MAX_ATTEMPTS
          ) {
            logAiEvent('warn', {
              event: 'request_retry',
              capability: 'speech_tts',
              provider: this.name,
              statusCode: error.statusCode,
              summary: 'retrying after upstream 5xx',
              attempt,
              maxAttempts: SILICONFLOW_TTS_MAX_ATTEMPTS,
            });
            continue;
          }

          throw error;
        }
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: 'SiliconFlow TTS failed after retries',
        statusCode: 502,
      });
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'SiliconFlow TTS request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'SiliconFlow TTS failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async transcribeSpeech(
    input: SpeechTranscriptionRequest,
  ): Promise<SpeechTranscriptionResult> {
    const config = getAiConfig();

    if (!config.siliconflowApiKey) {
      throw new ProviderRequestError({
        provider: this.name,
        message: 'SiliconFlow API key is not configured',
        statusCode: 401,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.requestTimeoutMs,
    );

    try {
      const { blob, filename } = await buildAudioUpload(input, controller.signal);
      const formData = new FormData();

      formData.append('file', blob, filename);
      formData.append('model', config.siliconflowAsrModel);

      const response = await fetch(config.siliconflowAsrUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.siliconflowApiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ProviderRequestError({
          provider: this.name,
          message: await readErrorDetail(response),
          statusCode: response.status,
        });
      }

      const payload = await response.json();
      const text =
        payload && typeof payload === 'object' && payload !== null && typeof payload.text === 'string'
          ? payload.text.trim()
          : '';

      if (!text) {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'SiliconFlow ASR returned empty text',
          statusCode: 502,
          details: payload,
        });
      }

      return {
        provider: this.name,
        text,
        statusCode: response.status,
        raw: {
          ...payload,
          traceId: response.headers.get('x-siliconcloud-trace-id') || undefined,
        },
      };
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'SiliconFlow ASR request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'SiliconFlow ASR failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
