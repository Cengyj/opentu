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
import { mediaSyncService } from '../../services/github-sync/media-sync-service';
import { HoverTip } from '../shared/hover';
import { getSyncableMediaAssetUrls } from './media-library-sync-selection';

export interface MediaLibrarySyncActionRuntimeProps {
  assets: readonly Asset[];
  syncedUrls: ReadonlySet<string>;
  activationKey: number;
  onSynced: () => void | Promise<void>;
}

export function MediaLibrarySyncActionRuntime({
  assets,
  syncedUrls,
  activationKey,
  onSynced,
}: MediaLibrarySyncActionRuntimeProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const mountedRef = useRef(true);
  const isSyncingRef = useRef(false);
  const lastActivationKeyRef = useRef(0);
  const syncableUrls = useMemo(
    () => getSyncableMediaAssetUrls(assets, syncedUrls),
    [assets, syncedUrls]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleBatchSync = useCallback(async () => {
    if (syncableUrls.length === 0 || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncProgress(0);

    try {
      const result = await mediaSyncService.syncSelectedMedia(
        syncableUrls,
        (current, total) => {
          if (mountedRef.current) {
            setSyncProgress(Math.round((current / total) * 100));
          }
        }
      );

      if (!mountedRef.current) {
        return;
      }

      setSyncProgress(100);
      if (result.succeeded > 0) {
        await onSynced();
      }
    } catch (error) {
      console.error('[MediaLibraryGrid] Batch sync failed:', error);
    } finally {
      isSyncingRef.current = false;
      if (mountedRef.current) {
        setIsSyncing(false);
        setSyncProgress(0);
      }
    }
  }, [onSynced, syncableUrls]);

  useEffect(() => {
    if (activationKey <= 0 || activationKey <= lastActivationKeyRef.current) {
      return;
    }
    lastActivationKeyRef.current = activationKey;
    void handleBatchSync();
  }, [activationKey, handleBatchSync]);

  return (
    <HoverTip content="同步选中的素材到云端" placement="bottom">
      <Button
        variant="outline"
        size="small"
        icon={<CloudUpload size={16} />}
        disabled={syncableUrls.length === 0 || isSyncing}
        loading={isSyncing}
        onClick={() => {
          void handleBatchSync();
        }}
        data-track="grid_batch_sync"
      >
        {isSyncing ? `${syncProgress}%` : `同步 (${syncableUrls.length})`}
      </Button>
    </HoverTip>
  );
}

export default MediaLibrarySyncActionRuntime;
