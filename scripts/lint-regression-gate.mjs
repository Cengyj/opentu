#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
export const LINT_BASELINE_PATH = path.join(
  SCRIPT_DIRECTORY,
  'baselines',
  'eslint-diagnostics.json'
);

const FINGERPRINT_SCHEMA_VERSION = 2;
const BASELINE_SCHEMA_VERSION = 2;
const SCOPE_CONTRACT_FILES = Object.freeze([
  '.eslintignore',
  '.eslintrc.json',
  'nx.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'apps/web/.eslintrc.json',
  'apps/web/project.json',
  'apps/web-e2e/.eslintrc.json',
  'apps/web-e2e/project.json',
  'packages/drawnix/.eslintrc.json',
  'packages/drawnix/project.json',
  'packages/react-board/.eslintrc.json',
  'packages/react-board/project.json',
  'packages/react-text/.eslintrc.json',
  'packages/react-text/project.json',
  'packages/utils/.eslintrc.json',
  'packages/utils/project.json',
  'packages/drawnix/scripts/check-hover-usage.mjs',
]);
const LINT_TOOL_PACKAGES = Object.freeze([
  'eslint',
  'nx',
  '@nx/eslint',
  '@nx/eslint-plugin',
  '@nx/devkit',
  '@nx/workspace',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  'eslint-plugin-import',
  'eslint-plugin-jsx-a11y',
  'eslint-plugin-playwright',
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'typescript',
]);

export const LINT_SCOPES = Object.freeze([
  Object.freeze({
    project: 'drawnix',
    cwd: 'packages/drawnix',
    patterns: Object.freeze(['src']),
    extensions: Object.freeze(['.ts', '.tsx', '.js', '.jsx']),
    target: Object.freeze({
      executor: 'nx:run-commands',
      cwd: 'packages/drawnix',
      command:
        'eslint src --ext .ts,.tsx,.js,.jsx; eslint_status=$?; node ./scripts/check-hover-usage.mjs; hover_status=$?; if [ $eslint_status -ne 0 ]; then exit $eslint_status; fi; exit $hover_status',
    }),
  }),
  Object.freeze({
    project: 'react-board',
    cwd: 'packages/react-board',
    patterns: Object.freeze(['.']),
    target: Object.freeze({
      executor: 'nx:run-commands',
      cwd: 'packages/react-board',
      command: 'eslint .',
    }),
  }),
  Object.freeze({
    project: 'react-text',
    cwd: 'packages/react-text',
    patterns: Object.freeze(['.']),
    target: Object.freeze({
      executor: 'nx:run-commands',
      cwd: 'packages/react-text',
      command: 'eslint .',
    }),
  }),
  Object.freeze({
    project: 'utils',
    cwd: '.',
    patterns: Object.freeze(['packages/utils/**/*.ts']),
    target: Object.freeze({
      executor: '@nx/eslint:lint',
      lintFilePatterns: Object.freeze(['packages/utils/**/*.ts']),
    }),
  }),
  Object.freeze({
    project: 'web',
    cwd: 'apps/web',
    patterns: Object.freeze(['.']),
    target: Object.freeze({
      executor: 'nx:run-commands',
      cwd: 'apps/web',
      command: 'eslint .',
    }),
  }),
  Object.freeze({
    project: 'web-e2e',
    cwd: 'apps/web-e2e',
    patterns: Object.freeze(['.']),
    target: Object.freeze({
      executor: 'nx:run-commands',
      cwd: 'apps/web-e2e',
      command: 'eslint .',
    }),
  }),
]);

const HOVER_SCOPE = Object.freeze({
  project: 'drawnix-hover',
  cwd: 'packages/drawnix',
  command: process.execPath,
  args: Object.freeze(['./scripts/check-hover-usage.mjs', '--format=json']),
});

