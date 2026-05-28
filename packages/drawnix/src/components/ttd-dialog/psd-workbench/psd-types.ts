import type { ReferenceImage } from '../shared';
import type {
  PsdGenerationPlan,
  PsdLayerPlan,
  PsdLayerStatus,
} from '../ai-psd-plan';

export type PsdLayerTaskStatus =
  | 'planned'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface PsdLayerDraft {
  id: string;
  name: string;
  prompt: string;
  visible: boolean;
  order: number;
  role: PsdLayerPlan['type'];
  taskId: string | null;
  assetUrl: string | null;
  status: PsdLayerTaskStatus;
  error: string | null;
}

export interface PsdDraft {
  id: string;
  sourceImage: ReferenceImage | null;
  prompt: string;
  layers: PsdLayerDraft[];
  createdAt: number;
  analysisTaskId: string | null;
  assetBatchId: string | null;
}

interface CreatePsdDraftFromPlanOptions {
  plan: PsdGenerationPlan;
  sourceImage?: ReferenceImage | null;
  prompt: string;
  analysisTaskId?: string | null;
  assetBatchId?: string | null;
  now?: number;
}

export function toPsdLayerTaskStatus(
  status: PsdLayerStatus | PsdLayerTaskStatus | undefined
): PsdLayerTaskStatus {
  if (
    status === 'queued' ||
    status === 'processing' ||
    status === 'ready' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'skipped'
  ) {
    return status;
  }
  return 'planned';
}

export function createPsdDraftFromPlan({
  plan,
  sourceImage = null,
  prompt,
  analysisTaskId = null,
  assetBatchId = null,
  now = Date.now(),
}: CreatePsdDraftFromPlanOptions): PsdDraft {
  return {
    id: plan.planId,
    sourceImage,
    prompt,
    createdAt: now,
    analysisTaskId,
    assetBatchId,
    layers: plan.layers.map((layer, index) => ({
      id: layer.id,
      name: layer.name,
      prompt: layer.generationPrompt || layer.description,
      visible: layer.visible,
      order: layer.stackingOrder || index + 1,
      role: layer.type,
      taskId: null,
      assetUrl: null,
      status: toPsdLayerTaskStatus(layer.status),
      error: null,
    })),
  };
}

type PsdDraftLayerUpdates = Partial<
  Pick<
    PsdLayerDraft,
    'name' | 'prompt' | 'visible' | 'status' | 'taskId' | 'assetUrl' | 'error'
  >
>;

export function updatePsdDraftLayer(
  draft: PsdDraft,
  layerId: string,
  updates: PsdDraftLayerUpdates
): PsdDraft {
  return {
    ...draft,
    layers: draft.layers.map((layer) =>
      layer.id === layerId
        ? {
            ...layer,
            ...updates,
          }
        : layer
    ),
  };
}

export function applyPsdDraftToPlan(
  plan: PsdGenerationPlan,
  draft: PsdDraft
): PsdGenerationPlan {
  const draftLayersById = new Map(draft.layers.map((layer) => [layer.id, layer]));
  return {
    ...plan,
    layers: plan.layers.map((layer) => {
      const draftLayer = draftLayersById.get(layer.id);
      if (!draftLayer) return layer;
      return {
        ...layer,
        name: draftLayer.name,
        generationPrompt: draftLayer.prompt,
        visible: draftLayer.visible,
        status: draftLayer.status as PsdLayerStatus,
      };
    }),
  };
}
