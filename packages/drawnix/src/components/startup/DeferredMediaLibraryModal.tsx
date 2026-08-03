import React from 'react';
import { useAssets } from '../../contexts/AssetContext';
import { hasStoredGitHubSyncToken } from '../../services/github-sync/token-storage';
import { MediaLibraryModal } from '../media-library/MediaLibraryModal';
import { DeferredMediaLibraryGitHubSync } from './DeferredMediaLibraryGitHubSync';

type MediaLibraryModalProps = React.ComponentProps<typeof MediaLibraryModal>;

export function DeferredMediaLibraryModal(props: MediaLibraryModalProps) {
  const { loadSyncedUrls } = useAssets();

  return (
    <>
      <MediaLibraryModal {...props} />
      <DeferredMediaLibraryGitHubSync
        enabled={hasStoredGitHubSyncToken()}
        onSynced={loadSyncedUrls}
      />
    </>
  );
}

export default DeferredMediaLibraryModal;
