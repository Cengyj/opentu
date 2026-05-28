import { TaskStatus, type Task } from '../../../types/task.types';
import type { PsdLayerPlan } from '../ai-psd-plan';
import { getTaskResultUrls } from '../ai-psd-generation-workflow';
import type { PsdLayerTaskStatus } from './psd-types';

export interface PsdLayerTaskState {
  layerId: string;
  taskId: string | null;
  status: PsdLayerTaskStatus;
  resultUrls: string[];
  error: string | null;
}

function getTaskLayerId(task: Task): string | null {
  const layerId = task.params?.psdPlan?.layerId;
  if (typeof layerId !== 'string' || layerId === 'psd-ready-composite') {
    return null;
  }
  return layerId;
}

function getTaskLayerName(task: Task): string | null {
  const layerName = task.params?.psdPlan?.layerName;
  return typeof layerName === 'string' ? layerName : null;
}

function getTaskUpdatedAt(task: Task): number {
  return task.updatedAt || task.createdAt || 0;
}

function isNewerPsdTask(candidate: Task, current: Task): boolean {
  const candidateUpdatedAt = getTaskUpdatedAt(candidate);
  const currentUpdatedAt = getTaskUpdatedAt(current);
  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt;
  }
  return candidate.id.localeCompare(current.id) >= 0;
}

function getTaskError(task: Task): string | null {
  return task.error?.message || task.error?.code || null;
}

function getLayerStateFromTask(task: Task): PsdLayerTaskState {
  const resultUrls = getTaskResultUrls(task);
  const layerId = getTaskLayerId(task) || '';

  if (task.status === TaskStatus.COMPLETED) {
    return {
      layerId,
      taskId: task.id,
      status: resultUrls.length > 0 ? 'ready' : 'failed',
      resultUrls,
      error: resultUrls.length > 0 ? null : 'No image result URL',
    };
  }

  if (task.status === TaskStatus.FAILED) {
    return {
      layerId,
      taskId: task.id,
      status: 'failed',
      resultUrls: [],
      error: getTaskError(task),
    };
  }

  if (task.status === TaskStatus.CANCELLED) {
    return {
      layerId,
      taskId: task.id,
      status: 'cancelled',
      resultUrls: [],
      error: getTaskError(task),
    };
  }

  return {
    layerId,
    taskId: task.id,
    status:
      task.status === TaskStatus.PROCESSING ? 'processing' : 'queued',
    resultUrls: [],
    error: null,
  };
}

export function buildPsdLayerTaskStateMap(
  layers: PsdLayerPlan[],
  tasks: Task[]
): Record<string, PsdLayerTaskState> {
  const latestTaskByLayerId = new Map<string, Task>();

  for (const task of tasks) {
    const layerId = getTaskLayerId(task);
    if (!layerId) continue;
    const current = latestTaskByLayerId.get(layerId);
    if (!current || isNewerPsdTask(task, current)) {
      latestTaskByLayerId.set(layerId, task);
    }
  }

  const stateMap: Record<string, PsdLayerTaskState> = {};
  for (const layer of layers) {
    const latestTask = latestTaskByLayerId.get(layer.id);
    stateMap[layer.id] = latestTask
      ? getLayerStateFromTask(latestTask)
      : {
          layerId: layer.id,
          taskId: null,
          status: layer.visible ? 'planned' : 'skipped',
          resultUrls: [],
          error: null,
        };
  }

  return stateMap;
}

export function getRetryablePsdLayerIds(
  stateMap: Record<string, PsdLayerTaskState>
): string[] {
  return Object.values(stateMap)
    .filter(
      (state) => state.status === 'failed' || state.status === 'cancelled'
    )
    .map((state) => state.layerId);
}

export function getPsdLayerIdsNeedingGeneration(
  layers: PsdLayerPlan[],
  stateMap: Record<string, PsdLayerTaskState>
): string[] {
  return layers
    .filter((layer) => layer.visible && layer.type !== 'adjustment')
    .filter((layer) => {
      const state = stateMap[layer.id];
      return (
        !state ||
        state.status === 'planned' ||
        state.status === 'failed' ||
        state.status === 'cancelled' ||
        state.status === 'skipped'
      );
    })
    .map((layer) => layer.id);
}

export function getFailedPsdLayerEntries(
  tasks: Task[],
  layers: PsdLayerPlan[]
) {
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const latestTaskByLayerId = new Map<string, Task>();

  for (const task of tasks) {
    const layerId = getTaskLayerId(task);
    if (!layerId) continue;
    const current = latestTaskByLayerId.get(layerId);
    if (!current || isNewerPsdTask(task, current)) {
      latestTaskByLayerId.set(layerId, task);
    }
  }

  return Array.from(latestTaskByLayerId.values())
    .filter(
      (task) =>
        task.status === TaskStatus.FAILED ||
        task.status === TaskStatus.CANCELLED
    )
    .map((task) => {
      const layerId = getTaskLayerId(task);
      if (!layerId) return null;
      const layer = layerById.get(layerId);
      return {
        layerId,
        layerName: getTaskLayerName(task) || layer?.name || layerId,
        status: task.status,
        error: getTaskError(task),
        taskId: task.id,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}
