import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  collectDynamicImportRecords,
  collectRequiredStartupGraph,
  collectStaticImports,
  parseViteDependencyTable,
  validateIdlePrefetchDefaults,
} = require('./startup-bundle-analyzer.cjs');

function createVirtualAssetReader(assets) {
  return (asset) => assets.get(asset) ?? null;
}

describe('Vite startup dependency metadata', () => {
  it('parses the dependency table emitted by the current Vite build', () => {
    const source =
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./drawnix-app.css","./ai-chat.css"])))=>i.map(i=>d[i]);';

    expect(parseViteDependencyTable(source)).toEqual([
      './drawnix-app.css',
      './ai-chat.css',
    ]);
  });

  it('associates mapped CSS after an export-selection .then with the exact dynamic import', () => {
    const source = [
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./drawnix-app.css","./ai-chat.css"])))=>i.map(i=>d[i]);',
      'const Drawnix=lazy(()=>preload(()=>import("./drawnix-app-ABC.js").then(module=>module.Drawnix),__vite__mapDeps([0]),import.meta.url));',
      'const Chat=()=>import("./ai-chat-DEF.js");',
    ].join('');

    expect(
      collectDynamicImportRecords(source, 'assets/bootstrap-ABC.js')
    ).toEqual([
      {
        asset: 'assets/drawnix-app-ABC.js',
        mappedDependencies: ['assets/drawnix-app.css'],
      },
      {
        asset: 'assets/ai-chat-DEF.js',
        mappedDependencies: [],
      },
    ]);
  });

  it('does not steal a later import mapping when an earlier import has no preload metadata', () => {
    const source = [
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./deferred.css"])))=>i.map(i=>d[i]);',
      'const first=()=>import("./first.js");',
      'const second=()=>preload(()=>import("./second.js"),__vite__mapDeps([0]),import.meta.url);',
    ].join('');

    expect(collectDynamicImportRecords(source, 'assets/entry.js')).toEqual([
      { asset: 'assets/first.js', mappedDependencies: [] },
      {
        asset: 'assets/second.js',
        mappedDependencies: ['assets/deferred.css'],
      },
    ]);
  });

  it('fails closed when mapped dependency indexes do not exist', () => {
    const source = [
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./only.css"])))=>i.map(i=>d[i]);',
      'preload(()=>import("./drawnix-app.js"),__vite__mapDeps([1]),import.meta.url);',
    ].join('');

    expect(() =>
      collectDynamicImportRecords(source, 'assets/bootstrap.js')
    ).toThrow('__vite__mapDeps 索引越界');
  });
});

