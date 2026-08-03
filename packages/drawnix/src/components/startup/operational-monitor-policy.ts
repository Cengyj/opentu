import type { MemoryStats } from '../../services/memory-monitor-service';

export const PERFORMANCE_PANEL_STORAGE_KEY =
  'drawnix_performance_panel_settings';
export const PERFORMANCE_PANEL_CHECK_INTERVAL_MS = 5000;
export const MEMORY_AUTO_SHOW_THRESHOLD = 80;
export const MEMORY_WITH_IMAGE_THRESHOLD = 60;
export const IMAGE_COUNT_THRESHOLD = 100;

export interface PerformancePanelPersistedSettings {
  position: { x: number; y: number };
  pinned: boolean;
}

export type VersionUpgradePhase =
  | 'idle'
  | 'ready'
  | 'confirming'
  | 'commit-sent'
  | 'activating';

export type VersionUpgradeConfirmationIssue =
  | 'waiting-worker-unavailable'
  | 'commit-delivery-failed'
  | 'commit-acknowledgement-pending'
  | 'commit-rejected';

export interface VersionUpgradeSnapshot {
  revision: number;
  committedReleaseId: string;
  pendingReleaseId: string | null;
  displayVersion: string | null;
  phase: VersionUpgradePhase;
  metadata: { changelog?: readonly string[] } | null;
  confirmationIssue: VersionUpgradeConfirmationIssue | null;
  confirmationRejectionReason: string | null;
}

export interface VersionUpgradeRuntimeView {
  getSnapshot: () => VersionUpgradeSnapshot;
  subscribe: (listener: () => void) => () => void;
  replacePendingRelease?: (
    releaseId: string,
    displayVersion?: string | null
  ) => void;
}

export interface VersionUpgradeWindow {
  __OPENTU_VERSION_UPGRADE_RUNTIME__?: VersionUpgradeRuntimeView;
  __debugTriggerUpdate?: (version?: string, releaseId?: string) => void;
}

const DEFAULT_PERFORMANCE_PANEL_POSITION = { x: -1, y: -1 };

function createDefaultPerformancePanelSettings(): PerformancePanelPersistedSettings {
  return {
    position: { ...DEFAULT_PERFORMANCE_PANEL_POSITION },
    pinned: false,
  };
}

export function readPerformancePanelSettings(
  storage?: Pick<Storage, 'getItem'>
): PerformancePanelPersistedSettings {
  try {
    const source =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const stored = source?.getItem(PERFORMANCE_PANEL_STORAGE_KEY);
    if (!stored) {
      return createDefaultPerformancePanelSettings();
    }

    const parsed = JSON.parse(stored) as Partial<PerformancePanelPersistedSettings>;
    const position = parsed.position;
    return {
      position:
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y)
          ? { x: position.x, y: position.y }
          : { ...DEFAULT_PERFORMANCE_PANEL_POSITION },
      pinned: parsed.pinned === true,
    };
  } catch {
    return createDefaultPerformancePanelSettings();
  }
}

export function shouldShowPerformancePanel({
  memoryStats,
  imageCount,
  pinned,
  dismissed = false,
}: {
  memoryStats: MemoryStats | null;
  imageCount: number;
  pinned: boolean;
  dismissed?: boolean;
}): boolean {
  if (!memoryStats) {
    return false;
  }
  if (pinned) {
    return true;
  }
  if (dismissed) {
    return false;
  }

  return (
    memoryStats.usagePercent >= MEMORY_AUTO_SHOW_THRESHOLD ||
    (imageCount >= IMAGE_COUNT_THRESHOLD &&
      memoryStats.usagePercent >= MEMORY_WITH_IMAGE_THRESHOLD)
  );
}

export const getVersionUpgradeRuntime = (): VersionUpgradeRuntimeView | null =>
  (window as Window & VersionUpgradeWindow)
    .__OPENTU_VERSION_UPGRADE_RUNTIME__ || null;

export const getNoVersionUpgradeRuntimeSnapshot = (): null => null;
export const subscribeToNoVersionUpgradeRuntime = (): (() => void) =>
  () => undefined;

export function hasPendingVersionUpgrade(
  snapshot: Pick<
    VersionUpgradeSnapshot,
    'pendingReleaseId' | 'displayVersion'
  > | null
): boolean {
  return Boolean(snapshot?.pendingReleaseId && snapshot.displayVersion);
}
