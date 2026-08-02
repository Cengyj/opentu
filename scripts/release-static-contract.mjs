import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import releaseIdentity from './release-identity.cjs';

export const RELEASE_CONTRACT_SCHEMA_VERSION = 3;
export const HTML_CACHE_CONTROL = 'no-cache, max-age=0, must-revalidate';
export const NO_STORE_CACHE_CONTROL = 'no-store';
export const MANIFEST_CACHE_CONTROL = 'no-cache';
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const CONTAINER_RELEASE_ID_LABEL = 'io.opentu.release-id';
export const CONTAINER_VERSION_LABEL = 'org.opencontainers.image.version';
export const CONTAINER_REVISION_LABEL = 'org.opencontainers.image.revision';

const HASHED_ASSET_PATH = /^\/assets\/.+-[-_A-Za-z0-9]{8}(?:\.[A-Za-z0-9]+)+$/;
const SEMVER_VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const MAX_HTML_ENTRY_ASSETS = 64;
const MAX_HASHED_ASSETS = 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const USER_MANUAL_DOCUMENT_MARKER = 'user-manual';
const USER_MANUAL_VERSION_META = 'opentu-manual-version';
export const MISSING_HASHED_ASSET_PATH =
  '/assets/__release_gate_missing__-00000000.js';

const MISSING_HASHED_ASSET_TARGET = Object.freeze({
  requestPath: MISSING_HASHED_ASSET_PATH,
  expectedStatus: 404,
  forbiddenCacheControlDirectives: ['immutable'],
});

const CONTROL_TARGETS = Object.freeze([
  {
    requestPath: '/',
    sourcePath: 'index.html',
    cacheControl: HTML_CACHE_CONTROL,
    contentTypes: ['text/html'],
    requireValidator: true,
  },
  {
    requestPath: '/index.html',
    sourcePath: 'index.html',
    cacheControl: HTML_CACHE_CONTROL,
    contentTypes: ['text/html'],
    requireValidator: true,
  },
  {
    requestPath: '/sw.js',
    sourcePath: 'sw.js',
    cacheControl: NO_STORE_CACHE_CONTROL,
    contentTypes: ['application/javascript', 'text/javascript'],
    requireValidator: false,
  },
  {
    requestPath: '/version.json',
    sourcePath: 'version.json',
    cacheControl: NO_STORE_CACHE_CONTROL,
    contentTypes: ['application/json'],
    requireValidator: false,
  },
  {
    requestPath: '/precache-manifest.json',
    sourcePath: 'precache-manifest.json',
    cacheControl: NO_STORE_CACHE_CONTROL,
    contentTypes: ['application/json'],
    requireValidator: false,
  },
  {
    requestPath: '/idle-prefetch-manifest.json',
    sourcePath: 'idle-prefetch-manifest.json',
    cacheControl: NO_STORE_CACHE_CONTROL,
    contentTypes: ['application/json'],
    requireValidator: false,
  },
  {
    requestPath: '/changelog.json',
    sourcePath: 'changelog.json',
    cacheControl: NO_STORE_CACHE_CONTROL,
    contentTypes: ['application/json'],
    requireValidator: false,
  },
  {
    requestPath: '/manifest.json',
    sourcePath: 'manifest.json',
    cacheControl: MANIFEST_CACHE_CONTROL,
    contentTypes: ['application/json', 'application/manifest+json'],
    requireValidator: true,
  },
  {
    requestPath: '/favicon.ico',
    sourcePath: 'favicon.ico',
    cacheControl: HTML_CACHE_CONTROL,
    contentTypes: ['image/x-icon', 'image/vnd.microsoft.icon'],
    requireValidator: true,
  },
  {
    requestPath: '/user-manual/index.html',
    sourcePath: 'user-manual/index.html',
    cacheControl: HTML_CACHE_CONTROL,
    contentTypes: ['text/html'],
    requireValidator: true,
  },
]);

const MAX_RELEASE_CONTRACT_TARGETS =
  CONTROL_TARGETS.length + 2 + MAX_HASHED_ASSETS;

const CONTENT_TYPES_BY_EXTENSION = new Map([
  ['.css', ['text/css']],
  ['.js', ['application/javascript', 'text/javascript']],
  ['.mjs', ['application/javascript', 'text/javascript']],
  ['.json', ['application/json']],
  ['.svg', ['image/svg+xml']],
  ['.png', ['image/png']],
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
  ['.webp', ['image/webp']],
  ['.avif', ['image/avif']],
  ['.gif', ['image/gif']],
  ['.ico', ['image/x-icon', 'image/vnd.microsoft.icon']],
  ['.woff', ['font/woff', 'application/font-woff']],
  ['.woff2', ['font/woff2']],
  ['.ttf', ['font/ttf', 'application/x-font-ttf']],
  ['.otf', ['font/otf']],
  ['.eot', ['application/vnd.ms-fontobject']],
  ['.wasm', ['application/wasm']],
  ['.mp3', ['audio/mpeg']],
  ['.mp4', ['video/mp4']],
  ['.webm', ['video/webm']],
]);

