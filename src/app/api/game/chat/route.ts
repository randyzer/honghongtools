import { NextRequest, NextResponse } from 'next/server';
import { toRouteError } from '@/lib/ai/errors';
import { generateGameChat } from '@/lib/ai/services/game-ai-service';

export async function POST(request: NextRequest) {
  try {
    const { 
      selectedOption, 
      scoreChange, 
      currentScore, 
      round, 
      scenarioId, 
      personalityId, 
      genderId 
    } = await request.json();
    const result = await generateGameChat({
      selectedOption,
      scoreChange,
      currentScore,
      round,
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
    const routeError = toRouteError(error, '对话失败，请重试');
    return NextResponse.json(routeError.body, { status: routeError.status });
  }
}
