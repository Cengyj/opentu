import type { ImageHistoryItem } from '../components/generation-history/generation-history';
import { type Task } from '../types/task.types';
import { getCompletedImageTaskResults } from '../utils/image-generation-anchor-batch';

export function buildImageGenerationHistory(
  completedTasks: readonly Task[]
): ImageHistoryItem[] {
  const recentTasks = [...completedTasks].sort(
    (left, right) =>
      (right.completedAt || right.createdAt) -
      (left.completedAt || left.createdAt)
  );

  return getCompletedImageTaskResults(recentTasks).map(
    ({ task, resultIndex, url, artifact }) => ({
      id: resultIndex === 0 ? task.id : `${task.id}::image:${resultIndex}`,
      type: 'image' as const,
      prompt: task.params.prompt,
      timestamp: task.completedAt || task.createdAt,
      imageUrl: url,
      width: artifact.width || task.result?.width || 1024,
      height: artifact.height || task.result?.height || 1024,
      uploadedImages: task.params.uploadedImages,
    })
  );
}
