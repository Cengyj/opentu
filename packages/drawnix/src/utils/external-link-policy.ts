const GITHUB_HOST_SUFFIXES = [
  'github.com',
  'github.io',
  'githubusercontent.com',
];

function normalizeHostname(url: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isBlockedExternalLink(url: string): boolean {
  const hostname = normalizeHostname(url);
  if (!hostname) {
    return false;
  }

  return GITHUB_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

export function openExternalLink(
  url: string,
  target: string = '_blank',
  features: string = 'noopener'
): boolean {
  if (typeof window === 'undefined' || isBlockedExternalLink(url)) {
    return false;
  }

  const opened = window.open(url, target, features);
  if (opened && target === '_blank') {
    opened.opener = null;
  }

  return opened !== null;
}
