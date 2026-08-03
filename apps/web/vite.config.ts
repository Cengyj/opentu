/// <reference types='vitest' />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { visualizer } from 'rollup-plugin-visualizer';
import {
  IDLE_PREFETCH_DEFAULTS,
  IDLE_PREFETCH_GROUPS,
  type IdlePrefetchGroup,
} from './src/startup-prefetch-config';

const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(__dirname, '../..');
const { resolveReleaseManifest } =
  require('../../scripts/release-identity.cjs') as {
    resolveReleaseManifest: (
      manifest: Record<string, unknown>,
      env?: NodeJS.ProcessEnv
    ) => { version: string; releaseId: string };
  };

const shouldRewriteEntryAssetsToCDN =
  process.env.AITU_REWRITE_ENTRY_ASSETS_TO_CDN === '1';

// Read version from public/version.json
const versionPath = path.resolve(__dirname, 'public/version.json');
let appVersion = '0.0.0';
let appReleaseId = '0.0.0-local';

try {
  if (fs.existsSync(versionPath)) {
    const versionContent = fs.readFileSync(versionPath, 'utf-8');
    const versionJson = JSON.parse(versionContent);
    const identity = resolveReleaseManifest(versionJson);
    appVersion = identity.version;
    appReleaseId = identity.releaseId;
  } else {
    console.warn('[Vite] version.json not found at', versionPath);
  }
} catch (e) {
  console.error('[Vite] Failed to read version.json', e);
}

function releaseIdentityHtmlPlugin(): Plugin {
  return {
    name: 'release-identity-html',
    transformIndexHtml(html) {
      const replaceOrInsertMeta = (
        source: string,
        name: string,
        content: string
      ): string => {
        const pattern = new RegExp(
          `<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*/?>`,
          'i'
        );
        const tag = `<meta name="${name}" content="${content}" />`;
        return pattern.test(source)
          ? source.replace(pattern, tag)
          : source.replace('</head>', `  ${tag}\n  </head>`);
      };

      return replaceOrInsertMeta(
        replaceOrInsertMeta(html, 'app-version', appVersion),
        'app-release-id',
        appReleaseId
      );
    },
  };
}

const INDEX_HTML_RAW_BLOCK_PATTERN =
  /<(script|style|pre|textarea)\b[\s\S]*?<\/\1>/gi;

function stripLineIndentation(source: string): string {
  return source.replace(/^[ \t]+/gm, '');
}

/**
 * Vite leaves the large inline boot contract formatted in production HTML.
 * Strip indentation without making the maintained source unreadable. Content
 * whose leading whitespace is observable stays byte-for-byte intact.
 */
export function compactProductionIndexHtml(html: string): string {
  let compacted = '';
  let cursor = 0;

  for (const match of html.matchAll(INDEX_HTML_RAW_BLOCK_PATTERN)) {
    const block = match[0];
    const tagName = match[1].toLowerCase();
    const blockStart = match.index ?? cursor;

    compacted += stripLineIndentation(html.slice(cursor, blockStart));
    compacted +=
      tagName === 'pre' ||
      tagName === 'textarea' ||
      (tagName === 'script' && block.includes('`'))
        ? block
        : stripLineIndentation(block);
    cursor = blockStart + block.length;
  }

  return compacted + stripLineIndentation(html.slice(cursor));
}

// Rollup 4 otherwise folds the dependency closure of a named manual chunk into
// that chunk. Deferred feature groups must own only modules explicitly assigned
// by resolveManualChunk so shared runtime modules remain independently loadable.
export const ONLY_EXPLICIT_MANUAL_CHUNKS = true;
export const STARTUP_MODULE_PRELOAD_ENABLED = true;

type ManifestEntry = { url: string; revision: string };
type ViteOutputChunk = OutputChunk & {
  viteMetadata?: {
    importedCss?: Set<string>;
  };
};

const STATIC_SCAN_EXCLUDED_DIRS = new Set([
  'product_showcase',
  'help_tooltips',
  'sw-debug',
]);

const STATIC_SCAN_EXCLUDED_PATTERNS = [
  /stats\.html$/,
  /\.map$/,
  /precache-manifest\.json$/,
  /idle-prefetch-manifest\.json$/,
  /sw\.js$/,
  /sw-debug\.html$/,
  /changelog\.json$/,
  /version\.json$/,
];

const PRECACHE_EXTENSIONS = new Set([
  '.js',
  '.css',
  '.json',
  '.svg',
  '.png',
  '.ico',
]);
const POST_BOOT_PREFETCH_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.wasm',
  '.txt',
  '.md',
]);
const PRECACHE_ALWAYS_INCLUDE = new Set(['/index.html', '/manifest.json']);

function isFileDescriptorLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'EMFILE' ||
      (error as NodeJS.ErrnoException).code === 'ENFILE')
  );
}

function waitForFileDescriptorRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 120 * (attempt + 1));
  });
}

async function readFileWithFdRetry(
  fullPath: string,
  encoding?: BufferEncoding
): Promise<string | Buffer> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return encoding
        ? await fs.promises.readFile(fullPath, encoding)
        : await fs.promises.readFile(fullPath);
    } catch (error) {
      lastError = error;
      if (!isFileDescriptorLimitError(error) || attempt === 5) {
        throw error;
      }
      await waitForFileDescriptorRetry(attempt);
    }
  }

  throw lastError;
}

async function writeFileWithFdRetry(
  fullPath: string,
  content: string
): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.promises.writeFile(fullPath, content);
      return;
    } catch (error) {
      if (!isFileDescriptorLimitError(error) || attempt === 5) {
        throw error;
      }
      await waitForFileDescriptorRetry(attempt);
    }
  }
}

function createRevision(fullPath: string): string {
  const content = fs.readFileSync(fullPath);
  return crypto
    .createHash('md5')
    .update(new Uint8Array(content))
    .digest('hex')
    .substring(0, 8);
}

async function createRevisionWithFdRetry(fullPath: string): Promise<string> {
  const content = await readFileWithFdRetry(fullPath);
  return crypto
    .createHash('md5')
    .update(new Uint8Array(content as Buffer))
    .digest('hex')
    .substring(0, 8);
}