function contractError(message) {
  return new Error(`[release-static-contract] ${message}`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeCacheControl(value) {
  return String(value || '')
    .split(',')
    .map((directive) => directive.trim().toLowerCase())
    .filter(Boolean)
    .join(', ');
}

function assertReleaseId(releaseId, { allowLegacyIdentity = false } = {}) {
  try {
    releaseIdentity.assertReleaseId(releaseId);
  } catch {
    if (allowLegacyIdentity) {
      return;
    }
    throw contractError(
      'version.json.releaseId must be a non-legacy URL-safe release identity'
    );
  }
}

function resolveReleaseId(metadata, { allowLegacyIdentity = false } = {}) {
  const releaseId =
    typeof metadata.releaseId === 'string'
      ? metadata.releaseId
      : `legacy:${String(metadata.version || 'unknown')}:${String(
          metadata.gitCommit || 'unknown'
        )}`;
  assertReleaseId(releaseId, { allowLegacyIdentity });
  return releaseId;
}

function safeOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw contractError(`invalid origin: ${String(value)}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw contractError(`origin must use http or https: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) {
    throw contractError('origin must not contain credentials');
  }
  if (parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw contractError('origin must not contain a path, query, or fragment');
  }

  return parsed.origin;
}

function safeRequestPath(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('%') ||
    value.includes('\\') ||
    value.split('/').includes('..')
  ) {
    throw contractError(`unsafe release path: ${String(value)}`);
  }
  return value;
}

async function readRequiredFile(rootDir, relativePath) {
  const absoluteRoot = path.resolve(rootDir);
  const absolutePath = path.resolve(absoluteRoot, relativePath);
  if (
    absolutePath !== absoluteRoot &&
    !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)
  ) {
    throw contractError(`file escapes dist directory: ${relativePath}`);
  }

  try {
    return await readFile(absolutePath);
  } catch (error) {
    throw contractError(
      `required build file is unavailable: ${relativePath} (${
        error.code || 'read error'
      })`
    );
  }
}

async function listFilesRecursively(rootDir, relativeDir = '') {
  const absoluteDir = path.join(rootDir, relativeDir);
  let entries;
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    throw contractError(
      `cannot enumerate ${relativeDir || '.'}: ${error.code || 'read error'}`
    );
  }

  const files = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const child = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(rootDir, child)));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

function parseJson(bytes, sourcePath) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw contractError(`${sourcePath} is not valid JSON`);
  }
}

function toLocalAssetPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(value, 'https://release-contract.invalid/');
  } catch {
    return null;
  }

  if (parsed.origin !== 'https://release-contract.invalid') {
    return null;
  }

  return HASHED_ASSET_PATH.test(parsed.pathname) ? parsed.pathname : null;
}

function collectHtmlAssets(html) {
  const urls = [];
  const attributePattern = /\b(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attributePattern.exec(html))) {
    const assetPath = toLocalAssetPath(match[1]);
    if (assetPath) {
      urls.push(assetPath);
    }
  }
  return urls;
}

function readHtmlMetaContent(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameFirst = new RegExp(
    `<meta\\s+[^>]*name=["']${escapedName}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const contentFirst = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*name=["']${escapedName}["'][^>]*>`,
    'i'
  );
  return html.match(nameFirst)?.[1] || html.match(contentFirst)?.[1] || null;
}

function collectManifestEntries(manifest, sourcePath) {
  const entries = [];
  if (sourcePath === 'precache-manifest.json') {
    if (!Array.isArray(manifest.files)) {
      throw contractError(`${sourcePath}.files must be an array`);
    }
    entries.push(...manifest.files);
  } else {
    if (
      !manifest.groups ||
      typeof manifest.groups !== 'object' ||
      Array.isArray(manifest.groups)
    ) {
      throw contractError(`${sourcePath}.groups must be an object`);
    }
    for (const group of Object.values(manifest.groups)) {
      if (!Array.isArray(group)) {
        throw contractError(`${sourcePath} contains a non-array group`);
      }
      entries.push(...group);
    }
  }

  return entries.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      typeof entry.url === 'string' &&
      typeof entry.revision === 'string'
  );
}

function expectedContentTypes(assetPath) {
  const extension = path.posix.extname(assetPath).toLowerCase();
  const contentTypes = CONTENT_TYPES_BY_EXTENSION.get(extension);
  if (!contentTypes) {
    throw contractError(`unsupported MIME contract for asset: ${assetPath}`);
  }
  return contentTypes;
}

