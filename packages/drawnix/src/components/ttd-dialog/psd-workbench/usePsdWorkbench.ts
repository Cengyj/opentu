import { useCallback, useEffect, useState } from 'react';
import type { ReferenceImage } from '../shared';
import type { PsdGenerationPlan, PsdLayerStatus } from '../ai-psd-plan';
import {
  createPsdDraftFromPlan,
  toPsdLayerTaskStatus,
  updatePsdDraftLayer,
  type PsdDraft,
} from './psd-types';

interface UsePsdWorkbenchOptions {
  prompt: string;
  sourceImage?: ReferenceImage | null;
  analysisTaskId?: string | null;
  assetBatchId?: string | null;
}

export function usePsdWorkbench({
  prompt,
  sourceImage = null,
  analysisTaskId = null,
  assetBatchId = null,
}: UsePsdWorkbenchOptions) {
  const [plan, setPlanState] = useState<PsdGenerationPlan | null>(null);
  const [draft, setDraft] = useState<PsdDraft | null>(null);

  const setPlan = useCallback(
    (
      nextPlan: PsdGenerationPlan | null,
      context: {
        prompt?: string;
        sourceImage?: ReferenceImage | null;
        analysisTaskId?: string | null;
        assetBatchId?: string | null;
      } = {}
    ) => {
      setPlanState(nextPlan);
      setDraft(
        nextPlan
          ? createPsdDraftFromPlan({
              plan: nextPlan,
              prompt: context.prompt ?? prompt,
              sourceImage: context.sourceImage ?? sourceImage,
              analysisTaskId: context.analysisTaskId ?? analysisTaskId,
              assetBatchId: context.assetBatchId ?? assetBatchId,
            })
          : null
      );
    },
    [analysisTaskId, assetBatchId, prompt, sourceImage]
  );

  const reset = useCallback(() => {
    setPlanState(null);
    setDraft(null);
  }, []);

  const updateLayer = useCallback(
    (
      layerId: string,
      updates: Partial<{
        name: string;
        prompt: string;
        visible: boolean;
        status: PsdLayerStatus;
      }>
    ) => {
      setPlanState((current) => {
        if (!current) return current;
        return {
          ...current,
          layers: current.layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  ...(updates.name !== undefined ? { name: updates.name } : {}),
                  ...(updates.prompt !== undefined
                    ? { generationPrompt: updates.prompt }
                    : {}),
                  ...(updates.visible !== undefined
                    ? { visible: updates.visible }
                    : {}),
                  ...(updates.status !== undefined
                    ? { status: updates.status }
                    : {}),
                }
              : layer
          ),
        };
      });
      setDraft((current) =>
        current
          ? updatePsdDraftLayer(current, layerId, {
              ...(updates.name !== undefined ? { name: updates.name } : {}),
              ...(updates.prompt !== undefined ? { prompt: updates.prompt } : {}),
              ...(updates.visible !== undefined
                ? { visible: updates.visible }
                : {}),
              ...(updates.status !== undefined
                ? { status: toPsdLayerTaskStatus(updates.status) }
                : {}),
            })
          : current
      );
    },
    []
  );

  const updateLayerName = useCallback(
    (layerId: string, name: string) => {
      updateLayer(layerId, { name });
    },
    [updateLayer]
  );

  const updateLayerPrompt = useCallback(
    (layerId: string, promptValue: string) => {
      updateLayer(layerId, { prompt: promptValue });
    },
    [updateLayer]
  );

  const updateLayerVisibility = useCallback(
    (layerId: string, visible: boolean) => {
      updateLayer(layerId, { visible });
    },
    [updateLayer]
  );

  const updateLayerStatuses = useCallback(
    (layerIds: string[], status: PsdLayerStatus) => {
      const layerIdSet = new Set(layerIds);
      setPlanState((current) => {
        if (!current) return current;
        return {
          ...current,
          layers: current.layers.map((layer) =>
            layerIdSet.has(layer.id) ? { ...layer, status } : layer
          ),
        };
      });
      setDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          layers: current.layers.map((layer) =>
            layerIdSet.has(layer.id)
              ? { ...layer, status: toPsdLayerTaskStatus(status) }
              : layer
          ),
        };
      });
    },
    []
  );

  useEffect(() => {
    setDraft((current) =>
      current
        ? {
            ...current,
            assetBatchId: assetBatchId || current.assetBatchId,
          }
        : current
    );
  }, [assetBatchId]);

  return {
    plan,
    draft,
    setPlan,
    reset,
    updateLayerName,
    updateLayerPrompt,
    updateLayerVisibility,
    updateLayerStatuses,
  };
}
