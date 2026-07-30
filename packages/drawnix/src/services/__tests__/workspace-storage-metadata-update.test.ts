import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board } from '../../types/workspace.types';
import { workspaceStorageService } from '../workspace-storage-service';

const localForageHarness = vi.hoisted(() => {
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const stores = new Map<string, Map<string, unknown>>();

  const getStore = (storeName: string) => {
    let store = stores.get(storeName);
    if (!store) {
      store = new Map();
      stores.set(storeName, store);
    }
    return store;
  };

  const localforage = {
    INDEXEDDB: 'INDEXEDDB',
    createInstance: vi.fn(({ storeName }: { storeName: string }) => {
      const store = getStore(storeName);
      return {
        ready: vi.fn(async () => undefined),
        setItem: vi.fn(async (key: string, value: unknown) => {
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
    }),
  };

  return {
    localforage,
    reset() {
      for (const store of stores.values()) {
        store.clear();
      }
      vi.clearAllMocks();
    },
  };
});

vi.mock('localforage', () => ({
  default: localForageHarness.localforage,
}));

const createBoard = (elementId: string): Board => ({
  id: 'board-a',
  name: 'original',
  folderId: null,
  order: 0,
  elements: [
    {
      id: elementId,
      type: 'geometry',
      points: [
        [0, 0],
        [140, 110],
      ],
    },
  ] as Board['elements'],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
});

describe('WorkspaceStorageService.updateBoardMetadata', () => {
  beforeEach(async () => {
    localForageHarness.reset();
    await workspaceStorageService.initialize();
  });

  it('patches metadata without replacing persisted elements', async () => {
    await workspaceStorageService.saveBoard(createBoard('element-a'));

    await workspaceStorageService.updateBoardMetadata('board-a', {
      name: 'renamed',
      folderId: 'folder-b',
      order: 3,
      updatedAt: 1_700_000_000_100,
    });

    const stored = await workspaceStorageService.loadBoard('board-a');
    expect(stored).toEqual(
      expect.objectContaining({
        name: 'renamed',
        folderId: 'folder-b',
        order: 3,
        updatedAt: 1_700_000_000_100,
      })
    );
    expect(stored?.elements).toEqual([
      expect.objectContaining({ id: 'element-a' }),
    ]);
  });

  it('serializes a canvas save that starts before a metadata patch', async () => {
    await workspaceStorageService.saveBoard(createBoard('element-old'));

    const canvasSave = workspaceStorageService.saveBoard({
      ...createBoard('element-new'),
      updatedAt: 1_700_000_000_050,
    });
    const metadataPatch = workspaceStorageService.updateBoardMetadata('board-a', {
      name: 'renamed',
      updatedAt: 1_700_000_000_100,
    });
    await Promise.all([canvasSave, metadataPatch]);

    const stored = await workspaceStorageService.loadBoard('board-a');
    expect(stored?.name).toBe('renamed');
    expect(stored?.elements).toEqual([
      expect.objectContaining({ id: 'element-new' }),
    ]);
  });
});