function createContentRevision(content: string | Uint8Array): string {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

function createBundleFileRevision(file: OutputAsset | OutputChunk): string {
  if (file.type === 'asset') {
    const source = file.source ?? '';
    return createContentRevision(
      typeof source === 'string' || source instanceof Uint8Array
        ? source
        : String(source)
    );
  }

  return createContentRevision(file.code);
}

function shouldExcludeStaticScanUrl(url: string): boolean {
  return STATIC_SCAN_EXCLUDED_PATTERNS.some((pattern) => pattern.test(url));
}

function isRuntimeStaticAssetUrl(url: string): boolean {
  // 仅覆盖构建产物中的运行时附属资源，避免把手册截图等大文件带进默认 idle 预取。
  return url.startsWith('/assets/');
}

function collectStaticEntries(
  outDir: string,
  shouldInclude: (url: string, ext: string) => boolean
): ManifestEntry[] {
  const manifest: ManifestEntry[] = [];

  function scanDir(dir: string, base = '') {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(base, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!STATIC_SCAN_EXCLUDED_DIRS.has(entry.name)) {
          scanDir(fullPath, relativePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      const url = '/' + relativePath;

      if (shouldExcludeStaticScanUrl(url) || !shouldInclude(url, ext)) {
        continue;
      }

      manifest.push({
        url,
        revision: createRevision(fullPath),
      });
    }
  }

  scanDir(outDir);
  manifest.sort((a, b) => a.url.localeCompare(b.url));
  return manifest;
}

function normalizeStaticUrlCandidate(candidate: string): string | null {
  if (!candidate) {
    return null;
  }

  if (
    candidate.startsWith('http://') ||
    candidate.startsWith('https://') ||
    candidate.startsWith('data:') ||
    candidate.startsWith('blob:')
  ) {
    return null;
  }

  const [withoutQuery] = candidate.split(/[?#]/, 1);
  if (!withoutQuery) {
    return null;
  }

  if (withoutQuery.startsWith('./')) {
    return `/${withoutQuery.slice(2)}`;
  }

  if (withoutQuery.startsWith('/')) {
    return withoutQuery;
  }

  return `/${withoutQuery}`;
}

async function collectSelectedEntries(
  outDir: string,
  urls: Iterable<string>,
  shouldInclude: (url: string, ext: string) => boolean
): Promise<ManifestEntry[]> {
  const manifest: ManifestEntry[] = [];
  const normalizedUrls = new Set<string>();

  for (const url of urls) {
    const normalizedUrl = normalizeStaticUrlCandidate(url);
    if (!normalizedUrl) {
      continue;
    }

    normalizedUrls.add(normalizedUrl);
  }

  for (const url of normalizedUrls) {
    const ext = path.extname(url).toLowerCase();
    if (shouldExcludeStaticScanUrl(url) || !shouldInclude(url, ext)) {
      continue;
    }

    const fullPath = path.join(outDir, url.replace(/^\//, ''));
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      continue;
    }

    manifest.push({
      url,
      revision: await createRevisionWithFdRetry(fullPath),
    });
  }

  manifest.sort((a, b) => a.url.localeCompare(b.url));
  return manifest;
}

export async function collectHtmlShellPrecacheUrls(
  indexHtmlPath: string
): Promise<Set<string>> {
  const urls = new Set<string>(PRECACHE_ALWAYS_INCLUDE);

  if (!fs.existsSync(indexHtmlPath)) {
    return urls;
  }

  const html = (await readFileWithFdRetry(indexHtmlPath, 'utf8')) as string;
  const attrPattern = /\b(?:data-local-(?:src|href)|src|href)="([^"]+)"/g;

  for (const match of html.matchAll(attrPattern)) {
    const normalizedUrl = normalizeStaticUrlCandidate(match[1]);
    if (normalizedUrl) {
      urls.add(normalizedUrl);
    }
  }

  return urls;
}

export function shouldIncludeHtmlShellPrecacheUrl(
  url: string,
  ext = path.extname(url).toLowerCase()
): boolean {
  return (
    PRECACHE_ALWAYS_INCLUDE.has(url) ||
    (ext !== '.html' && PRECACHE_EXTENSIONS.has(ext))
  );
}

function normalizePathForChunking(id: string): string {
  return id.replace(/\\/g, '/');
}

function resolveNodeModulePackageName(id: string): string | undefined {
  const normalizedId = normalizePathForChunking(id).replace(/^\0/, '');
  const nodeModulesMarker = '/node_modules/';
  const packageStart = normalizedId.lastIndexOf(nodeModulesMarker);

  if (packageStart === -1) {
    return undefined;
  }

  const packagePath = normalizedId.slice(
    packageStart + nodeModulesMarker.length
  );
  const [firstSegment, secondSegment] = packagePath.split('/');

  if (!firstSegment || firstSegment === '.pnpm') {
    return undefined;
  }

  if (firstSegment.startsWith('@')) {
    return secondSegment ? `${firstSegment}/${secondSegment}` : undefined;
  }

  return firstSegment;
}

const FRAMEWORK_RUNTIME_PACKAGES = new Set([
  '@babel/runtime',
  'immer',
  'is-hotkey',
  'lodash-es',
  'react',
  'react-dom',
  'react-is',
  'rxjs',
  'scheduler',
  'tslib',
  'use-sync-external-store',
]);

const PLAIT_RUNTIME_PACKAGES = new Set([
  '@plait/common',
  '@plait/core',
  '@plait/draw',
  '@plait/layouts',
  '@plait/mind',
  '@plait/text-plugins',
  'hachure-fill',
  'path-data-parser',
  'points-on-curve',
  'points-on-path',
  'roughjs',
]);

const SLATE_PACKAGES = new Set([
  '@juggle/resize-observer',
  'compute-scroll-into-view',
  'direction',
  'lodash',
  'scroll-into-view-if-needed',
  'slate',
  'slate-dom',
  'slate-history',
  'slate-react',
]);

const TDESIGN_RUNTIME_PACKAGES = new Set([
  '@floating-ui/core',
  '@floating-ui/dom',
  '@floating-ui/react',
  '@floating-ui/react-dom',
  '@floating-ui/utils',
  '@popperjs/core',
  'classnames',
  'dayjs',
  'dom-helpers',
  'hoist-non-react-statics',
  'performance-now',
  'prop-types',
  'raf',
  'react-fast-compare',
  'react-transition-group',
  'tabbable',
  'tdesign-react',
]);

const UI_ICON_PACKAGES = new Set(['lucide-react', 'tdesign-icons-react']);

/**
 * Keep the unavoidable canvas framework in a small number of stable domain
 * chunks. Packages shared by bootstrap and Drawnix deliberately live outside
 * the Plait chunk so a lightweight bootstrap import cannot pull the canvas
 * engine back into the entry chunk.
 */
export function resolveStartupVendorChunk(
  id: string,
  context?: ManualChunkContext
): string | undefined {
  const packageName = resolveNodeModulePackageName(id);
  if (!packageName) {
    return undefined;
  }

  if (FRAMEWORK_RUNTIME_PACKAGES.has(packageName)) {
    return 'framework-runtime';
  }
  if (PLAIT_RUNTIME_PACKAGES.has(packageName)) {
    return 'canvas-plait';
  }
  if (SLATE_PACKAGES.has(packageName)) {
    return 'canvas-slate';
  }

  // TDesign and icon packages are also used by deferred drawers, dialogs and
  // tools. Assigning every module in those packages to a shared startup chunk
  // makes one shell component pull the deferred components into the entry
  // graph. Only name UI vendor modules that are statically reachable from an
  // actual startup shell root; Rollup can keep the remaining modules with the
  // deferred feature that owns them.
  const isStartupShellDependency =
    context &&
    isStaticallyReachableFromEntry(
      id,
      isStartupShellEntry,
      context.getModuleInfo
    );

  if (TDESIGN_RUNTIME_PACKAGES.has(packageName) && isStartupShellDependency) {
    return 'ui-tdesign';
  }
  if (UI_ICON_PACKAGES.has(packageName) && isStartupShellDependency) {
    return 'ui-icons';
  }

  return undefined;
}

/**
 * Small source contracts used by the initial Drawnix shell must not be owned by
 * whichever deferred feature happens to import them most often. Otherwise
 * Rollup can place the contract in that deferred chunk and make the shell load
 * the entire feature graph just to read a constant.
 */
export function resolveStartupSourceChunk(id: string): string | undefined {
  const normalizedId = normalizePathForChunking(id);
  if (
    normalizedId.endsWith(
      '/packages/drawnix/src/components/icons/startup-icons.tsx'
    )
  ) {
    // Keep the shell's local SVG implementations with the existing icon
    // vendor request. This preserves one request while preventing shared icon
    // markup from inflating the Drawnix application chunk.
    return 'ui-icons';
  }

  if (
    normalizedId.endsWith(
      '/packages/drawnix/src/services/ai-input-ui-events.ts'
    )
  ) {
    return 'drawnix-app';
  }

  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findPackageRoot(entryPath: string): string {
  let current = fs.statSync(entryPath).isDirectory()
    ? entryPath
    : path.dirname(entryPath);

  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }

    current = path.dirname(current);
  }

  throw new Error(`Unable to resolve package root for ${entryPath}`);
}

function resolvePackageRoot(packageName: string, fromPaths: string[]): string {
  return findPackageRoot(require.resolve(packageName, { paths: fromPaths }));
}

function createPackageRootAlias(packageName: string, packageRoot: string) {
  const escapedName = escapeRegExp(packageName);

  return [
    { find: new RegExp(`^${escapedName}$`), replacement: packageRoot },
    {
      find: new RegExp(`^${escapedName}/(.+)$`),
      replacement: `${packageRoot}/$1`,
    },
  ];
}

const mermaidToDrawnixPackageRoot = resolvePackageRoot(
  '@plait-board/mermaid-to-drawnix',
  [workspaceRoot]
);
const diagramEngineAliases = [
  ...createPackageRootAlias(
    'mermaid',
    resolvePackageRoot('mermaid', [mermaidToDrawnixPackageRoot])
  ),
];

function normalizeBundleFileName(fileName: string): string {
  return normalizePathForChunking(fileName).replace(/^\.\//, '');
}

function toManifestUrl(fileName: string): string {
  const normalizedFileName = normalizeBundleFileName(fileName);
  return normalizedFileName.startsWith('/')
    ? normalizedFileName
    : `/${normalizedFileName}`;
}

function shouldIncludeIdlePrefetchBundleFile(fileName: string): boolean {
  const normalizedFileName = normalizeBundleFileName(fileName).toLowerCase();
  return (
    normalizedFileName.endsWith('.js') || normalizedFileName.endsWith('.css')
  );
}

function isNamedIdlePrefetchGroupFile(
  fileName: string,
  group: IdlePrefetchGroup
): boolean {
  const baseName = path.posix
    .basename(normalizeBundleFileName(fileName))
    .toLowerCase();
  return baseName.startsWith(`${group.toLowerCase()}-`);
}

function getNamedIdlePrefetchGroupForFile(
  fileName: string
): IdlePrefetchGroup | undefined {
  return IDLE_PREFETCH_GROUPS.find((group) =>
    isNamedIdlePrefetchGroupFile(fileName, group)
  );
}

function collectNamedGroupEntriesFromOutputDir(
  assetsDir: string,
  group: IdlePrefetchGroup
): ManifestEntry[] {
  if (!fs.existsSync(assetsDir)) {
    return [];
  }

  const files = fs.readdirSync(assetsDir);
  const entries: ManifestEntry[] = [];

  for (const file of files) {
    const normalizedFileName = normalizeBundleFileName(file);
    if (
      !isNamedIdlePrefetchGroupFile(normalizedFileName, group) ||
      !shouldIncludeIdlePrefetchBundleFile(normalizedFileName)
    ) {
      continue;
    }

    const fullPath = path.join(assetsDir, file);
    entries.push({
      url: toManifestUrl(path.posix.join('assets', normalizedFileName)),
      revision: createRevision(fullPath),
    });
  }

  entries.sort((a, b) => a.url.localeCompare(b.url));
  return entries;
}

function chunkBelongsToIdlePrefetchGroup(
  chunk: ViteOutputChunk,
  group: IdlePrefetchGroup
): boolean {
  if (isNamedIdlePrefetchGroupFile(chunk.fileName, group)) {
    return true;
  }

  const moduleIds = [chunk.facadeModuleId, ...Object.keys(chunk.modules)];
  return moduleIds.some(
    (moduleId) =>
      typeof moduleId === 'string' &&
      resolveIdlePrefetchGroup(moduleId) === group
  );
}

export function collectIdlePrefetchGroupEntriesFromBundle(
  bundle: OutputBundle,
  group: IdlePrefetchGroup
): ManifestEntry[] {
  if (group === 'runtime-static-assets' || group === 'offline-static-assets') {
    return [];
  }

  const chunksByFileName = new Map<string, ViteOutputChunk>();
  const assetsByFileName = new Map<string, OutputAsset>();

  for (const output of Object.values(bundle)) {
    const normalizedFileName = normalizeBundleFileName(output.fileName);

    if (output.type === 'chunk') {
      chunksByFileName.set(normalizedFileName, output as ViteOutputChunk);
      continue;
    }

    assetsByFileName.set(normalizedFileName, output);
  }

  const pendingChunkFileNames = Array.from(chunksByFileName.values())
    .filter((chunk) => chunkBelongsToIdlePrefetchGroup(chunk, group))
    .map((chunk) => normalizeBundleFileName(chunk.fileName));

  if (pendingChunkFileNames.length === 0) {
    return [];
  }

  const visitedChunkFileNames = new Set<string>();
  const pendingCssFileNames = new Set<string>();
  const entriesByUrl = new Map<string, ManifestEntry>();

  const addBundleEntry = (file: OutputAsset | OutputChunk) => {
    if (!shouldIncludeIdlePrefetchBundleFile(file.fileName)) {
      return;
    }

    const entry = {
      url: toManifestUrl(file.fileName),
      revision: createBundleFileRevision(file),
    };
    entriesByUrl.set(entry.url, entry);
  };

  while (pendingChunkFileNames.length > 0) {
    const currentFileName = pendingChunkFileNames.pop();
    if (!currentFileName || visitedChunkFileNames.has(currentFileName)) {
      continue;
    }

    visitedChunkFileNames.add(currentFileName);

    const chunk = chunksByFileName.get(currentFileName);
    if (!chunk) {
      continue;
    }

    addBundleEntry(chunk);

    chunk.viteMetadata?.importedCss?.forEach((cssFileName) => {
      pendingCssFileNames.add(normalizeBundleFileName(cssFileName));
    });

    chunk.referencedFiles.forEach((referencedFileName) => {
      const normalizedReferencedFileName =
        normalizeBundleFileName(referencedFileName);
      if (normalizedReferencedFileName.toLowerCase().endsWith('.css')) {
        pendingCssFileNames.add(normalizedReferencedFileName);
      }
    });

    // A group prefetch prepares the code needed to evaluate its explicit
    // entry chunks. Nested dynamic imports represent later user actions and
    // must remain demand-driven; traversing them here made every broad group
    // absorb hundreds of unrelated optional chunks.
    for (const importedFileName of chunk.imports) {
      const normalizedImportedFileName =
        normalizeBundleFileName(importedFileName);
      const importedGroup = getNamedIdlePrefetchGroupForFile(
        normalizedImportedFileName
      );

      if (importedGroup && importedGroup !== group) {
        continue;
      }

      if (!visitedChunkFileNames.has(normalizedImportedFileName)) {
        pendingChunkFileNames.push(normalizedImportedFileName);
      }
    }
  }

  for (const cssFileName of pendingCssFileNames) {
    const cssAsset = assetsByFileName.get(cssFileName);
    if (cssAsset) {
      addBundleEntry(cssAsset);
    }
  }

  for (const asset of assetsByFileName.values()) {
    if (
      isNamedIdlePrefetchGroupFile(asset.fileName, group) &&
      asset.fileName.toLowerCase().endsWith('.css')
    ) {
      addBundleEntry(asset);
    }
  }

  return Array.from(entriesByUrl.values()).sort((a, b) =>
    a.url.localeCompare(b.url)
  );
}

export function resolveDeferredProjectDrawerPanelChunk(
  id: string
): 'project-frame-panel' | 'project-layer-panel' | undefined {
  const normalizedId = normalizePathForChunking(id);

  if (
    normalizedId.endsWith(
      '/packages/drawnix/src/components/project-drawer/FramePanel.tsx'
    ) ||
    normalizedId.endsWith(
      '/packages/drawnix/src/components/project-drawer/AddFrameDialog.tsx'
    ) ||
    normalizedId.endsWith(
      '/packages/drawnix/src/components/project-drawer/FrameSlideshow.tsx'
    )
  ) {
    return 'project-frame-panel';
  }

  if (
    normalizedId.endsWith(
      '/packages/drawnix/src/components/project-drawer/LayerPanel.tsx'
    )
  ) {
    return 'project-layer-panel';
  }

  return undefined;
}

export function resolveIdlePrefetchGroup(
  id: string
): IdlePrefetchGroup | undefined {
  const normalizedId = normalizePathForChunking(id);

  // Frame and layer panels have independent dynamic entry points. Keep them
  // out of the broad tool-windows prefetch group so opening the default boards
  // tab cannot eagerly download either panel.
  if (resolveDeferredProjectDrawerPanelChunk(normalizedId)) {
    return undefined;
  }

  if (
    normalizedId.includes('/packages/drawnix/src/components/chat-drawer/') ||
    normalizedId.includes('/packages/drawnix/src/hooks/useChatHandler') ||
    normalizedId.includes('/packages/drawnix/src/services/chat-service') ||
    normalizedId.includes('/packages/drawnix/src/services/chat-storage-service')
  ) {
    return 'ai-chat';
  }

  if (
    normalizedId.includes('/node_modules/.pnpm/mermaid@') ||
    normalizedId.includes('/node_modules/mermaid/') ||
    normalizedId.includes('/node_modules/.pnpm/elkjs@') ||
    normalizedId.includes('/node_modules/elkjs/') ||
    normalizedId.includes('/node_modules/.pnpm/cytoscape@') ||
    normalizedId.includes('/node_modules/cytoscape/') ||
    normalizedId.includes('/node_modules/.pnpm/layout-base@') ||
    normalizedId.includes('/node_modules/layout-base/') ||
    normalizedId.includes('/node_modules/.pnpm/cose-base@') ||
    normalizedId.includes('/node_modules/cose-base/') ||
    normalizedId.includes('/node_modules/.pnpm/cytoscape-cose-bilkent@') ||
    normalizedId.includes('/node_modules/cytoscape-cose-bilkent/') ||
    normalizedId.includes('/node_modules/.pnpm/dagre-d3-es@') ||
    normalizedId.includes('/node_modules/dagre-d3-es/') ||
    normalizedId.includes('/node_modules/.pnpm/dompurify@') ||
    normalizedId.includes('/node_modules/dompurify/')
  ) {
    return 'diagram-engines';
  }

  if (
    normalizedId.includes('/node_modules/.pnpm/xlsx@') ||
    normalizedId.includes('/node_modules/xlsx/') ||
    normalizedId.includes('/node_modules/.pnpm/jszip@') ||
    normalizedId.includes('/node_modules/jszip/') ||
    normalizedId.includes('/node_modules/.pnpm/pptxgenjs@') ||
    normalizedId.includes('/node_modules/pptxgenjs/')
  ) {
    return 'office-data';
  }

  if (
    normalizedId.includes('/node_modules/.pnpm/@milkdown+') ||
    normalizedId.includes('/node_modules/@milkdown/') ||
    normalizedId.includes('/node_modules/.pnpm/codemirror@') ||
    normalizedId.includes('/node_modules/codemirror/') ||
    normalizedId.includes('/node_modules/.pnpm/@codemirror+') ||
    normalizedId.includes('/node_modules/@codemirror/') ||
    normalizedId.includes('/node_modules/.pnpm/@lezer+') ||
    normalizedId.includes('/node_modules/@lezer/') ||
    normalizedId.includes('/node_modules/.pnpm/prosemirror-') ||
    normalizedId.includes('/node_modules/prosemirror-') ||
    normalizedId.includes('/node_modules/.pnpm/katex@') ||
    normalizedId.includes('/node_modules/katex/') ||
    normalizedId.includes('/packages/drawnix/src/components/MarkdownEditor/') ||
    normalizedId.includes('/packages/drawnix/src/components/knowledge-base/') ||
    normalizedId.includes(
      '/packages/drawnix/src/services/kb-knowledge-extraction/'
    )
  ) {
    return 'editor-engines';
  }

  if (
    normalizedId.includes('/node_modules/.pnpm/viewerjs@') ||
    normalizedId.includes('/node_modules/viewerjs/')
  ) {
    return 'media-viewer';
  }

  if (normalizedId.includes('/packages/drawnix/src/tools/tool-ids.ts')) {
    return undefined;
  }

  if (
    normalizedId.includes(
      '/packages/drawnix/src/components/startup/DrawnixDeferredRuntime.tsx'
    ) ||
    normalizedId.includes(
      '/packages/drawnix/src/components/startup/DeferredMediaLibraryModal.tsx'
    ) ||
    normalizedId.includes(
      '/packages/drawnix/src/components/startup/DeferredSyncSettings.tsx'
    ) ||
    normalizedId.endsWith(
      '/packages/drawnix/src/plugins/components/ppt-image-placeholder-runtime.ts'
    ) ||
    normalizedId.includes(
      '/packages/drawnix/src/services/asset-integration-service'
    ) ||
    normalizedId.includes(
      '/packages/drawnix/src/services/font-manager-service'
    ) ||
    normalizedId.includes('/packages/drawnix/src/hooks/useTaskStorage') ||
    normalizedId.includes('/packages/drawnix/src/hooks/useTaskExecutor') ||
    normalizedId.includes(
      '/packages/drawnix/src/hooks/useAutoInsertToCanvas'
    ) ||
    normalizedId.includes(
      '/packages/drawnix/src/hooks/useImageGenerationAnchorSync'
    ) ||
    normalizedId.includes('/packages/drawnix/src/hooks/useBeforeUnload') ||
    normalizedId.includes('/packages/drawnix/src/hooks/useProviderProfiles') ||
    normalizedId.includes('/packages/drawnix/src/components/toolbox-drawer/') ||
    normalizedId.includes('/packages/drawnix/src/components/project-drawer/') ||
    normalizedId.includes(
      '/packages/drawnix/src/components/toolbar/minimized-tools-bar/'
    ) ||
    normalizedId.includes(
      '/packages/drawnix/src/services/tool-window-service'
    ) ||
    normalizedId.includes('/packages/drawnix/src/services/toolbox-service') ||
    normalizedId.includes('/packages/drawnix/src/tools/') ||
    normalizedId.includes('/packages/drawnix/src/components/backup-restore/') ||
    normalizedId.includes(
      '/packages/drawnix/src/components/performance-panel/'
    ) ||
    normalizedId.includes('/packages/drawnix/src/components/version-update/') ||
    normalizedId.includes(
      '/packages/drawnix/src/components/command-palette/'
    ) ||
    normalizedId.includes('/packages/drawnix/src/components/canvas-search/')
  ) {
    return 'tool-windows';
  }

  if (
    normalizedId.includes(
      '/packages/drawnix/src/generated/external-skills-bundle.json'
    )
  ) {
    return 'external-skills';
  }

  return undefined;
}

function isStartupRuntimeModule(id: string): boolean {
  const normalizedId = normalizePathForChunking(id);
  return (
    normalizedId.includes('vite/preload-helper') ||
    normalizedId.includes('commonjs-dynamic-modules') ||
    normalizedId.includes('commonjsHelpers')
  );
}

interface ManualChunkModuleInfo {
  importers: string[];
}

interface ManualChunkContext {
  getModuleInfo: (id: string) => ManualChunkModuleInfo | null;
}

function isWebMainEntry(id: string): boolean {
  const normalizedId = normalizePathForChunking(id);
  return (
    normalizedId.endsWith('/apps/web/src/main.tsx') ||
    normalizedId.endsWith('/src/main.tsx')
  );
}

function isWebBootstrapEntry(id: string): boolean {
  const normalizedId = normalizePathForChunking(id);
  return (
    normalizedId.endsWith('/apps/web/src/app/bootstrap.tsx') ||
    normalizedId.endsWith('/src/app/bootstrap.tsx')
  );
}

function isDrawnixAppEntry(id: string): boolean {
  const normalizedId = normalizePathForChunking(id);
  return normalizedId.endsWith('/packages/drawnix/src/app.ts');
}

function isDeferredAIInputBarEntry(id: string): boolean {
  const normalizedId = normalizePathForChunking(id);
  return normalizedId.endsWith(
    '/packages/drawnix/src/components/startup/DeferredAIInputBar.tsx'
  );
}

function isStartupShellEntry(id: string): boolean {
  return (
    isWebMainEntry(id) ||
    isWebBootstrapEntry(id) ||
    isDrawnixAppEntry(id) ||
    isDeferredAIInputBarEntry(id)
  );
}

function isStaticallyReachableFromEntry(
  id: string,
  isEntry: (candidateId: string) => boolean,
  getModuleInfo: ManualChunkContext['getModuleInfo'],
  visited = new Set<string>()
): boolean {
  if (visited.has(id)) {
    return false;
  }
  visited.add(id);

  if (isEntry(id)) {
    return true;
  }

  const moduleInfo = getModuleInfo(id);
  if (!moduleInfo) {
    return false;
  }

  return moduleInfo.importers.some((importerId) =>
    isStaticallyReachableFromEntry(importerId, isEntry, getModuleInfo, visited)
  );
}

function resolveManualChunk(
  id: string,
  context?: ManualChunkContext
): string | undefined {
  if (isStartupRuntimeModule(id)) {
    return 'startup-runtime';
  }

  const vendorChunk = resolveStartupVendorChunk(id, context);
  if (vendorChunk) {
    return vendorChunk;
  }

  const startupSourceChunk = resolveStartupSourceChunk(id);
  if (startupSourceChunk) {
    return startupSourceChunk;
  }

  const deferredProjectDrawerPanelChunk =
    resolveDeferredProjectDrawerPanelChunk(id);
  if (deferredProjectDrawerPanelChunk) {
    return deferredProjectDrawerPanelChunk;
  }

  const group = resolveIdlePrefetchGroup(id);
  if (
    (group === undefined || group === 'tool-windows') &&
    context &&
    isStaticallyReachableFromEntry(id, isWebMainEntry, context.getModuleInfo)
  ) {
    return 'startup-app';
  }

  if (
    (group === undefined || group === 'tool-windows') &&
    context &&
    isStaticallyReachableFromEntry(
      id,
      isWebBootstrapEntry,
      context.getModuleInfo
    )
  ) {
    return 'bootstrap';
  }

  if (
    (group === undefined || group === 'tool-windows') &&
    context &&
    isStaticallyReachableFromEntry(id, isDrawnixAppEntry, context.getModuleInfo)
  ) {
    return 'drawnix-app';
  }

  return group;
}

/**
 * Vite 插件：生成 precache-manifest.json
 * 在构建完成后扫描输出目录，生成需要预缓存的静态资源清单
 */
function precacheManifestPlugin(): Plugin {
  return {
    name: 'precache-manifest',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const outDir = path.resolve(__dirname, '../../dist/apps/web');
        const indexHtmlPath = path.join(outDir, 'index.html');
        const precacheUrls = await collectHtmlShellPrecacheUrls(indexHtmlPath);
        const manifest = await collectSelectedEntries(
          outDir,
          precacheUrls,
          shouldIncludeHtmlShellPrecacheUrl
        );

        // 写入 manifest 文件
        const manifestPath = path.join(outDir, 'precache-manifest.json');
        const manifestContent = {
          version: appVersion,
          releaseId: appReleaseId,
          timestamp: new Date().toISOString(),
          files: manifest,
        };

        await writeFileWithFdRetry(
          manifestPath,
          JSON.stringify(manifestContent, null, 2)
        );
        console.log(
          `[Precache] Generated manifest with ${manifest.length} files`
        );
      },
    },
  };
}

function idlePrefetchManifestPlugin(): Plugin {
  let bundleGroupEntries = Object.fromEntries(
    IDLE_PREFETCH_GROUPS.map((group) => [group, [] as ManifestEntry[]])
  ) as Record<IdlePrefetchGroup, ManifestEntry[]>;

  return {
    name: 'idle-prefetch-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      bundleGroupEntries = Object.fromEntries(
        IDLE_PREFETCH_GROUPS.map((group) => [
          group,
          collectIdlePrefetchGroupEntriesFromBundle(bundle, group),
        ])
      ) as Record<IdlePrefetchGroup, ManifestEntry[]>;
    },
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const outDir = path.resolve(__dirname, '../../dist/apps/web');
        const assetsDir = path.join(outDir, 'assets');
        const precacheManifestPath = path.join(
          outDir,
          'precache-manifest.json'
        );
        const groups = Object.fromEntries(
          IDLE_PREFETCH_GROUPS.map((group) => [
            group,
            [] as Array<{ url: string; revision: string }>,
          ])
        ) as Record<
          IdlePrefetchGroup,
          Array<{ url: string; revision: string }>
        >;
        const precachedUrls = new Set<string>();

        if (fs.existsSync(precacheManifestPath)) {
          try {
            const precacheManifest = JSON.parse(
              (await readFileWithFdRetry(
                precacheManifestPath,
                'utf8'
              )) as string
            ) as { files?: Array<{ url?: string }> };
            for (const entry of precacheManifest.files || []) {
              if (typeof entry.url === 'string' && entry.url.length > 0) {
                precachedUrls.add(entry.url);
              }
            }
          } catch (error) {
            console.warn(
              '[IdlePrefetch] Failed to read precache-manifest.json:',
              error
            );
          }
        }

        if (fs.existsSync(assetsDir)) {
          for (const group of IDLE_PREFETCH_GROUPS) {
            if (group === 'offline-static-assets') {
              continue;
            }

            const expandedEntries =
              bundleGroupEntries[group].length > 0
                ? bundleGroupEntries[group]
                : collectNamedGroupEntriesFromOutputDir(assetsDir, group);

            groups[group] = expandedEntries.filter((entry) => {
              const fullPath = path.join(outDir, entry.url.replace(/^\//, ''));
              return fs.existsSync(fullPath) && !precachedUrls.has(entry.url);
            });
          }
        }

        groups['runtime-static-assets'] = collectStaticEntries(
          outDir,
          (url, ext) =>
            !precachedUrls.has(url) &&
            ext !== '.html' &&
            POST_BOOT_PREFETCH_EXTENSIONS.has(ext) &&
            isRuntimeStaticAssetUrl(url)
        );

        const runtimeStaticUrls = new Set(
          groups['runtime-static-assets'].map((entry) => entry.url)
        );

        groups['offline-static-assets'] = collectStaticEntries(
          outDir,
          (url, ext) =>
            !precachedUrls.has(url) &&
            !runtimeStaticUrls.has(url) &&
            ext !== '.html' &&
            POST_BOOT_PREFETCH_EXTENSIONS.has(ext)
        );

        const manifestPath = path.join(outDir, 'idle-prefetch-manifest.json');
        fs.writeFileSync(
          manifestPath,
          JSON.stringify({
            version: appVersion,
            releaseId: appReleaseId,
            timestamp: new Date().toISOString(),
            defaults: [...IDLE_PREFETCH_DEFAULTS],
            groups,
          })
        );
        console.log('[IdlePrefetch] Generated idle-prefetch-manifest.json');
      },
    },
  };
}