export async function createReleaseContract({
  distDir,
  expectedReleaseId,
  expectedVersion,
  allowLegacyIdentity = false,
}) {
  const absoluteDistDir = path.resolve(distDir);
  const distStats = await stat(absoluteDistDir).catch(() => null);
  if (!distStats?.isDirectory()) {
    throw contractError(`dist directory does not exist: ${absoluteDistDir}`);
  }

  const controlBytes = new Map();
  for (const target of CONTROL_TARGETS) {
    if (!controlBytes.has(target.sourcePath)) {
      controlBytes.set(
        target.sourcePath,
        await readRequiredFile(absoluteDistDir, target.sourcePath)
      );
    }
  }

  const versionMetadata = parseJson(
    controlBytes.get('version.json'),
    'version.json'
  );
  const releaseId = resolveReleaseId(versionMetadata, { allowLegacyIdentity });
  if (expectedReleaseId !== undefined && releaseId !== expectedReleaseId) {
    throw contractError(
      `release identity mismatch: expected ${expectedReleaseId}, received ${String(
        releaseId
      )}`
    );
  }
  if (
    typeof versionMetadata.version !== 'string' ||
    versionMetadata.version.trim() === ''
  ) {
    throw contractError(
      'version.json.version must be a non-empty display version'
    );
  }
  if (
    expectedVersion !== undefined &&
    versionMetadata.version !== expectedVersion
  ) {
    throw contractError(
      `display version mismatch: expected ${expectedVersion}, received ${versionMetadata.version}`
    );
  }

  const manualIndexHtml = controlBytes
    .get('user-manual/index.html')
    .toString('utf8');
  if (
    readHtmlMetaContent(manualIndexHtml, 'opentu-document') !==
    USER_MANUAL_DOCUMENT_MARKER
  ) {
    throw contractError(
      'user-manual/index.html is missing the user-manual document marker'
    );
  }
  if (
    readHtmlMetaContent(manualIndexHtml, USER_MANUAL_VERSION_META) !==
    versionMetadata.version
  ) {
    throw contractError(
      'user-manual/index.html version does not match version.json.version'
    );
  }

  const assetFiles = await listFilesRecursively(absoluteDistDir, 'assets');
  if (assetFiles.length === 0) {
    throw contractError('build contains no files in /assets');
  }
  if (assetFiles.length > MAX_HASHED_ASSETS) {
    throw contractError(
      `build contains too many hashed assets (${assetFiles.length}; maximum ${MAX_HASHED_ASSETS})`
    );
  }

  const assetRecords = new Map();
  for (const relativePath of assetFiles) {
    const requestPath = `/${relativePath.split(path.sep).join('/')}`;
    if (!HASHED_ASSET_PATH.test(requestPath)) {
      throw contractError(
        `unhashed file in /assets would receive immutable caching: ${requestPath}`
      );
    }
    const bytes = await readRequiredFile(absoluteDistDir, relativePath);
    assetRecords.set(requestPath, {
      sha256: sha256(bytes),
      size: bytes.byteLength,
    });
  }

  const precache = parseJson(
    controlBytes.get('precache-manifest.json'),
    'precache-manifest.json'
  );
  const idlePrefetch = parseJson(
    controlBytes.get('idle-prefetch-manifest.json'),
    'idle-prefetch-manifest.json'
  );
  for (const [sourcePath, manifest] of [
    ['precache-manifest.json', precache],
    ['idle-prefetch-manifest.json', idlePrefetch],
  ]) {
    if (manifest.version !== versionMetadata.version) {
      throw contractError(
        `${sourcePath}.version does not match version.json.version`
      );
    }
    if (
      manifest.releaseId !== releaseId &&
      !(allowLegacyIdentity && manifest.releaseId === undefined)
    ) {
      throw contractError(
        `${sourcePath}.releaseId does not match version.json.releaseId`
      );
    }
  }
  const manifestEntries = [
    ...collectManifestEntries(precache, 'precache-manifest.json'),
    ...collectManifestEntries(idlePrefetch, 'idle-prefetch-manifest.json'),
  ];

  for (const entry of manifestEntries) {
    const assetPath = toLocalAssetPath(entry.url);
    if (!assetPath) {
      continue;
    }
    const record = assetRecords.get(assetPath);
    if (!record) {
      throw contractError(`manifest references a missing asset: ${assetPath}`);
    }
  }

  const indexHtml = controlBytes.get('index.html').toString('utf8');
  const htmlReleaseId = readHtmlMetaContent(indexHtml, 'app-release-id');
  if (
    htmlReleaseId !== releaseId &&
    !(allowLegacyIdentity && htmlReleaseId === null)
  ) {
    throw contractError(
      'index.html app-release-id does not match version.json.releaseId'
    );
  }
  const serviceWorkerSource = controlBytes.get('sw.js').toString('utf8');
  if (
    !serviceWorkerSource.includes(releaseId) &&
    !(allowLegacyIdentity && htmlReleaseId === null)
  ) {
    throw contractError('sw.js does not contain version.json.releaseId');
  }
  const htmlAssetPaths = collectHtmlAssets(indexHtml);
  const htmlEntryAssetPaths = Array.from(
    new Set(
      htmlAssetPaths.filter((assetPath) =>
        ['.js', '.css'].includes(path.posix.extname(assetPath).toLowerCase())
      )
    )
  );
  if (htmlEntryAssetPaths.length > MAX_HTML_ENTRY_ASSETS) {
    throw contractError(
      `index.html references too many hashed JavaScript/CSS entries (${htmlEntryAssetPaths.length})`
    );
  }
  for (const assetPath of htmlEntryAssetPaths) {
    if (!assetRecords.has(assetPath)) {
      throw contractError(
        `index.html references a missing hashed asset: ${assetPath}`
      );
    }
  }
  if (assetRecords.has(MISSING_HASHED_ASSET_PATH)) {
    throw contractError(
      `build contains the reserved missing-asset probe: ${MISSING_HASHED_ASSET_PATH}`
    );
  }

  const targets = CONTROL_TARGETS.map((target) => {
    const bytes = controlBytes.get(target.sourcePath);
    return {
      ...target,
      sha256: sha256(bytes),
      size: bytes.byteLength,
    };
  });

  // A non-existent navigation path proves that the server's SPA fallback is
  // the same immutable release shell rather than a proxy-generated response.
  targets.push({
    requestPath: '/__release_gate__/spa-navigation',
    sourcePath: 'index.html',
    cacheControl: HTML_CACHE_CONTROL,
    contentTypes: ['text/html'],
    requireValidator: true,
    sha256: sha256(controlBytes.get('index.html')),
    size: controlBytes.get('index.html').byteLength,
  });
  targets.push({ ...MISSING_HASHED_ASSET_TARGET });

  const hashedAssetTargets = Array.from(assetRecords.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([requestPath, record]) => {
      return {
        requestPath,
        sourcePath: requestPath.slice(1),
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        contentTypes: expectedContentTypes(requestPath),
        requireValidator: true,
        sha256: record.sha256,
        size: record.size,
      };
    });

  const inventoryHash = sha256(
    Buffer.from(
      Array.from(assetRecords.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([assetPath, record]) => `${assetPath}\0${record.sha256}\n`)
        .join(''),
      'utf8'
    )
  );

  return {
    schemaVersion: RELEASE_CONTRACT_SCHEMA_VERSION,
    identity: {
      releaseId,
      version: versionMetadata.version,
      gitCommit:
        typeof versionMetadata.gitCommit === 'string'
          ? versionMetadata.gitCommit
          : null,
    },
    assetInventory: {
      count: assetRecords.size,
      sha256: inventoryHash,
    },
    targets: [...targets, ...hashedAssetTargets],
  };
}

