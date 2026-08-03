import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from 'tdesign-react';
import { CloudUpload } from 'lucide-react';
import type { Asset } from '../../types/asset.types';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import { HoverTip } from '../shared/hover';
import { getSyncableMediaAssetUrls } from './media-library-sync-selection';
import type { MediaLibrarySyncActionRuntimeProps } from './MediaLibrarySyncActionRuntime';

type SyncActionRuntimeComponent =
  React.ComponentType<MediaLibrarySyncActionRuntimeProps>;

export type MediaLibrarySyncActionRuntimeLoader = () => Promise<{
  MediaLibrarySyncActionRuntime: SyncActionRuntimeComponent;
}>;

const loadDefaultSyncActionRuntime = createRetriableModuleLoader(
  () => import('./MediaLibrarySyncActionRuntime')
);

interface DeferredMediaLibrarySyncActionProps {
  assets: readonly Asset[];
  syncedUrls: ReadonlySet<string>;
  onSynced: () => void | Promise<void>;
  /** Test seam for the explicit production sync boundary. */
  runtimeLoader?: MediaLibrarySyncActionRuntimeLoader;
}

/**
 * Keeps GitHub/media-sync code out of a normal local-library open. The first
 * real press of the existing sync button loads the runtime and replays that
 * same intent once the chunk is ready.
 */
export function DeferredMediaLibrarySyncAction({
  assets,
  syncedUrls,
  onSynced,
  runtimeLoader = loadDefaultSyncActionRuntime,
}: DeferredMediaLibrarySyncActionProps) {
  const [LoadedRuntime, setLoadedRuntime] =
    useState<SyncActionRuntimeComponent | null>(null);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(
    'idle'
  );
  const [activationKey, setActivationKey] = useState(0);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const loadedRuntimeRef = useRef<SyncActionRuntimeComponent | null>(null);
  const syncableCount = useMemo(
    () => getSyncableMediaAssetUrls(assets, syncedUrls).length,
    [assets, syncedUrls]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestRuntime = useCallback(() => {
    if (syncableCount === 0 || loadingRef.current) {
      return;
    }

    setActivationKey((current) => current + 1);
    if (loadedRuntimeRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoadStatus('loading');
    void runtimeLoader().then(
      (module) => {
        loadingRef.current = false;
        if (!mountedRef.current) {
          return;
        }
        loadedRuntimeRef.current = module.MediaLibrarySyncActionRuntime;
        setLoadedRuntime(() => module.MediaLibrarySyncActionRuntime);
        setLoadStatus('idle');
      },
      () => {
        loadingRef.current = false;
        if (mountedRef.current) {
          setLoadStatus('error');
        }
      }
    );
  }, [runtimeLoader, syncableCount]);

  if (LoadedRuntime) {
    return (
      <LoadedRuntime
        assets={assets}
        syncedUrls={syncedUrls}
        activationKey={activationKey}
        onSynced={onSynced}
      />
    );
  }

  const hasError = loadStatus === 'error';
  const isLoading = loadStatus === 'loading';
  return (
    <HoverTip
      content={hasError ? '同步功能加载失败，点击重试' : '同步选中的素材到云端'}
      placement="bottom"
    >
      <Button
        variant="outline"
        size="small"
        icon={<CloudUpload size={16} />}
        disabled={syncableCount === 0 || isLoading}
        loading={isLoading}
        aria-busy={isLoading || undefined}
        onClick={requestRuntime}
        data-track="grid_batch_sync"
        data-testid="deferred-media-library-sync"
      >
        {hasError
          ? '同步加载失败，点击重试'
          : isLoading
          ? '正在加载同步'
          : `同步 (${syncableCount})`}
      </Button>
    </HoverTip>
  );
}

export default DeferredMediaLibrarySyncAction;
