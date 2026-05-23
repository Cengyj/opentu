/**
 * ForOpenCode default provider model snapshot.
 *
 * This file is the local default display list for the built-in default group.
 * Regenerate it with scripts/sync-foropencode-default-models.ts when the
 * upstream ForOpenCode /v1/models catalog changes.
 */

import {
  DEFAULT_MODEL_VISIBILITY_POLICY_SUMMARY,
} from './default-model-visibility';

export const FOROPENCODE_DEFAULT_MODELS_SOURCE_URL =
  'https://foropencode.com/v1/models';

export const FOROPENCODE_DEFAULT_MODELS_SYNCED_AT =
  '2026-05-21T00:00:00.000+08:00';

export const FOROPENCODE_DEFAULT_MODELS_FILTER_RULES = [
  ...DEFAULT_MODEL_VISIBILITY_POLICY_SUMMARY,
] as const;

export const FOROPENCODE_DEFAULT_MODEL_IDS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-image-2',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
] as const;
