import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { transcribeSpeechInput } from '@/lib/ai/services/speech-service';

export async function POST(request: NextRequest) {
  try {
    const { base64Data } = await request.json();
    
    if (!base64Data) {
      return NextResponse.json(
        { error: '缺少音频数据' },
        { status: 400 }
      );
    }
    const result = await transcribeSpeechInput({
      uid: 'game-user',
      base64Data,
      requestHeaders: request.headers,
    });

    return NextResponse.json({
      text: result.text,
      duration: result.duration,
    });
  } catch (error) {
    const routeError = toRouteError(error, '语音识别失败，请重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
