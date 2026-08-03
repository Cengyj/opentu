import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getSelectedElements, RectangleClient } from '@plait/core';
import { useBoard } from '@plait-board/react-board';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useI18n } from '../../i18n';
import {
  AI_IMAGE_GENERATION_PREVIEW_CACHE_KEY,
  AI_IMAGE_MODE_CACHE_KEY,
} from '../../constants/storage';
import type { KnowledgeContextRef } from '../../types/task.types';
import { isFrameElement } from '../../types/frame.types';
import { matchFrameAspectRatio } from '../../utils/frame-size-matcher';
import { getSelectionKey } from '../../utils/model-selection';
import {
  processSelectedContentForAI,
  extractSelectedContent,
} from '../../utils/selection-utils';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import {
  createModelRef,
  geminiSettings,
  invocationPresetsSettings,
  resolveInvocationRoute,
  updateActiveInvocationRouteModel,
  type ModelRef,
} from '../../utils/settings-manager';
import { WinBoxWindow } from '../winbox';
import { RetriableDeferredFeature } from '../startup/RetriableDeferredFeature';
import AIImageGeneration from './ai-image-generation';
import type { ReferenceImage } from './shared/ReferenceImageUpload';

const loadBatchImageGeneration = createRetriableModuleLoader(
  () => import('./batch-image-generation')
);

type ImageGenerationMode = 'single' | 'batch';

interface AIImageDialogData {
  initialPrompt: string;
  initialImages: ReferenceImage[];
  selectedElementIds: string[];
  initialKnowledgeContextRefs?: KnowledgeContextRef[];
  initialResultUrl?: string;
  initialAspectRatio?: string;
  targetFrameId?: string;
  targetFrameDimensions?: { width: number; height: number };
  pptSlideImage?: boolean;
  pptSlidePrompt?: string;
  pptReplaceElementId?: string;
}

export interface AIImageDialogControllerProps {
  container: HTMLElement | null;
  onEnableRuntime?: () => void;
}