function deferEntryAssetsPlugin(): Plugin {
  return {
    name: 'defer-entry-assets',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const outDir = path.resolve(__dirname, '../../dist/apps/web');
        const indexHtmlPath = path.join(outDir, 'index.html');

        if (!fs.existsSync(indexHtmlPath)) {
          return;
        }

        const html = (await readFileWithFdRetry(
          indexHtmlPath,
          'utf8'
        )) as string;
        const deferredTags: string[] = [];
        const assetTagPattern =
          /^[ \t]*(<script\b[^>]*type="module"[^>]*src="\.\/assets\/[^"]+"[^>]*><\/script>|<link\b[^>]*rel="stylesheet"[^>]*href="\.\/assets\/[^"]+"[^>]*>)\s*$/gm;

        const strippedHtml = html.replace(assetTagPattern, (match, tag) => {
          deferredTags.push(tag.trim());
          return '';
        });

        if (deferredTags.length === 0) {
          return;
        }

        const injection = `  ${deferredTags.join('\n  ')}\n`;
        const nextHtml = strippedHtml.replace('</body>', `${injection}</body>`);

        await writeFileWithFdRetry(indexHtmlPath, nextHtml);
        console.log(
          `[EntryAssets] Deferred ${deferredTags.length} entry asset tag(s) to body end`
        );
      },
    },
  };
}

