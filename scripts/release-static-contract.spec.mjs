import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createReleaseContract,
  HTML_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
  MANIFEST_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  validateReleaseContract,
  validateReleaseVersionPreflight,
  validatePublishedVersionImage,
  validateContainerImageMetadata,
  createContainerPromotionPlan,
  createLatestContainerPromotionPlan,
  compareSemverPrecedence,
  verifyReleaseOrigin,
} from './release-static-contract.mjs';

const RELEASE_ID = '0123456789abcdef0123456789abcdef01234567';
const JS_ASSET = '/assets/app-Ab12_cd3.js';
const CSS_ASSET = '/assets/app-Cd34-ef5.css';
const EARLY_ASSETS = Object.freeze([
  '/assets/000-entry-a-Ab12cd34.js',
  '/assets/000-entry-b-Cd34ef56.css',
  '/assets/001-entry-a-Ef56gh78.js',
  '/assets/001-entry-b-Gh78ij90.css',
  '/assets/002-entry-a-Ij90kl12.js',
  '/assets/002-entry-b-Kl12mn34.css',
]);
const MISSING_HASHED_ASSET = '/assets/__release_gate_missing__-00000000.js';

const temporaryDirectories = [];
const activeServers = [];

afterEach(async () => {
  await Promise.all(
    activeServers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
        })
    )
  );
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

function md5Revision(value) {
  return createHash('md5').update(value).digest('hex').slice(0, 8);
}

async function writeFixture({
  releaseId = RELEASE_ID,
  manifestReleaseId = releaseId,
  includeReleaseId = true,
  unhashedAsset = false,
  missingManifestAsset = false,
  crowdHtmlEntryAssets = false,
  omitHtmlEntryFiles = false,
  omitHtmlEntriesFromManifests = false,
  omitManualIndex = false,
  manualDocumentMarker = 'user-manual',
  manualVersion = '1.2.3',
} = {}) {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'opentu-release-contract-')
  );
  temporaryDirectories.push(directory);
  await mkdir(path.join(directory, 'assets'), { recursive: true });
  await mkdir(path.join(directory, 'user-manual'), { recursive: true });

  const js = Buffer.from('console.log("release-contract");\n');
  const css = Buffer.from('body { color: #123456; }\n');
  const version = {
    version: '1.2.3',
    gitCommit: RELEASE_ID,
    ...(includeReleaseId ? { releaseId } : {}),
  };
  const earlyAssetEntries = crowdHtmlEntryAssets
    ? EARLY_ASSETS.map((url) => ({
        url,
        revision: md5Revision(Buffer.from(`fixture:${url}`)),
      }))
    : [];
  const precacheFiles = omitHtmlEntriesFromManifests
    ? earlyAssetEntries
    : [
        {
          url: missingManifestAsset ? '/assets/missing-Zz99_aa1.js' : JS_ASSET,
          revision: md5Revision(js),
        },
        { url: CSS_ASSET, revision: md5Revision(css) },
        ...earlyAssetEntries,
      ];
  const files = new Map([
    [
      'index.html',
      Buffer.from(
        `<!doctype html>${
          includeReleaseId
            ? `<meta name="app-release-id" content="${releaseId}">`
            : ''
        }<script type="module" src=".${JS_ASSET}"></script><link rel="stylesheet" href=".${CSS_ASSET}">`
      ),
    ],
    [
      'sw.js',
      Buffer.from(
        `self.__RELEASE_ID__ = "${
          includeReleaseId ? releaseId : 'legacy-fixture'
        }";\n`
      ),
    ],
    ['version.json', Buffer.from(JSON.stringify(version))],
    [
      'precache-manifest.json',
      Buffer.from(
        JSON.stringify({
          version: '1.2.3',
          ...(includeReleaseId ? { releaseId: manifestReleaseId } : {}),
          files: precacheFiles,
        })
      ),
    ],
    [
      'idle-prefetch-manifest.json',
      Buffer.from(
        JSON.stringify({
          version: '1.2.3',
          ...(includeReleaseId ? { releaseId: manifestReleaseId } : {}),
          groups: {
            core: omitHtmlEntriesFromManifests
              ? earlyAssetEntries
              : [
                  { url: JS_ASSET, revision: md5Revision(js) },
                  ...earlyAssetEntries,
                ],
          },
        })
      ),
    ],
    ['changelog.json', Buffer.from('{"versions":[]}')],
    ['manifest.json', Buffer.from('{"name":"Opentu"}')],
    ['favicon.ico', Buffer.from([0, 0, 1, 0])],
  ]);
  if (!omitManualIndex) {
    files.set(
      'user-manual/index.html',
      Buffer.from(
        `<!doctype html><meta name="opentu-document" content="${manualDocumentMarker}"><meta name="opentu-manual-version" content="${manualVersion}"><title>Manual</title>`
      )
    );
  }
  if (!omitHtmlEntryFiles) {
    files.set(JS_ASSET.slice(1), js);
    files.set(CSS_ASSET.slice(1), css);
  }
  for (const url of crowdHtmlEntryAssets ? EARLY_ASSETS : []) {
    files.set(url.slice(1), Buffer.from(`fixture:${url}`));
  }
  if (unhashedAsset) {
    files.set('assets/unhashed.js', Buffer.from('unsafe'));
  }

  for (const [relativePath, bytes] of files) {
    await writeFile(path.join(directory, relativePath), bytes);
  }

  return directory;
}

