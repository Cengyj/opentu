import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board } from '../../types/workspace.types';
import {
  WorkspaceStorageService,
  workspaceStorageService,
} from '../workspace-storage-service';

const BOARDS_STORE = 'aitu-workspace/boards';
const METADATA_STORE = 'aitu-workspace-index/board_metadata';
const MANIFEST_KEY = '__board_metadata_manifest__';
const PENDING_KEY = '__board_metadata_pending__';

const localForageHarness = vi.hoisted(() => {
  type FailurePredicate = (
    storeId: string,
    key: string,
    value: unknown
  ) => boolean;

  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const stores = new Map<string, Map<string, unknown>>();
  const instances = new Map<
    string,
    {
      iterate: ReturnType<typeof vi.fn>;
      setItem: ReturnType<typeof vi.fn>;
    }
  >();
  const createdInstances: Array<{
    name: string;
    storeName: string;
    version?: number;
  }> = [];
  let failNextSet: FailurePredicate | null = null;
  let failNextReadyStore: string | null = null;

  const storeId = (name: string, storeName: string) => `${name}/${storeName}`;
  const getStore = (id: string) => {
    let store = stores.get(id);
    if (!store) {
      store = new Map();
      stores.set(id, store);
    }
    return store;
  };

  const localforage = {
    INDEXEDDB: 'INDEXEDDB',
    createInstance: vi.fn(
      ({
        name,
        storeName,
        version,
      }: {
        name: string;
        storeName: string;
        version?: number;
      }) => {
        createdInstances.push({ name, storeName, version });
        const id = storeId(name, storeName);
        const store = getStore(id);
        const api = {
          ready: vi.fn(async () => {
            if (failNextReadyStore === id) {
              failNextReadyStore = null;
              throw new Error('injected metadata ready failure');
            }
          }),
          setItem: vi.fn(async (key: string, value: unknown) => {
            if (failNextSet?.(id, key, value)) {
              failNextSet = null;
              throw new Error('injected metadata write failure');
            }
            store.set(key, clone(value));
            return clone(value);
          }),
          getItem: vi.fn(async <T>(key: string): Promise<T | null> => {
            const value = store.get(key);
            return value === undefined ? null : clone(value as T);
          }),
          removeItem: vi.fn(async (key: string) => {
            store.delete(key);
          }),
          iterate: vi.fn(
            async <T, U>(callback: (value: T, key: string) => U) => {
              for (const [key, value] of store) {
                callback(clone(value as T), key);
              }
            }
          ),
          clear: vi.fn(async () => {
            store.clear();
          }),
          length: vi.fn(async () => store.size),
        };
        instances.set(id, api);
        return api;
      }
    ),
  };

  return {
    localforage,
    clearData() {
      for (const store of stores.values()) store.clear();
      failNextSet = null;
      failNextReadyStore = null;
    },
    clearCalls() {
      vi.clearAllMocks();
    },
    rawSet(id: string, key: string, value: unknown) {
      getStore(id).set(key, clone(value));
    },
    rawGet<T>(id: string, key: string): T | undefined {
      const value = getStore(id).get(key);
      return value === undefined ? undefined : clone(value as T);
    },
    instance(id: string) {
      const instance = instances.get(id);
      if (!instance) throw new Error(`Missing LocalForage instance ${id}`);
      return instance;
    },
    createdInstances,
    failOneSet(predicate: FailurePredicate) {
      failNextSet = predicate;
    },
    failOneReady(id: string) {
      failNextReadyStore = id;
    },
  };
});

vi.mock('localforage', () => ({
  default: localForageHarness.localforage,
}));

function createBoard(
  id: string,
  options: { name?: string; elementPayload?: string; updatedAt?: number } = {}
): Board {
  return {
    id,
    name: options.name ?? id,
    folderId: null,
    order: 0,
    elements: [
      {
        id: `element-${id}`,
        type: 'geometry',
        payload: options.elementPayload,
      },
    ] as unknown as Board['elements'],
    createdAt: 1_700_000_000_000,
    updatedAt: options.updatedAt ?? 1_700_000_000_000,
  };
}

