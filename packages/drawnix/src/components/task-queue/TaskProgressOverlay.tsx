/**
 * TaskProgressOverlay Component
 *
 * 任务进度覆盖层组件，在图片/视频/音频预览区域显示带比例的 loading 状态
 *
 * 进度设计：
 * - 视频/音频任务：显示真实的 API 返回进度（0-100%）
 * - 图片任务：只显示任务或供应商实际报告的进度
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TaskExecutionPhase,
  TaskType,
  TaskStatus,
} from '../../types/task.types';
import { getImageTaskProgressStatusText } from '../../utils/image-task-progress';
import { ImageGenerationProgressDisplay } from '../shared/ImageGenerationProgressDisplay';
import { useImageTaskProgress } from '../../hooks/useImageTaskProgress';
import './task-progress-overlay.scss';

interface TaskProgressOverlayProps {
  /** 任务类型 */
  taskType: TaskType;
  /** 任务状态 */
  taskStatus: TaskStatus;
  /** 视频任务的真实进度（0-100） */
  realProgress?: number;
  /** 已持久化的真实执行阶段（图片任务） */
  executionPhase?: TaskExecutionPhase;
  /** 媒体 URL（用于判断是否进入加载阶段） */
  mediaUrl?: string;
  /** 是否正在加载图片 */
  isImageLoading?: boolean;
  /** 图片加载完成回调 */
  onImageLoaded?: () => void;
  /** 图片加载失败回调 */
  onImageError?: () => void;
}

export const TaskProgressOverlay: React.FC<TaskProgressOverlayProps> = ({
  taskType,
  taskStatus,
  realProgress,
  executionPhase,
  mediaUrl,
  isImageLoading = false,
  onImageLoaded,
  onImageError,
}) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { displayProgress } = useImageTaskProgress({
    taskType,
    realProgress,
  });

  // 基准尺寸：内容在此尺寸下正常显示（环形 56px + 文字约 20px + 间距）
  const BASE_CONTENT_HEIGHT = 90;
  const BASE_CONTENT_WIDTH = 80;
  // 最小缩放比例
  const MIN_SCALE = 0.5;
  // 最大缩放比例
  const MAX_SCALE = 1.2;

  // 监听容器尺寸变化，计算缩放比例
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const calculateScale = () => {
      const { width, height } = container.getBoundingClientRect();
      // 预留底部进度条空间（3px）和上下边距
      const availableHeight = height - 10;
      const availableWidth = width - 20;

      // 根据高度和宽度计算缩放比例，取较小值
      const scaleByHeight = availableHeight / BASE_CONTENT_HEIGHT;
      const scaleByWidth = availableWidth / BASE_CONTENT_WIDTH;
      const newScale = Math.min(scaleByHeight, scaleByWidth, MAX_SCALE);

      setScale(Math.max(newScale, MIN_SCALE));
    };

    // 初始计算
    calculateScale();

    // 监听尺寸变化
    const resizeObserver = new ResizeObserver(calculateScale);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // 只在处理中状态显示
  if (taskStatus !== TaskStatus.PROCESSING) {
    return null;
  }

  const isDeterminate = displayProgress !== null;
  const progress = displayProgress ?? 0;
  const statusText =
    taskType === TaskType.IMAGE
      ? getImageTaskProgressStatusText(
          displayProgress,
          !!mediaUrl,
          isImageLoading,
          executionPhase
        )
      : taskType === TaskType.AUDIO
      ? progress < 10
        ? '提交任务...'
        : progress < 45
        ? '生成旋律...'
        : progress < 85
        ? '渲染音轨...'
        : '整理结果...'
      : progress < 10
      ? '准备中...'
      : progress < 50
      ? '生成中...'
      : progress < 90
      ? '渲染中...'
      : '即将完成...';

  // 构建类名
  const overlayClassName = [
    'task-progress-overlay',
    taskType === TaskType.VIDEO || taskType === TaskType.AUDIO
      ? 'task-progress-overlay--video'
      : '',
    mediaUrl && isImageLoading ? 'task-progress-overlay--loading' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className={overlayClassName}>
      {/* 背景层 */}
      <div className="task-progress-overlay__backdrop" />
      <div className="task-progress-overlay__pulse" />
      <div className="task-progress-overlay__dots" />

      {/* 进度内容（等比缩放） */}
      <div
        className="task-progress-overlay__content"
        style={{ transform: `scale(${scale})` }}
      >
        <ImageGenerationProgressDisplay
          progress={displayProgress}
          progressMode={isDeterminate ? 'determinate' : 'indeterminate'}
          statusText={statusText}
          tone={mediaUrl && isImageLoading ? 'loading' : 'default'}
          className="task-progress-overlay__progress"
        />
      </div>

      {/* 底部进度条 */}
      {isDeterminate && (
        <div className="task-progress-overlay__bar">
          <div
            className="task-progress-overlay__bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default TaskProgressOverlay;
