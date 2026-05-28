import React from 'react';
import { CheckCircle2, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { getLayerTypeLabel, type PsdGenerationPlan } from '../ai-psd-plan';
import {
  getLayerStatusLabel,
  type LayerBounds,
  type PsdTaskSummary,
} from '../ai-psd-workflow-view-utils';
import type { PsdLayerTaskState } from './psd-layer-tasks';

type PsdLayer = PsdGenerationPlan['layers'][number];

interface PsdLayerCardProps {
  uiLanguage: 'zh' | 'en';
  layer: PsdLayer;
  isSelected: boolean;
  isExpanded: boolean;
  canvasSize: { width: number; height: number } | null;
  selectedLayerBounds: LayerBounds | null;
  layerTaskState?: PsdLayerTaskState;
  status: PsdTaskSummary | null;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onLayerNameChange?: (layerId: string, name: string) => void;
  onLayerPromptChange?: (layerId: string, prompt: string) => void;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onRetryLayer?: (layerId: string) => void;
}

export function PsdLayerCard({
  uiLanguage,
  layer,
  isSelected,
  isExpanded,
  canvasSize,
  selectedLayerBounds,
  layerTaskState,
  status,
  onSelect,
  onToggleExpanded,
  onLayerNameChange,
  onLayerPromptChange,
  onLayerVisibilityChange,
  onRetryLayer,
}: PsdLayerCardProps) {
  const isHidden = layer.visible === false;
  const layerStatus = layerTaskState?.status || status?.tone || layer.status;
  const canRetryLayer = Boolean(onRetryLayer) && (layerTaskState?.status === 'failed' || layerTaskState?.status === 'cancelled');

  return (
    <article className={`psd-layer-card psd-layer-card--${layerStatus} ${isSelected ? 'psd-layer-card--selected' : ''} ${isHidden ? 'psd-layer-card--hidden' : ''} ${isExpanded ? 'psd-layer-card--expanded' : ''}`}>
      <div className="psd-layer-card__header" onClick={() => { onSelect(); onToggleExpanded(); }}>
        <div className="psd-layer-card__main">
          <span className={`psd-layer-card__swatch psd-layer-card__swatch--${layer.type}`} />
          <div className="psd-layer-card__info">
            <strong>{layer.name}</strong>
            <small>{getLayerTypeLabel(layer.type, uiLanguage)} · {layer.opacity}% · {isHidden ? uiLanguage === 'zh' ? '已排除' : 'Excluded' : uiLanguage === 'zh' ? '参与' : 'Included'}</small>
          </div>
        </div>

        <div className="psd-layer-card__right-actions" onClick={(event) => event.stopPropagation()}>
          <span className={`psd-layer-card__status psd-layer-card__status--${layerStatus}`}>
            {getLayerStatusLabel(layer, status, uiLanguage, layerTaskState)}
          </span>
          {canRetryLayer ? (
            <button
              type="button"
              className="psd-layer-card__retry"
              onClick={() => onRetryLayer?.(layer.id)}
              aria-label={uiLanguage === 'zh' ? `重试图层：${layer.name}` : `Retry layer: ${layer.name}`}
            >
              <RefreshCcw size={13} />
            </button>
          ) : null}
          <button
            type="button"
            className="psd-layer-card__visibility"
            onClick={() => onLayerVisibilityChange?.(layer.id, isHidden)}
            aria-pressed={!isHidden}
            aria-label={isHidden ? uiLanguage === 'zh' ? `显示图层：${layer.name}` : `Show layer: ${layer.name}` : uiLanguage === 'zh' ? `隐藏图层：${layer.name}` : `Hide layer: ${layer.name}`}
          >
            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="psd-layer-card__body" onClick={(event) => event.stopPropagation()}>
          <div className="psd-layer-card__fields">
            <label>
              <span>{uiLanguage === 'zh' ? '图层名称' : 'Layer name'}</span>
              <input
                aria-label={uiLanguage === 'zh' ? `图层名称：${layer.name}` : `Layer name: ${layer.name}`}
                value={layer.name}
                onChange={(event) => onLayerNameChange?.(layer.id, event.target.value)}
                disabled={!onLayerNameChange}
              />
            </label>
            <label>
              <span>{uiLanguage === 'zh' ? '图层生成提示词' : 'Layer prompt'}</span>
              <textarea
                aria-label={uiLanguage === 'zh' ? `图层提示词：${layer.name}` : `Layer prompt: ${layer.name}`}
                value={layer.generationPrompt || layer.description}
                onChange={(event) => onLayerPromptChange?.(layer.id, event.target.value)}
                disabled={!onLayerPromptChange}
              />
            </label>
            <label className="psd-layer-card__include">
              <input
                type="checkbox"
                checked={layer.visible !== false}
                onChange={(event) => onLayerVisibilityChange?.(layer.id, event.target.checked)}
                disabled={!onLayerVisibilityChange}
                aria-label={uiLanguage === 'zh' ? `参与生成与导出：${layer.name}` : `Include in generation and export: ${layer.name}`}
              />
              <span>{uiLanguage === 'zh' ? '参与生成与导出' : 'Include in generation/export'}</span>
            </label>
          </div>

          <div className="psd-layer-card__metrics">
            <div className="psd-layer-card__metric-row"><span>{uiLanguage === 'zh' ? '类型' : 'Type'}</span><strong>{getLayerTypeLabel(layer.type, uiLanguage)}</strong></div>
            <div className="psd-layer-card__metric-row"><span>{uiLanguage === 'zh' ? '透明度' : 'Opacity'}</span><strong>{layer.opacity}%</strong></div>
            {canvasSize ? <div className="psd-layer-card__metric-row"><span>{uiLanguage === 'zh' ? '画布大小' : 'Canvas size'}</span><strong>{canvasSize.width} x {canvasSize.height}</strong></div> : null}
            {selectedLayerBounds ? <div className="psd-layer-card__metric-row"><span>{uiLanguage === 'zh' ? '图层坐标' : 'Coordinates'}</span><strong>{Math.round(selectedLayerBounds.left)}%, {Math.round(selectedLayerBounds.top)}%</strong></div> : null}
          </div>

          {layerTaskState?.error ? <div className="psd-layer-card__error">{layerTaskState.error}</div> : null}
          <div className="psd-layer-card__tip">
            <CheckCircle2 size={12} />
            <span>{uiLanguage === 'zh' ? 'PSD 语义：同画布、原坐标、透明背景，导入 Photoshop 无需移动缩放即可叠放还原。' : 'PSD semantics: same canvas, original coordinates, transparent background, and in-place Photoshop stacking.'}</span>
          </div>
        </div>
      ) : null}
    </article>
  );
}
