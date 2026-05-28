import React from 'react';
import { Crosshair, Info, Ruler, SquareStack } from 'lucide-react';
import type { PsdGenerationPlan } from '../ai-psd-plan';
import type { LayerBounds } from '../ai-psd-workflow-view-utils';
import type { PsdLayerTaskState } from './psd-layer-tasks';

type PsdLayer = PsdGenerationPlan['layers'][number];

interface PsdInspectorPanelProps {
  uiLanguage: 'zh' | 'en';
  activeLayer: PsdLayer | null;
  layerTaskState?: PsdLayerTaskState;
  canvasSize: { width: number; height: number } | null;
  selectedLayerBounds: LayerBounds | null;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function PsdInspectorPanel({
  uiLanguage,
  activeLayer,
  layerTaskState,
  canvasSize,
  selectedLayerBounds,
}: PsdInspectorPanelProps) {
  const statusLabel =
    layerTaskState?.label ||
    (uiLanguage === 'zh' ? '等待图层任务' : 'Awaiting layer task');

  return (
    <section
      className="psd-inspector-card"
      aria-label={
        uiLanguage === 'zh' ? 'PSD 图层检查器' : 'PSD layer inspector'
      }
    >
      <div className="psd-inspector-card__head">
        <span>
          <Info size={13} />
          {uiLanguage === 'zh' ? '检查器' : 'Inspector'}
        </span>
        <strong>
          {activeLayer?.name ||
            (uiLanguage === 'zh' ? '选择画布或图层' : 'Select canvas or layer')}
        </strong>
      </div>

      <dl className="psd-inspector-metrics">
        <div>
          <dt>
            <SquareStack size={13} />
            {uiLanguage === 'zh' ? '图层类型' : 'Layer type'}
          </dt>
          <dd>
            {activeLayer?.type || (uiLanguage === 'zh' ? '未选择' : 'None')}
          </dd>
        </div>
        <div>
          <dt>
            <Ruler size={13} />
            {uiLanguage === 'zh' ? '画布' : 'Canvas'}
          </dt>
          <dd>
            {canvasSize
              ? `${canvasSize.width} × ${canvasSize.height}`
              : uiLanguage === 'zh'
              ? '等待源图尺寸'
              : 'Waiting for source size'}
          </dd>
        </div>
        <div>
          <dt>
            <Crosshair size={13} />
            {uiLanguage === 'zh' ? '位置' : 'Bounds'}
          </dt>
          <dd>
            {selectedLayerBounds
              ? `${formatPercent(selectedLayerBounds.left)}, ${formatPercent(
                  selectedLayerBounds.top
                )} · ${formatPercent(
                  selectedLayerBounds.width
                )} × ${formatPercent(selectedLayerBounds.height)}`
              : uiLanguage === 'zh'
              ? '选择图层查看'
              : 'Select a layer'}
          </dd>
        </div>
      </dl>

      <div className="psd-inspector-contract">
        <strong>{uiLanguage === 'zh' ? '任务状态' : 'Task state'}</strong>
        <span>{statusLabel}</span>
        <p>
          {uiLanguage === 'zh'
            ? '检查器只读取本地图层计划和 params.psdPlan.layerId 映射，便于后续扩展属性面板。'
            : 'The inspector reads the local layer plan and params.psdPlan.layerId mapping only, keeping room for future property panels.'}
        </p>
      </div>
    </section>
  );
}
