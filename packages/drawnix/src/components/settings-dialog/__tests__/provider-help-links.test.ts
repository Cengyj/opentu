import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const join = (...parts: string[]) => parts.join('');

describe('provider API key help links', () => {
  it('uses the current key-management URL without third-party video links', () => {
    const source = [
      readSource('../settings-dialog.tsx'),
      readSource('../../../utils/gemini-api/auth.ts'),
    ].join('\n');

    expect(source).toContain('https://foropencode.com/keys');
    expect(source).not.toContain(join('foropencode.com/', 'token'));
    expect(source.toLowerCase()).not.toContain(join('bili', 'bili'));
    expect(source).not.toContain(join('b23', '.tv'));
  });
});