const ANSI_ESCAPE = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function normalizeInlineText(value) {
  return String(value || '')
    .replace(ANSI_ESCAPE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWorkspaceText(value, workspaceRoot) {
  const normalizedRoot = normalizePath(path.resolve(workspaceRoot));
  const nativeRoot = path.resolve(workspaceRoot);
  return normalizeInlineText(value)
    .replaceAll(normalizedRoot, '<workspace>')
    .replaceAll(nativeRoot, '<workspace>');
}

function workspaceRelativePath(filePath, workspaceRoot) {
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(path.resolve(workspaceRoot), absolutePath);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Lint result escaped the workspace: ${absolutePath}`);
  }
  return normalizePath(relativePath);
}

function sourceExcerptAt(source, diagnostic) {
  const line = diagnostic.line;
  const column = diagnostic.column;
  if (!source || !Number.isSafeInteger(line) || line < 1) {
    return '';
  }
  const lines = source.split(/\r?\n/);
  const sourceLine = lines[line - 1] || '';
  if (!Number.isSafeInteger(column) || column < 1) {
    return normalizeInlineText(sourceLine);
  }

  const endLine = diagnostic.endLine;
  const endColumn = diagnostic.endColumn;
  if (
    Number.isSafeInteger(endLine) &&
    endLine >= line &&
    Number.isSafeInteger(endColumn) &&
    endColumn >= 1 &&
    endLine <= lines.length
  ) {
    const excerptLines = lines.slice(line - 1, endLine);
    excerptLines[0] = excerptLines[0].slice(column - 1);
    const lastIndex = excerptLines.length - 1;
    const lastStartColumn = endLine === line ? column - 1 : 0;
    excerptLines[lastIndex] = excerptLines[lastIndex].slice(
      0,
      Math.max(1, endColumn - 1 - lastStartColumn)
    );
    const excerpt = normalizeInlineText(excerptLines.join('\n'));
    if (excerpt) {
      return excerpt;
    }
  }

  const tokenAtColumn = sourceLine
    .slice(column - 1)
    .match(/^(?:[\w$.-]+|\S+)/)?.[0];
  return normalizeInlineText(tokenAtColumn || sourceLine);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createScopeContractHash(contract) {
  return createHash('sha256').update(stableStringify(contract)).digest('hex');
}

export function createDiagnosticFingerprint(
  diagnostic,
  { workspaceRoot = WORKSPACE_ROOT } = {}
) {
  const messageId = diagnostic.messageId || '';
  const message = normalizeWorkspaceText(diagnostic.message, workspaceRoot);
  const identity = {
    project: diagnostic.project,
    filePath: workspaceRelativePath(diagnostic.filePath, workspaceRoot),
    severity: diagnostic.severity,
    ruleId: diagnostic.ruleId || '<unclassified>',
    messageId,
    message,
    sourceExcerpt: normalizeWorkspaceText(
      diagnostic.sourceExcerpt ?? diagnostic.sourceLine,
      workspaceRoot
    ),
  };
  const fingerprintIdentity = {
    ...identity,
    // ESLint messageId is the stable rule-owned identity. Parameterized
    // messages (notably Nx lazy-import file lists) must not churn every
    // existing fingerprint when an unrelated path is added.
    message: messageId ? '' : message,
  };
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(fingerprintIdentity))
    .digest('hex');
  return { fingerprint, identity };
}

function sortedCountObject(counts) {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
}

function countObjectTotal(counts) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

export function createDiagnosticInventory(
  project,
  results,
  { workspaceRoot = WORKSPACE_ROOT } = {}
) {
  const files = [
    ...new Set(
      results.map((result) =>
        workspaceRelativePath(result.filePath, workspaceRoot)
      )
    ),
  ].sort();
  const fingerprints = new Map();
  const examples = new Map();
  const fatalDiagnostics = [];
  let errors = 0;
  let warnings = 0;

  for (const result of results) {
    for (const message of result.messages) {
      const diagnostic = {
        project,
        filePath: result.filePath,
        severity: message.severity,
        ruleId: message.ruleId,
        messageId: message.messageId,
        message: message.message,
        sourceExcerpt: sourceExcerptAt(result.source, message),
        line: message.line,
        column: message.column,
      };

      if (message.fatal) {
        fatalDiagnostics.push(diagnostic);
        continue;
      }

      if (message.severity === 2) {
        errors += 1;
      } else if (message.severity === 1) {
        warnings += 1;
      }

      const { fingerprint, identity } = createDiagnosticFingerprint(
        diagnostic,
        { workspaceRoot }
      );
      fingerprints.set(fingerprint, (fingerprints.get(fingerprint) || 0) + 1);
      if (!examples.has(fingerprint)) {
        examples.set(fingerprint, {
          ...identity,
          line: diagnostic.line,
          column: diagnostic.column,
        });
      }
    }
  }

  return {
    project,
    errors,
    warnings,
    files,
    fingerprints: sortedCountObject(fingerprints),
    examples,
    fatalDiagnostics,
  };
}

export function compareFingerprintInventories(
  baselineFingerprints,
  currentFingerprints
) {
  const additions = [];
  const reductions = [];
  const keys = new Set([
    ...Object.keys(baselineFingerprints),
    ...Object.keys(currentFingerprints),
  ]);

  for (const fingerprint of [...keys].sort()) {
    const baselineCount = baselineFingerprints[fingerprint] || 0;
    const currentCount = currentFingerprints[fingerprint] || 0;
    if (currentCount > baselineCount) {
      additions.push({
        fingerprint,
        count: currentCount - baselineCount,
      });
    } else if (currentCount < baselineCount) {
      reductions.push({
        fingerprint,
        count: baselineCount - currentCount,
      });
    }
  }

  return { additions, reductions };
}

export function createHoverFingerprint(violation) {
  const identity =
    typeof violation === 'string'
      ? normalizeInlineText(violation)
      : stableStringify({
          project: HOVER_SCOPE.project,
          path: normalizePath(violation.path),
          ruleId: violation.ruleId,
        });
  return createHash('sha256').update(identity).digest('hex');
}

export function validateProjectBaseline(
  project,
  baseline,
  { requireFiles = true } = {}
) {
  if (!baseline || typeof baseline !== 'object') {
    throw new Error(`Missing lint baseline for project ${project}`);
  }
  if (
    !Number.isSafeInteger(baseline.errors) ||
    baseline.errors < 0 ||
    !Number.isSafeInteger(baseline.warnings) ||
    baseline.warnings < 0 ||
    !baseline.fingerprints ||
    typeof baseline.fingerprints !== 'object' ||
    Array.isArray(baseline.fingerprints)
  ) {
    throw new Error(`Invalid lint baseline for project ${project}`);
  }

  if (
    requireFiles &&
    (!Array.isArray(baseline.files) ||
      baseline.files.some(
        (file) =>
          typeof file !== 'string' ||
          !file ||
          path.isAbsolute(file) ||
          file === '..' ||
          file.startsWith('../') ||
          file.includes('\\')
      ) ||
      JSON.stringify(baseline.files) !==
        JSON.stringify([...new Set(baseline.files)].sort()))
  ) {
    throw new Error(`Invalid linted file inventory for project ${project}`);
  }

  for (const [fingerprint, count] of Object.entries(baseline.fingerprints)) {
    if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
      throw new Error(
        `Invalid lint fingerprint for project ${project}: ${fingerprint}`
      );
    }
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error(
        `Invalid lint fingerprint count for project ${project}: ${fingerprint}`
      );
    }
  }

  const expectedTotal = baseline.errors + baseline.warnings;
  const fingerprintTotal = countObjectTotal(baseline.fingerprints);
  if (expectedTotal !== fingerprintTotal) {
    throw new Error(
      `Lint baseline total mismatch for ${project}: ` +
        `${expectedTotal} diagnostics but ${fingerprintTotal} fingerprint entries`
    );
  }
}

export function validateGeneratedFrom(generatedFrom) {
  if (
    typeof generatedFrom !== 'string' ||
    !/^[a-f0-9]{40}$/.test(generatedFrom)
  ) {
    throw new Error(
      'Lint baseline generatedFrom must be a 40-character Git SHA'
    );
  }
}

export function findUnexpectedlyUnscannedFiles(
  baselineFiles,
  currentFiles,
  { fileExists = (file) => existsSync(path.join(WORKSPACE_ROOT, file)) } = {}
) {
  const current = new Set(currentFiles);
  return baselineFiles.filter((file) => !current.has(file) && fileExists(file));
}

function normalizeLintTarget(target) {
  const options = target?.options || {};
  return {
    executor: target?.executor || '',
    cwd: options.cwd || '',
    command: options.command || '',
    lintFilePatterns: [...(options.lintFilePatterns || [])],
  };
}

function expectedLintTarget(scope) {
  return {
    executor: scope.target.executor,
    cwd: scope.target.cwd || '',
    command: scope.target.command || '',
    lintFilePatterns: [...(scope.target.lintFilePatterns || [])],
  };
}

export function assertLintTargetContracts(nxTargets, lintScopes = LINT_SCOPES) {
  for (const scope of lintScopes) {
    const actual = normalizeLintTarget(nxTargets[scope.project]);
    const expected = expectedLintTarget(scope);
    if (stableStringify(actual) !== stableStringify(expected)) {
      throw new Error(
        `Lint target contract mismatch for ${scope.project}: ` +
          `Nx=${stableStringify(actual)}; gate=${stableStringify(expected)}`
      );
    }
  }
}

async function lintScope(scope) {
  const eslint = new ESLint({
    cwd: path.join(WORKSPACE_ROOT, scope.cwd),
    extensions: scope.extensions ? [...scope.extensions] : undefined,
  });
  const results = await eslint.lintFiles([...scope.patterns]);
  return createDiagnosticInventory(scope.project, results);
}

export function runCommand(command, args, { cwd = WORKSPACE_ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const requiresWindowsCommandShell =
      process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
    const child = spawn(command, args, {
      cwd,
      // pnpm exposes Nx as a .cmd shim on Windows. Node cannot execute that
      // shim directly, while Unix launchers remain normal executables.
      shell: requiresWindowsCommandShell,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        NX_DAEMON: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    // `close` fires after stdio is drained; `exit` can race the final JSON
    // chunk and make a fail-closed parser inspect truncated output.
    child.once('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function nxExecutablePath() {
  return path.join(
    WORKSPACE_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'nx.cmd' : 'nx'
  );
}

export function parseStrictJsonOutput(stdout, label) {
  if (typeof stdout !== 'string' || !stdout.trim()) {
    throw new Error(`Cannot parse ${label}: command produced no JSON`);
  }
  try {
    return JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(`Cannot parse ${label}: ${error.message}`);
  }
}

async function listNxLintProjects() {
  const result = await runCommand(
    nxExecutablePath(),
    ['show', 'projects', '--with-target=lint', '--json'],
    { cwd: WORKSPACE_ROOT }
  );
  if (result.code !== 0 || result.signal) {
    throw new Error(
      `Cannot enumerate Nx lint projects: ${normalizeInlineText(
        result.stderr || result.stdout || result.signal
      )}`
    );
  }
  const projects = parseStrictJsonOutput(
    result.stdout,
    'Nx lint project list'
  );
  if (
    !Array.isArray(projects) ||
    projects.some((item) => typeof item !== 'string')
  ) {
    throw new Error('Nx lint project list is not a string array');
  }
  return [...projects].sort();
}

async function loadNxLintTargets(projects) {
  const entries = [];
  // Nx's Windows command shim can race while several project-graph readers
  // initialize at once. Six sequential reads are still cheap and deterministic.
  for (const project of projects) {
    const result = await runCommand(
      nxExecutablePath(),
      ['show', 'project', project, '--json'],
      { cwd: WORKSPACE_ROOT }
    );
    if (result.code !== 0 || result.signal) {
      throw new Error(
        `Cannot inspect Nx lint target for ${project}: ${normalizeInlineText(
          result.stderr || result.stdout || result.signal
        )}`
      );
    }
    const configuration = parseStrictJsonOutput(
      result.stdout,
      `Nx project ${project}`
    );
    if (!configuration?.targets?.lint) {
      throw new Error(`Nx project ${project} has no lint target`);
    }
    entries.push([project, configuration.targets.lint]);
  }
  return Object.fromEntries(entries);
}

export function assertLintScopeCoverage(nxProjects, lintScopes = LINT_SCOPES) {
  const expected = [...nxProjects].sort();
  const configured = lintScopes.map(({ project }) => project).sort();
  if (JSON.stringify(expected) !== JSON.stringify(configured)) {
    throw new Error(
      `Lint scope coverage mismatch: Nx=${expected.join(', ')}; ` +
        `gate=${configured.join(', ')}`
    );
  }
}

async function hashFile(relativePath) {
  const content = await readFile(
    path.join(WORKSPACE_ROOT, relativePath),
    'utf8'
  );
  return createHash('sha256')
    .update(content.replaceAll('\r\n', '\n'))
    .digest('hex');
}

async function hashOptionalDirectory(relativePath) {
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    return '<missing>';
  }
  const entries = await readdir(absolutePath, {
    recursive: true,
    withFileTypes: true,
  });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      normalizePath(
        path.relative(
          absolutePath,
          path.join(entry.parentPath || entry.path, entry.name)
        )
      )
    )
    .sort();
  const inventory = {};
  for (const file of files) {
    inventory[file] = await hashFile(path.join(relativePath, file));
  }
  return inventory;
}

async function readInstalledPackageVersion(packageName) {
  const packagePath = path.join(
    WORKSPACE_ROOT,
    'node_modules',
    ...packageName.split('/'),
    'package.json'
  );
  let manifest;
  try {
    manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot read installed lint tool ${packageName}: ${error.message}`
    );
  }
  if (typeof manifest.version !== 'string' || !manifest.version) {
    throw new Error(`Installed lint tool ${packageName} has no version`);
  }
  return manifest.version;
}

