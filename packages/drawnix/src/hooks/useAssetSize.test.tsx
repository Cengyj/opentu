// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAssetSize } from './useAssetSize';

vi.mock('../services/unified-cache-service', () => ({
  unifiedCacheService: {
    getCacheInfo: vi.fn(),
  },
}));

describe('useAssetSize', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a persisted size on the first render without an idle query or state rerender', () => {
    const requestIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    let renderCount = 0;

    const { result } = renderHook(() => {
      renderCount += 1;
      return useAssetSize(
        'known-size-asset',
        '/__aitu_cache__/image/known-size-asset.png',
        4096
      );
    });

    expect(result.current).toBe(4096);
    expect(renderCount).toBe(1);
    expect(requestIdleCallback).not.toHaveBeenCalled();
  });
});
