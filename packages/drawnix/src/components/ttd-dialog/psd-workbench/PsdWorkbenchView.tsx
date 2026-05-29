import React, { useCallback, useState } from 'react';
import type { PsdGenerationPlan } from '../ai-psd-plan';
import type {
  LayerBounds,
  PsdTaskSummary,
} from '../ai-psd-workflow-view-utils';
import type { ReferenceImage } from '../shared';
import { PsdCanvasStage } from './PsdCanvasStage';
import { PsdComposerPanel } from './PsdComposerPanel';
import { PsdLayerWorkspace } from './PsdLayerWorkspace';
import { PsdOperationsPanel } from './PsdOperationsPanel';
import { PsdWorkbenchShell } from './PsdWorkbenchShell';
import { PsdWorkflowHeader } from './PsdWorkflowHeader';
import type { PsdAnalysisStatus } from './psd-workbench-types';
import type { PsdLayerTaskState } from './psd-layer-tasks';

export type { PsdAnalysisStatus } from './psd-workbench-types';

export interface PsdWorkbenchViewProps {
  uiLanguage: 'zh' | 'en';
  prompt: string;
  defaultPrompt: string;
  isComposerDisabled: boolean;
  primaryActionLabel: string;
  primaryActionEyebrow: string;
  canRunPrimaryAction: boolean;
  isPrimaryActionBusy: boolean;
  autoGenerateAfterAnalysis?: boolean;
  onAutoGenerateAfterAnalysisChange?: (enabled: boolean) => void;
  onNew?: () => void;
  onOpenHistory?: () => void;
  onPromptChange: (prompt: string) => void;
  onSourceImagesChange: (images: ReferenceImage[]) => void;
  onSourceImageError: (message: string | null) => void;
  onPrimaryAction: () => void;
  plan: PsdGenerationPlan | null;
  isLayerPlanReviewed?: boolean;
  analysisStatus?: PsdAnalysisStatus | null;
  status: PsdTaskSummary | null;
  sourceImages: ReferenceImage[];
  previewUrl?: string;
  layerPreviewUrls?: Record<string, string[]>;
  layerTaskStateMap?: Record<string, PsdLayerTaskState>;
  resultCount: number;
  canDownload: boolean;
  isDownloading?: boolean;
  onDownload: () => void;
  onLayerNameChange?: (layerId: string, name: string) => void;
  onLayerPromptChange?: (layerId: string, prompt: string) => void;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onRetryLayer?: (layerId: string) => void;
  onRetryFailedLayers?: () => void;
  errorPanel?: React.ReactNode;
}

export function PsdWorkbenchView({
  uiLanguage,
  prompt,
  defaultPrompt,
  isComposerDisabled,
  primaryActionLabel,
  primaryActionEyebrow,
  canRunPrimaryAction,
  isPrimaryActionBusy,
  autoGenerateAfterAnalysis,
  onAutoGenerateAfterAnalysisChange,
  onNew,
  onOpenHistory,
  onPromptChange,
  onSourceImagesChange,
  onSourceImageError,
  onPrimaryAction,
  plan,
  isLayerPlanReviewed = false,
  analysisStatus,
  status,
  sourceImages,
  previewUrl,
  layerPreviewUrls = {},
  layerTaskStateMap = {},
  resultCount,
  canDownload,
  isDownloading = false,
  onDownload,
  onLayerNameChange,
  onLayerPromptChange,
  onLayerVisibilityChange,
  onRetryLayer,
  onRetryFailedLayers,
  errorPanel,
}: PsdWorkbenchViewProps) {
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [selectedLayerBounds, setSelectedLayerBounds] =
    useState<LayerBounds | null>(null);

  const hasLayerPlan = Boolean(plan && plan.layers.length > 0);
  const layers = plan?.layers || [];
  const activeLayer =
    layers.find((layer) => layer.id === activeLayerId) || null;
  const isAnalyzingWorkspace =
    !hasLayerPlan &&
    Boolean(analysisStatus && analysisStatus.state !== 'completed');
  const isEmptyWorkspace = !hasLayerPlan && !analysisStatus;

  const handleSelectionChange = useCallback(
    (context: {
      activeLayerId: string | null;
      selectedLayerBounds: LayerBounds | null;
    }) => {
      setActiveLayerId(context.activeLayerId);
      setSelectedLayerBounds(context.selectedLayerBounds);
    },
    []
  );

  return (
    <PsdWorkbenchShell
      uiLanguage={uiLanguage}
      header={
        <PsdWorkflowHeader
          uiLanguage={uiLanguage}
          hasSource={sourceImages.length > 0}
          hasLayerPlan={hasLayerPlan}
          isLayerPlanReviewed={isLayerPlanReviewed}
          analysisStatus={analysisStatus}
          resultCount={resultCount}
          canDownload={canDownload}
          onNew={onNew}
          onOpenHistory={onOpenHistory}
        />
      }
      brief={
        <PsdComposerPanel
          uiLanguage={uiLanguage}
          prompt={prompt}
          defaultPrompt={defaultPrompt}
          sourceImages={sourceImages}
          plan={plan}
          analysisStatus={analysisStatus}
          isDisabled={isComposerDisabled}
          primaryActionLabel={primaryActionLabel}
          primaryActionEyebrow={primaryActionEyebrow}
          canRunPrimaryAction={canRunPrimaryAction}
          isPrimaryActionBusy={isPrimaryActionBusy}
          autoGenerateAfterAnalysis={autoGenerateAfterAnalysis}
          onAutoGenerateAfterAnalysisChange={onAutoGenerateAfterAnalysisChange}
          onPromptChange={onPromptChange}
          onSourceImagesChange={onSourceImagesChange}
          onSourceImageError={onSourceImageError}
          onPrimaryAction={onPrimaryAction}
          errorPanel={errorPanel}
        />
      }
      canvas={
        <PsdCanvasStage
          uiLanguage={uiLanguage}
          plan={plan}
          sourceImages={sourceImages}
          previewUrl={previewUrl}
          layerPreviewUrls={layerPreviewUrls}
          isEmptyWorkspace={isEmptyWorkspace}
          isAnalyzingWorkspace={isAnalyzingWorkspace}
          activeLayerId={activeLayerId}
          onCanvasSizeChange={setCanvasSize}
          onSelectionChange={handleSelectionChange}
        />
      }
      plan={
        <PsdLayerWorkspace
          uiLanguage={uiLanguage}
          plan={plan}
          analysisStatus={analysisStatus}
          status={status}
          isEmptyWorkspace={isEmptyWorkspace}
          isAnalyzingWorkspace={isAnalyzingWorkspace}
          activeLayerId={activeLayerId}
          canvasSize={canvasSize}
          layerTaskStateMap={layerTaskStateMap}
          onSelectLayer={setActiveLayerId}
          onLayerNameChange={onLayerNameChange}
          onLayerPromptChange={onLayerPromptChange}
          onLayerVisibilityChange={onLayerVisibilityChange}
          onRetryLayer={onRetryLayer}
          onRetryFailedLayers={onRetryFailedLayers}
        />
      }
      operations={
        <PsdOperationsPanel
          uiLanguage={uiLanguage}
          activeLayer={activeLayer}
          layerTaskState={
            activeLayer ? layerTaskStateMap[activeLayer.id] : undefined
          }
          canvasSize={canvasSize}
          selectedLayerBounds={selectedLayerBounds}
          status={status}
          hasLayerPlan={hasLayerPlan}
          resultCount={resultCount}
          canDownload={canDownload}
          isDownloading={isDownloading}
          onDownload={onDownload}
        />
      }
    />
  );
}
