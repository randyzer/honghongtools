import { Client } from 'pg';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local' });

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is not set');
  }

  const client = new Client({ connectionString });

  await client.connect();

  try {
    const result = await client.query<{
      now: string;
      current_database: string;
      current_schema: string;
    }>('select now() as now, current_database(), current_schema()');

    console.log(JSON.stringify(result.rows[0], null, 2));
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Neon connection check failed: ${message}`);
  process.exitCode = 1;
});