function compactProductionIndexHtmlPlugin(): Plugin {
  return {
    name: 'compact-production-index-html',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const indexHtmlPath = path.resolve(
          __dirname,
          '../../dist/apps/web/index.html'
        );
        if (!fs.existsSync(indexHtmlPath)) {
          return;
        }

        const html = (await readFileWithFdRetry(
          indexHtmlPath,
          'utf8'
        )) as string;
        const compactedHtml = compactProductionIndexHtml(html);
        if (compactedHtml === html) {
          return;
        }

        await writeFileWithFdRetry(indexHtmlPath, compactedHtml);
        console.log(
          `[IndexHtml] Removed ${
            Buffer.byteLength(html) - Buffer.byteLength(compactedHtml)
          } bytes of production indentation`
        );
      },
    },
  };
}

function rewriteEntryAssetsToCDNPlugin(): Plugin {
  return {
    name: 'rewrite-entry-assets-to-cdn',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const outDir = path.resolve(__dirname, '../../dist/apps/web');
        const indexHtmlPath = path.join(outDir, 'index.html');

        if (!fs.existsSync(indexHtmlPath)) {
          return;
        }

        if (!shouldRewriteEntryAssetsToCDN) {
          console.log(
            '[EntryAssets] Keeping entry asset tags local because AITU_REWRITE_ENTRY_ASSETS_TO_CDN is not 1'
          );
          return;
        }

        const html = (await readFileWithFdRetry(
          indexHtmlPath,
          'utf8'
        )) as string;
        const cdnBaseUrl = `https://cdn.jsdelivr.net/npm/aitu-app@${appVersion}`;
        let rewrittenCount = 0;

        const rewriteAssetUrl = (localPath: string) => {
          const [pathname, suffix = ''] = localPath.split(/([?#].*)/, 2);
          return `${cdnBaseUrl}/${pathname.replace(/^\.\//, '')}${suffix}`;
        };

        const rewriteManagedLinkTag = (
          beforeHref: string,
          localHref: string,
          afterHref: string
        ) => {
          const hasSelfClosingSlash = /\/\s*$/.test(afterHref);
          const normalizedAfterHref = afterHref.replace(/\/\s*$/, '');
          rewrittenCount += 1;
          return `<link${beforeHref}href="${rewriteAssetUrl(
            localHref
          )}" data-local-href="${localHref}" data-cdn-fallback-managed="1"${normalizedAfterHref} onerror="window.__OPENTU_BOOT_ASSET_FALLBACK__&&window.__OPENTU_BOOT_ASSET_FALLBACK__(this)"${
            hasSelfClosingSlash ? ' /' : ''
          }>`;
        };

        let nextHtml = html.replace(
          /<script\b([^>]*\btype="module"[^>]*)\bsrc="(\.\/assets\/[^"]+)"([^>]*)><\/script>/g,
          (_match, beforeSrc, localSrc, afterSrc) => {
            rewrittenCount += 1;
            return `<script${beforeSrc}src="${rewriteAssetUrl(
              localSrc
            )}" data-local-src="${localSrc}" data-cdn-fallback-managed="1"${afterSrc} onerror="window.__OPENTU_BOOT_ASSET_FALLBACK__&&window.__OPENTU_BOOT_ASSET_FALLBACK__(this)"></script>`;
          }
        );

        nextHtml = nextHtml.replace(
          /<link\b([^>]*\brel="stylesheet"[^>]*)\bhref="(\.\/assets\/[^"]+)"([^>]*)>/g,
          (_match, beforeHref, localHref, afterHref) =>
            rewriteManagedLinkTag(beforeHref, localHref, afterHref)
        );

        nextHtml = nextHtml.replace(
          /<link\b([^>]*\brel="(?:manifest|icon|apple-touch-icon)"[^>]*)\bhref="(\.\/[^"]+)"([^>]*)>/g,
          (_match, beforeHref, localHref, afterHref) =>
            rewriteManagedLinkTag(beforeHref, localHref, afterHref)
        );

        if (rewrittenCount === 0) {
          return;
        }

        await writeFileWithFdRetry(indexHtmlPath, nextHtml);
        console.log(
          `[EntryAssets] Rewrote ${rewrittenCount} entry asset tag(s) to prefer CDN`
        );
      },
    },
  };
}