async function createCurrentScopeContract(nxTargets) {
  const configFiles = {};
  for (const relativePath of SCOPE_CONTRACT_FILES) {
    configFiles[relativePath] = await hashFile(relativePath);
  }

  const toolVersions = {};
  for (const packageName of LINT_TOOL_PACKAGES) {
    toolVersions[packageName] = await readInstalledPackageVersion(packageName);
  }

  const normalizedTargets = {};
  for (const scope of LINT_SCOPES) {
    normalizedTargets[scope.project] = normalizeLintTarget(
      nxTargets[scope.project]
    );
  }

  return {
    algorithmVersion: 1,
    fingerprintSchemaVersion: FINGERPRINT_SCHEMA_VERSION,
    lintScopes: LINT_SCOPES.map((scope) => ({
      project: scope.project,
      cwd: scope.cwd,
      patterns: [...scope.patterns],
      extensions: scope.extensions ? [...scope.extensions] : [],
      target: expectedLintTarget(scope),
    })),
    hoverScope: {
      project: HOVER_SCOPE.project,
      cwd: HOVER_SCOPE.cwd,
      command: 'node',
      args: [...HOVER_SCOPE.args],
    },
    nxTargets: normalizedTargets,
    configFiles,
    optionalDirectories: {
      'tools/eslint-rules': await hashOptionalDirectory('tools/eslint-rules'),
    },
    toolVersions,
  };
}

