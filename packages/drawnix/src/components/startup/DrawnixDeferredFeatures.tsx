import React from 'react';
import type { DrawnixBoard } from '../../hooks/use-drawnix';
import type { Board as WorkspaceBoard } from '../../types/workspace.types';
import type { MediaLibraryConfig } from '../../types/asset.types';
import { useDrawnix } from '../../hooks/use-drawnix';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import { RetriableDeferredFeature } from './RetriableDeferredFeature';
import './deferred-features.scss';

const loadProjectDrawer = createRetriableModuleLoader(() =>
  import('../project-drawer/ProjectDrawer').then((module) => ({
    default: module.ProjectDrawer,
  }))
);
const loadToolboxDrawer = createRetriableModuleLoader(() =>
  import('../toolbox-drawer/ToolboxDrawer').then((module) => ({
    default: module.ToolboxDrawer,
  }))
);
const loadMediaLibraryModal = createRetriableModuleLoader(() =>
  import('./DeferredMediaLibraryModal').then((module) => ({
    default: module.DeferredMediaLibraryModal,
  }))
);
const loadBackupRestoreDialog = createRetriableModuleLoader(() =>
  import('../backup-restore/backup-restore-dialog').then((module) => ({
    default: module.BackupRestoreDialog,
  }))
);
const loadSyncSettings = createRetriableModuleLoader(() =>
  import('./DeferredSyncSettings').then((module) => ({
    default: module.DeferredSyncSettings,
  }))
);
const loadCommandPalette = createRetriableModuleLoader(() =>
  import('../command-palette/command-palette').then((module) => ({
    default: module.CommandPalette,
  }))
);
const loadCanvasSearch = createRetriableModuleLoader(() =>
  import('../canvas-search/canvas-search').then((module) => ({
    default: module.CanvasSearch,
  }))
);
const loadToolWinBoxManager = createRetriableModuleLoader(() =>
  import('../toolbox-drawer/ToolWinBoxManager').then((module) => ({
    default: module.ToolWinBoxManager,
  }))
);

interface DrawnixDeferredFeaturesProps {
  board: DrawnixBoard | null;
  containerRef: React.RefObject<HTMLDivElement>;
  toolWindowManagerEnabled: boolean;
  projectDrawerOpen: boolean;
  toolboxDrawerOpen: boolean;
  mediaLibraryOpen: boolean;
  mediaLibraryConfig?: Partial<MediaLibraryConfig> & {
    selectButtonText?: string;
    batchSelectButtonText?: string;
  };
  backupRestoreOpen: boolean;
  cloudSyncOpen: boolean;
  onBoardSwitch?: (board: WorkspaceBoard) => void;
  setProjectDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setToolboxDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMediaLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBackupRestoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCloudSyncOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenMediaLibrary: (
    config?: Partial<MediaLibraryConfig> & {
      selectButtonText?: string;
      batchSelectButtonText?: string;
    }
  ) => void;
  handleBeforeSwitch: () => Promise<void>;
  enableToolWindows: () => void;
  enableGenerationRuntime: () => void;
}

