import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const TEMPORARY_DIRECTORY_PREFIX = 'opentu-drawnix-declarations-';

export const REQUIRED_DRAWNIX_DECLARATIONS = Object.freeze([
  'packages/drawnix/src/index.d.ts',
  'packages/drawnix/src/app.d.ts',
  'packages/drawnix/src/runtime.d.ts',
  'packages/drawnix/src/components/dialog/dialog.d.ts',
  'packages/drawnix/src/components/popover/popover.d.ts',
]);

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function describeLeak(filePath, kind, value) {
  return { filePath, kind, value };
}

/**
 * Inspect emitted declaration contents without touching the filesystem.
 *
 * @param {ReadonlyMap<string, string>} declarationFiles paths relative to the
 * declaration output root and their contents
 * @param {{ workspaceRoot?: string }} options
 */
export function scanDrawnixDeclarations(
  declarationFiles,
  { workspaceRoot = WORKSPACE_ROOT } = {}
) {
  const normalizedFiles = new Map(
    Array.from(declarationFiles, ([filePath, content]) => [
      normalizePath(filePath),
      content,
    ])
  );
  const normalizedWorkspaceRoot = normalizePath(path.resolve(workspaceRoot));
  const nativeWorkspaceRoot = path.resolve(workspaceRoot);
  const missingRequiredDeclarations = REQUIRED_DRAWNIX_DECLARATIONS.filter(
    (filePath) => !normalizedFiles.has(filePath)
  );
  const leaks = [];

  for (const [filePath, content] of normalizedFiles) {
    if (content.includes('node_modules/.pnpm')) {
      leaks.push(
        describeLeak(filePath, 'pnpm-node-modules-path', 'node_modules/.pnpm')
      );
    }

    if (content.includes('.pnpm/') || content.includes('.pnpm\\')) {
      leaks.push(describeLeak(filePath, 'physical-pnpm-path', '.pnpm'));
    }

    if (content.includes('@floating-ui/react-dom')) {
      leaks.push(
        describeLeak(
          filePath,
          'transitive-floating-ui-type',
          '@floating-ui/react-dom'
        )
      );
    }

    if (
      content.includes(normalizedWorkspaceRoot) ||
      content.includes(nativeWorkspaceRoot)
    ) {
      leaks.push(
        describeLeak(
          filePath,
          'absolute-workspace-path',
          normalizedWorkspaceRoot
        )
      );
    }
  }

  return {
    declarationCount: normalizedFiles.size,
    missingRequiredDeclarations,
    leaks,
    valid: missingRequiredDeclarations.length === 0 && leaks.length === 0,
  };
}

export function assertDrawnixDeclarations(declarationFiles, options) {
  const report = scanDrawnixDeclarations(declarationFiles, options);
  if (report.valid) {
    return report;
  }

  const problems = [];
  if (report.missingRequiredDeclarations.length > 0) {
    problems.push(
      `missing required declarations: ${report.missingRequiredDeclarations.join(
        ', '
      )}`
    );
  }
  if (report.leaks.length > 0) {
    problems.push(
      `non-portable declarations: ${report.leaks
        .map((leak) => `${leak.filePath} (${leak.kind}: ${leak.value})`)
        .join(', ')}`
    );
  }

  throw new Error(
    `Drawnix declaration contract failed: ${problems.join('; ')}`
  );
}

async function collectDeclarationFiles(rootDirectory) {
  const declarationFiles = new Map();

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
        const relativePath = normalizePath(
          path.relative(rootDirectory, absolutePath)
        );
        declarationFiles.set(
          relativePath,
          await readFile(absolutePath, 'utf8')
        );
      }
    }
  }

  await visit(rootDirectory);
  return declarationFiles;
}

export async function verifyDrawnixDeclarationDirectory(
  rootDirectory,
  options
) {
  const declarationFiles = await collectDeclarationFiles(rootDirectory);
  return assertDrawnixDeclarations(declarationFiles, options);
}

function runDeclarationCompiler(outputDirectory) {
  const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const argumentsList = [
    '--dir',
    'packages/drawnix',
    'exec',
    'tsc',
    '-p',
    'tsconfig.lib.json',
    '--declaration',
    '--emitDeclarationOnly',
    '--outDir',
    outputDirectory,
    '--pretty',
    'false',
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(pnpmExecutable, argumentsList, {
      cwd: WORKSPACE_ROOT,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `Drawnix declaration compiler terminated by ${signal}`
            : `Drawnix declaration compiler exited with code ${code}`
        )
      );
    });
  });
}

function isOwnedTemporaryDirectory(directory) {
  const resolvedDirectory = path.resolve(directory);
  const resolvedTemporaryRoot = path.resolve(tmpdir());
  return (
    path.dirname(resolvedDirectory) === resolvedTemporaryRoot &&
    path.basename(resolvedDirectory).startsWith(TEMPORARY_DIRECTORY_PREFIX)
  );
}

export async function runDrawnixDeclarationContract() {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), TEMPORARY_DIRECTORY_PREFIX)
  );

  try {
    await runDeclarationCompiler(temporaryDirectory);
    return await verifyDrawnixDeclarationDirectory(temporaryDirectory, {
      workspaceRoot: WORKSPACE_ROOT,
    });
  } finally {
    if (!isOwnedTemporaryDirectory(temporaryDirectory)) {
      throw new Error(
        `Refusing to remove unexpected declaration directory: ${temporaryDirectory}`
      );
    }
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
      path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  runDrawnixDeclarationContract()
    .then((report) => {
      console.log(
        `Drawnix declaration contract passed (${report.declarationCount} files).`
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
