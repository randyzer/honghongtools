import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { createUserRecord } from '@/storage/database/queries/app-queries';

// 密码哈希 - SHA-256
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 注册
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }
    
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(username)) {
      return NextResponse.json({ error: '用户名格式不正确' }, { status: 400 });
    }
    
    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少6个字符' }, { status: 400 });
    }
    
    const hashedPassword = await hashPassword(password);

    let data;
    try {
      data = await createUserRecord(getDb(), { username, password: hashedPassword });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
      }
      return NextResponse.json({ error: '注册失败' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: '注册失败' }, { status: 500 });
    }
    
    // 返回用户信息，前端存储到 localStorage
    return NextResponse.json({ 
      success: true, 
      user: { id: data.id, username: data.username } 
    });
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
