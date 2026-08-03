import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertLintScopeCoverage,
  assertLintTargetContracts,
  compareFingerprintInventories,
  createDiagnosticFingerprint,
  createDiagnosticInventory,
  createHoverFingerprint,
  createScopeContractHash,
  findUnexpectedlyUnscannedFiles,
  parseHoverCommandResult,
  parseStrictJsonOutput,
  validateGeneratedFrom,
  validateProjectBaseline,
} from './lint-regression-gate.mjs';

const FIXTURE_ROOT = '/workspace/opentu';

function result({
  filePath = '/workspace/opentu/apps/web/src/app.ts',
  source = 'const value: any = input;\n',
  messages = [],
} = {}) {
  return { filePath, source, messages };
}

function message(overrides = {}) {
  return {
    ruleId: '@typescript-eslint/no-explicit-any',
    severity: 1,
    message: 'Unexpected any. Specify a different type.',
    messageId: 'unexpectedAny',
    line: 1,
    column: 14,
    fatal: false,
    ...overrides,
  };
}

describe('lint regression gate', () => {
  it('keeps fingerprints stable when only line numbers move', () => {
    const first = createDiagnosticFingerprint(
      {
        project: 'web',
        filePath: path.join(FIXTURE_ROOT, 'apps/web/src/app.ts'),
        severity: 1,
        ruleId: 'rule',
        message: 'diagnostic',
        sourceLine: 'const value = legacy;',
      },
      { workspaceRoot: FIXTURE_ROOT }
    );
    const moved = createDiagnosticFingerprint(
      {
        project: 'web',
        filePath: path.join(FIXTURE_ROOT, 'apps/web/src/app.ts'),
        severity: 1,
        ruleId: 'rule',
        message: 'diagnostic',
        sourceLine: '  const   value = legacy;  ',
      },
      { workspaceRoot: FIXTURE_ROOT }
    );

    expect(moved.fingerprint).toBe(first.fingerprint);
  });

  it('ignores parameterized message churn when ESLint provides messageId', () => {
    const base = {
      project: 'web',
      filePath: path.join(FIXTURE_ROOT, 'apps/web/src/app.ts'),
      severity: 2,
      ruleId: '@nx/enforce-module-boundaries',
      messageId: 'noImportsOfLazyLoadedLibraries',
      message: 'Static imports include lazy files: a.ts, b.ts',
      sourceExcerpt: "import { value } from '@drawnix/drawnix';",
    };
    const changedParameters = {
      ...base,
      message: 'Static imports include lazy files: a.ts, b.ts, unrelated.ts',
    };

    expect(
      createDiagnosticFingerprint(base, { workspaceRoot: FIXTURE_ROOT })
        .fingerprint
    ).toBe(
      createDiagnosticFingerprint(changedParameters, {
        workspaceRoot: FIXTURE_ROOT,
      }).fingerprint
    );
  });

  it('uses the diagnostic node instead of unrelated surrounding source', () => {
    const first = createDiagnosticInventory(
      'web',
      [
        result({
          source: 'const before = 1; forbiddenCall(); const after = 1;\n',
          messages: [
            message({
              ruleId: 'rule',
              messageId: 'forbidden',
              column: 19,
              endLine: 1,
              endColumn: 34,
            }),
          ],
        }),
      ],
      { workspaceRoot: FIXTURE_ROOT }
    );
    const surroundingChange = createDiagnosticInventory(
      'web',
      [
        result({
          source: 'const before = 2; forbiddenCall(); const after = 9;\n',
          messages: [
            message({
              ruleId: 'rule',
              messageId: 'forbidden',
              column: 19,
              endLine: 1,
              endColumn: 34,
            }),
          ],
        }),
      ],
      { workspaceRoot: FIXTURE_ROOT }
    );

    expect(surroundingChange.fingerprints).toEqual(first.fingerprints);
  });

  it('detects a new diagnostic even when the total count is unchanged', () => {
    const comparison = compareFingerprintInventories(
      { old: 1 },
      { replacement: 1 }
    );
    expect(comparison.additions).toEqual([
      { fingerprint: 'replacement', count: 1 },
    ]);
    expect(comparison.reductions).toEqual([{ fingerprint: 'old', count: 1 }]);
  });

  it('detects an increased duplicate count', () => {
    expect(
      compareFingerprintInventories({ repeated: 2 }, { repeated: 3 }).additions
    ).toEqual([{ fingerprint: 'repeated', count: 1 }]);
  });

  it('detects brand new warning and error diagnostics', () => {
    const warning = createDiagnosticInventory(
      'web',
      [result({ messages: [message()] })],
      { workspaceRoot: FIXTURE_ROOT }
    );
    const error = createDiagnosticInventory(
      'web',
      [result({ messages: [message({ severity: 2 })] })],
      { workspaceRoot: FIXTURE_ROOT }
    );

    expect(
      compareFingerprintInventories({}, warning.fingerprints).additions
    ).toHaveLength(1);
    expect(
      compareFingerprintInventories({}, error.fingerprints).additions
    ).toHaveLength(1);
  });

  it('reports historical diagnostic reductions for an explicit ratchet', () => {
    const comparison = compareFingerprintInventories(
      { legacy: 2 },
      { legacy: 1 }
    );
    expect(comparison.additions).toEqual([]);
    expect(comparison.reductions).toEqual([
      { fingerprint: 'legacy', count: 1 },
    ]);
  });

  it('treats a severity change as a new diagnostic', () => {
    const warning = createDiagnosticInventory(
      'web',
      [result({ messages: [message()] })],
      { workspaceRoot: FIXTURE_ROOT }
    );
    const error = createDiagnosticInventory(
      'web',
      [
        result({
          messages: [message({ severity: 2 })],
        }),
      ],
      { workspaceRoot: FIXTURE_ROOT }
    );

    const comparison = compareFingerprintInventories(
      warning.fingerprints,
      error.fingerprints
    );
    expect(comparison.additions).toHaveLength(1);
    expect(comparison.reductions).toHaveLength(1);
  });

  it('treats file, rule, and source identity changes as new diagnostics', () => {
    const base = {
      project: 'web',
      filePath: path.join(FIXTURE_ROOT, 'apps/web/src/app.ts'),
      severity: 1,
      ruleId: 'rule-a',
      message: 'diagnostic',
      sourceLine: 'const value = legacy;',
    };
    const baseline = createDiagnosticFingerprint(base, {
      workspaceRoot: FIXTURE_ROOT,
    }).fingerprint;
    const variants = [
      { ...base, filePath: path.join(FIXTURE_ROOT, 'apps/web/src/other.ts') },
      { ...base, ruleId: 'rule-b' },
      { ...base, sourceLine: 'const value = replacement;' },
    ];

    for (const variant of variants) {
      const current = createDiagnosticFingerprint(variant, {
        workspaceRoot: FIXTURE_ROOT,
      }).fingerprint;
      expect(
        compareFingerprintInventories({ [baseline]: 1 }, { [current]: 1 })
          .additions
      ).toHaveLength(1);
    }
  });

  it('detects a new hover-policy finding', () => {
    const legacy = createHoverFingerprint({
      path: 'src/components/Legacy.tsx',
      ruleId: 'native-title',
    });
    const added = createHoverFingerprint({
      path: 'src/components/New.tsx',
      ruleId: 'native-title',
    });
    expect(
      compareFingerprintInventories(
        { [legacy]: 1 },
        { [legacy]: 1, [added]: 1 }
      ).additions
    ).toEqual([{ fingerprint: added, count: 1 }]);
  });

  it('keeps fatal parser diagnostics outside the baseline inventory', () => {
    const inventory = createDiagnosticInventory(
      'web',
      [result({ messages: [message({ fatal: true, ruleId: null })] })],
      { workspaceRoot: FIXTURE_ROOT }
    );
    expect(inventory.fatalDiagnostics).toHaveLength(1);
    expect(inventory.fingerprints).toEqual({});
  });

  it('rejects corrupt baseline totals and incomplete project coverage', () => {
    expect(() =>
      validateProjectBaseline('web', {
        errors: 1,
        warnings: 0,
        files: [],
        fingerprints: {},
      })
    ).toThrow('baseline total mismatch');

    expect(() =>
      validateProjectBaseline('web', {
        errors: 1,
        warnings: 0,
        files: [],
        fingerprints: { invalid: 1 },
      })
    ).toThrow('Invalid lint fingerprint');

    expect(() =>
      assertLintScopeCoverage(
        ['web', 'utils'],
        [{ project: 'web' }, { project: 'drawnix' }]
      )
    ).toThrow('Lint scope coverage mismatch');
  });

  it('rejects Nx target drift and scope contract drift', () => {
    const scope = {
      project: 'web',
      target: {
        executor: 'nx:run-commands',
        cwd: 'apps/web',
        command: 'eslint .',
      },
    };
    expect(() =>
      assertLintTargetContracts(
        {
          web: {
            executor: 'nx:run-commands',
            options: { cwd: 'apps/web', command: 'eslint src' },
          },
        },
        [scope]
      )
    ).toThrow('Lint target contract mismatch');

    expect(createScopeContractHash({ config: 'a' })).not.toBe(
      createScopeContractHash({ config: 'b' })
    );
  });

  it('rejects an existing baseline file that silently leaves lint scope', () => {
    expect(
      findUnexpectedlyUnscannedFiles(
        ['apps/web/src/a.ts', 'apps/web/src/deleted.ts'],
        [],
        { fileExists: (file) => file.endsWith('/a.ts') }
      )
    ).toEqual(['apps/web/src/a.ts']);
  });

  it('validates the baseline commit identity format', () => {
    expect(() => validateGeneratedFrom('not-a-sha')).toThrow(
      '40-character Git SHA'
    );
    expect(() => validateGeneratedFrom('a'.repeat(40))).not.toThrow();
  });

  it('accepts complete versioned hover JSON with matching exit status', () => {
    const payload = {
      schemaVersion: 1,
      check: 'drawnix-hover-policy',
      roots: ['src/components', 'src/tools'],
      scannedFiles: 10,
      violations: [
        {
          path: 'src/components/Button.tsx',
          ruleId: 'native-title',
          message: 'Native title is forbidden.',
        },
      ],
    };
    expect(
      parseHoverCommandResult({
        code: 1,
        signal: null,
        stdout: JSON.stringify(payload),
        stderr: '',
      })
    ).toEqual(payload);
    expect(
      parseHoverCommandResult({
        code: 0,
        signal: null,
        stdout: JSON.stringify({ ...payload, violations: [] }),
        stderr: '',
      }).violations
    ).toEqual([]);
  });

  it('fails closed for partial, contradictory, or crashed hover output', () => {
    const emptyPayload = JSON.stringify({
      schemaVersion: 1,
      check: 'drawnix-hover-policy',
      roots: ['src/components', 'src/tools'],
      scannedFiles: 10,
      violations: [],
    });
    expect(() =>
      parseHoverCommandResult({
        code: 1,
        signal: null,
        stdout: emptyPayload.slice(0, -1),
        stderr: '',
      })
    ).toThrow('Cannot parse hover policy JSON');
    expect(() =>
      parseHoverCommandResult({
        code: 1,
        signal: null,
        stdout: emptyPayload,
        stderr: '',
      })
    ).toThrow('failure without violations');
    expect(() =>
      parseHoverCommandResult({
        code: 2,
        signal: null,
        stdout: '',
        stderr: 'scan crashed',
      })
    ).toThrow('failed unexpectedly');
    expect(() =>
      parseHoverCommandResult({
        code: null,
        signal: 'SIGTERM',
        stdout: '',
        stderr: '',
      })
    ).toThrow('failed unexpectedly');
  });

  it('accepts exactly one complete Nx JSON document', () => {
    expect(
      parseStrictJsonOutput('  ["drawnix", "web"]\n', 'Nx project list')
    ).toEqual(['drawnix', 'web']);
    expect(
      parseStrictJsonOutput('{"targets":{"lint":{}}}', 'Nx project web')
    ).toEqual({ targets: { lint: {} } });
  });

  it.each([
    ['stdout prefix', '[Vite] Loaded release abc\n["web"]'],
    ['truncated JSON', '["web"'],
    ['multiple JSON documents', '["web"]\n["drawnix"]'],
    ['stdout suffix', '["web"]\nNx completed'],
    ['empty output', '   \n'],
  ])('rejects %s around Nx JSON', (_caseName, output) => {
    expect(() => parseStrictJsonOutput(output, 'Nx project list')).toThrow(
      'Cannot parse Nx project list'
    );
  });
});
