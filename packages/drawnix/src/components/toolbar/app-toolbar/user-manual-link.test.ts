import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'app-menu-items.tsx'), 'utf8');

describe('user manual menu link contract', () => {
  it('opens the explicit static document instead of the SPA-fallback directory', () => {
    expect(source).toContain(
      "window.open('./user-manual/index.html', '_blank')"
    );
    expect(source).not.toMatch(
      /window\.open\(['"](?:\.\/|\/)user-manual\/['"]/
    );
  });
});
