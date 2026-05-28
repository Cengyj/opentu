// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PsdGenerationPlan } from '../ai-psd-plan';
import { PsdCanvasStage } from './PsdCanvasStage';

const SOURCE_URL = 'data:image/png;base64,c291cmNl';
const COMPOSITE_URL = 'data:image/png;base64,Y29tcG9zaXRl';
const LAYER_URL = 'data:image/png;base64,bGF5ZXI=';

function createPlan(): PsdGenerationPlan {
  return {
    planId: 'plan-visibility',
    title: 'Visibility plan',
    template: 'poster',
    strategy: 'ai-plan',
    textPolicy: {
      preferEditableText: true,
      avoidBakedText: true,
    },
    layers: [
      {
        id: 'psd-layer-1',
        name: 'Background',
        type: 'background',
        description: 'Background layer',
        generationPrompt: 'Extract the background',
        visible: true,
        opacity: 100,
        status: 'ready',
        bounds: { left: 0, top: 0, width: 100, height: 100 },
      },
    ],
    exportSkeleton: {
      target: 'psd',
      source: 'photoshop',
      status: 'planned',
      sourceSetting: 'photoshop',
      packaging: 'app-side-required',
      nativePsdReady: false,
      apiNativePsdOutput: false,
      downloadWhenSupported: true,
    },
    workflowSteps: [],
  };
}

function renderStage(
  props: Partial<React.ComponentProps<typeof PsdCanvasStage>> = {}
) {
  return render(
    <PsdCanvasStage
      uiLanguage="en"
      plan={createPlan()}
      sourceImages={[{ url: SOURCE_URL, name: 'source.png' }]}
      isEmptyWorkspace={false}
      isAnalyzingWorkspace={false}
      onCanvasSizeChange={vi.fn()}
      onSelectionChange={vi.fn()}
      {...props}
    />
  );
}

describe('PsdCanvasStage image visibility', () => {
  it('overlays clickable layer guides on the source preview during review while keeping the source image visible', () => {
    const { container } = renderStage();

    expect(screen.getByText('Source preview')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Uploaded source image' })
        .getAttribute('src')
    ).toBe(SOURCE_URL);
    expect(
      container.querySelectorAll('.psd-stage__layer-outline').length
    ).toBeGreaterThan(0);
  });

  it('keeps the original source and composite preview images visible as real artboard images', () => {
    const { container } = renderStage({ previewUrl: COMPOSITE_URL });

    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    expect(screen.getByText('Source preview')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Uploaded source image' })
        .getAttribute('src')
    ).toBe(SOURCE_URL);

    fireEvent.click(screen.getByRole('button', { name: 'Stack' }));
    expect(screen.getByText('PSD layered result preview')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'PSD layered result preview' })
        .getAttribute('src')
    ).toBe(COMPOSITE_URL);
    expect(container.querySelector('.psd-stage__stack')).toBeNull();
  });

  it('uses the generated layer stack only when layer result images are available', () => {
    const { container } = renderStage({
      layerPreviewUrls: { 'psd-layer-1': [LAYER_URL] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stack' }));

    expect(screen.getByText('Layer stack preview')).toBeTruthy();
    expect(container.querySelector('.psd-stage__stack')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Stacked layer: Background' })
        .getAttribute('src')
    ).toBe(LAYER_URL);
  });
});
