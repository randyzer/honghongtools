'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { notifyStoredUserChange, useStoredUser } from '@/hooks/use-stored-user';

export default function Navbar() {
  const user = useStoredUser();

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('hh_user');
    notifyStoredUserChange();
    // 强制刷新页面
    window.location.href = '/';
  };

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3 max-w-6xl flex justify-between items-center">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
          💕 哄哄模拟器
        </Link>
        
        <div className="flex items-center gap-4">
          <Link href="/blog">
            <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">
              📚 恋爱攻略
            </Button>
          </Link>
          
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">
                  🎮 我的记录
                </Button>
              </Link>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                欢迎，<span className="font-medium text-gray-800 dark:text-gray-100">{user.username}</span>
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                退出登录
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">登录</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
                  注册
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
