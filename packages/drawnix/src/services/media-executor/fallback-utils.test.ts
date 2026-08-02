/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cacheMediaFromBlob = vi.fn();
const cachedUrls = new Set<string>();
const isCached = vi.fn(async (url: string) => cachedUrls.has(url));
const getCachedBlob = vi.fn(async () => null as Blob | null);
const calculateBlobChecksum = vi.fn(async () => 'a'.repeat(64));

vi.mock('@aitu/utils', async () => {
  const actual = await vi.importActual<typeof import('@aitu/utils')>(
    '@aitu/utils'
  );
  return {
    ...actual,
    calculateBlobChecksum,
  };
});

vi.mock('../unified-cache-service', () => ({
  unifiedCacheService: {
    cacheMediaFromBlob,
    isCached,
    getCachedBlob,
  },
}));

describe('cacheRemoteUrl', () => {
  beforeEach(() => {
    cacheMediaFromBlob.mockReset();
    isCached.mockClear();
    getCachedBlob.mockReset();
    getCachedBlob.mockResolvedValue(null);
    calculateBlobChecksum.mockClear();
    cachedUrls.clear();
    cacheMediaFromBlob.mockImplementation(async (url: string) => {
      cachedUrls.add(url);
      return url;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['lookup', 'write'] as const)(
    'falls back when inline media cache %s does not settle',
    async (stalledStage) => {
      vi.useFakeTimers();
      const never = new Promise<never>(() => undefined);
      const inlineUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(new Blob(['png-binary'], { type: 'image/png' }), {
          status: 200,
        })
      );

      if (stalledStage === 'lookup') {
        isCached.mockImplementationOnce(() => never);
      } else {
        isCached.mockResolvedValueOnce(false);
        cacheMediaFromBlob.mockImplementationOnce(() => never);
      }
      vi.stubGlobal('fetch', fetchMock);

      const { cacheRemoteUrl } = await import('./fallback-utils');
      let settled = false;
      const resultPromise = cacheRemoteUrl(
        inlineUrl,
        `task-stalled-${stalledStage}`,
        'image',
        'png'
      ).then((result) => {
        settled = true;
        return result;
      });

      for (let turn = 0; turn < 12; turn += 1) {
        await Promise.resolve();
      }
      await vi.advanceTimersByTimeAsync(30_000);

      expect(settled).toBe(true);
      await expect(resultPromise).resolves.toBe(inlineUrl);
    }
  );

  it('caches raw base64 image payloads as content-addressed local URLs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Blob(['png-binary'], { type: 'image/png' }), {
        status: 200,
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrl } = await import('./fallback-utils');

    const result = await cacheRemoteUrl(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'task-raw-b64',
      'image',
      'png'
    );

    expect(result).toMatch(
      /^\/__aitu_cache__\/image\/content-[0-9a-f]{64}\.png$/
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheMediaFromBlob).toHaveBeenCalledWith(
      result,
      expect.any(Blob),
      'image',
      {
        contentHash: 'a'.repeat(64),
        metadata: { taskId: 'task-raw-b64' },
      }
    );

    vi.unstubAllGlobals();
  });

  it('reuses the same cached file for identical base64 payloads across tasks', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(new Blob(['same-binary'], { type: 'image/png' }), {
          status: 200,
        })
    );

    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrl } = await import('./fallback-utils');
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    const first = await cacheRemoteUrl(base64, 'task-a', 'image', 'png');
    const second = await cacheRemoteUrl(base64, 'task-b', 'image', 'png');

    expect(first).toBe(second);
    expect(cacheMediaFromBlob).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('keeps remote https image urls unchanged without rewriting them to local cache paths', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrl } = await import('./fallback-utils');
    const remoteUrl = 'https://cdn.example.com/generated/task-123.png?sig=abc';

    const result = await cacheRemoteUrl(remoteUrl, 'task-http', 'image', 'png');

    expect(result).toBe(remoteUrl);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheMediaFromBlob).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('requires durable persistence for task-backed image batches by default', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Blob(['image-binary'], { type: 'image/png' }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrls } = await import('./fallback-utils');
    const remoteUrl = 'https://cdn.example.com/generated/task-batch.png';

    const result = await cacheRemoteUrls(
      [remoteUrl],
      'task-image-batch',
      'image',
      'png'
    );

    expect(result).toEqual([remoteUrl]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cacheMediaFromBlob).toHaveBeenCalledWith(
      remoteUrl,
      expect.any(Blob),
      'image',
      {
        taskId: 'task-image-batch',
        source: 'AI_GENERATED',
      }
    );
    expect(isCached).toHaveBeenLastCalledWith(remoteUrl);
  });

  it('caches each distinct artifact once while preserving first-seen order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(
        async () =>
          new Response(new Blob(['image-binary'], { type: 'image/png' }), {
            status: 200,
          })
      )
    );
    const { cacheRemoteUrls } = await import('./fallback-utils');
    const first = 'https://cdn.example.com/generated/first.png';
    const second = 'https://cdn.example.com/generated/second.png';
    const third = 'https://cdn.example.com/generated/third.png';

    const result = await cacheRemoteUrls(
      [second, first, second, third, first],
      'task-deduplicated-artifacts',
      'image',
      'png'
    );

    expect(result).toEqual([second, first, third]);
    expect(cacheMediaFromBlob).toHaveBeenCalledTimes(3);
    expect(cacheMediaFromBlob.mock.calls.map(([url]) => url)).toEqual([
      second,
      first,
      third,
    ]);
  });

  it('persists canonical artifacts once without collapsing per-image metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const mimeType = String(input).endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
        return new Response(new Blob(['image-binary'], { type: mimeType }), {
          status: 200,
        });
      })
    );
    const { cacheImageArtifacts } = await import('./fallback-utils');
    const first = {
      url: 'https://cdn.example.com/generated/first.webp',
      source: 'url' as const,
      mimeType: 'image/webp' as const,
      format: 'webp' as const,
      width: 1200,
      height: 800,
    };
    const second = {
      url: 'https://cdn.example.com/generated/second.jpg',
      source: 'url' as const,
      mimeType: 'image/jpeg' as const,
      format: 'jpg' as const,
      width: 640,
      height: 640,
    };

    const result = await cacheImageArtifacts(
      [first, second, first],
      'task-canonical-artifacts'
    );

    expect(result).toEqual([first, second]);
    expect(cacheMediaFromBlob).toHaveBeenCalledTimes(2);
  });

  it('uses the persisted Blob MIME instead of a URL or adapter format guess', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(new Blob(['jpeg-binary'], { type: 'image/jpeg' }), {
          status: 200,
        })
      )
    );
    const { cacheImageArtifacts } = await import('./fallback-utils');

    const result = await cacheImageArtifacts(
      [
        {
          url: 'https://cdn.example.com/generated/opaque-result.png',
          source: 'url',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
      'task-actual-mime'
    );

    expect(result).toEqual([
      {
        url: 'https://cdn.example.com/generated/opaque-result.png',
        source: 'url',
        mimeType: 'image/jpeg',
        format: 'jpg',
      },
    ]);
  });

  it('rejects a successful HTTP response whose persisted MIME is not an image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(new Blob(['provider error page'], { type: 'text/html' }), {
          status: 200,
        })
      )
    );
    const { cacheImageArtifacts } = await import('./fallback-utils');

    await expect(
      cacheImageArtifacts(
        [
          {
            url: 'https://cdn.example.com/generated/error-page',
            source: 'url',
          },
        ],
        'task-invalid-mime'
      )
    ).rejects.toMatchObject({
      code: 'IMAGE_CACHE_PERSISTENCE_FAILED',
    });
    expect(cacheMediaFromBlob).not.toHaveBeenCalled();
  });

  it('rejects a task-backed image batch when the provider URL cannot be downloaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('unavailable', { status: 503 }))
    );

    const { cacheRemoteUrls } = await import('./fallback-utils');

    await expect(
      cacheRemoteUrls(
        ['https://cdn.example.com/generated/unavailable.png'],
        'task-download-failure',
        'image',
        'png'
      )
    ).rejects.toMatchObject({
      name: 'ImageCachePersistenceError',
      code: 'IMAGE_CACHE_PERSISTENCE_FAILED',
    });
    expect(cacheMediaFromBlob).not.toHaveBeenCalled();
  });

  it('rejects a task-backed image batch when the downloaded blob is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(new Blob([], { type: 'image/png' }), { status: 200 })
        )
    );

    const { cacheRemoteUrls } = await import('./fallback-utils');

    await expect(
      cacheRemoteUrls(
        ['https://cdn.example.com/generated/empty.png'],
        'task-empty-image',
        'image',
        'png'
      )
    ).rejects.toMatchObject({
      code: 'IMAGE_CACHE_PERSISTENCE_FAILED',
    });
    expect(cacheMediaFromBlob).not.toHaveBeenCalled();
  });

  it('rejects a task-backed image batch when cache persistence throws', async () => {
    cacheMediaFromBlob.mockRejectedValueOnce(new Error('storage unavailable'));
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(new Blob(['image-binary'], { type: 'image/png' }), {
          status: 200,
        })
      )
    );

    const { cacheRemoteUrls } = await import('./fallback-utils');

    await expect(
      cacheRemoteUrls(
        ['https://cdn.example.com/generated/write-failure.png'],
        'task-write-failure',
        'image',
        'png'
      )
    ).rejects.toMatchObject({
      code: 'IMAGE_CACHE_PERSISTENCE_FAILED',
    });
  });

  it('rejects a task-backed image batch when the cache cannot be read back', async () => {
    cacheMediaFromBlob.mockImplementationOnce(async (url: string) => url);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(new Blob(['image-binary'], { type: 'image/png' }), {
          status: 200,
        })
      )
    );

    const { cacheRemoteUrls } = await import('./fallback-utils');

    await expect(
      cacheRemoteUrls(
        ['https://cdn.example.com/generated/verify-failure.png'],
        'task-verify-failure',
        'image',
        'png'
      )
    ).rejects.toMatchObject({
      code: 'IMAGE_CACHE_PERSISTENCE_FAILED',
    });
    expect(isCached).toHaveBeenCalledTimes(2);
  });

  it('rejects instead of returning inline provider data when strict persistence times out', async () => {
    vi.useFakeTimers();
    isCached.mockImplementationOnce(() => new Promise<never>(() => undefined));

    const { cacheRemoteUrls } = await import('./fallback-utils');
    const resultPromise = cacheRemoteUrls(
      [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      ],
      'task-inline-timeout',
      'image',
      'png'
    );
    const assertion = expect(resultPromise).rejects.toMatchObject({
      code: 'IMAGE_CACHE_PERSISTENCE_FAILED',
    });

    await vi.advanceTimersByTimeAsync(30_000);

    await assertion;
    expect(cacheMediaFromBlob).not.toHaveBeenCalled();
  });

  it('propagates cancellation while task-backed remote image persistence is pending', async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrls } = await import('./fallback-utils');
    const resultPromise = cacheRemoteUrls(
      ['https://cdn.example.com/generated/pending.png'],
      'task-aborted-cache',
      'image',
      'png',
      { signal: controller.signal }
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(resultPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(cacheMediaFromBlob).not.toHaveBeenCalled();
  });

  it('rejects a missing local image result at the strict task boundary', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrls } = await import('./fallback-utils');

    await expect(
      cacheRemoteUrls(
        ['/__aitu_cache__/image/missing.png'],
        'task-missing-local',
        'image',
        'png'
      )
    ).rejects.toMatchObject({
      code: 'IMAGE_CACHE_PERSISTENCE_FAILED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches remote https audio urls while keeping original URLs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Blob(['audio-binary'], { type: 'audio/mpeg' }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrl } = await import('./fallback-utils');
    const remoteUrl = 'https://cdn.example.com/audio/task-123.mp3';

    const result = await cacheRemoteUrl(
      remoteUrl,
      'task-audio',
      'audio',
      'mp3'
    );

    expect(result).toBe(remoteUrl);
    expect(fetchMock).toHaveBeenCalledWith(remoteUrl, {
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    expect(cacheMediaFromBlob).toHaveBeenCalledWith(
      remoteUrl,
      expect.any(Blob),
      'audio',
      {
        taskId: 'task-audio',
        source: 'AI_GENERATED',
      }
    );

    vi.unstubAllGlobals();
  });

  it('caches playback-only remote audio urls while keeping original URLs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Blob(['audio-binary'], { type: 'audio/mpeg' }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrl } = await import('./fallback-utils');
    const remoteUrl = 'https://cdn.example.com/audio/task-456.mp3';

    const result = await cacheRemoteUrl(
      remoteUrl,
      'asset:d88312b4-5b86-4f11-b9a6-c4162ba07486',
      'audio',
      'mp3',
      undefined,
      { source: 'PLAYBACK_CACHE' }
    );

    expect(result).toBe(remoteUrl);
    expect(cacheMediaFromBlob).toHaveBeenCalledWith(
      remoteUrl,
      expect.any(Blob),
      'audio',
      {
        taskId: 'asset:d88312b4-5b86-4f11-b9a6-c4162ba07486',
        source: 'PLAYBACK_CACHE',
      }
    );

    vi.unstubAllGlobals();
  });

  it('caches force-remote cover images while keeping original URLs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Blob(['cover-binary'], { type: 'image/jpeg' }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrl } = await import('./fallback-utils');
    const remoteUrl = 'https://cdn.example.com/audio/cover.jpg';

    const result = await cacheRemoteUrl(
      remoteUrl,
      'task-audio-cover',
      'image',
      'jpg',
      1,
      { forceRemoteCache: true }
    );

    expect(result).toBe(remoteUrl);
    expect(cacheMediaFromBlob).toHaveBeenCalledWith(
      remoteUrl,
      expect.any(Blob),
      'image',
      {
        taskId: 'task-audio-cover',
        source: 'AI_GENERATED',
      }
    );

    vi.unstubAllGlobals();
  });

  it('keeps the original remote URL when cache write cannot be verified', async () => {
    cacheMediaFromBlob.mockResolvedValueOnce(
      'https://cdn.example.com/audio/cover.jpg'
    );

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Blob(['cover-binary'], { type: 'image/jpeg' }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrl } = await import('./fallback-utils');
    const remoteUrl = 'https://cdn.example.com/audio/cover.jpg';

    const result = await cacheRemoteUrl(
      remoteUrl,
      'task-cover',
      'image',
      'jpg',
      undefined,
      { forceRemoteCache: true }
    );

    expect(result).toBe(remoteUrl);
    expect(cacheMediaFromBlob).toHaveBeenCalledWith(
      remoteUrl,
      expect.any(Blob),
      'image',
      {
        taskId: 'task-cover',
        source: 'AI_GENERATED',
      }
    );

    vi.unstubAllGlobals();
  });

  it('keeps remote http urls unchanged as well', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const { cacheRemoteUrl } = await import('./fallback-utils');
    const remoteUrl = 'http://cdn.example.com/video/task-123.mp4';

    const result = await cacheRemoteUrl(
      remoteUrl,
      'task-video',
      'video',
      'mp4'
    );

    expect(result).toBe(remoteUrl);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheMediaFromBlob).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
