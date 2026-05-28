export interface PsdAnalysisStatus {
  state: 'queued' | 'processing' | 'completed' | 'failed';
  model: string;
  title: string;
  detail: string;
}

export type PsdPreviewSelection =
  | { type: 'source' }
  | { type: 'composite' }
  | { type: 'layer'; layerId: string };
