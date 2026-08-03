import React, { useCallback, useEffect, useState } from 'react';
import type { PlaitBoard } from '@plait/core';
import {
  loadViewNavigationMinimap,
  type ViewNavigationMinimapComponent,
} from './view-navigation-minimap-runtime';

interface DeferredViewNavigationMinimapProps {
  board: PlaitBoard;
  isStartupOperable?: boolean;
  loadImmediately?: boolean;
}

const MINIMAP_IDLE_TIMEOUT_MS = 1500;
const MINIMAP_FALLBACK_DELAY_MS = 250;

function scheduleMinimapLoad(callback: () => void): () => void {
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      idleCallback: () => void,
      options?: { timeout: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const idleId = idleWindow.requestIdleCallback(callback, {
      timeout: MINIMAP_IDLE_TIMEOUT_MS,
    });
    return () => idleWindow.cancelIdleCallback?.(idleId);
  }

  const timer = window.setTimeout(callback, MINIMAP_FALLBACK_DELAY_MS);
  return () => window.clearTimeout(timer);
}

export const DeferredViewNavigationMinimap: React.FC<
  DeferredViewNavigationMinimapProps
> = ({ board, isStartupOperable = true, loadImmediately = false }) => {
  const [MinimapComponent, setMinimapComponent] =
    useState<ViewNavigationMinimapComponent | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isStartupOperable && !loadImmediately && loadAttempt === 0) {
      return;
    }

    let disposed = false;

    const load = () => {
      if (disposed) {
        return;
      }

      void loadViewNavigationMinimap().then(
        (component) => {
          if (!disposed) {
            setMinimapComponent(() => component);
          }
        },
        () => {
          if (!disposed) {
            setLoadFailed(true);
          }
        }
      );
    };

    const shouldLoadImmediately = loadImmediately || loadAttempt > 0;
    const cancelScheduledLoad = shouldLoadImmediately
      ? undefined
      : scheduleMinimapLoad(load);
    if (shouldLoadImmediately) {
      load();
    }

    return () => {
      disposed = true;
      cancelScheduledLoad?.();
    };
  }, [isStartupOperable, loadAttempt, loadImmediately]);

  const retryLoad = useCallback(() => {
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  if (MinimapComponent) {
    return (
      <MinimapComponent
        board={board}
        displayMode="always"
        config={{
          width: 180,
          height: 120,
          position: 'top-right',
          margin: 0,
          collapsible: false,
          defaultExpanded: true,
        }}
      />
    );
  }

  return (
    <div
      className="view-navigation__minimap-placeholder"
      data-load-status={loadFailed ? 'failed' : 'loading'}
      role="status"
      aria-label={loadFailed ? '小地图加载失败' : '正在加载小地图'}
    >
      {loadFailed ? (
        <button type="button" onClick={retryLoad}>
          重试加载小地图
        </button>
      ) : (
        <span className="view-navigation__minimap-placeholder-shimmer" />
      )}
    </div>
  );
};
