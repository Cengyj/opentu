#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import {
  createContainerPromotionPlan,
  createLatestContainerPromotionPlan,
  createReleaseContract,
  readReleaseContract,
  verifyReleaseOrigin,
  validateReleaseVersionPreflight,
  validatePublishedVersionImage,
  validateContainerImageMetadata,
  writeReleaseContract,
} from './release-static-contract.mjs';

function usage() {
  return `Usage:
  node scripts/verify-release-static.mjs create \\
    --dist dist/apps/web --output /tmp/release-static-contract.json \\
    [--expected-release-id <id>] [--expected-version <semver>]

  node scripts/verify-release-static.mjs verify \\
    --contract /tmp/release-static-contract.json \\
    --expected-release-id <id> \\
    --origin http://127.0.0.1:8080 [--origin https://public.example]

  node scripts/verify-release-static.mjs preflight \\
    --tag v1.2.3 --package-json package.json \\
    --version-json apps/web/public/version.json

  node scripts/verify-release-static.mjs compare-image \\
    --tag registry/image:v1.2.3 \\
    --candidate-image-id sha256:<digest> \\
    --published-image-id sha256:<digest>

  node scripts/verify-release-static.mjs plan-promotion
    --ghcr-image ghcr.io/owner/image:v1.2.3
    --ghcr-image-id <sha256:digest|missing>
    [--dockerhub-image owner/image:v1.2.3
     --dockerhub-image-id <sha256:digest|missing>]
    --output /tmp/container-promotion-plan.json

  node scripts/verify-release-static.mjs plan-latest-promotion
    --candidate-version 1.2.3
    --candidate-image-id sha256:<digest>
    --candidate-release-id <release-id>
    --ghcr-image ghcr.io/owner/image:latest
    --ghcr-image-id <sha256:digest|missing>
    --ghcr-version <semver|missing>
    --ghcr-release-id <release-id|legacy|missing>
    [--dockerhub-image owner/image:latest
     --dockerhub-image-id <sha256:digest|missing>
     --dockerhub-version <semver|missing>
     --dockerhub-release-id <release-id|legacy|missing>]
    --output /tmp/latest-promotion-plan.json

  node scripts/verify-release-static.mjs verify-image-metadata \\
    --labels-json /tmp/image-labels.json \\
    --expected-release-id <id> --expected-version <semver> \\
    [--expected-revision <commit>]

Options:
  --allow-legacy-identity  Diagnostic-only escape hatch for old fixtures.
  --timeout-ms <number>    Per-request timeout (default: 15000).

The command accepts no authentication or credential options and never prints
response bodies.`;
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  const values = new Map();
  const flags = new Set();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') {
      continue;
    }
    if (token === '--allow-legacy-identity') {
      flags.add(token);
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`unexpected argument: ${token}`);
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${token}`);
    }
    index += 1;
    if (token === '--origin') {
      const origins = values.get(token) || [];
      origins.push(value);
      values.set(token, origins);
    } else if (values.has(token)) {
      throw new Error(`duplicate option: ${token}`);
    } else {
      values.set(token, value);
    }
  }

  return { command, values, flags };
}

function required(values, option) {
  const value = values.get(option);
  if (value === undefined || value === '') {
    throw new Error(`missing required option ${option}`);
  }
  return value;
}

async function createCommand(values, flags) {
  const distDir = required(values, '--dist');
  const outputPath = required(values, '--output');
  const expectedReleaseId = values.get('--expected-release-id');
  const expectedVersion = values.get('--expected-version');
  const contract = await createReleaseContract({
    distDir,
    expectedReleaseId,
    expectedVersion,
    allowLegacyIdentity: flags.has('--allow-legacy-identity'),
  });
  await writeReleaseContract(outputPath, contract);
  console.log(
    `[release-static-contract] created ${path.resolve(outputPath)} for ${
      contract.identity.releaseId
    } (${contract.assetInventory.count} hashed assets)`
  );
}

async function verifyCommand(values, flags) {
  const contractPath = required(values, '--contract');
  const expectedReleaseId = values.get('--expected-release-id');
  const expectedVersion = values.get('--expected-version');
  const allowLegacyIdentity = flags.has('--allow-legacy-identity');
  if (!expectedReleaseId && !allowLegacyIdentity) {
    throw new Error(
      '--expected-release-id is required for production verification'
    );
  }
  const origins = values.get('--origin') || [];
  if (origins.length === 0) {
    throw new Error('at least one --origin is required');
  }
  const timeoutValue = values.get('--timeout-ms');
  const timeoutMs = timeoutValue === undefined ? 15_000 : Number(timeoutValue);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 120_000
  ) {
    throw new Error('--timeout-ms must be an integer between 100 and 120000');
  }

  const contract = await readReleaseContract(contractPath, {
    expectedReleaseId,
    expectedVersion,
    allowLegacyIdentity,
  });
  for (const origin of origins) {
    const result = await verifyReleaseOrigin({
      origin,
      contract,
      expectedReleaseId,
      expectedVersion,
      allowLegacyIdentity,
      timeoutMs,
    });
    console.log(
      `[release-static-contract] verified ${result.origin}: releaseId=${result.releaseId}, version=${result.version}, targets=${result.checkedTargets.length}`
    );
  }
}

async function readJsonFile(filePath, label) {
  try {
    return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
  } catch (error) {
    throw new Error(
      `${label} cannot be read as JSON: ${error.code || error.message}`
    );
  }
}

async function preflightCommand(values) {
  const tag = required(values, '--tag');
  const packageJson = await readJsonFile(
    required(values, '--package-json'),
    'package.json'
  );
  const versionJson = await readJsonFile(
    required(values, '--version-json'),
    'version.json'
  );
  const result = validateReleaseVersionPreflight({
    tag,
    packageVersion: packageJson.version,
    metadataVersion: versionJson.version,
  });
  console.log(
    `[release-static-contract] preflight verified ${result.tag} as the sole tag for display version ${result.version}`
  );
}

function compareImageCommand(values) {
  const result = validatePublishedVersionImage({
    versionTag: required(values, '--tag'),
    candidateImageId: required(values, '--candidate-image-id'),
    publishedImageId: required(values, '--published-image-id'),
  });
  console.log(
    `[release-static-contract] immutable tag ${result.versionTag} already contains exact image ${result.imageId}`
  );
}

function normalizePublishedImageId(value, option) {
  if (value === 'missing') {
    return null;
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${option} must be a SHA-256 ID or missing`);
  }
  return value;
}