function contentTypeFor(requestPath) {
  if (requestPath === '/' || requestPath.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  if (requestPath.endsWith('.js')) {
    return 'application/javascript';
  }
  if (requestPath.endsWith('.json')) {
    return 'application/json';
  }
  if (requestPath.endsWith('.css')) {
    return 'text/css';
  }
  if (requestPath.endsWith('.ico')) {
    return 'image/x-icon';
  }
  return 'application/octet-stream';
}

function cacheControlFor(requestPath) {
  if (
    [
      '/sw.js',
      '/version.json',
      '/precache-manifest.json',
      '/idle-prefetch-manifest.json',
      '/changelog.json',
    ].includes(requestPath)
  ) {
    return NO_STORE_CACHE_CONTROL;
  }
  if (requestPath === '/manifest.json') {
    return MANIFEST_CACHE_CONTROL;
  }
  if (requestPath.startsWith('/assets/')) {
    return IMMUTABLE_CACHE_CONTROL;
  }
  return HTML_CACHE_CONTROL;
}

async function startFixtureServer(
  fixtureDirectory,
  {
    cacheOverrides = new Map(),
    bodyOverrides = new Map(),
    missingPaths = new Set(),
  } = {}
) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const requestPath = new URL(request.url, 'http://fixture.invalid').pathname;
    requests.push(requestPath);
    const relativePath =
      requestPath === '/' || requestPath === '/__release_gate__/spa-navigation'
        ? 'index.html'
        : requestPath.slice(1);

    let body;
    try {
      if (missingPaths.has(requestPath)) {
        throw new Error('fixture path is intentionally missing');
      }
      body =
        bodyOverrides.get(requestPath) ||
        (await readFile(path.join(fixtureDirectory, relativePath)));
    } catch {
      response.statusCode = 404;
      const cacheControl = cacheOverrides.get(requestPath);
      if (cacheControl) {
        response.setHeader('Cache-Control', cacheControl);
      }
      response.setHeader('Content-Type', 'text/html');
      response.end('not found');
      return;
    }

    response.statusCode = 200;
    response.setHeader(
      'Cache-Control',
      cacheOverrides.get(requestPath) || cacheControlFor(requestPath)
    );
    response.setHeader('Content-Type', contentTypeFor(relativePath));
    response.setHeader('ETag', `"fixture-${body.length}"`);
    response.end(body);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  activeServers.push(server);
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
  };
}

