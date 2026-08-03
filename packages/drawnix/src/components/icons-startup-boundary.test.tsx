import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as PublicIcons from './icons';
import * as DeferredIcons from './icons/deferred-icons';
import * as StartupIcons from './icons/startup-icons';

const STARTUP_ICON_CONSUMERS = [
  'src/components/card-element/CardElement.tsx',
  'src/components/shared/AudioCover.tsx',
  'src/components/audio-node-element/AudioNodeContent.tsx',
  'src/components/workzone-element/WorkZoneContent.tsx',
  'src/components/toolbar/unified-toolbar.tsx',
  'src/components/toolbar/app-toolbar/app-toolbar.tsx',
  'src/components/toolbar/creation-toolbar.tsx',
  'src/components/toolbar/bottom-actions-section.tsx',
  'src/components/toolbar/task-queue-action-button.tsx',
  'src/components/shape-picker.tsx',
  'src/components/arrow-picker.tsx',
  'src/components/toolbar/freehand-panel/freehand-panel.tsx',
  'src/tools/built-in-manifests.tsx',
  'src/components/toolbar/app-toolbar/app-menu-items.tsx',
  'src/components/toolbar/app-toolbar/language-switcher-menu.tsx',
  'src/components/toolbar/more-tools-button.tsx',
  'src/components/feedback-button/feedback-button.tsx',
] as const;

function resolvePackageRoot() {
  return process.cwd().endsWith('packages/drawnix')
    ? process.cwd()
    : resolve(process.cwd(), 'packages/drawnix');
}

describe('startup icon boundary', () => {
  it('keeps the compatibility barrel out of every measured startup consumer', () => {
    const packageRoot = resolvePackageRoot();

    for (const relativePath of STARTUP_ICON_CONSUMERS) {
      const source = readFileSync(resolve(packageRoot, relativePath), 'utf8');

      expect(source, relativePath).toContain('icons/startup-icons');
      expect(source, relativePath).not.toMatch(
        /from\s+['"][^'"]*\/icons['"]/
      );
      expect(source, relativePath).not.toMatch(
        /from\s+['"]lucide-react['"]/
      );
    }

    const barrelSource = readFileSync(
      resolve(packageRoot, 'src/components/icons.tsx'),
      'utf8'
    );
    expect(barrelSource).toBe(
      "export * from './icons/startup-icons';\n" +
        "export * from './icons/deferred-icons';\n"
    );
  });

  it('does not preload feedback QR assets before the feedback popover opens', () => {
    const packageRoot = resolvePackageRoot();
    const source = readFileSync(
      resolve(
        packageRoot,
        'src/components/feedback-button/feedback-button.tsx'
      ),
      'utf8'
    );

    expect(source).not.toContain('new Image()');
    expect(source).not.toContain('cardid.jpg');
    expect(source).toContain('src={open ? QR_CODE_URL : undefined}');
  });

  it('preserves every public icon export through two disjoint implementation modules', () => {
    const publicExports = PublicIcons as Record<string, unknown>;
    const startupExports = StartupIcons as Record<string, unknown>;
    const deferredExports = DeferredIcons as Record<string, unknown>;
    const startupNames = Object.keys(startupExports);
    const deferredNames = Object.keys(deferredExports);

    expect(startupNames).toHaveLength(65);
    expect(deferredNames).toHaveLength(56);
    expect(
      startupNames.filter((name) => Object.hasOwn(deferredExports, name))
    ).toEqual([]);
    expect(Object.keys(publicExports).sort()).toEqual(
      [...startupNames, ...deferredNames].sort()
    );

    for (const name of startupNames) {
      expect(publicExports[name], name).toBe(startupExports[name]);
    }
    for (const name of deferredNames) {
      expect(publicExports[name], name).toBe(deferredExports[name]);
    }
  });

  it('renders every startup icon as SVG without changing its component contract', () => {
    for (const [name, Icon] of Object.entries(StartupIcons)) {
      const markup = renderToStaticMarkup(
        React.createElement(
          Icon as React.ComponentType<React.SVGProps<SVGSVGElement>>,
          {
            'aria-label': name,
          }
        )
      );

      expect(markup, name).toMatch(/^<svg\b/);
      expect(markup, name).toContain(`aria-label="${name}"`);
    }
  });

  it('preserves Lucide-compatible presentation props on migrated startup icons', () => {
    const strokedMarkup = renderToStaticMarkup(
      <StartupIcons.Music4Icon size={18} strokeWidth={1.75} />
    );
    const filledMarkup = renderToStaticMarkup(
      <StartupIcons.PlayIcon
        size={28}
        fill="currentColor"
        strokeWidth={0}
        className="audio-node__artwork-icon"
      />
    );

    expect(strokedMarkup).toContain('width="18"');
    expect(strokedMarkup).toContain('height="18"');
    expect(strokedMarkup).toContain('stroke-width="1.75"');
    expect(filledMarkup).toContain('width="28"');
    expect(filledMarkup).toContain('fill="currentColor"');
    expect(filledMarkup).toContain('stroke-width="0"');
    expect(filledMarkup).toContain('class="audio-node__artwork-icon"');
  });
});
