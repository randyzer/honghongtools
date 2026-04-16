import {
  SpeechProviderName,
  TextProviderName,
} from './types';

export interface AiConfig {
  textPrimaryProvider: TextProviderName;
  textFallbackProvider?: TextProviderName;
  speechPrimaryProvider: SpeechProviderName;
  speechFallbackProvider?: SpeechProviderName;
  requestTimeoutMs: number;
  gameTextTimeoutMs: number;
  blogTextTimeoutMs: number;
  gameMaxOutputTokens: number;
  blogMaxOutputTokens: number;
  cozeModel: string;
  volcengineArkApiKey?: string;
  volcengineArkBaseUrl: string;
  volcengineArkModel: string;
  volcengineSpeechAppId?: string;
  volcengineSpeechAccessToken?: string;
  volcengineSpeechApiKey?: string;
  volcengineSpeechCluster: string;
  volcengineSpeechTtsUrl: string;
  volcengineSpeechAsrUrl: string;
  volcengineSpeechAsrResourceId: string;
  siliconflowApiKey?: string;
  siliconflowTtsUrl: string;
  siliconflowTtsModel: string;
  siliconflowTtsDefaultVoice: string;
  siliconflowTtsStream: boolean;
  siliconflowAsrUrl: string;
  siliconflowAsrModel: string;
}

function parseTextProviderName(
  value: string | undefined,
  fallback: TextProviderName,
): TextProviderName {
  return value === 'coze' || value === 'volcengine' ? value : fallback;
}

function parseOptionalTextProviderName(
  value: string | undefined,
): TextProviderName | undefined {
  return value === 'coze' || value === 'volcengine' ? value : undefined;
}

function parseSpeechProviderName(
  value: string | undefined,
  fallback: SpeechProviderName,
): SpeechProviderName {
  return value === 'coze' || value === 'volcengine' || value === 'siliconflow'
    ? value
    : fallback;
}

function parseOptionalSpeechProviderName(
  value: string | undefined,
): SpeechProviderName | undefined {
  return value === 'coze' || value === 'volcengine' || value === 'siliconflow'
    ? value
    : undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

export interface TextRequestPolicy {
  timeoutMs: number;
  maxOutputTokens?: number;
}

let cachedConfig: AiConfig | null = null;

export function getAiConfig(): AiConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const requestTimeoutMs = parseNumber(process.env.AI_REQUEST_TIMEOUT_MS, 20_000);

  cachedConfig = {
    textPrimaryProvider: parseTextProviderName(process.env.AI_TEXT_PROVIDER, 'volcengine'),
    textFallbackProvider: parseOptionalTextProviderName(process.env.AI_TEXT_FALLBACK_PROVIDER),
    speechPrimaryProvider: parseSpeechProviderName(
      process.env.AI_SPEECH_PROVIDER,
      'siliconflow',
    ),
    speechFallbackProvider: parseOptionalSpeechProviderName(
      process.env.AI_SPEECH_FALLBACK_PROVIDER,
    ),
    requestTimeoutMs,
    gameTextTimeoutMs: parseNumber(
      process.env.AI_GAME_TEXT_TIMEOUT_MS,
      Math.max(requestTimeoutMs, 60_000),
    ),
    blogTextTimeoutMs: parseNumber(
      process.env.AI_BLOG_TEXT_TIMEOUT_MS,
      Math.max(requestTimeoutMs, 120_000),
    ),
    gameMaxOutputTokens: parseNumber(process.env.AI_GAME_MAX_OUTPUT_TOKENS, 4_096),
    blogMaxOutputTokens: parseNumber(process.env.AI_BLOG_MAX_OUTPUT_TOKENS, 2_048),
    cozeModel: process.env.COZE_MODEL || 'doubao-seed-1-8-251228',
    volcengineArkApiKey: process.env.VOLCENGINE_ARK_API_KEY,
    volcengineArkBaseUrl:
      process.env.VOLCENGINE_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    volcengineArkModel:
      process.env.VOLCENGINE_ARK_MODEL || 'doubao-seed-2-0-pro-260215',
    volcengineSpeechAppId: process.env.VOLCENGINE_SPEECH_APP_ID,
    volcengineSpeechAccessToken: process.env.VOLCENGINE_SPEECH_ACCESS_TOKEN,
    volcengineSpeechApiKey: process.env.VOLCENGINE_SPEECH_API_KEY,
    volcengineSpeechCluster: process.env.VOLCENGINE_SPEECH_CLUSTER || 'volcano_tts',
    volcengineSpeechTtsUrl:
      process.env.VOLCENGINE_SPEECH_TTS_URL || 'https://openspeech.bytedance.com/api/v1/tts',
    volcengineSpeechAsrUrl:
      process.env.VOLCENGINE_SPEECH_ASR_URL ||
      'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash',
    volcengineSpeechAsrResourceId:
      process.env.VOLCENGINE_SPEECH_ASR_RESOURCE_ID || 'volc.bigasr.auc_turbo',
    siliconflowApiKey: process.env.SILICONFLOW_API_KEY,
    siliconflowTtsUrl:
      process.env.SILICONFLOW_TTS_URL || 'https://api.siliconflow.cn/v1/audio/speech',
    siliconflowTtsModel:
      process.env.SILICONFLOW_TTS_MODEL || 'fnlp/MOSS-TTSD-v0.5',
    siliconflowTtsDefaultVoice:
      process.env.SILICONFLOW_TTS_DEFAULT_VOICE || 'alex',
    siliconflowTtsStream: parseBoolean(process.env.SILICONFLOW_TTS_STREAM, false),
    siliconflowAsrUrl:
      process.env.SILICONFLOW_ASR_URL ||
      'https://api.siliconflow.cn/v1/audio/transcriptions',
    siliconflowAsrModel:
      process.env.SILICONFLOW_ASR_MODEL || 'FunAudioLLM/SenseVoiceSmall',
  };

  return cachedConfig;
}

export function isVolcengineArkConfigured(config = getAiConfig()): boolean {
  return Boolean(config.volcengineArkApiKey);
}

export function isVolcengineSpeechConfigured(config = getAiConfig()): boolean {
  return Boolean(config.volcengineSpeechAppId && config.volcengineSpeechAccessToken);
}

export function isSiliconFlowSpeechConfigured(config = getAiConfig()): boolean {
  return Boolean(config.siliconflowApiKey);
}

export function getTextRequestPolicy(
  capability: string,
  config = getAiConfig(),
): TextRequestPolicy {
  if (capability === 'game_start' || capability === 'game_chat') {
    return {
      timeoutMs: config.gameTextTimeoutMs,
      maxOutputTokens: config.gameMaxOutputTokens,
    };
  }

  if (capability === 'blog_generate') {
    return {
      timeoutMs: config.blogTextTimeoutMs,
      maxOutputTokens: config.blogMaxOutputTokens,
    };
  }

  return {
    timeoutMs: config.requestTimeoutMs,
  };
}
