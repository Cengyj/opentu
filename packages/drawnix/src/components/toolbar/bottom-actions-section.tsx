/**
 * BottomActionsSection Component
 *
 * 统一的底部工具区域,整合"打开项目"、"工具箱"和"任务队列"功能
 * 采用上下布局,视觉风格统一,使用标准的 ToolButton 组件
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ToolButton } from '../tool-button';
import { FeedbackButton } from '../feedback-button/feedback-button';
import {
  FolderIcon,
  ToolboxIcon,
  TaskIcon,
} from '../icons/startup-icons';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import './bottom-actions-section.scss';

type TaskQueueActionButtonComponent = React.ComponentType<{
  taskPanelExpanded: boolean;
  onTaskPanelToggle: () => void;
}>;

export type TaskQueueActionButtonLoader = () => Promise<{
  TaskQueueActionButton: TaskQueueActionButtonComponent;
}>;

const loadDefaultTaskQueueActionButton = createRetriableModuleLoader(
  () => import('./task-queue-action-button')
);

interface BottomActionButtonProps {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  track: string;
  testId: string;
  onClick: () => void;
}

const BottomActionButton: React.FC<BottomActionButtonProps> = ({
  icon,
  label,
  selected,
  track,
  testId,
  onClick,
}) => (
  <ToolButton
    type="icon"
    icon={icon}
    aria-label={label}
    tooltip={label}
    tooltipPlacement="right"
    selected={selected}
    visible={true}
    data-track={track}
    data-testid={testId}
    onPointerDown={(event) => event.event.stopPropagation()}
    onClick={onClick}
  />
);

export interface BottomActionsSectionProps {
  /** 项目抽屉是否打开 */
  projectDrawerOpen: boolean;
  /** 项目抽屉切换回调 */
  onProjectDrawerToggle: () => void;
  /** 工具箱抽屉是否打开 */
  toolboxDrawerOpen?: boolean;
  /** 工具箱抽屉切换回调 */
  onToolboxDrawerToggle?: () => void;
  /** 任务面板是否展开 */
  taskPanelExpanded: boolean;
  /** 任务面板切换回调 */
  onTaskPanelToggle: () => void;
  /** 延迟任务状态运行时的加载边界，默认指向生产任务按钮。 */
  taskQueueActionButtonLoader?: TaskQueueActionButtonLoader;
}

export const BottomActionsSection: React.FC<BottomActionsSectionProps> = ({
  projectDrawerOpen,
  onProjectDrawerToggle,
  toolboxDrawerOpen = false,
  onToolboxDrawerToggle,
  taskPanelExpanded,
  onTaskPanelToggle,
  taskQueueActionButtonLoader = loadDefaultTaskQueueActionButton,
}) => {
  const [LoadedTaskQueueActionButton, setLoadedTaskQueueActionButton] =
    useState<TaskQueueActionButtonComponent | null>(null);
  const mountedRef = useRef(false);
  const taskSummaryLoadingRef = useRef(false);

  const requestTaskSummary = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    if (LoadedTaskQueueActionButton || taskSummaryLoadingRef.current) {
      return;
    }

    taskSummaryLoadingRef.current = true;
    void taskQueueActionButtonLoader().then(
      (module) => {
        if (!mountedRef.current) {
          return;
        }

        setLoadedTaskQueueActionButton(() => module.TaskQueueActionButton);
      },
      () => {
        // Keep the light button interactive. A later click can retry a failed
        // chunk load without taking down the toolbar.
        taskSummaryLoadingRef.current = false;
      }
    );
  }, [LoadedTaskQueueActionButton, taskQueueActionButtonLoader]);

  useEffect(() => {
    mountedRef.current = true;
    if (taskPanelExpanded) {
      requestTaskSummary();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [requestTaskSummary, taskPanelExpanded]);

  const handleTaskPanelToggle = () => {
    requestTaskSummary();
    onTaskPanelToggle();
  };

  const taskButtonFallback = (
    <div className="bottom-actions-section__task-wrapper">
      <BottomActionButton
        icon={<TaskIcon />}
        label="任务队列"
        selected={taskPanelExpanded}
        track="toolbar_click_tasks"
        testId="toolbar-tasks"
        onClick={handleTaskPanelToggle}
      />
    </div>
  );

  return (
    <div className="bottom-actions-section">
      {/* 反馈按钮 */}
      <FeedbackButton />

      {/* 打开项目按钮 - 使用 ToolButton */}
      <BottomActionButton
        icon={<FolderIcon />}
        label={projectDrawerOpen ? '关闭项目' : '打开项目'}
        selected={projectDrawerOpen}
        track="toolbar_click_project_drawer"
        testId="toolbar-project"
        onClick={onProjectDrawerToggle}
      />

      {/* 工具箱按钮 */}
      {onToolboxDrawerToggle && (
        <BottomActionButton
          icon={<ToolboxIcon />}
          label={toolboxDrawerOpen ? '关闭工具箱' : '打开工具箱'}
          selected={toolboxDrawerOpen}
          track="toolbar_click_toolbox"
          testId="toolbar-toolbox"
          onClick={onToolboxDrawerToggle}
        />
      )}

      {LoadedTaskQueueActionButton ? (
        <LoadedTaskQueueActionButton
          taskPanelExpanded={taskPanelExpanded}
          onTaskPanelToggle={handleTaskPanelToggle}
        />
      ) : (
        taskButtonFallback
      )}
    </div>
  );
};
