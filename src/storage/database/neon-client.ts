import { Pool } from 'pg';

type GlobalWithDbPool = typeof globalThis & {
  __appDbPool?: Pool;
};

function normalizeDatabaseConnectionString(connectionString: string): string {
  const normalized = new URL(connectionString);

  if (normalized.searchParams.get('sslmode') === 'require') {
    normalized.searchParams.set('sslmode', 'verify-full');
  }

  return normalized.toString();
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;
  const sourceUrl = process.env.SOURCE_DATABASE_URL;

  if (url && sourceUrl && url === sourceUrl && unpooledUrl) {
    return unpooledUrl;
  }

  if (!url) {
    if (unpooledUrl) {
      return unpooledUrl;
    }

    throw new Error('DATABASE_URL is not set');
  }

  return url;
}

function getDatabaseUnpooledUrl(): string {
  return process.env.DATABASE_URL_UNPOOLED || getDatabaseUrl();
}

function createDbPool(): Pool {
  return new Pool({
    connectionString: normalizeDatabaseConnectionString(getDatabaseUrl()),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

function getDb(): Pool {
  const globalWithDbPool = globalThis as GlobalWithDbPool;

  if (!globalWithDbPool.__appDbPool) {
    globalWithDbPool.__appDbPool = createDbPool();
  }

  return globalWithDbPool.__appDbPool;
}

function resetDbForTest(): void {
  const globalWithDbPool = globalThis as GlobalWithDbPool;
  delete globalWithDbPool.__appDbPool;
}

export {
  createDbPool,
  getDatabaseUrl,
  getDatabaseUnpooledUrl,
  getDb,
  normalizeDatabaseConnectionString,
  resetDbForTest,
};
