'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { scenarios, genderTypes, getPersonalitiesByGender } from '@/lib/game-data';
import Navbar from '@/components/Navbar';

export default function HomePage() {
  const router = useRouter();
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [selectedPersonality, setSelectedPersonality] = useState<string | null>(null);
  const [step, setStep] = useState<'gender' | 'scenario' | 'personality'>('gender');

  // 当选择性别时，重置人设选择
  const handleGenderSelect = (genderId: string) => {
    setSelectedGender(genderId);
    setSelectedPersonality(null);
  };

  // 获取当前性别的人设列表
  const currentPersonalities = selectedGender ? getPersonalitiesByGender(selectedGender) : [];

  const handleStartGame = () => {
    if (selectedScenario && selectedPersonality && selectedGender) {
      router.push(`/game?scenario=${selectedScenario}&personality=${selectedPersonality}&gender=${selectedGender}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 顶部导航栏 */}
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">
            💕 哄哄模拟器
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            学会哄人，从今天开始
          </p>
        </div>

        {/* 步骤1: 选择性别 */}
        {step === 'gender' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                第一步：你想哄谁？
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                选择对方的性别
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto">
              {genderTypes.map((gender) => (
                <Card
                  key={gender.id}
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                    selectedGender === gender.id
                      ? 'ring-2 ring-pink-500 bg-pink-50 dark:bg-pink-950'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => handleGenderSelect(gender.id)}
                >
                  <CardHeader className="text-center pb-2">
                    <div className="text-6xl mb-2">{gender.avatar}</div>
                    <CardTitle className="text-xl">{gender.name}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <div className="flex justify-center mt-8">
              <Button
                size="lg"
                className="px-8 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                disabled={!selectedGender}
                onClick={() => setStep('scenario')}
              >
                下一步：选择场景
              </Button>
            </div>
          </div>
        )}

        {/* 步骤2: 选择场景 */}
        {step === 'scenario' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                第二步：你做了什么？
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                选择一个让 TA 生气的场景
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenarios.map((scenario) => (
                <Card
                  key={scenario.id}
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                    selectedScenario === scenario.id
                      ? 'ring-2 ring-pink-500 bg-pink-50 dark:bg-pink-950'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedScenario(scenario.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-2xl">{scenario.icon}</span>
                      {scenario.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                      {scenario.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep('gender')}
              >
                返回上一步
              </Button>
              <Button
                size="lg"
                className="px-8 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                disabled={!selectedScenario}
                onClick={() => setStep('personality')}
              >
                下一步：选择性格
              </Button>
            </div>
          </div>
        )}

        {/* 步骤3: 选择人设 */}
        {step === 'personality' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                第三步：TA 是什么性格？
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                不同性格的人，哄的方式也不同哦
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {currentPersonalities.map((personality) => (
                <Card
                  key={personality.id}
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                    selectedPersonality === personality.id
                      ? 'ring-2 ring-pink-500 bg-pink-50 dark:bg-pink-950'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedPersonality(personality.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-3xl">{personality.avatar}</span>
                      {personality.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm text-gray-600 dark:text-gray-300">
                      {personality.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep('scenario')}
              >
                返回上一步
              </Button>
              <Button
                size="lg"
                className="px-8 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                disabled={!selectedPersonality}
                onClick={handleStartGame}
              >
                开始游戏 🎮
              </Button>
            </div>
          </div>
        )}

        {/* 底部说明 */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>💡 游戏共10轮，目标是将好感度提升到80分</p>
          <p className="mt-1">如果好感度降到-50分，则会分手失败</p>
        </div>

        {/* 排行榜入口 */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              🏆 排行榜
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              看看谁的哄人技巧最强
            </p>
            <Button
              size="lg"
              variant="outline"
              className="px-8 border-purple-300 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
              onClick={() => router.push('/leaderboard')}
            >
              查看排行榜 →
            </Button>
          </div>
        </div>

        {/* 恋爱攻略入口 */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              📚 恋爱攻略
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              学会哄人之前，先学会理解
            </p>
            <Button
              size="lg"
              variant="outline"
              className="px-8 border-pink-300 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950"
              onClick={() => router.push('/blog')}
            >
              查看恋爱攻略 →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
