// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './app';

const { initializeWorkspace } = vi.hoisted(() => ({
  initializeWorkspace: vi.fn(),
}));

vi.mock('@drawnix/drawnix/runtime', () => ({
  WorkspaceService: {
    getInstance: () => ({
      initialize: initializeWorkspace,
    }),
  },
  crashRecoveryService: {
    shouldShowSafeModePrompt: () => false,
    isSafeMode: () => false,
    markLoadingComplete: vi.fn(),
    getCrashCount: () => 0,
    getMemoryInfo: () => null,
    enableSafeMode: vi.fn(),
    clearCrashState: vi.fn(),
  },
  isWorkspaceMigrationCompleted: vi.fn(),
  migrateToWorkspace: vi.fn(),
  safeReload: vi.fn(),
  useDocumentTitle: vi.fn(),
  markTabSyncVersion: vi.fn(),
  requestServiceWorkerIdlePrefetch: vi.fn(),
  MessagePlugin: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@drawnix/drawnix/app', () => ({
  Drawnix: () => <div data-testid="drawnix" />,
}));

describe('App startup recovery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('shows the recovery UI when workspace initialization fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    initializeWorkspace.mockRejectedValueOnce(
      new Error('workspace-init-failed')
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: '应用初始化失败' })
    ).toBeTruthy();
    expect(screen.getByText('workspace-init-failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: '安全模式' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '打开调试页面' })).toBeTruthy();
    expect(consoleError).toHaveBeenCalledWith(
      '[App] Initialization failed:',
      expect.objectContaining({ message: 'workspace-init-failed' })
    );
  });
});
