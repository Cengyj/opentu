import {
  DEFAULT_TTS_SETTINGS,
  resolveVoice,
} from '../hooks/useTextToSpeech';
import { ttsSettings, type TtsSettings } from '../utils/settings-manager';
import type { CanvasReadingPlaybackRuntime } from './canvas-audio-playback-service';

export const canvasAudioReadingRuntime: CanvasReadingPlaybackRuntime = {
  getPlaybackRate: () => ttsSettings.get()?.rate,

  subscribePlaybackRate: (listener) => {
    const settingsListener = (settings: TtsSettings) => listener(settings?.rate);
    ttsSettings.addListener(settingsListener);

    return () => {
      ttsSettings.removeListener(settingsListener);
    };
  },

  updatePlaybackRate: (rate) => ttsSettings.update({ rate }),

  configureUtterance: (
    utterance,
    speechSynthesis,
    preferredLanguage,
    playbackRate
  ) => {
    const persistedSettings = ttsSettings.get();
    const settings = {
      ...DEFAULT_TTS_SETTINGS,
      ...(persistedSettings || {}),
      voicesByLanguage: persistedSettings?.voicesByLanguage || {},
      rate: playbackRate,
    };

    utterance.lang = preferredLanguage;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    const voice = resolveVoice(
      speechSynthesis.getVoices(),
      settings,
      preferredLanguage
    );
    if (voice) {
      utterance.voice = voice;
    }
  },
};
