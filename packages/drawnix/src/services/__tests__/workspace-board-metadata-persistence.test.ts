import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Board,
  Folder,
  WorkspaceState,
} from '../../types/workspace.types';
import { workspaceService } from '../workspace-service';

const storageHarness = vi.hoisted(() => {
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  let boards = new Map<string, Board>();
  let folders = new Map<string, Folder>();
  let state: WorkspaceState = {
    currentBoardId: null,
    expandedFolderIds: [],
    sidebarWidth: 280,
    sidebarCollapsed: false,
  };

  const workspaceStorageService = {
    initialize: vi.fn(async () => undefined),
    loadAllFolders: vi.fn(async () =>
      Array.from(folders.values(), (folder) => clone(folder))
    ),
    loadAllBoardMetadata: vi.fn(async () =>
      Array.from(boards.values(), (board) => {
        const { elements: _elements, ...metadata } = clone(board);
        return metadata;
      })
    ),
    loadState: vi.fn(async () => clone(state)),
    saveState: vi.fn(async (nextState: WorkspaceState) => {
      state = clone(nextState);
    }),
    saveFolder: vi.fn(async (folder: Folder) => {
      folders.set(folder.id, clone(folder));
    }),
    deleteFolder: vi.fn(async (id: string) => {
      folders.delete(id);
    }),
    loadBoard: vi.fn(async (id: string) => {
      const board = boards.get(id);
      return board ? clone(board) : null;
    }),
    saveBoard: vi.fn(async (board: Board) => {
      boards.set(board.id, clone(board));
    }),
    updateBoardMetadata: vi.fn(
      async (
        id: string,
        updates: Partial<
          Pick<Board, 'name' | 'folderId' | 'order' | 'updatedAt'>
        >
      ) => {
        const current = boards.get(id);
        if (!current) {
          throw new Error(`Board ${id} not found in storage`);
        }
        const updated = { ...current, ...clone(updates) };
        boards.set(id, clone(updated));
        return clone(updated);
      }
    ),
    deleteBoard: vi.fn(async (id: string) => {
      boards.delete(id);
    }),
  };

  return {
    workspaceStorageService,
    seed(nextBoards: Board[], nextFolders: Folder[] = []) {
      boards = new Map(nextBoards.map((board) => [board.id, clone(board)]));
      folders = new Map(
        nextFolders.map((folder) => [folder.id, clone(folder)])
      );
      state = {
        currentBoardId: null,
        expandedFolderIds: [],
        sidebarWidth: 280,
        sidebarCollapsed: false,
      };
      vi.clearAllMocks();
    },
    readBoard(id: string): Board | undefined {
      const board = boards.get(id);
      return board ? clone(board) : undefined;
    },
    readBoards(): Board[] {
      return Array.from(boards.values(), (board) => clone(board));
    },
  };
});

vi.mock('../workspace-storage-service', () => ({
  workspaceStorageService: storageHarness.workspaceStorageService,
}));

vi.mock('../github-sync/sync-engine', () => ({
  syncEngine: {
    markDirty: vi.fn(),
    recordLocalDeletion: vi.fn(async () => undefined),
    syncBoardDeletion: vi.fn(async () => ({ success: true })),
  },
}));

vi.mock('../github-sync/token-service', () => ({
  tokenService: {
    hasToken: vi.fn(() => false),
  },
}));

const now = 1_700_000_000_000;

const folder = (id: string, parentId: string | null, order: number): Folder => ({
  id,
  name: id,
  parentId,
  order,
  isExpanded: true,
  createdAt: now,
  updatedAt: now,
});

const board = (
  id: string,
  folderId: string | null,
  order: number,
  elementId: string
): Board => ({
  id,
  name: id,
  folderId,
  order,
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
  createdAt: now,
  updatedAt: now,
});

const expectElementPreserved = (boardId: string, elementId: string) => {
  expect(storageHarness.readBoard(boardId)?.elements).toEqual([
    expect.objectContaining({ id: elementId }),
  ]);
};

describe('Workspace board metadata persistence after metadata-only reload', () => {
  beforeAll(async () => {
    storageHarness.seed([]);
    await workspaceService.initialize();
  });

  beforeEach(async () => {
    sessionStorage.clear();
    storageHarness.seed(
      [
        board('board-a', 'source-folder', 0, 'element-a'),
        board('board-b', 'target-folder', 0, 'element-b'),
      ],
      [
        folder('source-folder', null, 0),
        folder('target-folder', null, 1),
      ]
    );
    await workspaceService.reload();
  });

  it('preserves elements when renaming a board that has not been loaded', async () => {
    await workspaceService.renameBoard('board-a', 'renamed-board');

    expect(storageHarness.readBoard('board-a')?.name).toBe('renamed-board');
    expectElementPreserved('board-a', 'element-a');
  });

  it('preserves moved and sibling board elements when moving a board', async () => {
    await workspaceService.moveBoard('board-a', 'target-folder');

    expect(storageHarness.readBoard('board-a')?.folderId).toBe('target-folder');
    expectElementPreserved('board-a', 'element-a');
    expectElementPreserved('board-b', 'element-b');
  });

  it('preserves elements when reordering metadata-only boards', async () => {
    await workspaceService.reorderItems([
      { id: 'board-a', type: 'board', order: 1 },
      { id: 'board-b', type: 'board', order: 0 },
    ]);

    expectElementPreserved('board-a', 'element-a');
    expectElementPreserved('board-b', 'element-b');
  });

  it('copies the complete source board after a metadata-only reload', async () => {
    const copied = await workspaceService.copyBoard('board-a');

    expect(copied.elements).toEqual([
      expect.objectContaining({ id: 'element-a' }),
    ]);
    expectElementPreserved(copied.id, 'element-a');
  });

  it('preserves board elements when deleting only its containing folder', async () => {
    await workspaceService.deleteFolder('source-folder');

    expect(storageHarness.readBoard('board-a')?.folderId).toBeNull();
    expectElementPreserved('board-a', 'element-a');
  });

  it('preserves target sibling elements when moving a folder', async () => {
    await workspaceService.moveFolder('source-folder', 'target-folder');

    expect(storageHarness.readBoards()).toHaveLength(2);
    expectElementPreserved('board-b', 'element-b');
  });
});
