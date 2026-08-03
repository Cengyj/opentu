// @vitest-environment jsdom

import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RetriableDeferredFeature } from './RetriableDeferredFeature';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('RetriableDeferredFeature', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows immediate user feedback while the requested feature loads', async () => {
    const deferred = createDeferred<{
      default: React.ComponentType<{ title: string }>;
    }>();
    const loader = vi.fn(() => deferred.promise);

    render(
      <RetriableDeferredFeature
        loader={loader}
        label="素材库"
        variant="inline"
        renderFeature={({ default: Feature }) => <Feature title="素材内容" />}
      />
    );

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('正在加载素材库');
    expect(status.className).toContain('deferred-feature-status--inline');
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({
        default: ({ title }) => <div>{title}</div>,
      });
      await deferred.promise;
    });

    expect(await screen.findByText('素材内容')).toBeTruthy();
  });

  it('drops a rejected React.lazy payload and retries on the visible action', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loader = vi
      .fn<
        () => Promise<{
          default: React.ComponentType<{ title: string }>;
        }>
      >()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce({
        default: ({ title }) => <div>{title}</div>,
      });

    render(
      <RetriableDeferredFeature
        loader={loader}
        label="素材库"
        renderFeature={({ default: Feature }) => <Feature title="重试成功" />}
      />
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      '素材库加载失败'
    );
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('重试成功')).toBeTruthy();
  });
});
