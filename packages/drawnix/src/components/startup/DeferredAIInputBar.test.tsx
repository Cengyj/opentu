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

afterEach(cleanup);

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
        activationKey={0}
        onShellMounted={onShellMounted}
      />
    );

    expect(onShellMounted).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();
  });

  it('does not mount the full runtime before the first interaction', () => {
    render(<DeferredAIInputBar isDataReady={true} activationKey={0} />);

    expect(screen.getByTestId('deferred-ai-input-bar')).toBeTruthy();
    expect(
      screen
        .getByTestId('deferred-ai-input-bar')
        .getAttribute('data-load-status')
    ).toBe('idle');
  });

  it('preserves a draft typed while the full runtime is loading', async () => {
    render(<DeferredAIInputBar isDataReady={true} activationKey={0} />);

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
    render(<DeferredAIInputBar isDataReady={true} activationKey={0} />);

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
        <DeferredAIInputBar isDataReady={true} activationKey={0} />
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
