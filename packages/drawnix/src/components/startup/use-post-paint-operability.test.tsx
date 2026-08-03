// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePostPaintOperability } from './use-post-paint-operability';

function Harness({ initialized }: { initialized: boolean }) {
  const isOperable = usePostPaintOperability(initialized);
  return <output data-testid="operability">{String(isOperable)}</output>;
}

describe('usePostPaintOperability', () => {
  let frameCallbacks: Map<number, FrameRequestCallback>;
  let nextFrameId: number;

  beforeEach(() => {
    vi.useFakeTimers();
    frameCallbacks = new Map();
    nextFrameId = 1;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId++;
        frameCallbacks.set(id, callback);
        return id;
      })
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => frameCallbacks.delete(id))
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('becomes ready only after initialization, a frame, and its following task', () => {
    const view = render(<Harness initialized={false} />);

    expect(screen.getByTestId('operability').textContent).toBe('false');
    expect(requestAnimationFrame).not.toHaveBeenCalled();

    view.rerender(<Harness initialized={true} />);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('operability').textContent).toBe('false');

    act(() => frameCallbacks.get(1)?.(16));
    expect(screen.getByTestId('operability').textContent).toBe('false');

    act(() => vi.runOnlyPendingTimers());
    expect(screen.getByTestId('operability').textContent).toBe('true');
  });

  it('cancels an unpainted readiness transition on unmount', () => {
    const view = render(<Harness initialized={true} />);
    const staleFrame = frameCallbacks.get(1);

    view.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);

    act(() => staleFrame?.(16));
    act(() => vi.runOnlyPendingTimers());
    expect(vi.getTimerCount()).toBe(0);
  });
});
