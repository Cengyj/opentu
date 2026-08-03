import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  const packageRoot = process.cwd().endsWith('packages/drawnix')
    ? process.cwd()
    : resolve(process.cwd(), 'packages/drawnix');
  return readFileSync(resolve(packageRoot, relativePath), 'utf8');
}

describe('startup cache boundary', () => {
  it('keeps the complete cache implementation behind one retryable loader', () => {
    const runtimeSource = readSource(
      'src/services/unified-cache-runtime.ts'
    );
    const quotaProviderSource = readSource(
      'src/components/cache-quota-provider/CacheQuotaProvider.tsx'
    );
    const embeddedMediaSource = readSource('src/data/embedded-media.ts');
    const insertCardsSource = readSource('src/utils/insert-cards.ts');

    expect(runtimeSource).toContain('createRetriableModuleLoader');
    expect(runtimeSource).toMatch(
      /import\(\s*['"]\.\/unified-cache-service['"]\s*\)/
    );
    expect(quotaProviderSource).toContain(
      "from '../../hooks/useCacheQuotaMonitor'"
    );
    expect(quotaProviderSource).not.toContain(
      "from '../../hooks/useUnifiedCache'"
    );
    expect(embeddedMediaSource).toContain('loadUnifiedCacheService()');
    expect(embeddedMediaSource).not.toMatch(
      /^import(?!\s+type).+unified-cache-service/m
    );
    expect(insertCardsSource).toContain("from './viewport-scroll'");
    expect(insertCardsSource).not.toContain("from './selection-utils'");
  });
});