describe('release static contract', () => {
  it('creates a byte-level contract for the complete hashed inventory and manual entry', async () => {
    const fixture = await writeFixture();

    const contract = await createReleaseContract({
      distDir: fixture,
      expectedReleaseId: RELEASE_ID,
    });

    expect(contract.identity).toEqual({
      releaseId: RELEASE_ID,
      version: '1.2.3',
      gitCommit: RELEASE_ID,
    });
    expect(contract.assetInventory.count).toBe(2);
    expect(contract.targets.map((target) => target.requestPath)).toEqual(
      expect.arrayContaining([
        '/',
        '/index.html',
        '/__release_gate__/spa-navigation',
        '/sw.js',
        '/version.json',
        '/user-manual/index.html',
        JS_ASSET,
        CSS_ASSET,
      ])
    );
    expect(
      contract.targets.find((target) => target.requestPath === JS_ASSET)
        .cacheControl
    ).toBe(IMMUTABLE_CACHE_CONTROL);
  });

  it('always includes every same-origin hashed JavaScript and CSS entry referenced by index.html', async () => {
    const fixture = await writeFixture({ crowdHtmlEntryAssets: true });

    const contract = await createReleaseContract({ distDir: fixture });
    const targetPaths = contract.targets.map((target) => target.requestPath);

    expect(targetPaths).toContain(JS_ASSET);
    expect(targetPaths).toContain(CSS_ASSET);
  });

  it('includes every hashed manifest asset in remote verification', async () => {
    const fixture = await writeFixture({ crowdHtmlEntryAssets: true });

    const contract = await createReleaseContract({ distDir: fixture });
    const targetPaths = contract.targets.map((target) => target.requestPath);

    expect(targetPaths).toEqual(expect.arrayContaining(EARLY_ASSETS));
    expect(
      contract.targets.filter((target) =>
        target.requestPath.startsWith('/assets/')
      )
    ).toHaveLength(contract.assetInventory.count + 1);
  });

  it('rejects a contract whose hashed target set no longer matches its bounded inventory', async () => {
    const fixture = await writeFixture({ crowdHtmlEntryAssets: true });
    const contract = await createReleaseContract({ distDir: fixture });
    const missingTarget = structuredClone(contract);
    missingTarget.targets = missingTarget.targets.filter(
      (target) => target.requestPath !== EARLY_ASSETS.at(-1)
    );

    expect(() => validateReleaseContract(missingTarget)).toThrow(
      'release contract hashed asset target count mismatch'
    );

    const overLimit = structuredClone(contract);
    overLimit.assetInventory.count = 1025;
    expect(() => validateReleaseContract(overLimit)).toThrow(
      'release contract hashed asset inventory is invalid'
    );
  });

  it('fails remote verification when any non-entry lazy asset is unavailable', async () => {
    const fixture = await writeFixture({ crowdHtmlEntryAssets: true });
    const contract = await createReleaseContract({ distDir: fixture });
    const missingLazyAsset = EARLY_ASSETS.at(-1);
    const { origin, requests } = await startFixtureServer(fixture, {
      missingPaths: new Set([missingLazyAsset]),
    });

    await expect(
      verifyReleaseOrigin({
        origin,
        contract,
        expectedReleaseId: RELEASE_ID,
      })
    ).rejects.toThrow(`${missingLazyAsset} returned HTTP 404; expected 200`);
    expect(requests).toContain(missingLazyAsset);
  });

  it('requires a generated manual index with the matching document marker and version', async () => {
    const missingManual = await writeFixture({ omitManualIndex: true });
    await expect(
      createReleaseContract({ distDir: missingManual })
    ).rejects.toThrow(
      'required build file is unavailable: user-manual/index.html'
    );

    const wrongMarker = await writeFixture({
      manualDocumentMarker: 'application-shell',
    });
    await expect(
      createReleaseContract({ distDir: wrongMarker })
    ).rejects.toThrow(
      'user-manual/index.html is missing the user-manual document marker'
    );

    const wrongVersion = await writeFixture({ manualVersion: '1.2.2' });
    await expect(
      createReleaseContract({ distDir: wrongVersion })
    ).rejects.toThrow(
      'user-manual/index.html version does not match version.json.version'
    );
  });

  it('rejects an app-shell fallback returned for the manual entry', async () => {
    const fixture = await writeFixture();
    const contract = await createReleaseContract({ distDir: fixture });
    const appShell = await readFile(path.join(fixture, 'index.html'));
    const { origin } = await startFixtureServer(fixture, {
      bodyOverrides: new Map([['/user-manual/index.html', appShell]]),
    });

    await expect(
      verifyReleaseOrigin({
        origin,
        contract,
        expectedReleaseId: RELEASE_ID,
      })
    ).rejects.toThrow('/user-manual/index.html byte identity mismatch');
  });

  it('rejects an index.html hashed entry whose bytes are absent even when manifest samples remain valid', async () => {
    const fixture = await writeFixture({
      crowdHtmlEntryAssets: true,
      omitHtmlEntryFiles: true,
      omitHtmlEntriesFromManifests: true,
    });

    await expect(createReleaseContract({ distDir: fixture })).rejects.toThrow(
      `index.html references a missing hashed asset: ${JS_ASSET}`
    );
  });

  it('rejects legacy release metadata unless the diagnostic flag is explicit', async () => {
    const fixture = await writeFixture({ includeReleaseId: false });

    await expect(createReleaseContract({ distDir: fixture })).rejects.toThrow(
      'version.json.releaseId must be a non-legacy URL-safe release identity'
    );

    const legacyContract = await createReleaseContract({
      distDir: fixture,
      allowLegacyIdentity: true,
    });
    expect(legacyContract.identity.releaseId).toBe(
      `legacy:1.2.3:${RELEASE_ID}`
    );
  });

  it('rejects immutable-directory files without a Vite content hash', async () => {
    const fixture = await writeFixture({ unhashedAsset: true });

    await expect(createReleaseContract({ distDir: fixture })).rejects.toThrow(
      'unhashed file in /assets would receive immutable caching: /assets/unhashed.js'
    );
  });

  it('rejects a manifest that references bytes absent from the candidate', async () => {
    const fixture = await writeFixture({ missingManifestAsset: true });

    await expect(createReleaseContract({ distDir: fixture })).rejects.toThrow(
      'manifest references a missing asset: /assets/missing-Zz99_aa1.js'
    );
  });

  it('rejects mixed release identities across version and cache manifests', async () => {
    const fixture = await writeFixture({
      manifestReleaseId: 'different-release',
    });

    await expect(createReleaseContract({ distDir: fixture })).rejects.toThrow(
      'precache-manifest.json.releaseId does not match version.json.releaseId'
    );
  });

  it('verifies status, final URL, release identity, bytes, headers, MIME, validators, and SPA fallback', async () => {
    const fixture = await writeFixture();
    const contract = await createReleaseContract({ distDir: fixture });
    const { origin, requests } = await startFixtureServer(fixture);

    const result = await verifyReleaseOrigin({
      origin,
      contract,
      expectedReleaseId: RELEASE_ID,
    });

    expect(result.releaseId).toBe(RELEASE_ID);
    expect(result.checkedTargets).toHaveLength(contract.targets.length);
    expect(requests).toContain('/__release_gate__/spa-navigation');
    expect(
      result.checkedTargets.find((target) => target.path === '/version.json')
    ).toMatchObject({
      status: 200,
      cacheControl: NO_STORE_CACHE_CONTROL,
      contentType: 'application/json',
    });
  });

  it('fails closed on a cache-policy mismatch before checking later release files', async () => {
    const fixture = await writeFixture();
    const contract = await createReleaseContract({ distDir: fixture });
    const { origin, requests } = await startFixtureServer(fixture, {
      cacheOverrides: new Map([['/sw.js', HTML_CACHE_CONTROL]]),
    });

    await expect(
      verifyReleaseOrigin({
        origin,
        contract,
        expectedReleaseId: RELEASE_ID,
      })
    ).rejects.toThrow('/sw.js Cache-Control mismatch');
    expect(requests).toEqual(['/', '/index.html', '/sw.js']);
  });

  it('fails when a missing content-hashed asset is served with immutable caching', async () => {
    const fixture = await writeFixture();
    const contract = await createReleaseContract({ distDir: fixture });
    const { origin } = await startFixtureServer(fixture, {
      cacheOverrides: new Map([
        [MISSING_HASHED_ASSET, IMMUTABLE_CACHE_CONTROL],
      ]),
    });

    await expect(
      verifyReleaseOrigin({
        origin,
        contract,
        expectedReleaseId: RELEASE_ID,
      })
    ).rejects.toThrow(
      `${MISSING_HASHED_ASSET} must not return immutable caching on HTTP 404`
    );
  });

  it('fails closed when public bytes differ from the approved candidate', async () => {
    const fixture = await writeFixture();
    const contract = await createReleaseContract({ distDir: fixture });
    const { origin } = await startFixtureServer(fixture, {
      bodyOverrides: new Map([
        ['/version.json', Buffer.from('{"releaseId":"different"}')],
      ]),
    });

    await expect(
      verifyReleaseOrigin({
        origin,
        contract,
        expectedReleaseId: RELEASE_ID,
      })
    ).rejects.toThrow('/version.json byte identity mismatch');
  });

  it('rejects credential-bearing origins and mutable contract policies', async () => {
    const fixture = await writeFixture();
    const contract = await createReleaseContract({ distDir: fixture });

    await expect(
      verifyReleaseOrigin({
        origin: 'https://user:secret@example.com',
        contract,
        expectedReleaseId: RELEASE_ID,
      })
    ).rejects.toThrow('origin must not contain credentials');

    const altered = structuredClone(contract);
    altered.targets.find(
      (target) => target.requestPath === '/sw.js'
    ).cacheControl = HTML_CACHE_CONTROL;
    expect(() => validateReleaseContract(altered)).toThrow(
      'release contract policy mismatch for /sw.js'
    );
  });
});

