import { TaskExecutionPhase } from '../types/task.types';

const clampProgress = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
};

interface ResolveImageTaskDisplayProgressOptions {
  fallbackProgress?: number | null;
}

export function resolveImageTaskDisplayProgress(
  options: ResolveImageTaskDisplayProgressOptions
): number | null {
  const { fallbackProgress } = options;

  if (typeof fallbackProgress === 'number') {
    return clampProgress(fallbackProgress);
  }

  return null;
}

export function getImageTaskProgressStatusText(
  progress: number | null,
  hasMediaUrl = false,
  isImageLoading = false,
  executionPhase?: TaskExecutionPhase
): string {
  if (hasMediaUrl && isImageLoading) {
    return '加载图片...';
  }

  switch (executionPhase) {
    case TaskExecutionPhase.SUBMITTING:
      return '提交任务...';
    case TaskExecutionPhase.POLLING:
      return '等待供应商生成...';
    case TaskExecutionPhase.DOWNLOADING:
      return '下载并缓存图片...';
    default:
      break;
  }

  if (progress === null) {
    return '生成中...';
  }
  if (progress < 30) return '分析提示词...';
  if (progress < 60) return '生成中...';
  if (progress < 90) return '优化细节...';
  return '即将完成...';
}