function rewriteManifestAssetsToCDNPlugin(): Plugin {
  return {
    name: 'rewrite-manifest-assets-to-cdn',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        const outDir = path.resolve(__dirname, '../../dist/apps/web');
        const manifestPath = path.join(outDir, 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
          return;
        }

        if (!shouldRewriteEntryAssetsToCDN) {
          console.log(
            '[ManifestAssets] Keeping manifest asset urls local because AITU_REWRITE_ENTRY_ASSETS_TO_CDN is not 1'
          );
          return;
        }

        const manifest = JSON.parse(
          (await readFileWithFdRetry(manifestPath, 'utf8')) as string
        );
        const cdnBaseUrl = `https://cdn.jsdelivr.net/npm/aitu-app@${appVersion}`;
        let rewrittenCount = 0;

        const rewriteManifestAssetUrl = (assetUrl: string) => {
          if (
            typeof assetUrl !== 'string' ||
            !assetUrl ||
            /^https?:\/\//.test(assetUrl)
          ) {
            return assetUrl;
          }

          rewrittenCount += 1;
          return `${cdnBaseUrl}/${assetUrl.replace(/^\.\//, '')}`;
        };

        if (Array.isArray(manifest.icons)) {
          manifest.icons = manifest.icons.map(
            (icon: Record<string, unknown>) => ({
              ...icon,
              src: rewriteManifestAssetUrl(String(icon.src || '')),
            })
          );
        }

        if (Array.isArray(manifest.shortcuts)) {
          manifest.shortcuts = manifest.shortcuts.map(
            (shortcut: Record<string, unknown>) => ({
              ...shortcut,
              icons: Array.isArray(shortcut.icons)
                ? shortcut.icons.map((icon: Record<string, unknown>) => ({
                    ...icon,
                    src: rewriteManifestAssetUrl(String(icon.src || '')),
                  }))
                : shortcut.icons,
            })
          );
        }

        if (rewrittenCount === 0) {
          return;
        }

        fs.writeFileSync(
          manifestPath,
          JSON.stringify(manifest, null, 2) + '\n'
        );
        console.log(
          `[ManifestAssets] Rewrote ${rewrittenCount} manifest asset url(s) to prefer CDN`
        );
      },
    },
  };
}