async function planPromotionCommand(values) {
  const targets = [
    {
      name: 'ghcr',
      image: required(values, '--ghcr-image'),
      imageId: normalizePublishedImageId(
        required(values, '--ghcr-image-id'),
        '--ghcr-image-id'
      ),
    },
  ];
  const dockerHubImage = values.get('--dockerhub-image');
  const dockerHubImageId = values.get('--dockerhub-image-id');
  if ((dockerHubImage === undefined) !== (dockerHubImageId === undefined)) {
    throw new Error(
      '--dockerhub-image and --dockerhub-image-id must be provided together'
    );
  }
  if (dockerHubImage !== undefined) {
    targets.push({
      name: 'dockerhub',
      image: dockerHubImage,
      imageId: normalizePublishedImageId(
        dockerHubImageId,
        '--dockerhub-image-id'
      ),
    });
  }

  const plan = createContainerPromotionPlan({ targets });
  const outputPath = path.resolve(required(values, '--output'));
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(
    `[release-static-contract] ${plan.mode} promotion plan written to ${outputPath}`
  );
}

function normalizeLatestMetadata(value, imageId, option) {
  if (imageId === null) {
    if (value !== 'missing') {
      throw new Error(`${option} must be missing when its image is missing`);
    }
    return null;
  }
  if (typeof value !== 'string' || value.length === 0 || value === 'missing') {
    throw new Error(`${option} must contain published image metadata`);
  }
  return value;
}

