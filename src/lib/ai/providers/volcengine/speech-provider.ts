import { getAiConfig, isVolcengineSpeechConfigured } from '@/lib/ai/config';
import { ProviderRequestError } from '@/lib/ai/errors';
import {
  SpeechProvider,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  SpeechTranscriptionRequest,
  SpeechTranscriptionResult,
} from '@/lib/ai/types';

function resolveAudioContentType(encoding: string): string {
  if (encoding === 'ogg_opus') {
    return 'audio/ogg';
  }

  if (encoding === 'pcm') {
    return 'audio/pcm';
  }

  return 'audio/mpeg';
}

function buildSpeechHeaders(requestId: string): Record<string, string> {
  const config = getAiConfig();

  if (config.volcengineSpeechApiKey) {
    return {
      'Content-Type': 'application/json',
      'X-Api-Key': config.volcengineSpeechApiKey,
      'X-Api-Resource-Id': config.volcengineSpeechAsrResourceId,
      'X-Api-Request-Id': requestId,
      'X-Api-Sequence': '-1',
    };
  }

  if (!config.volcengineSpeechAppId || !config.volcengineSpeechAccessToken) {
    throw new ProviderRequestError({
      provider: 'volcengine',
      message: 'Volcengine speech credentials are not configured',
      statusCode: 401,
    });
  }

  return {
    'Content-Type': 'application/json',
    'X-Api-App-Key': config.volcengineSpeechAppId,
    'X-Api-Access-Key': config.volcengineSpeechAccessToken,
    'X-Api-Resource-Id': config.volcengineSpeechAsrResourceId,
    'X-Api-Request-Id': requestId,
    'X-Api-Sequence': '-1',
  };
}

function mapSpeechApiStatusToHttpStatus(apiStatusCode: string | null): number | undefined {
  if (!apiStatusCode) {
    return undefined;
  }

  if (apiStatusCode === '20000000') {
    return 200;
  }

  if (apiStatusCode === '55000031') {
    return 429;
  }

  if (apiStatusCode.startsWith('45') || apiStatusCode === '20000003') {
    return 400;
  }

  if (apiStatusCode.startsWith('55')) {
    return 502;
  }

  return 502;
}

export class VolcengineSpeechProvider implements SpeechProvider {
  readonly name = 'volcengine' as const;

  isAvailable(): boolean {
    return isVolcengineSpeechConfigured();
  }

  async synthesizeSpeech(input: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    const config = getAiConfig();

    if (!config.volcengineSpeechAppId || !config.volcengineSpeechAccessToken) {
      throw new ProviderRequestError({
        provider: this.name,
        message: 'Volcengine speech credentials are not configured',
        statusCode: 401,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.requestTimeoutMs,
    );

    try {
      const response = await fetch(config.volcengineSpeechTtsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer;${config.volcengineSpeechAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app: {
            appid: config.volcengineSpeechAppId,
            token: config.volcengineSpeechAccessToken,
            cluster: config.volcengineSpeechCluster,
          },
          user: {
            uid: input.uid,
          },
          audio: {
            voice_type: input.voiceId,
            encoding: input.audioFormat || 'mp3',
            rate: input.sampleRate || 24000,
            speed_ratio: 1.0,
          },
          request: {
            reqid: crypto.randomUUID(),
            text: input.text,
            text_type: 'plain',
            operation: 'query',
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ProviderRequestError({
          provider: this.name,
          message: await response.text(),
          statusCode: response.status,
        });
      }

      const payload = await response.json();
      const base64Audio =
        payload && typeof payload === 'object' && payload !== null && typeof payload.data === 'string'
          ? payload.data
          : '';

      if (!base64Audio) {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine speech TTS returned empty audio data',
          statusCode: 502,
          details: payload,
        });
      }

      const contentType = resolveAudioContentType(input.audioFormat || 'mp3');

      return {
        provider: this.name,
        audioUrl: `data:${contentType};base64,${base64Audio}`,
        contentType,
        statusCode: response.status,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine speech TTS request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'Volcengine speech TTS failed',
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
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.requestTimeoutMs,
    );
    const requestId = crypto.randomUUID();

    try {
      const response = await fetch(config.volcengineSpeechAsrUrl, {
        method: 'POST',
        headers: buildSpeechHeaders(requestId),
        body: JSON.stringify({
          user: {
            uid: input.uid || config.volcengineSpeechAppId || 'game-user',
          },
          audio: input.audioUrl
            ? { url: input.audioUrl }
            : { data: input.base64Data },
          request: {
            model_name: 'bigmodel',
          },
        }),
        signal: controller.signal,
      });

      const apiStatusCode = response.headers.get('X-Api-Status-Code');
      const effectiveStatusCode = mapSpeechApiStatusToHttpStatus(apiStatusCode) || response.status;

      if (!response.ok || effectiveStatusCode >= 400) {
        throw new ProviderRequestError({
          provider: this.name,
          message: response.headers.get('X-Api-Message') || (await response.text()),
          statusCode: effectiveStatusCode,
        });
      }

      const payload = await response.json();
      const result =
        payload && typeof payload === 'object' && payload !== null && 'result' in payload
          ? (payload.result as Record<string, unknown>)
          : {};
      const audioInfo =
        payload && typeof payload === 'object' && payload !== null && 'audio_info' in payload
          ? (payload.audio_info as Record<string, unknown>)
          : {};

      const text = typeof result.text === 'string' ? result.text : '';

      if (!text) {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine speech ASR returned empty text',
          statusCode: 502,
          details: payload,
        });
      }

      return {
        provider: this.name,
        text,
        duration:
          typeof audioInfo.duration === 'number'
            ? audioInfo.duration
            : typeof result.additions === 'object' &&
                result.additions !== null &&
                typeof (result.additions as Record<string, unknown>).duration === 'string'
              ? Number((result.additions as Record<string, unknown>).duration)
              : undefined,
        utterances: Array.isArray(result.utterances) ? result.utterances : undefined,
        statusCode: effectiveStatusCode,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine speech ASR request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'Volcengine speech ASR failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
