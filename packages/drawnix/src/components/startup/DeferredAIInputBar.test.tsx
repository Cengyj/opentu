// @vitest-environment jsdom

import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_INPUT_PREFILL_EVENT } from '../../services/ai-input-ui-events';
import { DeferredAIInputBar } from './DeferredAIInputBar';

const runtimeEvents: string[] = [];

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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

vi.mock('./AIInputBarRuntime', async () => {
  const ReactModule = await import('react');
  return {
    AIInputBarRuntime: ({
      initialPrompt,
      onReady,
    }: {
      initialPrompt: string;
      onReady: () => void;
    }) => {
      const [prompt, setPrompt] = ReactModule.useState(initialPrompt);

      ReactModule.useEffect(() => {
        const handlePrefill = (event: Event) => {
          const detail = (event as CustomEvent<{ prompt?: string }>).detail;
          runtimeEvents.push(detail?.prompt || '');
          setPrompt(detail?.prompt || '');
        };
        window.addEventListener(AI_INPUT_PREFILL_EVENT, handlePrefill);
        return () =>
          window.removeEventListener(AI_INPUT_PREFILL_EVENT, handlePrefill);
      }, []);

      ReactModule.useEffect(() => onReady(), [onReady]);

      return (
        <textarea
          data-testid="ai-input-textarea"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              runtimeEvents.push(`submit:${prompt}`);
            }
          }}
        />
      );
    },
  };
});

describe('DeferredAIInputBar', () => {
  beforeEach(() => {
    runtimeEvents.length = 0;
  });

  it('reports when the operable shell has committed', () => {
    const onShellMounted = vi.fn();

    render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable={false}
        activationKey={0}
        onShellMounted={onShellMounted}
      />
    );

    expect(onShellMounted).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();
  });

  it('does not schedule or mount the full runtime before startup is operable', () => {
    const idle = installIdleHarness();
    render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable={false}
        activationKey={0}
      />
    );

    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();
    expect(
      screen
        .getByTestId('deferred-ai-input-bar')
        .getAttribute('data-load-status')
    ).toBe('idle');
    expect(idle.requestIdleCallback).not.toHaveBeenCalled();
  });

  it('automatically mounts the full runtime when the painted shell becomes idle', async () => {
    const idle = installIdleHarness();
    const view = render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable={false}
        activationKey={0}
      />
    );

    view.rerender(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable
        activationKey={0}
      />
    );

    expect(idle.requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(idle.requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 1500 }
    );
    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();

    act(() => {
      idle.callbacks.get(1)?.();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('deferred-ai-input-bar')).toBeNull();
    });
    expect(screen.getByTestId('ai-input-textarea')).toBeTruthy();
    expect(document.activeElement).not.toBe(
      screen.getByTestId('ai-input-textarea')
    );
    expect(runtimeEvents).toEqual([]);
  });

  it('uses a bounded timer fallback when requestIdleCallback is unavailable', async () => {
    vi.useFakeTimers();
    render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable
        activationKey={0}
      />
    );

    act(() => vi.advanceTimersByTime(399));
    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('deferred-ai-input-bar')).toBeNull();
    expect(screen.getByTestId('ai-input-textarea')).toBeTruthy();
  });

  it('cancels the idle activation and loads immediately on earlier interaction', async () => {
    const idle = installIdleHarness();
    render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable
        activationKey={0}
      />
    );

    expect(idle.requestIdleCallback).toHaveBeenCalledTimes(1);
    fireEvent.focus(screen.getByTestId('ai-input-textarea'));

    await waitFor(() => {
      expect(screen.queryByTestId('deferred-ai-input-bar')).toBeNull();
    });
    expect(idle.cancelIdleCallback).toHaveBeenCalledWith(1);
    expect(idle.callbacks.has(1)).toBe(false);
  });

  it('cancels the pending idle activation when the shell unmounts', () => {
    const idle = installIdleHarness();
    const view = render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable
        activationKey={0}
      />
    );
    const staleCallback = idle.callbacks.get(1);

    view.unmount();

    expect(idle.cancelIdleCallback).toHaveBeenCalledWith(1);
    act(() => staleCallback?.());
    expect(screen.queryByTestId('ai-input-textarea')).toBeNull();
  });

  it('preserves a draft typed while the full runtime is loading', async () => {
    render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable={false}
        activationKey={0}
      />
    );

    const shellInput = screen.getByTestId('ai-input-textarea');
    fireEvent.focus(shellInput);
    fireEvent.change(shellInput, { target: { value: '保留首个草稿' } });

    await waitFor(() => {
      expect(screen.queryByTestId('deferred-ai-input-bar')).toBeNull();
    });
    expect(
      (screen.getByTestId('ai-input-textarea') as HTMLTextAreaElement).value
    ).toBe('保留首个草稿');
  });

  it('replays one Enter submission after preserving the loading draft', async () => {
    render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable={false}
        activationKey={0}
      />
    );

    const shellInput = screen.getByTestId('ai-input-textarea');
    fireEvent.change(shellInput, { target: { value: '加载后发送' } });
    fireEvent.keyDown(shellInput, { key: 'Enter' });

    await waitFor(() => {
      expect(runtimeEvents).toContain('submit:加载后发送');
    });
    expect(
      runtimeEvents.filter((event) => event === 'submit:加载后发送')
    ).toHaveLength(1);
  });

  it('replays a structured prefill event after runtime listeners are ready', async () => {
    render(
      <React.StrictMode>
        <DeferredAIInputBar
          isDataReady={true}
          isStartupOperable={false}
          activationKey={0}
        />
      </React.StrictMode>
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AI_INPUT_PREFILL_EVENT, {
          detail: {
            generationType: 'image',
            prompt: '来自任务队列的回填',
            source: 'task-queue',
          },
        })
      );
    });

    await waitFor(() => {
      expect(runtimeEvents).toEqual(['来自任务队列的回填']);
    });
    expect(
      (screen.getByTestId('ai-input-textarea') as HTMLTextAreaElement).value
    ).toBe('来自任务队列的回填');
  });
});
