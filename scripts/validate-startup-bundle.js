const fs = require('fs');
const path = require('path');
const {
  collectRequiredStartupGraph,
  collectStaticImportAssets,
  validateIdlePrefetchDefaults,
} = require('./startup-bundle-analyzer.cjs');

const DIST_DIR = path.resolve(__dirname, '../dist/apps/web');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const IDLE_MANIFEST = path.join(DIST_DIR, 'idle-prefetch-manifest.json');
const DISALLOWED_PREFIXES = [
  'ai-chat-',
  'diagram-engines-',
  'tool-windows-',
  'external-skills-',
];
const MAX_STARTUP_ASSET_BYTES = 500 * 1024;
const MAX_STARTUP_GRAPH_BYTES = 2_000_000;
const REQUIRED_STARTUP_DYNAMIC_PREFIXES = [
  'startup-app-',
  'bootstrap-',
  'drawnix-app-',
];
// Drawnix 首次渲染会无条件挂载 AI 输入轻壳；完整 AIInputBarRuntime 仅在
// focus/input/prefill 后由轻壳加载，因此不能作为首屏根。
const REQUIRED_STARTUP_DYNAMIC_ROOT_RULES = [
  {
    parentPrefix: 'drawnix-app-',
    assetPrefix: 'DeferredAIInputBar-',
    expectedMatches: 1,
  },
];
// These roots are mounted automatically after the canvas becomes interactive.
// They may perform lightweight checks, but must not pull feature groups before
// a matching update, memory-pressure condition, or user action exists.
const AUTOMATIC_DEFERRED_ROOT_PREFIXES = ['DrawnixOperationalMonitors-'];

