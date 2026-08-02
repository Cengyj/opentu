import type { ProviderCatalog, ProviderProfile } from './settings-types';

/**
 * Version of persisted evidence that is allowed to influence automatic image
 * protocol selection. This is intentionally independent from APP_VERSION: it
 * changes only when the persisted routing evidence contract changes.
 */
export const IMAGE_ROUTING_EVIDENCE_VERSION = 2;

export function normalizeProviderModelApiBaseUrl(baseUrl: string): string {
  const trimmed = (baseUrl || '').trim();
  const fallback = 'https://foropencode.com/v1';
  if (!trimmed) return fallback;

  let normalized = trimmed.replace(/\/+$/, '');
  normalized = normalized.replace(/\/models$/i, '');
  if (!/\/v1$/i.test(normalized)) {
    normalized = `${normalized}/v1`;
  }
  return normalized;
}

function createOpaqueCredentialFingerprint(input: string): string {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ codePoint, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ codePoint, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ codePoint, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ codePoint, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1, h2, h3, h4]
    .map((value) => (value >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Stable 128-bit cache identity. This is an opaque fingerprint, not an
 * authentication primitive; callers must never persist or log the source key.
 */
export function buildProviderCredentialIdentity(apiKey: string): string {
  return createOpaqueCredentialFingerprint(apiKey.trim());
}

/**
 * Existing runtime model-discovery identity persisted in ProviderCatalog.
 * Keep the algorithm centralized so discovery and freshness validation cannot
 * disagree after a credential change.
 */
export function buildProviderCatalogDiscoverySignature(
  baseUrl: string,
  apiKey: string
): string {
  return `${normalizeProviderModelApiBaseUrl(
    baseUrl
  )}::${buildProviderCredentialIdentity(apiKey)}`;
}

export function isProviderCatalogImageRoutingEvidenceCurrent(
  catalog: Pick<
    ProviderCatalog,
    'routingEvidenceVersion' | 'discoveredAt' | 'sourceBaseUrl' | 'signature'
  >,
  profile: Pick<ProviderProfile, 'baseUrl' | 'apiKey'>
): boolean {
  if (
    catalog.routingEvidenceVersion !== IMAGE_ROUTING_EVIDENCE_VERSION ||
    !Number.isFinite(catalog.discoveredAt) ||
    !profile.apiKey.trim()
  ) {
    return false;
  }

  const expectedBaseUrl = normalizeProviderModelApiBaseUrl(profile.baseUrl);
  const expectedSignature = buildProviderCatalogDiscoverySignature(
    profile.baseUrl,
    profile.apiKey
  );
  return (
    normalizeProviderModelApiBaseUrl(catalog.sourceBaseUrl || '') ===
      expectedBaseUrl && catalog.signature?.trim() === expectedSignature
  );
}
