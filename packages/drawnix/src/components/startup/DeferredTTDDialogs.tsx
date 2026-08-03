import React, { memo } from 'react';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import {
  DeferredDialogController,
  type DeferredDialogControllerLoader,
} from './DeferredDialogController';

export type DeferredTTDDialogLoaders = Record<
  DialogType,
  DeferredDialogControllerLoader
>;

export const defaultDeferredTTDDialogLoaders: DeferredTTDDialogLoaders = {
  [DialogType.mermaidToDrawnix]: createRetriableModuleLoader(
    () => import('../ttd-dialog/mermaid-dialog-controller')
  ),
  [DialogType.markdownToDrawnix]: createRetriableModuleLoader(
    () => import('../ttd-dialog/markdown-dialog-controller')
  ),
  [DialogType.aiImageGeneration]: createRetriableModuleLoader(
    () => import('../ttd-dialog/ai-image-dialog-controller')
  ),
  [DialogType.aiVideoGeneration]: createRetriableModuleLoader(
    () => import('../ttd-dialog/ai-video-dialog-controller')
  ),
};

const DIALOG_LABELS: Record<DialogType, string> = {
  [DialogType.mermaidToDrawnix]: 'Mermaid 转换',
  [DialogType.markdownToDrawnix]: 'Markdown 转换',
  [DialogType.aiImageGeneration]: 'AI 图片生成',
  [DialogType.aiVideoGeneration]: 'AI 视频生成',
};

const DIALOG_TYPES = Object.values(DialogType);

export interface DeferredTTDDialogsProps {
  container: HTMLElement | null;
  loaders?: DeferredTTDDialogLoaders;
  onEnableRuntime?: () => void;
}

function DeferredTTDDialogsComponent({
  container,
  loaders = defaultDeferredTTDDialogLoaders,
  onEnableRuntime,
}: DeferredTTDDialogsProps) {
  const { appState, closeDialog } = useDrawnix();

  return (
    <>
      {DIALOG_TYPES.map((dialogType) => (
        <DeferredDialogController
          key={dialogType}
          active={appState.openDialogTypes.has(dialogType)}
          container={container}
          dialogId={dialogType}
          label={DIALOG_LABELS[dialogType]}
          loadController={loaders[dialogType]}
          onClose={() => closeDialog(dialogType)}
          onEnableRuntime={onEnableRuntime}
        />
      ))}
    </>
  );
}

export const DeferredTTDDialogs = memo(DeferredTTDDialogsComponent);