// 检测是否在 watch 模式下运行（命令行包含 --watch）
const isWatchMode = process.argv.includes('--watch');
const isServeMode = process.argv.includes('serve');
const isTestMode = process.env.VITEST === 'true';
const reactNodeEnv =
  isWatchMode || isServeMode || isTestMode ? 'development' : 'production';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/web',

  // 使用相对路径，源站始终可用，CDN 加速由 SW 层处理
  // SW 的 handleStaticRequest: cache → CDN → 源站回退
  base: process.env.VITE_BASE_URL || './',

  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_APP_RELEASE_ID': JSON.stringify(appReleaseId),
    'process.env.NODE_ENV': JSON.stringify(reactNodeEnv),
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_RELEASE_ID__: JSON.stringify(appReleaseId),
    // Vue feature flags - @milkdown/crepe 内部使用了 Vue，需要定义这些编译时标志
    __VUE_OPTIONS_API__: JSON.stringify(false),
    __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false),
  },

  esbuild: {
    jsxDev: false,
  },

  server: {
    port: 7200,
    host: 'localhost',
    headers: {
      'Content-Security-Policy':
        "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://us.i.posthog.com https://us-assets.i.posthog.com https://foropencode.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' http: https: ws: wss: data:; frame-ancestors 'self' localhost:* 127.0.0.1:* https://foropencode.com;",
    },
  },

  preview: {
    port: 4300,
    host: 'localhost',
    headers: {
      'Content-Security-Policy':
        "upgrade-insecure-requests; default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://us.i.posthog.com https://us-assets.i.posthog.com https://foropencode.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss: data:; frame-ancestors 'self' localhost:* 127.0.0.1:* https://foropencode.com;",
    },
  },

  plugins: [
    releaseIdentityHtmlPlugin(),
    react(),
    nxViteTsPaths(),
    visualizer({
      open: false,
      filename: path.resolve(__dirname, '../../dist/apps/web/stats.html'),
      gzipSize: true,
      brotliSize: true,
    }),
    deferEntryAssetsPlugin(),
    rewriteEntryAssetsToCDNPlugin(),
    compactProductionIndexHtmlPlugin(),
    rewriteManifestAssetsToCDNPlugin(),
    precacheManifestPlugin(),
    idlePrefetchManifestPlugin(),
  ],

  resolve: {
    alias: [
      ...diagramEngineAliases,
      {
        find: /^tdesign-react$/,
        replacement: path.resolve(
          __dirname,
          '../../packages/drawnix/src/utils/tdesign.ts'
        ),
      },
    ],
    dedupe: ['react', 'react-dom'],
  },

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/apps/web',
    // watch 模式下不清空输出目录，避免 index.html 丢失导致 serve 失败
    emptyOutDir: !isWatchMode,
    reportCompressedSize: true,
    // 只对真实进入当前 import 图的依赖生成 modulepreload。它不会拉取尚未
    // 激活的动态功能组，但能消除高 RTT 网络下逐层发现首屏静态依赖的瀑布。
    modulePreload: STARTUP_MODULE_PRELOAD_ENABLED ? { polyfill: false } : false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: ONLY_EXPLICIT_MANUAL_CHUNKS,
        manualChunks(id, context) {
          return resolveManualChunk(id, context);
        },
      },
    },
  },
});
