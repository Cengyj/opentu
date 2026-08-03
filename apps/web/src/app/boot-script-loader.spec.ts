import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(
  resolve(process.cwd(), 'apps/web/index.html'),
  'utf8'
);

describe('index origin-only boot contract', () => {
  it('starts the same-origin main entry without waiting for optional CDN config', () => {
    expect(html).toContain("await import('./src/main.tsx');");
    expect(html).toContain('setupEarlyServiceWorkerBootstrap();');
    expect(html).not.toContain('__OPENTU_START_MAIN_ENTRY__');
    expect(html).not.toContain('loadCDNConfigAndBootstrap');
    expect(html).not.toContain('appendManagedBootScript');
    expect(html).not.toContain("'./cdn-config.js'");
    expect(html).not.toContain(
      'https://cdn.jsdelivr.net/npm/aitu-app@'
    );
  });

  it('does not await Service Worker registration before importing main', () => {
    const bootstrapCall = html.lastIndexOf(
      'setupEarlyServiceWorkerBootstrap();'
    );
    const mainImport = html.indexOf("await import('./src/main.tsx');");

    expect(bootstrapCall).toBeGreaterThan(0);
    expect(mainImport).toBeGreaterThan(bootstrapCall);
    expect(html.slice(bootstrapCall, mainImport)).not.toContain(
      'await setupEarlyServiceWorkerBootstrap'
    );
  });
});
