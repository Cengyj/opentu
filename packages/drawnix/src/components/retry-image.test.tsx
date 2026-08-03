// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadRetryImageCacheRuntime } = vi.hoisted(() => ({
  loadRetryImageCacheRuntime: vi.fn(),
}));

vi.mock('@aitu/utils', () => ({
  normalizeImageDataUrl: (value: string) => value,
}));

vi.mock('./retry-image-cache-runtime', () => ({
  loadRetryImageCacheRuntime,
}));

import { RetryImage } from './retry-image';

describe('RetryImage', () => {
  beforeEach(() => {
    loadRetryImageCacheRuntime.mockReset();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:cached-image'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('关闭 skeleton 时加载中的图片保持可见', () => {
    render(
      <RetryImage
        src="https://example.com/preview.png"
        alt="结果预览"
        showSkeleton={false}
      />
    );

    expect(screen.getByAltText('结果预览')).toHaveProperty(
      'style.opacity',
      '1'
    );
  });

  it('开启 skeleton 时图片加载完成后再淡入', () => {
    render(<RetryImage src="https://example.com/preview.png" alt="结果预览" />);

    const image = screen.getByAltText('结果预览');
    expect(image).toHaveProperty('style.opacity', '0');

    fireEvent.load(image);

    expect(image).toHaveProperty('style.opacity', '1');
  });

  it('does not load the cache runtime for an ordinary image URL', () => {
    render(
      <RetryImage
        src="https://example.com/preview.png"
        alt="普通图片"
        showSkeleton={false}
      />
    );

    expect(loadRetryImageCacheRuntime).not.toHaveBeenCalled();
  });

  it('loads the cache runtime only when a virtual URL needs SW fallback', async () => {
    const getCachedBlob = vi
      .fn<(url: string) => Promise<Blob | null>>()
      .mockResolvedValue(new Blob(['image-bytes'], { type: 'image/png' }));
    loadRetryImageCacheRuntime.mockResolvedValue({ getCachedBlob });

    render(
      <RetryImage
        src="/__aitu_cache__/cached-image"
        alt="缓存图片"
        showSkeleton={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByAltText('缓存图片').getAttribute('src')).toBe(
        'blob:cached-image'
      );
    });

    expect(loadRetryImageCacheRuntime).toHaveBeenCalledTimes(1);
    expect(getCachedBlob).toHaveBeenCalledWith(
      '/__aitu_cache__/cached-image'
    );
  });

  it('revokes a fallback blob that resolves after unmount', async () => {
    let resolveBlob!: (blob: Blob | null) => void;
    const blobPromise = new Promise<Blob | null>((resolve) => {
      resolveBlob = resolve;
    });
    loadRetryImageCacheRuntime.mockResolvedValue({
      getCachedBlob: vi.fn(() => blobPromise),
    });

    const view = render(
      <RetryImage
        src="/asset-library/late-image"
        alt="延迟缓存图片"
        showSkeleton={false}
      />
    );

    await waitFor(() => {
      expect(loadRetryImageCacheRuntime).toHaveBeenCalledTimes(1);
    });
    view.unmount();
    resolveBlob(new Blob(['late-image'], { type: 'image/png' }));

    await waitFor(() => {
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cached-image');
    });
  });
});
