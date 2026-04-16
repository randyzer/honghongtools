import {
  genderTypes,
  getEmotionByScore,
  getSystemPrompt,
  personalityTypes,
  scenarios,
} from '@/lib/game-data';
import {
  getAiConfig,
  getTextRequestPolicy,
} from '@/lib/ai/config';
import { logAiEvent } from '@/lib/ai/logger';
import { extractJsonObject } from '@/lib/ai/parsers';
import { runTextProvider } from '@/lib/ai/provider-factory';
import { synthesizeSpeechAudio } from '@/lib/ai/services/speech-service';
import { AiProviderName } from '@/lib/ai/types';

export interface GameOption {
  text: string;
  scoreChange: number;
  type: 'good' | 'bad' | 'funny';
}

export interface GameReplyResult {
  reply: string;
  options: GameOption[];
  emotionState: string;
  audioUrl: string;
  provider: AiProviderName;
  speechProvider?: AiProviderName;
}

interface GameStartInput {
  scenarioId: number | string;
  personalityId: string;
  genderId: string;
  requestHeaders?: Headers;
}

interface GameChatInput extends GameStartInput {
  selectedOption: string;
  scoreChange: number;
  currentScore: number;
  round: number;
}

interface ParsedGameResponse {
  reply: string;
  options: GameOption[];
  emotionState: string;
}

function generateDefaultStartOptions(genderId: string): GameOption[] {
  const goodPrefix = genderId === 'female' ? '宝贝' : '亲爱的';

  return [
    { text: `${goodPrefix}对不起，我错了，我以后一定注意`, scoreChange: 10, type: 'good' },
    { text: '我知道错了，我会用行动证明的', scoreChange: 15, type: 'good' },
    { text: '好啦好啦，别生气了', scoreChange: -5, type: 'bad' },
    { text: '这有什么好生气的...', scoreChange: -15, type: 'bad' },
    { text: '要不我给你跳一段？', scoreChange: -20, type: 'funny' },
    { text: '我请你吃肯德基疯狂星期四行不行？', scoreChange: -25, type: 'funny' },
  ];
}

function generateDefaultChatOptions(genderId: string): GameOption[] {
  const goodPrefix = genderId === 'female' ? '宝贝' : '亲爱的';

  return [
    { text: `${goodPrefix}我知道错了，原谅我吧`, scoreChange: 10, type: 'good' },
    { text: '我会好好补偿你的', scoreChange: 15, type: 'good' },
    { text: '好啦别生气了嘛', scoreChange: -5, type: 'bad' },
    { text: '你至于这么大反应吗', scoreChange: -15, type: 'bad' },
    { text: '要不我给你唱首歌？', scoreChange: -20, type: 'funny' },
    { text: '我错了，但你也有错啊', scoreChange: -25, type: 'funny' },
  ];
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];

  for (let index = newArray.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [newArray[index], newArray[target]] = [newArray[target], newArray[index]];
  }

  return newArray;
}

function normalizeGameOptions(
  options: unknown,
  fallbackOptions: GameOption[],
): GameOption[] {
  if (!Array.isArray(options)) {
    return shuffleArray(fallbackOptions);
  }

  const normalized = options
    .filter((option): option is Record<string, unknown> => typeof option === 'object' && option !== null)
    .map((option): GameOption => {
      const type =
        option.type === 'good' || option.type === 'bad' || option.type === 'funny'
          ? option.type
          : 'bad';

      return {
        text: String(option.text || '').trim(),
        scoreChange: Number(option.scoreChange || 0),
        type,
      };
    })
    .filter(option => option.text);

  if (normalized.length === 0) {
    return shuffleArray(fallbackOptions);
  }

  return shuffleArray(normalized);
}

