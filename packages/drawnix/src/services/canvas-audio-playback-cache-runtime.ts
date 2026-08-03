import { getAudioCacheKeySeed } from '../data/audio-cache-key';
import { cacheRemoteUrl } from './media-executor/fallback-utils';
import type {
  CanvasAudioPlaybackSource,
  CanvasAudioUrlResolver,
} from './canvas-audio-playback-service';

export const resolveCanvasAudioPlaybackUrl: CanvasAudioUrlResolver = async (
  source: CanvasAudioPlaybackSource
): Promise<string> => {
  const { audioUrl } = source;

  try {
    const { getFileExtension } = await import('@aitu/utils');
    const ext = getFileExtension(audioUrl);
    const cacheKey = source.elementId?.startsWith('asset:')
      ? source.elementId
      : getAudioCacheKeySeed(audioUrl, {
          clipId: source.clipId,
          providerTaskId: source.providerTaskId,
        });

    return await cacheRemoteUrl(
      audioUrl,
      cacheKey,
      'audio',
      ext !== 'bin' ? ext : 'mp3',
      undefined,
      {
        source: source.elementId?.startsWith('asset:')
          ? 'PLAYBACK_CACHE'
          : 'AI_GENERATED',
      }
    );
  } catch (error) {
    console.warn(
      '[CanvasAudioPlayback] Failed to resolve local audio cache:',
      error
    );
    return audioUrl;
  }
};
