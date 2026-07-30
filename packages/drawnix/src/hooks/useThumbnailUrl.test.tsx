import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThumbnailUrl } from './useThumbnailUrl';

vi.mock('../services/sw-channel/client', () => ({
  swChannelClient: {
    isInitialized: vi.fn(() => false),
    generateThumbnail: vi.fn(),
  },
}));

describe('useThumbnailUrl URL handling', () => {
  beforeEach(() => {
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({
        match: vi.fn(async () => undefined),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves remote signed video URLs instead of appending thumbnail parameters', () => {
    const source =
      'https://cdn.example.com/video.mp4?signature=abc123&expires=999999';
    const { result } = renderHook(() =>
      useThumbnailUrl(source, 'video', 'small')
    );

    expect(result.current).toBe(source);
  });

  it('keeps using thumbnail parameters for local virtual video URLs', () => {
    const { result } = renderHook(() =>
      useThumbnailUrl('/__aitu_cache__/video/task-1.mp4', 'video', 'large')
    );

    expect(result.current).toBeDefined();
    if (!result.current) throw new Error('thumbnail URL was not resolved');
    const resolved = new URL(result.current, window.location.origin);
    expect(resolved.pathname).toBe('/__aitu_cache__/video/task-1.mp4');
    expect(resolved.searchParams.get('thumbnail')).toBe('large');
  });
});
