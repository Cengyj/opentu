import { describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';
import {
  generatePPTImageFromPlaceholder,
  type PPTImagePlaceholderRuntime,
} from './ppt-image-placeholder-controller';

function createBoard(): PlaitBoard {
  return {
    children: [
      {
        id: 'frame-1',
        type: 'frame',
        points: [
          [0, 0],
          [1920, 1080],
        ],
      },
    ],
  } as PlaitBoard;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createRuntime(
  events: string[],
  result: { success: boolean; data?: { url: string }; error?: string }
): PPTImagePlaceholderRuntime {
  return {
    setPPTImagePlaceholderStatus: vi.fn((_board, _frameId, status) => {
      events.push(`placeholder:${status}`);
    }),
    setFramePPTImageStatus: vi.fn((_board, _frameId, status) => {
      events.push(`frame:${status}`);
    }),
    generateImage: vi.fn(async () => {
      events.push('submit');
      return result;
    }),
    removePPTImagePlaceholder: vi.fn(() => {
      events.push('remove-placeholder');
    }),
    getImageRegion: vi.fn((rectangle) => {
      events.push('layout');
      return rectangle;
    }),
    insertMediaIntoFrame: vi.fn(async () => {
      events.push('insert');
      return undefined;
    }),
  } as unknown as PPTImagePlaceholderRuntime;
}

describe('PPT image placeholder generation controller', () => {
  it('loads once and preserves submit, insertion, and status order', async () => {
    const events: string[] = [];
    const runtime = createRuntime(events, {
      success: true,
      data: { url: 'https://example.com/generated.png' },
    });
    const loadRuntime = vi.fn(async () => {
      events.push('load-runtime');
      return runtime;
    });

    await generatePPTImageFromPlaceholder(
      { board: createBoard(), frameId: 'frame-1', prompt: 'slide art' },
      loadRuntime
    );

    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      'load-runtime',
      'placeholder:loading',
      'frame:loading',
      'submit',
      'remove-placeholder',
      'layout',
      'insert',
      'frame:generated',
    ]);
  });

  it('restores both statuses and keeps the provider error', async () => {
    const events: string[] = [];
    const runtime = createRuntime(events, {
      success: false,
      error: 'provider rejected',
    });

    await expect(
      generatePPTImageFromPlaceholder(
        { board: createBoard(), frameId: 'frame-1', prompt: 'slide art' },
        async () => runtime
      )
    ).rejects.toThrow('provider rejected');
    expect(events).toEqual([
      'placeholder:loading',
      'frame:loading',
      'submit',
      'placeholder:placeholder',
      'frame:placeholder',
    ]);
  });

  it('shares one generation attempt across remounts while the runtime is loading', async () => {
    const events: string[] = [];
    const board = createBoard();
    const runtime = createRuntime(events, {
      success: true,
      data: { url: 'https://example.com/generated.png' },
    });
    const deferredRuntime = createDeferred<PPTImagePlaceholderRuntime>();
    const loadRuntime = vi.fn(() => deferredRuntime.promise);
    const options = {
      board,
      frameId: 'frame-1',
      prompt: 'slide art',
    };

    const firstAttempt = generatePPTImageFromPlaceholder(options, loadRuntime);
    const remountedAttempt = generatePPTImageFromPlaceholder(
      options,
      loadRuntime
    );

    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.generateImage).not.toHaveBeenCalled();

    deferredRuntime.resolve(runtime);
    await Promise.all([firstAttempt, remountedAttempt]);

    expect(runtime.generateImage).toHaveBeenCalledTimes(1);
    expect(runtime.insertMediaIntoFrame).toHaveBeenCalledTimes(1);
  });
});
