// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type DrawnixProps = {
  onChange: (data: {
    children: Array<{ id: string; type: string }>;
    viewport?: { zoom: number };
  }) => void;
};

const harness = vi.hoisted(() => {
  const board = {
    id: 'board-a',
    name: 'Board A',
    folderId: null,
    order: 0,
    elements: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };

  return {
    board,
    latestDrawnixProps: null as DrawnixProps | null,
    saveCurrentBoard: vi.fn(),
    persistCurrentBoardId: vi.fn(),
  };
});

vi.mock('@drawnix/drawnix/runtime', () => {
  const workspaceService = {
    initialize: vi.fn(async () => undefined),
    waitForInitialization: vi.fn(async () => undefined),
    getState: vi.fn(() => ({
      currentBoardId: harness.board.id,
      expandedFolderIds: [],
      sidebarWidth: 280,
      sidebarCollapsed: false,
    })),
    getBoardMetadata: vi.fn(() => harness.board),
    switchBoard: vi.fn(async () => harness.board),
    hasBoards: vi.fn(() => true),
    getTree: vi.fn(() => [{ type: 'board', data: harness.board }]),
    getCurrentBoard: vi.fn(() => harness.board),
    saveCurrentBoard: harness.saveCurrentBoard,
    persistCurrentBoardId: harness.persistCurrentBoardId,
  };

  return {
    WorkspaceService: {
      getInstance: () => workspaceService,
    },
    crashRecoveryService: {
      shouldShowSafeModePrompt: () => false,
      isSafeMode: () => false,
      markLoadingComplete: vi.fn(),
      getCrashCount: () => 0,
      getMemoryInfo: () => null,
      enableSafeMode: vi.fn(),
      disableSafeMode: vi.fn(),
      clearCrashState: vi.fn(),
    },
    isWorkspaceMigrationCompleted: vi.fn(async () => true),
    migrateToWorkspace: vi.fn(),
    safeReload: vi.fn(),
    useDocumentTitle: vi.fn(),
    markTabSyncVersion: vi.fn(),
    requestServiceWorkerIdlePrefetch: vi.fn(),
    MessagePlugin: {
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

vi.mock('@drawnix/drawnix/app', async () => {
  const React = await import('react');
  return {
    Drawnix: (props: DrawnixProps) => {
      harness.latestDrawnixProps = props;
      return React.createElement('div', { 'data-testid': 'drawnix' });
    },
  };
});

describe('App board persistence recovery', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    harness.latestDrawnixProps = null;
    vi.clearAllMocks();
  });

  it('keeps a close snapshot while a newer board save is still pending', async () => {
    const saveResolvers: Array<() => void> = [];
    harness.saveCurrentBoard.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          saveResolvers.push(resolve);
        })
    );

    const { default: App } = await import('./app');
    render(<App />);

    await waitFor(() => {
      expect(harness.persistCurrentBoardId).toHaveBeenCalledWith('board-a');
      expect(harness.latestDrawnixProps).not.toBeNull();
    });

    const first = { children: [{ id: 'first', type: 'geometry' }] };
    const second = { children: [{ id: 'second', type: 'geometry' }] };
    const onChange = harness.latestDrawnixProps?.onChange;
    if (!onChange) {
      throw new Error('Drawnix onChange was not captured');
    }

    act(() => onChange(first));
    act(() => onChange(second));
    expect(harness.saveCurrentBoard).toHaveBeenCalledTimes(2);

    act(() => window.dispatchEvent(new Event('beforeunload')));
    expect(
      JSON.parse(
        localStorage.getItem('aitu_board_close_snapshot_v1') || 'null'
      )?.children
    ).toEqual([expect.objectContaining({ id: 'second' })]);

    await act(async () => {
      saveResolvers[0]();
      await Promise.resolve();
    });

    // The older completion must neither clear the existing recovery snapshot
    // nor suppress a later close snapshot while the newer save is pending.
    expect(
      JSON.parse(
        localStorage.getItem('aitu_board_close_snapshot_v1') || 'null'
      )?.children
    ).toEqual([expect.objectContaining({ id: 'second' })]);

    localStorage.removeItem('aitu_board_close_snapshot_v1');
    act(() => window.dispatchEvent(new Event('beforeunload')));

    const snapshot = JSON.parse(
      localStorage.getItem('aitu_board_close_snapshot_v1') || 'null'
    ) as { children?: Array<{ id: string }> } | null;
    expect(snapshot?.children).toEqual([
      expect.objectContaining({ id: 'second' }),
    ]);
  });
});
