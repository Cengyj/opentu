import { describe, expect, it, vi } from 'vitest';
import { unifiedCacheService } from '../unified-cache-service';

describe('unified cache image preprocessing cancellation', () => {
  it('rejects an already-cancelled image request before reading or fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const controller = new AbortController();
    controller.abort(
      new DOMException('cancel image preprocessing', 'AbortError')
    );

    await expect(
      unifiedCacheService.getImageForAI('data:image/png;base64,iVBORw0KGgo=', {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
