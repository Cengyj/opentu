import { describe, expect, it } from 'vitest';

import {
  containsAppShellDocumentMarker,
  isAppShellResponseForRelease,
  isAppShellFallbackForStaticHtml,
  isPrecacheResponseValidForRelease,
  isExplicitStaticHtmlDocument,
  readAppShellReleaseId,
  shouldBypassAppShellCacheForLazyChunkRecovery,
  shouldUseCDNFirstPreload,
  shouldUseOriginFirstPreload,
  shouldUseAppShellStrategy,
} from './app-shell-routing';

describe('app-shell-routing', () => {
  it('keeps SPA navigations on the app shell', () => {
    expect(shouldUseAppShellStrategy('navigate', '/workspace/abc')).toBe(true);
    expect(shouldUseAppShellStrategy('navigate', '/')).toBe(true);
    expect(shouldUseAppShellStrategy('navigate', '/index.html')).toBe(true);
  });

  it('does not treat explicit html documents as the app shell', () => {
    expect(
      shouldUseAppShellStrategy('navigate', '/user-manual/index.html')
    ).toBe(false);
    expect(
      shouldUseAppShellStrategy('navigate', '/advanced-settings.html')
    ).toBe(false);
    expect(
      shouldUseAppShellStrategy('navigate', '/ADVANCED-SETTINGS.HTML')
    ).toBe(false);
  });

  it('distinguishes explicit static HTML from the root shell and SPA routes', () => {
    expect(isExplicitStaticHtmlDocument('/user-manual/index.html')).toBe(true);
    expect(isExplicitStaticHtmlDocument('/ADVANCED-SETTINGS.HTML')).toBe(true);
    expect(isExplicitStaticHtmlDocument('/index.html')).toBe(false);
    expect(isExplicitStaticHtmlDocument('/')).toBe(false);
    expect(isExplicitStaticHtmlDocument('/workspace/abc')).toBe(false);
  });

  it('recognizes the application shell marker without matching manual HTML', () => {
    expect(
      containsAppShellDocumentMarker(
        '<head><meta content="1.0.2" name="app-version" /></head>'
      )
    ).toBe(true);
    expect(
      containsAppShellDocumentMarker(
        '<head><title>Opentu 用户手册</title></head>'
      )
    ).toBe(false);
  });

  it('reads the immutable release identity from a cloned app shell response', async () => {
    const response = new Response(
      '<!doctype html><head><meta content="release-b" name="app-release-id"></head>',
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );

    await expect(readAppShellReleaseId(response)).resolves.toBe('release-b');
    await expect(response.text()).resolves.toContain('release-b');
    await expect(
      readAppShellReleaseId(
        new Response('<!doctype html><title>manual</title>', {
          headers: { 'content-type': 'text/html' },
        })
      )
    ).resolves.toBeNull();
  });

  it('continues past an earlier app-version stream chunk to read release identity', async () => {
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode('<meta name="app-version" content="1.0.2">')
          );
          controller.enqueue(
            encoder.encode(
              '<meta name="app-release-id" content="release-streamed">'
            )
          );
          controller.close();
        },
      }),
      { headers: { 'content-type': 'text/html' } }
    );

    await expect(readAppShellReleaseId(response)).resolves.toBe(
      'release-streamed'
    );
  });

  it('rejects cached app shells whose body or cache metadata belongs to another release', async () => {
    const response = (bodyRelease: string, headerRelease?: string) =>
      new Response(`<meta name="app-release-id" content="${bodyRelease}">`, {
        headers: {
          'content-type': 'text/html',
          ...(headerRelease ? { 'x-sw-release-id': headerRelease } : {}),
        },
      });

    await expect(
      isAppShellResponseForRelease(response('release-a'), 'release-a')
    ).resolves.toBe(true);
    await expect(
      isAppShellResponseForRelease(
        response('release-b', 'release-a'),
        'release-a'
      )
    ).resolves.toBe(false);
    await expect(
      isAppShellResponseForRelease(
        response('release-a', 'release-b'),
        'release-a'
      )
    ).resolves.toBe(false);
  });

  it('rejects a stale app shell before it can enter a new release precache', async () => {
    const shell = (releaseId: string) =>
      new Response(`<meta name="app-release-id" content="${releaseId}">`, {
        headers: { 'content-type': 'text/html' },
      });

    await expect(
      isPrecacheResponseValidForRelease(
        '/index.html',
        shell('release-a'),
        'release-b'
      )
    ).resolves.toBe(false);
    await expect(
      isPrecacheResponseValidForRelease(
        '/index.html',
        shell('release-b'),
        'release-b'
      )
    ).resolves.toBe(true);
    await expect(
      isPrecacheResponseValidForRelease(
        '/assets/app.js',
        new Response('console.log(1)', {
          headers: { 'content-type': 'text/javascript' },
        }),
        'release-b'
      )
    ).resolves.toBe(true);
  });

  it('rejects an app shell returned for a static HTML URL without consuming it', async () => {
    const appShell = `<!doctype html><html><head>${' '.repeat(
      4096
    )}<meta name="app-version" content="1.0.2"></head><body><div id="root"></div></body></html>`;
    const response = new Response(appShell, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    await expect(
      isAppShellFallbackForStaticHtml(
        '/user-manual/advanced-settings.html',
        response
      )
    ).resolves.toBe(true);
    await expect(response.text()).resolves.toBe(appShell);
  });

  it('accepts real static HTML and never probes root or extension-less SPA documents', async () => {
    const manualResponse = new Response(
      '<!doctype html><title>Opentu 用户手册</title>',
      { headers: { 'content-type': 'text/html' } }
    );
    const rootShellResponse = new Response(
      '<meta name="app-version" content="1.0.2">',
      { headers: { 'content-type': 'text/html' } }
    );
    const spaShellResponse = new Response(
      '<meta name="app-version" content="1.0.2">',
      { headers: { 'content-type': 'text/html' } }
    );

    await expect(
      isAppShellFallbackForStaticHtml('/user-manual/index.html', manualResponse)
    ).resolves.toBe(false);
    await expect(
      isAppShellFallbackForStaticHtml('/index.html', rootShellResponse)
    ).resolves.toBe(false);
    await expect(
      isAppShellFallbackForStaticHtml('/workspace/abc', spaShellResponse)
    ).resolves.toBe(false);
  });

  it('keeps only root shell and release metadata on origin-first preload', () => {
    expect(shouldUseOriginFirstPreload('/')).toBe(true);
    expect(shouldUseOriginFirstPreload('/index.html')).toBe(true);
    expect(shouldUseOriginFirstPreload('/version.json')).toBe(true);
    expect(shouldUseOriginFirstPreload('/manifest.json')).toBe(true);
    expect(shouldUseOriginFirstPreload('/sw.js')).toBe(true);
    expect(shouldUseOriginFirstPreload('/precache-manifest.json')).toBe(true);
    expect(shouldUseOriginFirstPreload('/idle-prefetch-manifest.json')).toBe(
      true
    );
  });

  it('prefers CDN for manifest-known static assets during preload', () => {
    expect(shouldUseCDNFirstPreload('/assets/index-abc123.js')).toBe(true);
    expect(shouldUseCDNFirstPreload('/icons/android-chrome-192x192.png')).toBe(
      true
    );
    expect(shouldUseCDNFirstPreload('/user-manual/index.html')).toBe(true);
  });

  it('bypasses the cached app shell only for fresh lazy chunk recovery reloads', () => {
    expect(
      shouldBypassAppShellCacheForLazyChunkRecovery(
        '?_lazy_chunk_retry=1&_t=1000',
        1000 + 60 * 1000
      )
    ).toBe(true);
    expect(
      shouldBypassAppShellCacheForLazyChunkRecovery(
        '?_lazy_chunk_retry=1&_t=1000',
        1000 + 11 * 60 * 1000
      )
    ).toBe(false);
    expect(shouldBypassAppShellCacheForLazyChunkRecovery('?board=abc')).toBe(
      false
    );
    expect(
      shouldBypassAppShellCacheForLazyChunkRecovery(
        '?_lazy_chunk_retry=1&_t=86401000',
        1000
      )
    ).toBe(false);
  });
});