export function parseHoverCommandResult(result) {
  if (result.signal || ![0, 1].includes(result.code)) {
    throw new Error(
      `Hover policy command failed unexpectedly: ${normalizeInlineText(
        result.stderr || result.stdout || result.signal
      )}`
    );
  }
  if (normalizeInlineText(result.stderr)) {
    throw new Error(
      `Hover policy JSON mode wrote to stderr: ${normalizeInlineText(
        result.stderr
      )}`
    );
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Cannot parse hover policy JSON: ${error.message}`);
  }
  const expectedRoots = ['src/components', 'src/tools'];
  if (
    payload?.schemaVersion !== 1 ||
    payload?.check !== 'drawnix-hover-policy' ||
    stableStringify(payload.roots) !== stableStringify(expectedRoots) ||
    !Number.isSafeInteger(payload.scannedFiles) ||
    payload.scannedFiles < 1 ||
    !Array.isArray(payload.violations)
  ) {
    throw new Error('Invalid hover policy JSON contract');
  }

  for (const violation of payload.violations) {
    if (
      !violation ||
      typeof violation.path !== 'string' ||
      !violation.path.startsWith('src/') ||
      path.isAbsolute(violation.path) ||
      violation.path.includes('..') ||
      violation.path.includes('\\') ||
      typeof violation.ruleId !== 'string' ||
      !/^[a-z0-9-]+$/.test(violation.ruleId) ||
      typeof violation.message !== 'string' ||
      !violation.message.trim()
    ) {
      throw new Error('Invalid hover policy violation');
    }
  }

  if (result.code === 0 && payload.violations.length > 0) {
    throw new Error('Hover policy returned success while reporting violations');
  }
  if (result.code === 1 && payload.violations.length === 0) {
    throw new Error('Hover policy returned failure without violations');
  }
  return payload;
}

async function collectHoverInventory() {
  const result = await runCommand(HOVER_SCOPE.command, [...HOVER_SCOPE.args], {
    cwd: path.join(WORKSPACE_ROOT, HOVER_SCOPE.cwd),
  });
  const payload = parseHoverCommandResult(result);
  const violations = payload.violations;

  const fingerprints = new Map();
  const examples = new Map();
  for (const violation of violations) {
    const fingerprint = createHoverFingerprint(violation);
    fingerprints.set(fingerprint, (fingerprints.get(fingerprint) || 0) + 1);
    examples.set(
      fingerprint,
      `${violation.path}: [${violation.ruleId}] ${violation.message}`
    );
  }
  return {
    count: violations.length,
    fingerprints: sortedCountObject(fingerprints),
    examples,
  };
}

async function collectCurrentScopeContractHash() {
  const nxProjects = await listNxLintProjects();
  assertLintScopeCoverage(nxProjects);
  const nxTargets = await loadNxLintTargets(nxProjects);
  assertLintTargetContracts(nxTargets);
  const scopeContract = await createCurrentScopeContract(nxTargets);
  return createScopeContractHash(scopeContract);
}

async function collectCurrentSnapshot({ expectedScopeContractHash } = {}) {
  const scopeContractHash = await collectCurrentScopeContractHash();
  if (
    expectedScopeContractHash &&
    scopeContractHash !== expectedScopeContractHash
  ) {
    throw new Error(
      `Lint scope contract changed: baseline=${expectedScopeContractHash}; ` +
        `current=${scopeContractHash}. Review the lint scope/config/toolchain ` +
        'change and migrate the baseline explicitly.'
    );
  }

  const projects = {};
  const inventories = new Map();
  for (const scope of LINT_SCOPES) {
    const inventory = await lintScope(scope);
    if (inventory.fatalDiagnostics.length > 0) {
      const first = inventory.fatalDiagnostics[0];
      throw new Error(
        `Fatal ESLint diagnostic in ${scope.project}: ` +
          `${workspaceRelativePath(first.filePath, WORKSPACE_ROOT)}:` +
          `${first.line || 0}:${first.column || 0} ${first.message}`
      );
    }
    inventories.set(scope.project, inventory);
    projects[scope.project] = {
      errors: inventory.errors,
      warnings: inventory.warnings,
      files: inventory.files,
      fingerprints: inventory.fingerprints,
    };
  }

  const hover = await collectHoverInventory();
  return {
    scopeContractHash,
    projects,
    hover,
    inventories,
  };
}

async function currentGitRevision() {
  const result = await runCommand('git', ['rev-parse', 'HEAD']);
  if (result.code !== 0 || result.signal) {
    throw new Error('Cannot resolve the current Git revision');
  }
  return result.stdout.trim();
}

export async function createLintBaselineSnapshot() {
  const snapshot = await collectCurrentSnapshot();
  return {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    generatedFrom: await currentGitRevision(),
    scopeContractHash: snapshot.scopeContractHash,
    projects: snapshot.projects,
    hover: {
      count: snapshot.hover.count,
      fingerprints: snapshot.hover.fingerprints,
    },
  };
}

async function readLintBaseline() {
  let baseline;
  try {
    baseline = JSON.parse(await readFile(LINT_BASELINE_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read lint baseline: ${error.message}`);
  }
  if (
    baseline.schemaVersion !== BASELINE_SCHEMA_VERSION ||
    !/^[a-f0-9]{64}$/.test(baseline.scopeContractHash || '') ||
    !baseline.projects ||
    typeof baseline.projects !== 'object'
  ) {
    throw new Error('Unsupported or invalid lint baseline document');
  }
  validateGeneratedFrom(baseline.generatedFrom);
  const baselineProjects = Object.keys(baseline.projects).sort();
  const expectedProjects = LINT_SCOPES.map(({ project }) => project).sort();
  if (JSON.stringify(baselineProjects) !== JSON.stringify(expectedProjects)) {
    throw new Error(
      `Lint baseline project coverage mismatch: ${baselineProjects.join(', ')}`
    );
  }
  for (const [project, projectBaseline] of Object.entries(baseline.projects)) {
    validateProjectBaseline(project, projectBaseline);
  }
  validateProjectBaseline(
    'drawnix-hover',
    {
      errors: baseline.hover?.count,
      warnings: 0,
      fingerprints: baseline.hover?.fingerprints,
    },
    { requireFiles: false }
  );
  return baseline;
}

