import React, { useCallback, useState } from 'react';
import type { PsdGenerationPlan } from '../ai-psd-plan';
import type { LayerBounds, PsdTaskSummary } from '../ai-psd-workflow-view-utils';
import type { ReferenceImage } from '../shared';
import { PsdCanvasStage } from './PsdCanvasStage';
import { PsdComposerPanel } from './PsdComposerPanel';
import { PsdLayerWorkspace } from './PsdLayerWorkspace';
import { PsdStatusBanner } from './PsdStatusBanner';
import type { PsdAnalysisStatus } from './psd-workbench-types';
import type { PsdLayerTaskState } from './psd-layer-tasks';

export type { PsdAnalysisStatus } from './psd-workbench-types';

export interface PsdWorkbenchViewProps {
  uiLanguage: 'zh' | 'en';
  language: 'zh' | 'en';
  prompt: string;
  defaultPrompt: string;
  isComposerDisabled: boolean;
  primaryActionLabel: string;
  primaryActionEyebrow: string;
  canRunPrimaryAction: boolean;
  isPrimaryActionBusy: boolean;
  onPromptChange: (prompt: string) => void;
  onSourceImagesChange: (images: ReferenceImage[]) => void;
  onSourceImageError: (message: string | null) => void;
  onPrimaryAction: () => void;
  plan: PsdGenerationPlan | null;
  isLayerPlanReviewed?: boolean;
  onLayerPlanReviewedChange?: (reviewed: boolean) => void;
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
  language,
  prompt,
  defaultPrompt,
  isComposerDisabled,
  primaryActionLabel,
  primaryActionEyebrow,
  canRunPrimaryAction,
  isPrimaryActionBusy,
  onPromptChange,
  onSourceImagesChange,
  onSourceImageError,
  onPrimaryAction,
  plan,
  isLayerPlanReviewed = false,
  onLayerPlanReviewedChange,
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
  const isAnalyzingWorkspace =
    !hasLayerPlan && Boolean(analysisStatus && analysisStatus.state !== 'completed');
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
    <div className="psd-workbench">
      <PsdComposerPanel
        uiLanguage={uiLanguage}
        language={language}
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
        onPromptChange={onPromptChange}
        onSourceImagesChange={onSourceImagesChange}
        onSourceImageError={onSourceImageError}
        onPrimaryAction={onPrimaryAction}
        errorPanel={errorPanel}
      />

      <PsdCanvasStage
        uiLanguage={uiLanguage}
        plan={plan}
        sourceImages={sourceImages}
        previewUrl={previewUrl}
        layerPreviewUrls={layerPreviewUrls}
        isEmptyWorkspace={isEmptyWorkspace}
        isAnalyzingWorkspace={isAnalyzingWorkspace}
        onCanvasSizeChange={setCanvasSize}
        onSelectionChange={handleSelectionChange}
        onLayerVisibilityChange={onLayerVisibilityChange}
      />

      <PsdLayerWorkspace
        uiLanguage={uiLanguage}
        plan={plan}
        isLayerPlanReviewed={isLayerPlanReviewed}
        onLayerPlanReviewedChange={onLayerPlanReviewedChange}
        analysisStatus={analysisStatus}
        status={status}
        isEmptyWorkspace={isEmptyWorkspace}
        isAnalyzingWorkspace={isAnalyzingWorkspace}
        activeLayerId={activeLayerId}
        canvasSize={canvasSize}
        selectedLayerBounds={selectedLayerBounds}
        layerTaskStateMap={layerTaskStateMap}
        resultCount={resultCount}
        canDownload={canDownload}
        isDownloading={isDownloading}
        onDownload={onDownload}
        onSelectLayer={setActiveLayerId}
        onLayerNameChange={onLayerNameChange}
        onLayerPromptChange={onLayerPromptChange}
        onLayerVisibilityChange={onLayerVisibilityChange}
        onRetryLayer={onRetryLayer}
        onRetryFailedLayers={onRetryFailedLayers}
      />

      {hasLayerPlan && status ? (
        <PsdStatusBanner
          tone={status.tone}
          title={status.title}
          countSummary={status.countSummary}
          detail={status.detail}
          progressPercent={status.progressPercent}
          progressLabel={
            uiLanguage === 'zh' ? 'PSD-ready 任务进度' : 'PSD-ready task progress'
          }
        />
      ) : null}
    </div>
  );
}
