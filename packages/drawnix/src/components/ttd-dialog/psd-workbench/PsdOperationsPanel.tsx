import React, { useState, useEffect } from 'react';
import { Info, PackageCheck } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'inspector' | 'export'>('inspector');

  // Auto-switch to export tab when tasks complete and PSD is ready for download
  useEffect(() => {
    if (canDownload) {
      setActiveTab('export');
    }
  }, [canDownload]);

  const getPanelStyle = (tab: 'inspector' | 'export') => {
    const isVisible = activeTab === tab;
    return isVisible
      ? { height: '100%', minHeight: 0 }
      : {
          position: 'absolute' as const,
          left: '-9999px',
          top: '-9999px',
          width: 0,
          height: 0,
          overflow: 'hidden',
          opacity: 0,
        };
  };

  return (
    <aside
      className="psd-workbench__operations"
      aria-label={
        uiLanguage === 'zh'
          ? 'PSD 检查器、生成状态与导出'
          : 'PSD inspector, status, and export'
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

      <div className="psd-operations-card">
        <div className="psd-operations-tabs">
          <button
            type="button"
            className={`psd-operations-tab ${
              activeTab === 'inspector' ? 'psd-operations-tab--active' : ''
            }`}
            onClick={() => setActiveTab('inspector')}
          >
            <Info size={13} />
            <span>{uiLanguage === 'zh' ? '属性检查器' : 'Inspector'}</span>
          </button>
          <button
            type="button"
            className={`psd-operations-tab ${
              activeTab === 'export' ? 'psd-operations-tab--active' : ''
            }`}
            onClick={() => setActiveTab('export')}
          >
            <PackageCheck size={13} />
            <span>{uiLanguage === 'zh' ? '打包与导出' : 'Export'}</span>
            {resultCount > 0 ? (
              <span className="psd-operations-tab-badge">{resultCount}</span>
            ) : null}
          </button>
        </div>

        <div className="psd-operations-tab-content" style={{ position: 'relative' }}>
          <div style={getPanelStyle('inspector')}>
            <PsdInspectorPanel
              uiLanguage={uiLanguage}
              activeLayer={activeLayer}
              layerTaskState={layerTaskState}
              canvasSize={canvasSize}
              selectedLayerBounds={selectedLayerBounds}
            />
          </div>
          <div style={getPanelStyle('export')}>
            <PsdExportPanel
              uiLanguage={uiLanguage}
              resultCount={resultCount}
              canDownload={canDownload}
              isDownloading={isDownloading}
              onDownload={onDownload}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
