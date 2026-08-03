import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('with-image startup boundary', () => {
  it('loads storage and cache services only for a real dropped-media action', () => {
    const source = readFileSync(resolve(__dirname, 'with-image.tsx'), 'utf8');

    expect(source).toContain("import('../services/asset-storage-service')");
    expect(source).toContain("import('../services/unified-cache-service')");
    expect(source).not.toMatch(
      /^import\s+.+from\s+['"]\.\.\/services\/(?:asset-storage-service|unified-cache-service)['"];?$/m
    );
  });

  it('uses the shared retriable single-flight runtime for image, video and audio drops', () => {
    const source = readFileSync(resolve(__dirname, 'with-image.tsx'), 'utf8');

    expect(source).toContain(
      'const loadMediaInsertionRuntime = createRetriableModuleLoader'
    );
    expect(source).toContain(
      'const { assetStorageService, insertVideoFromUrl } ='
    );
    expect(source).toContain(
      'const { assetStorageService, unifiedCacheService } = audioRuntime'
    );
  });
});
