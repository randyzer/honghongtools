'use client';

import { Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Volume2, RotateCcw, Home, User } from 'lucide-react';
import { scenarios, personalityTypes, getEmotionByScore } from '@/lib/game-data';
import { useStoredUser } from '@/hooks/use-stored-user';

interface Option {
  text: string;
  scoreChange: number;
  type: 'good' | 'bad' | 'funny';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
}

interface GameState {
  messages: Message[];
  score: number;
  round: number;
  maxRounds: number;
  gameStatus: 'playing' | 'success' | 'failed';
  options: Option[];
  emotionState: string;
}

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scenarioId = parseInt(searchParams.get('scenario') || '1');
  const personalityId = searchParams.get('personality') || 'gentle';
  const genderId = searchParams.get('gender') || 'female';

  const scenario = scenarios.find(s => s.id === scenarioId) || scenarios[0];
  const personality = personalityTypes.find(p => p.id === personalityId) || personalityTypes[0];

  const user = useStoredUser();
  const [gameState, setGameState] = useState<GameState>({
    messages: [],
    score: 20,
    round: 0,
    maxRounds: 10,
    gameStatus: 'playing',
    options: [],
    emotionState: '生气中',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [showScoreChange, setShowScoreChange] = useState<{ value: number; show: boolean }>({ value: 0, show: false });
  const [recordSaved, setRecordSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const saveGameRecord = useEffectEvent(async () => {
    if (recordSaved || user === undefined) return;
    setRecordSaved(true);

    if (!user) {
      setSaveMessage('登录后可保存你的游戏记录');
      return;
    }

    try {
      const response = await fetch('/api/game/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          scenario: scenario.title,
          finalScore: gameState.score,
          result: gameState.gameStatus,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSaveMessage('您的游戏记录已经保存');
      } else {
        setSaveMessage('保存记录失败');
      }
    } catch (error) {
      console.error('保存游戏记录失败:', error);
      setSaveMessage('保存记录失败');
    }
  });

  const startGame = useEffectEvent(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, personalityId, genderId }),
      });
      
      const data = await response.json();
      
      if (data.reply) {
        setGameState(prev => ({
          ...prev,
          round: 1,
          messages: [{ role: 'assistant', content: data.reply, audioUrl: data.audioUrl }],
          options: [],
          emotionState: data.emotionState || '生气中',
        }));
        
        setIsLoading(false);
        
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            options: data.options || [],
          }));
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      setIsLoading(false);
    }
  });

  // 初始化游戏
  useEffect(() => {
    startGame();
  }, []);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.messages, gameState.options]);

  // 监听游戏状态变化 - 保存记录
  useEffect(() => {
    if (gameState.gameStatus !== 'playing' && !recordSaved) {
      saveGameRecord();
    }
  }, [gameState.gameStatus, recordSaved, user]);

  const selectOption = async (option: Option) => {
    if (isLoading || gameState.gameStatus !== 'playing') return;

    // 显示分数变化动画
    setShowScoreChange({ value: option.scoreChange, show: true });
    setTimeout(() => setShowScoreChange({ value: 0, show: false }), 1500);

    // 添加用户消息
    const userMessage = { role: 'user' as const, content: option.text };
    setGameState(prev => ({ 
      ...prev, 
      messages: [...prev.messages, userMessage], 
      options: [] 
    }));
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOption: option.text,
          scoreChange: option.scoreChange,
          currentScore: gameState.score + option.scoreChange,
          round: gameState.round,
          scenarioId,
          personalityId,
          genderId,
        }),
      });

      const data = await response.json();
      
      const newScore = Math.max(-50, Math.min(100, gameState.score + option.scoreChange));
      const newRound = gameState.round + 1;
      
      // 判断游戏状态
      let newStatus: 'playing' | 'success' | 'failed' = 'playing';
      if (newScore >= 80) {
        newStatus = 'success';
      } else if (newScore <= -50) {
        newStatus = 'failed';
      } else if (newRound > gameState.maxRounds && newScore < 80) {
        newStatus = 'failed';
      }
      
      // 添加对方回复
      const assistantMessage = { role: 'assistant' as const, content: data.reply, audioUrl: data.audioUrl };
      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        score: newScore,
        round: newRound,
        options: [], // 先不显示选项
        emotionState: data.emotionState || '情绪变化中',
        gameStatus: newStatus,
      }));
      
      setIsLoading(false);
      
      // 如果游戏继续，延迟 2 秒后显示选项
      if (newStatus === 'playing' && data.options?.length > 0) {
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            options: data.options,
          }));
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  const playAudio = (audioUrl: string) => {
    if (currentAudio) {
      currentAudio.pause();
    }
    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);
    audio.play();
  };

  const restartGame = () => {
    router.push('/');
  };

  const goToProfile = () => {
    router.push('/profile');
  };

  const emotion = getEmotionByScore(gameState.score, genderId);
  const showSuccessAnimation = gameState.gameStatus === 'success';
  const showFailAnimation = gameState.gameStatus === 'failed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      {/* 顶部状态栏 */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* 场景和轮次 */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              <span className="text-lg mr-1">{scenario.icon}</span>
              {scenario.title}
            </span>
            <span className={`font-bold ${gameState.round > 7 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
              第 {gameState.round} 轮 / 共 {gameState.maxRounds} 轮
            </span>
          </div>
          
          {/* 好感度进度条 */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300 w-16">好感度</span>
            <div className="flex-1 relative">
              <Progress 
                value={Math.max(0, (gameState.score + 50) / 150 * 100)} 
                className="h-3"
              />
              {/* 分数变化动画 */}
              {showScoreChange.show && (
                <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                  font-bold text-lg ${showScoreChange.value > 0 ? 'text-green-500' : 'text-red-500'}
                  animate-bounce`}>
                  {showScoreChange.value > 0 ? '+' : ''}{showScoreChange.value}
                </div>
              )}
            </div>
            <span className="text-sm font-bold w-12 text-right">
              {gameState.score}
            </span>
          </div>
          
          {/* 目标提示 */}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>失败线: -50</span>
            <span className="text-pink-500">当前: {emotion.state}</span>
            <span>成功线: 80</span>
          </div>
        </div>
      </div>

      {/* 聊天区域 */}
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full pb-96">
        <div className="space-y-4">
          {gameState.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback className="bg-pink-100 dark:bg-pink-900 text-lg">
                    {personality.avatar}
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                <Card className={`${msg.role === 'user' ? 'bg-pink-500 text-white' : 'bg-white dark:bg-gray-800'}`}>
                  <CardContent className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.audioUrl && msg.role === 'assistant' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 px-2 text-gray-600 dark:text-gray-300"
                        onClick={() => playAudio(msg.audioUrl!)}
                      >
                        <Volume2 className="w-4 h-4 mr-1" />
                        播放语音
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {msg.role === 'user' && (
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback className="bg-blue-100 dark:bg-blue-900">
                    😊
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-pink-100 dark:bg-pink-900 text-lg">
                  {personality.avatar}
                </AvatarFallback>
              </Avatar>
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="p-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 底部选项区域 - 固定在底部 */}
      {gameState.gameStatus === 'playing' && !isLoading && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-2xl mx-auto">
            {gameState.options.length > 0 ? (
              <>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-3">
                  你想怎么说？
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {gameState.options.map((option, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className={`h-auto py-3 px-4 justify-start text-left whitespace-normal 
                        hover:bg-pink-50 dark:hover:bg-pink-950 hover:border-pink-300
                        transition-all duration-200`}
                      onClick={() => selectOption(option)}
                    >
                      <span className="text-sm">{option.text}</span>
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-2">
                💭 请阅读对方的回复...
              </p>
            )}
          </div>
        </div>
      )}

      {/* 成功动画 */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="text-center animate-bounce bg-white dark:bg-gray-800 rounded-2xl p-8 mx-4">
            <div className="text-8xl mb-4">💕</div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">恭喜你！</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">TA 原谅你了！</p>
            <p className="text-lg text-pink-500 mb-2">
              最终好感度：{gameState.score} 分
            </p>
            {saveMessage && (
              <p className={`text-sm mb-4 ${user ? 'text-green-600' : 'text-orange-500'}`}>
                {saveMessage}
              </p>
            )}
            <div className="flex gap-4 justify-center flex-wrap">
              <Button onClick={restartGame} variant="outline">
                <Home className="w-4 h-4 mr-2" />
                返回首页
              </Button>
              {user && (
                <Button onClick={goToProfile} variant="outline" className="border-purple-300 text-purple-600">
                  <User className="w-4 h-4 mr-2" />
                  我的记录
                </Button>
              )}
              <Button 
                onClick={() => router.push(`/game?scenario=${scenarioId}&personality=${personalityId}&gender=${genderId}`)} 
                className="bg-pink-500 hover:bg-pink-600"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                再玩一次
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 失败动画 */}
      {showFailAnimation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="text-center bg-white dark:bg-gray-800 rounded-2xl p-8 mx-4">
            <div className="text-8xl mb-4 animate-pulse">💔</div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              {gameState.score <= -50 ? '分手了...' : '没哄好...'}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
              {gameState.score <= -50 ? '好感度太低了' : '轮次用完了'}
            </p>
            <p className="text-lg text-pink-500 mb-2">
              最终好感度：{gameState.score} 分
            </p>
            {saveMessage && (
              <p className={`text-sm mb-4 ${user ? 'text-green-600' : 'text-orange-500'}`}>
                {saveMessage}
              </p>
            )}
            <div className="flex gap-4 justify-center flex-wrap">
              <Button onClick={restartGame} variant="outline">
                <Home className="w-4 h-4 mr-2" />
                返回首页
              </Button>
              {user && (
                <Button onClick={goToProfile} variant="outline" className="border-purple-300 text-purple-600">
                  <User className="w-4 h-4 mr-2" />
                  我的记录
                </Button>
              )}
              <Button 
                onClick={() => router.push(`/game?scenario=${scenarioId}&personality=${personalityId}&gender=${genderId}`)} 
                className="bg-pink-500 hover:bg-pink-600"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                再试一次
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 加载中的骨架屏
function GameLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">💕</div>
        <p className="text-gray-600 dark:text-gray-300">游戏加载中...</p>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<GameLoading />}>
      <GameContent />
    </Suspense>
  );
}
