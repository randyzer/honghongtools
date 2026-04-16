import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Tag } from 'lucide-react';
import { getAllArticles } from '@/lib/blog-service';

export const metadata = {
  title: '恋爱攻略 | 哄哄模拟器',
  description: '学会哄人之前，先学会理解。这里有最实用的恋爱技巧和沟通方法。',
};

interface ArticleListItem {
  id: number;
  title: string;
  summary: string;
  author: string;
  read_time: string;
  tags: string;
  created_at: string;
}

export default async function BlogListPage() {
  let articles: ArticleListItem[] = [];
  let error: string | null = null;

  try {
    articles = (await getAllArticles()) as ArticleListItem[];
  } catch (e) {
    error = e instanceof Error ? e.message : '获取文章列表失败';
    console.error('获取文章列表失败:', e);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 返回按钮 */}
        <Link href="/">
          <Button variant="ghost" className="mb-6 text-gray-600 dark:text-gray-300">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Button>
        </Link>

        {/* 标题 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-3">
            📚 恋爱攻略
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            学会哄人之前，先学会理解
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="text-center py-8 text-red-500">
            <p>{error}</p>
          </div>
        )}

        {/* 文章列表 */}
        <div className="space-y-6">
          {articles.map((article) => {
            let tags: string[] = [];
            try {
              tags = JSON.parse(article.tags || '[]');
            } catch {
              tags = [];
            }
            
            // 格式化日期
            const date = new Date(article.created_at).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            return (
              <Link key={article.id} href={`/blog/${article.id}`}>
                <Card className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-pink-200 dark:hover:border-pink-800">
                  <CardHeader>
                    <CardTitle className="text-xl text-gray-800 dark:text-gray-100 hover:text-pink-500 transition-colors">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {article.read_time}
                      </span>
                      <span>{date}</span>
                      <span>·</span>
                      <span>{article.author}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300 line-clamp-2">
                      {article.summary}
                    </p>
                    {tags.length > 0 && (
                      <div className="flex gap-2 mt-4 flex-wrap">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-300"
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* 空状态 */}
        {!error && articles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>暂无文章</p>
          </div>
        )}

        {/* 底部提示 */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>更多攻略持续更新中...</p>
        </div>
      </div>
    </div>
  );
}
