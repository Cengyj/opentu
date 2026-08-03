import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { OutputBundle } from 'rollup';
import {
  ONLY_EXPLICIT_MANUAL_CHUNKS,
  STARTUP_MODULE_PRELOAD_ENABLED,
  collectHtmlShellPrecacheUrls,
  collectIdlePrefetchGroupEntriesFromBundle,
  compactProductionIndexHtml,
  resolveDeferredProjectDrawerPanelChunk,
  resolveIdlePrefetchGroup,
  resolveStartupSourceChunk,
  resolveStartupVendorChunk,
  shouldIncludeHtmlShellPrecacheUrl,
} from './vite.config';
import { IDLE_PREFETCH_DEFAULTS } from './src/startup-prefetch-config';

describe('production index HTML compaction', () => {
  it('removes transport-only indentation while preserving sensitive content', () => {
    const source = [
      '<html>',
      '  <style>',
      '    .shell { color: red; }',
      '  </style>',
      '  <script>',
      '    window.ready = true;',
      '  </script>',
      '  <script>',
      '    window.template = `  significant`;',
      '  </script>',
      '  <pre>',
      '    significant preformatted text',
      '  </pre>',
      '  <textarea>',
      '    significant form value',
      '  </textarea>',
      '</html>',
    ].join('\n');

    const compacted = compactProductionIndexHtml(source);

    expect(compacted).toContain('\n<style>\n.shell { color: red; }');
    expect(compacted).toContain('\n<script>\nwindow.ready = true;');
    expect(compacted).toContain(
      '<script>\n    window.template = `  significant`;\n  </script>'
    );
    expect(compacted).toContain(
      '<pre>\n    significant preformatted text\n  </pre>'
    );
    expect(compacted).toContain(
      '<textarea>\n    significant form value\n  </textarea>'
    );
  });
});

