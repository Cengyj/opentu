import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PlaitElement } from '@plait/core';
import { memoryMonitorService } from '../../services/memory-monitor-service';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import { RetriableDeferredFeature } from './RetriableDeferredFeature';
import {
  PERFORMANCE_PANEL_CHECK_INTERVAL_MS,
  getNoVersionUpgradeRuntimeSnapshot,
  getVersionUpgradeRuntime,
  hasPendingVersionUpgrade,
  readPerformancePanelSettings,
  shouldShowPerformancePanel,
  subscribeToNoVersionUpgradeRuntime,
} from './operational-monitor-policy';

export type VersionUpdatePromptLoader = () => Promise<{
  default: (typeof import('../version-update/version-update-prompt'))['VersionUpdatePrompt'];
}>;
export type PerformancePanelLoader = () => Promise<{
  default: (typeof import('../performance-panel/PerformancePanel'))['PerformancePanel'];
}>;

export interface OperationalMonitorLoaders {
  versionUpdatePrompt: VersionUpdatePromptLoader;
  performancePanel: PerformancePanelLoader;
}

export const defaultOperationalMonitorLoaders: OperationalMonitorLoaders = {
  versionUpdatePrompt: createRetriableModuleLoader(() =>
    import('../version-update/version-update-prompt').then((module) => ({
      default: module.VersionUpdatePrompt,
    }))
  ),
  performancePanel: createRetriableModuleLoader(() =>
    import('../performance-panel/PerformancePanel').then((module) => ({
      default: module.PerformancePanel,
    }))
  ),
};

export interface DrawnixOperationalMonitorsProps {
  container: HTMLElement | null;
  elements: PlaitElement[];
  onCreateProject: () => Promise<void>;
  /** Test seam for the two independently retryable monitor chunks. */
  loaders?: OperationalMonitorLoaders;
}

export function DrawnixOperationalMonitors({
  container,
  elements,
  onCreateProject,
  loaders = defaultOperationalMonitorLoaders,
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
        <RetriableDeferredFeature
          loader={loaders.versionUpdatePrompt}
          label="版本更新提示"
          variant="passive"
          renderFeature={({ default: VersionUpdatePrompt }) => (
            <VersionUpdatePrompt />
          )}
        />
      )}
      {performancePanelActivated && (
        <RetriableDeferredFeature
          loader={loaders.performancePanel}
          label="内存监控面板"
          variant="passive"
          renderFeature={({ default: PerformancePanel }) => (
            <PerformancePanel
              container={container}
              onCreateProject={onCreateProject}
              elements={elements}
            />
          )}
        />
      )}
    </>
  );
}

export default DrawnixOperationalMonitors;
