import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBoard } from '@plait-board/react-board';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useI18n } from '../../i18n';
import { AI_VIDEO_GENERATION_PREVIEW_CACHE_KEY } from '../../constants/storage';
import type { UploadedVideoImage, VideoModel } from '../../types/video.types';
import { getSelectionKey } from '../../utils/model-selection';
import {
  processSelectedContentForAI,
  extractSelectedContent,
} from '../../utils/selection-utils';
import {
  createModelRef,
  geminiSettings,
  invocationPresetsSettings,
  resolveInvocationRoute,
  updateActiveInvocationRouteModel,
  type ModelRef,
} from '../../utils/settings-manager';
import { WinBoxWindow } from '../winbox';
import AIVideoGeneration from './ai-video-generation';
import type { ImageFile } from './shared/ImageUpload';

interface AIVideoDialogData {
  initialPrompt: string;
  initialImage?: ImageFile;
  initialImages?: UploadedVideoImage[];
  initialDuration?: number;
  initialModel?: VideoModel;
  initialSize?: string;
  initialResultUrl?: string;
}

export interface AIVideoDialogControllerProps {
  container: HTMLElement | null;
  onEnableRuntime?: () => void;
}

export default function AIVideoDialogController({
  container,
  onEnableRuntime,
}: AIVideoDialogControllerProps) {
  const { appState, closeDialog } = useDrawnix();
  const { language } = useI18n();
  const board = useBoard();
  const { isMobile } = useDeviceType();
  const videoDialogInitialData =
    appState.dialogInitialDataByType?.[DialogType.aiVideoGeneration] ?? null;

  const isProcessingRef = useRef(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const prevVideoDialogOpenRef = useRef(false);
  const prevVideoDialogInitialDataRef = useRef(videoDialogInitialData);

  const [selectedVideoModel, setSelectedVideoModel] = useState('');
  const [selectedVideoModelRef, setSelectedVideoModelRef] =
    useState<ModelRef | null>(null);
  const lastPersistedVideoSelectionRef = useRef<string | null>(null);

  const syncSelectedModelFromRoute = useCallback(() => {
    const videoRoute = resolveInvocationRoute('video');
    const nextVideoModel = videoRoute.modelId || 'veo3';
    const nextVideoModelRef = createModelRef(
      videoRoute.profileId,
      nextVideoModel
    );

    setSelectedVideoModel((current) =>
      current === nextVideoModel ? current : nextVideoModel
    );
    setSelectedVideoModelRef((current) =>
      getSelectionKey(nextVideoModel, current) ===
      getSelectionKey(nextVideoModel, nextVideoModelRef)
        ? current
        : nextVideoModelRef
    );
  }, []);

  useEffect(() => {
    syncSelectedModelFromRoute();
  }, [syncSelectedModelFromRoute]);

  useEffect(() => {
    geminiSettings.addListener(syncSelectedModelFromRoute);
    invocationPresetsSettings.addListener(syncSelectedModelFromRoute);

    return () => {
      geminiSettings.removeListener(syncSelectedModelFromRoute);
      invocationPresetsSettings.removeListener(syncSelectedModelFromRoute);
    };
  }, [syncSelectedModelFromRoute]);

  useEffect(() => {
    if (!selectedVideoModel) {
      return;
    }

    const selectionKey = getSelectionKey(
      selectedVideoModel,
      selectedVideoModelRef
    );
    if (lastPersistedVideoSelectionRef.current === selectionKey) {
      return;
    }
    lastPersistedVideoSelectionRef.current = selectionKey;

    void updateActiveInvocationRouteModel(
      'video',
      createModelRef(selectedVideoModelRef?.profileId, selectedVideoModel)
    );
  }, [selectedVideoModel, selectedVideoModelRef]);

  const [aiVideoData, setAiVideoData] = useState<AIVideoDialogData>({
    initialPrompt: '',
    initialImage: undefined,
  });

  useEffect(() => {
    if (!board) {
      return;
    }

    const isVideoDialogOpen = appState.openDialogTypes.has(
      DialogType.aiVideoGeneration
    );
    const isVideoDialogNewlyOpened =
      isVideoDialogOpen && !prevVideoDialogOpenRef.current;
    const videoDialogDataChanged =
      prevVideoDialogInitialDataRef.current !== videoDialogInitialData;

    prevVideoDialogOpenRef.current = isVideoDialogOpen;
    prevVideoDialogInitialDataRef.current = videoDialogInitialData;

    if (
      !isVideoDialogOpen ||
      (!isVideoDialogNewlyOpened && !videoDialogDataChanged) ||
      isProcessingRef.current
    ) {
      return;
    }

    const processVideoSelection = async () => {
      isProcessingRef.current = true;
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      processingTimeoutRef.current = setTimeout(() => {
        console.warn('Video processing timeout, resetting processing state');
        isProcessingRef.current = false;
      }, 10000);

      try {
        if (videoDialogInitialData) {
          setAiVideoData({
            initialPrompt:
              videoDialogInitialData.initialPrompt ||
              videoDialogInitialData.prompt ||
              '',
            initialImage:
              videoDialogInitialData.initialImage ||
              videoDialogInitialData.uploadedImage,
            initialImages:
              videoDialogInitialData.initialImages ||
              videoDialogInitialData.uploadedImages,
            initialDuration:
              videoDialogInitialData.initialDuration ||
              videoDialogInitialData.duration,
            initialModel:
              videoDialogInitialData.initialModel ||
              videoDialogInitialData.model,
            initialSize:
              videoDialogInitialData.initialSize || videoDialogInitialData.size,
            initialResultUrl:
              videoDialogInitialData.initialResultUrl ||
              videoDialogInitialData.resultUrl,
          });
          const resolvedVideoModel =
            videoDialogInitialData.initialModel || videoDialogInitialData.model;
          if (resolvedVideoModel) {
            setSelectedVideoModel(resolvedVideoModel);
          }
          if (videoDialogInitialData.initialModelRef !== undefined) {
            setSelectedVideoModelRef(videoDialogInitialData.initialModelRef);
          }
          return;
        }

        const selectedElementIds = appState.lastSelectedElementIds || [];
        const processedContent = await processSelectedContentForAI(
          board,
          selectedElementIds
        );
        const allImages: Array<{ url: string; name: string }> = [];

        if (processedContent.remainingImages.length > 0) {
          processedContent.remainingImages.forEach((image, index) => {
            allImages.push({
              url: image.url,
              name:
                image.name || `selected-image-${index + 1}-${Date.now()}.png`,
            });
          });
        } else if (processedContent.graphicsImage) {
          allImages.push({
            url: processedContent.graphicsImage,
            name: `graphics-combined-${Date.now()}.png`,
          });
        }

        setAiVideoData({
          initialPrompt: processedContent.remainingText || '',
          initialImage: allImages[0],
          initialImages: allImages.map((image, index) => ({
            slot: index,
            slotLabel: `参考图${index + 1}`,
            url: image.url,
            name: image.name,
          })),
        });
      } catch (error) {
        console.warn('Error processing selected content for AI video:', error);
        const selectedContent = extractSelectedContent(board);
        const fallbackImages = selectedContent.images.map((image, index) => ({
          url: image.url,
          name: image.name || `selected-image-${index + 1}-${Date.now()}.png`,
        }));

        setAiVideoData({
          initialPrompt: selectedContent.text || '',
          initialImage: fallbackImages[0],
          initialImages: fallbackImages.map((image, index) => ({
            slot: index,
            slotLabel: `参考图${index + 1}`,
            url: image.url,
            name: image.name,
          })),
        });
      } finally {
        isProcessingRef.current = false;
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
      }
    };

    void processVideoSelection();
  }, [
    appState.lastSelectedElementIds,
    appState.openDialogTypes,
    board,
    videoDialogInitialData,
  ]);

  useEffect(
    () => () => {
      isProcessingRef.current = false;
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    },
    []
  );

  const handleVideoDialogClose = useCallback(() => {
    try {
      const cached = localStorage.getItem(
        AI_VIDEO_GENERATION_PREVIEW_CACHE_KEY
      );
      if (cached) {
        const data = JSON.parse(cached);
        data.timestamp = Date.now();
        localStorage.setItem(
          AI_VIDEO_GENERATION_PREVIEW_CACHE_KEY,
          JSON.stringify(data)
        );
      }
    } catch (error) {
      console.warn('Failed to update cache timestamp:', error);
    }
    closeDialog(DialogType.aiVideoGeneration);
  }, [closeDialog]);

  return (
    <WinBoxWindow
      id="ai-video-dialog"
      visible={appState.openDialogTypes.has(DialogType.aiVideoGeneration)}
      title={language === 'zh' ? 'AI 视频生成' : 'AI Video Generation'}
      onClose={handleVideoDialogClose}
      width="70%"
      height="60%"
      minWidth={800}
      minHeight={600}
      x="center"
      y="center"
      modal={false}
      minimizable={false}
      className="winbox-ai-generation winbox-ai-video-generation"
      container={container}
      autoMaximize={isMobile}
    >
      <AIVideoGeneration
        key={videoDialogInitialData?.batchId || 'ai-video-dialog'}
        initialPrompt={aiVideoData.initialPrompt}
        initialImage={aiVideoData.initialImage}
        initialImages={aiVideoData.initialImages}
        initialKnowledgeContextRefs={
          videoDialogInitialData?.initialKnowledgeContextRefs ||
          videoDialogInitialData?.knowledgeContextRefs ||
          []
        }
        initialDuration={aiVideoData.initialDuration}
        initialModel={aiVideoData.initialModel}
        initialSize={aiVideoData.initialSize}
        initialResultUrl={aiVideoData.initialResultUrl}
        selectedModel={selectedVideoModel}
        selectedModelRef={selectedVideoModelRef}
        onModelChange={setSelectedVideoModel}
        onModelRefChange={setSelectedVideoModelRef}
        externalBatchId={videoDialogInitialData?.batchId}
        initialAutoInsertToCanvas={videoDialogInitialData?.autoInsertToCanvas}
        onDraftChange={videoDialogInitialData?.onDraftChange}
        onEnableRuntime={onEnableRuntime}
      />
    </WinBoxWindow>
  );
}
