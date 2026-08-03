// @vitest-environment jsdom

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MediaLibraryGitHubSyncRuntime } from './MediaLibraryGitHubSyncRuntime';

const runtimeSpies = vi.hoisted(() => ({
  addSyncCompletedListener: vi.fn(),
  removeSyncCompletedListener: vi.fn(),
  providerMounted: vi.fn(),
  providerUnmounted: vi.fn(),
}));

vi.mock('../../services/github-sync/media-sync-service', () => ({
  mediaSyncService: {
    addSyncCompletedListener: runtimeSpies.addSyncCompletedListener,
    removeSyncCompletedListener: runtimeSpies.removeSyncCompletedListener,
  },
}));

vi.mock('../../contexts/GitHubSyncContext', async () => {
  const ReactModule = await import('react');
  return {
    GitHubSyncProvider: ({ children }: { children: React.ReactNode }) => {
      ReactModule.useEffect(() => {
        runtimeSpies.providerMounted();
        return () => runtimeSpies.providerUnmounted();
      }, []);
      return <span>{children}</span>;
    },
  };
});

describe('MediaLibraryGitHubSyncRuntime', () => {
  it('restores synced URLs, listens for completion, and cleans up with the modal', async () => {
    const onSynced = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <MediaLibraryGitHubSyncRuntime onSynced={onSynced} />
    );

    await waitFor(() => expect(onSynced).toHaveBeenCalledTimes(1));
    expect(runtimeSpies.providerMounted).toHaveBeenCalledTimes(1);
    expect(runtimeSpies.addSyncCompletedListener).toHaveBeenCalledTimes(1);

    const completionListener =
      runtimeSpies.addSyncCompletedListener.mock.calls[0][0];
    await act(async () => {
      completionListener();
    });
    expect(onSynced).toHaveBeenCalledTimes(2);

    view.unmount();

    expect(runtimeSpies.removeSyncCompletedListener).toHaveBeenCalledWith(
      completionListener
    );
    expect(runtimeSpies.providerUnmounted).toHaveBeenCalledTimes(1);
  });
});
