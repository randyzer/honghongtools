import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { findUserById } from '@/storage/database/queries/app-queries';

// 验证用户是否存在
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ user: null });
    }
    
    const numericUserId = Number(userId);
    if (!Number.isFinite(numericUserId)) {
      return NextResponse.json({ user: null });
    }

    const data = await findUserById(getDb(), numericUserId);

    if (!data) {
      return NextResponse.json({ user: null });
    }
    
    return NextResponse.json({ user: data });
  } catch {
    return NextResponse.json({ user: null });
  }
}