export async function writeReleaseContract(outputPath, contract) {
  const serialized = `${JSON.stringify(contract, null, 2)}\n`;
  await writeFile(path.resolve(outputPath), serialized, {
    encoding: 'utf8',
    mode: 0o644,
  });
}

export async function readReleaseContract(contractPath, options = {}) {
  let contract;
  try {
    contract = JSON.parse(await readFile(path.resolve(contractPath), 'utf8'));
  } catch (error) {
    throw contractError(
      `cannot read release contract: ${error.code || 'invalid JSON'}`
    );
  }
  validateReleaseContract(contract, options);
  return contract;
}

export function validateReleaseContract(
  contract,
  { expectedReleaseId, expectedVersion, allowLegacyIdentity = false } = {}
) {
  if (
    !contract ||
    typeof contract !== 'object' ||
    contract.schemaVersion !== RELEASE_CONTRACT_SCHEMA_VERSION
  ) {
    throw contractError('unsupported release contract schema');
  }
  if (!contract.identity || typeof contract.identity !== 'object') {
    throw contractError('release contract identity is missing');
  }
  if (
    expectedVersion !== undefined &&
    contract.identity.version !== expectedVersion
  ) {
    throw contractError(
      `release contract display version mismatch: expected ${expectedVersion}, received ${contract.identity.version}`
    );
  }
  assertReleaseId(contract.identity.releaseId, { allowLegacyIdentity });
  if (
    typeof contract.identity.version !== 'string' ||
    contract.identity.version.trim() === ''
  ) {
    throw contractError('release contract display version is missing');
  }
  if (
    expectedReleaseId !== undefined &&
    contract.identity.releaseId !== expectedReleaseId
  ) {
    throw contractError(
      `release contract identity mismatch: expected ${expectedReleaseId}, received ${String(
        contract.identity.releaseId
      )}`
    );
  }
  if (
    !contract.assetInventory ||
    typeof contract.assetInventory !== 'object' ||
    !Number.isSafeInteger(contract.assetInventory.count) ||
    contract.assetInventory.count < 1 ||
    contract.assetInventory.count > MAX_HASHED_ASSETS ||
    !/^[a-f0-9]{64}$/.test(contract.assetInventory.sha256)
  ) {
    throw contractError('release contract hashed asset inventory is invalid');
  }
  if (!Array.isArray(contract.targets) || contract.targets.length === 0) {
    throw contractError('release contract contains no targets');
  }
  if (contract.targets.length > MAX_RELEASE_CONTRACT_TARGETS) {
    throw contractError('release contract contains too many targets');
  }

  const actualPaths = new Set();
  for (const target of contract.targets) {
    if (!target || typeof target !== 'object') {
      throw contractError('release contract contains an invalid target');
    }
    const requestPath = safeRequestPath(target.requestPath);
    if (actualPaths.has(requestPath)) {
      throw contractError(`duplicate release target: ${requestPath}`);
    }
    actualPaths.add(requestPath);
    if (requestPath === MISSING_HASHED_ASSET_PATH) {
      if (
        target.expectedStatus !== MISSING_HASHED_ASSET_TARGET.expectedStatus ||
        JSON.stringify(target.forbiddenCacheControlDirectives) !==
          JSON.stringify(
            MISSING_HASHED_ASSET_TARGET.forbiddenCacheControlDirectives
          )
      ) {
        throw contractError('missing hashed-asset probe policy mismatch');
      }
      continue;
    }
    if (!/^[a-f0-9]{64}$/.test(target.sha256)) {
      throw contractError(`invalid SHA-256 for ${requestPath}`);
    }
    if (!Number.isSafeInteger(target.size) || target.size < 0) {
      throw contractError(`invalid byte size for ${requestPath}`);
    }
    if (
      !Array.isArray(target.contentTypes) ||
      target.contentTypes.length === 0 ||
      target.contentTypes.some((value) => typeof value !== 'string')
    ) {
      throw contractError(`invalid content-type contract for ${requestPath}`);
    }
    if (typeof target.cacheControl !== 'string') {
      throw contractError(`invalid cache-control contract for ${requestPath}`);
    }
    if (
      target.cacheControl.includes('immutable') &&
      !HASHED_ASSET_PATH.test(requestPath)
    ) {
      throw contractError(
        `immutable target is not content-hashed: ${requestPath}`
      );
    }
    if (
      HASHED_ASSET_PATH.test(requestPath) &&
      target.cacheControl !== IMMUTABLE_CACHE_CONTROL
    ) {
      throw contractError(
        `content-hashed target does not use the immutable policy: ${requestPath}`
      );
    }
  }

  const hashedAssetTargets = contract.targets
    .filter(
      (target) =>
        target.requestPath !== MISSING_HASHED_ASSET_PATH &&
        HASHED_ASSET_PATH.test(target.requestPath)
    )
    .sort((left, right) => left.requestPath.localeCompare(right.requestPath));
  if (hashedAssetTargets.length !== contract.assetInventory.count) {
    throw contractError(
      `release contract hashed asset target count mismatch: expected ${contract.assetInventory.count}, received ${hashedAssetTargets.length}`
    );
  }
  const targetInventoryHash = sha256(
    Buffer.from(
      hashedAssetTargets
        .map((target) => `${target.requestPath}\0${target.sha256}\n`)
        .join(''),
      'utf8'
    )
  );
  if (targetInventoryHash !== contract.assetInventory.sha256) {
    throw contractError(
      'release contract hashed asset inventory hash mismatch'
    );
  }

  const requiredPaths = [
    ...CONTROL_TARGETS.map((target) => target.requestPath),
    '/__release_gate__/spa-navigation',
    MISSING_HASHED_ASSET_PATH,
  ];
  for (const requiredPath of requiredPaths) {
    if (!actualPaths.has(requiredPath)) {
      throw contractError(`release contract is missing ${requiredPath}`);
    }
  }

  for (const expectedTarget of CONTROL_TARGETS) {
    const target = contract.targets.find(
      (candidate) => candidate.requestPath === expectedTarget.requestPath
    );
    if (
      target.cacheControl !== expectedTarget.cacheControl ||
      JSON.stringify(target.contentTypes) !==
        JSON.stringify(expectedTarget.contentTypes) ||
      target.requireValidator !== expectedTarget.requireValidator
    ) {
      throw contractError(
        `release contract policy mismatch for ${expectedTarget.requestPath}`
      );
    }
  }

  const rootTarget = contract.targets.find(
    (target) => target.requestPath === '/'
  );
  const indexTarget = contract.targets.find(
    (target) => target.requestPath === '/index.html'
  );
  const spaTarget = contract.targets.find(
    (target) => target.requestPath === '/__release_gate__/spa-navigation'
  );
  if (
    spaTarget.cacheControl !== HTML_CACHE_CONTROL ||
    JSON.stringify(spaTarget.contentTypes) !== JSON.stringify(['text/html']) ||
    spaTarget.requireValidator !== true ||
    rootTarget.sha256 !== indexTarget.sha256 ||
    rootTarget.sha256 !== spaTarget.sha256 ||
    rootTarget.size !== indexTarget.size ||
    rootTarget.size !== spaTarget.size
  ) {
    throw contractError(
      'SPA shell targets do not share one exact HTML contract'
    );
  }

  const immutableTargets = contract.targets.filter((target) =>
    target.cacheControl?.includes('immutable')
  );
  if (
    !immutableTargets.some((target) => target.requestPath.endsWith('.js')) ||
    !immutableTargets.some((target) => target.requestPath.endsWith('.css'))
  ) {
    throw contractError(
      'release contract must include representative hashed JavaScript and CSS'
    );
  }
}

