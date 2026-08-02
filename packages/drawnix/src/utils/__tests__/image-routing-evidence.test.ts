import { describe, expect, it } from 'vitest';
import {
  buildProviderCatalogDiscoverySignature,
  buildProviderCredentialIdentity,
  IMAGE_ROUTING_EVIDENCE_VERSION,
  isProviderCatalogImageRoutingEvidenceCurrent,
  normalizeProviderModelApiBaseUrl,
} from '../image-routing-evidence';

describe('image-routing-evidence', () => {
  const profile = {
    baseUrl: 'https://provider.example.com',
    apiKey: 'secret-key',
  };

  it('accepts only the current schema with the exact profile source', () => {
    const sourceBaseUrl = normalizeProviderModelApiBaseUrl(profile.baseUrl);
    const catalog = {
      routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION,
      discoveredAt: Date.now(),
      sourceBaseUrl,
      signature: buildProviderCatalogDiscoverySignature(
        profile.baseUrl,
        profile.apiKey
      ),
    };

    expect(isProviderCatalogImageRoutingEvidenceCurrent(catalog, profile)).toBe(
      true
    );
    expect(
      isProviderCatalogImageRoutingEvidenceCurrent(
        { ...catalog, routingEvidenceVersion: undefined },
        profile
      )
    ).toBe(false);
    expect(
      isProviderCatalogImageRoutingEvidenceCurrent(
        {
          ...catalog,
          routingEvidenceVersion: IMAGE_ROUTING_EVIDENCE_VERSION - 1,
        },
        profile
      )
    ).toBe(false);
    expect(
      isProviderCatalogImageRoutingEvidenceCurrent(catalog, {
        ...profile,
        apiKey: '',
      })
    ).toBe(false);
    expect(
      isProviderCatalogImageRoutingEvidenceCurrent(
        { ...catalog, sourceBaseUrl: 'https://other.example.com/v1' },
        profile
      )
    ).toBe(false);
    expect(
      isProviderCatalogImageRoutingEvidenceCurrent(catalog, {
        ...profile,
        apiKey: 'rotated-key',
      })
    ).toBe(false);
    expect(
      isProviderCatalogImageRoutingEvidenceCurrent(
        { ...catalog, signature: undefined },
        profile
      )
    ).toBe(false);
  });

  it('does not collapse distinct credentials that collided in the legacy 32-bit identity', () => {
    const firstCredential = 'sk-1gb8pjf-o1u3ou-66';
    const secondCredential = 'sk-tovgo5-iz1i68-52';

    expect(buildProviderCredentialIdentity(firstCredential)).toHaveLength(32);
    expect(buildProviderCredentialIdentity(secondCredential)).toHaveLength(32);
    expect(buildProviderCredentialIdentity(firstCredential)).not.toBe(
      buildProviderCredentialIdentity(secondCredential)
    );
    expect(buildProviderCredentialIdentity(firstCredential)).not.toContain(
      firstCredential
    );
  });
});
