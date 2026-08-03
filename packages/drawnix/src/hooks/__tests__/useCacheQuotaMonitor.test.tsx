// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCacheQuotaMonitor } from '../useCacheQuotaMonitor';

const runtime = vi.hoisted(() => ({
  loadUnifiedCacheService: vi.fn(),
}));

vi.mock('../../services/unified-cache-runtime', () => ({
  loadUnifiedCacheService: runtime.loadUnifiedCacheService,
}));

describe('useCacheQuotaMonitor', () => {
  let idleCallbacks: Array<() => void>;

  beforeEach(() => {
    vi.useRealTimers();
    runtime.loadUnifiedCacheService.mockReset();
    idleCallbacks = [];
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn((callback: () => void) => {
        idleCallbacks.push(callback);
        return idleCallbacks.length;
      })
    );
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not schedule the cache runtime until startup is operable', () => {
    const view = renderHook(
      ({ enabled }) => useCacheQuotaMonitor(undefined, enabled),
      { initialProps: { enabled: false } }
    );

    expect(idleCallbacks).toHaveLength(0);
    expect(runtime.loadUnifiedCacheService).not.toHaveBeenCalled();

    view.rerender({ enabled: true });

    expect(idleCallbacks).toHaveLength(1);
    expect(runtime.loadUnifiedCacheService).not.toHaveBeenCalled();
  });

  it('subscribes after the lazy runtime loads and cleans up on unmount', async () => {
    let quotaListener: (() => void) | undefined;
    const unsubscribe = vi.fn();
    const onQuotaExceeded = vi.fn();
    runtime.loadUnifiedCacheService.mockResolvedValue({
      onQuotaExceeded: vi.fn((listener: () => void) => {
        quotaListener = listener;
        return unsubscribe;
      }),
    });

    const view = renderHook(() => useCacheQuotaMonitor(onQuotaExceeded));
    expect(runtime.loadUnifiedCacheService).not.toHaveBeenCalled();

    act(() => idleCallbacks[0]?.());

    await waitFor(() => {
      expect(quotaListener).toBeDefined();
    });
    expect(view.result.current.isQuotaExceeded).toBe(false);

    act(() => quotaListener?.());

    expect(view.result.current.isQuotaExceeded).toBe(true);
    expect(onQuotaExceeded).toHaveBeenCalledTimes(1);

    act(() => view.result.current.resetQuotaFlag());
    expect(view.result.current.isQuotaExceeded).toBe(false);

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when the runtime resolves after unmount', async () => {
    let resolveRuntime!: (runtimeValue: {
      onQuotaExceeded: (listener: () => void) => () => void;
    }) => void;
    const runtimePromise = new Promise<{
      onQuotaExceeded: (listener: () => void) => () => void;
    }>((resolve) => {
      resolveRuntime = resolve;
    });
    const onQuotaExceeded = vi.fn();
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    runtime.loadUnifiedCacheService.mockReturnValue(runtimePromise);

    const view = renderHook(() => useCacheQuotaMonitor(onQuotaExceeded));
    act(() => idleCallbacks[0]?.());
    view.unmount();

    await act(async () => {
      resolveRuntime({ onQuotaExceeded: subscribe });
      await runtimePromise;
    });

    expect(subscribe).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('cancels the idle subscription when unmounted before it starts', () => {
    const view = renderHook(() => useCacheQuotaMonitor());
    const staleIdleCallback = idleCallbacks[0];

    view.unmount();

    expect(cancelIdleCallback).toHaveBeenCalledWith(1);
    act(() => staleIdleCallback?.());
    expect(runtime.loadUnifiedCacheService).not.toHaveBeenCalled();
  });
});
