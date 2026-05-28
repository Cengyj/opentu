import React from 'react';
import { Crosshair, Info, Ruler, SquareStack, Compass, Lightbulb } from 'lucide-react';
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

function getTaskStateLabel(
  state: PsdLayerTaskState | undefined,
  uiLanguage: 'zh' | 'en'
) {
  if (!state)
    return uiLanguage === 'zh' ? '等待图层任务' : 'Awaiting layer task';
  const labels: Record<
    PsdLayerTaskState['status'],
    { zh: string; en: string }
  > = {
    planned: { zh: '计划待生成', en: 'Planned' },
    queued: { zh: '排队中', en: 'Queued' },
    processing: { zh: '生成中', en: 'Processing' },
    ready: { zh: '已生成', en: 'Ready' },
    failed: { zh: '失败', en: 'Failed' },
    cancelled: { zh: '已取消', en: 'Cancelled' },
    skipped: { zh: '已跳过', en: 'Skipped' },
  };
  return labels[state.status][uiLanguage];
}

export function PsdInspectorPanel({
  uiLanguage,
  activeLayer,
  layerTaskState,
  canvasSize,
  selectedLayerBounds,
}: PsdInspectorPanelProps) {
  const statusLabel = getTaskStateLabel(layerTaskState, uiLanguage);

  const getLayerTypeLabel = (type: string) => {
    if (type === 'text') return uiLanguage === 'zh' ? '智能文字层 (Text)' : 'Text Layer';
    if (type === 'subject') return uiLanguage === 'zh' ? '视觉主体层 (Subject)' : 'Subject Layer';
    return uiLanguage === 'zh' ? '背景底画层 (Background)' : 'Background Layer';
  };

  const getLayerZIndexLabel = (type: string) => {
    if (type === 'text') return 'Z-Index: 3 (顶层 / Top)';
    if (type === 'subject') return 'Z-Index: 2 (中景 / Middle)';
    return 'Z-Index: 1 (底层 / Bottom)';
  };

  const getAISuggestion = (type: string) => {
    if (type === 'text') {
      return uiLanguage === 'zh'
        ? 'AI 将智能锁定文字轮廓并提取原始排版，导出时自动保留矢量遮罩层。'
        : 'AI isolates text contours and extracts layouts, automatically retaining vector masks on export.';
    }
    if (type === 'subject') {
      return uiLanguage === 'zh'
        ? '视觉主体分割已激活。AI 将自动擦除背景，为您生成完美的 PNG 透明通道素材。'
        : 'Subject segmentation active. AI automatically erases background to generate alpha-channel PNGs.';
    }
    return uiLanguage === 'zh'
      ? '背景外扩与重绘已激活。AI 将基于大模型进行多维画面外扩，生成高清底图以供延展。'
      : 'Outpainting active. AI executes context-aware canvas expansion to generate a seamless, high-res background.';
  };

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
            (uiLanguage === 'zh' ? '全局画布属性' : 'Global Canvas')}
        </strong>
      </div>

      {activeLayer ? (
        <>
          {/* Visual Canvas Composition Preview */}
          <div className="psd-inspector-preview-box">
            <div className="psd-inspector-preview-canvas">
              <div
                className="psd-inspector-preview-layer"
                style={{
                  left: selectedLayerBounds ? `${selectedLayerBounds.left}%` : '10%',
                  top: selectedLayerBounds ? `${selectedLayerBounds.top}%` : '10%',
                  width: selectedLayerBounds ? `${selectedLayerBounds.width}%` : '80%',
                  height: selectedLayerBounds ? `${selectedLayerBounds.height}%` : '80%',
                }}
              />
            </div>
            <div className="psd-inspector-preview-label">
              <span>{uiLanguage === 'zh' ? '画布相对空间构图' : 'Composition Grid'}</span>
            </div>
          </div>

          <dl className="psd-inspector-metrics">
            <div>
              <dt>
                <SquareStack size={13} />
                {uiLanguage === 'zh' ? '图层类型' : 'Layer type'}
              </dt>
              <dd title={getLayerTypeLabel(activeLayer.type)}>
                {getLayerTypeLabel(activeLayer.type)}
              </dd>
            </div>
            <div>
              <dt>
                <Ruler size={13} />
                {uiLanguage === 'zh' ? '画布尺寸' : 'Canvas Size'}
              </dt>
              <dd>
                {canvasSize
                  ? `${canvasSize.width} × ${canvasSize.height} px`
                  : uiLanguage === 'zh'
                  ? '等待源图尺寸'
                  : 'Awaiting size'}
              </dd>
            </div>
            <div>
              <dt>
                <Crosshair size={13} />
                {uiLanguage === 'zh' ? '空间位置' : 'Bounds'}
              </dt>
              <dd>
                {selectedLayerBounds
                  ? `${formatPercent(selectedLayerBounds.left)}, ${formatPercent(
                      selectedLayerBounds.top
                    )} · ${formatPercent(
                      selectedLayerBounds.width
                    )} × ${formatPercent(selectedLayerBounds.height)}`
                  : uiLanguage === 'zh'
                  ? '自适应分配'
                  : 'Auto bounds'}
              </dd>
            </div>
            <div>
              <dt>
                <Compass size={13} />
                {uiLanguage === 'zh' ? '渲染层级' : 'Z-Index'}
              </dt>
              <dd>{getLayerZIndexLabel(activeLayer.type)}</dd>
            </div>
          </dl>

          <div className="psd-inspector-contract">
            <strong>{uiLanguage === 'zh' ? '任务状态' : 'Task state'}</strong>
            <span>{statusLabel}</span>
          </div>

          <div className="psd-inspector-suggestion">
            <div>
              <Lightbulb size={13} />
              <strong>{uiLanguage === 'zh' ? 'AI 智绘建议' : 'AI Directives'}</strong>
            </div>
            <p>{getAISuggestion(activeLayer.type)}</p>
          </div>
        </>
      ) : (
        <>
          {/* Rich Global Canvas Placeholder */}
          <div className="psd-inspector-preview-box psd-inspector-preview-box--global">
            <div className="psd-inspector-preview-canvas psd-inspector-preview-canvas--grid">
              <span className="psd-inspector-grid-logo">PSD</span>
            </div>
            <div className="psd-inspector-preview-label">
              <span>{uiLanguage === 'zh' ? '工作空间全局属性' : 'Global Workspace'}</span>
            </div>
          </div>

          <dl className="psd-inspector-metrics">
            <div>
              <dt>
                <Ruler size={13} />
                {uiLanguage === 'zh' ? '参考底图' : 'Reference Size'}
              </dt>
              <dd title={canvasSize ? `${canvasSize.width} × ${canvasSize.height} px` : ''}>
                {canvasSize
                  ? `${canvasSize.width} × ${canvasSize.height} px`
                  : uiLanguage === 'zh'
                  ? '等待参考源图'
                  : 'Awaiting reference'}
              </dd>
            </div>
            <div>
              <dt>
                <Compass size={13} />
                {uiLanguage === 'zh' ? '纵横比例' : 'Aspect Ratio'}
              </dt>
              <dd>
                {canvasSize
                  ? `${(canvasSize.width / canvasSize.height).toFixed(2)}:1`
                  : uiLanguage === 'zh'
                  ? '等比缩放'
                  : 'Adaptive'}
              </dd>
            </div>
            <div>
              <dt>
                <SquareStack size={13} />
                {uiLanguage === 'zh' ? '导出格式' : 'Export Format'}
              </dt>
              <dd>PSD-ready ZIP</dd>
            </div>
          </dl>

          <div className="psd-inspector-suggestion">
            <div>
              <Lightbulb size={13} />
              <strong>{uiLanguage === 'zh' ? '操作指南' : 'Quick Guide'}</strong>
            </div>
            <p>
              {uiLanguage === 'zh'
                ? '请在中台画布上选中任意分割图层，或在上方列表中单击选择，即可在此深度定制空间属性与生成参数。'
                : 'Select any layer on the canvas or from the generation list above to view spatial dimensions and custom AI parameters.'}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
