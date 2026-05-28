import type { PsdLayerPlan } from './ai-psd-plan';
import type { PsdLayerTaskState } from './psd-workbench/psd-layer-tasks';

export type PsdTaskTone = 'queued' | 'active' | 'success' | 'warning' | 'error';

export interface PsdTaskSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  progressPercent: number;
  isActive: boolean;
  tone: PsdTaskTone;
  title: string;
  countSummary: string;
  detail: string;
}

export interface LayerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const DEFAULT_ZOOM = 1;
export const ZOOM_STEP = 0.14;
export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 2.4;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getLayerBounds(
  layer: PsdLayerPlan,
  index: number
): LayerBounds {
  if (layer.bounds) {
    return {
      left: clamp(layer.bounds.left, 0, 100),
      top: clamp(layer.bounds.top, 0, 100),
      width: clamp(layer.bounds.width, 1, 100),
      height: clamp(layer.bounds.height, 1, 100),
    };
  }
  if (layer.type === 'background') {
    return { left: 4, top: 4, width: 92, height: 92 };
  }
  if (layer.type === 'text') {
    return index % 2 === 0
      ? { left: 18, top: 12, width: 64, height: 16 }
      : { left: 18, top: 70, width: 56, height: 14 };
  }
  if (layer.type === 'decoration') {
    return index % 2 === 0
      ? { left: 66, top: 18, width: 22, height: 24 }
      : { left: 10, top: 60, width: 26, height: 26 };
  }
  if (layer.type === 'adjustment') {
    return { left: 8, top: 8, width: 84, height: 84 };
  }
  return { left: 24, top: 28, width: 52, height: 48 };
}

export function getLayerStatusLabel(
  layer: PsdLayerPlan,
  status: PsdTaskSummary | null,
  uiLanguage: 'zh' | 'en',
  layerTaskState?: PsdLayerTaskState
): string {
  if (layer.visible === false || layerTaskState?.status === 'skipped') {
    return uiLanguage === 'zh' ? '已排除' : 'Excluded';
  }
  if (layerTaskState?.status === 'ready') {
    return uiLanguage === 'zh' ? '已生成' : 'Ready';
  }
  if (layerTaskState?.status === 'failed') {
    return uiLanguage === 'zh' ? '失败' : 'Failed';
  }
  if (layerTaskState?.status === 'cancelled') {
    return uiLanguage === 'zh' ? '已取消' : 'Cancelled';
  }
  if (layerTaskState?.status === 'processing') {
    return uiLanguage === 'zh' ? '生成中' : 'Generating';
  }
  if (layerTaskState?.status === 'queued') {
    return uiLanguage === 'zh' ? '已排队' : 'Queued';
  }
  if (!status || status.total === 0) {
    return uiLanguage === 'zh' ? '待生成' : 'Planned';
  }
  if (status.tone === 'success') {
    return uiLanguage === 'zh' ? '可打包' : 'Ready';
  }
  if (status.tone === 'error') {
    return uiLanguage === 'zh' ? '失败' : 'Failed';
  }
  if (status.tone === 'warning') {
    return uiLanguage === 'zh' ? '需重试' : 'Needs retry';
  }
  if (status.processing > 0) {
    return uiLanguage === 'zh' ? '生成中' : 'Generating';
  }
  if (status.pending > 0 || layer.status === 'queued') {
    return uiLanguage === 'zh' ? '已排队' : 'Queued';
  }
  return uiLanguage === 'zh' ? '已规划' : 'Planned';
}

export function getExportMessage(
  canDownload: boolean,
  uiLanguage: 'zh' | 'en'
): string {
  if (canDownload) {
    return uiLanguage === 'zh'
      ? '已有可导出的图层结果，可下载包含 layers、source、manifest 和 README 的 PSD-ready 工作区包（.zip）。'
      : 'At least one layer result is exportable. Download a PSD-ready workspace package (.zip) with layers, source, manifest, and README.';
  }
  return uiLanguage === 'zh'
    ? '真实 .psd 写入器尚未接入。至少生成一个图层结果后才可下载工作区包，也不会把 PNG 伪装成 PSD。'
    : 'The native .psd writer is not wired yet. Download becomes available after at least one layer result exists, and PNG output is not represented as PSD.';
}
