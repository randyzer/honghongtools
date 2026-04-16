'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'hh_user';
const USER_CHANGE_EVENT = 'hh_user_change';

export interface StoredUserInfo {
  id: number;
  username: string;
}

type StoredUserStorage = Pick<Storage, 'getItem' | 'removeItem'>;

export function createStoredUserSnapshotReader(storage: StoredUserStorage) {
  let cachedRawValue: string | null | undefined;
  let cachedSnapshot: StoredUserInfo | null = null;

  return function readStoredUserSnapshot(): StoredUserInfo | null {
    const stored = storage.getItem(STORAGE_KEY);

    if (stored === cachedRawValue) {
      return cachedSnapshot;
    }

    cachedRawValue = stored;

    if (!stored) {
      cachedSnapshot = null;
      return cachedSnapshot;
    }

    try {
      const parsed = JSON.parse(stored) as StoredUserInfo;

      if (typeof parsed.id === 'number' && typeof parsed.username === 'string') {
        cachedSnapshot = { id: parsed.id, username: parsed.username };
        return cachedSnapshot;
      }
    } catch {
      storage.removeItem(STORAGE_KEY);
      cachedRawValue = null;
      cachedSnapshot = null;
      return cachedSnapshot;
    }

    cachedSnapshot = null;
    return cachedSnapshot;
  };
}

let browserStoredUserReader: (() => StoredUserInfo | null) | null = null;

function readStoredUser(): StoredUserInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }

  browserStoredUserReader ??= createStoredUserSnapshotReader(window.localStorage);

  return browserStoredUserReader();
}

function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      callback();
    }
  };
  const handleUserChange = () => {
    callback();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(USER_CHANGE_EVENT, handleUserChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(USER_CHANGE_EVENT, handleUserChange);
  };
}

export function notifyStoredUserChange() {
  window.dispatchEvent(new Event(USER_CHANGE_EVENT));
}

export function useStoredUser() {
  return useSyncExternalStore(subscribe, readStoredUser, () => null);
}
