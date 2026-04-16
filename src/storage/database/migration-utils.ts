type MigrationTableName = 'users' | 'blog_post' | 'game_records';

type MigrationEnv = {
  sourceDatabaseUrl: string;
  targetDatabaseUrl: string;
};

type MigrationTableConfig = {
  tableName: MigrationTableName;
  columns: string[];
  idColumn: 'id';
  createStatements: string[];
};

const migrationConfig: MigrationTableConfig[] = [
  {
    tableName: 'users',
    columns: ['id', 'username', 'password', 'created_at'],
    idColumn: 'id',
    createStatements: [
      `create table if not exists users (
        id serial primary key,
        username varchar(50) not null,
        password varchar(255) not null,
        created_at timestamp with time zone not null default now()
      )`,
      'create unique index if not exists users_username_unique on users (username)',
    ],
  },
  {
    tableName: 'blog_post',
    columns: ['id', 'title', 'summary', 'content', 'author', 'read_time', 'tags', 'created_at', 'updated_at'],
    idColumn: 'id',
    createStatements: [
      `create table if not exists blog_post (
        id serial primary key,
        title varchar(255) not null,
        summary text not null,
        content text not null,
        author varchar(100) not null default '恋爱教练小王',
        read_time varchar(20) not null default '3分钟',
        tags text not null default '[]',
        created_at timestamp with time zone not null default now(),
        updated_at timestamp with time zone default now()
      )`,
      'create index if not exists blog_post_created_at_idx on blog_post (created_at)',
    ],
  },
  {
    tableName: 'game_records',
    columns: ['id', 'user_id', 'scenario', 'final_score', 'result', 'played_at'],
    idColumn: 'id',
    createStatements: [
      `create table if not exists game_records (
        id serial primary key,
        user_id integer not null references users(id) on delete cascade,
        scenario varchar(100) not null,
        final_score integer not null,
        result varchar(20) not null,
        played_at timestamp with time zone not null default now()
      )`,
      'create index if not exists game_records_user_id_idx on game_records (user_id)',
      'create index if not exists game_records_played_at_idx on game_records (played_at)',
    ],
  },
];

function getMigrationConfig(): MigrationTableConfig[] {
  return migrationConfig;
}

function getSchemaResetStatements(): string[] {
  const dropStatements = [...migrationConfig]
    .reverse()
    .map((table) => `drop table if exists ${table.tableName} cascade`);

  const createStatements = migrationConfig.flatMap((table) => table.createStatements);

  return [...dropStatements, ...createStatements];
}

function getMigrationEnv(): MigrationEnv {
  const sourceDatabaseUrl = process.env.SOURCE_DATABASE_URL;
  const targetDatabaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!sourceDatabaseUrl) {
    throw new Error('SOURCE_DATABASE_URL is not set');
  }

  if (!targetDatabaseUrl) {
    throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is not set');
  }

  return {
    sourceDatabaseUrl,
    targetDatabaseUrl,
  };
}

function buildInsertStatement(
  tableName: string,
  columns: string[],
  rows: Array<Record<string, unknown>>,
): { text: string; values: unknown[] } {
  if (rows.length === 0) {
    throw new Error(`Cannot build insert statement for empty table "${tableName}"`);
  }

  const values: unknown[] = [];
  const valueGroups = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      values.push(row[column] ?? null);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });

    return `(${placeholders.join(', ')})`;
  });

  return {
    text: `insert into ${tableName} (${columns.join(', ')}) values ${valueGroups.join(', ')}`,
    values,
  };
}

function buildResetSequenceStatement(tableName: string, idColumn: string): string {
  return `select setval(pg_get_serial_sequence('public.${tableName}', '${idColumn}'), coalesce((select max(${idColumn}) from ${tableName}), 0) + 1, false);`;
}

export {
  buildInsertStatement,
  buildResetSequenceStatement,
  getMigrationConfig,
  getMigrationEnv,
  getSchemaResetStatements,
};

export type { MigrationEnv, MigrationTableConfig, MigrationTableName };
