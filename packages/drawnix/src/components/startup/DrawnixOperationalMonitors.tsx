import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { PlaitElement } from '@plait/core';
import { memoryMonitorService } from '../../services/memory-monitor-service';
import {
  PERFORMANCE_PANEL_CHECK_INTERVAL_MS,
  getNoVersionUpgradeRuntimeSnapshot,
  getVersionUpgradeRuntime,
  hasPendingVersionUpgrade,
  readPerformancePanelSettings,
  shouldShowPerformancePanel,
  subscribeToNoVersionUpgradeRuntime,
} from './operational-monitor-policy';

const VersionUpdatePrompt = lazy(() =>
  import('../version-update/version-update-prompt').then((module) => ({
    default: module.VersionUpdatePrompt,
  }))
);
const PerformancePanel = lazy(() =>
  import('../performance-panel/PerformancePanel').then((module) => ({
    default: module.PerformancePanel,
  }))
);

interface DrawnixOperationalMonitorsProps {
  container: HTMLElement | null;
  elements: PlaitElement[];
  onCreateProject: () => Promise<void>;
}

export function DrawnixOperationalMonitors({
  container,
  elements,
  onCreateProject,
}: DrawnixOperationalMonitorsProps) {
  const versionRuntime = getVersionUpgradeRuntime();
  const versionSnapshot = useSyncExternalStore(
    versionRuntime?.subscribe || subscribeToNoVersionUpgradeRuntime,
    versionRuntime?.getSnapshot || getNoVersionUpgradeRuntimeSnapshot,
    versionRuntime?.getSnapshot || getNoVersionUpgradeRuntimeSnapshot
  );
  const [performancePanelActivated, setPerformancePanelActivated] =
    useState(false);
  const imageCount = useMemo(
    () => elements.filter((element) => element.type === 'image').length,
    [elements]
  );

  useEffect(() => {
    if (performancePanelActivated) {
      return;
    }

    const activateWhenNeeded = () => {
      const settings = readPerformancePanelSettings();
      if (
        shouldShowPerformancePanel({
          memoryStats: memoryMonitorService.getMemoryStats(),
          imageCount,
          pinned: settings.pinned,
        })
      ) {
        setPerformancePanelActivated(true);
      }
    };

    activateWhenNeeded();
    const intervalId = window.setInterval(
      activateWhenNeeded,
      PERFORMANCE_PANEL_CHECK_INTERVAL_MS
    );
    return () => window.clearInterval(intervalId);
  }, [imageCount, performancePanelActivated]);

  return (
    <>
      {hasPendingVersionUpgrade(versionSnapshot) && (
        <Suspense fallback={null}>
          <VersionUpdatePrompt />
        </Suspense>
      )}
      {performancePanelActivated && (
        <Suspense fallback={null}>
          <PerformancePanel
            container={container}
            onCreateProject={onCreateProject}
            elements={elements}
          />
        </Suspense>
      )}
    </>
  );
}

export default DrawnixOperationalMonitors;