export function validateReleaseVersionPreflight({
  tag,
  packageVersion,
  metadataVersion,
}) {
  if (
    typeof packageVersion !== 'string' ||
    !SEMVER_VERSION.test(packageVersion)
  ) {
    throw contractError(
      `package version is not valid semver: ${String(packageVersion)}`
    );
  }
  if (metadataVersion !== packageVersion) {
    throw contractError(
      `version.json.version ${String(
        metadataVersion
      )} does not match package.json.version ${packageVersion}`
    );
  }

  const canonicalTag = `v${packageVersion}`;
  if (tag !== canonicalTag) {
    throw contractError(
      `release tag must be exactly ${canonicalTag}; refusing to publish different bytes under display version ${packageVersion}`
    );
  }

  return { tag: canonicalTag, version: packageVersion };
}

export function validatePublishedVersionImage({
  versionTag,
  candidateImageId,
  publishedImageId,
}) {
  const imageIdPattern = /^sha256:[a-f0-9]{64}$/;
  if (
    !imageIdPattern.test(candidateImageId) ||
    !imageIdPattern.test(publishedImageId)
  ) {
    throw contractError(
      'candidate and published image IDs must be SHA-256 IDs'
    );
  }
  if (candidateImageId !== publishedImageId) {
    throw contractError(
      `refusing to overwrite immutable version tag ${versionTag} with different image bytes`
    );
  }
  return { versionTag, imageId: candidateImageId };
}

