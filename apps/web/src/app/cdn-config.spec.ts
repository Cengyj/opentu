import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'apps/web/public/cdn-config.js'),
  'utf8'
);

interface CDNApi {
  selectBestCDN: () => Promise<{ cdn: string }>;
  reselectCDN: () => Promise<{ cdn: string }>;
  sources: Array<{ name: string }>;
}

function createCDNWindow(
  setup?: (window: Window & typeof globalThis) => void
) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.test/',
    runScripts: 'outside-only',
  });
  let sendCount = 0;

  class UnexpectedXMLHttpRequest {
    open() {
      return undefined;
    }

    send() {
      sendCount += 1;
      throw new Error('origin-only release must not probe a remote CDN');
    }
  }

  Object.defineProperty(dom.window, 'XMLHttpRequest', {
    configurable: true,
    value: UnexpectedXMLHttpRequest,
  });
  setup?.(dom.window);
  dom.window.eval(source);

  return {
    window: dom.window as unknown as Window & {
      __OPENTU_CDN_API__: CDNApi;
      __OPENTU_CDN__: { cdn: string };
    },
    getSendCount: () => sendCount,
    close: () => dom.window.close(),
  };
}

describe('cdn-config origin-only selection', () => {
  it('publishes zero remote candidates and resolves local without probing', async () => {
    const fixture = createCDNWindow();

    const results = await Promise.all([
      fixture.window.__OPENTU_CDN_API__.selectBestCDN(),
      fixture.window.__OPENTU_CDN_API__.selectBestCDN(),
      fixture.window.__OPENTU_CDN_API__.selectBestCDN(),
    ]);

    expect(fixture.window.__OPENTU_CDN_API__.sources).toEqual([]);
    expect(results.map((result) => result.cdn)).toEqual([
      'local',
      'local',
      'local',
    ]);
    expect(fixture.getSendCount()).toBe(0);
    fixture.close();
  });

  it('discards a historical jsdelivr preference without probing it', async () => {
    const fixture = createCDNWindow((window) => {
      window.localStorage.setItem(
        'opentu-cdn-preference',
        JSON.stringify({
          cdn: 'jsdelivr',
          latency: 20,
          timestamp: Date.now(),
        })
      );
    });

    const preference =
      await fixture.window.__OPENTU_CDN_API__.selectBestCDN();

    expect(preference.cdn).toBe('local');
    expect(fixture.window.__OPENTU_CDN__.cdn).toBe('local');
    expect(fixture.getSendCount()).toBe(0);
    expect(
      JSON.parse(
        fixture.window.localStorage.getItem('opentu-cdn-preference') || '{}'
      ).cdn
    ).toBe('local');
    fixture.close();
  });

  it('keeps explicit reselection origin-only until a release injects candidates', async () => {
    const fixture = createCDNWindow();

    const preference = await fixture.window.__OPENTU_CDN_API__.reselectCDN();

    expect(preference.cdn).toBe('local');
    expect(fixture.window.__OPENTU_CDN_API__.sources).toHaveLength(0);
    expect(fixture.getSendCount()).toBe(0);
    fixture.close();
  });
});