describe('container Nginx release policy', () => {
  it('does not attach one-year immutable caching to hashed-asset error responses', async () => {
    const nginxConfig = await readFile('docker/nginx.conf', 'utf8');

    expect(nginxConfig).toContain(
      'add_header Cache-Control "public, max-age=31536000, immutable";'
    );
    expect(nginxConfig).not.toContain(
      'add_header Cache-Control "public, max-age=31536000, immutable" always;'
    );
  });

  it('treats HTML document extensions case-insensitively before the SPA fallback', async () => {
    const nginxConfig = await readFile('docker/nginx.conf', 'utf8');

    expect(nginxConfig).toContain('location ~* \\.html$');
    expect(nginxConfig).not.toContain('location ~ \\.html$');
  });

  it('declares MIME types omitted by the pinned Nginx font table', async () => {
    const nginxConfig = await readFile('docker/nginx.conf', 'utf8');

    expect(nginxConfig).toContain('font/otf otf;');
    expect(nginxConfig).toContain('font/ttf ttf;');
  });

  it('serves the portable release text formats with gzip without changing cache locations', async () => {
    const nginxConfig = await readFile('docker/nginx.conf', 'utf8');

    expect(nginxConfig).toContain('gzip on;');
    expect(nginxConfig).toContain('gzip_vary on;');
    expect(nginxConfig).toContain('gzip_min_length 1024;');
    expect(nginxConfig).toContain('gzip_comp_level 6;');
    expect(nginxConfig).toContain('gzip_proxied any;');
    expect(nginxConfig).toMatch(
      /gzip_types[\s\S]*text\/css[\s\S]*application\/javascript[\s\S]*application\/json[\s\S]*application\/manifest\+json[\s\S]*image\/svg\+xml;/
    );

    expect(nginxConfig).toContain(
      'add_header Cache-Control "public, max-age=31536000, immutable";'
    );
    expect(nginxConfig).toContain(
      'add_header Cache-Control "no-cache, max-age=0, must-revalidate" always;'
    );
    expect(nginxConfig).toContain(
      'add_header Cache-Control "no-store" always;'
    );
  });
});

