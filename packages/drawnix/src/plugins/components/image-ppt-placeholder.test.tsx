// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageProps } from '@plait/common';
import { Image } from './image';

const { generatePPTImageFromPlaceholder } = vi.hoisted(() => ({
  generatePPTImageFromPlaceholder: vi.fn<() => Promise<void>>(),
}));

vi.mock('./ppt-image-placeholder-controller', () => ({
  generatePPTImageFromPlaceholder,
}));

afterEach(cleanup);

describe('PPT image placeholder UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not load generation before click and locks repeated clicks', async () => {
    let completeGeneration: (() => void) | undefined;
    generatePPTImageFromPlaceholder.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completeGeneration = resolve;
        })
    );
    const props = {
      board: { children: [] },
      element: {
        id: 'placeholder-1',
        type: 'image',
        frameId: 'frame-1',
        pptImagePlaceholder: true,
        pptImageStatus: 'placeholder',
        pptImagePrompt: 'slide art',
      },
      imageItem: { url: 'placeholder.gif', width: 1, height: 1 },
      isFocus: false,
    } as unknown as ImageProps;

    render(<Image {...props} />);
    expect(generatePPTImageFromPlaceholder).not.toHaveBeenCalled();

    const placeholder = screen.getByText('点击生成配图').parentElement;
    expect(placeholder).not.toBeNull();
    if (!placeholder) {
      throw new Error('PPT placeholder container was not rendered');
    }
    fireEvent.click(placeholder);
    fireEvent.click(placeholder);

    expect(generatePPTImageFromPlaceholder).toHaveBeenCalledTimes(1);
    expect(screen.getByText('生成配图中…')).toBeTruthy();

    completeGeneration?.();
    await waitFor(() => expect(screen.getByText('点击生成配图')).toBeTruthy());
  });
});