function parseSemverPrecedence(version, label) {
  if (typeof version !== 'string' || !SEMVER_VERSION.test(version)) {
    throw contractError(`${label} is not valid semver: ${String(version)}`);
  }

  const withoutBuildMetadata = version.split('+', 1)[0];
  const prereleaseSeparator = withoutBuildMetadata.indexOf('-');
  const core =
    prereleaseSeparator === -1
      ? withoutBuildMetadata
      : withoutBuildMetadata.slice(0, prereleaseSeparator);
  const prerelease =
    prereleaseSeparator === -1
      ? []
      : withoutBuildMetadata.slice(prereleaseSeparator + 1).split('.');
  const coreParts = core.split('.').map((part) => BigInt(part));

  return { coreParts, prerelease };
}

function comparePrereleaseIdentifiers(left, right) {
  const leftIsNumeric = /^\d+$/.test(left);
  const rightIsNumeric = /^\d+$/.test(right);
  if (leftIsNumeric && rightIsNumeric) {
    const leftNumber = BigInt(left);
    const rightNumber = BigInt(right);
    return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
  }
  if (leftIsNumeric !== rightIsNumeric) {
    return leftIsNumeric ? -1 : 1;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareSemverPrecedence(leftVersion, rightVersion) {
  const left = parseSemverPrecedence(leftVersion, 'left version');
  const right = parseSemverPrecedence(rightVersion, 'right version');

  for (let index = 0; index < 3; index += 1) {
    if (left.coreParts[index] !== right.coreParts[index]) {
      return left.coreParts[index] < right.coreParts[index] ? -1 : 1;
    }
  }

  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) {
      return 0;
    }
    return left.prerelease.length === 0 ? 1 : -1;
  }

  const identifierCount = Math.max(
    left.prerelease.length,
    right.prerelease.length
  );
  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      return leftIdentifier === undefined ? -1 : 1;
    }
    const comparison = comparePrereleaseIdentifiers(
      leftIdentifier,
      rightIdentifier
    );
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}

/**
 * Authorizes mutable `latest` movement only after every enabled registry has
 * been inspected. Concurrency prevents overlapping workflow writes, while
 * this version fence prevents a later-triggered historical tag from moving
 * `latest` backwards.
 */
