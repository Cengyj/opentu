import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readSWClientReleaseOwnership,
  reconcileSWClientReleaseOwnership,
  resolveOrEstablishSWClientReleaseOwnership,
  type SWClientReleaseOwnershipStorageOptions,
} from './client-release-ownership-storage';

const DB_NAME = 'client-release-ownership-storage-spec';
const STORE_NAME = 'versionState';

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

const options: SWClientReleaseOwnershipStorageOptions = {
  openDatabase,
  storeName: STORE_NAME,
  now: () => 123,
};

describe('durable Service Worker client release ownership', () => {
  afterEach(deleteDatabase);

  it('restores a client release after the worker in-memory map is lost', async () => {
    await resolveOrEstablishSWClientReleaseOwnership(
      options,
      'client-a',
      'release-old'
    );

    await expect(
      readSWClientReleaseOwnership(options, 'client-a')
    ).resolves.toBe('release-old');
  });

  it('returns no ownership for an unknown client', async () => {
    await expect(
      readSWClientReleaseOwnership(options, 'missing-client')
    ).resolves.toBeNull();
  });

  it('keeps live ownership and prunes records for clients that no longer exist', async () => {
    await resolveOrEstablishSWClientReleaseOwnership(
      options,
      'client-live',
      'release-a'
    );
    await resolveOrEstablishSWClientReleaseOwnership(
      options,
      'client-dead',
      'release-b'
    );

    await expect(
      reconcileSWClientReleaseOwnership(options, ['client-live'])
    ).resolves.toEqual(new Map([['client-live', 'release-a']]));
    await expect(
      readSWClientReleaseOwnership(options, 'client-dead')
    ).resolves.toBeNull();
  });

  it('resolves only after the ownership transaction has committed', async () => {
    let transactionCompleted = false;
    const observingOptions: SWClientReleaseOwnershipStorageOptions = {
      ...options,
      openDatabase: async () => {
        const db = await openDatabase();
        return new Proxy(db, {
          get(target, property) {
            if (property === 'transaction') {
              return (...args: Parameters<IDBDatabase['transaction']>) => {
                const transaction = target.transaction(...args);
                transaction.addEventListener('complete', () => {
                  transactionCompleted = true;
                });
                return transaction;
              };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    };

    await expect(
      resolveOrEstablishSWClientReleaseOwnership(
        observingOptions,
        'client-a',
        'release-a'
      )
    ).resolves.toBe('release-a');
    expect(transactionCompleted).toBe(true);
    await expect(
      readSWClientReleaseOwnership(options, 'client-a')
    ).resolves.toBe('release-a');
  });

  it('does not overwrite an existing ownership with a conflicting recovery claim', async () => {
    await resolveOrEstablishSWClientReleaseOwnership(
      options,
      'client-a',
      'release-old'
    );

    await expect(
      resolveOrEstablishSWClientReleaseOwnership(
        options,
        'client-a',
        'release-new'
      )
    ).resolves.toBe('release-old');
    await expect(
      readSWClientReleaseOwnership(options, 'client-a')
    ).resolves.toBe('release-old');
  });

  it('allows only one winner for concurrent conflicting first claims', async () => {
    const now = vi.fn(() => 123);
    const concurrentOptions = { ...options, now };

    const resolvedClaims = await Promise.all([
      resolveOrEstablishSWClientReleaseOwnership(
        concurrentOptions,
        'client-race',
        'release-a'
      ),
      resolveOrEstablishSWClientReleaseOwnership(
        concurrentOptions,
        'client-race',
        'release-b'
      ),
    ]);

    expect(new Set(resolvedClaims).size).toBe(1);
    expect(['release-a', 'release-b']).toContain(resolvedClaims[0]);
    expect(now).toHaveBeenCalledTimes(1);
    await expect(
      readSWClientReleaseOwnership(options, 'client-race')
    ).resolves.toBe(resolvedClaims[0]);
  });
});
