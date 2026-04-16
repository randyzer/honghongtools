import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createUserRecord,
  deleteArticleById,
  listGameRecordsByUserId,
  listLeaderboard,
  serializeDateFields,
} from './app-queries';

type QueryCall = {
  text: string;
  params?: unknown[];
};

function createFakeDb(rows: Array<Record<string, unknown>> = []) {
  const calls: QueryCall[] = [];

  return {
    calls,
    db: {
      async query(text: string, params?: unknown[]) {
        calls.push({ text, params });
        return {
          rows,
          rowCount: rows.length,
        };
      },
    },
  };
}

test('createUserRecord inserts username and password and returns the created user', async () => {
  const fake = createFakeDb([{ id: 1, username: 'alice' }]);

  const actual = await createUserRecord(fake.db, {
    username: 'alice',
    password: 'hashed-password',
  });

  assert.deepEqual(actual, { id: 1, username: 'alice' });
  assert.match(fake.calls[0]?.text ?? '', /insert into users/i);
  assert.deepEqual(fake.calls[0]?.params, ['alice', 'hashed-password']);
});

test('deleteArticleById deletes by id', async () => {
  const fake = createFakeDb();

  await deleteArticleById(fake.db, 9);

  assert.match(fake.calls[0]?.text ?? '', /delete from blog_post where id = \$1/i);
  assert.deepEqual(fake.calls[0]?.params, [9]);
});

test('listGameRecordsByUserId limits to 50 and orders newest first', async () => {
  const fake = createFakeDb([{ id: 1, user_id: 7, played_at: new Date('2026-04-14T00:00:00Z') }]);

  const actual = await listGameRecordsByUserId(fake.db, 7);

  assert.equal(actual.length, 1);
  assert.match(fake.calls[0]?.text ?? '', /order by played_at desc/i);
  assert.match(fake.calls[0]?.text ?? '', /limit 50/i);
  assert.deepEqual(fake.calls[0]?.params, [7]);
});

test('listLeaderboard uses ranking SQL and returns rows unchanged apart from date serialization', async () => {
  const fake = createFakeDb([
    {
      user_id: 1,
      username: 'alice',
      best_score: 98,
      achieved_at: new Date('2026-04-14T01:02:03Z'),
    },
  ]);

  const actual = await listLeaderboard(fake.db);

  assert.equal(actual[0]?.user_id, 1);
  assert.equal(typeof actual[0]?.achieved_at, 'string');
  assert.match(fake.calls[0]?.text ?? '', /row_number\(\) over/i);
  assert.match(fake.calls[0]?.text ?? '', /where gr\.result = 'success'/i);
});

test('serializeDateFields converts Date instances to ISO strings', () => {
  const actual = serializeDateFields(
    {
      created_at: new Date('2026-04-14T01:02:03Z'),
      title: 'demo',
    },
    ['created_at'],
  );

  assert.deepEqual(actual, {
    created_at: '2026-04-14T01:02:03.000Z',
    title: 'demo',
  });
});
