import { NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { listLeaderboard } from '@/storage/database/queries/app-queries';

// 获取排行榜 - 每个用户的最高分
export async function GET() {
  try {
    const leaderboard = await listLeaderboard(getDb());

    return NextResponse.json({ success: true, leaderboard });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