describe('required startup graph', () => {
  it('keeps every recursive static import without sharing regex cursor state', () => {
    const assets = new Map([
      ['assets/entry.js', 'import "./first.js"; import "./second.js";'],
      ['assets/first.js', 'import "./first-child.js";'],
      ['assets/first-child.js', 'export const firstChild=true;'],
      ['assets/second.js', 'export const second=true;'],
    ]);

    expect(
      Array.from(
        collectStaticImports(
          'assets/entry.js',
          createVirtualAssetReader(assets)
        )
      ).sort()
    ).toEqual([
      'assets/entry.js',
      'assets/first-child.js',
      'assets/first.js',
      'assets/second.js',
    ]);
  });

  it('counts startup-app, bootstrap, lazy Drawnix and only their exact mapped CSS', () => {
    const assets = new Map([
      [
        'assets/index-ENTRY.js',
        [
          'import "./startup-runtime-RUNTIME.js";',
          'preload(()=>import("./startup-app-START.js"),[],import.meta.url);',
        ].join(''),
      ],
      ['assets/startup-runtime-RUNTIME.js', 'export const preload=true;'],
      [
        'assets/startup-app-START.js',
        [
          'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./bootstrap.css","./not-startup.css"])))=>i.map(i=>d[i]);',
          'import "./startup-runtime-RUNTIME.js";',
          'preload(()=>import("./bootstrap-BOOT.js").then(module=>module.bootstrap),__vite__mapDeps([0]),import.meta.url);',
        ].join(''),
      ],
      [
        'assets/bootstrap-BOOT.js',
        [
          'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./drawnix-app.css","./ai-chat.css"])))=>i.map(i=>d[i]);',
          'import "./react-vendor.js";',
          'const Drawnix=lazy(()=>preload(()=>import("./drawnix-app-DRAW.js").then(module=>module.Drawnix),__vite__mapDeps([0]),import.meta.url));',
        ].join(''),
      ],
      ['assets/react-vendor.js', 'export const React=true;'],
      [
        'assets/drawnix-app-DRAW.js',
        'import "./plait-vendor.js"; const chat=()=>import("./ai-chat-LAZY.js");',
      ],
      ['assets/plait-vendor.js', 'export const Plait=true;'],
      ['assets/ai-chat-LAZY.js', 'export const Chat=true;'],
    ]);

    const graph = collectRequiredStartupGraph({
      entryAssets: ['assets/index-ENTRY.js'],
      readAsset: createVirtualAssetReader(assets),
      requiredDynamicPrefixes: ['startup-app-', 'bootstrap-', 'drawnix-app-'],
    });

    expect(Array.from(graph).sort()).toEqual([
      'assets/bootstrap-BOOT.js',
      'assets/bootstrap.css',
      'assets/drawnix-app-DRAW.js',
      'assets/drawnix-app.css',
      'assets/index-ENTRY.js',
      'assets/plait-vendor.js',
      'assets/react-vendor.js',
      'assets/startup-app-START.js',
      'assets/startup-runtime-RUNTIME.js',
    ]);
    expect(graph.has('assets/ai-chat-LAZY.js')).toBe(false);
    expect(graph.has('assets/ai-chat.css')).toBe(false);
    expect(graph.has('assets/not-startup.css')).toBe(false);
  });

  it('counts only the unconditional Drawnix AI shell, not activation-gated siblings or AI runtime', () => {
    const assets = new Map([
      [
        'assets/drawnix-app-DRAW.js',
        [
          'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./popup.css","./link.css","./pencil.css","./pen.css","./clean.css","./quick.css","./auto.css","./deferred-ai.css","./deferred-features.css"])))=>i.map(i=>d[i]);',
          'lazy(()=>preload(()=>import("./popup-toolbar-POP.js"),__vite__mapDeps([0]),import.meta.url));',
          'lazy(()=>preload(()=>import("./link-popup-LINK.js"),__vite__mapDeps([1]),import.meta.url));',
          'lazy(()=>preload(()=>import("./index-PENCIL.js"),__vite__mapDeps([2]),import.meta.url));',
          'lazy(()=>preload(()=>import("./index-PENCIL.js"),__vite__mapDeps([2]),import.meta.url));',
          'lazy(()=>preload(()=>import("./index-PEN.js"),__vite__mapDeps([3]),import.meta.url));',
          'lazy(()=>preload(()=>import("./clean-confirm-CLEAN.js"),__vite__mapDeps([4]),import.meta.url));',
          'lazy(()=>preload(()=>import("./quick-creation-toolbar-QUICK.js"),__vite__mapDeps([5]),import.meta.url));',
          'lazy(()=>preload(()=>import("./index-AUTO.js"),__vite__mapDeps([6]),import.meta.url));',
          'lazy(()=>preload(()=>import("./DeferredAIInputBar-SHELL.js"),__vite__mapDeps([7]),import.meta.url));',
          'lazy(()=>preload(()=>import("./DrawnixDeferredFeatures-LATE.js"),__vite__mapDeps([8]),import.meta.url));',
        ].join(''),
      ],
      ['assets/popup-toolbar-POP.js', 'export const popup=true;'],
      ['assets/link-popup-LINK.js', 'export const link=true;'],
      ['assets/index-PENCIL.js', 'export const pencil=true;'],
      ['assets/index-PEN.js', 'export const pen=true;'],
      ['assets/clean-confirm-CLEAN.js', 'export const clean=true;'],
      [
        'assets/DeferredAIInputBar-SHELL.js',
        [
          'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./AIInputBarRuntime.css"])))=>i.map(i=>d[i]);',
          'const activate=()=>preload(()=>import("./AIInputBarRuntime-RUNTIME.js"),__vite__mapDeps([0]),import.meta.url);',
        ].join(''),
      ],
      ['assets/AIInputBarRuntime-RUNTIME.js', 'export const runtime=true;'],
      ['assets/quick-creation-toolbar-QUICK.js', 'export const quick=true;'],
      ['assets/index-AUTO.js', 'export const auto=true;'],
      ['assets/DrawnixDeferredFeatures-LATE.js', 'export const deferred=true;'],
    ]);

    const graph = collectRequiredStartupGraph({
      entryAssets: ['assets/drawnix-app-DRAW.js'],
      readAsset: createVirtualAssetReader(assets),
      requiredDynamicPrefixes: [],
      requiredDynamicRootRules: [
        {
          parentPrefix: 'drawnix-app-',
          assetPrefix: 'DeferredAIInputBar-',
          expectedMatches: 1,
        },
      ],
    });

    expect(Array.from(graph).sort()).toEqual([
      'assets/DeferredAIInputBar-SHELL.js',
      'assets/deferred-ai.css',
      'assets/drawnix-app-DRAW.js',
    ]);
    expect(graph.has('assets/popup-toolbar-POP.js')).toBe(false);
    expect(graph.has('assets/popup.css')).toBe(false);
    expect(graph.has('assets/link-popup-LINK.js')).toBe(false);
    expect(graph.has('assets/link.css')).toBe(false);
    expect(graph.has('assets/index-PENCIL.js')).toBe(false);
    expect(graph.has('assets/pencil.css')).toBe(false);
    expect(graph.has('assets/index-PEN.js')).toBe(false);
    expect(graph.has('assets/pen.css')).toBe(false);
    expect(graph.has('assets/clean-confirm-CLEAN.js')).toBe(false);
    expect(graph.has('assets/clean.css')).toBe(false);
    expect(graph.has('assets/AIInputBarRuntime-RUNTIME.js')).toBe(false);
    expect(graph.has('assets/AIInputBarRuntime.css')).toBe(false);
    expect(graph.has('assets/quick-creation-toolbar-QUICK.js')).toBe(false);
    expect(graph.has('assets/quick.css')).toBe(false);
    expect(graph.has('assets/index-AUTO.js')).toBe(false);
    expect(graph.has('assets/auto.css')).toBe(false);
    expect(graph.has('assets/DrawnixDeferredFeatures-LATE.js')).toBe(false);
    expect(graph.has('assets/deferred-features.css')).toBe(false);
  });

  it('fails closed when the required Drawnix AI shell root is renamed or missing', () => {
    const assets = new Map([
      [
        'assets/drawnix-app-DRAW.js',
        [
          'lazy(()=>import("./popup-toolbar-POP.js"));',
          'lazy(()=>import("./renamed-ai-shell.js"));',
        ].join(''),
      ],
    ]);

    expect(() =>
      collectRequiredStartupGraph({
        entryAssets: ['assets/drawnix-app-DRAW.js'],
        readAsset: createVirtualAssetReader(assets),
        requiredDynamicPrefixes: [],
        requiredDynamicRootRules: [
          {
            parentPrefix: 'drawnix-app-',
            assetPrefix: 'DeferredAIInputBar-',
            expectedMatches: 1,
          },
        ],
      })
    ).toThrow('必须包含 1 个 DeferredAIInputBar- 首屏动态根');
  });
});

describe('idle prefetch defaults contract', () => {
  it('accepts only an explicitly present empty defaults array', () => {
    expect(validateIdlePrefetchDefaults({ defaults: [], groups: {} })).toEqual(
      []
    );
    expect(() => validateIdlePrefetchDefaults({ groups: {} })).toThrow(
      '缺少 defaults 数组'
    );
    expect(() =>
      validateIdlePrefetchDefaults({ defaults: '', groups: {} })
    ).toThrow('defaults 必须是数组');
    expect(() =>
      validateIdlePrefetchDefaults({ defaults: ['ai-chat'], groups: {} })
    ).toThrow('启动默认预取分组必须为空');
  });
});
