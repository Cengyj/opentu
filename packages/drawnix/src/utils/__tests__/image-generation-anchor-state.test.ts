import { describe, expect, it } from 'vitest';
import { buildImageGenerationAnchorPresentationPatch } from '../image-generation-anchor-state';

describe('image-generation-anchor-state', () => {
  it('builds accepted and handoff patches with queued phase semantics', () => {
    expect(buildImageGenerationAnchorPresentationPatch('accepted')).toEqual({
      phase: 'queued',
      subtitle: '请求已受理，等待执行',
      progress: null,
      error: undefined,
    });

    expect(buildImageGenerationAnchorPresentationPatch('handoff')).toEqual({
      phase: 'queued',
      subtitle: '请求已受理，正在转入本地执行',
      progress: null,
      error: undefined,
    });
  });

  it('builds retrying, inserting, completed and failed patches with reset progress', () => {
    expect(buildImageGenerationAnchorPresentationPatch('retrying')).toEqual({
      phase: 'queued',
      subtitle: '正在重新触发，请稍候',
      progress: null,
      error: undefined,
    });

    expect(buildImageGenerationAnchorPresentationPatch('inserting')).toEqual({
      phase: 'inserting',
      subtitle: '正在放入画布',
      progress: null,
      error: undefined,
    });

    expect(buildImageGenerationAnchorPresentationPatch('completed')).toEqual({
      phase: 'completed',
      subtitle: '图片已稳定落位',
      progress: null,
      error: undefined,
    });

    expect(
      buildImageGenerationAnchorPresentationPatch('failed', {
        error: '创建图片任务失败',
      })
    ).toEqual({
      phase: 'failed',
      subtitle: '生成失败，请重试',
      progress: null,
      error: '创建图片任务失败',
    });
  });
});
