'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import { useStoredUser } from '@/hooks/use-stored-user';

interface GameRecord {
  id: number;
  scenario: string;
  final_score: number;
  result: 'success' | 'failed';
  played_at: string;
}

export default function ProfilePage() {
  const user = useStoredUser();
  const [records, setRecords] = useState<GameRecord[] | null>(null);

  // 加载游戏记录
  useEffect(() => {
    if (!user) return;
    
    const fetchRecords = async () => {
      try {
        const response = await fetch(`/api/game/records?userId=${user.id}`);
        const data = await response.json();
        if (data.success) {
          setRecords(data.records);
          return;
        }
      } catch (error) {
        console.error('获取记录失败:', error);
      }

      setRecords([]);
    };
    
    fetchRecords();
  }, [user]);

  const loading = user === undefined || (user !== null && records === null);
  const safeRecords = records ?? [];

  // 未登录提示
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-4xl text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            请先登录
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            登录后可查看你的游戏记录
          </p>
          <Link href="/login">
            <Button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
              去登录
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 统计数据
  const totalGames = safeRecords.length;
  const successGames = safeRecords.filter(r => r.result === 'success').length;
  const successRate = totalGames > 0 ? Math.round(successGames / totalGames * 100) : 0;
  const avgScore = totalGames > 0 ? Math.round(safeRecords.reduce((sum, r) => sum + r.final_score, 0) / totalGames) : 0;

  // 格式化时间
  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 用户信息 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">👤</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {user?.username} 的游戏记录
          </h1>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-pink-500">{totalGames}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">总场次</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-green-500">{successRate}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">成功率</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-purple-500">{avgScore}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">平均分</div>
            </CardContent>
          </Card>
        </div>

        {/* 游戏记录列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">历史记录</CardTitle>
          </CardHeader>
          <CardContent>
            {safeRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-4xl mb-2">🎮</div>
                <p>还没有游戏记录</p>
                <p className="text-sm mt-1">快去玩一局吧！</p>
                <Link href="/">
                  <Button className="mt-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
                    开始游戏
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {safeRecords.map((record) => (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      record.result === 'success'
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">
                        {record.result === 'success' ? '💕' : '💔'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">
                          {record.scenario}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatTime(record.played_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${
                        record.result === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {record.result === 'success' ? '通关' : '失败'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        好感度：{record.final_score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="outline">
              返回首页
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