function fail(message) {
  console.error(`[startup-validate] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(INDEX_HTML)) {
  fail('dist/apps/web/index.html 不存在，请先构建 web 应用');
}

const html = fs.readFileSync(INDEX_HTML, 'utf8');
const scriptMatches = Array.from(
  html.matchAll(/<script[^>]+src="\.\/([^"]+)"[^>]*><\/script>/g)
).map((match) => match[1]);
const styleMatches = Array.from(
  html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"]+)"[^>]*>/g)
).map((match) => match[1]);

const directAssets = [...scriptMatches, ...styleMatches].filter((asset) =>
  asset.startsWith('assets/')
);

if (directAssets.length === 0) {
  fail('入口 HTML 没有直接引用任何 assets 资源');
}

const directScriptAssets = scriptMatches.filter((asset) =>
  asset.startsWith('assets/')
);

// 运行时分组样式允许直接注入 HTML，避免首次展示时额外请求 CSS。
// 这里仅阻止分组 JS 重新回流到首屏入口链。
const invalidDirectAssets = directScriptAssets.filter((asset) =>
  DISALLOWED_PREFIXES.some((prefix) => path.basename(asset).startsWith(prefix))
);

if (invalidDirectAssets.length > 0) {
  fail(`重模块重新回流到入口 HTML：${invalidDirectAssets.join(', ')}`);
}

if (!fs.existsSync(IDLE_MANIFEST)) {
  fail('idle-prefetch-manifest.json 不存在，请检查构建产物生成流程');
}

let idleManifest;
try {
  idleManifest = JSON.parse(fs.readFileSync(IDLE_MANIFEST, 'utf8'));
  validateIdlePrefetchDefaults(idleManifest);
} catch (error) {
  fail(
    `idle-prefetch-manifest.json 无效：${
      error instanceof Error ? error.message : String(error)
    }`
  );
}

function readAssetSource(entryAsset) {
  const fullPath = path.join(DIST_DIR, entryAsset);
  if (!fs.existsSync(fullPath) || !entryAsset.endsWith('.js')) {
    return null;
  }

  return fs.readFileSync(fullPath, 'utf8');
}

function collectStaticImportAssetsForFile(entryAsset) {
  const source = readAssetSource(entryAsset);
  return source === null
    ? new Set()
    : collectStaticImportAssets(source, entryAsset);
}

function collectJsAssets() {
  const assetsDir = path.join(DIST_DIR, 'assets');
  if (!fs.existsSync(assetsDir)) {
    return [];
  }

  return fs
    .readdirSync(assetsDir)
    .filter((fileName) => fileName.endsWith('.js'))
    .map((fileName) => path.posix.join('assets', fileName));
}

function buildStaticChunkGraph() {
  const jsAssets = collectJsAssets();
  const jsAssetSet = new Set(jsAssets);
  const graph = new Map();

  for (const asset of jsAssets) {
    const imports = Array.from(collectStaticImportAssetsForFile(asset)).filter(
      (importedAsset) => jsAssetSet.has(importedAsset)
    );
    graph.set(asset, imports);
  }

  return graph;
}

function findStronglyConnectedComponents(graph) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indexes = new Map();
  const lowlinks = new Map();
  const components = [];

  function visit(node) {
    indexes.set(node, index);
    lowlinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of graph.get(node) || []) {
      if (!graph.has(next)) {
        continue;
      }

      if (!indexes.has(next)) {
        visit(next);
        lowlinks.set(node, Math.min(lowlinks.get(node), lowlinks.get(next)));
      } else if (onStack.has(next)) {
        lowlinks.set(node, Math.min(lowlinks.get(node), indexes.get(next)));
      }
    }

    if (lowlinks.get(node) === indexes.get(node)) {
      const component = [];
      let current;

      do {
        current = stack.pop();
        onStack.delete(current);
        component.push(current);
      } while (current !== node);

      if (component.length > 1) {
        components.push(component.sort());
      }
    }
  }

  for (const node of graph.keys()) {
    if (!indexes.has(node)) {
      visit(node);
    }
  }

  return components.sort((a, b) => b.length - a.length);
}

const entryScripts = scriptMatches.filter(
  (asset) => asset.startsWith('assets/') && asset.endsWith('.js')
);

let entryDependencyGraph;
try {
  entryDependencyGraph = collectRequiredStartupGraph({
    entryAssets: entryScripts,
    readAsset: readAssetSource,
    requiredDynamicPrefixes: REQUIRED_STARTUP_DYNAMIC_PREFIXES,
    requiredDynamicRootRules: REQUIRED_STARTUP_DYNAMIC_ROOT_RULES,
  });
} catch (error) {
  fail(
    `无法解析首屏依赖图：${
      error instanceof Error ? error.message : String(error)
    }`
  );
}

const invalidStaticDeps = Array.from(entryDependencyGraph).filter(
  (asset) =>
    asset !== undefined &&
    asset.endsWith('.js') &&
    DISALLOWED_PREFIXES.some((prefix) =>
      path.basename(asset).startsWith(prefix)
    )
);

if (invalidStaticDeps.length > 0) {
  fail(`重模块重新回流到入口依赖链：${invalidStaticDeps.join(', ')}`);
}

const jsAssets = collectJsAssets();
const automaticDeferredGraphs = {};
for (const rootPrefix of AUTOMATIC_DEFERRED_ROOT_PREFIXES) {
  const matchingRoots = jsAssets.filter((asset) =>
    path.basename(asset).startsWith(rootPrefix)
  );
  if (matchingRoots.length !== 1) {
    fail(
      `必须存在唯一自动延后根 ${rootPrefix}，实际为 ${matchingRoots.length}`
    );
  }

  const graph = collectRequiredStartupGraph({
    entryAssets: matchingRoots,
    readAsset: readAssetSource,
  });
  const invalidAssets = Array.from(graph).filter(
    (asset) =>
      asset.endsWith('.js') &&
      DISALLOWED_PREFIXES.some((prefix) =>
        path.basename(asset).startsWith(prefix)
      )
  );
  if (invalidAssets.length > 0) {
    fail(
      `自动延后根 ${rootPrefix} 静态依赖重模块：${invalidAssets.join(', ')}`
    );
  }
  automaticDeferredGraphs[rootPrefix] = Array.from(graph).sort();
}

const chunkCycles = findStronglyConnectedComponents(buildStaticChunkGraph());
if (chunkCycles.length > 0) {
  const formattedCycles = chunkCycles
    .map((component, index) => `#${index + 1}: ${component.join(' -> ')}`)
    .join('\n');
  fail(`构建产物存在静态 chunk 循环依赖：\n${formattedCycles}`);
}

const startupAssetGraph = new Set([...directAssets, ...entryDependencyGraph]);
const missingStartupAssets = Array.from(startupAssetGraph).filter(
  (asset) => !fs.existsSync(path.join(DIST_DIR, asset))
);
if (missingStartupAssets.length > 0) {
  fail(`首屏依赖图引用不存在的资源：${missingStartupAssets.join(', ')}`);
}

const startupBudgetReport = Array.from(startupAssetGraph)
  .filter((asset) => asset && (asset.endsWith('.js') || asset.endsWith('.css')))
  .map((asset) => {
    const fullPath = path.join(DIST_DIR, asset);
    const size = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
    return {
      asset,
      size,
      limit: MAX_STARTUP_ASSET_BYTES,
      ok: size <= MAX_STARTUP_ASSET_BYTES,
    };
  })
  .sort((a, b) => b.size - a.size);

const oversizedStartupAssets = startupBudgetReport.filter((item) => !item.ok);
if (oversizedStartupAssets.length > 0) {
  fail(
    `首屏依赖链存在超过 500KB 的资源：\n${oversizedStartupAssets
      .map(
        ({ asset, size, limit }) => `- ${asset}: ${size} bytes > ${limit} bytes`
      )
      .join('\n')}`
  );
}

const startupGraphBytes = startupBudgetReport.reduce(
  (total, item) => total + item.size,
  0
);

if (startupGraphBytes > MAX_STARTUP_GRAPH_BYTES) {
  fail(
    `首屏依赖图总大小超过预算：${startupGraphBytes} bytes > ${MAX_STARTUP_GRAPH_BYTES} bytes`
  );
}

const sizeReport = directAssets.map((asset) => {
  const fullPath = path.join(DIST_DIR, asset);
  const size = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
  return {
    asset,
    size,
  };
});

console.log(
  JSON.stringify(
    {
      directAssets: sizeReport,
      entryDependencyGraph: Array.from(entryDependencyGraph).sort(),
      startupBudget: startupBudgetReport,
      startupGraphBytes,
      startupGraphLimit: MAX_STARTUP_GRAPH_BYTES,
      automaticDeferredGraphs,
      chunkCycles: [],
      idlePrefetchGroups: Object.keys(idleManifest.groups || {}),
      idlePrefetchDefaults: idleManifest.defaults,
    },
    null,
    2
  )
);