describe('release display-version preflight', () => {
  it('accepts the single canonical tag for the package and metadata version', () => {
    expect(
      validateReleaseVersionPreflight({
        tag: 'v1.2.3',
        packageVersion: '1.2.3',
        metadataVersion: '1.2.3',
      })
    ).toEqual({ tag: 'v1.2.3', version: '1.2.3' });
  });

  it('rejects a dated tag that would publish different bytes under the same semver', () => {
    expect(() =>
      validateReleaseVersionPreflight({
        tag: 'v1.2.3-20260802',
        packageVersion: '1.2.3',
        metadataVersion: '1.2.3',
      })
    ).toThrow(
      'release tag must be exactly v1.2.3; refusing to publish different bytes under display version 1.2.3'
    );
  });

  it('rejects package and version metadata disagreement before building', () => {
    expect(() =>
      validateReleaseVersionPreflight({
        tag: 'v1.2.3',
        packageVersion: '1.2.3',
        metadataVersion: '1.2.2',
      })
    ).toThrow(
      'version.json.version 1.2.2 does not match package.json.version 1.2.3'
    );
  });

  it('allows an idempotent retry only for the exact already-published image', () => {
    const imageId = `sha256:${'a'.repeat(64)}`;
    expect(
      validatePublishedVersionImage({
        versionTag: 'ghcr.io/cengyj/drawnix:v1.2.3',
        candidateImageId: imageId,
        publishedImageId: imageId,
      })
    ).toEqual({
      versionTag: 'ghcr.io/cengyj/drawnix:v1.2.3',
      imageId,
    });
  });

  it('rejects different bytes under an already-published semver tag', () => {
    expect(() =>
      validatePublishedVersionImage({
        versionTag: 'ghcr.io/cengyj/drawnix:v1.2.3',
        candidateImageId: `sha256:${'a'.repeat(64)}`,
        publishedImageId: `sha256:${'b'.repeat(64)}`,
      })
    ).toThrow(
      'refusing to overwrite immutable version tag ghcr.io/cengyj/drawnix:v1.2.3 with different image bytes'
    );
  });
});

