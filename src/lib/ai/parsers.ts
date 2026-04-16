export function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (match) {
    return match[1].trim();
  }

  return trimmed;
}

export function extractJsonObject(text: string): string | null {
  const normalized = stripMarkdownCodeFence(text);
  if (!normalized.includes('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized);
    if (isRecord(parsed)) {
      return normalized;
    }
  } catch {
    // ignore and continue scanning for embedded JSON
  }

  let bestCandidate: string | null = null;

  for (let startIndex = 0; startIndex < normalized.length; startIndex += 1) {
    if (normalized[startIndex] !== '{') {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let endIndex = startIndex; endIndex < normalized.length; endIndex += 1) {
      const char = normalized[endIndex];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      }

      if (depth !== 0) {
        continue;
      }

      const candidate = normalized.slice(startIndex, endIndex + 1).trim();

      try {
        const parsed = JSON.parse(candidate);
        if (isRecord(parsed) && (!bestCandidate || candidate.length > bestCandidate.length)) {
          bestCandidate = candidate;
        }
      } catch {
        // ignore invalid candidate
      }

      break;
    }
  }

  return bestCandidate;
}

export function extractJsonLikeStringField(text: string, fieldName: string): string | null {
  const normalized = stripMarkdownCodeFence(text);
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`"${escapedFieldName}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)(?:"|$)`, 's');
  const match = normalized.match(pattern);

  if (!match?.[1]) {
    return null;
  }

  return decodeJsonString(match[1]).trim() || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function decodeJsonString(text: string): string {
  return text
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

export function extractArkOutputText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return '';
  }

  for (let index = payload.output.length - 1; index >= 0; index -= 1) {
    const item = payload.output[index];

    if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) {
      continue;
    }

    const text = item.content
      .filter((part): part is Record<string, unknown> => isRecord(part))
      .filter(part => part.type === 'output_text' && typeof part.text === 'string')
      .map(part => String(part.text))
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  for (let index = payload.output.length - 1; index >= 0; index -= 1) {
    const item = payload.output[index];

    if (!isRecord(item) || item.type !== 'reasoning' || !Array.isArray(item.summary)) {
      continue;
    }

    const text = item.summary
      .filter((part): part is Record<string, unknown> => isRecord(part))
      .filter(part => part.type === 'summary_text' && typeof part.text === 'string')
      .map(part => String(part.text))
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  return '';
}

export function summarizeText(text: string, maxLength = 120): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}
