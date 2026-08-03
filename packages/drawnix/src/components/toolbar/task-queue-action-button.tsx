import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from 'tdesign-react/es/badge';
import { useTaskQueue } from '../../hooks/useTaskQueue';
import type { Task } from '../../types/task.types';
import { ToolButton } from '../tool-button';
import { TaskIcon } from '../icons/startup-icons';

const FAILED_TASK_ACK_STORAGE_KEY = 'aitu-task-queue-failed-ack-at';

function readFailedTaskAckAt(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const value = Number(
      window.localStorage.getItem(FAILED_TASK_ACK_STORAGE_KEY)
    );
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeFailedTaskAckAt(value: number): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FAILED_TASK_ACK_STORAGE_KEY, String(value));
  }
}

function getTaskSignalAt(task: Task): number {
  return task.completedAt || task.updatedAt || task.createdAt || 0;
}

export interface TaskQueueActionButtonProps {
  taskPanelExpanded: boolean;
  onTaskPanelToggle: () => void;
}

export const TaskQueueActionButton: React.FC<TaskQueueActionButtonProps> = ({
  taskPanelExpanded,
  onTaskPanelToggle,
}) => {
  const { activeTasks, completedTasks, failedTasks } = useTaskQueue();
  const [acknowledgedFailedAt, setAcknowledgedFailedAt] =
    useState(readFailedTaskAckAt);

  const latestFailedAt = useMemo(
    () =>
      failedTasks.reduce(
        (latest, task) => Math.max(latest, getTaskSignalAt(task)),
        0
      ),
    [failedTasks]
  );
  const hasUnseenFailedTasks = latestFailedAt > acknowledgedFailedAt;

  useEffect(() => {
    if (!taskPanelExpanded || latestFailedAt <= acknowledgedFailedAt) {
      return;
    }

    setAcknowledgedFailedAt(latestFailedAt);
    try {
      writeFailedTaskAckAt(latestFailedAt);
    } catch {
      // Keep the acknowledgement in this page session when storage is blocked.
    }
  }, [acknowledgedFailedAt, latestFailedAt, taskPanelExpanded]);

  const totalTasks =
    activeTasks.length + completedTasks.length + failedTasks.length;
  const taskTooltip =
    totalTasks > 0
      ? `任务队列 (生成中: ${activeTasks.length}, 已完成: ${completedTasks.length}, 失败: ${failedTasks.length})`
      : '任务队列 (暂无任务)';

  return (
    <div className="bottom-actions-section__task-wrapper">
      <Badge
        count={activeTasks.length > 0 ? activeTasks.length : 0}
        showZero={false}
        offset={[6, -6]}
      >
        <ToolButton
          type="icon"
          icon={<TaskIcon />}
          aria-label="任务队列"
          tooltip={taskTooltip}
          tooltipPlacement="right"
          selected={taskPanelExpanded}
          visible={true}
          data-track="toolbar_click_tasks"
          data-testid="toolbar-tasks"
          onPointerDown={(event) => event.event.stopPropagation()}
          onClick={onTaskPanelToggle}
        />
      </Badge>

      {activeTasks.length > 0 && (
        <div className="bottom-actions-section__status bottom-actions-section__status--active" />
      )}
      {hasUnseenFailedTasks && activeTasks.length === 0 && (
        <div className="bottom-actions-section__status bottom-actions-section__status--failed" />
      )}
    </div>
  );
};
