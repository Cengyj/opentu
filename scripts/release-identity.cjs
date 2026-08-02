const RELEASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const RESERVED_RELEASE_IDS = new Set([
  'unknown',
  'development',
  'dev',
  'local',
]);

function normalizeReleasePart(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function assertReleaseId(value) {
  const normalized = String(value || '').trim();
  if (
    !RELEASE_ID_PATTERN.test(normalized) ||
    RESERVED_RELEASE_IDS.has(normalized.toLowerCase())
  ) {
    throw new Error(
      'releaseId must be a non-reserved, 1-160 character URL/cache-safe identity and start with a letter or digit'
    );
  }
  return normalized;
}

function createReleaseId({ version, explicitReleaseId, gitCommit, buildTime }) {
  if (explicitReleaseId) {
    return assertReleaseId(explicitReleaseId);
  }

  const versionPart = normalizeReleasePart(version) || '0.0.0';
  const commitPart =
    gitCommit && gitCommit !== 'unknown'
      ? normalizeReleasePart(gitCommit).slice(0, 12)
      : '';
  const buildPart = normalizeReleasePart(buildTime);
  const identityParts = [versionPart, commitPart, buildPart].filter(Boolean);

  if (identityParts.length < 2) {
    throw new Error(
      'A unique releaseId requires OPENTU_RELEASE_ID, gitCommit, or buildTime'
    );
  }

  return assertReleaseId(identityParts.join('-'));
}

function resolveReleaseManifest(manifest, env = process.env) {
  const version = String((manifest && manifest.version) || '').trim() || '0.0.0';
  const releaseId = createReleaseId({
    version,
    explicitReleaseId:
      env.OPENTU_RELEASE_ID || (manifest && manifest.releaseId),
    gitCommit: env.GITHUB_SHA || (manifest && manifest.gitCommit),
    buildTime: env.OPENTU_BUILD_TIME || (manifest && manifest.buildTime),
  });

  return { version, releaseId };
}

module.exports = {
  RELEASE_ID_PATTERN,
  RESERVED_RELEASE_IDS,
  assertReleaseId,
  createReleaseId,
  resolveReleaseManifest,
};
