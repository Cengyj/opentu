import * as fs from 'node:fs';
import * as path from 'node:path';
import { ManualIntegrityError, validateManualOutput } from './manual-integrity';

interface VerifyUserManualCliOptions {
  contentDir: string;
  outputDir: string;
  help: boolean;
}

const USAGE = `Usage:
  npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' scripts/verify-user-manual.ts [--output-dir PATH] [--content-dir PATH]

Options:
  --output-dir PATH   Generated manual directory (default: apps/web/public/user-manual)
  --content-dir PATH  MDX source directory (default: docs/user-manual/content)
  --help              Show this help message`;

function readWorkspaceVersion(cwd: string): string {
  const packagePath = path.join(cwd, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
    version?: unknown;
  };
  if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
    throw new Error(`Package version is missing from ${packagePath}`);
  }
  return packageJson.version;
}

function readOptionValue(
  args: string[],
  index: number,
  option: string
): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a path`);
  }
  return value;
}

export function parseVerifyUserManualArgs(
  args: string[],
  cwd = process.cwd()
): VerifyUserManualCliOptions {
  let contentDir = path.join(cwd, 'docs', 'user-manual', 'content');
  let outputDir = path.join(cwd, 'apps', 'web', 'public', 'user-manual');
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      help = true;
      continue;
    }
    if (argument === '--output-dir') {
      outputDir = path.resolve(cwd, readOptionValue(args, index, argument));
      index += 1;
      continue;
    }
    if (argument.startsWith('--output-dir=')) {
      const value = argument.slice('--output-dir='.length);
      if (!value) {
        throw new Error('--output-dir requires a path');
      }
      outputDir = path.resolve(cwd, value);
      continue;
    }
    if (argument === '--content-dir') {
      contentDir = path.resolve(cwd, readOptionValue(args, index, argument));
      index += 1;
      continue;
    }
    if (argument.startsWith('--content-dir=')) {
      const value = argument.slice('--content-dir='.length);
      if (!value) {
        throw new Error('--content-dir requires a path');
      }
      contentDir = path.resolve(cwd, value);
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  return { contentDir, outputDir, help };
}

export function runVerifyUserManualCli(
  args = process.argv.slice(2),
  cwd = process.cwd(),
  logger: Pick<Console, 'log' | 'error'> = console
): number {
  try {
    const options = parseVerifyUserManualArgs(args, cwd);
    if (options.help) {
      logger.log(USAGE);
      return 0;
    }

    const report = validateManualOutput({
      ...options,
      expectedVersion: readWorkspaceVersion(cwd),
    });
    logger.log(
      `User manual integrity verified: ${report.htmlFiles.length} pages in ${report.outputDir}`
    );
    return 0;
  } catch (error) {
    if (error instanceof ManualIntegrityError) {
      logger.error(error.message);
    } else {
      logger.error(error instanceof Error ? error.message : String(error));
    }
    return 1;
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  process.exitCode = runVerifyUserManualCli();
}
