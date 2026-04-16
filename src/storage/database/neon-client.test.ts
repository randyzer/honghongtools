import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDatabaseConnectionString,
  getDatabaseUrl,
  getDatabaseUnpooledUrl,
  getDb,
  resetDbForTest,
} from './neon-client';

function withDatabaseEnv(
  values: Partial<Record<'DATABASE_URL' | 'DATABASE_URL_UNPOOLED', string | undefined>>,
  fn: () => void,
) {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalDatabaseUnpooledUrl = process.env.DATABASE_URL_UNPOOLED;

  if (values.DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = values.DATABASE_URL;
  }

  if (values.DATABASE_URL_UNPOOLED === undefined) {
    delete process.env.DATABASE_URL_UNPOOLED;
  } else {
    process.env.DATABASE_URL_UNPOOLED = values.DATABASE_URL_UNPOOLED;
  }

  try {
    resetDbForTest();
    fn();
  } finally {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalDatabaseUnpooledUrl === undefined) {
      delete process.env.DATABASE_URL_UNPOOLED;
    } else {
      process.env.DATABASE_URL_UNPOOLED = originalDatabaseUnpooledUrl;
    }

    resetDbForTest();
  }
}

test('getDatabaseUrl throws when DATABASE_URL is missing', () => {
  withDatabaseEnv({}, () => {
    assert.throws(() => getDatabaseUrl(), /DATABASE_URL is not set/);
  });
});

test('getDatabaseUnpooledUrl falls back to DATABASE_URL', () => {
  withDatabaseEnv(
    {
      DATABASE_URL: 'postgresql://runtime.example/db',
      DATABASE_URL_UNPOOLED: undefined,
    },
    () => {
      assert.equal(getDatabaseUnpooledUrl(), 'postgresql://runtime.example/db');
    },
  );
});

test('getDatabaseUnpooledUrl prefers DATABASE_URL_UNPOOLED when present', () => {
  withDatabaseEnv(
    {
      DATABASE_URL: 'postgresql://runtime.example/db',
      DATABASE_URL_UNPOOLED: 'postgresql://direct.example/db',
    },
    () => {
      assert.equal(getDatabaseUnpooledUrl(), 'postgresql://direct.example/db');
    },
  );
});

test('getDatabaseUrl avoids reusing SOURCE_DATABASE_URL when a Neon target URL is available', () => {
  const originalSource = process.env.SOURCE_DATABASE_URL;

  process.env.SOURCE_DATABASE_URL = 'postgresql://source.example/db';

  try {
    withDatabaseEnv(
      {
        DATABASE_URL: 'postgresql://source.example/db',
        DATABASE_URL_UNPOOLED: 'postgresql://target.example/db',
      },
      () => {
        assert.equal(getDatabaseUrl(), 'postgresql://target.example/db');
      },
    );
  } finally {
    if (originalSource === undefined) {
      delete process.env.SOURCE_DATABASE_URL;
    } else {
      process.env.SOURCE_DATABASE_URL = originalSource;
    }
  }
});

test('getDb reuses the same Pool instance across calls', () => {
  withDatabaseEnv(
    {
      DATABASE_URL: 'postgresql://runtime.example/db',
    },
    () => {
      const first = getDb();
      const second = getDb();

      assert.equal(first, second);
    },
  );
});

test('normalizeDatabaseConnectionString upgrades sslmode=require to verify-full', () => {
  const actual = normalizeDatabaseConnectionString(
    'postgresql://runtime.example/db?sslmode=require&channel_binding=require',
  );

  assert.equal(
    actual,
    'postgresql://runtime.example/db?sslmode=verify-full&channel_binding=require',
  );
});