export default function AIImageDialogController({
  container,
  onEnableRuntime,
}: AIImageDialogControllerProps) {
  const { appState, closeDialog } = useDrawnix();
  const { language } = useI18n();
  const board = useBoard();
  const { isMobile, isTablet } = useDeviceType();
  const imageDialogInitialData =
    appState.dialogInitialDataByType?.[DialogType.aiImageGeneration] ?? null;
  const imageDialogSessionKey =
    imageDialogInitialData?.prefillId ||
    imageDialogInitialData?.batchId ||
    'ai-image-dialog';
  const [imageDialogManualModeKey, setImageDialogManualModeKey] = useState<
    string | null
  >(null);
  const showBatchTab = !isMobile && !isTablet;

  const isProcessingRef = useRef(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const maximizePulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const prevImageDialogOpenRef = useRef(false);
  const prevImageDialogInitialDataRef = useRef(imageDialogInitialData);

  const [selectedImageModel, setSelectedImageModel] = useState('');
  const [selectedImageModelRef, setSelectedImageModelRef] =
    useState<ModelRef | null>(null);
  const lastPersistedImageSelectionRef = useRef<string | null>(null);

  const syncSelectedModelFromRoute = useCallback(() => {
    const imageRoute = resolveInvocationRoute('image');
    const nextImageModel =
      imageRoute.modelId || 'gemini-3-pro-image-preview-vip';
    const nextImageModelRef = createModelRef(
      imageRoute.profileId,
      nextImageModel
    );

    setSelectedImageModel((current) =>
      current === nextImageModel ? current : nextImageModel
    );
    setSelectedImageModelRef((current) =>
      getSelectionKey(nextImageModel, current) ===
      getSelectionKey(nextImageModel, nextImageModelRef)
        ? current
        : nextImageModelRef
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
    if (!selectedImageModel) {
      return;
    }

    const selectionKey = getSelectionKey(
      selectedImageModel,
      selectedImageModelRef
    );
    if (lastPersistedImageSelectionRef.current === selectionKey) {
      return;
    }
    lastPersistedImageSelectionRef.current = selectionKey;

    void updateActiveInvocationRouteModel(
      'image',
      createModelRef(selectedImageModelRef?.profileId, selectedImageModel)
    );
  }, [selectedImageModel, selectedImageModelRef]);

  const [aiImageData, setAiImageData] = useState<AIImageDialogData>({
    initialPrompt: '',
    initialImages: [],
    selectedElementIds: [],
  });
  const resolvedAiImageData: AIImageDialogData = imageDialogInitialData
    ? {
        initialPrompt:
          imageDialogInitialData.initialPrompt ||
          imageDialogInitialData.prompt ||
          '',
        initialImages:
          imageDialogInitialData.initialImages ||
          imageDialogInitialData.uploadedImages ||
          [],
        selectedElementIds: [],
        initialKnowledgeContextRefs:
          imageDialogInitialData.initialKnowledgeContextRefs ||
          imageDialogInitialData.knowledgeContextRefs ||
          [],
        initialResultUrl:
          imageDialogInitialData.initialResultUrl ||
          imageDialogInitialData.resultUrl,
        initialAspectRatio: imageDialogInitialData.initialAspectRatio,
        targetFrameId: imageDialogInitialData.targetFrameId,
        targetFrameDimensions: imageDialogInitialData.targetFrameDimensions,
        pptSlideImage: imageDialogInitialData.pptSlideImage,
        pptSlidePrompt: imageDialogInitialData.pptSlidePrompt,
        pptReplaceElementId: imageDialogInitialData.pptReplaceElementId,
      }
    : aiImageData;

  const [imageDialogAutoMaximize, setImageDialogAutoMaximize] = useState(false);
  const [imageGenerationMode, setImageGenerationMode] =
    useState<ImageGenerationMode>(() => {
      try {
        return localStorage.getItem(AI_IMAGE_MODE_CACHE_KEY) === 'batch'
          ? 'batch'
          : 'single';
      } catch {
        return 'single';
      }
    });
  const shouldForceImageDialogSingleMode =
    !!imageDialogInitialData &&
    imageDialogManualModeKey !== imageDialogSessionKey;
  const imageDialogRenderMode: ImageGenerationMode =
    shouldForceImageDialogSingleMode ? 'single' : imageGenerationMode;

  const triggerAutoMaximize = useCallback(() => {
    setImageDialogAutoMaximize(true);
    if (maximizePulseTimeoutRef.current) {
      clearTimeout(maximizePulseTimeoutRef.current);
    }
    maximizePulseTimeoutRef.current = setTimeout(() => {
      setImageDialogAutoMaximize(false);
      maximizePulseTimeoutRef.current = null;
    }, 50);
  }, []);

  useEffect(() => {
    setImageDialogManualModeKey(null);
  }, [imageDialogInitialData]);

  useEffect(() => {
    if (!showBatchTab && imageGenerationMode === 'batch') {
      setImageGenerationMode('single');
    }
  }, [showBatchTab, imageGenerationMode]);

  const handleImageModeChange = useCallback(
    (mode: ImageGenerationMode) => {
      setImageDialogManualModeKey(imageDialogSessionKey);
      setImageGenerationMode(mode);
      if (mode === 'batch') {
        triggerAutoMaximize();
      }
      try {
        localStorage.setItem(AI_IMAGE_MODE_CACHE_KEY, mode);
      } catch (error) {
        console.warn('Failed to save image mode:', error);
      }
    },
    [imageDialogSessionKey, triggerAutoMaximize]
  );

  useEffect(() => {
    if (!appState.openDialogTypes.has(DialogType.aiImageGeneration)) {
      return;
    }

    const hasInitialContent =
      aiImageData.initialImages.length > 0 ||
      aiImageData.initialPrompt.trim() !== '';
    if (hasInitialContent) {
      setImageDialogAutoMaximize(false);
      return;
    }

    try {
      if (localStorage.getItem(AI_IMAGE_MODE_CACHE_KEY) === 'batch') {
        triggerAutoMaximize();
      }
    } catch {
      setImageDialogAutoMaximize(false);
    }
  }, [
    appState.openDialogTypes,
    aiImageData.initialImages,
    aiImageData.initialPrompt,
    triggerAutoMaximize,
  ]);

  useEffect(() => {
    if (!board) {
      return;
    }

    const isImageDialogOpen = appState.openDialogTypes.has(
      DialogType.aiImageGeneration
    );
    const isImageDialogNewlyOpened =
      isImageDialogOpen && !prevImageDialogOpenRef.current;
    const imageDialogDataChanged =
      prevImageDialogInitialDataRef.current !== imageDialogInitialData;

    prevImageDialogOpenRef.current = isImageDialogOpen;
    prevImageDialogInitialDataRef.current = imageDialogInitialData;

    if (
      !isImageDialogOpen ||
      (!isImageDialogNewlyOpened && !imageDialogDataChanged) ||
      isProcessingRef.current
    ) {
      return;
    }

    const processSelection = async () => {
      isProcessingRef.current = true;
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      processingTimeoutRef.current = setTimeout(() => {
        console.warn('Processing timeout, resetting processing state');
        isProcessingRef.current = false;
      }, 10000);

      try {
        if (imageDialogInitialData) {
          setAiImageData({
            initialPrompt:
              imageDialogInitialData.initialPrompt ||
              imageDialogInitialData.prompt ||
              '',
            initialImages:
              imageDialogInitialData.initialImages ||
              imageDialogInitialData.uploadedImages ||
              [],
            initialKnowledgeContextRefs:
              imageDialogInitialData.initialKnowledgeContextRefs ||
              imageDialogInitialData.knowledgeContextRefs ||
              [],
            selectedElementIds: [],
            initialResultUrl:
              imageDialogInitialData.initialResultUrl ||
              imageDialogInitialData.resultUrl,
            initialAspectRatio: imageDialogInitialData.initialAspectRatio,
            targetFrameId: imageDialogInitialData.targetFrameId,
            targetFrameDimensions: imageDialogInitialData.targetFrameDimensions,
            pptSlideImage: imageDialogInitialData.pptSlideImage,
            pptSlidePrompt: imageDialogInitialData.pptSlidePrompt,
            pptReplaceElementId: imageDialogInitialData.pptReplaceElementId,
          });
          if (imageDialogInitialData.initialModel) {
            setSelectedImageModel(imageDialogInitialData.initialModel);
          }
          if (imageDialogInitialData.initialModelRef !== undefined) {
            setSelectedImageModelRef(imageDialogInitialData.initialModelRef);
          }
          return;
        }

        const selectedElementIds = appState.lastSelectedElementIds || [];
        let frameAspectRatio: string | undefined;
        let detectedFrameId: string | undefined;
        let detectedFrameDimensions:
          | { width: number; height: number }
          | undefined;
        const selectedElements = getSelectedElements(board);
        if (
          selectedElements.length === 1 &&
          isFrameElement(selectedElements[0])
        ) {
          const frame = selectedElements[0];
          const rect = RectangleClient.getRectangleByPoints(frame.points);
          frameAspectRatio = matchFrameAspectRatio(rect.width, rect.height);
          detectedFrameId = frame.id;
          detectedFrameDimensions = {
            width: rect.width,
            height: rect.height,
          };
        }

        const processedContent = await processSelectedContentForAI(
          board,
          selectedElementIds
        );
        const imageItems: ReferenceImage[] =
          processedContent.remainingImages.map((image) => ({
            url: image.url,
            name: image.name || `selected-image-${Date.now()}.png`,
          }));

        if (processedContent.graphicsImage) {
          imageItems.push({
            url: processedContent.graphicsImage,
            name: `graphics-combined-${Date.now()}.png`,
          });
        }

        setAiImageData({
          initialPrompt: processedContent.remainingText || '',
          initialImages: imageItems,
          initialKnowledgeContextRefs: [],
          selectedElementIds,
          initialAspectRatio: frameAspectRatio,
          targetFrameId: detectedFrameId,
          targetFrameDimensions: detectedFrameDimensions,
        });
      } catch (error) {
        console.warn('Error processing selected content for AI:', error);
        const selectedContent = extractSelectedContent(board);
        setAiImageData({
          initialPrompt: selectedContent.text || '',
          initialImages: selectedContent.images.map((image) => ({
            url: image.url,
            name: image.name || `selected-image-${Date.now()}.png`,
          })),
          initialKnowledgeContextRefs: [],
          selectedElementIds: [],
        });
      } finally {
        isProcessingRef.current = false;
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
      }
    };

    void processSelection();
  }, [
    appState.lastSelectedElementIds,
    appState.openDialogTypes,
    board,
    imageDialogInitialData,
  ]);

  useEffect(
    () => () => {
      isProcessingRef.current = false;
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (maximizePulseTimeoutRef.current) {
        clearTimeout(maximizePulseTimeoutRef.current);
      }
    },
    []
  );

  const handleImageDialogClose = useCallback(() => {
    try {
      const cached = localStorage.getItem(
        AI_IMAGE_GENERATION_PREVIEW_CACHE_KEY
      );
      if (cached) {
        const data = JSON.parse(cached);
        data.timestamp = Date.now();
        localStorage.setItem(
          AI_IMAGE_GENERATION_PREVIEW_CACHE_KEY,
          JSON.stringify(data)
        );
      }
    } catch (error) {
      console.warn('Failed to update cache timestamp:', error);
    }
    closeDialog(DialogType.aiImageGeneration);
  }, [closeDialog]);

  return (
    <WinBoxWindow
      key={imageDialogSessionKey}
      id="ai-image-dialog"
      visible={appState.openDialogTypes.has(DialogType.aiImageGeneration)}
      title={
        imageDialogRenderMode === 'batch'
          ? language === 'zh'
            ? '批量出图'
            : 'Batch Generation'
          : language === 'zh'
          ? 'AI 图片生成'
          : 'AI Image Generation'
      }
      headerContent={
        showBatchTab ? (
          <div
            className="image-generation-mode-tabs"
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={`mode-tab ${
                imageDialogRenderMode === 'single' ? 'active' : ''
              }`}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                handleImageModeChange('single');
              }}
            >
              {language === 'zh' ? 'AI 图片生成' : 'AI Image'}
            </button>
            <button
              type="button"
              className={`mode-tab ${
                imageDialogRenderMode === 'batch' ? 'active' : ''
              }`}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                handleImageModeChange('batch');
              }}
            >
              {language === 'zh' ? '批量出图' : 'Batch'}
            </button>
          </div>
        ) : undefined
      }
      onClose={handleImageDialogClose}
      width="80%"
      height="60%"
      minWidth={800}
      minHeight={500}
      x="center"
      y="center"
      modal={false}
      minimizable={false}
      className="winbox-ai-generation winbox-ai-image-generation"
      container={container}
      autoMaximize={imageDialogAutoMaximize || isMobile}
    >
      {imageDialogRenderMode === 'batch' ? (
        <RetriableDeferredFeature
          loader={loadBatchImageGeneration}
          label={language === 'zh' ? '批量出图' : 'Batch generation'}
          variant="inline"
          renderFeature={({ default: BatchImageGeneration }) => (
            <BatchImageGeneration
              onSwitchToSingle={() => handleImageModeChange('single')}
              selectedModel={selectedImageModel}
              selectedModelRef={selectedImageModelRef}
              onModelChange={setSelectedImageModel}
              onModelRefChange={setSelectedImageModelRef}
              onEnableRuntime={onEnableRuntime}
            />
          )}
        />
      ) : (
        <AIImageGeneration
          key={imageDialogSessionKey}
          initialPrompt={resolvedAiImageData.initialPrompt}
          initialImages={resolvedAiImageData.initialImages}
          initialKnowledgeContextRefs={
            resolvedAiImageData.initialKnowledgeContextRefs || []
          }
          selectedElementIds={resolvedAiImageData.selectedElementIds}
          initialWidth={
            imageDialogInitialData?.initialWidth ||
            imageDialogInitialData?.width
          }
          initialHeight={
            imageDialogInitialData?.initialHeight ||
            imageDialogInitialData?.height
          }
          initialResultUrl={resolvedAiImageData.initialResultUrl}
          initialAspectRatio={resolvedAiImageData.initialAspectRatio}
          targetFrameId={resolvedAiImageData.targetFrameId}
          targetFrameDimensions={resolvedAiImageData.targetFrameDimensions}
          pptSlideImage={resolvedAiImageData.pptSlideImage}
          pptSlidePrompt={resolvedAiImageData.pptSlidePrompt}
          pptReplaceElementId={resolvedAiImageData.pptReplaceElementId}
          selectedModel={selectedImageModel}
          selectedModelRef={selectedImageModelRef}
          onModelChange={setSelectedImageModel}
          onModelRefChange={setSelectedImageModelRef}
          externalBatchId={imageDialogInitialData?.batchId}
          assetMetadata={imageDialogInitialData?.assetMetadata}
          initialAutoInsertToCanvas={imageDialogInitialData?.autoInsertToCanvas}
          onDraftChange={imageDialogInitialData?.onDraftChange}
          onEnableRuntime={onEnableRuntime}
        />
      )}
    </WinBoxWindow>
  );
}