function normalizeLatestReleaseId(value, imageId, option) {
  if (imageId === null) {
    if (value !== 'missing') {
      throw new Error(`${option} must be missing when its image is missing`);
    }
    return null;
  }
  if (value === 'legacy') {
    return null;
  }
  if (typeof value !== 'string' || value.length === 0 || value === 'missing') {
    throw new Error(
      `${option} must contain published image metadata or legacy`
    );
  }
  return value;
}

function readLatestPromotionTarget(values, prefix, name) {
  const imageOption = `--${prefix}-image`;
  const imageIdOption = `--${prefix}-image-id`;
  const versionOption = `--${prefix}-version`;
  const releaseIdOption = `--${prefix}-release-id`;
  const image = required(values, imageOption);
  const rawImageId = required(values, imageIdOption);
  const imageId = normalizePublishedImageId(rawImageId, imageIdOption);
  return {
    name,
    image,
    imageId,
    version: normalizeLatestMetadata(
      required(values, versionOption),
      imageId,
      versionOption
    ),
    releaseId: normalizeLatestReleaseId(
      required(values, releaseIdOption),
      imageId,
      releaseIdOption
    ),
  };
}

async function planLatestPromotionCommand(values) {
  const targets = [readLatestPromotionTarget(values, 'ghcr', 'ghcr')];
  const dockerHubOptions = [
    '--dockerhub-image',
    '--dockerhub-image-id',
    '--dockerhub-version',
    '--dockerhub-release-id',
  ];
  const dockerHubOptionCount = dockerHubOptions.filter((option) =>
    values.has(option)
  ).length;
  if (dockerHubOptionCount !== 0 && dockerHubOptionCount !== 4) {
    throw new Error(
      'all Docker Hub latest metadata options must be provided together'
    );
  }
  if (dockerHubOptionCount === 4) {
    targets.push(readLatestPromotionTarget(values, 'dockerhub', 'dockerhub'));
  }

  const plan = createLatestContainerPromotionPlan({
    candidateVersion: required(values, '--candidate-version'),
    candidateImageId: required(values, '--candidate-image-id'),
    candidateReleaseId: required(values, '--candidate-release-id'),
    targets,
  });
  const outputPath = path.resolve(required(values, '--output'));
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(
    `[release-static-contract] ${plan.mode} latest promotion plan written to ${outputPath}`
  );
}

async function verifyImageMetadataCommand(values) {
  const labels = await readJsonFile(
    required(values, '--labels-json'),
    'container image labels'
  );
  const result = validateContainerImageMetadata({
    labels,
    expectedReleaseId: required(values, '--expected-release-id'),
    expectedVersion: required(values, '--expected-version'),
    expectedRevision: values.get('--expected-revision'),
  });
  console.log(
    `[release-static-contract] verified container metadata: releaseId=${
      result.releaseId
    }, version=${result.version}, revision=${
      result.revision || '<unspecified>'
    }`
  );
}

async function main() {
  const { command, values, flags } = parseArguments(process.argv.slice(2));
  if (command === 'create') {
    await createCommand(values, flags);
    return;
  }
  if (command === 'verify') {
    await verifyCommand(values, flags);
    return;
  }
  if (command === 'preflight') {
    await preflightCommand(values);
    return;
  }
  if (command === 'compare-image') {
    compareImageCommand(values);
    return;
  }
  if (command === 'plan-promotion') {
    await planPromotionCommand(values);
    return;
  }
  if (command === 'plan-latest-promotion') {
    await planLatestPromotionCommand(values);
    return;
  }
  if (command === 'verify-image-metadata') {
    await verifyImageMetadataCommand(values);
    return;
  }
  throw new Error(usage());
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
