import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  readSWReleaseState,
  updateSWReleaseState,
  type SWReleaseStateStorageOptions,
} from './release-state-storage';

const DB_NAME = 'release-state-storage-spec';
const STORE_NAME = 'versionState';
const STATE_KEY = 'app-release-state-v2';
const LEGACY_STATE_KEY = 'app-version-state';

const deleteDatabase = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('database deletion blocked'));
  });

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const options = (now: () => number): SWReleaseStateStorageOptions => ({
  openDatabase,
  storeName: STORE_NAME,
  stateKey: STATE_KEY,
  legacyStateKey: LEGACY_STATE_KEY,
  currentReleaseId: 'release-current',
  now,
});

const putRecord = async (key: string, state: unknown): Promise<void> => {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ key, state });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};

describe('revisioned Service Worker release-state storage', () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it('serializes concurrent state mutations and increments revision in the transaction', async () => {
    const fixedNow = () => 100;

    const results = await Promise.all([
      updateSWReleaseState(options(fixedNow), {
        pendingReleaseId: 'release-next',
      }),
      updateSWReleaseState(options(fixedNow), {
        pendingReadyAt: 100,
      }),
    ]);
    const state = await readSWReleaseState(options(fixedNow));

    expect(results.map((entry) => entry.revision).sort()).toEqual([1, 2]);
    expect(state).toMatchObject({
      schemaVersion: 2,
      revision: 2,
      pendingReleaseId: 'release-next',
      pendingReadyAt: 100,
      updatedAt: 100,
    });
  });

  it('migrates from the legacy key once and ignores later legacy-worker writes', async () => {
    await putRecord(LEGACY_STATE_KEY, {
      committedVersion: 'release-old',
      pendingVersion: 'release-next',
      pendingReadyAt: 90,
      upgradeState: 'ready',
      updatedAt: 90,
    });

    const migrated = await updateSWReleaseState(
      options(() => 100),
      {
        upgradeState: 'committing',
      }
    );
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      revision: 1,
      committedReleaseId: 'release-old',
      pendingReleaseId: 'release-next',
      upgradeState: 'committing',
    });

    await putRecord(LEGACY_STATE_KEY, {
      committedVersion: 'release-old',
      pendingVersion: null,
      upgradeState: 'idle',
      updatedAt: 110,
    });

    await expect(readSWReleaseState(options(() => 110))).resolves.toMatchObject(
      {
        revision: 1,
        pendingReleaseId: 'release-next',
        upgradeState: 'committing',
        updatedAt: 100,
      }
    );
  });
});
