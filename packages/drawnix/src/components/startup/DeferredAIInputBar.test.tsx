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

  it('does not mount the full runtime before startup is operable', () => {
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
  });

  it('automatically mounts the full runtime once startup and workspace data are ready', async () => {
    const { rerender } = render(
      <DeferredAIInputBar
        isDataReady={false}
        isStartupOperable
        activationKey={0}
      />
    );

    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();
    fireEvent.change(screen.getByTestId('ai-input-textarea'), {
      target: { value: '进度完成前输入的草稿' },
    });

    rerender(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable
        activationKey={0}
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('deferred-ai-input-bar')).toBeNull();
    });
    expect(
      (screen.getByTestId('ai-input-textarea') as HTMLTextAreaElement).value
    ).toBe('进度完成前输入的草稿');
  });

  it('keeps focus and typing in the composer core before startup completes', () => {
    render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable={false}
        activationKey={0}
      />
    );

    const input = screen.getByTestId('ai-input-textarea');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '首屏可编辑草稿' } });

    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();
    expect((input as HTMLTextAreaElement).value).toBe('首屏可编辑草稿');
    expect(runtimeEvents).toEqual([]);
  });

  it('allows an explicit advanced-control action to load the runtime early', async () => {
    render(
      <DeferredAIInputBar
        isDataReady={true}
        isStartupOperable={false}
        activationKey={0}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '加载附件工具' }));

    await waitFor(() => {
      expect(screen.queryByTestId('deferred-ai-input-bar')).toBeNull();
    });
    expect(screen.getByTestId('ai-input-textarea')).toBeTruthy();
  });

  it('blocks submission while the workspace is still restoring', () => {
    render(
      <DeferredAIInputBar
        isDataReady={false}
        isStartupOperable={false}
        activationKey={0}
      />
    );

    const input = screen.getByTestId('ai-input-textarea');
    fireEvent.change(input, { target: { value: '不能在恢复时提交' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByRole('status').textContent).toContain('正在恢复工作区');
    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();
    expect(runtimeEvents).toEqual([]);
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
    fireEvent.click(screen.getByRole('button', { name: '加载附件工具' }));

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
