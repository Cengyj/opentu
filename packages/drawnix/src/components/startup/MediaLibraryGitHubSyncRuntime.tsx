import React, { useEffect } from 'react';
import { GitHubSyncProvider } from '../../contexts/GitHubSyncContext';
import { mediaSyncService } from '../../services/github-sync/media-sync-service';

export interface MediaLibraryGitHubSyncRuntimeProps {
  onSynced: () => void | Promise<void>;
}

/**
 * Heavy remote-sync sidecar for an open media library. It intentionally does
 * not wrap the local modal: loading or validating GitHub state must never hold
 * back local assets, while provider and listener lifetime still follows the
 * modal lifetime.
 */
export function MediaLibraryGitHubSyncRuntime({
  onSynced,
}: MediaLibraryGitHubSyncRuntimeProps) {
  useEffect(() => {
    let active = true;
    const refreshSyncedUrls = () => {
      if (!active) {
        return;
      }
      void Promise.resolve(onSynced()).catch(() => undefined);
    };

    refreshSyncedUrls();
    mediaSyncService.addSyncCompletedListener(refreshSyncedUrls);

    return () => {
      active = false;
      mediaSyncService.removeSyncCompletedListener(refreshSyncedUrls);
    };
  }, [onSynced]);

  return <GitHubSyncProvider>{null}</GitHubSyncProvider>;
}

export default MediaLibraryGitHubSyncRuntime;
