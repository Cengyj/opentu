export const IDLE_PREFETCH_GROUPS = [
  'ai-chat',
  'tool-windows',
  'diagram-engines',
  'office-data',
  'editor-engines',
  'media-viewer',
  'external-skills',
  'runtime-static-assets',
  'offline-static-assets',
] as const;

export type IdlePrefetchGroup = (typeof IDLE_PREFETCH_GROUPS)[number];

// Normal startup is demand-driven. Release upgrade full-prewarm remains the
// explicit path that consumes every group before a new worker is committed.
export const IDLE_PREFETCH_DEFAULTS: readonly IdlePrefetchGroup[] = [];
