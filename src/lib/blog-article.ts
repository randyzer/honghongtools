import { extractJsonLikeStringField, extractJsonObject } from '@/lib/ai/parsers';

type StoredArticleShape = {
  title: string;
  summary: string;
  content?: string;
  tags?: string;
};

type ParsedArticlePayload = {
  title: string;
  summary: string;
  content: string;
  tags?: string[];
};

function parseArticlePayload(rawValue: string | undefined): ParsedArticlePayload | null {
  const normalized = rawValue?.trim();

  if (!normalized?.startsWith('{')) {
    return null;
  }

  const jsonText = extractJsonObject(normalized);

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;

      if (
        typeof parsed.title === 'string' &&
        typeof parsed.summary === 'string' &&
        typeof parsed.content === 'string'
      ) {
        return {
          title: parsed.title,
          summary: parsed.summary,
          content: parsed.content,
          tags: Array.isArray(parsed.tags)
            ? parsed.tags.map(tag => String(tag)).filter(Boolean)
            : undefined,
        };
      }
    } catch {
      // continue to loose extraction
    }
  }

  const title = extractJsonLikeStringField(normalized, 'title');
  const summary = extractJsonLikeStringField(normalized, 'summary');
  const content = extractJsonLikeStringField(normalized, 'content');

  if (!title || !summary || !content) {
    return null;
  }

  return {
    title,
    summary,
    content,
    tags: extractJsonLikeStringArrayField(normalized, 'tags'),
  };
}

export function normalizeStoredArticle<T extends StoredArticleShape>(article: T): T {
  const payload = parseArticlePayload(article.content) ?? parseArticlePayload(article.title);

  if (!payload) {
    return article;
  }

  return {
    ...article,
    title: payload.title,
    summary: payload.summary,
    content: article.content === undefined ? article.content : payload.content,
    tags: article.tags === undefined || !payload.tags ? article.tags : JSON.stringify(payload.tags),
  };
}

function formatInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function extractJsonLikeStringArrayField(text: string, fieldName: string): string[] | undefined {
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`"${escapedFieldName}"\\s*:\\s*(\\[[^\\]]*\\])`, 's'));

  if (!match?.[1]) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(match[1]) as unknown[];
    return parsed.map(item => String(item)).filter(Boolean);
  } catch {
    return undefined;
  }
}

export function renderArticleContent(content: string): string {
  return content
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => {
      if (paragraph.startsWith('### ')) {
        return `<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">${formatInlineMarkdown(paragraph.slice(4))}</h3>`;
      }

      if (paragraph.startsWith('## ')) {
        return `<h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-8 mb-4">${formatInlineMarkdown(paragraph.slice(3))}</h2>`;
      }

      if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
        return `<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">${formatInlineMarkdown(paragraph.slice(2, -2))}</h3>`;
      }

      if (paragraph.split('\n').every(line => line.startsWith('- '))) {
        const items = paragraph
          .split('\n')
          .map(item => `<li class="ml-4">${formatInlineMarkdown(item.slice(2))}</li>`)
          .join('');

        return `<ul class="list-disc space-y-2 my-4">${items}</ul>`;
      }

      return `<p class="mb-4">${formatInlineMarkdown(paragraph).replace(/\n/g, '<br />')}</p>`;
    })
    .join('');
}