export function DrawnixDeferredFeatures({
  board,
  containerRef,
  toolWindowManagerEnabled,
  projectDrawerOpen,
  toolboxDrawerOpen,
  mediaLibraryOpen,
  mediaLibraryConfig,
  backupRestoreOpen,
  cloudSyncOpen,
  onBoardSwitch,
  setProjectDrawerOpen,
  setToolboxDrawerOpen,
  setMediaLibraryOpen,
  setBackupRestoreOpen,
  setCloudSyncOpen,
  handleOpenMediaLibrary,
  handleBeforeSwitch,
  enableToolWindows,
  enableGenerationRuntime,
}: DrawnixDeferredFeaturesProps) {
  const { appState, setAppState } = useDrawnix();
  const commandPaletteOpen = appState.openCommandPalette || false;
  const canvasSearchOpen = appState.openCanvasSearch || false;

  return (
    <>
      {mediaLibraryOpen && (
        <RetriableDeferredFeature
          loader={loadMediaLibraryModal}
          label="素材库"
          onCancel={() => setMediaLibraryOpen(false)}
          renderFeature={({ default: MediaLibraryModal }) => (
            <MediaLibraryModal
              isOpen={mediaLibraryOpen}
              onClose={() => setMediaLibraryOpen(false)}
              mode={mediaLibraryConfig?.mode}
              filterType={mediaLibraryConfig?.filterType}
              onSelect={mediaLibraryConfig?.onSelect}
              onSelectMultiple={mediaLibraryConfig?.onSelectMultiple}
              selectButtonText={mediaLibraryConfig?.selectButtonText}
              batchSelectButtonText={mediaLibraryConfig?.batchSelectButtonText}
            />
          )}
        />
      )}
      {backupRestoreOpen && (
        <RetriableDeferredFeature
          loader={loadBackupRestoreDialog}
          label="备份与恢复"
          onCancel={() => setBackupRestoreOpen(false)}
          renderFeature={({ default: BackupRestoreDialog }) => (
            <BackupRestoreDialog
              open={backupRestoreOpen}
              onOpenChange={setBackupRestoreOpen}
              container={containerRef.current}
              onBeforeImport={async () => {
                await handleBeforeSwitch();
              }}
              onSwitchBoard={async (boardId, viewport) => {
                const { workspaceService } = await import(
                  '../../services/workspace-service'
                );
                const nextBoard = await workspaceService.switchBoard(boardId);
                if (nextBoard && onBoardSwitch) {
                  if (viewport) {
                    nextBoard.viewport = viewport;
                  }
                  onBoardSwitch(nextBoard);
                }
              }}
            />
          )}
        />
      )}
      {cloudSyncOpen && (
        <RetriableDeferredFeature
          loader={loadSyncSettings}
          label="云同步设置"
          onCancel={() => setCloudSyncOpen(false)}
          renderFeature={({ default: SyncSettings }) => (
            <SyncSettings
              visible={cloudSyncOpen}
              onClose={() => setCloudSyncOpen(false)}
            />
          )}
        />
      )}
      {toolWindowManagerEnabled && (
        <RetriableDeferredFeature
          loader={loadToolWinBoxManager}
          label="工具窗口"
          variant="passive"
          renderFeature={({ default: ToolWinBoxManager }) => (
            <ToolWinBoxManager />
          )}
        />
      )}
      {commandPaletteOpen && (
        <RetriableDeferredFeature
          loader={loadCommandPalette}
          label="命令面板"
          onCancel={() => {
            setAppState((prev) => ({
              ...prev,
              openCommandPalette: false,
            }));
          }}
          renderFeature={({ default: CommandPalette }) => (
            <CommandPalette
              open={commandPaletteOpen}
              onClose={() => {
                setAppState((prev) => ({
                  ...prev,
                  openCommandPalette: false,
                }));
              }}
              board={board}
              container={containerRef.current}
            />
          )}
        />
      )}
      {canvasSearchOpen && (
        <RetriableDeferredFeature
          loader={loadCanvasSearch}
          label="画布搜索"
          onCancel={() => {
            setAppState((prev) => ({
              ...prev,
              openCanvasSearch: false,
            }));
          }}
          renderFeature={({ default: CanvasSearch }) => (
            <CanvasSearch
              open={canvasSearchOpen}
              onClose={() => {
                setAppState((prev) => ({
                  ...prev,
                  openCanvasSearch: false,
                }));
              }}
              board={board}
            />
          )}
        />
      )}
      {projectDrawerOpen && (
        <RetriableDeferredFeature
          loader={loadProjectDrawer}
          label="项目"
          onCancel={() => setProjectDrawerOpen(false)}
          renderFeature={({ default: ProjectDrawer }) => (
            <ProjectDrawer
              isOpen={projectDrawerOpen}
              onOpenChange={setProjectDrawerOpen}
              onBeforeSwitch={handleBeforeSwitch}
              onBoardSwitch={onBoardSwitch}
              onOpenMediaLibrary={handleOpenMediaLibrary}
              onEnableGenerationRuntime={enableGenerationRuntime}
            />
          )}
        />
      )}
      {toolboxDrawerOpen && (
        <RetriableDeferredFeature
          loader={loadToolboxDrawer}
          label="工具箱"
          onCancel={() => setToolboxDrawerOpen(false)}
          renderFeature={({ default: ToolboxDrawer }) => (
            <ToolboxDrawer
              isOpen={toolboxDrawerOpen}
              onOpenChange={setToolboxDrawerOpen}
              onEnableToolWindows={enableToolWindows}
            />
          )}
        />
      )}
    </>
  );
}

export default DrawnixDeferredFeatures;
