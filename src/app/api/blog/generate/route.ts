import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { generateBlogArticle } from '@/lib/ai/services/blog-ai-service';

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();
    const result = await generateBlogArticle({
      topic,
      requestHeaders: request.headers,
    });

    return NextResponse.json({
      success: result.success,
      article: result.article,
    });
  } catch (error) {
    const routeError = toRouteError(error, '生成文章失败');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
