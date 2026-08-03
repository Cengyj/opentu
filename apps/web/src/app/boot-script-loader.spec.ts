import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(
  resolve(process.cwd(), 'apps/web/index.html'),
  'utf8'
);
const loaderStart = html.indexOf('function appendManagedBootScript(');
const loaderEnd = html.indexOf('function clampProgress', loaderStart);

if (loaderStart < 0 || loaderEnd < 0) {
  throw new Error('appendManagedBootScript source was not found');
}

const loaderSource = html.slice(loaderStart, loaderEnd);

afterEach(() => {
  vi.useRealTimers();
});

describe('index boot script loader', () => {
  it('falls back after the bounded CDN wait and completes only once', () => {
    vi.useFakeTimers();
    const dom = new JSDOM('<!doctype html><html><head></head></html>', {
      url: 'https://example.test/',
      runScripts: 'outside-only',
    });
    dom.window.eval(`
      var toPreferredBootAssetUrl = function () {
        return 'https://cdn.example.test/cdn-config.js';
      };
      ${loaderSource}
      window.__appendManagedBootScriptForTest = appendManagedBootScript;
    `);

    const onLoad = vi.fn();
    const onFinalError = vi.fn();
    const testWindow = dom.window as unknown as Window & {
      __appendManagedBootScriptForTest: (
        localPath: string,
        onload: () => void,
        onfinalerror: () => void,
        timeoutMs: number
      ) => void;
    };

    testWindow.__appendManagedBootScriptForTest(
      './cdn-config.js',
      onLoad,
      onFinalError,
      1200
    );
    const preferredScript =
      dom.window.document.querySelector<HTMLScriptElement>(
        'script[src="https://cdn.example.test/cdn-config.js"]'
      );
    expect(preferredScript).toBeTruthy();

    vi.advanceTimersByTime(1200);
    const localScript = dom.window.document.querySelector<HTMLScriptElement>(
      'script[data-fallback-attempted="1"]'
    );
    expect(localScript?.getAttribute('src')).toBe('./cdn-config.js');

    preferredScript?.dispatchEvent(new dom.window.Event('load'));
    localScript?.dispatchEvent(new dom.window.Event('load'));

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onFinalError).not.toHaveBeenCalled();
    dom.window.close();
  });
});
