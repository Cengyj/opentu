import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';
import type { MinimapProps } from '../../types/minimap.types';
import type { ViewNavigationMinimapComponent } from './view-navigation-minimap-runtime';
import { DeferredViewNavigationMinimap } from './DeferredViewNavigationMinimap';

const runtimeMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock('./view-navigation-minimap-runtime', () => ({
  loadViewNavigationMinimap: runtimeMocks.load,
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

interface IdleHarness {
  callbacks: Map<number, () => void>;
  requestIdleCallback: ReturnType<typeof vi.fn>;
  cancelIdleCallback: ReturnType<typeof vi.fn>;
}

function installIdleHarness(): IdleHarness {
  const callbacks = new Map<number, () => void>();
  let nextId = 1;
  const requestIdleCallback = vi.fn((callback: () => void) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  const cancelIdleCallback = vi.fn((id: number) => {
    callbacks.delete(id);
  });

  vi.stubGlobal('requestIdleCallback', requestIdleCallback);
  vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

  return { callbacks, requestIdleCallback, cancelIdleCallback };
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

const LoadedMinimap: React.FC<MinimapProps> = ({ board, config }) => (
  <div
    data-testid="loaded-minimap"
    data-board-id={(board as unknown as { id: string }).id}
    data-width={config?.width}
    data-height={config?.height}
  />
);

const board = { id: 'board-1' } as unknown as PlaitBoard;

afterEach(cleanup);

describe('DeferredViewNavigationMinimap', () => {
  beforeEach(() => {
    runtimeMocks.load.mockReset();
    vi.unstubAllGlobals();
  });

  it('preserves the minimap footprint while loading, then renders the runtime', async () => {
    const idle = installIdleHarness();
    const deferred = createDeferred<ViewNavigationMinimapComponent>();
    runtimeMocks.load.mockReturnValue(deferred.promise);

    render(<DeferredViewNavigationMinimap board={board} />);

    expect(idle.requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.load).not.toHaveBeenCalled();
    expect(screen.getByRole('status').getAttribute('data-load-status')).toBe(
      'loading'
    );
    expect(screen.queryByTestId('loaded-minimap')).toBeNull();

    act(() => {
      idle.callbacks.get(1)?.();
    });
    expect(runtimeMocks.load).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(LoadedMinimap);
      await deferred.promise;
    });

    const minimap = screen.getByTestId('loaded-minimap');
    expect(minimap.getAttribute('data-board-id')).toBe('board-1');
    expect(minimap.getAttribute('data-width')).toBe('180');
    expect(minimap.getAttribute('data-height')).toBe('120');
  });

  it('does not schedule the runtime before operability and schedules it once afterwards', () => {
    const idle = installIdleHarness();
    const view = render(
      <DeferredViewNavigationMinimap
        board={board}
        isStartupOperable={false}
      />
    );

    expect(idle.requestIdleCallback).not.toHaveBeenCalled();
    expect(runtimeMocks.load).not.toHaveBeenCalled();

    view.rerender(
      <DeferredViewNavigationMinimap board={board} isStartupOperable />
    );

    expect(idle.requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.load).not.toHaveBeenCalled();
  });

  it('loads immediately for an explicit expansion before startup becomes operable', async () => {
    const idle = installIdleHarness();
    runtimeMocks.load.mockResolvedValue(LoadedMinimap);

    render(
      <DeferredViewNavigationMinimap
        board={board}
        isStartupOperable={false}
        loadImmediately
      />
    );

    await waitFor(() => expect(runtimeMocks.load).toHaveBeenCalledTimes(1));
    expect(idle.requestIdleCallback).not.toHaveBeenCalled();
    expect(screen.getByTestId('loaded-minimap')).toBeTruthy();
  });

  it('allows a failed chunk load to be retried', async () => {
    const idle = installIdleHarness();
    runtimeMocks.load
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce(LoadedMinimap);

    render(<DeferredViewNavigationMinimap board={board} />);

    act(() => {
      idle.callbacks.get(1)?.();
    });

    const retryButton = await screen.findByRole('button', {
      name: '重试加载小地图',
    });
    expect(screen.getByRole('status').getAttribute('data-load-status')).toBe(
      'failed'
    );

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByTestId('loaded-minimap')).toBeTruthy();
    });
    expect(runtimeMocks.load).toHaveBeenCalledTimes(2);
  });

  it('does not update after unmount while the runtime is loading', async () => {
    const idle = installIdleHarness();
    const deferred = createDeferred<ViewNavigationMinimapComponent>();
    runtimeMocks.load.mockReturnValue(deferred.promise);
    const view = render(<DeferredViewNavigationMinimap board={board} />);

    act(() => {
      idle.callbacks.get(1)?.();
    });

    view.unmount();
    await act(async () => {
      deferred.resolve(LoadedMinimap);
      await deferred.promise;
    });

    expect(screen.queryByTestId('loaded-minimap')).toBeNull();
  });

  it('cancels the idle load when unmounted before startup becomes idle', () => {
    const idle = installIdleHarness();
    const view = render(<DeferredViewNavigationMinimap board={board} />);
    const staleCallback = idle.callbacks.get(1);

    view.unmount();

    expect(idle.cancelIdleCallback).toHaveBeenCalledWith(1);
    act(() => {
      staleCallback?.();
    });
    expect(runtimeMocks.load).not.toHaveBeenCalled();
  });

  it('keeps the full minimap implementation behind a dynamic import', () => {
    const viewNavigationSource = readFileSync(
      resolve(__dirname, 'ViewNavigation.tsx'),
      'utf8'
    );
    const runtimeSource = readFileSync(
      resolve(__dirname, 'view-navigation-minimap-runtime.ts'),
      'utf8'
    );
    const minimapSource = readFileSync(
      resolve(__dirname, '../minimap/Minimap.tsx'),
      'utf8'
    );

    expect(viewNavigationSource).not.toContain(
      "from '../minimap/Minimap'"
    );
    expect(runtimeSource).toContain("import('../minimap/Minimap')");
    expect(viewNavigationSource).toContain(
      'isStartupOperable={isStartupOperable}'
    );
    expect(viewNavigationSource).toContain(
      'loadImmediately={manuallyExpanded}'
    );
    expect(minimapSource).not.toContain('tdesign-icons-react');
    expect(minimapSource).toContain('MinimapChevronRightIcon');
  });
});
