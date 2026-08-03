import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  REQUIRED_DRAWNIX_DECLARATIONS,
  scanDrawnixDeclarations,
  verifyDrawnixDeclarationDirectory,
} from './verify-drawnix-declarations.mjs';

const temporaryDirectories = [];
const FIXTURE_WORKSPACE_ROOT = '/workspace/opentu';

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function createDeclarationFixture(overrides = new Map()) {
  const fixtureRoot = await mkdtemp(
    path.join(tmpdir(), 'opentu-drawnix-declaration-fixture-')
  );
  temporaryDirectories.push(fixtureRoot);

  for (const declarationPath of REQUIRED_DRAWNIX_DECLARATIONS) {
    const content = overrides.has(declarationPath)
      ? overrides.get(declarationPath)
      : 'export interface PortableDeclaration {}\n';
    if (content === null) {
      continue;
    }

    const absolutePath = path.join(fixtureRoot, declarationPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }

  return fixtureRoot;
}

describe('Drawnix declaration portability contract', () => {
  it('accepts complete declarations that reference public package types', async () => {
    const fixtureRoot = await createDeclarationFixture(
      new Map([
        [
          'packages/drawnix/src/components/popover/popover.d.ts',
          "import type { UseFloatingReturn } from '@floating-ui/react';\nexport type PopoverReturn = UseFloatingReturn;\n",
        ],
      ])
    );

    await expect(
      verifyDrawnixDeclarationDirectory(fixtureRoot, {
        workspaceRoot: FIXTURE_WORKSPACE_ROOT,
      })
    ).resolves.toMatchObject({
      declarationCount: REQUIRED_DRAWNIX_DECLARATIONS.length,
      leaks: [],
      missingRequiredDeclarations: [],
      valid: true,
    });
  });

  it('rejects an incomplete declaration output', async () => {
    const missingPath = 'packages/drawnix/src/components/dialog/dialog.d.ts';
    const fixtureRoot = await createDeclarationFixture(
      new Map([[missingPath, null]])
    );

    await expect(
      verifyDrawnixDeclarationDirectory(fixtureRoot, {
        workspaceRoot: FIXTURE_WORKSPACE_ROOT,
      })
    ).rejects.toThrow(`missing required declarations: ${missingPath}`);
  });

  it('reports pnpm, transitive dependency, and workspace path leaks', async () => {
    const leakingDeclaration = [
      "type A = import('node_modules/.pnpm/@floating-ui+react-dom@2.1.6/node_modules/@floating-ui/react-dom').UseFloatingReturn;",
      `type B = import('${FIXTURE_WORKSPACE_ROOT}/packages/drawnix/src/private-types').PrivateType;`,
    ].join('\n');
    const fixtureRoot = await createDeclarationFixture(
      new Map([
        [
          'packages/drawnix/src/components/popover/popover.d.ts',
          leakingDeclaration,
        ],
      ])
    );

    await expect(
      verifyDrawnixDeclarationDirectory(fixtureRoot, {
        workspaceRoot: FIXTURE_WORKSPACE_ROOT,
      })
    ).rejects.toThrow('non-portable declarations');

    const declarationFiles = new Map(
      REQUIRED_DRAWNIX_DECLARATIONS.map((declarationPath) => [
        declarationPath,
        'export interface PortableDeclaration {}\n',
      ])
    );
    declarationFiles.set(
      'packages/drawnix/src/components/popover/popover.d.ts',
      leakingDeclaration
    );

    const report = scanDrawnixDeclarations(declarationFiles, {
      workspaceRoot: FIXTURE_WORKSPACE_ROOT,
    });

    expect(report.valid).toBe(false);
    expect(report.missingRequiredDeclarations).toEqual([]);
    expect(report.leaks.map(({ kind }) => kind)).toEqual([
      'pnpm-node-modules-path',
      'physical-pnpm-path',
      'transitive-floating-ui-type',
      'absolute-workspace-path',
    ]);
  });
});
