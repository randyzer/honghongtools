import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMigrationConfig,
  getMigrationEnv,
  buildInsertStatement,
  buildResetSequenceStatement,
  getSchemaResetStatements,
} from './migration-utils';

test('getMigrationConfig orders users before dependent game_records', () => {
  const actual = getMigrationConfig().map((table) => table.tableName);

  assert.deepEqual(actual, ['users', 'blog_post', 'game_records']);
});

test('getMigrationEnv prefers DATABASE_URL_UNPOOLED for target migrations', () => {
  const originalSource = process.env.SOURCE_DATABASE_URL;
  const originalDatabase = process.env.DATABASE_URL;
  const originalDatabaseUnpooled = process.env.DATABASE_URL_UNPOOLED;

  process.env.SOURCE_DATABASE_URL = 'postgresql://source';
  process.env.DATABASE_URL = 'postgresql://runtime';
  process.env.DATABASE_URL_UNPOOLED = 'postgresql://direct';

  try {
    assert.deepEqual(getMigrationEnv(), {
      sourceDatabaseUrl: 'postgresql://source',
      targetDatabaseUrl: 'postgresql://direct',
    });
  } finally {
    if (originalSource === undefined) {
      delete process.env.SOURCE_DATABASE_URL;
    } else {
      process.env.SOURCE_DATABASE_URL = originalSource;
    }

    if (originalDatabase === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabase;
    }

    if (originalDatabaseUnpooled === undefined) {
      delete process.env.DATABASE_URL_UNPOOLED;
    } else {
      process.env.DATABASE_URL_UNPOOLED = originalDatabaseUnpooled;
    }
  }
});

test('buildInsertStatement creates positional placeholders for multiple rows', () => {
  const actual = buildInsertStatement(
    'users',
    ['id', 'username', 'password'],
    [
      { id: 1, username: 'alice', password: 'secret-1' },
      { id: 2, username: 'bob', password: 'secret-2' },
    ],
  );

  assert.deepEqual(actual, {
    text: 'insert into users (id, username, password) values ($1, $2, $3), ($4, $5, $6)',
    values: [1, 'alice', 'secret-1', 2, 'bob', 'secret-2'],
  });
});

test('buildResetSequenceStatement resets serial sequence to the next available id', () => {
  const actual = buildResetSequenceStatement('users', 'id');

  assert.equal(
    actual,
    "select setval(pg_get_serial_sequence('public.users', 'id'), coalesce((select max(id) from users), 0) + 1, false);",
  );
});

test('getSchemaResetStatements drops app tables before recreating them from the expected schema', () => {
  const actual = getSchemaResetStatements();

  assert.deepEqual(actual.slice(0, 3), [
    'drop table if exists game_records cascade',
    'drop table if exists blog_post cascade',
    'drop table if exists users cascade',
  ]);

  assert.match(actual[3], /create table if not exists users/i);
  assert.match(actual.join('\n'), /create table if not exists blog_post/i);
  assert.match(actual.join('\n'), /create table if not exists game_records/i);
});
