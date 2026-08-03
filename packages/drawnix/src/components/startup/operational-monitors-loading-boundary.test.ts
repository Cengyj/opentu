import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('operational monitor loading boundary', () => {
  const source = readFileSync(
    resolve(__dirname, './DrawnixOperationalMonitors.tsx'),
    'utf8'
  );

  it('keeps both monitor chunks independently retriable and visible', () => {
    expect(source).not.toContain('lazy(');
    expect(source).not.toContain('fallback={null}');
    expect(source.match(/createRetriableModuleLoader\(/g)).toHaveLength(2);
    expect(source.match(/<RetriableDeferredFeature/g)).toHaveLength(2);
    expect(source.match(/variant="passive"/g)).toHaveLength(2);
  });
});
