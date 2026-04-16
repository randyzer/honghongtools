import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { deleteArticleById } from '@/storage/database/queries/app-queries';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id, 10);
    
    if (isNaN(articleId)) {
      return NextResponse.json(
        { error: '无效的文章 ID' },
        { status: 400 }
      );
    }
    
    await deleteArticleById(getDb(), articleId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除文章失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
