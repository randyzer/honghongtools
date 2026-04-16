import assert from 'node:assert/strict';
import test from 'node:test';

interface FakeStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

function createFakeStorage(initialValue: string | null) {
  let value = initialValue;
  const removedKeys: string[] = [];

  const storage: FakeStorage = {
    getItem() {
      return value;
    },
    removeItem(key) {
      removedKeys.push(key);
      value = null;
    },
  };

  return {
    removedKeys,
    setValue(nextValue: string | null) {
      value = nextValue;
    },
    storage,
  };
}

test('createStoredUserSnapshotReader caches identical localStorage snapshots', async () => {
  const storedUserModule = await import('./use-stored-user');
  const createReader = (storedUserModule as Record<string, unknown>).createStoredUserSnapshotReader;

  assert.equal(typeof createReader, 'function');

  const storage = createFakeStorage(JSON.stringify({ id: 1, username: 'alice' }));
  const readSnapshot = (
    createReader as (storage: FakeStorage) => () => { id: number; username: string } | null
  )(storage.storage);

  const firstSnapshot = readSnapshot();
  const secondSnapshot = readSnapshot();

  assert.deepEqual(firstSnapshot, { id: 1, username: 'alice' });
  assert.strictEqual(firstSnapshot, secondSnapshot);

  storage.setValue(JSON.stringify({ id: 2, username: 'bob' }));

  const updatedSnapshot = readSnapshot();

  assert.deepEqual(updatedSnapshot, { id: 2, username: 'bob' });
  assert.notStrictEqual(updatedSnapshot, firstSnapshot);
});

test('createStoredUserSnapshotReader clears malformed localStorage data', async () => {
  const storedUserModule = await import('./use-stored-user');
  const createReader = (storedUserModule as Record<string, unknown>).createStoredUserSnapshotReader;

  assert.equal(typeof createReader, 'function');

  const storage = createFakeStorage('{bad json');
  const readSnapshot = (createReader as (storage: FakeStorage) => () => unknown)(storage.storage);

  assert.equal(readSnapshot(), null);
  assert.deepEqual(storage.removedKeys, ['hh_user']);
});
