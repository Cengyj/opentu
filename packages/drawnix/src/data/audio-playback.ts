import type { CanvasAudioPlaybackSource } from '../services/canvas-audio-playback-service';
import { isAudioNodeElement } from '../types/audio-node.types';

interface LegacyAudioImageElement {
  id?: string;
  isAudio?: boolean;
  audioType?: string;
  audioUrl: string;
  audioTitle?: string;
  audioDuration?: number;
  previewImageUrl?: string;
  audioProviderTaskId?: string;
  audioClipId?: string;
  audioClipIds?: string[];
}

function isLegacyAudioImageElement(
  element: unknown
): element is LegacyAudioImageElement {
  if (typeof element !== 'object' || element === null) {
    return false;
  }

  const candidate = element as Partial<LegacyAudioImageElement>;
  return (
    candidate.isAudio === true ||
    candidate.audioType === 'music-card' ||
    (typeof candidate.audioUrl === 'string' && candidate.audioUrl.length > 0)
  );
}

export function isAudioElement(element: unknown): boolean {
  return isAudioNodeElement(element) || isLegacyAudioImageElement(element);
}

export function getAudioPlaybackSourceFromElement(
  element: unknown
): CanvasAudioPlaybackSource | null {
  if (isAudioNodeElement(element)) {
    return {
      elementId: element.id,
      audioUrl: element.audioUrl,
      title: element.title,
      duration: element.duration,
      previewImageUrl: element.previewImageUrl,
      clipId: element.clipId,
      providerTaskId: element.providerTaskId,
      clipIds: element.clipIds,
    };
  }

  if (isLegacyAudioImageElement(element)) {
    return {
      elementId: element.id,
      audioUrl: element.audioUrl,
      title: element.audioTitle,
      duration: element.audioDuration,
      previewImageUrl: element.previewImageUrl,
      clipId: element.audioClipId,
      providerTaskId: element.audioProviderTaskId,
      clipIds: element.audioClipIds,
    };
  }

  return null;
}

export function getCanvasAudioPlaybackQueue(
  elements: unknown[] | undefined | null
): CanvasAudioPlaybackSource[] {
  if (!Array.isArray(elements) || elements.length === 0) {
    return [];
  }

  return elements
    .map((element) => getAudioPlaybackSourceFromElement(element))
    .filter(
      (source): source is CanvasAudioPlaybackSource =>
        Boolean(source?.audioUrl)
    );
}
