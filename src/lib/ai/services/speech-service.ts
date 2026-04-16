import { getAiConfig } from '@/lib/ai/config';
import { logAiEvent } from '@/lib/ai/logger';
import { runSpeechProvider } from '@/lib/ai/provider-factory';
import {
  SpeechSynthesisResult,
  SpeechTranscriptionResult,
} from '@/lib/ai/types';

interface SynthesizeSpeechInput {
  text: string;
  voiceId: string;
  personalityId?: string;
  emotionState?: string;
  uid: string;
  requestHeaders?: Headers;
}

interface TranscribeSpeechInput {
  uid?: string;
  base64Data?: string;
  audioUrl?: string;
  requestHeaders?: Headers;
}

export async function synthesizeSpeechAudio(
  input: SynthesizeSpeechInput,
): Promise<SpeechSynthesisResult> {
  return runSpeechProvider('speech_tts', provider =>
    provider.synthesizeSpeech({
      text: input.text,
      voiceId: input.voiceId,
      personalityId: input.personalityId,
      emotionState: input.emotionState,
      uid: input.uid,
      audioFormat: 'mp3',
      sampleRate: 24000,
      requestHeaders: input.requestHeaders,
    }),
  );
}

export async function transcribeSpeechInput(
  input: TranscribeSpeechInput,
): Promise<SpeechTranscriptionResult> {
  return runSpeechProvider('speech_asr', provider =>
    provider.transcribeSpeech({
      uid: input.uid,
      base64Data: input.base64Data,
      audioUrl: input.audioUrl,
      requestHeaders: input.requestHeaders,
    }),
  );
}

export function logSpeechFallback(error: unknown) {
  logAiEvent('warn', {
    event: 'request_error',
    capability: 'speech_tts_non_blocking',
    provider: getAiConfig().speechPrimaryProvider,
    summary: error instanceof Error ? error.message : 'speech fallback triggered',
  });
}
