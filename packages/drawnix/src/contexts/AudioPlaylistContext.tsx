import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MessagePlugin } from '../utils/message-plugin';
import { createRetriableModuleLoader } from '../utils/retriable-module-loader';
import type {
  AudioPlaylist,
  AudioPlaylistContextValue,
  AudioPlaylistItem,
  AudioPlaylistItemRef,
} from '../types/audio-playlist.types';
import {
  AUDIO_PLAYLIST_FAVORITES_ID,
  getAudioPlaylistItemRef,
  isAudioPlaylistAssetItemRef,
} from '../types/audio-playlist.types';

type AudioPlaylistService =
  typeof import('../services/audio-playlist-service')['audioPlaylistService'];

const loadAudioPlaylistService = createRetriableModuleLoader(
  async (): Promise<AudioPlaylistService> => {
    const { audioPlaylistService } = await import(
      '../services/audio-playlist-service'
    );
    return audioPlaylistService;
  }
);

const AudioPlaylistContext = createContext<AudioPlaylistContextValue | null>(
  null
);

interface AudioPlaylistProviderProps {
  children: React.ReactNode;
  /** Automatically hydrate playlists only after workspace restoration. */
  isStartupOperable?: boolean;
}

export const AudioPlaylistProvider: React.FC<AudioPlaylistProviderProps> = ({
  children,
  isStartupOperable = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<AudioPlaylist[]>([]);
  const [playlistItems, setPlaylistItems] = useState<
    Record<string, AudioPlaylistItem[]>
  >({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getInitializedService = useCallback(async () => {
    const service = await loadAudioPlaylistService();
    await service.initialize();
    return service;
  }, []);

  const loadPlaylists = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
    }
    try {
      const audioPlaylistService = await getInitializedService();
      const [nextPlaylists, nextItems] = await Promise.all([
        audioPlaylistService.listPlaylists(),
        audioPlaylistService.listPlaylistItems(),
      ]);
      if (mountedRef.current) {
        setPlaylists(nextPlaylists);
        setPlaylistItems(nextItems);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [getInitializedService]);

  useEffect(() => {
    if (!isStartupOperable) {
      return;
    }
    void loadPlaylists();
  }, [isStartupOperable, loadPlaylists]);

  const runAndReload = useCallback(
    async (fn: () => Promise<void>, successMessage?: string) => {
      setLoading(true);
      try {
        await fn();
        await loadPlaylists();
        if (successMessage) {
          MessagePlugin.success(successMessage);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '操作失败';
        MessagePlugin.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [loadPlaylists]
  );

  const createPlaylist = useCallback(
    async (name: string) => {
      setLoading(true);
      try {
        const audioPlaylistService = await getInitializedService();
        const playlist = await audioPlaylistService.createPlaylist(name);
        await loadPlaylists();
        MessagePlugin.success('播放列表已创建');
        return playlist;
      } catch (error) {
        const message = error instanceof Error ? error.message : '创建失败';
        MessagePlugin.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [getInitializedService, loadPlaylists]
  );

  const renamePlaylist = useCallback(
    async (playlistId: string, name: string) =>
      runAndReload(async () => {
        const audioPlaylistService = await getInitializedService();
        await audioPlaylistService.renamePlaylist(playlistId, name);
      }, '播放列表已重命名'),
    [getInitializedService, runAndReload]
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) =>
      runAndReload(async () => {
        const audioPlaylistService = await getInitializedService();
        await audioPlaylistService.deletePlaylist(playlistId);
      }, '播放列表已删除'),
    [getInitializedService, runAndReload]
  );

  const addAssetToPlaylist = useCallback(
    async (assetId: string, playlistId: string) =>
      runAndReload(async () => {
        const audioPlaylistService = await getInitializedService();
        await audioPlaylistService.addAssetToPlaylist(assetId, playlistId);
      }, '已添加到播放列表'),
    [getInitializedService, runAndReload]
  );

  const addItemToPlaylist = useCallback(
    async (item: AudioPlaylistItemRef, playlistId: string) =>
      runAndReload(async () => {
        const audioPlaylistService = await getInitializedService();
        await audioPlaylistService.addItemToPlaylist(item, playlistId);
      }, '已添加到播放列表'),
    [getInitializedService, runAndReload]
  );

  const removeAssetFromPlaylist = useCallback(
    async (assetId: string, playlistId: string) =>
      runAndReload(async () => {
        const audioPlaylistService = await getInitializedService();
        await audioPlaylistService.removeAssetFromPlaylist(assetId, playlistId);
      }, '已从播放列表移除'),
    [getInitializedService, runAndReload]
  );

  const removeItemFromPlaylist = useCallback(
    async (item: AudioPlaylistItemRef, playlistId: string) =>
      runAndReload(async () => {
        const audioPlaylistService = await getInitializedService();
        await audioPlaylistService.removeItemFromPlaylist(item, playlistId);
      }, '已从播放列表移除'),
    [getInitializedService, runAndReload]
  );

  const removeAssetFromAllPlaylists = useCallback(
    async (assetId: string) => {
      try {
        const audioPlaylistService = await getInitializedService();
        await audioPlaylistService.removeAssetFromAllPlaylists(assetId);
        await loadPlaylists();
      } catch (error) {
        console.error(
          '[AudioPlaylistContext] Failed to cleanup asset from playlists:',
          error
        );
      }
    },
    [getInitializedService, loadPlaylists]
  );

  const toggleFavorite = useCallback(
    async (assetId: string) => {
      setLoading(true);
      try {
        const audioPlaylistService = await getInitializedService();
        const isFavorite = await audioPlaylistService.toggleFavorite(assetId);
        await loadPlaylists();
        MessagePlugin.success(isFavorite ? '已加入收藏' : '已取消收藏');
        return isFavorite;
      } catch (error) {
        const message = error instanceof Error ? error.message : '收藏操作失败';
        MessagePlugin.error(message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [getInitializedService, loadPlaylists]
  );

  const favoriteAssetIds = useMemo(
    () =>
      new Set(
        (playlistItems[AUDIO_PLAYLIST_FAVORITES_ID] || [])
          .map((item) => getAudioPlaylistItemRef(item))
          .filter(isAudioPlaylistAssetItemRef)
          .map((item) => item.assetId)
      ),
    [playlistItems]
  );

  const value = useMemo<AudioPlaylistContextValue>(
    () => ({
      loading,
      playlists,
      playlistItems,
      favoriteAssetIds,
      loadPlaylists,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addItemToPlaylist,
      removeItemFromPlaylist,
      addAssetToPlaylist,
      removeAssetFromPlaylist,
      removeAssetFromAllPlaylists,
      toggleFavorite,
      isFavorite: (assetId: string) => favoriteAssetIds.has(assetId),
      getPlaylistAssetIds: (playlistId: string) =>
        (playlistItems[playlistId] || [])
          .map((item) => getAudioPlaylistItemRef(item))
          .filter(isAudioPlaylistAssetItemRef)
          .map((item) => item.assetId),
      getPlaylistItemRefs: (playlistId: string) =>
        (playlistItems[playlistId] || [])
          .map((item) => getAudioPlaylistItemRef(item))
          .filter((item): item is AudioPlaylistItemRef => !!item),
    }),
    [
      loading,
      playlists,
      playlistItems,
      favoriteAssetIds,
      loadPlaylists,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addItemToPlaylist,
      removeItemFromPlaylist,
      addAssetToPlaylist,
      removeAssetFromPlaylist,
      removeAssetFromAllPlaylists,
      toggleFavorite,
    ]
  );

  return (
    <AudioPlaylistContext.Provider value={value}>
      {children}
    </AudioPlaylistContext.Provider>
  );
};

export function useAudioPlaylists(): AudioPlaylistContextValue {
  const context = useContext(AudioPlaylistContext);
  if (!context) {
    throw new Error(
      'useAudioPlaylists must be used within AudioPlaylistProvider'
    );
  }
  return context;
}
