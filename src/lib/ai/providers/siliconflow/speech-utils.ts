import { Buffer } from 'node:buffer';

const LEGACY_VOICE_TO_MOSS_VOICE: Record<string, string> = {
  zh_female_xiaohe_uranus_bigtts: 'claire',
  saturn_zh_female_tiaopigongzhu_tob: 'bella',
  saturn_zh_female_keainvsheng_tob: 'diana',
  zh_female_meilinvyou_saturn_bigtts: 'anna',
  zh_male_m191_uranus_bigtts: 'david',
  zh_male_taocheng_uranus_bigtts: 'benjamin',
  zh_male_dayi_saturn_bigtts: 'charles',
};

const PERSONA_BASE_PROFILE: Record<
  string,
  { voice: string; speed: number; gain: number }
> = {
  gentle: { voice: 'claire', speed: 0.97, gain: -0.3 },
  tsundere: { voice: 'bella', speed: 1.02, gain: 0.4 },
  cute: { voice: 'diana', speed: 1.05, gain: 0.5 },
  cool: { voice: 'anna', speed: 0.94, gain: -0.6 },
  warm_male: { voice: 'david', speed: 0.99, gain: 0.1 },
  cold_male: { voice: 'benjamin', speed: 0.95, gain: -0.5 },
  domineering_male: { voice: 'charles', speed: 0.98, gain: 0.3 },
};

export interface ParsedBase64AudioPayload {
  bytes: Buffer;
  contentType: string;
  extension: string;
}

export interface SiliconFlowSpeechProfileInput {
  text: string;
  personalityId?: string;
  emotionState?: string;
  legacyVoiceId: string;
  model: string;
  defaultVoice: string;
}

export interface SiliconFlowSpeechProfile {
  voice: string;
  text: string;
  speed: number;
  gain: number;
}

function normalizeVoiceName(voiceName: string, model: string): string {
  if (voiceName.includes(':')) {
    return voiceName;
  }

  return `${model}:${voiceName}`;
}

export function resolveSiliconFlowVoice(
  legacyVoiceId: string,
  model: string,
  defaultVoice: string,
): string {
  const mappedVoice = LEGACY_VOICE_TO_MOSS_VOICE[legacyVoiceId] || legacyVoiceId || defaultVoice;
  return normalizeVoiceName(mappedVoice, model);
}

export function normalizeSpeechText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripMarkdownAndEmoji(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_>#-]+/g, ' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePunctuation(text: string): string {
  let normalized = text
    .replace(/\.{3,}/g, '……')
    .replace(/…+/g, '……')
    .replace(/[!！]{2,}/g, '！')
    .replace(/[?？]{2,}/g, '？')
    .replace(/[。]{2,}/g, '。');

  normalized = normalized
    .replace(/([。！？]){2,}/g, '$1')
    .replace(/……{2,}/g, '……');

  if (!/[。！？……]$/.test(normalized)) {
    normalized = `${normalized}。`;
  }

  return normalized;
}

function removeSoftParticles(text: string): string {
  return text.replace(/[呀啦嘛呢啊](?=[。！？……])/g, '');
}

function applyPersonaSpeechStyle(text: string, personalityId?: string): string {
  if (personalityId === 'gentle') {
    const normalized = text.replace(/！/g, '。');
    return normalized.replace(/([^呀呢啊])。$/, '$1呀。');
  }

  if (personalityId === 'tsundere') {
    return text.startsWith('哼，') ? text : `哼，${text}`;
  }

  if (personalityId === 'cute') {
    return text.replace(/([^呀啦嘛])。$/, '$1啦。');
  }

  if (personalityId === 'cool' || personalityId === 'cold_male') {
    return removeSoftParticles(text);
  }

  if (personalityId === 'domineering_male') {
    return removeSoftParticles(text).replace(/……/g, '，');
  }

  return text;
}

