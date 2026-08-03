import { describe, expect, it } from 'vitest';
import {
  getAudioPlaybackSourceFromElement,
  getCanvasAudioPlaybackQueue,
  isAudioElement,
} from './audio-playback';

describe('audio playback projection', () => {
  it('normalizes current audio nodes without loading insertion services', () => {
    const element = {
      id: 'audio-node-1',
      type: 'audio',
      points: [
        [0, 0],
        [340, 128],
      ],
      audioUrl: '/audio/current.mp3',
      title: 'Current',
      createdAt: 1,
    };
    const source = getAudioPlaybackSourceFromElement(element);

    expect(source).toMatchObject({
      elementId: 'audio-node-1',
      audioUrl: '/audio/current.mp3',
      title: 'Current',
    });
    expect(isAudioElement(element)).toBe(true);
  });

  it('keeps legacy music cards and filters unrelated canvas elements', () => {
    const queue = getCanvasAudioPlaybackQueue([
      { id: 'shape-1', type: 'rectangle' },
      {
        id: 'legacy-audio-1',
        isAudio: true,
        audioType: 'music-card',
        audioUrl: '/audio/legacy.mp3',
        audioTitle: 'Legacy',
      },
    ]);

    expect(queue).toEqual([
      {
        elementId: 'legacy-audio-1',
        audioUrl: '/audio/legacy.mp3',
        title: 'Legacy',
      },
    ]);
  });
});