async function assertBaselineRevision(generatedFrom) {
  const commit = await runCommand('git', [
    'cat-file',
    '-e',
    `${generatedFrom}^{commit}`,
  ]);
  if (commit.code !== 0 || commit.signal) {
    throw new Error(
      `Lint baseline source commit does not exist: ${generatedFrom}`
    );
  }
  const ancestor = await runCommand('git', [
    'merge-base',
    '--is-ancestor',
    generatedFrom,
    'HEAD',
  ]);
  if (ancestor.code !== 0 || ancestor.signal) {
    throw new Error(
      `Lint baseline source is not an ancestor of HEAD: ${generatedFrom}`
    );
  }
}

function formatAddition(project, addition, examples) {
  const example = examples.get(addition.fingerprint);
  if (typeof example === 'string') {
    return `${project}: +${addition.count} ${example}`;
  }
  if (!example) {
    return `${project}: +${addition.count} ${addition.fingerprint}`;
  }
  return (
    `${project}: +${addition.count} ${example.filePath}:` +
    `${example.line || 0}:${example.column || 0} ` +
    `[${example.ruleId}] ${example.message}`
  );
}

export async function verifyLintRegression() {
  const baseline = await readLintBaseline();
  await assertBaselineRevision(baseline.generatedFrom);
  const current = await collectCurrentSnapshot({
    expectedScopeContractHash: baseline.scopeContractHash,
  });
  const additions = [];
  const unscannedFiles = [];
  let reductions = 0;

  for (const scope of LINT_SCOPES) {
    const project = scope.project;
    const missingFiles = findUnexpectedlyUnscannedFiles(
      baseline.projects[project].files,
      current.projects[project].files
    );
    unscannedFiles.push(...missingFiles.map((file) => `${project}: ${file}`));
    const comparison = compareFingerprintInventories(
      baseline.projects[project].fingerprints,
      current.projects[project].fingerprints
    );
    reductions += comparison.reductions.reduce(
      (total, reduction) => total + reduction.count,
      0
    );
    additions.push(
      ...comparison.additions.map((addition) =>
        formatAddition(
          project,
          addition,
          current.inventories.get(project).examples
        )
      )
    );
    console.log(
      `[lint-regression] ${project}: ` +
        `${current.projects[project].errors} errors, ` +
        `${current.projects[project].warnings} warnings`
    );
  }

  const hoverComparison = compareFingerprintInventories(
    baseline.hover.fingerprints,
    current.hover.fingerprints
  );
  reductions += hoverComparison.reductions.reduce(
    (total, reduction) => total + reduction.count,
    0
  );
  additions.push(
    ...hoverComparison.additions.map((addition) =>
      formatAddition('drawnix-hover', addition, current.hover.examples)
    )
  );
  console.log(
    `[lint-regression] drawnix-hover: ${current.hover.count} findings`
  );

  if (unscannedFiles.length > 0) {
    throw new Error(
      'Previously linted files still exist but are no longer scanned:\n' +
        unscannedFiles.join('\n')
    );
  }

  if (additions.length > 0) {
    throw new Error(
      `New lint diagnostics are not allowed:\n${additions.join('\n')}`
    );
  }

  if (reductions > 0) {
    throw new Error(
      `${reductions} historical lint diagnostics were removed. ` +
        'Tighten the reviewed baseline before merging so the fixed debt ' +
        'cannot return.'
    );
  }

  console.log(
    `[lint-regression] passed against ${baseline.generatedFrom}; ` +
      'no diagnostic regressions or unratcheted reductions'
  );
}

