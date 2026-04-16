import { getAiConfig, isVolcengineArkConfigured } from '@/lib/ai/config';
import { ProviderRequestError } from '@/lib/ai/errors';
import { extractArkOutputText } from '@/lib/ai/parsers';
import {
  MessageContentPart,
  ProviderMessage,
  TextGenerationProvider,
  TextGenerationRequest,
  TextGenerationResult,
} from '@/lib/ai/types';

type ArkInputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_video'; video_url: string };

function normalizeContentPart(part: MessageContentPart): ArkInputContent {
  if (part.type === 'text') {
    return { type: 'input_text', text: part.text };
  }

  if (part.type === 'image_url') {
    return { type: 'input_image', image_url: part.url };
  }

  return { type: 'input_video', video_url: part.url };
}

function normalizeMessage(message: ProviderMessage) {
  const content = Array.isArray(message.content)
    ? message.content.map(normalizeContentPart)
    : [{ type: 'input_text' as const, text: message.content }];

  return {
    role: message.role === 'system' ? 'user' : message.role,
    content,
  };
}

function splitSystemMessages(messages: ProviderMessage[]) {
  const instructions = messages
    .filter(message => message.role === 'system')
    .map(message =>
      Array.isArray(message.content)
        ? message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('\n')
        : message.content,
    )
    .filter(Boolean)
    .join('\n\n');

  const input = messages
    .filter(message => message.role !== 'system')
    .map(normalizeMessage);

  return { instructions, input };
}

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

export class VolcengineArkResponsesProvider implements TextGenerationProvider {
  readonly name = 'volcengine' as const;

  isAvailable(): boolean {
    return isVolcengineArkConfigured();
  }

  async generateText(input: TextGenerationRequest): Promise<TextGenerationResult> {
    const config = getAiConfig();

    if (!config.volcengineArkApiKey) {
      throw new ProviderRequestError({
        provider: this.name,
        message: 'Volcengine Ark API key is not configured',
        statusCode: 401,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs || config.requestTimeoutMs,
    );

    try {
      const { instructions, input: arkInput } = splitSystemMessages(input.messages);

      const response = await fetch(`${config.volcengineArkBaseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.volcengineArkApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model || config.volcengineArkModel,
          ...(instructions ? { instructions } : {}),
          input: arkInput,
          temperature: input.temperature,
          ...(typeof input.maxOutputTokens === 'number'
            ? { max_output_tokens: input.maxOutputTokens }
            : {}),
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

      const payload = await response.json();
      const text = extractArkOutputText(payload);

      if (!text) {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine Ark returned an empty assistant message',
          statusCode: 502,
          details: payload,
        });
      }

      const usage =
        payload && typeof payload === 'object' && payload !== null && 'usage' in payload
          ? {
              inputTokens:
                typeof payload.usage === 'object' &&
                payload.usage !== null &&
                typeof (payload.usage as Record<string, unknown>).input_tokens === 'number'
                  ? Number((payload.usage as Record<string, unknown>).input_tokens)
                  : undefined,
              outputTokens:
                typeof payload.usage === 'object' &&
                payload.usage !== null &&
                typeof (payload.usage as Record<string, unknown>).output_tokens === 'number'
                  ? Number((payload.usage as Record<string, unknown>).output_tokens)
                  : undefined,
              totalTokens:
                typeof payload.usage === 'object' &&
                payload.usage !== null &&
                typeof (payload.usage as Record<string, unknown>).total_tokens === 'number'
                  ? Number((payload.usage as Record<string, unknown>).total_tokens)
                  : undefined,
              reasoningTokens:
                typeof payload.usage === 'object' &&
                payload.usage !== null &&
                typeof (payload.usage as Record<string, unknown>).output_tokens_details ===
                  'object' &&
                (payload.usage as Record<string, unknown>).output_tokens_details !== null &&
                typeof (
                  (payload.usage as Record<string, unknown>).output_tokens_details as Record<
                    string,
                    unknown
                  >
                ).reasoning_tokens === 'number'
                  ? Number(
                      (
                        (payload.usage as Record<string, unknown>).output_tokens_details as Record<
                          string,
                          unknown
                        >
                      ).reasoning_tokens,
                    )
                  : undefined,
            }
          : undefined;

      return {
        provider: this.name,
        model:
          payload && typeof payload === 'object' && payload !== null && 'model' in payload
            ? String(payload.model)
            : input.model || config.volcengineArkModel,
        text,
        statusCode: response.status,
        usage,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof ProviderRequestError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ProviderRequestError({
          provider: this.name,
          message: 'Volcengine Ark request timed out',
          statusCode: 504,
          details: error,
        });
      }

      throw new ProviderRequestError({
        provider: this.name,
        message: error instanceof Error ? error.message : 'Volcengine Ark request failed',
        statusCode: 502,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
