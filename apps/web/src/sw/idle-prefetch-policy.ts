export interface IdlePrefetchPolicyManifest {
  defaults?: string[];
  groups: Record<string, ReadonlyArray<unknown>>;
}

export type IdlePrefetchPolicyMode = 'requested-or-default' | 'all';

const FULL_PREWARM_FOLLOW_UP_GROUPS = ['offline-static-assets'] as const;

export function mergeIdlePrefetchGroupRequests(
  currentGroups: readonly string[],
  requestedGroups: readonly string[]
): string[] {
  const merged = new Set(currentGroups.filter(Boolean));
  requestedGroups.forEach((group) => {
    if (group) {
      merged.add(group);
    }
  });
  return Array.from(merged);
}

/**
 * Resolve the groups for one idle-prefetch run.
 *
 * Normal runs are deliberately exact: an explicit request only warms the
 * requested groups, while an automatic run only warms manifest defaults.
 * A release upgrade may opt into `all` after the new release is ready.
 */
export function resolveOrderedIdlePrefetchGroups(
  manifest: IdlePrefetchPolicyManifest,
  requestedGroups: string[] = [],
  mode: IdlePrefetchPolicyMode = 'requested-or-default'
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (groupName: string | undefined) => {
    if (
      !groupName ||
      seen.has(groupName) ||
      (manifest.groups[groupName] || []).length === 0
    ) {
      return;
    }

    seen.add(groupName);
    ordered.push(groupName);
  };

  if (mode === 'all') {
    requestedGroups.forEach(push);
    (manifest.defaults || []).forEach(push);
    FULL_PREWARM_FOLLOW_UP_GROUPS.forEach(push);
    Object.keys(manifest.groups).forEach(push);
    return ordered;
  }

  const selectedGroups =
    requestedGroups.length > 0 ? requestedGroups : manifest.defaults || [];
  selectedGroups.forEach(push);
  return ordered;
}