export function createLatestContainerPromotionPlan({
  candidateVersion,
  candidateImageId,
  candidateReleaseId,
  targets,
}) {
  parseSemverPrecedence(candidateVersion, 'candidate version');
  const imageIdPattern = /^sha256:[a-f0-9]{64}$/;
  if (!imageIdPattern.test(candidateImageId)) {
    throw contractError('candidate latest image ID must be a SHA-256 ID');
  }
  assertReleaseId(candidateReleaseId);
  if (!Array.isArray(targets) || targets.length === 0) {
    throw contractError('latest promotion requires at least one registry');
  }

  const seenNames = new Set();
  const seenImages = new Set();
  const normalizedTargets = targets.map((target) => {
    const name = typeof target?.name === 'string' ? target.name.trim() : '';
    const image = typeof target?.image === 'string' ? target.image.trim() : '';
    if (!name || !image || seenNames.has(name) || seenImages.has(image)) {
      throw contractError(
        'latest promotion targets require unique non-empty names and images'
      );
    }
    seenNames.add(name);
    seenImages.add(image);

    const imageId = target?.imageId ?? null;
    const version = target?.version ?? null;
    const releaseId = target?.releaseId ?? null;
    const isMissing = imageId === null;
    if (isMissing) {
      if (version !== null || releaseId !== null) {
        throw contractError(
          `missing latest image ${image} must not advertise release metadata`
        );
      }
      return { name, image, imageId: null, version: null, releaseId: null };
    }
    if (!imageIdPattern.test(imageId)) {
      throw contractError(
        `latest image ID for ${image} must be a SHA-256 ID or missing`
      );
    }
    parseSemverPrecedence(version, `latest version for ${image}`);
    if (releaseId !== null) {
      assertReleaseId(releaseId);
    }
    return { name, image, imageId, version, releaseId };
  });

  for (const target of normalizedTargets) {
    if (target.version === null) {
      continue;
    }
    const comparison = compareSemverPrecedence(
      target.version,
      candidateVersion
    );
    if (comparison > 0) {
      throw contractError(
        `refusing to move ${target.image} latest backwards from ${target.version} to ${candidateVersion}`
      );
    }
    if (comparison === 0 && target.imageId !== candidateImageId) {
      throw contractError(
        `latest ${target.image} already advertises ${candidateVersion} with different image bytes`
      );
    }
    if (
      target.imageId === candidateImageId &&
      (comparison !== 0 || target.releaseId !== candidateReleaseId)
    ) {
      throw contractError(
        `latest ${target.image} metadata disagrees with candidate image bytes`
      );
    }
  }

  const promotionTargets = normalizedTargets
    .filter((target) => target.imageId !== candidateImageId)
    .map((target) => target.image);
  const alreadyPromotedTargets = normalizedTargets
    .filter((target) => target.imageId === candidateImageId)
    .map((target) => target.image);

  return {
    mode:
      promotionTargets.length === 0
        ? 'noop'
        : alreadyPromotedTargets.length > 0
        ? 'recover'
        : 'promote',
    candidateVersion,
    candidateImageId,
    candidateReleaseId,
    promotionTargets,
    alreadyPromotedTargets,
  };
}

export function createContainerPromotionPlan({ targets }) {
  const imageIdPattern = /^sha256:[a-f0-9]{64}$/;
  if (!Array.isArray(targets) || targets.length === 0) {
    throw contractError('container promotion requires at least one registry');
  }

  const seenNames = new Set();
  const seenImages = new Set();
  const normalizedTargets = targets.map((target) => {
    const name = typeof target?.name === 'string' ? target.name.trim() : '';
    const image = typeof target?.image === 'string' ? target.image.trim() : '';
    const imageId = target?.imageId ?? null;

    if (!name || !image) {
      throw contractError(
        'container promotion targets require non-empty names and images'
      );
    }
    if (seenNames.has(name) || seenImages.has(image)) {
      throw contractError('container promotion targets must be unique');
    }
    if (imageId !== null && !imageIdPattern.test(imageId)) {
      throw contractError(
        `published image ID for ${image} must be a SHA-256 ID or missing`
      );
    }

    seenNames.add(name);
    seenImages.add(image);
    return { name, image, imageId };
  });

  const publishedTargets = normalizedTargets.filter(
    (target) => target.imageId !== null
  );
  const publishedImageIds = new Set(
    publishedTargets.map((target) => target.imageId)
  );
  if (publishedImageIds.size > 1) {
    throw contractError(
      'immutable version tags contain different image bytes; refusing promotion'
    );
  }

  const source = publishedTargets[0] || null;
  return {
    mode: source ? 'recover' : 'build',
    source: source?.image || null,
    imageId: source?.imageId || null,
    immutableTargets: normalizedTargets
      .filter((target) => target.imageId === null)
      .map((target) => target.image),
  };
}

export function validateContainerImageMetadata({
  labels,
  expectedReleaseId,
  expectedVersion,
  expectedRevision,
}) {
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    throw contractError('container image labels must be an object');
  }
  assertReleaseId(expectedReleaseId);
  if (
    typeof expectedVersion !== 'string' ||
    !SEMVER_VERSION.test(expectedVersion)
  ) {
    throw contractError(
      `expected container display version is not valid semver: ${String(
        expectedVersion
      )}`
    );
  }

  const releaseId = labels[CONTAINER_RELEASE_ID_LABEL];
  const version = labels[CONTAINER_VERSION_LABEL];
  const revision = labels[CONTAINER_REVISION_LABEL];
  if (releaseId !== expectedReleaseId) {
    throw contractError(
      `container ${CONTAINER_RELEASE_ID_LABEL} mismatch: expected ${expectedReleaseId}, received ${String(
        releaseId || '<missing>'
      )}`
    );
  }
  if (version !== expectedVersion) {
    throw contractError(
      `container ${CONTAINER_VERSION_LABEL} mismatch: expected ${expectedVersion}, received ${String(
        version || '<missing>'
      )}`
    );
  }
  if (
    typeof revision !== 'string' ||
    !revision.trim() ||
    releaseIdentity.RESERVED_RELEASE_IDS.has(revision.trim().toLowerCase())
  ) {
    throw contractError(
      `container ${CONTAINER_REVISION_LABEL} is missing or reserved`
    );
  }
  if (expectedRevision !== undefined && revision !== expectedRevision) {
    throw contractError(
      `container ${CONTAINER_REVISION_LABEL} mismatch: expected ${expectedRevision}, received ${String(
        revision || '<missing>'
      )}`
    );
  }

  return {
    releaseId,
    version,
    revision,
  };
}

