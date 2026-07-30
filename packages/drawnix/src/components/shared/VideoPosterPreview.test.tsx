import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPosterPreview } from './VideoPosterPreview';

const mocks = vi.hoisted(() => ({
  thumbnailUrl: vi.fn((src: string) => src),
}));

vi.mock('../../hooks/useThumbnailUrl', () => ({
  useThumbnailUrl: mocks.thumbnailUrl,
}));

vi.mock('tdesign-icons-react', () => ({
  PlayCircleIcon: () => <span />,
}));

class ProbeImage {
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  src = '';
}

describe('VideoPosterPreview fallback', () => {
  const probes: ProbeImage[] = [];

  beforeEach(() => {
    probes.length = 0;
    mocks.thumbnailUrl.mockImplementation((src: string) => src);
    vi.stubGlobal(
      'Image',
      class extends ProbeImage {
        constructor() {
          super();
          probes.push(this);
        }
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('automatically falls back to native video when the poster probe fails', () => {
    const videoUrl = 'https://cdn.example.com/video-without-cors.mp4';
    const view = render(
      <VideoPosterPreview
        src={videoUrl}
        activateVideoOnClick
        videoProps={{ controls: true, preload: 'metadata' }}
      />
    );

    expect(view.container.querySelector('video')).toBeNull();
    expect(probes).toHaveLength(1);

    act(() => {
      probes[0].onerror?.(new Event('error'));
    });

    const video = view.container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe(videoUrl);
    expect(video?.hasAttribute('controls')).toBe(true);
  });

  it('keeps a successful poster until the user activates it', () => {
    const videoUrl = 'https://cdn.example.com/video.mp4';
    const view = render(
      <VideoPosterPreview
        src={videoUrl}
        activateVideoOnClick
        videoProps={{ controls: true }}
      />
    );

    probes[0].naturalWidth = 640;
    probes[0].naturalHeight = 360;
    act(() => {
      probes[0].onload?.(new Event('load'));
    });

    const poster = view.container.querySelector('img');
    expect(poster).not.toBeNull();
    expect(view.container.querySelector('video')).toBeNull();
    if (!poster) throw new Error('poster was not rendered');

    fireEvent.click(poster);

    expect(view.container.querySelector('video')).not.toBeNull();
  });
});