describe('startup vendor chunk boundaries', () => {
  it.each([
    ['react', 'framework-runtime'],
    ['rxjs', 'framework-runtime'],
    ['tslib', 'framework-runtime'],
    ['lodash-es', 'framework-runtime'],
    ['@plait/core', 'canvas-plait'],
    ['@plait/common', 'canvas-plait'],
    ['@plait/draw', 'canvas-plait'],
    ['@plait/mind', 'canvas-plait'],
    ['slate-react', 'canvas-slate'],
  ])('places %s in %s', (packageName, expectedChunk) => {
    const encodedPackage = packageName.replace('/', '+');

    expect(
      resolveStartupVendorChunk(
        `/workspace/node_modules/.pnpm/${encodedPackage}@1.0.0/node_modules/${packageName}/index.js`
      )
    ).toBe(expectedChunk);
  });

  it.each([
    ['tdesign-react', 'ui-tdesign'],
    ['tdesign-icons-react', 'ui-icons'],
  ])(
    'places startup-reachable %s modules in %s',
    (packageName, expectedChunk) => {
      const encodedPackage = packageName.replace('/', '+');
      const vendorId = `/workspace/node_modules/.pnpm/${encodedPackage}@1.0.0/node_modules/${packageName}/index.js`;
      const startupImporter =
        '/workspace/packages/drawnix/src/components/view-navigation/ViewNavigation.tsx';
      const appEntry = '/workspace/packages/drawnix/src/app.ts';
      const importersById = new Map([
        [vendorId, [startupImporter]],
        [startupImporter, [appEntry]],
      ]);

      expect(
        resolveStartupVendorChunk(vendorId, {
          getModuleInfo: (id) => ({ importers: importersById.get(id) ?? [] }),
        })
      ).toBe(expectedChunk);
    }
  );

  it.each(['tdesign-react', 'tdesign-icons-react'])(
    'leaves deferred-only %s modules with their feature closure',
    (packageName) => {
      const encodedPackage = packageName.replace('/', '+');
      const vendorId = `/workspace/node_modules/.pnpm/${encodedPackage}@1.0.0/node_modules/${packageName}/index.js`;
      const deferredImporter =
        '/workspace/packages/drawnix/src/components/settings-dialog/settings-dialog.tsx';

      expect(
        resolveStartupVendorChunk(vendorId, {
          getModuleInfo: (id) => ({
            importers: id === vendorId ? [deferredImporter] : [],
          }),
        })
      ).toBeUndefined();
    }
  );

  it('treats the deferred AI input shell as a startup root without pulling in its runtime', () => {
    const vendorId =
      '/workspace/node_modules/.pnpm/tdesign-react@1.0.0/node_modules/tdesign-react/es/loading/index.js';
    const shellEntry =
      '/workspace/packages/drawnix/src/components/startup/DeferredAIInputBar.tsx';

    expect(
      resolveStartupVendorChunk(vendorId, {
        getModuleInfo: (id) => ({
          importers: id === vendorId ? [shellEntry] : [],
        }),
      })
    ).toBe('ui-tdesign');
  });

  it('does not classify source modules or similarly named packages', () => {
    expect(
      resolveStartupVendorChunk('/workspace/packages/drawnix/src/drawnix.tsx')
    ).toBeUndefined();
    expect(
      resolveStartupVendorChunk(
        '/workspace/node_modules/.pnpm/@plait-board+mermaid-to-drawnix@0.0.7/node_modules/@plait-board/mermaid-to-drawnix/index.js'
      )
    ).toBeUndefined();
  });

  it('does not make the root TDesign compatibility shim load global or unrelated component styles', () => {
    const shimSource = fs.readFileSync(
      path.resolve(__dirname, '../../packages/drawnix/src/utils/tdesign.ts'),
      'utf8'
    );

    expect(shimSource).not.toMatch(/^import ['"]tdesign-react\/es\//m);
    expect(shimSource).not.toContain('tdesign-react/es/style/css');
    expect(shimSource).not.toContain('/style/css');
  });
});

describe('startup source chunk boundaries', () => {
  it('places local startup SVG implementations in the existing icon chunk', () => {
    expect(
      resolveStartupSourceChunk(
        '/workspace/packages/drawnix/src/components/icons/startup-icons.tsx'
      )
    ).toBe('ui-icons');
  });

  it('keeps the AI input event contract with the initial Drawnix shell', () => {
    expect(
      resolveStartupSourceChunk(
        '/workspace/packages/drawnix/src/services/ai-input-ui-events.ts'
      )
    ).toBe('drawnix-app');
  });

  it('does not classify adjacent services by name or directory', () => {
    expect(
      resolveStartupSourceChunk(
        '/workspace/packages/drawnix/src/services/generation-api-service.ts'
      )
    ).toBeUndefined();
    expect(
      resolveStartupSourceChunk(
        '/workspace/packages/drawnix/src/components/ai-input-ui-events.ts'
      )
    ).toBeUndefined();
    expect(
      resolveStartupSourceChunk(
        '/workspace/packages/drawnix/src/components/icons/deferred-icons.tsx'
      )
    ).toBeUndefined();
  });
});

describe('deferred feature chunk boundaries', () => {
  it('preloads only dependencies discovered in the active import graph', () => {
    expect(STARTUP_MODULE_PRELOAD_ENABLED).toBe(true);
  });

  it('keeps normal startup free of implicit deferred-group prefetch', () => {
    expect(IDLE_PREFETCH_DEFAULTS).toEqual([]);
  });

  it('keeps named deferred groups explicit instead of absorbing shared dependencies', () => {
    expect(ONLY_EXPLICIT_MANUAL_CHUNKS).toBe(true);
    expect(
      resolveIdlePrefetchGroup(
        '/workspace/packages/drawnix/src/components/chat-drawer/ChatDrawer.tsx'
      )
    ).toBe('ai-chat');
    expect(
      resolveIdlePrefetchGroup(
        '/workspace/packages/drawnix/src/services/asset-storage-service.ts'
      )
    ).toBeUndefined();
    expect(
      resolveIdlePrefetchGroup(
        '/workspace/packages/drawnix/src/types/chat.types.ts'
      )
    ).toBeUndefined();
    expect(
      resolveIdlePrefetchGroup(
        '/workspace/packages/drawnix/src/components/MarkdownEditor/index.tsx'
      )
    ).toBe('editor-engines');
    expect(
      resolveIdlePrefetchGroup(
        '/workspace/packages/drawnix/src/components/knowledge-base/KnowledgeBaseContent.tsx'
      )
    ).toBe('editor-engines');
  });

  it('keeps the PPT image operation runtime out of the startup entry proxy', () => {
    expect(
      resolveIdlePrefetchGroup(
        '/workspace/packages/drawnix/src/plugins/components/ppt-image-placeholder-runtime.ts'
      )
    ).toBe('tool-windows');
  });

  it('does not defer the lightweight PPT placeholder controller', () => {
    expect(
      resolveIdlePrefetchGroup(
        '/workspace/packages/drawnix/src/plugins/components/ppt-image-placeholder-controller.ts'
      )
    ).toBeUndefined();
  });

  it('keeps independently activated project panels out of the broad tool window chunk', () => {
    const framePanel =
      '/workspace/packages/drawnix/src/components/project-drawer/FramePanel.tsx';
    const frameDialog =
      '/workspace/packages/drawnix/src/components/project-drawer/AddFrameDialog.tsx';
    const frameSlideshow =
      '/workspace/packages/drawnix/src/components/project-drawer/FrameSlideshow.tsx';
    const layerPanel =
      '/workspace/packages/drawnix/src/components/project-drawer/LayerPanel.tsx';

    expect(resolveDeferredProjectDrawerPanelChunk(framePanel)).toBe(
      'project-frame-panel'
    );
    expect(resolveDeferredProjectDrawerPanelChunk(frameDialog)).toBe(
      'project-frame-panel'
    );
    expect(resolveDeferredProjectDrawerPanelChunk(frameSlideshow)).toBe(
      'project-frame-panel'
    );
    expect(resolveDeferredProjectDrawerPanelChunk(layerPanel)).toBe(
      'project-layer-panel'
    );
    expect(resolveIdlePrefetchGroup(framePanel)).toBeUndefined();
    expect(resolveIdlePrefetchGroup(layerPanel)).toBeUndefined();
    expect(
      resolveDeferredProjectDrawerPanelChunk(
        '/workspace/packages/drawnix/src/components/project-drawer/ProjectDrawer.tsx'
      )
    ).toBeUndefined();
    expect(
      resolveIdlePrefetchGroup(
        '/workspace/packages/drawnix/src/components/project-drawer/ProjectDrawer.tsx'
      )
    ).toBe('tool-windows');
  });

  it('collects only static dependencies of an explicitly requested prefetch group', () => {
    const createChunk = ({
      fileName,
      moduleId,
      imports = [],
      dynamicImports = [],
    }: {
      fileName: string;
      moduleId: string;
      imports?: string[];
      dynamicImports?: string[];
    }) => ({
      type: 'chunk' as const,
      fileName,
      name: fileName,
      code: `export const id = ${JSON.stringify(fileName)};`,
      modules: { [moduleId]: {} },
      facadeModuleId: moduleId,
      imports,
      dynamicImports,
      referencedFiles: [],
      exports: [],
      implicitlyLoadedBefore: [],
      importedBindings: {},
      isDynamicEntry: false,
      isEntry: false,
      isImplicitEntry: false,
      map: null,
      moduleIds: [moduleId],
      preliminaryFileName: fileName,
      sourcemapFileName: null,
      viteMetadata: { importedCss: new Set<string>() },
    });
    const bundle = {
      'assets/ai-chat-root.js': createChunk({
        fileName: 'assets/ai-chat-root.js',
        moduleId:
          '/workspace/packages/drawnix/src/components/chat-drawer/ChatDrawer.tsx',
        imports: ['assets/shared-static.js'],
        dynamicImports: ['assets/optional-later-action.js'],
      }),
      'assets/shared-static.js': createChunk({
        fileName: 'assets/shared-static.js',
        moduleId: '/workspace/packages/drawnix/src/shared-static.ts',
      }),
      'assets/optional-later-action.js': createChunk({
        fileName: 'assets/optional-later-action.js',
        moduleId: '/workspace/packages/drawnix/src/optional-later-action.ts',
      }),
    };

    const entries = collectIdlePrefetchGroupEntriesFromBundle(
      bundle as unknown as OutputBundle,
      'ai-chat'
    );

    expect(entries.map((entry) => entry.url)).toEqual([
      '/assets/ai-chat-root.js',
      '/assets/shared-static.js',
    ]);
  });
});

describe('precache shell boundary', () => {
  it('derives the compact referenced favicon and excludes the legacy ICO', async () => {
    const urls = await collectHtmlShellPrecacheUrls(
      path.resolve(__dirname, 'index.html')
    );

    expect(urls.has('/icons/favicon-32x32.png')).toBe(true);
    expect(urls.has('/favicon.ico')).toBe(false);
    expect(shouldIncludeHtmlShellPrecacheUrl('/icons/favicon-32x32.png')).toBe(
      true
    );
    expect(shouldIncludeHtmlShellPrecacheUrl('/favicon.ico')).toBe(true);
  });
});
