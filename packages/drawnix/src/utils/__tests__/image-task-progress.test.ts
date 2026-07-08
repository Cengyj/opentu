import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IMAGE_GENERATION_ESTIMATE_MS,
  IMAGE_GENERATION_MAX_PROGRESS,
  calculateSimulatedImageProgress,
  resolveImageTaskDisplayProgress,
} from '../image-task-progress';

describe('image-task-progress', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates simulated progress with ease-out curve', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T08:00:00.000Z'));

    const startedAt =
      Date.now() - Math.floor(IMAGE_GENERATION_ESTIMATE_MS * 0.5);
    const progress = calculateSimulatedImageProgress(startedAt);

    expect(progress).toBeGreaterThan(45);
    expect(progress).toBeLessThanOrEqual(IMAGE_GENERATION_MAX_PROGRESS);
  });

  it('prefers image loading tail progress when media is loading', () => {
    const progress = resolveImageTaskDisplayProgress({
      startedAt: Date.now() - 30_000,
      mediaUrl: 'https://example.com/image.png',
      isImageLoading: true,
      imageLoadProgress: 50,
    });

    expect(progress).toBe(95);
  });

  it('falls back to existing progress when no startedAt is available', () => {
    const progress = resolveImageTaskDisplayProgress({
      fallbackProgress: 37,
    });

    expect(progress).toBe(37);
  });
});
