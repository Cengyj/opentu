// @vitest-environment jsdom

import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryMonitorService } from '../../services/memory-monitor-service';
import {
  DrawnixOperationalMonitors,
  type OperationalMonitorLoaders,
  type PerformancePanelLoader,
  type VersionUpdatePromptLoader,
} from './DrawnixOperationalMonitors';
import {
  PERFORMANCE_PANEL_STORAGE_KEY,
  type VersionUpgradeSnapshot,
  type VersionUpgradeRuntimeView,
  type VersionUpgradeWindow,
} from './operational-monitor-policy';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function installVersionRuntime(snapshot: VersionUpgradeSnapshot): void {
  const runtime: VersionUpgradeRuntimeView = {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
  };
  (window as Window & VersionUpgradeWindow).__OPENTU_VERSION_UPGRADE_RUNTIME__ =
    runtime;
}

function createSnapshot(pending: boolean): VersionUpgradeSnapshot {
  return {
    revision: 1,
    committedReleaseId: 'release-current',
    pendingReleaseId: pending ? 'release-next' : null,
    displayVersion: pending ? '1.0.5' : null,
    phase: pending ? 'ready' : 'idle',
    metadata: null,
    confirmationIssue: null,
    confirmationRejectionReason: null,
  };
}

function createLoaders(
  overrides: Partial<OperationalMonitorLoaders> = {}
): OperationalMonitorLoaders {
  return {
    versionUpdatePrompt: vi.fn(() =>
      Promise.resolve({ default: () => <div>版本提示已加载</div> })
    ),
    performancePanel: vi.fn(() =>
      Promise.resolve({ default: () => <div>内存面板已加载</div> })
    ),
    ...overrides,
  };
}

const highMemoryStats = {
  usedJSHeapSize: 90,
  totalJSHeapSize: 100,
  jsHeapSizeLimit: 100,
  usagePercent: 90,
  isUnderPressure: true,
  formatted: { used: '90 B', total: '100 B', limit: '100 B' },
};

describe('DrawnixOperationalMonitors deferred boundaries', () => {
  beforeEach(() => {
    window.localStorage.removeItem(PERFORMANCE_PANEL_STORAGE_KEY);
    installVersionRuntime(createSnapshot(false));
    vi.spyOn(memoryMonitorService, 'getMemoryStats').mockReturnValue(null);
  });

  afterEach(() => {
    delete (window as Window & VersionUpgradeWindow)
      .__OPENTU_VERSION_UPGRADE_RUNTIME__;
    vi.restoreAllMocks();
  });

  it('shows a version-chunk failure and retries the rejected attempt', async () => {
    installVersionRuntime(createSnapshot(true));
    const versionUpdatePrompt = vi
      .fn<VersionUpdatePromptLoader>()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce({
        default: () => <div>版本更新可用</div>,
      });
    const loaders = createLoaders({ versionUpdatePrompt });

    render(
      <DrawnixOperationalMonitors
        container={null}
        elements={[]}
        onCreateProject={vi.fn()}
        loaders={loaders}
      />
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('版本更新提示加载失败');
    expect(alert.className).toContain('deferred-feature-status--passive');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(versionUpdatePrompt).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('版本更新可用')).toBeTruthy();
  });

  it('keeps the performance-panel chunk independently retryable', async () => {
    vi.mocked(memoryMonitorService.getMemoryStats).mockReturnValue(
      highMemoryStats
    );
    const performancePanel = vi
      .fn<PerformancePanelLoader>()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce({
        default: () => <div>内存保护已恢复</div>,
      });
    const loaders = createLoaders({ performancePanel });

    render(
      <DrawnixOperationalMonitors
        container={null}
        elements={[]}
        onCreateProject={vi.fn()}
        loaders={loaders}
      />
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      '内存监控面板加载失败'
    );
    expect(loaders.versionUpdatePrompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(performancePanel).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('内存保护已恢复')).toBeTruthy();
  });

  it('ignores both loader results that arrive after unmount', async () => {
    installVersionRuntime(createSnapshot(true));
    vi.mocked(memoryMonitorService.getMemoryStats).mockReturnValue(
      highMemoryStats
    );
    const versionDeferred =
      createDeferred<Awaited<ReturnType<VersionUpdatePromptLoader>>>();
    const performanceDeferred =
      createDeferred<Awaited<ReturnType<PerformancePanelLoader>>>();
    const renderVersionPrompt = vi.fn(() => <div>late version</div>);
    const renderPerformancePanel = vi.fn(() => <div>late performance</div>);
    const loaders = createLoaders({
      versionUpdatePrompt: vi.fn(() => versionDeferred.promise),
      performancePanel: vi.fn(() => performanceDeferred.promise),
    });
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const view = render(
      <DrawnixOperationalMonitors
        container={null}
        elements={[]}
        onCreateProject={vi.fn()}
        loaders={loaders}
      />
    );

    await waitFor(() => {
      expect(loaders.versionUpdatePrompt).toHaveBeenCalledTimes(1);
      expect(loaders.performancePanel).toHaveBeenCalledTimes(1);
    });
    view.unmount();

    await act(async () => {
      versionDeferred.resolve({ default: renderVersionPrompt });
      performanceDeferred.resolve({ default: renderPerformancePanel });
      await Promise.all([versionDeferred.promise, performanceDeferred.promise]);
    });

    expect(renderVersionPrompt).not.toHaveBeenCalled();
    expect(renderPerformancePanel).not.toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
