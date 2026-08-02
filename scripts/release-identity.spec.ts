import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createReleaseId, resolveReleaseManifest } = require(
  './release-identity.cjs'
) as {
  createReleaseId: (input: {
    version: string;
    explicitReleaseId?: string;
    gitCommit?: string;
    buildTime?: string;
  }) => string;
  resolveReleaseManifest: (
    manifest: Record<string, unknown>,
    env?: Record<string, string | undefined>
  ) => { version: string; releaseId: string };
};

describe('release identity', () => {
  it('keeps display version separate from an explicit immutable release id', () => {
    expect(
      resolveReleaseManifest(
        { version: '1.0.2', releaseId: '1.0.2-build-a' },
        {}
      )
    ).toEqual({ version: '1.0.2', releaseId: '1.0.2-build-a' });
  });

  it('does not rewrite a valid semver build suffix used by npm CDN URLs', () => {
    expect(
      resolveReleaseManifest(
        {
          version: '1.0.3-beta.1+build.7',
          releaseId: 'release-build-7',
        },
        {}
      )
    ).toEqual({
      version: '1.0.3-beta.1+build.7',
      releaseId: 'release-build-7',
    });
  });

  it('derives a cache-safe identity from commit and build time', () => {
    expect(
      createReleaseId({
        version: '1.0.3',
        gitCommit: 'abcdef1234567890',
        buildTime: '2026-08-02T10:20:30.000Z',
      })
    ).toBe('1.0.3-abcdef123456-2026-08-02T10-20-30.000Z');
  });

  it('rejects a legacy identity without any unique release evidence', () => {
    expect(() =>
      createReleaseId({ version: '1.0.2', gitCommit: 'unknown' })
    ).toThrow(/unique releaseId/);
  });

  it.each(['unknown', 'DEVELOPMENT', 'dev', 'Local'])(
    'rejects the reserved explicit release identity %s',
    (explicitReleaseId) => {
      expect(() =>
        createReleaseId({ version: '1.0.2', explicitReleaseId })
      ).toThrow(/non-reserved/);
    }
  );

  it('derives unique identities when no explicit Docker build identity is supplied', () => {
    const first = createReleaseId({
      version: '1.0.2',
      gitCommit: 'unknown',
      buildTime: '2026-08-02T10:20:30.000Z',
    });
    const second = createReleaseId({
      version: '1.0.2',
      gitCommit: 'unknown',
      buildTime: '2026-08-02T10:20:31.000Z',
    });

    expect(first).toBe('1.0.2-2026-08-02T10-20-30.000Z');
    expect(second).toBe('1.0.2-2026-08-02T10-20-31.000Z');
    expect(first).not.toBe(second);
  });

  it('lets the deployment environment override a checked-in identity', () => {
    expect(
      resolveReleaseManifest(
        { version: '1.0.2', releaseId: 'checked-in' },
        { OPENTU_RELEASE_ID: 'deployed-sha-123' }
      ).releaseId
    ).toBe('deployed-sha-123');
  });
});

describe('Docker release identity boundary', () => {
  it('never injects a reserved fallback identity into either image stage', () => {
    const dockerfile = readFileSync('Dockerfile', 'utf8');
    const releaseArgs = dockerfile.match(/^ARG OPENTU_RELEASE_ID.*$/gm) || [];

    expect(releaseArgs).toEqual([
      'ARG OPENTU_RELEASE_ID',
      'ARG OPENTU_RELEASE_ID',
    ]);
    expect(dockerfile).not.toMatch(/OPENTU_RELEASE_ID\s*=\s*unknown/i);
    expect(dockerfile).toContain('ENV OPENTU_RELEASE_ID=${OPENTU_RELEASE_ID}');
    expect(dockerfile).toContain('ARG OPENTU_DISPLAY_VERSION');
    expect(dockerfile).toContain('io.opentu.release-id=${OPENTU_RELEASE_ID}');
  });
});
