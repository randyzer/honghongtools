'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { useStoredUser } from '@/hooks/use-stored-user';

interface LeaderboardEntry {
  user_id: number;
  username: string;
  best_score: number;
  achieved_at: string;
}

export default function LeaderboardPage() {
  const user = useStoredUser();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取排行榜
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();
        if (data.success) {
          setLeaderboard(data.leaderboard);
        }
      } catch (error) {
        console.error('获取排行榜失败:', error);
      }
      setLoading(false);
    };
    
    fetchLeaderboard();
  }, []);

  // 格式化时间
  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 排名图标
  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
            哄人高手排行榜
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            按最高好感度分数排名
          </p>
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            加载中...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🎮</div>
            <p className="text-gray-500 mb-4">暂无记录</p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-pink-500 to-purple-500">
                开始游戏
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = user && user.id === entry.user_id;
              
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-4 rounded-lg ${
                    isCurrentUser
                      ? 'bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-950 dark:to-purple-950 border-2 border-pink-400'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* 排名 */}
                  <div className="w-10 text-center font-bold text-lg">
                    {getRankIcon(rank)}
                  </div>
                  
                  {/* 用户名 */}
                  <div className="flex-1">
                    <div className={`font-medium ${isCurrentUser ? 'text-pink-600' : 'text-gray-800 dark:text-white'}`}>
                      {entry.username}
                      {isCurrentUser && <span className="ml-2 text-xs text-pink-500">（我）</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTime(entry.achieved_at)}
                    </div>
                  </div>
                  
                  {/* 分数 */}
                  <div className="text-right">
                    <div className="font-bold text-xl text-purple-600">
                      {entry.best_score}
                    </div>
                    <div className="text-xs text-gray-500">分</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="mt-8 text-center">
          <Link href="/">
            <Button variant="outline" size="lg">
              返回首页
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
