import React, { useEffect, useRef, useState } from 'react';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import { usePostPaintOperability } from './use-post-paint-operability';
import type { MediaLibraryGitHubSyncRuntimeProps } from './MediaLibraryGitHubSyncRuntime';

type SyncRuntimeComponent =
  React.ComponentType<MediaLibraryGitHubSyncRuntimeProps>;

export type MediaLibraryGitHubSyncRuntimeLoader = () => Promise<{
  MediaLibraryGitHubSyncRuntime: SyncRuntimeComponent;
}>;

const loadDefaultSyncRuntime = createRetriableModuleLoader(
  () => import('./MediaLibraryGitHubSyncRuntime')
);

interface DeferredMediaLibraryGitHubSyncProps {
  enabled: boolean;
  onSynced: () => void | Promise<void>;
  /** Test seam for the post-paint production runtime boundary. */
  runtimeLoader?: MediaLibraryGitHubSyncRuntimeLoader;
}

/**
 * Keeps remote sync off the local-library critical path. Configured users keep
 * the existing provider, initial synced-URL refresh, and completion listener,
 * but those effects cannot start until the modal has committed and painted.
 */
export function DeferredMediaLibraryGitHubSync({
  enabled,
  onSynced,
  runtimeLoader = loadDefaultSyncRuntime,
}: DeferredMediaLibraryGitHubSyncProps) {
  const isPostPaint = usePostPaintOperability(enabled);
  const [Runtime, setRuntime] = useState<SyncRuntimeComponent | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const loadingRef = useRef(false);
  const attemptCountRef = useRef(0);

  useEffect(() => {
    if (!enabled || !isPostPaint || Runtime || loadingRef.current) {
      return;
    }

    let disposed = false;
    let idleCallbackId: number | null = null;
    let fallbackTimerId: number | null = null;

    const loadRuntime = () => {
      if (disposed || loadingRef.current) {
        return;
      }
      loadingRef.current = true;
      attemptCountRef.current += 1;
      void runtimeLoader().then(
        (module) => {
          loadingRef.current = false;
          if (!disposed) {
            setRuntime(() => module.MediaLibraryGitHubSyncRuntime);
          }
        },
        () => {
          loadingRef.current = false;
          if (!disposed && attemptCountRef.current < 2) {
            setRetryVersion((current) => current + 1);
          }
        }
      );
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(loadRuntime, {
        timeout: 1500,
      });
    } else {
      fallbackTimerId = window.setTimeout(loadRuntime, 250);
    }

    return () => {
      disposed = true;
      if (idleCallbackId !== null) {
        window.cancelIdleCallback?.(idleCallbackId);
      }
      if (fallbackTimerId !== null) {
        window.clearTimeout(fallbackTimerId);
      }
    };
  }, [Runtime, enabled, isPostPaint, retryVersion, runtimeLoader]);

  if (!enabled || !Runtime) {
    return null;
  }

  return <Runtime onSynced={onSynced} />;
}

export default DeferredMediaLibraryGitHubSync;
