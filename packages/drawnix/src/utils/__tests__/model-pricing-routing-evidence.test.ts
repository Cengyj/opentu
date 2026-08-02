import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_ROUTING_EVIDENCE_VERSION } from '../image-routing-evidence';

describe('model pricing routing evidence', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadService(cache: Record<string, unknown>) {
    vi.doMock('../settings-manager', () => ({
      providerPricingCacheSettings: {
        get: () => [cache],
        update: vi.fn().mockResolvedValue(undefined),
        addListener: vi.fn(),
      },
    }));
    return import('../model-pricing-service');
  }

  it('keeps legacy prices and groups but rejects legacy endpoint evidence', async () => {
    const { modelPricingService } = await loadService({
      profileId: 'provider-a',
      fetchedAt: Date.now(),
      sourceSignature: 'legacy-source',
      groups: [{ name: 'default', displayName: 'Default', ratio: 1 }],
      prices: {
        'image-model': {
          inputCnyMtok: null,
          outputCnyMtok: null,
          flatCny: 1,
          billingType: 'flat',
        },
      },
      modelEndpoints: {
        'image-model': {
          image: { path: '/stale/images/generations', method: 'POST' },
        },
      },
    });

    expect(modelPricingService.getCache('provider-a')).toMatchObject({
      groups: [{ name: 'default' }],
      prices: { 'image-model': { flatCny: 1 } },
    });
    expect(
      modelPricingService.getFreshRoutingModelEndpoints({
        id: 'provider-a',
        baseUrl: 'https://provider.example.com/v1',
        apiKey: 'current-key',
      })
    ).toBeNull();
  });

  it('accepts only current, fresh endpoint evidence from the same pricing source', async () => {
    const {
      buildPricingSourceSignature,
      modelPricingService,
      MODEL_PRICING_CACHE_TTL_MS,
    } = await loadService({
      profileId: 'provider-a',
      routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
      fetchedAt: Date.now(),
      sourceSignature: 'placeholder',
      groups: [],
      prices: {},
      modelEndpoints: {
        'image-model': {
          image: { path: '/v1/images/generations', method: 'POST' },
        },
      },
    });
    const cache = modelPricingService.getCache('provider-a');
    expect(cache).not.toBeNull();
    if (!cache) return;
    cache.sourceSignature = buildPricingSourceSignature(
      'https://provider.example.com/api/pricing',
      'default',
      1,
      'current-key'
    );
    expect(cache.sourceSignature).not.toContain('current-key');
    const profile = {
      id: 'provider-a',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'current-key',
    };
    expect(
      modelPricingService.getFreshRoutingModelEndpoints(profile)
    ).toMatchObject({
      'image-model': {
        image: { path: '/v1/images/generations' },
      },
    });
    expect(
      modelPricingService.getFreshRoutingModelEndpoints(
        profile,
        cache.fetchedAt + MODEL_PRICING_CACHE_TTL_MS
      )
    ).toBeNull();
    expect(
      modelPricingService.getFreshRoutingModelEndpoints({
        ...profile,
        apiKey: 'rotated-key',
      })
    ).toBeNull();
    expect(
      modelPricingService.getFreshRoutingModelEndpoints({
        ...profile,
        pricingUrl: 'https://other.example.com/api/pricing',
      })
    ).toBeNull();
    expect(
      modelPricingService.getFreshRoutingModelEndpoints({
        ...profile,
        apiKey: '',
      })
    ).toBeNull();
  });

  it('replaces the in-memory cache when persisted pricing settings change', async () => {
    const listeners = new Set<
      (caches: Array<Record<string, unknown>>) => void
    >();
    const initialCache = {
      profileId: 'provider-a',
      fetchedAt: 1,
      groups: [],
      prices: { old: { flatCny: 1 } },
    };
    const removedCache = {
      profileId: 'provider-removed',
      fetchedAt: 1,
      groups: [],
      prices: {},
    };
    vi.doMock('../settings-manager', () => ({
      providerPricingCacheSettings: {
        get: () => [initialCache, removedCache],
        update: vi.fn().mockResolvedValue(undefined),
        addListener: (
          listener: (caches: Array<Record<string, unknown>>) => void
        ) => listeners.add(listener),
      },
    }));

    const { modelPricingService } = await import('../model-pricing-service');
    expect(modelPricingService.getCache('provider-a')?.prices).toHaveProperty(
      'old'
    );
    expect(modelPricingService.getCache('provider-removed')).not.toBeNull();

    const cacheChangeListener = vi.fn();
    modelPricingService.subscribe(cacheChangeListener);
    listeners.forEach((listener) =>
      listener([
        { ...initialCache, prices: { old: { flatCny: 1 } } },
        { ...removedCache },
      ])
    );
    expect(cacheChangeListener).not.toHaveBeenCalled();

    const replacement = {
      profileId: 'provider-a',
      fetchedAt: 2,
      groups: [],
      prices: { current: { flatCny: 2 } },
    };
    listeners.forEach((listener) => listener([replacement]));

    expect(modelPricingService.getCache('provider-a')).toMatchObject({
      fetchedAt: 2,
      prices: { current: { flatCny: 2 } },
    });
    expect(
      modelPricingService.getCache('provider-a')?.prices
    ).not.toHaveProperty('old');
    expect(modelPricingService.getCache('provider-removed')).toBeNull();
    expect(cacheChangeListener).toHaveBeenCalledTimes(1);
  });

  it('treats pricing query parameters as part of the routing evidence source', async () => {
    const { buildPricingSourceSignature } = await loadService({
      profileId: 'unused-provider',
      fetchedAt: 0,
      groups: [],
      prices: {},
    });

    const tenantA = buildPricingSourceSignature(
      'https://provider.example.com/api/pricing?tenant=a&region=cn',
      'default',
      1,
      'current-key'
    );
    const tenantB = buildPricingSourceSignature(
      'https://provider.example.com/api/pricing?tenant=b&region=cn',
      'default',
      1,
      'current-key'
    );
    const reorderedTenantA = buildPricingSourceSignature(
      'https://provider.example.com/api/pricing?region=cn&tenant=a',
      'default',
      1,
      'current-key'
    );

    expect(tenantA).not.toBe(tenantB);
    expect(tenantA).not.toBe(reorderedTenantA);
    expect(tenantA).not.toContain('tenant=a');
  });

  it('does not let an older credential request overwrite a newer result', async () => {
    const pendingResponses = new Map<string, (response: Response) => void>();
    const persistedCaches: Array<Array<Record<string, unknown>>> = [];
    const update = vi.fn(async (caches: Array<Record<string, unknown>>) => {
      persistedCaches.push(caches);
    });
    vi.doMock('../settings-manager', () => ({
      providerPricingCacheSettings: {
        get: () => [],
        update,
        addListener: vi.fn(),
      },
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const authorization = (init?.headers as Record<string, string>)
          ?.Authorization;
        return new Promise<Response>((resolve) => {
          pendingResponses.set(authorization || '', resolve);
        });
      })
    );

    const { buildPricingSourceSignature, modelPricingService } = await import(
      '../model-pricing-service'
    );
    const profileId = 'provider-race';
    const pricingUrl = 'https://provider.example.com/api/pricing';
    const oldRequest = modelPricingService.fetchAndCache(
      profileId,
      pricingUrl,
      'old-key',
      'default',
      1
    );
    const newRequest = modelPricingService.fetchAndCache(
      profileId,
      pricingUrl,
      'new-key',
      'default',
      1
    );

    pendingResponses.get('Bearer new-key')?.(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              model_name: 'new-model',
              quota_type: 1,
              model_price: 1,
              enable_groups: ['default'],
            },
          ],
          group_ratio: { default: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const newCache = await newRequest;
    pendingResponses.get('Bearer old-key')?.(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              model_name: 'old-model',
              quota_type: 1,
              model_price: 1,
              enable_groups: ['default'],
            },
          ],
          group_ratio: { default: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const oldCallerResult = await oldRequest;

    const expectedSignature = buildPricingSourceSignature(
      pricingUrl,
      'default',
      1,
      'new-key'
    );
    expect(newCache.sourceSignature).toBe(expectedSignature);
    expect(oldCallerResult.sourceSignature).toBe(expectedSignature);
    expect(modelPricingService.getCache(profileId)).toMatchObject({
      sourceSignature: expectedSignature,
      prices: { 'new-model': { flatCny: 1 } },
    });
    expect(modelPricingService.getCache(profileId)?.prices).not.toHaveProperty(
      'old-model'
    );
    expect(persistedCaches.at(-1)?.[0]).toMatchObject({
      sourceSignature: expectedSignature,
      prices: { 'new-model': { flatCny: 1 } },
    });
  });

  it('does not surface a superseded credential failure after a newer request succeeds', async () => {
    const pendingResponses = new Map<
      string,
      {
        resolve: (response: Response) => void;
        reject: (error: Error) => void;
      }
    >();
    vi.doMock('../settings-manager', () => ({
      providerPricingCacheSettings: {
        get: () => [],
        update: vi.fn().mockResolvedValue(undefined),
        addListener: vi.fn(),
      },
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const authorization = (init?.headers as Record<string, string>)
          ?.Authorization;
        return new Promise<Response>((resolve, reject) => {
          pendingResponses.set(authorization || '', { resolve, reject });
        });
      })
    );

    const { modelPricingService } = await import('../model-pricing-service');
    const profileId = 'provider-stale-error';
    const pricingUrl = 'https://provider.example.com/api/pricing';
    const oldRequest = modelPricingService.fetchAndCache(
      profileId,
      pricingUrl,
      'old-key',
      'default',
      1
    );
    const newRequest = modelPricingService.fetchAndCache(
      profileId,
      pricingUrl,
      'new-key',
      'default',
      1
    );

    pendingResponses.get('Bearer new-key')?.resolve(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              model_name: 'new-model',
              quota_type: 1,
              model_price: 1,
              enable_groups: ['default'],
            },
          ],
          group_ratio: { default: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const currentCache = await newRequest;
    pendingResponses
      .get('Bearer old-key')
      ?.reject(new Error('old credential rejected'));

    await expect(oldRequest).resolves.toBe(currentCache);
    expect(modelPricingService.getCache(profileId)).toBe(currentCache);
  });

  it('does not let an in-flight request reverse an external cache update', async () => {
    const persistedListeners = new Set<
      (caches: Array<Record<string, unknown>>) => void
    >();
    let resolveFetch: ((response: Response) => void) | undefined;
    const update = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../settings-manager', () => ({
      providerPricingCacheSettings: {
        get: () => [],
        update,
        addListener: (
          listener: (caches: Array<Record<string, unknown>>) => void
        ) => persistedListeners.add(listener),
      },
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    const { modelPricingService } = await import('../model-pricing-service');
    const request = modelPricingService.fetchAndCache(
      'provider-external',
      'https://provider.example.com/api/pricing',
      'request-key',
      'default',
      1
    );
    const externalCache = {
      profileId: 'provider-external',
      routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
      fetchedAt: 999,
      sourceSignature: 'external-authority',
      groups: [],
      prices: { 'external-model': { flatCny: 2 } },
    };
    persistedListeners.forEach((listener) => listener([externalCache]));
    resolveFetch?.(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              model_name: 'late-model',
              quota_type: 1,
              model_price: 1,
              enable_groups: ['default'],
            },
          ],
          group_ratio: { default: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(request).resolves.toMatchObject(externalCache);
    expect(modelPricingService.getCache('provider-external')).toMatchObject(
      externalCache
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('does not retain the raw API key in shared response cache identities', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../settings-manager', () => ({
      providerPricingCacheSettings: {
        get: () => [],
        update,
        addListener: vi.fn(),
      },
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                model_name: 'safe-model',
                quota_type: 1,
                model_price: 1,
                enable_groups: ['default'],
              },
            ],
            group_ratio: { default: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const { modelPricingService } = await import('../model-pricing-service');
    const rawApiKey = 'raw-secret-key-that-must-not-be-a-map-key';
    await modelPricingService.fetchAndCache(
      'provider-secret-memory',
      'https://provider.example.com/api/pricing?tenant=secret',
      rawApiKey,
      'default',
      1
    );

    const internals = modelPricingService as unknown as {
      sharedResponseCacheMap: Map<string, unknown>;
      inflightRequestMap: Map<string, unknown>;
    };
    const retainedKeys = [
      ...internals.sharedResponseCacheMap.keys(),
      ...internals.inflightRequestMap.keys(),
    ];
    expect(retainedKeys.length).toBeGreaterThan(0);
    expect(retainedKeys.every((key) => !key.includes(rawApiKey))).toBe(true);
    expect(retainedKeys.every((key) => !key.includes('tenant=secret'))).toBe(
      true
    );
  });
});
