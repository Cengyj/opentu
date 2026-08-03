// @vitest-environment jsdom

import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DeferredTaskQueuePanel,
  type TaskQueuePanelLoader,
} from './DeferredTaskQueuePanel';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('DeferredTaskQueuePanel', () => {
  it('loads the foreground panel before starting the recovery runtime', async () => {
    const deferred = createDeferred<
      Awaited<ReturnType<TaskQueuePanelLoader>>
    >();
    const panelLoader = vi.fn(() => deferred.promise);
    const onRuntimeRequired = vi.fn();

    render(
      <DeferredTaskQueuePanel
        expanded={true}
        onClose={vi.fn()}
        panelLoader={panelLoader}
        onRuntimeRequired={onRuntimeRequired}
      />
    );

    expect(screen.getByRole('status').textContent).toContain(
      '正在加载任务队列'
    );
    expect(onRuntimeRequired).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve({
        TaskQueuePanel: ({ expanded }) => (
          <div>任务面板:{expanded ? '打开' : '关闭'}</div>
        ),
      });
      await deferred.promise;
    });

    expect(await screen.findByText('任务面板:打开')).toBeTruthy();
    await waitFor(() => expect(onRuntimeRequired).toHaveBeenCalledTimes(1));
  });

  it('keeps a failed task-panel chunk visible and retryable', async () => {
    const panelLoader = vi
      .fn<TaskQueuePanelLoader>()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce({
        TaskQueuePanel: () => <div>任务面板已恢复</div>,
      });

    render(
      <DeferredTaskQueuePanel
        expanded={true}
        onClose={vi.fn()}
        panelLoader={panelLoader}
      />
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      '任务队列加载失败'
    );
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(panelLoader).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('任务面板已恢复')).toBeTruthy();
  });
});