describe('container release promotion recovery', () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  const ghcr = 'ghcr.io/cengyj/drawnix:v1.2.3';
  const dockerHub = 'pubuzhixing/drawnix:v1.2.3';

  it('builds only when no immutable version image has been published', () => {
    expect(
      createContainerPromotionPlan({
        targets: [
          { name: 'ghcr', image: ghcr, imageId: null },
          { name: 'dockerhub', image: dockerHub, imageId: null },
        ],
      })
    ).toEqual({
      mode: 'build',
      source: null,
      imageId: null,
      immutableTargets: [ghcr, dockerHub],
    });
  });

  it('recovers the verified immutable GHCR image after a partial publish', () => {
    expect(
      createContainerPromotionPlan({
        targets: [
          { name: 'ghcr', image: ghcr, imageId },
          { name: 'dockerhub', image: dockerHub, imageId: null },
        ],
      })
    ).toEqual({
      mode: 'recover',
      source: ghcr,
      imageId,
      immutableTargets: [dockerHub],
    });
  });

  it('can recover the only published immutable mirror regardless of registry', () => {
    expect(
      createContainerPromotionPlan({
        targets: [
          { name: 'ghcr', image: ghcr, imageId: null },
          { name: 'dockerhub', image: dockerHub, imageId },
        ],
      })
    ).toMatchObject({
      mode: 'recover',
      source: dockerHub,
      imageId,
      immutableTargets: [ghcr],
    });
  });

  it('rejects conflicting immutable version images before mutable promotion', () => {
    expect(() =>
      createContainerPromotionPlan({
        targets: [
          { name: 'ghcr', image: ghcr, imageId },
          {
            name: 'dockerhub',
            image: dockerHub,
            imageId: `sha256:${'b'.repeat(64)}`,
          },
        ],
      })
    ).toThrow('immutable version tags contain different image bytes');
  });
});

