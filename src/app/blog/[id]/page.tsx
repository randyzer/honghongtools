import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Tag, ArrowRight } from 'lucide-react';
import { renderArticleContent } from '@/lib/blog-article';
import { getArticleById, getAllArticles } from '@/lib/blog-service';

interface BlogDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

// 生成元数据
export async function generateMetadata({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const articleId = parseInt(id, 10);
  
  if (isNaN(articleId)) {
    return {
      title: '文章未找到 | 哄哄模拟器',
    };
  }
  
  const article = await getArticleById(articleId);
  
  if (!article) {
    return {
      title: '文章未找到 | 哄哄模拟器',
    };
  }
  
  return {
    title: `${article.title} | 恋爱攻略`,
    description: article.summary,
  };
}

interface ArticleDetail {
  id: number;
  title: string;
  summary: string;
  content: string;
  author: string;
  read_time: string;
  tags: string;
  created_at: string;
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const articleId = parseInt(id, 10);
  
  if (isNaN(articleId)) {
    notFound();
  }

  const article = await getArticleById(articleId) as ArticleDetail | null;
  
  if (!article) {
    notFound();
  }

  // 获取所有文章用于上下篇导航
  const allArticles = await getAllArticles() as Array<{ id: number; title: string }>;
  const currentIndex = allArticles.findIndex(a => a.id === articleId);
  const prevArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : null;
  const nextArticle = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;

  // 解析标签
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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* 返回按钮 */}
        <Link href="/blog">
          <Button variant="ghost" className="mb-6 text-gray-600 dark:text-gray-300">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回攻略列表
          </Button>
        </Link>

        {/* 文章头部 */}
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            {article.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {article.read_time}
            </span>
            <span>{date}</span>
            <span>·</span>
            <span>{article.author}</span>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-300"
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* 文章内容 */}
        <article className="prose prose-pink dark:prose-invert max-w-none">
          <div 
            className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-4"
            dangerouslySetInnerHTML={{ __html: renderArticleContent(article.content) }}
          />
        </article>

        {/* 上下篇导航 */}
        <nav className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prevArticle ? (
              <Link href={`/blog/${prevArticle.id}`}>
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-700 hover:bg-pink-50 dark:hover:bg-pink-950 transition-colors cursor-pointer">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">← 上一篇</div>
                  <div className="font-medium text-gray-800 dark:text-gray-200 line-clamp-1">
                    {prevArticle.title}
                  </div>
                </div>
              </Link>
            ) : (
              <div />
            )}
            
            {nextArticle ? (
              <Link href={`/blog/${nextArticle.id}`}>
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-700 hover:bg-pink-50 dark:hover:bg-pink-950 transition-colors cursor-pointer text-right">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">下一篇 →</div>
                  <div className="font-medium text-gray-800 dark:text-gray-200 line-clamp-1">
                    {nextArticle.title}
                  </div>
                </div>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </nav>

        {/* 返回列表 */}
        <div className="mt-8 text-center">
          <Link href="/blog">
            <Button variant="outline" className="border-pink-300 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950">
              查看全部攻略
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* 去玩游戏 */}
        <div className="mt-8 text-center">
          <Link href="/">
            <Button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
              去玩哄哄模拟器 💕
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
