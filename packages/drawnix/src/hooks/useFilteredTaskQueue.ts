/**
 * useFilteredTaskQueue Hook
 * 
 * 用于弹窗中的任务列表，基于共享内存状态按类型过滤。
 * 当前活跃集合一次加载；分页返回字段为兼容现有组件保留。
 */

import { useCallback, useMemo } from 'react';
import { Task, TaskType } from '../types/task.types';
import { taskQueueService } from '../services/task-queue';
import { taskStorageReader } from '../services/task-storage-reader';
import { useSharedTaskState, ensureTaskStateSyncStarted, useTaskActions } from './useTaskQueue';

export interface UseFilteredTaskQueueOptions {
  /** 任务类型过滤 */
  taskType?: TaskType;
  /** 每页加载数量 */
  pageSize?: number;
}

export interface UseFilteredTaskQueueReturn {
  /** 已加载的任务列表 */
  tasks: Task[];
  /** 是否正在加载初始数据 */
  isLoading: boolean;
  /** 是否正在加载更多 */
  isLoadingMore: boolean;
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 总任务数 */
  totalCount: number;
  /** 已加载任务数 */
  loadedCount: number;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 重试任务 */
  retryTask: (taskId: string) => void;
  /** 删除任务 */
  deleteTask: (taskId: string) => void;
}

/**
 * 用于弹窗中按类型过滤的任务列表 hook
 */
export function useFilteredTaskQueue(
  options: UseFilteredTaskQueueOptions = {}
): UseFilteredTaskQueueReturn {
  const { taskType } = options;
  const { tasks: allTasks, isLoading } = useSharedTaskState();
  const { retryTask, deleteTask } = useTaskActions();

  const tasks = useMemo(() => {
    const filtered = taskType ? allTasks.filter((task) => task.type === taskType) : allTasks;
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  }, [allTasks, taskType]);

  const loadMore = useCallback(async () => undefined, []);

  const refresh = useCallback(async () => {
    ensureTaskStateSyncStarted();
    const isAvailable = await taskStorageReader.isAvailable();
    if (!isAvailable) {
      return;
    }
    const storedTasks = await taskStorageReader.getAllTasks();
    if (storedTasks.length > 0) {
      taskQueueService.restoreTasks(storedTasks);
    }
  }, []);

  return {
    tasks,
    isLoading,
    isLoadingMore: false,
    hasMore: false,
    totalCount: tasks.length,
    loadedCount: tasks.length,
    loadMore,
    refresh,
    retryTask,
    deleteTask,
  };
}
