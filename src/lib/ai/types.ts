export type TextProviderName = 'coze' | 'volcengine';

export type SpeechProviderName = 'coze' | 'volcengine' | 'siliconflow';

export type AiProviderName = TextProviderName | SpeechProviderName;

export type MessageRole = 'system' | 'user' | 'assistant';

export type MessageContentPart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image_url';
      url: string;
      detail?: 'high' | 'low';
    }
  | {
      type: 'video_url';
      url: string;
      fps?: number | null;
    };

export interface ProviderMessage {
  role: MessageRole;
  content: string | MessageContentPart[];
}

export interface UsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

export interface TextGenerationRequest {
  messages: ProviderMessage[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  requestHeaders?: Headers;
}

export interface TextGenerationResult {
  provider: TextProviderName;
  model: string;
  text: string;
  statusCode?: number;
  usage?: UsageMetrics;
  raw?: unknown;
}

export interface SpeechSynthesisRequest {
  text: string;
  voiceId: string;
  personalityId?: string;
  emotionState?: string;
  uid: string;
  audioFormat?: 'mp3' | 'pcm' | 'ogg_opus';
  sampleRate?: number;
  timeoutMs?: number;
  requestHeaders?: Headers;
}

export interface SpeechSynthesisResult {
  provider: SpeechProviderName;
  audioUrl: string;
  contentType: string;
  statusCode?: number;
  raw?: unknown;
}

export interface SpeechTranscriptionRequest {
  uid?: string;
  base64Data?: string;
  audioUrl?: string;
  timeoutMs?: number;
  requestHeaders?: Headers;
}

export interface SpeechTranscriptionResult {
  provider: SpeechProviderName;
  text: string;
  duration?: number;
  utterances?: unknown[];
  statusCode?: number;
  raw?: unknown;
}

export interface TextGenerationProvider {
  readonly name: TextProviderName;
  isAvailable(): boolean;
  generateText(input: TextGenerationRequest): Promise<TextGenerationResult>;
}

export interface SpeechProvider {
  readonly name: SpeechProviderName;
  isAvailable(): boolean;
  synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
  transcribeSpeech(input: SpeechTranscriptionRequest): Promise<SpeechTranscriptionResult>;
}
