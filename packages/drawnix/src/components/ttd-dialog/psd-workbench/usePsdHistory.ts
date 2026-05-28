import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Task } from '../../../types/task.types';
import {
  derivePsdHistoryStatus,
  psdHistoryService,
} from '../../../services/psd-history/psd-history-service';
import type {
  PsdHistoryEntry,
  PsdHistoryStatus,
} from '../../../services/psd-history/psd-history-types';
import { getTaskBatchId } from '../ai-psd-generation-workflow';
import { buildPsdLayerTaskStateMap } from './psd-layer-tasks';

export interface PsdHistoryListItem extends PsdHistoryEntry {
  liveStatus: PsdHistoryStatus;
  readyCount: number;
  totalLayers: number;
  thumbnailUrl?: string;
}

function getEntryTasks(entry: PsdHistoryEntry, tasks: Task[]): Task[] {
  if (tasks.length === 0) return [];
  const taskIdSet = new Set(entry.taskIds);
  return tasks.filter(
    (task) =>
      taskIdSet.has(task.id) ||
      (entry.psdBatchId !== null &&
        getTaskBatchId(task) === entry.psdBatchId)
  );
}

function pickThumbnail(
  entry: PsdHistoryEntry,
  liveResults: Record<string, string[]>
): string | undefined {
  const fromLive = Object.values(liveResults).find((urls) => urls.length > 0);
  if (fromLive?.[0]) return fromLive[0];
  const fromSnapshot = Object.values(entry.layerResults).find(
    (urls) => urls.length > 0
  );
  if (fromSnapshot?.[0]) return fromSnapshot[0];
  return entry.sourceImage?.url;
}

/**
 * PSD 历史列表：从 IndexedDB 读取快照，并用当前任务队列合并出实时状态/进度，
 * 使「进行中」会话的徽章准确。
 */
export function usePsdHistory(options: { open: boolean; tasks: Task[] }) {
  const { open, tasks } = options;
  const [entries, setEntries] = useState<PsdHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await psdHistoryService.listEntries());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const removeEntry = useCallback(async (id: string) => {
    await psdHistoryService.deleteEntry(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await psdHistoryService.clear();
    setEntries([]);
  }, []);

  const items = useMemo<PsdHistoryListItem[]>(() => {
    return entries.map((entry) => {
      const entryTasks = getEntryTasks(entry, tasks);
      const liveMap =
        entryTasks.length > 0
          ? buildPsdLayerTaskStateMap(entry.plan.layers, entryTasks)
          : {};
      const liveStates = Object.values(liveMap);
      const hasLiveTasks = liveStates.some(
        (state) => state.status !== 'planned' && state.status !== 'skipped'
      );
      const liveResults: Record<string, string[]> = {};
      for (const state of liveStates) {
        if (state.status === 'ready' && state.resultUrls.length > 0) {
          liveResults[state.layerId] = state.resultUrls;
        }
      }
      const liveStatus = hasLiveTasks
        ? derivePsdHistoryStatus(liveStates, true)
        : entry.status;
      const readyCount =
        Object.keys(liveResults).length > 0
          ? Object.keys(liveResults).length
          : Object.keys(entry.layerResults).length;
      return {
        ...entry,
        liveStatus,
        readyCount,
        totalLayers: entry.plan.layers.length,
        thumbnailUrl: pickThumbnail(entry, liveResults),
      };
    });
  }, [entries, tasks]);

  return { items, loading, reload, removeEntry, clearAll };
}
