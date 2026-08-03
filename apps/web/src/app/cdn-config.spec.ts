import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'apps/web/public/cdn-config.js'),
  'utf8'
);

function createCDNWindow(status: number) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.test/',
    runScripts: 'outside-only',
  });
  let sendCount = 0;

  class FakeXMLHttpRequest {
    timeout = 0;
    status = status;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;

    open() {
      return undefined;
    }

    send() {
      sendCount += 1;
      queueMicrotask(() => this.onload?.());
    }
  }

  Object.defineProperty(dom.window, 'XMLHttpRequest', {
    configurable: true,
    value: FakeXMLHttpRequest,
  });
  dom.window.eval(source);

  return {
    window: dom.window as unknown as Window & {
      __OPENTU_CDN_API__: {
        selectBestCDN: () => Promise<{ cdn: string }>;
      };
    },
    getSendCount: () => sendCount,
    close: () => dom.window.close(),
  };
}

describe('cdn-config startup selection', () => {
  it('shares one in-flight probe across bootstrap callers', async () => {
    const fixture = createCDNWindow(200);

    const results = await Promise.all([
      fixture.window.__OPENTU_CDN_API__.selectBestCDN(),
      fixture.window.__OPENTU_CDN_API__.selectBestCDN(),
      fixture.window.__OPENTU_CDN_API__.selectBestCDN(),
    ]);

    expect(fixture.getSendCount()).toBe(1);
    expect(results.map((result) => result.cdn)).toEqual([
      'jsdelivr',
      'jsdelivr',
      'jsdelivr',
    ]);
    fixture.close();
  });

  it('persists a bounded local fallback instead of probing again', async () => {
    const fixture = createCDNWindow(503);

    const first = await fixture.window.__OPENTU_CDN_API__.selectBestCDN();
    const second = await fixture.window.__OPENTU_CDN_API__.selectBestCDN();

    expect(first.cdn).toBe('local');
    expect(second.cdn).toBe('local');
    expect(fixture.getSendCount()).toBe(1);
    expect(
      JSON.parse(
        fixture.window.localStorage.getItem('opentu-cdn-preference') || '{}'
      ).cdn
    ).toBe('local');
    fixture.close();
  });

  it('starts a new single-flight probe after the persisted result expires', async () => {
    const fixture = createCDNWindow(200);

    await fixture.window.__OPENTU_CDN_API__.selectBestCDN();
    const stored = JSON.parse(
      fixture.window.localStorage.getItem('opentu-cdn-preference') || '{}'
    );
    fixture.window.localStorage.setItem(
      'opentu-cdn-preference',
      JSON.stringify({ ...stored, timestamp: 0 })
    );

    await Promise.all([
      fixture.window.__OPENTU_CDN_API__.selectBestCDN(),
      fixture.window.__OPENTU_CDN_API__.selectBestCDN(),
    ]);

    expect(fixture.getSendCount()).toBe(2);
    fixture.close();
  });
});
