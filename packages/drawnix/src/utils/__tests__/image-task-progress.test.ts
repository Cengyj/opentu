import { describe, expect, it } from 'vitest';
import { TaskExecutionPhase } from '../../types/task.types';
import {
  getImageTaskProgressStatusText,
  resolveImageTaskDisplayProgress,
} from '../image-task-progress';

describe('image-task-progress', () => {
  it('uses only factual task/provider progress', () => {
    const progress = resolveImageTaskDisplayProgress({
      fallbackProgress: 42,
    });

    expect(progress).toBe(42);
  });

  it('does not invent progress when no task/provider progress exists', () => {
    const progress = resolveImageTaskDisplayProgress({});

    expect(progress).toBeNull();
  });

  it('uses factual execution phases and a neutral indeterminate label', () => {
    expect(getImageTaskProgressStatusText(null)).toBe('生成中...');
    expect(
      getImageTaskProgressStatusText(
        null,
        false,
        false,
        TaskExecutionPhase.SUBMITTING
      )
    ).toBe('提交任务...');
    expect(
      getImageTaskProgressStatusText(
        null,
        false,
        false,
        TaskExecutionPhase.POLLING
      )
    ).toBe('等待供应商生成...');
    expect(
      getImageTaskProgressStatusText(
        null,
        false,
        false,
        TaskExecutionPhase.DOWNLOADING
      )
    ).toBe('下载并缓存图片...');
  });
});
