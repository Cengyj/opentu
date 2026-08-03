// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceEvent } from '../../types/workspace.types';
import { GITHUB_SYNC_TOKEN_STORAGE_KEY } from '../github-sync/token-storage';
import { workspaceService } from '../workspace-service';

const syncRuntime = vi.hoisted(() => ({
  loaded: vi.fn(),
  markDirty: vi.fn(),
  recordLocalDeletion: vi.fn(async () => undefined),
  syncBoardDeletion: vi.fn(async () => ({ success: true })),
}));

vi.mock('../github-sync/sync-engine', () => {
  syncRuntime.loaded();
  return {
    syncEngine: {
      markDirty: syncRuntime.markDirty,
      recordLocalDeletion: syncRuntime.recordLocalDeletion,
      syncBoardDeletion: syncRuntime.syncBoardDeletion,
    },
  };
});

type WorkspaceSyncTrigger = {
  triggerSyncMarkDirty: (
    eventType: WorkspaceEvent['type'],
    payload?: unknown
  ) => void;
};

const triggerSyncMarkDirty = (
  eventType: WorkspaceEvent['type'],
  payload?: unknown
) => {
  (workspaceService as unknown as WorkspaceSyncTrigger).triggerSyncMarkDirty(
    eventType,
    payload
  );
};

describe('workspace sync startup boundary', () => {
  beforeEach(() => {
    localStorage.removeItem(GITHUB_SYNC_TOKEN_STORAGE_KEY);
    vi.clearAllMocks();
  });

  it('does not load the sync engine when GitHub sync is not configured', async () => {
    triggerSyncMarkDirty('boardCreated');
    await Promise.resolve();

    expect(syncRuntime.loaded).not.toHaveBeenCalled();
    expect(syncRuntime.markDirty).not.toHaveBeenCalled();
  });

  it('loads the sync engine and preserves dirty/deletion behavior when configured', async () => {
    localStorage.setItem(GITHUB_SYNC_TOKEN_STORAGE_KEY, 'encrypted-token');

    triggerSyncMarkDirty('boardDeleted', { id: 'board-1' });
    await vi.waitFor(() => {
      expect(syncRuntime.markDirty).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(syncRuntime.syncBoardDeletion).toHaveBeenCalledWith('board-1');
    });

    expect(syncRuntime.loaded).toHaveBeenCalledTimes(1);
    expect(syncRuntime.recordLocalDeletion).toHaveBeenCalledWith('board-1');
  });
});
