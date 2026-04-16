import { buildInsertStatement } from '@/storage/database/migration-utils';

type QueryResultRow = Record<string, unknown>;

type QueryClient = {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: QueryResultRow[]; rowCount: number | null }>;
};

type ArticleInsert = {
  title: string;
  summary: string;
  content: string;
  author?: string;
  read_time?: string;
  tags?: string;
};

type UserInsert = {
  username: string;
  password: string;
};

type GameRecordInsert = {
  userId: number;
  scenario: string;
  finalScore: number;
  result: 'success' | 'failed';
};

type InitialArticle = Required<ArticleInsert>;

type ArticleListRow = {
  id: number;
  title: string;
  summary: string;
  author: string;
  read_time: string;
  tags: string;
  created_at: string;
};

type ArticleDetailRow = ArticleListRow & {
  content: string;
  updated_at: string | null;
};

type UserAuthRow = {
  id: number;
  username: string;
  password: string;
};

type UserPublicRow = {
  id: number;
  username: string;
};

type GameRecordRow = {
  id: number;
  user_id: number;
  scenario: string;
  final_score: number;
  result: 'success' | 'failed';
  played_at: string;
};

type LeaderboardRow = {
  user_id: number;
  username: string;
  best_score: number;
  achieved_at: string;
};

function serializeDateFields<T extends QueryResultRow>(
  row: T,
  dateFields: string[],
): T {
  const nextRow: QueryResultRow = { ...row };

  for (const field of dateFields) {
    const value = nextRow[field];
    if (value instanceof Date) {
      nextRow[field] = value.toISOString();
    }
  }

  return nextRow as T;
}

async function hasAnyArticles(db: QueryClient): Promise<boolean> {
  const result = await db.query('select id from blog_post limit 1');
  return result.rows.length > 0;
}

async function insertInitialArticles(db: QueryClient, articles: InitialArticle[]): Promise<number> {
  if (articles.length === 0) {
    return 0;
  }

  const statement = buildInsertStatement(
    'blog_post',
    ['title', 'summary', 'content', 'author', 'read_time', 'tags'],
    articles,
  );

  const result = await db.query(statement.text, statement.values);
  return result.rowCount ?? articles.length;
}

async function listArticles(db: QueryClient) {
  const result = await db.query(
    `select id, title, summary, author, read_time, tags, created_at
     from blog_post
     order by created_at desc`,
  );

  return result.rows.map((row) => serializeDateFields(row, ['created_at']) as ArticleListRow);
}

async function findArticleById(db: QueryClient, id: number) {
  const result = await db.query(
    `select id, title, summary, content, author, read_time, tags, created_at, updated_at
     from blog_post
     where id = $1
     limit 1`,
    [id],
  );

  return result.rows[0]
    ? (serializeDateFields(result.rows[0], ['created_at', 'updated_at']) as ArticleDetailRow)
    : null;
}

async function createArticleRecord(db: QueryClient, article: ArticleInsert) {
  const result = await db.query(
    `insert into blog_post (title, summary, content, author, read_time, tags)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      article.title,
      article.summary,
      article.content,
      article.author || '恋爱教练小王',
      article.read_time || '3分钟',
      article.tags || '[]',
    ],
  );

  return result.rows[0]
    ? (serializeDateFields(result.rows[0], ['created_at', 'updated_at']) as ArticleDetailRow)
    : null;
}

async function deleteArticleById(db: QueryClient, id: number) {
  await db.query('delete from blog_post where id = $1', [id]);
}

async function findUserByUsername(db: QueryClient, username: string): Promise<UserAuthRow | null> {
  const result = await db.query(
    `select id, username, password
     from users
     where username = $1
     limit 1`,
    [username],
  );

  return (result.rows[0] as UserAuthRow | undefined) ?? null;
}

async function createUserRecord(db: QueryClient, user: UserInsert): Promise<UserPublicRow | null> {
  const result = await db.query(
    `insert into users (username, password)
     values ($1, $2)
     returning id, username`,
    [user.username, user.password],
  );

  return (result.rows[0] as UserPublicRow | undefined) ?? null;
}

async function findUserById(db: QueryClient, userId: number): Promise<UserPublicRow | null> {
  const result = await db.query(
    `select id, username
     from users
     where id = $1
     limit 1`,
    [userId],
  );

  return (result.rows[0] as UserPublicRow | undefined) ?? null;
}

async function createGameRecord(db: QueryClient, record: GameRecordInsert) {
  await db.query(
    `insert into game_records (user_id, scenario, final_score, result)
     values ($1, $2, $3, $4)`,
    [record.userId, record.scenario, record.finalScore, record.result],
  );
}

async function listGameRecordsByUserId(db: QueryClient, userId: number): Promise<GameRecordRow[]> {
  const result = await db.query(
    `select id, user_id, scenario, final_score, result, played_at
     from game_records
     where user_id = $1
     order by played_at desc
     limit 50`,
    [userId],
  );

  return result.rows.map((row) => serializeDateFields(row, ['played_at']) as GameRecordRow);
}

async function listLeaderboard(db: QueryClient): Promise<LeaderboardRow[]> {
  const result = await db.query(
    `with ranked as (
       select
         gr.user_id,
         u.username,
         gr.final_score as best_score,
         gr.played_at as achieved_at,
         row_number() over (
           partition by gr.user_id
           order by gr.final_score desc, gr.played_at asc
         ) as rn
       from game_records gr
       join users u on u.id = gr.user_id
       where gr.result = 'success'
     )
     select user_id, username, best_score, achieved_at
     from ranked
     where rn = 1
     order by best_score desc, achieved_at asc
     limit 20`,
  );

  return result.rows.map((row) => serializeDateFields(row, ['achieved_at']) as LeaderboardRow);
}

export {
  createArticleRecord,
  createGameRecord,
  createUserRecord,
  deleteArticleById,
  findArticleById,
  findUserById,
  findUserByUsername,
  hasAnyArticles,
  insertInitialArticles,
  listArticles,
  listGameRecordsByUserId,
  listLeaderboard,
  serializeDateFields,
};

export type {
  ArticleDetailRow,
  ArticleInsert,
  ArticleListRow,
  GameRecordInsert,
  GameRecordRow,
  InitialArticle,
  LeaderboardRow,
  QueryClient,
  UserAuthRow,
  UserInsert,
  UserPublicRow,
};