function resolveEmotionDelta(
  personalityId: string | undefined,
  emotionState: string | undefined,
): { speed: number; gain: number } {
  if (!emotionState) {
    return { speed: 0, gain: 0 };
  }

  if (/委屈|难过|落泪/.test(emotionState)) {
    return { speed: -0.05, gain: -0.4 };
  }

  if (/暴怒|非常生气/.test(emotionState)) {
    return {
      speed: 0.03,
      gain: personalityId === 'gentle' || personalityId === 'cool' ? 0.2 : 0.4,
    };
  }

  if (/快哄好了|原谅了/.test(emotionState)) {
    return { speed: 0.02, gain: 0.1 };
  }

  return { speed: 0, gain: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildSiliconFlowSpeechProfile(
  input: SiliconFlowSpeechProfileInput,
): SiliconFlowSpeechProfile {
  const personaProfile = input.personalityId
    ? PERSONA_BASE_PROFILE[input.personalityId]
    : undefined;

  const voice = personaProfile
    ? normalizeVoiceName(personaProfile.voice, input.model)
    : resolveSiliconFlowVoice(input.legacyVoiceId, input.model, input.defaultVoice);

  const cleanedText = normalizePunctuation(stripMarkdownAndEmoji(normalizeSpeechText(input.text)));
  const styledText = applyPersonaSpeechStyle(cleanedText, input.personalityId);
  const emotionDelta = resolveEmotionDelta(input.personalityId, input.emotionState);
  const baseSpeed = personaProfile?.speed ?? 1.0;
  const baseGain = personaProfile?.gain ?? 0;

  return {
    voice,
    text: styledText,
    speed: Number(clamp(baseSpeed + emotionDelta.speed, 0.25, 4).toFixed(2)),
    gain: Number(clamp(baseGain + emotionDelta.gain, -10, 10).toFixed(2)),
  };
}

export function resolveSiliconFlowResponseFormat(
  format: 'mp3' | 'pcm' | 'ogg_opus' = 'mp3',
): 'mp3' | 'pcm' | 'opus' {
  if (format === 'ogg_opus') {
    return 'opus';
  }

  return format;
}

export function resolveSiliconFlowSampleRate(
  responseFormat: 'mp3' | 'pcm' | 'opus',
  sampleRate?: number,
): number {
  if (responseFormat === 'mp3') {
    return sampleRate === 44_100 ? 44_100 : 32_000;
  }

  if (responseFormat === 'opus') {
    return sampleRate === 24_000 ? 24_000 : 48_000;
  }

  return sampleRate || 24_000;
}

export function resolveAudioContentType(
  responseFormat: 'mp3' | 'pcm' | 'opus',
  headerContentType?: string | null,
): string {
  if (headerContentType && headerContentType.startsWith('audio/')) {
    return headerContentType;
  }

  if (responseFormat === 'opus') {
    return 'audio/ogg';
  }

  if (responseFormat === 'pcm') {
    return 'audio/pcm';
  }

  return 'audio/mpeg';
}

export function contentTypeToExtension(contentType: string): string {
  if (contentType.includes('wav')) {
    return 'wav';
  }

  if (contentType.includes('ogg') || contentType.includes('opus')) {
    return 'ogg';
  }

  if (contentType.includes('pcm')) {
    return 'pcm';
  }

  return 'mp3';
}

export function parseBase64AudioPayload(base64Data: string): ParsedBase64AudioPayload {
  const trimmed = base64Data.trim();
  const matched = trimmed.match(/^data:([^;]+);base64,(.+)$/);

  if (matched) {
    const [, contentType, payload] = matched;

    return {
      bytes: Buffer.from(payload, 'base64'),
      contentType,
      extension: contentTypeToExtension(contentType),
    };
  }

  return {
    bytes: Buffer.from(trimmed, 'base64'),
    contentType: 'audio/mpeg',
    extension: 'mp3',
  };
}
