import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('canvas audio playback startup boundary', () => {
  it('keeps caching and reading settings behind operation-scoped runtimes', () => {
    const packageRoot = process.cwd().endsWith('packages/drawnix')
      ? process.cwd()
      : resolve(process.cwd(), 'packages/drawnix');
    const source = readFileSync(
      resolve(packageRoot, 'src/services/canvas-audio-playback-service.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/from ['"]\.\.\/hooks\/useTextToSpeech['"]/);
    expect(source).not.toMatch(/from ['"]\.\.\/utils\/settings-manager['"]/);
    expect(source).not.toMatch(/from ['"]\.\/media-executor\/fallback-utils['"]/);
    expect(source).toContain("import('./canvas-audio-playback-cache-runtime')");
    expect(source).toContain("import('./canvas-audio-reading-runtime')");
  });
});