describe('mutable latest promotion authorization', () => {
  const candidateImageId = `sha256:${'c'.repeat(64)}`;
  const candidateReleaseId = 'candidate-release-1.0.3';
  const ghcrLatest = 'ghcr.io/cengyj/drawnix:latest';
  const dockerHubLatest = 'pubuzhixing/drawnix:latest';

  const target = (
    name,
    image,
    version,
    imageId = `sha256:${(name === 'ghcr' ? 'a' : 'b').repeat(64)}`,
    releaseId = `${name}-release-${version}`
  ) => ({ name, image, version, imageId, releaseId });

  it('orders stable and prerelease SemVer without using workflow start order', () => {
    expect(compareSemverPrecedence('1.0.3', '1.0.2')).toBe(1);
    expect(compareSemverPrecedence('1.0.3-rc.2', '1.0.3-rc.10')).toBe(-1);
    expect(compareSemverPrecedence('1.0.3', '1.0.3-rc.10')).toBe(1);
    expect(compareSemverPrecedence('1.0.3+build.2', '1.0.3+build.1')).toBe(0);
  });

  it('rejects a historical tag before any latest target is authorized', () => {
    expect(() =>
      createLatestContainerPromotionPlan({
        candidateVersion: '1.0.2',
        candidateImageId,
        candidateReleaseId,
        targets: [
          target('ghcr', ghcrLatest, '1.0.3'),
          target('dockerhub', dockerHubLatest, '1.0.3'),
        ],
      })
    ).toThrow(
      'refusing to move ghcr.io/cengyj/drawnix:latest latest backwards from 1.0.3 to 1.0.2'
    );
  });

  it('treats the exact current candidate as an idempotent no-op', () => {
    expect(
      createLatestContainerPromotionPlan({
        candidateVersion: '1.0.3',
        candidateImageId,
        candidateReleaseId,
        targets: [
          target(
            'ghcr',
            ghcrLatest,
            '1.0.3',
            candidateImageId,
            candidateReleaseId
          ),
          target(
            'dockerhub',
            dockerHubLatest,
            '1.0.3',
            candidateImageId,
            candidateReleaseId
          ),
        ],
      })
    ).toMatchObject({
      mode: 'noop',
      promotionTargets: [],
      alreadyPromotedTargets: [ghcrLatest, dockerHubLatest],
    });
  });

  it('rejects same-version latest bytes that do not match the immutable candidate', () => {
    expect(() =>
      createLatestContainerPromotionPlan({
        candidateVersion: '1.0.3',
        candidateImageId,
        candidateReleaseId,
        targets: [target('ghcr', ghcrLatest, '1.0.3')],
      })
    ).toThrow(
      'latest ghcr.io/cengyj/drawnix:latest already advertises 1.0.3 with different image bytes'
    );
  });

  it('authorizes only the lagging registry during partial-promotion recovery', () => {
    expect(
      createLatestContainerPromotionPlan({
        candidateVersion: '1.0.3',
        candidateImageId,
        candidateReleaseId,
        targets: [
          target(
            'ghcr',
            ghcrLatest,
            '1.0.3',
            candidateImageId,
            candidateReleaseId
          ),
          target('dockerhub', dockerHubLatest, '1.0.2'),
        ],
      })
    ).toMatchObject({
      mode: 'recover',
      promotionTargets: [dockerHubLatest],
      alreadyPromotedTargets: [ghcrLatest],
    });
  });

  it('authorizes a forward promotion when latest is older or missing', () => {
    expect(
      createLatestContainerPromotionPlan({
        candidateVersion: '1.0.3',
        candidateImageId,
        candidateReleaseId,
        targets: [
          target('ghcr', ghcrLatest, '1.0.2'),
          {
            name: 'dockerhub',
            image: dockerHubLatest,
            imageId: null,
            version: null,
            releaseId: null,
          },
        ],
      })
    ).toMatchObject({
      mode: 'promote',
      promotionTargets: [ghcrLatest, dockerHubLatest],
      alreadyPromotedTargets: [],
    });
  });

  it('allows the proven legacy version.json boundary only for a strict forward move', () => {
    expect(
      createLatestContainerPromotionPlan({
        candidateVersion: '1.0.3',
        candidateImageId,
        candidateReleaseId,
        targets: [
          {
            name: 'ghcr',
            image: ghcrLatest,
            imageId: `sha256:${'a'.repeat(64)}`,
            version: '1.0.2',
            releaseId: null,
          },
        ],
      })
    ).toMatchObject({
      mode: 'promote',
      promotionTargets: [ghcrLatest],
    });

    expect(() =>
      createLatestContainerPromotionPlan({
        candidateVersion: '1.0.2',
        candidateImageId,
        candidateReleaseId,
        targets: [
          {
            name: 'ghcr',
            image: ghcrLatest,
            imageId: `sha256:${'a'.repeat(64)}`,
            version: '1.0.2',
            releaseId: null,
          },
        ],
      })
    ).toThrow(
      'latest ghcr.io/cengyj/drawnix:latest already advertises 1.0.2 with different image bytes'
    );
  });

  it('fails closed for an existing latest image with missing release labels', () => {
    expect(() =>
      createLatestContainerPromotionPlan({
        candidateVersion: '1.0.3',
        candidateImageId,
        candidateReleaseId,
        targets: [
          {
            name: 'ghcr',
            image: ghcrLatest,
            imageId: `sha256:${'a'.repeat(64)}`,
            version: null,
            releaseId: null,
          },
        ],
      })
    ).toThrow(
      'latest version for ghcr.io/cengyj/drawnix:latest is not valid semver'
    );
  });
});

