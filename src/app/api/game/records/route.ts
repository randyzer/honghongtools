import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { createGameRecord, listGameRecordsByUserId } from '@/storage/database/queries/app-queries';

// 保存游戏记录
export async function POST(request: NextRequest) {
  try {
    const { userId, scenario, finalScore, result } = await request.json();
    
    if (!userId || !scenario || finalScore === undefined || !result) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }
    
    if (!['success', 'failed'].includes(result)) {
      return NextResponse.json({ error: '无效的结果类型' }, { status: 400 });
    }
    
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    await createGameRecord(getDb(), {
      userId: numericUserId,
      scenario,
      finalScore,
      result,
    });
    
    return NextResponse.json({ success: true, message: '游戏记录已保存' });
  } catch (error) {
    console.error('保存游戏记录错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 获取用户的游戏记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }
    
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const records = await listGameRecordsByUserId(getDb(), numericUserId);
    
    return NextResponse.json({ success: true, records });
  } catch (error) {
    console.error('获取游戏记录错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
