import { createArticle } from '@/lib/blog-service';
import { getTextRequestPolicy } from '@/lib/ai/config';
import { BusinessError } from '@/lib/ai/errors';
import { extractJsonLikeStringField, extractJsonObject } from '@/lib/ai/parsers';
import { runTextProvider } from '@/lib/ai/provider-factory';
import { AiProviderName } from '@/lib/ai/types';

interface BlogGenerateInput {
  topic?: string;
  requestHeaders?: Headers;
}

interface ParsedArticleData {
  title: string;
  summary: string;
  content: string;
  tags: string[];
}

export interface BlogGenerationResult {
  success: true;
  article: Awaited<ReturnType<typeof createArticle>>;
  provider: AiProviderName;
}

const FALLBACK_BLOG_TOPICS = [
  '吵架后怎么高情商道歉并快速和好',
  '纪念日忘记后怎么补救不显敷衍',
  '异地恋冷战时怎么开口不踩雷',
  '对象说你不够关心时怎么有效回应',
  '日常聊天总是尬住怎么重新找回甜蜜感',
  '送礼总踩雷时怎么挑到真正有心意的礼物',
] as const;

export function resolveBlogTopic(
  topic?: string,
  randomFn: () => number = Math.random,
): string {
  const normalized = topic?.trim();

  if (normalized) {
    return normalized;
  }

  const index = Math.min(
    FALLBACK_BLOG_TOPICS.length - 1,
    Math.floor(randomFn() * FALLBACK_BLOG_TOPICS.length),
  );

  return FALLBACK_BLOG_TOPICS[index];
}

export function buildArticlePrompts(topic?: string) {
  const resolvedTopic = resolveBlogTopic(topic);
  const systemPrompt = '你是一位恋爱沟通专栏作者。直接输出结果，不要输出思考过程、解释、代码块或额外前后缀。';

  const userPrompt = `围绕“${resolvedTopic}”写一篇恋爱沟通技巧文章。
要求：
1. 标题18-28字，口语化、有点击感
2. 摘要30-50字
3. 正文控制在600-900字，分3个小节，每节给出可执行建议，至少包含1个简短对话示例
4. tags 输出3个中文标签

只返回一个JSON对象：
{"title":"文章标题","summary":"文章摘要","content":"文章正文","tags":["标签1","标签2","标签3"]}`;

  return { systemPrompt, userPrompt };
}

export function parseArticleData(rawText: string): ParsedArticleData {
  const jsonText = extractJsonObject(rawText);

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;

      return {
        title: String(parsed.title || '恋爱小技巧'),
        summary: String(parsed.summary || '学会这些技巧，让感情更甜蜜').slice(0, 100),
        content: String(parsed.content || ''),
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.map(item => String(item)).filter(Boolean)
          : ['恋爱技巧', '沟通'],
      };
    } catch {
      // 继续走文本兜底
    }
  }

  const looseTitle = extractJsonLikeStringField(rawText, 'title');
  const looseSummary = extractJsonLikeStringField(rawText, 'summary');
  const looseContent = extractJsonLikeStringField(rawText, 'content');

  if (looseTitle || looseSummary || looseContent) {
    return {
      title: looseTitle || '恋爱小技巧',
      summary: String(looseSummary || '学会这些技巧，让感情更甜蜜').slice(0, 100),
      content: looseContent || rawText.slice(0, 2000),
      tags: ['恋爱技巧', '沟通'],
    };
  }

  const lines = rawText.split('\n').map(line => line.trim()).filter(Boolean);

  return {
    title: lines[0]?.replace(/^#\s*/, '').replace(/^["']|["']$/g, '') || '恋爱小技巧',
    summary: lines[1]?.slice(0, 50) || '学会这些技巧，让感情更甜蜜',
    content: rawText.slice(0, 2000),
    tags: ['恋爱技巧', '沟通'],
  };
}

export async function generateBlogArticle(
  input: BlogGenerateInput,
): Promise<BlogGenerationResult> {
  const textPolicy = getTextRequestPolicy('blog_generate');
  const { systemPrompt, userPrompt } = buildArticlePrompts(input.topic);
  const textResult = await runTextProvider('blog_generate', provider =>
    provider.generateText({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      timeoutMs: textPolicy.timeoutMs,
      maxOutputTokens: textPolicy.maxOutputTokens,
      requestHeaders: input.requestHeaders,
    }),
  );

  const articleData = parseArticleData(textResult.text);

  if (!articleData.title || !articleData.content) {
    throw new BusinessError({
      code: 'UPSTREAM_ERROR',
      message: 'Generated article payload is incomplete',
      userMessage: '文章生成结果不完整，请稍后重试。',
      statusCode: 502,
      retryable: true,
      provider: textResult.provider,
    });
  }

  const readTime = `${Math.max(1, Math.ceil(articleData.content.length / 300))}分钟`;
  const savedArticle = await createArticle({
    title: articleData.title,
    summary: articleData.summary,
    content: articleData.content,
    author: '恋爱教练小王',
    read_time: readTime,
    tags: JSON.stringify(articleData.tags),
  });

  return {
    success: true,
    article: savedArticle,
    provider: textResult.provider,
  };
}
