import { getAiConfig } from '@/lib/ai/config';
import {
  BusinessError,
  classifyProviderFailure,
  getErrorSummary,
} from '@/lib/ai/errors';
import { logAiEvent } from '@/lib/ai/logger';
import { summarizeText } from '@/lib/ai/parsers';
import { CozeProvider } from '@/lib/ai/providers/coze-provider';
import { SiliconFlowSpeechProvider } from '@/lib/ai/providers/siliconflow/speech-provider';
import { VolcengineArkResponsesProvider } from '@/lib/ai/providers/volcengine/ark-responses-provider';
import { VolcengineSpeechProvider } from '@/lib/ai/providers/volcengine/speech-provider';
import {
  AiProviderName,
  SpeechProviderName,
  SpeechProvider,
  TextProviderName,
  TextGenerationProvider,
} from '@/lib/ai/types';

interface ProviderResultShape {
  provider?: string;
  statusCode?: number;
  model?: string;
  text?: string;
  audioUrl?: string;
  raw?: unknown;
}

type NamedProvider = { name: AiProviderName; isAvailable(): boolean };

function uniqueProviderNames<TName extends string>(names: Array<TName | undefined>): TName[] {
  const resolved: TName[] = [];

  for (const name of names) {
    if (!name || resolved.includes(name)) {
      continue;
    }

    resolved.push(name);
  }

  return resolved;
}

function getTextProviderByName(name: TextProviderName): TextGenerationProvider {
  if (name === 'coze') {
    return new CozeProvider();
  }

  return new VolcengineArkResponsesProvider();
}

function getSpeechProviderByName(name: SpeechProviderName): SpeechProvider {
  if (name === 'coze') {
    return new CozeProvider();
  }

  if (name === 'siliconflow') {
    return new SiliconFlowSpeechProvider();
  }

  return new VolcengineSpeechProvider();
}

function resolveProviderChain<TProvider extends NamedProvider, TName extends string>(
  capability: string,
  names: TName[],
  builder: (name: TName) => TProvider,
): TProvider[] {
  const providers = names.map(builder);
  const availableProviders: TProvider[] = [];

  for (const provider of providers) {
    if (provider.isAvailable()) {
      availableProviders.push(provider);
      continue;
    }

    logAiEvent('warn', {
      event: 'provider_unavailable',
      capability,
      provider: provider.name,
      summary: 'provider configuration is incomplete',
    });
  }

  return availableProviders;
}

export function getTextProviders(): TextGenerationProvider[] {
  const config = getAiConfig();
  return resolveProviderChain(
    'text',
    uniqueProviderNames<TextProviderName>([
      config.textPrimaryProvider,
      config.textFallbackProvider,
    ]),
    getTextProviderByName,
  );
}

export function getSpeechProviders(): SpeechProvider[] {
  const config = getAiConfig();
  return resolveProviderChain(
    'speech',
    uniqueProviderNames<SpeechProviderName>([
      config.speechPrimaryProvider,
      config.speechFallbackProvider,
    ]),
    getSpeechProviderByName,
  );
}

function summarizeResult(result: ProviderResultShape): string | undefined {
  if (typeof result.text === 'string' && result.text) {
    return summarizeText(result.text);
  }

  if (typeof result.audioUrl === 'string' && result.audioUrl) {
    const attempts = getRetryAttempts(result);
    if (typeof attempts === 'number' && attempts > 1) {
      return `audio generated after retry attempt ${attempts}`;
    }

    return 'audio generated';
  }

  return undefined;
}

function getRetryAttempts(result: ProviderResultShape): number | undefined {
  if (!result.raw || typeof result.raw !== 'object') {
    return undefined;
  }

  const raw = result.raw as Record<string, unknown>;
  return typeof raw.attempts === 'number' ? raw.attempts : undefined;
}

async function runWithProviderChain<TProvider extends NamedProvider, TResult extends ProviderResultShape>(
  capability: string,
  providers: TProvider[],
  operation: (provider: TProvider) => Promise<TResult>,
): Promise<TResult> {
  if (providers.length === 0) {
    throw new BusinessError({
      code: 'UNAUTHORIZED',
      message: `No ${capability} provider is available`,
      userMessage: 'AI 服务端配置不完整，请补充供应商凭证后再试。',
      statusCode: 401,
      retryable: false,
    });
  }

  let lastError: BusinessError | null = null;

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const startedAt = Date.now();

    logAiEvent('info', {
      event: 'request_start',
      capability,
      provider: provider.name,
    });

    try {
      const result = await operation(provider);

      logAiEvent('info', {
        event: 'request_end',
        capability,
        provider: provider.name,
        model: result.model,
        durationMs: Date.now() - startedAt,
        statusCode: result.statusCode,
        summary: summarizeResult(result),
        attempt: getRetryAttempts(result),
      });

      return result;
    } catch (error) {
      const classified = classifyProviderFailure(error);
      lastError = classified;

      logAiEvent('error', {
        event: 'request_error',
        capability,
        provider: provider.name,
        durationMs: Date.now() - startedAt,
        statusCode: classified.statusCode,
        errorCode: classified.code,
        summary: summarizeText(getErrorSummary(error), 160),
      });

      if (index < providers.length - 1) {
        logAiEvent('warn', {
          event: 'fallback',
          capability,
          provider: provider.name,
          statusCode: classified.statusCode,
          summary: 'switching to fallback provider',
        });
      }
    }
  }

  throw lastError || new Error(`All ${capability} providers failed`);
}

export async function runTextProvider<TResult extends ProviderResultShape>(
  capability: string,
  operation: (provider: TextGenerationProvider) => Promise<TResult>,
): Promise<TResult> {
  return runWithProviderChain(capability, getTextProviders(), operation);
}

export async function runSpeechProvider<TResult extends ProviderResultShape>(
  capability: string,
  operation: (provider: SpeechProvider) => Promise<TResult>,
): Promise<TResult> {
  return runWithProviderChain(capability, getSpeechProviders(), operation);
}
