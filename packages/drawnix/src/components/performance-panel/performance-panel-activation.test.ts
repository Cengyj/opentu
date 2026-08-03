import { describe, expect, it } from 'vitest';
import type { MemoryStats } from '../../services/memory-monitor-service';
import {
  PERFORMANCE_PANEL_STORAGE_KEY,
  readPerformancePanelSettings,
  shouldShowPerformancePanel,
} from '../startup/operational-monitor-policy';

function createMemoryStats(usagePercent: number): MemoryStats {
  return {
    usedJSHeapSize: usagePercent,
    totalJSHeapSize: 100,
    jsHeapSizeLimit: 100,
    usagePercent,
    isUnderPressure: usagePercent > 75,
    formatted: { used: '', total: '', limit: '' },
  };
}

describe('performance panel activation policy', () => {
  it('keeps the heavy panel unloaded for normal memory and canvas sizes', () => {
    expect(
      shouldShowPerformancePanel({
        memoryStats: createMemoryStats(59),
        imageCount: 99,
        pinned: false,
      })
    ).toBe(false);
    expect(
      shouldShowPerformancePanel({
        memoryStats: null,
        imageCount: 200,
        pinned: true,
      })
    ).toBe(false);
  });

  it('activates for high memory, the combined image threshold, or a pin', () => {
    expect(
      shouldShowPerformancePanel({
        memoryStats: createMemoryStats(80),
        imageCount: 0,
        pinned: false,
      })
    ).toBe(true);
    expect(
      shouldShowPerformancePanel({
        memoryStats: createMemoryStats(60),
        imageCount: 100,
        pinned: false,
      })
    ).toBe(true);
    expect(
      shouldShowPerformancePanel({
        memoryStats: createMemoryStats(10),
        imageCount: 0,
        pinned: true,
      })
    ).toBe(true);
  });

  it('shares the dismissed behavior with the rendered panel', () => {
    expect(
      shouldShowPerformancePanel({
        memoryStats: createMemoryStats(90),
        imageCount: 0,
        pinned: false,
        dismissed: true,
      })
    ).toBe(false);
    expect(
      shouldShowPerformancePanel({
        memoryStats: createMemoryStats(10),
        imageCount: 0,
        pinned: true,
        dismissed: true,
      })
    ).toBe(true);
  });

  it('reads the existing pin and position without propagating malformed data', () => {
    const storage = {
      getItem: (key: string) =>
        key === PERFORMANCE_PANEL_STORAGE_KEY
          ? JSON.stringify({ position: { x: 12, y: 34 }, pinned: true })
          : null,
    };
    expect(readPerformancePanelSettings(storage)).toEqual({
      position: { x: 12, y: 34 },
      pinned: true,
    });

    expect(
      readPerformancePanelSettings({ getItem: () => '{invalid' })
    ).toEqual({ position: { x: -1, y: -1 }, pinned: false });
  });
});
