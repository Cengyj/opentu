import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('RetryImage startup boundary', () => {
  it('keeps the cache service behind the virtual-URL fallback runtime', () => {
    const componentSource = readFileSync(
      resolve(__dirname, 'retry-image.tsx'),
      'utf8'
    );
    const runtimeSource = readFileSync(
      resolve(__dirname, 'retry-image-cache-runtime.ts'),
      'utf8'
    );
    const cacheRuntimeSource = readFileSync(
      resolve(__dirname, '../services/unified-cache-runtime.ts'),
      'utf8'
    );

    expect(componentSource).not.toContain(
      "from '../services/unified-cache-service'"
    );
    expect(componentSource).toContain('loadRetryImageCacheRuntime()');
    expect(runtimeSource).toContain('loadUnifiedCacheService()');
    expect(cacheRuntimeSource).toMatch(
      /import\(\s*['"]\.\/unified-cache-service['"]\s*\)/
    );
    expect(cacheRuntimeSource).toContain('createRetriableModuleLoader');
  });
});
