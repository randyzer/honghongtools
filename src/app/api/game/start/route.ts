import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { generateGameStart } from '@/lib/ai/services/game-ai-service';

export async function POST(request: NextRequest) {
  try {
    const { scenarioId, personalityId, genderId } = await request.json();
    const result = await generateGameStart({
      scenarioId,
      personalityId,
      genderId,
      requestHeaders: request.headers,
    });

    return NextResponse.json({
      reply: result.reply,
      options: result.options,
      emotionState: result.emotionState,
      audioUrl: result.audioUrl,
    });
  } catch (error) {
    const routeError = toRouteError(error, '游戏启动失败，请重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
