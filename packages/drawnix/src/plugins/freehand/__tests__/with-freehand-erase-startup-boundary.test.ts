import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../with-freehand-erase.ts'),
  'utf8'
);

describe('withFreehandErase startup boundary', () => {
  it('keeps precise boolean erase outside the initial canvas graph', () => {
    expect(source).toContain('createRetriableModuleLoader');
    expect(source).toContain(
      "() => import('../../transforms/precise-erase')"
    );
    expect(source).not.toMatch(
      /from ['"]\.\.\/\.\.\/transforms\/precise-erase['"]/
    );
  });
});
