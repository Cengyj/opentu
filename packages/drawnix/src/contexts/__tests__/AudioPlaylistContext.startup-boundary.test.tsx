// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AudioPlaylistProvider,
  useAudioPlaylists,
} from '../AudioPlaylistContext';
import type { AudioPlaylistContextValue } from '../../types/audio-playlist.types';

const runtime = vi.hoisted(() => ({
  loaded: vi.fn(),
  initialize: vi.fn(async () => undefined),
  listPlaylists: vi.fn(async () => []),
  listPlaylistItems: vi.fn(async () => ({})),
  createPlaylist: vi.fn(),
  renamePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  addAssetToPlaylist: vi.fn(),
  addItemToPlaylist: vi.fn(),
  removeAssetFromPlaylist: vi.fn(),
  removeItemFromPlaylist: vi.fn(),
  removeAssetFromAllPlaylists: vi.fn(),
  toggleFavorite: vi.fn(),
}));

vi.mock('../../services/audio-playlist-service', () => {
  runtime.loaded();
  return {
    audioPlaylistService: runtime,
  };
});

vi.mock('../../utils/message-plugin', () => ({
  MessagePlugin: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderHarness(isStartupOperable: boolean) {
  let contextValue: AudioPlaylistContextValue | null = null;

  function Harness() {
    contextValue = useAudioPlaylists();
    return <div data-testid="playlist-consumer" />;
  }

  const createTree = (operable: boolean) => (
    <AudioPlaylistProvider isStartupOperable={operable}>
      <Harness />
    </AudioPlaylistProvider>
  );
  const rendered = render(createTree(isStartupOperable));

  return {
    ...rendered,
    setStartupOperable: (operable: boolean) =>
      rendered.rerender(createTree(operable)),
    getValue: () => {
      if (!contextValue) {
        throw new Error('Audio playlist context was not initialized');
      }
      return contextValue;
    },
  };
}

describe('AudioPlaylistContext startup boundary', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not load playlist storage before restored-workspace operability', async () => {
    const provider = renderHarness(false);

    await act(async () => Promise.resolve());
    expect(runtime.loaded).not.toHaveBeenCalled();
    expect(runtime.initialize).not.toHaveBeenCalled();

    act(() => provider.setStartupOperable(true));

    await waitFor(() => expect(runtime.initialize).toHaveBeenCalledTimes(1));
    expect(runtime.listPlaylists).toHaveBeenCalledTimes(1);
    expect(runtime.listPlaylistItems).toHaveBeenCalledTimes(1);
  });

  it('keeps explicit playlist access immediate while background hydration is gated', async () => {
    const provider = renderHarness(false);

    await act(async () => provider.getValue().loadPlaylists());

    expect(runtime.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.listPlaylists).toHaveBeenCalledTimes(1);
    expect(runtime.listPlaylistItems).toHaveBeenCalledTimes(1);
  });
});