function parseGameResponse(
  rawText: string,
  fallbackReply: string,
  fallbackOptions: GameOption[],
  fallbackEmotionState: string,
  isLastRound: boolean,
): ParsedGameResponse {
  const jsonText = extractJsonObject(rawText);

  if (!jsonText) {
    return {
      reply: rawText || fallbackReply,
      options: isLastRound ? [] : shuffleArray(fallbackOptions),
      emotionState: fallbackEmotionState,
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    return {
      reply: String(parsed.reply || rawText || fallbackReply),
      options: isLastRound ? [] : normalizeGameOptions(parsed.options, fallbackOptions),
      emotionState: String(parsed.emotionState || fallbackEmotionState),
    };
  } catch {
    return {
      reply: rawText || fallbackReply,
      options: isLastRound ? [] : shuffleArray(fallbackOptions),
      emotionState: fallbackEmotionState,
    };
  }
}

async function maybeGenerateAudio(
  reply: string,
  personalityId: string,
  emotionState: string,
  voiceId: string,
  requestHeaders?: Headers,
): Promise<{ audioUrl: string; speechProvider?: AiProviderName }> {
  try {
    const speechResult = await synthesizeSpeechAudio({
      text: reply,
      voiceId,
      personalityId,
      emotionState,
      uid: 'game-user',
      requestHeaders,
    });

    return {
      audioUrl: speechResult.audioUrl,
      speechProvider: speechResult.provider,
    };
  } catch (error) {
    logAiEvent('warn', {
      event: 'request_error',
      capability: 'speech_tts_non_blocking',
      provider: getAiConfig().speechPrimaryProvider,
      summary: error instanceof Error ? error.message : 'speech generation skipped',
    });

    return {
      audioUrl: '',
    };
  }
}

export async function generateGameStart(
  input: GameStartInput,
): Promise<GameReplyResult> {
  const textPolicy = getTextRequestPolicy('game_start');
  const scenario = scenarios.find(item => item.id === Number(input.scenarioId)) || scenarios[0];
  const personality =
    personalityTypes.find(item => item.id === input.personalityId) || personalityTypes[0];
  const gender = genderTypes.find(item => item.id === input.genderId) || genderTypes[0];

  const textResult = await runTextProvider('game_start', provider =>
    provider.generateText({
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(input.genderId, input.personalityId, scenario),
        },
        {
          role: 'user',
          content: `游戏开始！当前是第1轮，共10轮。
好感度：20分（初始好感度较低，因为你很生气）

请根据场景设定生成：
1. 你的开场白：直接表达你的生气和不满，质问对方做错了什么。语气要符合你的人设，直接说出生气的话，不要解释场景背景。
2. 6个选项供用户选择（用来哄你的）

输出约束：
- reply 控制在40-60字
- emotionState 只返回简短中文状态
- 每个 option.text 控制在10-24字
- 只返回 JSON，不要 markdown，不要额外解释

请严格按照以下JSON格式回复：
{"reply":"开场白","emotionState":"非常生气","options":[{"text":"选项文案","scoreChange":10,"type":"good"}]}`,
        },
      ],
      temperature: 0.9,
      timeoutMs: textPolicy.timeoutMs,
      maxOutputTokens: textPolicy.maxOutputTokens,
      requestHeaders: input.requestHeaders,
    }),
  );

  const fallbackReply = gender.name === '女朋友' ? '哼，你还有脸来找我？' : '你觉得你做错什么了吗？';
  const parsed = parseGameResponse(
    textResult.text,
    fallbackReply,
    generateDefaultStartOptions(input.genderId),
    '非常生气',
    false,
  );
  const audio = await maybeGenerateAudio(
    parsed.reply,
    input.personalityId,
    parsed.emotionState,
    personality.voiceId,
    input.requestHeaders,
  );

  return {
    reply: parsed.reply,
    options: parsed.options,
    emotionState: parsed.emotionState,
    audioUrl: audio.audioUrl,
    provider: textResult.provider,
    speechProvider: audio.speechProvider,
  };
}

export async function generateGameChat(
  input: GameChatInput,
): Promise<GameReplyResult> {
  const textPolicy = getTextRequestPolicy('game_chat');
  const scenario = scenarios.find(item => item.id === Number(input.scenarioId)) || scenarios[0];
  const personality =
    personalityTypes.find(item => item.id === input.personalityId) || personalityTypes[0];
  const emotion = getEmotionByScore(input.currentScore, input.genderId);
  const isLastRound = input.round >= 10;

  const contextPrompt = `当前状态：
- 好感度：${input.currentScore}/100（${emotion.state}，${emotion.style}）
- 当前轮次：第${input.round}轮/共10轮
- 用户选择了：「${input.selectedOption}」
- 这个选择导致好感度${input.scoreChange >= 0 ? '增加' : '减少'}了${Math.abs(input.scoreChange)}分

${isLastRound ? '注意：这是最后一轮了！' : ''}

请生成：
1. 你对用户选择的回应（要根据好感度和人设调整语气，如果是搞笑选项可以有点意外反应）
2. ${isLastRound ? '不需要生成新选项，只需要一个结束回应' : '6个新的选项供用户选择'}

输出约束：
- reply 控制在40-70字
- emotionState 只返回简短中文状态
- ${isLastRound ? '最后一轮时 options 必须返回空数组' : '每个 option.text 控制在10-24字'}
- 只返回 JSON，不要 markdown，不要额外解释

请严格按照以下JSON格式回复：
{"reply":"回应内容","emotionState":"情绪状态","options":[{"text":"选项文案","scoreChange":10,"type":"good"}]}`;

  const textResult = await runTextProvider('game_chat', provider =>
    provider.generateText({
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(input.genderId, input.personalityId, scenario),
        },
        {
          role: 'user',
          content: contextPrompt,
        },
      ],
      temperature: 0.95,
      timeoutMs: textPolicy.timeoutMs,
      maxOutputTokens: textPolicy.maxOutputTokens,
      requestHeaders: input.requestHeaders,
    }),
  );

  const parsed = parseGameResponse(
    textResult.text,
    '...',
    generateDefaultChatOptions(input.genderId),
    emotion.state,
    isLastRound,
  );
  const audio = await maybeGenerateAudio(
    parsed.reply,
    input.personalityId,
    parsed.emotionState,
    personality.voiceId,
    input.requestHeaders,
  );

  return {
    reply: parsed.reply,
    options: parsed.options,
    emotionState: parsed.emotionState,
    audioUrl: audio.audioUrl,
    provider: textResult.provider,
    speechProvider: audio.speechProvider,
  };
}
