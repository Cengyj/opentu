import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Layers3, PanelRight, RefreshCcw } from 'lucide-react';
import type { PsdGenerationPlan } from '../ai-psd-plan';
import type { PsdTaskSummary } from '../ai-psd-workflow-view-utils';
import { PsdLayerCard } from './PsdLayerCard';
import type { PsdLayerTaskState } from './psd-layer-tasks';
import type { PsdAnalysisStatus } from './psd-workbench-types';

interface PsdLayerWorkspaceProps {
  uiLanguage: 'zh' | 'en';
  plan: PsdGenerationPlan | null;
  analysisStatus?: PsdAnalysisStatus | null;
  status: PsdTaskSummary | null;
  isEmptyWorkspace: boolean;
  isAnalyzingWorkspace: boolean;
  activeLayerId: string | null;
  canvasSize: { width: number; height: number } | null;
  layerTaskStateMap?: Record<string, PsdLayerTaskState>;
  onSelectLayer: (layerId: string) => void;
  onLayerNameChange?: (layerId: string, name: string) => void;
  onLayerPromptChange?: (layerId: string, prompt: string) => void;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onLayerRemove?: (layerId: string) => void;
  onRetryLayer?: (layerId: string) => void;
  onRetryFailedLayers?: () => void;
}

function PsdWorkspaceEmptyState({
  uiLanguage,
  isAnalyzingWorkspace,
  analysisStatus,
}: {
  uiLanguage: 'zh' | 'en';
  isAnalyzingWorkspace: boolean;
  analysisStatus?: PsdAnalysisStatus | null;
}) {
  const rows = isAnalyzingWorkspace
    ? [
        uiLanguage === 'zh' ? '读取源图视觉结构' : 'Reading source composition',
        uiLanguage === 'zh'
          ? '识别互斥图层区域'
          : 'Identifying mutually exclusive regions',
        uiLanguage === 'zh'
          ? '准备可审阅图层计划'
          : 'Preparing reviewable layer plan',
      ]
    : [
        uiLanguage === 'zh'
          ? '上传源图并填写图层任务简报'
          : 'Upload source and write a layer task brief',
        uiLanguage === 'zh'
          ? '先创建 CHAT 分析任务'
          : 'Create the CHAT analysis task first',
        uiLanguage === 'zh'
          ? '审阅后再生成 IMAGE 图层素材'
          : 'Review before generating IMAGE layer assets',
      ];

  return (
    <div
      className={`psd-layer-intake ${
        isAnalyzingWorkspace ? 'psd-layer-intake--active' : ''
      }`}
      role={isAnalyzingWorkspace ? 'status' : undefined}
    >
      <div className="psd-layer-intake__icon">
        {isAnalyzingWorkspace ? <Clock3 size={22} /> : <Layers3 size={22} />}
      </div>
      <div className="psd-layer-intake__copy">
        <strong>
          {isAnalyzingWorkspace
            ? uiLanguage === 'zh'
              ? '正在解析图层结构'
              : 'Analyzing layer structure'
            : uiLanguage === 'zh'
            ? '图层计划将在此处就位'
            : 'Layer plan will dock here'}
        </strong>
        <p>
          {isAnalyzingWorkspace
            ? analysisStatus?.detail ||
              (uiLanguage === 'zh'
                ? '分析完成后仍在当前面板审阅。'
                : 'Review stays in this panel when analysis completes.')
            : uiLanguage === 'zh'
            ? '空态、分析态与结果态都保留在同一个图层工作区，不切换页面。'
            : 'Empty, analyzing, and result states remain in the same layer workspace without page switching.'}
        </p>
      </div>
      <div className="psd-analysis-timeline">
        {rows.map((item, index) => (
          <div key={item} className="psd-analysis-timeline__row">
            <span>{index + 1}</span>
            <strong>{item}</strong>
          </div>
        ))}
      </div>
      {isAnalyzingWorkspace ? (
        <div className="psd-analysis-progress-bar-wrap">
          <div className="psd-analysis-progress-bar">
            <div className="psd-analysis-progress-bar-fill" />
          </div>
          <div className="psd-analysis-progress-label">
            <span>
              {analysisStatus?.title ||
                (uiLanguage === 'zh' ? '正在分析图层' : 'Analyzing layers')}
            </span>
            <span>{uiLanguage === 'zh' ? '进行中' : 'Running'}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PsdLayerWorkspace({
  uiLanguage,
  plan,
  analysisStatus,
  status,
  isEmptyWorkspace,
  isAnalyzingWorkspace,
  activeLayerId,
  canvasSize,
  layerTaskStateMap = {},
  onSelectLayer,
  onLayerNameChange,
  onLayerPromptChange,
  onLayerVisibilityChange,
  onLayerRemove,
  onRetryLayer,
  onRetryFailedLayers,
}: PsdLayerWorkspaceProps) {
  const layers = useMemo(() => plan?.layers || [], [plan?.layers]);
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);
  const visibleLayerCount = layers.filter(
    (layer) => layer.visible !== false
  ).length;
  const retryableLayerIds = useMemo(() => {
    const visibleLayerIds = new Set(
      layers
        .filter(
          (layer) => layer.visible !== false && layer.type !== 'adjustment'
        )
        .map((layer) => layer.id)
    );
    return Object.values(layerTaskStateMap)
      .filter(
        (state) =>
          visibleLayerIds.has(state.layerId) &&
          (state.status === 'failed' || state.status === 'cancelled')
      )
      .map((state) => state.layerId);
  }, [layerTaskStateMap, layers]);

  useEffect(() => {
    if (activeLayerId) setExpandedLayerId(activeLayerId);
  }, [activeLayerId]);

  return (
    <section
      className="psd-layer-workspace"
      aria-label={
        uiLanguage === 'zh' ? 'PSD 图层计划工作区' : 'PSD layer plan workspace'
      }
    >
      <div className="psd-layer-workspace__header">
        <div>
          <span>{uiLanguage === 'zh' ? '图层工作区' : 'Layer workspace'}</span>
          <strong>
            {layers.length > 0
              ? uiLanguage === 'zh'
                ? plan?.analysis
                  ? `${layers.length} 个动态图层`
                  : `${layers.length} 个计划图层`
                : plan?.analysis
                ? `${layers.length} dynamic layers`
                : `${layers.length} planned layers`
              : uiLanguage === 'zh'
              ? '等待可审阅计划'
              : 'Awaiting reviewable plan'}
          </strong>
        </div>
        <div className="psd-layer-workspace__actions">
          {retryableLayerIds.length > 0 && onRetryFailedLayers ? (
            <button
              type="button"
              className="psd-layer-workspace__retry"
              onClick={onRetryFailedLayers}
            >
              <RefreshCcw size={14} />
              {uiLanguage === 'zh' ? '重试全部失败图层' : 'Retry failed layers'}
            </button>
          ) : null}
          <span className="psd-layer-workspace__visible-count">
            <PanelRight size={15} />
            {uiLanguage === 'zh'
              ? `${visibleLayerCount} 可见`
              : `${visibleLayerCount} visible`}
          </span>
        </div>
      </div>

      {layers.length === 0 ? (
        <PsdWorkspaceEmptyState
          uiLanguage={uiLanguage}
          isAnalyzingWorkspace={isAnalyzingWorkspace && !isEmptyWorkspace}
          analysisStatus={analysisStatus}
        />
      ) : (
        <div className="psd-layer-list">
          {layers.map((layer) => (
              <PsdLayerCard
                key={layer.id}
                uiLanguage={uiLanguage}
                layer={layer}
                isSelected={layer.id === activeLayerId}
                isExpanded={expandedLayerId === layer.id}
                canvasSize={canvasSize}
                selectedLayerBounds={null}
                layerTaskState={layerTaskStateMap[layer.id]}
                status={status}
                onSelect={() => onSelectLayer(layer.id)}
                onToggleExpanded={() =>
                  setExpandedLayerId((current) =>
                    current === layer.id ? null : layer.id
                  )
                }
                onLayerNameChange={onLayerNameChange}
                onLayerPromptChange={onLayerPromptChange}
                onLayerVisibilityChange={onLayerVisibilityChange}
                onLayerRemove={onLayerRemove}
                canRemoveLayer={layers.length > 1}
                onRetryLayer={onRetryLayer}
              />
            ))}
        </div>
      )}
    </section>
  );
}