describe('publish workflow promotion ordering', () => {
  it('recovers an immutable version image without rebuilding and authorizes latest only after all version tags', async () => {
    const workflow = await readFile('.github/workflows/publish.yml', 'utf8');
    const resolveIndex = workflow.indexOf(
      'Resolve immutable version image for build or recovery'
    );
    const buildIndex = workflow.indexOf('Build exact candidate image');
    const verifyIndex = workflow.indexOf('Verify approved release image');
    const immutableIndex = workflow.indexOf('Publish immutable version tags');
    const ghcrVersionIndex = workflow.indexOf(
      'publish_immutable_version "ghcr.io/${IMAGE_OWNER}/drawnix:${TAG}"'
    );
    const dockerHubVersionIndex = workflow.indexOf(
      'publish_immutable_version "pubuzhixing/drawnix:${TAG}"'
    );
    const authorizeLatestIndex = workflow.indexOf(
      'Authorize and converge mutable latest aliases'
    );
    const latestPlanIndex = workflow.indexOf('plan-latest-promotion');

    expect(resolveIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(resolveIndex);
    expect(verifyIndex).toBeGreaterThan(buildIndex);
    expect(workflow).toContain(
      "if: steps.release_image.outputs.mode == 'build'"
    );
    expect(workflow).toContain(
      'docker tag "${source_image}" "${approved_image}"'
    );
    expect(immutableIndex).toBeGreaterThan(verifyIndex);
    expect(ghcrVersionIndex).toBeGreaterThan(immutableIndex);
    expect(dockerHubVersionIndex).toBeGreaterThan(ghcrVersionIndex);
    expect(authorizeLatestIndex).toBeGreaterThan(dockerHubVersionIndex);
    expect(latestPlanIndex).toBeGreaterThan(authorizeLatestIndex);
    expect(workflow).toContain('--ghcr-version "${latest_versions[ghcr]}"');
    expect(workflow).toContain(
      '--ghcr-release-id "${latest_release_ids[ghcr]}"'
    );
    expect(workflow).toContain('attempting guarded rollback');
    expect(workflow).not.toContain(
      'Promote approved image to GitHub Container Registry latest'
    );
    expect(workflow).not.toContain(
      'Promote approved image to Docker Hub latest'
    );
  });

  it('combines serialization with an explicit monotonic latest-version fence', async () => {
    const workflow = await readFile('.github/workflows/publish.yml', 'utf8');

    expect(workflow).toMatch(
      /concurrency:\s*\n\s+group: publish-container-release\s*\n\s+cancel-in-progress: false/
    );
    expect(workflow).not.toContain('group: publish-${{ github.ref }}');
    expect(workflow).toContain('plan-latest-promotion');
    expect(workflow).toContain('--candidate-version "${PACKAGE_VERSION}"');
    expect(workflow).toContain('--candidate-image-id "${approved_id}"');
    expect(workflow).toContain('--candidate-release-id "${GITHUB_SHA}"');
  });
});

describe('container image metadata contract', () => {
  const labels = {
    'io.opentu.release-id': RELEASE_ID,
    'org.opencontainers.image.version': '1.2.3',
    'org.opencontainers.image.revision': RELEASE_ID,
  };

  it('keeps display version, source revision, and runtime release identity distinct', () => {
    expect(
      validateContainerImageMetadata({
        labels,
        expectedReleaseId: RELEASE_ID,
        expectedVersion: '1.2.3',
        expectedRevision: RELEASE_ID,
      })
    ).toEqual({
      releaseId: RELEASE_ID,
      version: '1.2.3',
      revision: RELEASE_ID,
    });
  });

  it.each([
    ['io.opentu.release-id', 'different-release', 'release-id mismatch'],
    ['org.opencontainers.image.version', '1.2.4', 'version mismatch'],
    [
      'org.opencontainers.image.revision',
      'different-revision',
      'revision mismatch',
    ],
  ])('rejects a mismatched %s label', (label, value, message) => {
    expect(() =>
      validateContainerImageMetadata({
        labels: { ...labels, [label]: value },
        expectedReleaseId: RELEASE_ID,
        expectedVersion: '1.2.3',
        expectedRevision: RELEASE_ID,
      })
    ).toThrow(message);
  });

  it('rejects a published image without a source revision label', () => {
    const labelsWithoutRevision = { ...labels };
    delete labelsWithoutRevision['org.opencontainers.image.revision'];

    expect(() =>
      validateContainerImageMetadata({
        labels: labelsWithoutRevision,
        expectedReleaseId: RELEASE_ID,
        expectedVersion: '1.2.3',
      })
    ).toThrow('org.opencontainers.image.revision is missing or reserved');
  });
});
