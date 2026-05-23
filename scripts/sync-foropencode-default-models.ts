/**
 * Sync the local ForOpenCode default provider model snapshot.
 *
 * Usage:
 *   FOROPENCODE_API_KEY=sk-... pnpm sync:for-models
 *   pnpm sync:for-models --input ./tmp/foropencode-models.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  type HiddenDefaultModelReportItem,
  buildDefaultModelVisibilityReportFromModelListResponse,
} from '../packages/drawnix/src/constants/default-model-visibility';

interface CliOptions {
  input?: string;
  output: string;
}

type FetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<FetchResponse>;

const FOROPENCODE_DEFAULT_MODELS_SOURCE_URL =
  'https://foropencode.com/v1/models';

const BUILT_IN_GPT_RECOMMENDATION_SCORES: Readonly<Record<string, number>> = {
  'gpt-5.5': 99,
  'gpt-5.4': 97,
  'gpt-5-pro': 96,
  'gpt-image-2': 95,
  'gpt-5.2': 90,
  'gpt-5.1': 89,
  'gpt-5-chat-latest': 88,
  'gpt-5.4-mini': 83,
};

export interface ForOpenCodeDefaultModelSnapshotBuildResult {
  modelIds: string[];
  hiddenReport: HiddenDefaultModelReportItem[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    output: path.join(
      process.cwd(),
      'packages/drawnix/src/constants/for-default-models.ts'
    ),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      options.input = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.output = argv[index + 1] || options.output;
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage(): void {
  console.log(`Usage:
  FOROPENCODE_API_KEY=sk-... pnpm sync:for-models
  pnpm sync:for-models --input ./tmp/foropencode-models.json

Options:
  --input <path>   Read a saved ForOpenCode /v1/models JSON response.
  --output <path>  Snapshot output path.
`);
}

async function readJsonInput(inputPath: string): Promise<unknown> {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  const content = await fs.readFile(absolutePath, 'utf-8');
  return JSON.parse(content.replace(/^\uFEFF/, ''));
}

async function fetchForOpenCodeModels(): Promise<unknown> {
  const apiKey = process.env.FOROPENCODE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Missing FOROPENCODE_API_KEY. Pass --input with a saved /v1/models response for offline regeneration.'
    );
  }

  const fetchImpl = (globalThis as { fetch?: FetchLike }).fetch;
  if (!fetchImpl) {
    throw new Error('This script requires Node.js fetch support.');
  }

  const response = await fetchImpl(FOROPENCODE_DEFAULT_MODELS_SOURCE_URL, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(
      `ForOpenCode /v1/models request failed: HTTP ${
        response.status
      } ${rawText.slice(0, 240)}`
    );
  }

  return JSON.parse(rawText);
}

function compareModelIdsBySnapshotPriority(left: string, right: string): number {
  const leftScore = BUILT_IN_GPT_RECOMMENDATION_SCORES[left.toLowerCase()];
  const rightScore = BUILT_IN_GPT_RECOMMENDATION_SCORES[right.toLowerCase()];
  if (leftScore !== undefined || rightScore !== undefined) {
    if (leftScore === undefined) return 1;
    if (rightScore === undefined) return -1;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
  }

  return left.localeCompare(right, 'zh-Hans-CN');
}

export function buildForOpenCodeDefaultModelSnapshot(
  modelListResponse: unknown
): ForOpenCodeDefaultModelSnapshotBuildResult {
  const report =
    buildDefaultModelVisibilityReportFromModelListResponse(modelListResponse);
  return {
    modelIds: [...report.visibleModelIds].sort(
      compareModelIdsBySnapshotPriority
    ),
    hiddenReport: report.hiddenModels,
  };
}

export function formatHiddenModelReport(
  hiddenReport: HiddenDefaultModelReportItem[]
): string {
  if (hiddenReport.length === 0) {
    return 'Hidden models: none';
  }

  const grouped = new Map<string, HiddenDefaultModelReportItem[]>();
  for (const item of hiddenReport) {
    const list = grouped.get(item.hiddenReason);
    if (list) {
      list.push(item);
    } else {
      grouped.set(item.hiddenReason, [item]);
    }
  }

  const lines = ['Hidden models:'];
  for (const [reason, items] of grouped.entries()) {
    lines.push(`  ${reason}:`);
    for (const item of items) {
      const tags = item.variantTags.length
        ? ` [${item.variantTags.join(', ')}]`
        : '';
      lines.push(`    - ${item.id}${tags}`);
    }
  }

  return lines.join('\n');
}

function quoteModelIds(modelIds: string[]): string {
  if (modelIds.length === 0) {
    return '';
  }
  return modelIds.map((id) => `  ${JSON.stringify(id)},`).join('\n');
}

function renderSnapshotFile(modelIds: string[], syncedAt: string): string {
  return `/**
 * ForOpenCode default provider model snapshot.
 *
 * This file is generated from a ForOpenCode /v1/models response.
 * Regenerate it with scripts/sync-foropencode-default-models.ts when the
 * upstream model catalog changes.
 */

import {
  DEFAULT_MODEL_VISIBILITY_POLICY_SUMMARY,
} from './default-model-visibility';

export const FOROPENCODE_DEFAULT_MODELS_SOURCE_URL =
  'https://foropencode.com/v1/models';

export const FOROPENCODE_DEFAULT_MODELS_SYNCED_AT =
  '${syncedAt}';

export const FOROPENCODE_DEFAULT_MODELS_FILTER_RULES = [
  ...DEFAULT_MODEL_VISIBILITY_POLICY_SUMMARY,
] as const;

export const FOROPENCODE_DEFAULT_MODEL_IDS = [
${quoteModelIds(modelIds)}
] as const;
`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const response = options.input
    ? await readJsonInput(options.input)
    : await fetchForOpenCodeModels();
  const snapshot = buildForOpenCodeDefaultModelSnapshot(response);
  const syncedAt = new Date().toISOString();
  const outputPath = path.resolve(process.cwd(), options.output);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    renderSnapshotFile(snapshot.modelIds, syncedAt),
    'utf-8'
  );

  console.log(
    `Wrote ${snapshot.modelIds.length} ForOpenCode default models to ${outputPath}`
  );
  console.log(snapshot.modelIds.join('\n'));
  console.log(formatHiddenModelReport(snapshot.hiddenReport));
}

if (typeof require !== 'undefined' && require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
