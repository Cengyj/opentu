// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredMediaLibraryGitHubSync } from './DeferredMediaLibraryGitHubSync';

interface DeferredCallbacks {
  frame: FrameRequestCallback | null;
  idle: IdleRequestCallback | null;
}

function installDeferredCallbacks() {
  const callbacks: DeferredCallbacks = { frame: null, idle: null };
  const cancelAnimationFrame = vi.fn();
  const cancelIdleCallback = vi.fn();

  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      callbacks.frame = callback;
      return 11;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
  vi.stubGlobal(
    'requestIdleCallback',
    vi.fn((callback: IdleRequestCallback) => {
      callbacks.idle = callback;
      return 22;
    })
  );
  vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

  return { callbacks, cancelAnimationFrame, cancelIdleCallback };
}

describe('DeferredMediaLibraryGitHubSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not request the remote runtime before a configured modal paints and becomes idle', async () => {
    const { callbacks } = installDeferredCallbacks();
    const runtimeLoader = vi.fn().mockResolvedValue({
      MediaLibraryGitHubSyncRuntime: () => (
        <div data-testid="github-sync-runtime" />
      ),
    });

    render(
      <DeferredMediaLibraryGitHubSync
        enabled
        onSynced={vi.fn()}
        runtimeLoader={runtimeLoader}
      />
    );

    expect(runtimeLoader).not.toHaveBeenCalled();
    expect(callbacks.frame).not.toBeNull();

    act(() => callbacks.frame?.(0));
    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(runtimeLoader).not.toHaveBeenCalled();
    expect(callbacks.idle).not.toBeNull();

    await act(async () => {
      callbacks.idle?.({
        didTimeout: false,
        timeRemaining: () => 10,
      });
    });

    expect(runtimeLoader).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('github-sync-runtime')).toBeTruthy();
  });

  it('does not schedule remote work for a local-only user', () => {
    const requestAnimationFrame = vi.fn();
    const requestIdleCallback = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    const runtimeLoader = vi.fn();

    render(
      <DeferredMediaLibraryGitHubSync
        enabled={false}
        onSynced={vi.fn()}
        runtimeLoader={runtimeLoader}
      />
    );

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(requestIdleCallback).not.toHaveBeenCalled();
    expect(runtimeLoader).not.toHaveBeenCalled();
  });

  it('cancels pending idle activation when the modal closes', async () => {
    const { callbacks, cancelIdleCallback } = installDeferredCallbacks();
    const runtimeLoader = vi.fn();
    const view = render(
      <DeferredMediaLibraryGitHubSync
        enabled
        onSynced={vi.fn()}
        runtimeLoader={runtimeLoader}
      />
    );

    act(() => callbacks.frame?.(0));
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    expect(callbacks.idle).not.toBeNull();

    view.unmount();

    expect(cancelIdleCallback).toHaveBeenCalledWith(22);
    expect(runtimeLoader).not.toHaveBeenCalled();
  });

  it('retries one rejected background chunk on a new idle turn', async () => {
    const { callbacks } = installDeferredCallbacks();
    const runtimeLoader = vi
      .fn()
      .mockRejectedValueOnce(new Error('stale chunk'))
      .mockResolvedValueOnce({
        MediaLibraryGitHubSyncRuntime: () => (
          <div data-testid="retried-github-sync-runtime" />
        ),
      });

    render(
      <DeferredMediaLibraryGitHubSync
        enabled
        onSynced={vi.fn()}
        runtimeLoader={runtimeLoader}
      />
    );

    act(() => callbacks.frame?.(0));
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    const firstIdleCallback = callbacks.idle;
    await act(async () => {
      firstIdleCallback?.({ didTimeout: false, timeRemaining: () => 10 });
    });
    expect(runtimeLoader).toHaveBeenCalledTimes(1);
    expect(callbacks.idle).not.toBe(firstIdleCallback);

    await act(async () => {
      callbacks.idle?.({ didTimeout: false, timeRemaining: () => 10 });
    });

    expect(runtimeLoader).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('retried-github-sync-runtime')).toBeTruthy();
  });
});
