import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';

import {
  buildInsertStatement,
  buildResetSequenceStatement,
  getMigrationConfig,
  getMigrationEnv,
  getSchemaResetStatements,
} from '@/storage/database/migration-utils';

loadDotenv({ path: '.env.local', quiet: true });

type CountRow = {
  table_name: string;
  row_count: number;
};

async function queryTableColumns(client: Client, tableName: string): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [tableName],
  );

  return result.rows.map((row) => row.column_name);
}

async function ensureTargetSchema(client: Client) {
  for (const statement of getSchemaResetStatements()) {
    await client.query(statement);
  }
}

async function validateColumns(client: Client, tableName: string, expectedColumns: string[]) {
  const actualColumns = await queryTableColumns(client, tableName);

  if (actualColumns.length === 0) {
    throw new Error(`Target table "${tableName}" does not exist after schema setup`);
  }

  if (actualColumns.join(',') !== expectedColumns.join(',')) {
    throw new Error(
      `Target table "${tableName}" columns do not match expected shape. actual=${actualColumns.join(
        ',',
      )} expected=${expectedColumns.join(',')}`,
    );
  }
}

async function fetchSourceRows(client: Client, tableName: string, columns: string[]) {
  const result = await client.query<Record<string, unknown>>(
    `select ${columns.join(', ')} from ${tableName} order by id asc`,
  );

  return result.rows;
}

async function fetchCounts(client: Client): Promise<CountRow[]> {
  const result = await client.query<CountRow>(
    `select 'users' as table_name, count(*)::int as row_count from users
     union all
     select 'blog_post', count(*)::int from blog_post
     union all
     select 'game_records', count(*)::int from game_records`,
  );

  return result.rows;
}

async function resetSequences(client: Client) {
  for (const table of getMigrationConfig()) {
    await client.query(buildResetSequenceStatement(table.tableName, table.idColumn));
  }
}

async function main() {
  const { sourceDatabaseUrl, targetDatabaseUrl } = getMigrationEnv();
  const sourceClient = new Client({ connectionString: sourceDatabaseUrl });
  const targetClient = new Client({ connectionString: targetDatabaseUrl });

  await sourceClient.connect();
  await targetClient.connect();

  try {
    const sourceCounts = await fetchCounts(sourceClient);

    await targetClient.query('begin');

    try {
      await ensureTargetSchema(targetClient);

      for (const table of getMigrationConfig()) {
        await validateColumns(targetClient, table.tableName, table.columns);
      }

      for (const table of getMigrationConfig()) {
        const rows = await fetchSourceRows(sourceClient, table.tableName, table.columns);

        if (rows.length === 0) {
          continue;
        }

        const statement = buildInsertStatement(table.tableName, table.columns, rows);
        await targetClient.query(statement.text, statement.values);
      }

      await resetSequences(targetClient);

      const targetCounts = await fetchCounts(targetClient);

      if (JSON.stringify(sourceCounts) !== JSON.stringify(targetCounts)) {
        throw new Error(
          `Row count mismatch after migration. source=${JSON.stringify(
            sourceCounts,
          )} target=${JSON.stringify(targetCounts)}`,
        );
      }

      await targetClient.query('commit');

      console.log(
        JSON.stringify(
          {
            migratedTables: getMigrationConfig().map((table) => table.tableName),
            counts: targetCounts,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      await targetClient.query('rollback');
      throw error;
    }
  } finally {
    await Promise.allSettled([sourceClient.end(), targetClient.end()]);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Neon migration failed: ${message}`);
  process.exitCode = 1;
});
