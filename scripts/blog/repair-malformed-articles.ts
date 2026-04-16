import dotenv from 'dotenv';
import { getDb } from '@/storage/database/db';
import { normalizeStoredArticle } from '@/lib/blog-article';

dotenv.config({ path: '.env.local' });

type ArticleRow = {
  id: number;
  title: string;
  summary: string;
  content: string;
  tags: string;
};

async function main() {
  const db = getDb();
  const result = await db.query(
    `select id, title, summary, content, tags
     from blog_post
     where title like '{%' or content like '{%'`,
  );

  let repairedCount = 0;

  for (const row of result.rows as ArticleRow[]) {
    const normalized = normalizeStoredArticle(row);

    if (
      normalized.title === row.title &&
      normalized.summary === row.summary &&
      normalized.content === row.content &&
      normalized.tags === row.tags
    ) {
      continue;
    }

    await db.query(
      `update blog_post
       set title = $1, summary = $2, content = $3, tags = $4, updated_at = now()
       where id = $5`,
      [normalized.title, normalized.summary, normalized.content, normalized.tags, row.id],
    );

    repairedCount += 1;
  }

  console.log(JSON.stringify({ repairedCount }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
