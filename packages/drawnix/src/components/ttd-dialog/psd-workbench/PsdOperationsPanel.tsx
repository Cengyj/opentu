import React from 'react';
import type { PsdGenerationPlan } from '../ai-psd-plan';
import type {
  LayerBounds,
  PsdTaskSummary,
} from '../ai-psd-workflow-view-utils';
import { PsdExportPanel } from './PsdExportPanel';
import { PsdInspectorPanel } from './PsdInspectorPanel';
import { PsdStatusBanner } from './PsdStatusBanner';
import type { PsdLayerTaskState } from './psd-layer-tasks';

type PsdLayer = PsdGenerationPlan['layers'][number];

interface PsdOperationsPanelProps {
  uiLanguage: 'zh' | 'en';
  activeLayer: PsdLayer | null;
  layerTaskState?: PsdLayerTaskState;
  canvasSize: { width: number; height: number } | null;
  selectedLayerBounds: LayerBounds | null;
  status: PsdTaskSummary | null;
  hasLayerPlan: boolean;
  resultCount: number;
  canDownload: boolean;
  isDownloading?: boolean;
  onDownload: () => void;
}

export function PsdOperationsPanel({
  uiLanguage,
  activeLayer,
  layerTaskState,
  canvasSize,
  selectedLayerBounds,
  status,
  hasLayerPlan,
  resultCount,
  canDownload,
  isDownloading = false,
  onDownload,
}: PsdOperationsPanelProps) {
  return (
    <aside
      className="psd-workbench__operations"
      aria-label={
        uiLanguage === 'zh'
          ? 'PSD 检查器、生成状态与导出'
          : 'PSD inspector, generation status, and export'
      }
    >
      {hasLayerPlan && status ? (
        <PsdStatusBanner
          tone={status.tone}
          title={status.title}
          countSummary={status.countSummary}
          detail={status.detail}
          progressPercent={status.progressPercent}
          progressLabel={
            uiLanguage === 'zh'
              ? 'PSD-ready 任务进度'
              : 'PSD-ready task progress'
          }
        />
      ) : null}

      <PsdInspectorPanel
        uiLanguage={uiLanguage}
        activeLayer={activeLayer}
        layerTaskState={layerTaskState}
        canvasSize={canvasSize}
        selectedLayerBounds={selectedLayerBounds}
      />

      <PsdExportPanel
        uiLanguage={uiLanguage}
        resultCount={resultCount}
        canDownload={canDownload}
        isDownloading={isDownloading}
        onDownload={onDownload}
      />
    </aside>
  );
}