describe('WorkspaceStorageService board metadata index', () => {
  beforeAll(async () => {
    await workspaceStorageService.initialize();
  });

  beforeEach(async () => {
    localForageHarness.clearData();
    await workspaceStorageService.clearAll();
    localForageHarness.clearCalls();
  });

  it('uses a separate disposable database instead of upgrading the workspace database', () => {
    expect(localForageHarness.createdInstances).toContainEqual(
      expect.objectContaining({
        name: 'aitu-workspace-index',
        version: 1,
        storeName: 'board_metadata',
      })
    );
  });

  it('scans legacy Boards once, then reads metadata without cloning large elements', async () => {
    const largePayload = 'x'.repeat(2 * 1024 * 1024);
    localForageHarness.rawSet(
      BOARDS_STORE,
      'legacy-board',
      createBoard('legacy-board', { elementPayload: largePayload })
    );

    const boardsStore = localForageHarness.instance(BOARDS_STORE);
    const first = await workspaceStorageService.loadAllBoardMetadata();

    expect(first).toEqual([
      expect.objectContaining({ id: 'legacy-board', name: 'legacy-board' }),
    ]);
    expect(first[0]).not.toHaveProperty('elements');
    expect(boardsStore.iterate).toHaveBeenCalledTimes(1);

    const indexed = localForageHarness.rawGet<{
      kind: string;
      metadata: Record<string, unknown>;
    }>(METADATA_STORE, 'board:legacy-board');
    expect(indexed?.kind).toBe('board');
    expect(indexed?.metadata).not.toHaveProperty('elements');
    expect(JSON.stringify(indexed).length).toBeLessThan(2_000);

    const second = await workspaceStorageService.loadAllBoardMetadata();
    expect(second).toEqual(first);
    expect(boardsStore.iterate).toHaveBeenCalledTimes(1);
  });

  it('keeps save, metadata patch, and delete synchronized without replacing elements', async () => {
    await workspaceStorageService.saveBoard(createBoard('board-a'));
    await workspaceStorageService.updateBoardMetadata('board-a', {
      name: 'renamed',
      folderId: 'folder-b',
      order: 4,
      updatedAt: 1_700_000_000_100,
    });

    const stored = await workspaceStorageService.loadBoard('board-a');
    expect(stored?.name).toBe('renamed');
    expect(stored?.elements).toEqual([
      expect.objectContaining({ id: 'element-board-a' }),
    ]);
    await expect(
      workspaceStorageService.loadAllBoardMetadata()
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'board-a',
        name: 'renamed',
        folderId: 'folder-b',
        order: 4,
      }),
    ]);

    await workspaceStorageService.deleteBoard('board-a');
    expect(
      localForageHarness.rawGet(METADATA_STORE, 'board:board-a')
    ).toBeUndefined();
    await expect(
      workspaceStorageService.loadAllBoardMetadata()
    ).resolves.toEqual([]);
  });

  it('leaves a durable journal and rebuilds from Boards after an interrupted index write', async () => {
    await workspaceStorageService.saveBoard(createBoard('board-a'));
    localForageHarness.failOneSet(
      (store, key, value) =>
        store === METADATA_STORE &&
        key === 'board:board-a' &&
        (value as { metadata?: { name?: string } }).metadata?.name ===
          'saved-before-crash'
    );

    await expect(
      workspaceStorageService.saveBoard(
        createBoard('board-a', {
          name: 'saved-before-crash',
          updatedAt: 1_700_000_000_200,
        })
      )
    ).rejects.toThrow('injected metadata write failure');

    expect(
      localForageHarness.rawGet<{ operationId: string; operation: string }>(
        METADATA_STORE,
        PENDING_KEY
      )
    ).toEqual(
      expect.objectContaining({
        operationId: expect.any(String),
        operation: 'save',
      })
    );

    const boardsStore = localForageHarness.instance(BOARDS_STORE);
    const iterateCallsBeforeRecovery = boardsStore.iterate.mock.calls.length;
    await expect(
      workspaceStorageService.loadAllBoardMetadata()
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'board-a',
        name: 'saved-before-crash',
      }),
    ]);
    expect(boardsStore.iterate).toHaveBeenCalledTimes(
      iterateCallsBeforeRecovery + 1
    );
    expect(
      localForageHarness.rawGet(METADATA_STORE, PENDING_KEY)
    ).toBeUndefined();
  });

  it('rejects a corrupt projection and repairs it idempotently from Boards', async () => {
    await workspaceStorageService.saveBoard(createBoard('board-a'));
    localForageHarness.rawSet(METADATA_STORE, 'board:board-a', {
      kind: 'board',
      schemaVersion: 1,
      metadata: { id: 'board-a', name: 42 },
    });

    const boardsStore = localForageHarness.instance(BOARDS_STORE);
    const before = boardsStore.iterate.mock.calls.length;
    const repaired = await workspaceStorageService.loadAllBoardMetadata();
    expect(repaired).toEqual([
      expect.objectContaining({ id: 'board-a', name: 'board-a' }),
    ]);
    expect(boardsStore.iterate).toHaveBeenCalledTimes(before + 1);

    await workspaceStorageService.loadAllBoardMetadata();
    expect(boardsStore.iterate).toHaveBeenCalledTimes(before + 1);
  });

  it('uses one named exclusive Web Lock for cross-tab mutations and rebuilds', async () => {
    const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
    let active = 0;
    let maxActive = 0;
    let tail: Promise<unknown> = Promise.resolve();
    const request = vi.fn(
      <T>(
        _name: string,
        _options: LockOptions,
        callback: () => Promise<T>
      ): Promise<T> => {
        const run = tail.then(async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          try {
            return await callback();
          } finally {
            active -= 1;
          }
        });
        tail = run.catch(() => undefined);
        return run;
      }
    );
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    });

    try {
      await Promise.all([
        workspaceStorageService.saveBoard(createBoard('board-a')),
        workspaceStorageService.saveBoard(createBoard('board-b')),
      ]);
    } finally {
      if (originalLocks) {
        Object.defineProperty(navigator, 'locks', originalLocks);
      } else {
        Reflect.deleteProperty(navigator, 'locks');
      }
    }

    expect(maxActive).toBe(1);
    expect(request).toHaveBeenCalledTimes(2);
    for (const [name, options] of request.mock.calls) {
      expect(name).toBe('aitu-workspace:board-metadata-index');
      expect(options).toEqual({ mode: 'exclusive' });
    }
    expect(
      localForageHarness.rawGet(METADATA_STORE, MANIFEST_KEY)
    ).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        sourceRecordCount: 2,
        indexedBoardCount: 2,
      })
    );
  });

  it('isolates a disposable index startup failure from the authoritative database', async () => {
    localForageHarness.rawSet(
      BOARDS_STORE,
      'preserved-board',
      createBoard('preserved-board')
    );
    const createdBefore = localForageHarness.createdInstances.length;
    localForageHarness.failOneReady(METADATA_STORE);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const isolatedService = new WorkspaceStorageService();

    try {
      await expect(isolatedService.initialize()).resolves.toBeUndefined();
      await expect(isolatedService.loadAllBoardMetadata()).resolves.toEqual([
        expect.objectContaining({ id: 'preserved-board' }),
      ]);
    } finally {
      warning.mockRestore();
    }

    expect(localForageHarness.createdInstances).toHaveLength(createdBefore + 4);
    expect(localForageHarness.rawGet(BOARDS_STORE, 'preserved-board')).toEqual(
      expect.objectContaining({ id: 'preserved-board' })
    );
  });
});