export async function ratchetLintBaseline() {
  const baseline = await readLintBaseline();
  await assertBaselineRevision(baseline.generatedFrom);
  const current = await collectCurrentSnapshot({
    expectedScopeContractHash: baseline.scopeContractHash,
  });
  const additions = [];
  const unscannedFiles = [];
  let reductions = 0;

  for (const scope of LINT_SCOPES) {
    const project = scope.project;
    unscannedFiles.push(
      ...findUnexpectedlyUnscannedFiles(
        baseline.projects[project].files,
        current.projects[project].files
      ).map((file) => `${project}: ${file}`)
    );
    const comparison = compareFingerprintInventories(
      baseline.projects[project].fingerprints,
      current.projects[project].fingerprints
    );
    reductions += comparison.reductions.reduce(
      (total, reduction) => total + reduction.count,
      0
    );
    additions.push(
      ...comparison.additions.map((addition) =>
        formatAddition(
          project,
          addition,
          current.inventories.get(project).examples
        )
      )
    );
  }

  const hoverComparison = compareFingerprintInventories(
    baseline.hover.fingerprints,
    current.hover.fingerprints
  );
  reductions += hoverComparison.reductions.reduce(
    (total, reduction) => total + reduction.count,
    0
  );
  additions.push(
    ...hoverComparison.additions.map((addition) =>
      formatAddition('drawnix-hover', addition, current.hover.examples)
    )
  );

  if (unscannedFiles.length > 0) {
    throw new Error(
      'Cannot ratchet while existing files have left lint scope:\n' +
        unscannedFiles.join('\n')
    );
  }
  if (additions.length > 0) {
    throw new Error(
      `Cannot ratchet with new lint diagnostics:\n${additions.join('\n')}`
    );
  }
  if (reductions === 0) {
    throw new Error(
      'Lint baseline is already exact; there is nothing to ratchet'
    );
  }

  const nextBaseline = {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    generatedFrom: await currentGitRevision(),
    scopeContractHash: current.scopeContractHash,
    projects: current.projects,
    hover: {
      count: current.hover.count,
      fingerprints: current.hover.fingerprints,
    },
  };
  const temporaryPath = `${LINT_BASELINE_PATH}.${process.pid}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(nextBaseline, null, 2)}\n`,
      'utf8'
    );
    await rename(temporaryPath, LINT_BASELINE_PATH);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
  console.log(
    `[lint-regression] ratcheted ${reductions} removed diagnostics; ` +
      'no additions accepted'
  );
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
      path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  const command = process.argv[2] || 'verify';
  const operation =
    command === 'snapshot'
      ? createLintBaselineSnapshot().then((snapshot) => {
          process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
        })
      : command === 'verify'
      ? verifyLintRegression()
      : command === 'ratchet'
      ? ratchetLintBaseline()
      : Promise.reject(
          new Error(`Unknown lint regression command: ${command}`)
        );

  operation.catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