async function fetchReleaseTarget({
  origin,
  target,
  fetchImpl,
  timeoutMs,
  expectedReleaseId,
  allowLegacyIdentity,
}) {
  const requestPath = safeRequestPath(target.requestPath);
  const requestUrl = new URL(requestPath, `${origin}/`).href;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(requestUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: abortController.signal,
    });
  } catch (error) {
    const reason =
      error?.name === 'AbortError'
        ? `timeout after ${timeoutMs}ms`
        : error.message;
    throw contractError(`${origin}${requestPath} request failed: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }

  const expectedStatus = target.expectedStatus ?? 200;
  if (response.status !== expectedStatus) {
    throw contractError(
      `${origin}${requestPath} returned HTTP ${response.status}; expected ${expectedStatus} (redirects are not accepted)`
    );
  }
  if (response.url && response.url !== requestUrl) {
    throw contractError(
      `${origin}${requestPath} resolved to unexpected final URL ${response.url}`
    );
  }

  const cacheControl = response.headers.get('cache-control');
  if (expectedStatus !== 200) {
    const cacheDirectives = new Set(
      normalizeCacheControl(cacheControl)
        .split(', ')
        .filter(Boolean)
        .map((directive) => directive.split('=', 1)[0])
    );
    for (const forbiddenDirective of target.forbiddenCacheControlDirectives ||
      []) {
      if (cacheDirectives.has(forbiddenDirective.toLowerCase())) {
        throw contractError(
          `${origin}${requestPath} must not return ${forbiddenDirective} caching on HTTP ${expectedStatus}`
        );
      }
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      path: requestPath,
      finalUrl: response.url || requestUrl,
      status: response.status,
      sha256: sha256(bytes),
      size: bytes.byteLength,
      cacheControl,
      contentType:
        (response.headers.get('content-type') || '')
          .split(';', 1)[0]
          .trim()
          .toLowerCase() || null,
      validator:
        response.headers.get('etag') ||
        response.headers.get('last-modified') ||
        null,
    };
  }

  if (
    normalizeCacheControl(cacheControl) !==
    normalizeCacheControl(target.cacheControl)
  ) {
    throw contractError(
      `${origin}${requestPath} Cache-Control mismatch: expected "${
        target.cacheControl
      }", received "${cacheControl || '<missing>'}"`
    );
  }

  const rawContentType = response.headers.get('content-type') || '';
  const contentType = rawContentType.split(';', 1)[0].trim().toLowerCase();
  if (!target.contentTypes.includes(contentType)) {
    throw contractError(
      `${origin}${requestPath} Content-Type mismatch: expected ${target.contentTypes.join(
        ' or '
      )}, received ${rawContentType || '<missing>'}`
    );
  }

  const etag = response.headers.get('etag');
  const lastModified = response.headers.get('last-modified');
  if (target.requireValidator && !etag && !lastModified) {
    throw contractError(
      `${origin}${requestPath} is missing both ETag and Last-Modified validators`
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const actualHash = sha256(bytes);
  if (actualHash !== target.sha256 || bytes.byteLength !== target.size) {
    throw contractError(
      `${origin}${requestPath} byte identity mismatch: expected ${target.sha256}/${target.size}, received ${actualHash}/${bytes.byteLength}`
    );
  }

  if (requestPath === '/version.json') {
    const metadata = parseJson(bytes, `${origin}/version.json`);
    const actualReleaseId = resolveReleaseId(metadata, { allowLegacyIdentity });
    if (actualReleaseId !== expectedReleaseId) {
      throw contractError(
        `${origin}/version.json release identity mismatch: expected ${expectedReleaseId}, received ${String(
          actualReleaseId
        )}`
      );
    }
  }

  return {
    path: requestPath,
    finalUrl: response.url || requestUrl,
    status: response.status,
    sha256: actualHash,
    size: bytes.byteLength,
    cacheControl,
    contentType,
    validator: etag || lastModified || null,
  };
}

export async function verifyReleaseOrigin({
  origin,
  contract,
  expectedReleaseId,
  expectedVersion,
  allowLegacyIdentity = false,
  fetchImpl = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const normalizedOrigin = safeOrigin(origin);
  if (typeof fetchImpl !== 'function') {
    throw contractError('Fetch API is unavailable in this Node.js runtime');
  }
  validateReleaseContract(contract, {
    expectedReleaseId,
    expectedVersion,
    allowLegacyIdentity,
  });

  const results = [];
  // Keep checks sequential: this gate must remain safe for small production
  // origins and should stop immediately on the first contradictory response.
  for (const target of contract.targets) {
    results.push(
      await fetchReleaseTarget({
        origin: normalizedOrigin,
        target,
        fetchImpl,
        timeoutMs,
        expectedReleaseId: contract.identity.releaseId,
        allowLegacyIdentity,
      })
    );
  }

  return {
    origin: normalizedOrigin,
    releaseId: contract.identity.releaseId,
    version: contract.identity.version,
    checkedTargets: results,
  };
}
