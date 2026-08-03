import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCDNUrl,
  fetchFromCDNWithFallback,
  getAvailableCDNs,
  getCDNConfig,
  getCDNPreference,
  getCDNStatusReport,
  performHealthCheck,
  resetCDNStatus,
  setCDNPreference,
  type CDNSource,
} from './cdn-fallback';

const explicitFutureSource: CDNSource = {
  name: 'jsdelivr',
  urlTemplate: 'https://cdn.jsdelivr.net/npm/aitu-app@{version}/{path}',
  healthCheckPath: 'version.json',
  enabled: true,
  priority: 1,
};

describe('cdn-fallback origin-only release policy', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'caches', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    resetCDNStatus();
    await setCDNPreference(null);
  });

  afterEach(async () => {
    await setCDNPreference(null);
    resetCDNStatus();
    vi.restoreAllMocks();
  });

  it('exposes zero release-authorized remote candidates', () => {
    expect(getAvailableCDNs('1.0.4')).toEqual([]);
    expect(getCDNConfig().sources).toEqual([]);
    expect(getCDNStatusReport()).toEqual([]);
  });

  it('rejects a historical remote preference that is not release-authorized', async () => {
    await setCDNPreference({
      cdn: 'jsdelivr',
      latency: 18,
      timestamp: Date.now(),
      version: '1.0.4',
    });

    expect(getCDNPreference()).toBeNull();
    expect(getAvailableCDNs('1.0.4')).toEqual([]);
  });

  it('keeps an explicit local preference without creating remote candidates', async () => {
    await setCDNPreference({
      cdn: 'local',
      latency: 0,
      timestamp: Date.now(),
      version: '1.0.4',
    });

    expect(getCDNPreference()).toMatchObject({ cdn: 'local' });
    expect(getAvailableCDNs('1.0.4')).toEqual([]);
  });

  it('fetches a runtime asset from the current origin exactly once', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('console.log("origin");', {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript',
          'Content-Length': '220',
        },
      })
    );

    const result = await fetchFromCDNWithFallback(
      'assets/runtime.js',
      '1.0.4',
      'https://origin.example.com'
    );

    expect(result).toMatchObject({
      source: 'local',
      targetUrl: 'https://origin.example.com/assets/runtime.js',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://origin.example.com/assets/runtime.js',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('does not probe a remote source after an origin miss', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('missing', { status: 404 }));

    const result = await fetchFromCDNWithFallback(
      'assets/missing.js',
      '1.0.4',
      'https://origin.example.com',
      { requestKind: 'background-prefetch' }
    );

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://origin.example.com/assets/missing.js'
    );
  });

  it('normalizes a historical aitu-app CDN URL back to the current origin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('body { color: black; }', {
        status: 200,
        headers: {
          'Content-Type': 'text/css',
          'Content-Length': '120',
        },
      })
    );

    const result = await fetchFromCDNWithFallback(
      'https://cdn.jsdelivr.net/npm/aitu-app@1.0.4/assets/index.css',
      '1.0.4',
      'https://origin.example.com'
    );

    expect(result?.targetUrl).toBe(
      'https://origin.example.com/assets/index.css'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://origin.example.com/assets/index.css'
    );
  });

  it('performs no health-check request when the release has no candidates', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(performHealthCheck('1.0.4')).resolves.toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retains URL construction as an explicit future release-injection boundary', () => {
    expect(
      buildCDNUrl(
        explicitFutureSource,
        '2.0.0',
        '/assets/image-generation-core.js'
      )
    ).toBe(
      'https://cdn.jsdelivr.net/npm/aitu-app@2.0.0/assets/image-generation-core.js'
    );
    expect(
      buildCDNUrl(
        explicitFutureSource,
        '2.0.0',
        '/npm/winbox@0.2.82/dist/winbox.bundle.min.js'
      )
    ).toBe(
      'https://cdn.jsdelivr.net/npm/winbox@0.2.82/dist/winbox.bundle.min.js'
    );
  });
});
