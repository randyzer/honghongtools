import { NextResponse } from 'next/server';
import { initArticles } from '@/lib/blog-service';

export async function POST() {
  try {
    const result = await initArticles();
    return NextResponse.json(result);
  } catch (error) {
    console.error('初始化文章数据失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '初始化失败' },
      { status: 500 }
    );
  }
}
