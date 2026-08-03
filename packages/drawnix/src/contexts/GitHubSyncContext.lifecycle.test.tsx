// @vitest-environment jsdom

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubSyncProvider } from './GitHubSyncContext';

const lifecycleSpies = vi.hoisted(() => ({
  pullFromRemote: vi.fn(),
  removeStatusListener: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../services/github-sync', () => ({
  syncEngine: {
    getConfig: vi.fn().mockResolvedValue({
      gistId: 'configured-gist',
      lastSyncTime: null,
    }),
    getSyncStatus: vi.fn(() => 'idle'),
    addStatusListener: vi.fn(),
    removeStatusListener: lifecycleSpies.removeStatusListener,
    hasPendingChanges: vi.fn(() => false),
    pullFromRemote: lifecycleSpies.pullFromRemote,
  },
  tokenService: {
    hasToken: vi.fn(() => true),
    validateAndGetUserInfo: vi.fn().mockResolvedValue({
      isValid: true,
      userInfo: {
        login: 'configured-user',
        name: null,
        avatar_url: '',
      },
    }),
  },
  mediaSyncService: {
    refreshSyncStatus: vi.fn().mockResolvedValue(undefined),
  },
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logSuccess: vi.fn(),
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../services/workspace-service', () => ({
  workspaceService: {
    observeEvents: vi.fn(() => ({
      subscribe: vi.fn(() => ({ unsubscribe: lifecycleSpies.unsubscribe })),
    })),
  },
}));

describe('GitHubSyncProvider lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lifecycleSpies.pullFromRemote.mockResolvedValue({ success: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cancels deferred auto-sync and subscriptions when its owner closes', async () => {
    let idleCallback: IdleRequestCallback | null = null;
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn((callback: IdleRequestCallback) => {
        idleCallback = callback;
        return 91;
      })
    );
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    const view = render(
      <GitHubSyncProvider>
        <span>sync owner</span>
      </GitHubSyncProvider>
    );

    await waitFor(() => expect(idleCallback).not.toBeNull());
    expect(lifecycleSpies.pullFromRemote).not.toHaveBeenCalled();

    view.unmount();

    expect(cancelIdleCallback).toHaveBeenCalledWith(91);
    expect(lifecycleSpies.removeStatusListener).toHaveBeenCalledTimes(1);
    expect(lifecycleSpies.unsubscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      idleCallback?.({ didTimeout: false, timeRemaining: () => 10 });
    });
    expect(lifecycleSpies.pullFromRemote).not.toHaveBeenCalled();

  });
});
