import type { PsdGenerationPlan } from '../../components/ttd-dialog/ai-psd-plan';

export type PsdHistoryStatus =
  | 'reviewing'
  | 'generating'
  | 'completed'
  | 'partial'
  | 'failed';

export interface PsdHistorySourceImage {
  url: string;
  name?: string;
}

/**
 * 一条 PSD 会话历史。一条 = 一次完整「分析 → 生成」会话。
 * 与素材库解耦：独立存于 IndexedDB `psd_history`，图片字节复用共享
 * `/__aitu_cache__/` 缓存，刷新后仍可预览。
 */
export interface PsdHistoryEntry {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: PsdHistoryStatus;
  title: string;
  prompt: string;
  sourceImage: PsdHistorySourceImage | null;
  plan: PsdGenerationPlan;
  planId: string;
  psdBatchId: string | null;
  analysisTaskId: string | null;
  taskIds: string[];
  /** layerId → 已缓存的结果 url 快照（离线缩略图兜底） */
  layerResults: Record<string, string[]>;
}
