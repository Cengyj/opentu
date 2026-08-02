function isRootPathname(pathname: string): boolean {
  return pathname === '/' || pathname === '/index.html';
}

const APP_SHELL_HTML_PROBE_BYTES = 16 * 1024;
const APP_SHELL_VERSION_META_PATTERN =
  /<meta\b[^>]*\bname\s*=\s*(["'])app-version\1[^>]*>/i;
const APP_SHELL_RELEASE_META_PATTERN =
  /<meta\b(?=[^>]*\bname\s*=\s*(["'])app-release-id\1)(?=[^>]*\bcontent\s*=\s*(["'])([^"']+)\2)[^>]*>/i;

const ORIGIN_FIRST_PRELOAD_SUFFIXES = [
  '/version.json',
  '/manifest.json',
  '/sw.js',
  '/precache-manifest.json',
  '/idle-prefetch-manifest.json',
] as const;
const LAZY_CHUNK_RETRY_PARAM = '_lazy_chunk_retry';
const LAZY_CHUNK_RETRY_TS_PARAM = '_t';
const LAZY_CHUNK_RETRY_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Explicit HTML documents are static pages, not extension-less SPA routes.
 * The root index remains the application shell by definition.
 */
export function isExplicitStaticHtmlDocument(pathname: string): boolean {
  return !isRootPathname(pathname) && pathname.toLowerCase().endsWith('.html');
}

/**
 * The app shell owns this version marker; generated standalone documents do
 * not. Keep the marker check independent from request/response plumbing so it
 * can be covered without constructing a service-worker environment.
 */
export function containsAppShellDocumentMarker(htmlPrefix: string): boolean {
  return APP_SHELL_VERSION_META_PATTERN.test(htmlPrefix);
}

async function readResponseTextPrefix(
  response: Response,
  maxBytes: number
): Promise<string> {
  let clonedResponse: Response;
  try {
    clonedResponse = response.clone();
  } catch {
    return '';
  }

  const reader = clonedResponse.body?.getReader();
  if (!reader) {
    return '';
  }

  const decoder = new TextDecoder();
  let bytesRead = 0;
  let prefix = '';

  try {
    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) {
        break;
      }

      const remainingBytes = maxBytes - bytesRead;
      const bytes =
        value.byteLength > remainingBytes
          ? value.subarray(0, remainingBytes)
          : value;
      bytesRead += bytes.byteLength;
      prefix += decoder.decode(bytes, { stream: true });
    }

    return prefix + decoder.decode();
  } finally {
    // With a cloned response, awaiting cancellation may wait for the original
    // tee branch to finish. Fire-and-handle keeps the caller's body untouched.
    void reader.cancel().catch(() => {
      // A completed/closed clone does not require cleanup.
    });
  }
}

/**
 * Detect a server-side SPA fallback returned for a standalone HTML URL.
 * Only a bounded prefix of a cloned response is inspected, leaving the
 * response body available to its caller and avoiding a full-document read.
 */
export async function isAppShellFallbackForStaticHtml(
  pathname: string,
  response: Response
): Promise<boolean> {
  if (
    !isExplicitStaticHtmlDocument(pathname) ||
    response.status !== 200 ||
    !(response.headers.get('content-type') || '')
      .toLowerCase()
      .includes('text/html')
  ) {
    return false;
  }

  const prefix = await readResponseTextPrefix(
    response,
    APP_SHELL_HTML_PROBE_BYTES
  );
  return containsAppShellDocumentMarker(prefix);
}

/** Reads the immutable build identity without consuming the response body. */
export async function readAppShellReleaseId(
  response: Response
): Promise<string | null> {
  if (
    response.status !== 200 ||
    !(response.headers.get('content-type') || '')
      .toLowerCase()
      .includes('text/html')
  ) {
    return null;
  }
  const prefix = await readResponseTextPrefix(
    response,
    APP_SHELL_HTML_PROBE_BYTES
  );
  const releaseId = prefix.match(APP_SHELL_RELEASE_META_PATTERN)?.[3]?.trim();
  return releaseId || null;
}

export async function isAppShellResponseForRelease(
  response: Response,
  expectedReleaseId: string
): Promise<boolean> {
  const bodyReleaseId = await readAppShellReleaseId(response);
  const cachedReleaseId = response.headers.get('x-sw-release-id')?.trim();
  return (
    bodyReleaseId === expectedReleaseId &&
    (!cachedReleaseId || cachedReleaseId === expectedReleaseId)
  );
}

/**
 * The root shell is release-bearing data. Precache must prove its body identity
 * before decorating it with the worker release header; otherwise a partially
 * propagated deployment can make an older shell look like the new release.
 */
export async function isPrecacheResponseValidForRelease(
  pathname: string,
  response: Response,
  expectedReleaseId: string
): Promise<boolean> {
  const normalizedPathname = pathname.split(/[?#]/, 1)[0];
  if (!isRootPathname(normalizedPathname)) {
    return true;
  }
  return isAppShellResponseForRelease(response, expectedReleaseId);
}

export function shouldUseAppShellStrategy(
  requestMode: string,
  pathname: string
): boolean {
  // 只有根壳页走 SPA fallback；目录下的 index.html 属于真实静态文档。
  if (isRootPathname(pathname)) {
    return true;
  }

  return requestMode === 'navigate' && !isExplicitStaticHtmlDocument(pathname);
}

export function shouldUseOriginFirstPreload(pathname: string): boolean {
  if (isRootPathname(pathname)) {
    return true;
  }

  return ORIGIN_FIRST_PRELOAD_SUFFIXES.some((suffix) =>
    pathname.endsWith(suffix)
  );
}

export function shouldUseCDNFirstPreload(pathname: string): boolean {
  return !shouldUseOriginFirstPreload(pathname);
}

export function shouldBypassAppShellCacheForLazyChunkRecovery(
  search: string,
  now = Date.now()
): boolean {
  const params = new URLSearchParams(search);
  if (params.get(LAZY_CHUNK_RETRY_PARAM) !== '1') {
    return false;
  }

  const retryAt = Number(params.get(LAZY_CHUNK_RETRY_TS_PARAM));
  if (!Number.isFinite(retryAt) || retryAt <= 0) {
    return true;
  }

  const retryAgeMs = now - retryAt;
  return retryAgeMs >= 0 && retryAgeMs <= LAZY_CHUNK_RETRY_MAX_AGE_MS;
}
