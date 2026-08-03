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
  DeferredFramePanel,
  DeferredLayerPanel,
  type FramePanelLoader,
  type LayerPanelLoader,
} from './DeferredProjectDrawerPanels';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('DeferredProjectDrawerPanels', () => {
  it('loads the PPT editor only after its active panel is rendered', async () => {
    const deferred = createDeferred<Awaited<ReturnType<FramePanelLoader>>>();
    const panelLoader = vi.fn(() => deferred.promise);
    const onRuntimeRequired = vi.fn();

    render(
      <DeferredFramePanel
        currentBoardName="商业画板"
        panelLoader={panelLoader}
        onRuntimeRequired={onRuntimeRequired}
      />
    );

    expect(screen.getByRole('status').textContent).toContain(
      '正在加载PPT 编辑器'
    );
    expect(panelLoader).toHaveBeenCalledTimes(1);
    expect(onRuntimeRequired).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve({
        FramePanel: ({ currentBoardName }) => (
          <div>PPT:{currentBoardName}</div>
        ),
      });
      await deferred.promise;
    });

    expect(await screen.findByText('PPT:商业画板')).toBeTruthy();
    await waitFor(() => expect(onRuntimeRequired).toHaveBeenCalledTimes(1));
  });

  it('keeps a failed PPT panel chunk visibly retryable', async () => {
    const panelLoader = vi
      .fn<FramePanelLoader>()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce({
        FramePanel: () => <div>PPT 编辑器已恢复</div>,
      });

    render(<DeferredFramePanel panelLoader={panelLoader} />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'PPT 编辑器加载失败'
    );
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(panelLoader).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('PPT 编辑器已恢复')).toBeTruthy();
  });

  it('loads the layer panel through its independent boundary', async () => {
    const panelLoader = vi.fn<LayerPanelLoader>().mockResolvedValue({
      LayerPanel: () => <div>图层内容</div>,
    });

    render(<DeferredLayerPanel panelLoader={panelLoader} />);

    expect(await screen.findByText('图层内容')).toBeTruthy();
    expect(panelLoader).toHaveBeenCalledTimes(1);
  });
});
