import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './ttd-dialog.scss';
import './ai-image-generation.scss';
import './ai-psd-generation.scss';
import { MessagePlugin } from 'tdesign-react';
import { useI18n } from '../../i18n';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useGenerationHistory } from '../../hooks/useGenerationHistory';
import { useTaskQueue } from '../../hooks/useTaskQueue';
import { useSelectableModels } from '../../hooks/use-runtime-models';
import { ModelDropdown } from '../ai-input-bar/ModelDropdown';
import { ParametersDropdown } from '../ai-input-bar/ParametersDropdown';
import { KnowledgeNoteContextSelector } from '../shared';
import {
  ActionButtons,
  ErrorDisplay,
  PromptInput,
  ReferenceImageUpload,
  ResizableDivider,
  getMergedPresetPrompts,
  loadSavedWidth,
  savePromptToHistory as savePromptToHistoryUtil,
  type ReferenceImage,
} from './shared';
import type { Language } from '../../constants/prompts';
import { TaskType, type KnowledgeContextRef } from '../../types/task.types';
import type { ModelConfig } from '../../constants/model-config';
import type { GeminiSettings } from '../../utils/settings-manager';
import { getCompatibleParams } from '../../constants/model-config';
import {
  createModelRef,
  geminiSettings,
  resolveInvocationRoute,
  type ModelRef,
} from '../../utils/settings-manager';
import { promptStorageService } from '../../services/prompt-storage-service';
import { loadScopedAIImageToolPreferences } from '../../services/ai-generation-preferences-service';
import { getPinnedSelectableModel } from '../../utils/runtime-model-discovery';
import {
  findMatchingSelectableModel,
  getModelRefFromConfig,
  getSelectionKey,
} from '../../utils/model-selection';
import {
  LAYER_COUNT_OPTIONS,
  LAYER_TYPE_OPTIONS,
  STRATEGY_OPTIONS,
  TEMPLATE_OPTIONS,
  buildLayerPlan,
  buildPsdLayerImageTaskDrafts,
  getDefaultPsdLayerExtractionPrompt,
  getLayerTypeLabel,
  getStatusLabel,
  getTemplateLabel,
  type PsdLayerDraft,
  type PsdLayerStrategy,
  type PsdLayerType,
  type PsdPlanDraft,
  type PsdTemplate,
} from './ai-psd-draft';

interface AIImagePsdGenerationProps {
  initialPrompt?: string;
  initialImages?: ReferenceImage[];
  initialKnowledgeContextRefs?: KnowledgeContextRef[];
  selectedModel?: string;
  selectedModelRef?: ModelRef | null;
  onModelChange?: (value: string) => void;
  onModelRefChange?: (value: ModelRef | null) => void;
}

const EMPTY_REFERENCE_IMAGES: ReferenceImage[] = [];
const EMPTY_KNOWLEDGE_CONTEXT_REFS: KnowledgeContextRef[] = [];

export { buildLayerPlan };

const AIImagePsdGeneration = ({
  initialPrompt = '',
  initialImages = EMPTY_REFERENCE_IMAGES,
  initialKnowledgeContextRefs = EMPTY_KNOWLEDGE_CONTEXT_REFS,
  selectedModel,
  selectedModelRef,
  onModelChange,
  onModelRefChange,
}: AIImagePsdGenerationProps = {}) => {
  const { language } = useI18n();
  const uiLanguage = (language === 'zh' ? 'zh' : 'en') as 'zh' | 'en';
  const imageModels = useSelectableModels('image');
  const initialRoute = resolveInvocationRoute('image');
  const initialMatchedModel =
    findMatchingSelectableModel(
      imageModels,
      selectedModel || initialRoute.modelId,
      selectedModelRef ||
        createModelRef(initialRoute.profileId, initialRoute.modelId)
    ) ||
    getPinnedSelectableModel(
      'image',
      selectedModel || initialRoute.modelId,
      selectedModelRef ||
        createModelRef(initialRoute.profileId, initialRoute.modelId)
    );
  const initialModel =
    selectedModel ||
    initialMatchedModel?.id ||
    imageModels[0]?.id ||
    'gpt-image-2';
  const initialModelRef =
    selectedModelRef ||
    getModelRefFromConfig(initialMatchedModel) ||
    createModelRef(initialRoute.profileId, initialRoute.modelId);
  const defaultPsdPrompt = getDefaultPsdLayerExtractionPrompt(uiLanguage);

  const [currentModel, setCurrentModel] = useState(initialModel);
  const [currentModelRef, setCurrentModelRef] = useState<ModelRef | null>(
    initialModelRef
  );
  const [prompt, setPrompt] = useState(initialPrompt || defaultPsdPrompt);
  const [uploadedImages, setUploadedImages] =
    useState<ReferenceImage[]>(initialImages);
  const [knowledgeContextRefs, setKnowledgeContextRefs] = useState<
    KnowledgeContextRef[]
  >(initialKnowledgeContextRefs);
  const [template, setTemplate] = useState<PsdTemplate>('poster');
  const [strategy, setStrategy] = useState<PsdLayerStrategy>('ai-plan');
  const [layerCount, setLayerCount] = useState(8);
  const [draftTitle, setDraftTitle] = useState('');
  const [preferEditableText, setPreferEditableText] = useState(true);
  const [avoidBakedText, setAvoidBakedText] = useState(true);
  const [selectedParams, setSelectedParams] = useState<Record<string, string>>(
    () =>
      loadScopedAIImageToolPreferences(
        initialModel,
        getSelectionKey(initialModel, initialModelRef)
      ).extraParams
  );
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PsdPlanDraft | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isQueuingLayerTasks, setIsQueuingLayerTasks] = useState(false);
  const [promptHistoryVersion, setPromptHistoryVersion] = useState(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(() => loadSavedWidth('psd'));
  const [mobilePanel, setMobilePanel] = useState<'config' | 'preview'>(
    'config'
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewportWidth } = useDeviceType();
  const isCompactLayout = viewportWidth <= 768;
  const { imageHistory } = useGenerationHistory();
  const { createTask } = useTaskQueue();
  const draftMetrics = useMemo(() => {
    const layers = plan?.layers ?? [];
    const visibleLayers = layers.filter((layer) => layer.visible);
    const statusCounts = layers.reduce(
      (counts, layer) => ({
        ...counts,
        [layer.status]: counts[layer.status] + 1,
      }),
      {
        draft: 0,
        queued: 0,
        'export-pending': 0,
      } as Record<PsdLayerDraft['status'], number>
    );

    return {
      totalLayers: layers.length,
      visibleLayers: visibleLayers.length,
      hiddenLayers: layers.length - visibleLayers.length,
      draftLayers: statusCounts.draft,
      queuedLayers: statusCounts.queued,
      exportPendingLayers: statusCounts['export-pending'],
    };
  }, [plan]);

  const visibleImageModels = useMemo(() => {
    const currentMatch = findMatchingSelectableModel(
      imageModels,
      currentModel,
      currentModelRef
    );
    if (currentMatch || !currentModel) {
      return imageModels;
    }
    const pinned = getPinnedSelectableModel(
      'image',
      currentModel,
      currentModelRef
    );
    return pinned ? [pinned, ...imageModels] : imageModels;
  }, [currentModel, currentModelRef, imageModels]);

  const hasCompatibleParams = useMemo(
    () => getCompatibleParams(currentModel).length > 0,
    [currentModel]
  );

  const presetPrompts = useMemo(() => {
    // promptHistoryVersion intentionally invalidates cached prompt presets after
    // prompt storage changes even though the merged preset builder reads history.
    void promptHistoryVersion;
    return getMergedPresetPrompts('image', language as Language, imageHistory);
  }, [imageHistory, language, promptHistoryVersion]);

  const planLayerStats = useMemo(() => {
    const layers = plan?.layers ?? [];
    const visibleLayers = layers.filter((layer) => layer.visible);
    const hiddenLayers = layers.length - visibleLayers.length;
    const queuedLayers = layers.filter((layer) => layer.status === 'queued');
    const textLayers = layers.filter((layer) => layer.type === 'text');

    return {
      visibleCount: visibleLayers.length,
      hiddenCount: hiddenLayers,
      queuedCount: queuedLayers.length,
      textCount: textLayers.length,
    };
  }, [plan]);

  useEffect(() => {
    return promptStorageService.subscribeChanges(() => {
      setPromptHistoryVersion((version) => version + 1);
    });
  }, []);

  useEffect(() => {
    setPrompt(initialPrompt || defaultPsdPrompt);
    setUploadedImages(initialImages || []);
    setKnowledgeContextRefs(initialKnowledgeContextRefs || []);
  }, [
    defaultPsdPrompt,
    initialPrompt,
    initialImages,
    initialKnowledgeContextRefs,
  ]);

  useEffect(() => {
    if (!selectedModel) return;
    const nextKey = getSelectionKey(selectedModel, selectedModelRef);
    const currentKey = getSelectionKey(currentModel, currentModelRef);
    if (nextKey === currentKey) return;

    setCurrentModel(selectedModel);
    const matched = findMatchingSelectableModel(
      visibleImageModels,
      selectedModel,
      selectedModelRef
    );
    setCurrentModelRef(
      getModelRefFromConfig(matched) || selectedModelRef || null
    );
  }, [
    currentModel,
    currentModelRef,
    selectedModel,
    selectedModelRef,
    visibleImageModels,
  ]);

  useEffect(() => {
    const handleSettingsChange = (newSettings: GeminiSettings) => {
      const nextModel = newSettings.imageModelName || visibleImageModels[0]?.id;
      if (nextModel && nextModel !== currentModel) {
        setCurrentModel(nextModel);
        const matched = findMatchingSelectableModel(
          visibleImageModels,
          nextModel,
          currentModelRef
        );
        setCurrentModelRef(getModelRefFromConfig(matched) || null);
      }
    };
    geminiSettings.addListener(handleSettingsChange);
    return () => geminiSettings.removeListener(handleSettingsChange);
  }, [currentModel, currentModelRef, visibleImageModels]);

  const handleParamChange = useCallback((paramId: string, value: string) => {
    setSelectedParams((prev) => {
      if (!value || value === 'default') {
        const next = { ...prev };
        delete next[paramId];
        return next;
      }
      return { ...prev, [paramId]: value };
    });
  }, []);

  const handleReset = useCallback(() => {
    setPrompt(defaultPsdPrompt);
    setUploadedImages([]);
    setKnowledgeContextRefs([]);
    setTemplate('poster');
    setStrategy('ai-plan');
    setLayerCount(8);
    setDraftTitle('');
    setPreferEditableText(true);
    setAvoidBakedText(true);
    setSelectedParams({});
    setPlan(null);
    setError(null);
    setMobilePanel('config');
  }, [defaultPsdPrompt]);

  const handleGeneratePlan = useCallback(
    (showSuccess = true) => {
      if (!prompt.trim()) {
        setError(
          uiLanguage === 'zh'
            ? '请输入 PSD 文件生成需求'
            : 'Please enter what the PSD file should look like'
        );
        return null;
      }

      const nextPlan = buildLayerPlan(
        prompt,
        template,
        strategy,
        layerCount,
        uiLanguage,
        {
          preferEditableText,
          avoidBakedText,
        }
      );
      const resolvedTitle = draftTitle.trim() || nextPlan.title;
      const titledPlan = { ...nextPlan, title: resolvedTitle };
      setDraftTitle(resolvedTitle);
      setPlan(titledPlan);
      setError(null);
      setMobilePanel('preview');
      setIsPreviewVisible(true);
      savePromptToHistoryUtil('image', prompt.trim(), {
        width: 1024,
        height: 1024,
      });
      setPromptHistoryVersion((version) => version + 1);
      if (showSuccess) {
        void MessagePlugin.success(
          uiLanguage === 'zh'
            ? '已准备 PSD 文件生成方案'
            : 'PSD file generation setup prepared'
        );
      }
      return titledPlan;
    },
    [
      avoidBakedText,
      draftTitle,
      layerCount,
      preferEditableText,
      prompt,
      strategy,
      template,
      uiLanguage,
    ]
  );

  const handleToggleLayer = useCallback((layerId: string) => {
    setPlan((current) =>
      current
        ? {
            ...current,
            layers: current.layers.map((layer) =>
              layer.id === layerId
                ? { ...layer, visible: !layer.visible }
                : layer
            ),
          }
        : current
    );
  }, []);

  const handlePlanTitleChange = useCallback((value: string) => {
    setDraftTitle(value);
    setPlan((current) => (current ? { ...current, title: value } : current));
  }, []);

  const handleLayerChange = useCallback(
    <K extends keyof PsdLayerDraft>(
      layerId: string,
      field: K,
      value: PsdLayerDraft[K]
    ) => {
      setPlan((current) =>
        current
          ? {
              ...current,
              layers: current.layers.map((layer) =>
                layer.id === layerId ? { ...layer, [field]: value } : layer
              ),
            }
          : current
      );
    },
    []
  );

  const handleAddLayer = useCallback(() => {
    setPlan((current) => {
      if (!current) return current;
      const nextIndex = current.layers.length + 1;
      const name =
        uiLanguage === 'zh' ? `新图层 ${nextIndex}` : `New layer ${nextIndex}`;
      const description =
        uiLanguage === 'zh'
          ? '描述这个图层的视觉内容、位置和后续生成要求。'
          : 'Describe this layer’s visual content, placement, and generation needs.';
      return {
        ...current,
        layers: [
          ...current.layers,
          {
            id: `psd-layer-${Date.now()}`,
            name,
            type: 'image',
            description,
            generationPrompt: description,
            visible: true,
            opacity: 100,
            status: 'draft',
          },
        ],
      };
    });
  }, [uiLanguage]);

  const handleDuplicateLayer = useCallback((layerId: string) => {
    setPlan((current) => {
      if (!current) return current;
      const source = current.layers.find((layer) => layer.id === layerId);
      if (!source) return current;
      const sourceIndex = current.layers.findIndex(
        (layer) => layer.id === layerId
      );
      const copy: PsdLayerDraft = {
        ...source,
        id: `psd-layer-${Date.now()}`,
        name: `${source.name} copy`,
        locked: false,
        status: 'draft',
      };
      return {
        ...current,
        layers: [
          ...current.layers.slice(0, sourceIndex + 1),
          copy,
          ...current.layers.slice(sourceIndex + 1),
        ],
      };
    });
  }, []);

  const handleRemoveLayer = useCallback((layerId: string) => {
    setPlan((current) =>
      current
        ? {
            ...current,
            layers: current.layers.filter((layer) => layer.id !== layerId),
          }
        : current
    );
  }, []);

  const handleMoveLayer = useCallback((layerId: string, direction: -1 | 1) => {
    setPlan((current) => {
      if (!current) return current;
      const index = current.layers.findIndex((layer) => layer.id === layerId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.layers.length) {
        return current;
      }
      const layers = [...current.layers];
      const [layer] = layers.splice(index, 1);
      layers.splice(nextIndex, 0, layer);
      return { ...current, layers };
    });
  }, []);

  const convertUploadedImagesToSerializable = useCallback(async () => {
    return Promise.all(
      uploadedImages.map(async (image) => {
        const file = image.file;
        if (file) {
          return new Promise<ReferenceImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                url: reader.result as string,
                name: image.name,
                maskImage: image.maskImage,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        return {
          url: image.url,
          name: image.name,
          maskImage: image.maskImage,
        };
      })
    );
  }, [uploadedImages]);

  const handleGenerateLayerAssets = useCallback(
    async (planOverride?: PsdPlanDraft) => {
      const targetPlan = planOverride || plan;
      if (!targetPlan || isQueuingLayerTasks) return;

      if (uploadedImages.length === 0) {
        setError(
          uiLanguage === 'zh'
            ? '请先上传原始海报或参考图，再生成 PSD 文件。'
            : 'Upload the source poster or reference image before generating the PSD file.'
        );
        setMobilePanel('config');
        return;
      }

      setIsQueuingLayerTasks(true);
      try {
        const serializableImages = await convertUploadedImagesToSerializable();
        const layerTaskDrafts = buildPsdLayerImageTaskDrafts(targetPlan, {
          model: currentModel,
          modelRef: currentModelRef,
          uploadedImages: serializableImages,
          knowledgeContextRefs,
          size: selectedParams.size || '1024x1024',
          width: 1024,
          height: 1024,
          extraParams: selectedParams,
        });
        const createdLayerIds = new Set<string>();

        for (const draft of layerTaskDrafts) {
          const task = createTask(draft.params, TaskType.IMAGE);
          if (task) {
            createdLayerIds.add(draft.layerId);
          }
        }

        setPlan((current) => {
          const basePlan = current || targetPlan;
          return {
            ...basePlan,
            layers: basePlan.layers.map((layer) => ({
              ...layer,
              status: createdLayerIds.has(layer.id)
                ? 'queued'
                : 'export-pending',
            })),
          };
        });
        setError(null);

        if (createdLayerIds.size > 0) {
          void MessagePlugin.success(
            uiLanguage === 'zh'
              ? `已开始生成 PSD 文件素材（${createdLayerIds.size} 个透明图层任务）`
              : `Started PSD file asset generation (${createdLayerIds.size} transparent layer tasks)`
          );
        } else {
          setError(
            uiLanguage === 'zh'
              ? 'PSD 素材准备失败，请检查输入后重试。'
              : 'Failed to prepare PSD assets. Check the input and try again.'
          );
        }
      } catch (err) {
        console.error('Failed to create PSD layer tasks:', err);
        setError(
          uiLanguage === 'zh'
            ? 'PSD 素材准备失败，请检查参考图后重试。'
            : 'Failed to prepare PSD assets. Check the reference image and try again.'
        );
      } finally {
        setIsQueuingLayerTasks(false);
      }
    },
    [
      convertUploadedImagesToSerializable,
      createTask,
      currentModel,
      currentModelRef,
      isQueuingLayerTasks,
      knowledgeContextRefs,
      plan,
      selectedParams,
      uiLanguage,
      uploadedImages.length,
    ]
  );

  const handlePrimaryAction = useCallback(() => {
    if (uploadedImages.length === 0) {
      setError(
        uiLanguage === 'zh'
          ? '请先上传原始海报/参考图，然后生成 PSD 文件。'
          : 'Upload a source poster/reference image before generating the PSD file.'
      );
      setMobilePanel('config');
      return;
    }

    const targetPlan = plan || handleGeneratePlan(false);
    if (!targetPlan) return;
    void handleGenerateLayerAssets(targetPlan);
  }, [
    handleGenerateLayerAssets,
    handleGeneratePlan,
    plan,
    uiLanguage,
    uploadedImages.length,
  ]);

  const handleExportSkeleton = useCallback(() => {
    if (!plan) return;
    setPlan((current) =>
      current
        ? {
            ...current,
            layers: current.layers.map((layer) => ({
              ...layer,
              status:
                layer.status === 'queued' ? 'export-pending' : layer.status,
            })),
          }
        : current
    );
    void MessagePlugin.success(
      uiLanguage === 'zh'
        ? '已准备 PSD 文件导出；真实 PSD 打包由后续流程接入。'
        : 'PSD file export prepared; real PSD packaging connects in a later flow.'
    );
  }, [plan, uiLanguage]);

  const handleModelSelect = useCallback(
    (value: string) => {
      setCurrentModel(value);
      setCurrentModelRef(null);
      onModelChange?.(value);
      onModelRefChange?.(null);
    },
    [onModelChange, onModelRefChange]
  );

  const handleSelectModel = useCallback(
    (model: ModelConfig) => {
      const nextRef = getModelRefFromConfig(model);
      setCurrentModel(model.id);
      setCurrentModelRef(nextRef);
      onModelChange?.(model.id);
      onModelRefChange?.(nextRef);
    },
    [onModelChange, onModelRefChange]
  );

  return (
    <div className="ai-psd-generation-container ai-image-generation-container">
      {isCompactLayout ? (
        <div className="ai-generation-mobile-switcher" role="tablist">
          <button
            type="button"
            className={`ai-generation-mobile-switcher__tab ${
              mobilePanel === 'config'
                ? 'ai-generation-mobile-switcher__tab--active'
                : ''
            }`}
            aria-pressed={mobilePanel === 'config'}
            onClick={() => setMobilePanel('config')}
          >
            {uiLanguage === 'zh' ? '生成配置' : 'Setup'}
            <span className="ai-generation-mobile-switcher__count">
              {uiLanguage === 'zh' ? '配置' : 'Config'}
            </span>
          </button>
          <button
            type="button"
            className={`ai-generation-mobile-switcher__tab ${
              mobilePanel === 'preview'
                ? 'ai-generation-mobile-switcher__tab--active'
                : ''
            }`}
            aria-pressed={mobilePanel === 'preview'}
            onClick={() => setMobilePanel('preview')}
          >
            {uiLanguage === 'zh' ? 'PSD 预览' : 'PSD Preview'}
            <span className="ai-generation-mobile-switcher__count">
              {draftMetrics.totalLayers || '—'}
            </span>
          </button>
        </div>
      ) : null}

      <div
        className={`main-content ${
          isCompactLayout ? 'main-content--mobile-panels' : ''
        }`}
        ref={containerRef}
      >
        <div
          className={`ai-image-generation-section ai-psd-generation-section ${
            isCompactLayout && mobilePanel !== 'config'
              ? 'ai-generation-mobile-panel--hidden'
              : ''
          }`}
        >
          <div className="ai-image-generation-form ai-psd-generation-form">
            {selectedModel !== undefined && onModelChange && (
              <div className="form-header-row">
                <div className="model-selector-wrapper">
                  <ModelDropdown
                    selectedModel={currentModel}
                    selectedSelectionKey={getSelectionKey(
                      currentModel,
                      currentModelRef
                    )}
                    onSelect={handleModelSelect}
                    onSelectModel={handleSelectModel}
                    language={language}
                    models={visibleImageModels}
                    placement="down"
                    variant="form"
                    disabled={false}
                  />
                </div>
              </div>
            )}

            <section className="psd-draft-hero" aria-label="PSD draft editor">
              <div>
                <span className="psd-draft-hero__eyebrow">
                  {uiLanguage === 'zh'
                    ? 'PSD 文件生成 · Beta'
                    : 'PSD File Generator · Beta'}
                </span>
                <h2>
                  {uiLanguage === 'zh'
                    ? '上传参考图，输入需求，一键生成 PSD 文件'
                    : 'Upload references, enter one prompt, generate a PSD file'}
                </h2>
                <p>
                  {uiLanguage === 'zh'
                    ? '普通用户只需要提供源图/参考图和一句需求；高级拆分细节已自动处理。'
                    : 'Most users only need source/reference images and one prompt; advanced decomposition details are handled automatically.'}
                </p>
              </div>
              <ol className="psd-draft-steps" aria-label="PSD workflow steps">
                <li>{uiLanguage === 'zh' ? '参考图' : 'References'}</li>
                <li>{uiLanguage === 'zh' ? '需求' : 'Prompt'}</li>
                <li>{uiLanguage === 'zh' ? 'PSD 文件' : 'PSD file'}</li>
              </ol>
            </section>

            <div className="psd-api-note" role="note">
              <strong>
                {uiLanguage === 'zh' ? '当前能力说明：' : 'Current capability: '}
              </strong>
              {uiLanguage === 'zh'
                ? '图片 API 暂不直接返回原生 PSD。Opentu 当前会先准备同画布、原坐标、透明背景的分层图片素材；PSD 打包流程接入后再输出文件。'
                : 'Image APIs do not directly return native PSD files yet. Opentu currently prepares same-canvas, original-coordinate, transparent-background layer images; PSD packaging will output the file once wired.'}
            </div>

            <ReferenceImageUpload
              images={uploadedImages}
              onImagesChange={setUploadedImages}
              language={language}
              disabled={isQueuingLayerTasks}
              multiple={true}
              label={
                uiLanguage === 'zh'
                  ? '原始海报 / 参考图'
                  : 'Source poster / reference image'
              }
              onError={setError}
            />

            <PromptInput
              prompt={prompt}
              onPromptChange={setPrompt}
              presetPrompts={presetPrompts}
              language={language}
              type="image"
              disabled={isQueuingLayerTasks}
              onError={setError}
              label={
                uiLanguage === 'zh' ? 'PSD 文件需求' : 'PSD file prompt'
              }
              placeholder={defaultPsdPrompt}
            />

            <div className="psd-prompt-tip" role="note">
              <strong>
                {uiLanguage === 'zh' ? '使用方式：' : 'How to use: '}
              </strong>
              {uiLanguage === 'zh'
                ? '上传源图/参考图，写清楚想要的 PSD 效果，然后点击“生成 PSD 文件”。'
                : 'Upload source/reference images, describe the desired PSD, then click “Generate PSD file”.'}
            </div>

            <div className="psd-primary-actions">
              <ActionButtons
                language={uiLanguage}
                type="image"
                isGenerating={isQueuingLayerTasks}
                hasGenerated={Boolean(plan)}
                canGenerate={!!prompt.trim() && uploadedImages.length > 0}
                onGenerate={handlePrimaryAction}
                onReset={handleReset}
                showQuantity={false}
                generateLabel={
                  uiLanguage === 'zh'
                    ? plan
                      ? '重新生成 PSD 文件'
                      : '生成 PSD 文件'
                    : plan
                    ? 'Regenerate PSD file'
                    : 'Generate PSD file'
                }
              />
              <p className="psd-primary-actions__hint">
                {plan
                  ? uiLanguage === 'zh'
                    ? '将按同画布、原坐标和透明背景准备可叠放素材；PSD 打包接入前不会宣称已得到原生 PSD。'
                    : 'Prepares stackable assets with the same canvas, original coordinates, and transparent background; it will not claim a native PSD before packaging is wired.'
                  : uiLanguage === 'zh'
                  ? '系统会自动处理拆分细节；普通用户无需调整模板、策略或图层数量。'
                  : 'The system handles decomposition automatically; no template, strategy, or layer-count tuning is needed.'}
              </p>
            </div>

            <details
              hidden
              className="psd-advanced-settings psd-advanced-settings--developer"
              open={isAdvancedOpen}
              onToggle={(event) => setIsAdvancedOpen(event.currentTarget.open)}
            >
              <summary>
                <span>
                  {uiLanguage === 'zh'
                    ? '高级设置（可选）'
                    : 'Advanced settings (optional)'}
                </span>
                <small>
                  {uiLanguage === 'zh'
                    ? '默认已按一键 PSD 流程配置'
                    : 'Defaults already follow the one-click PSD flow'}
                </small>
              </summary>

              <div className="psd-advanced-settings__body">
                {hasCompatibleParams && (
                  <div className="model-params-row">
                    <ParametersDropdown
                      selectedParams={selectedParams}
                      onParamChange={handleParamChange}
                      modelId={currentModel}
                      language={language}
                      disabled={isQueuingLayerTasks}
                      placement="down"
                    />
                  </div>
                )}

                <KnowledgeNoteContextSelector
                  value={knowledgeContextRefs}
                  onChange={setKnowledgeContextRefs}
                  disabled={isQueuingLayerTasks}
                  language={language}
                />

                <section
                  className="psd-config-card"
                  aria-label="PSD configuration"
                >
                  <div className="psd-config-card__header">
                    <div>
                      <h3>
                        {uiLanguage === 'zh'
                          ? 'PSD 输出配置'
                          : 'PSD output setup'}
                      </h3>
                      <p>
                        {uiLanguage === 'zh'
                          ? '这些配置只影响本地可编辑计划；普通用户可以保持默认。'
                          : 'These settings only affect the local editable plan; most users can keep the defaults.'}
                      </p>
                    </div>
                    <span className="psd-output-pill">
                      {uiLanguage === 'zh' ? '可选' : 'Optional'}
                    </span>
                  </div>

                  <div className="psd-control-group">
                    <label htmlFor="psd-draft-title">
                      {uiLanguage === 'zh' ? '草稿名称' : 'Draft name'}
                    </label>
                    <input
                      id="psd-draft-title"
                      className="psd-draft-input"
                      value={draftTitle}
                      onChange={(event) =>
                        handlePlanTitleChange(event.target.value)
                      }
                      placeholder={
                        uiLanguage === 'zh'
                          ? '例如：新品发布海报 PSD'
                          : 'Example: Product launch poster PSD'
                      }
                    />
                  </div>

                  <div className="psd-control-group">
                    <label>
                      {uiLanguage === 'zh' ? 'PSD 模板' : 'PSD template'}
                    </label>
                    <div className="psd-chip-grid">
                      {TEMPLATE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`psd-chip ${
                            template === option.value ? 'psd-chip--active' : ''
                          }`}
                          onClick={() => setTemplate(option.value)}
                        >
                          {option[uiLanguage]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="psd-control-group">
                    <label>
                      {uiLanguage === 'zh' ? '图层策略' : 'Layer strategy'}
                    </label>
                    <div className="psd-strategy-list">
                      {STRATEGY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`psd-strategy ${
                            strategy === option.value
                              ? 'psd-strategy--active'
                              : ''
                          }`}
                          onClick={() => setStrategy(option.value)}
                        >
                          <span className="psd-strategy__title">
                            {option[uiLanguage]}
                          </span>
                          <span className="psd-strategy__desc">
                            {uiLanguage === 'zh'
                              ? option.zhDesc
                              : option.enDesc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="psd-control-group psd-control-group--inline">
                    <label>
                      {uiLanguage === 'zh' ? '计划图层数' : 'Planned layers'}
                    </label>
                    <div className="psd-chip-grid psd-chip-grid--compact">
                      {LAYER_COUNT_OPTIONS.map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`psd-chip ${
                            layerCount === count ? 'psd-chip--active' : ''
                          }`}
                          onClick={() => setLayerCount(count)}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="psd-checkbox-stack">
                    <label>
                      <input
                        type="checkbox"
                        checked={preferEditableText}
                        onChange={(event) =>
                          setPreferEditableText(event.target.checked)
                        }
                      />
                      {uiLanguage === 'zh'
                        ? '文字尽量作为可编辑文本层'
                        : 'Prefer editable text layers'}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={avoidBakedText}
                        onChange={(event) =>
                          setAvoidBakedText(event.target.checked)
                        }
                      />
                      {uiLanguage === 'zh'
                        ? '避免让模型生成重要文字'
                        : 'Avoid asking the model to bake important text'}
                    </label>
                  </div>
                </section>
              </div>
            </details>

            <ErrorDisplay error={error} />
          </div>
        </div>

        {!isCompactLayout ? (
          <ResizableDivider
            isRightPanelVisible={isPreviewVisible}
            onToggleRightPanel={() => setIsPreviewVisible((value) => !value)}
            onWidthChange={setPreviewWidth}
            rightPanelWidth={previewWidth}
            language={language}
            storageKey="psd"
          />
        ) : null}

        {(isCompactLayout || isPreviewVisible) && (
          <aside
            className={`task-sidebar ai-psd-preview-panel ${
              isCompactLayout ? 'task-sidebar--mobile-panel' : ''
            } ${
              isCompactLayout && mobilePanel !== 'preview'
                ? 'ai-generation-mobile-panel--hidden'
                : ''
            }`}
            style={
              isCompactLayout
                ? undefined
                : { width: previewWidth, flexShrink: 0 }
            }
          >
            <div className="psd-preview-header">
              <div>
                <h3>
                  {uiLanguage === 'zh'
                    ? 'PSD 文件预览'
                    : 'PSD file preview'}
                </h3>
                <p>
                  {uiLanguage === 'zh'
                    ? '预览自动准备的 PSD 结构；如需细调，可展开下方的可选明细。'
                    : 'Preview the automatically prepared PSD structure; expand optional details only when you need fine tuning.'}
                </p>
              </div>
              <span className="psd-preview-badge">
                {plan ? plan.layers.length : 0}{' '}
                {uiLanguage === 'zh' ? '层' : 'layers'}
              </span>
            </div>
            <div
              className="psd-preview-header__meta"
              aria-label="PSD draft summary"
            >
              <span>
                {uiLanguage === 'zh'
                  ? `可见 ${planLayerStats.visibleCount}`
                  : `${planLayerStats.visibleCount} visible`}
              </span>
              <span>
                {uiLanguage === 'zh'
                  ? `隐藏 ${planLayerStats.hiddenCount}`
                  : `${planLayerStats.hiddenCount} hidden`}
              </span>
              <span>
                {uiLanguage === 'zh'
                  ? `文字层 ${planLayerStats.textCount}`
                  : `${planLayerStats.textCount} text`}
              </span>
              <span>
                {uiLanguage === 'zh'
                  ? `已准备 ${planLayerStats.queuedCount}`
                  : `${planLayerStats.queuedCount} prepared`}
              </span>
            </div>

            {plan ? (
              <div className="psd-draft-summary" aria-label="PSD draft status">
                <label htmlFor="psd-draft-title-preview">
                  {uiLanguage === 'zh' ? 'PSD 文件名' : 'PSD filename'}
                </label>
                <input
                  id="psd-draft-title-preview"
                  className="psd-draft-input"
                  value={plan.title}
                  onChange={(event) =>
                    handlePlanTitleChange(event.target.value)
                  }
                />
                <div className="psd-draft-summary__meta">
                  <span>
                    {uiLanguage === 'zh' ? '模板：' : 'Template: '}
                    {getTemplateLabel(plan.template, uiLanguage)}
                  </span>
                  <span>
                    {uiLanguage === 'zh'
                      ? '素材：透明分层'
                      : 'Assets: transparent layers'}
                  </span>
                  <span>
                    {plan.textPolicy.preferEditableText
                      ? uiLanguage === 'zh'
                        ? '文字：优先可编辑'
                        : 'Text: editable first'
                      : uiLanguage === 'zh'
                      ? '文字：按图层说明'
                      : 'Text: follow layer notes'}
                  </span>
                </div>
                <p className="psd-draft-summary__note">
                  {uiLanguage === 'zh'
                    ? '当前底层仍通过透明背景图片素材准备 PSD；文本策略会写入本地元数据，原生 PSD 打包待后续接入。'
                    : 'Under the hood, PSD assets are still prepared as transparent layer images; text policy stays in local metadata until native PSD packaging is wired.'}
                </p>
              </div>
            ) : null}

            <div className="psd-preview-canvas" aria-label="PSD preview canvas">
              <div className="psd-preview-canvas__artboard">
                {plan ? (
                  plan.layers
                    .filter((layer) => layer.visible)
                    .slice(0, 5)
                    .map((layer, index) => (
                      <span
                        key={layer.id}
                        className={`psd-preview-shape psd-preview-shape--${layer.type}`}
                        style={{
                          transform: `translate(${(index - 2) * 18}px, ${
                            (index - 2) * 12
                          }px)`,
                        }}
                      >
                        {getLayerTypeLabel(layer.type, uiLanguage)}
                      </span>
                    ))
                ) : (
                  <div className="psd-preview-empty">
                    <strong>
                      {uiLanguage === 'zh'
                        ? '准备生成 PSD 文件'
                        : 'Ready to generate a PSD file'}
                    </strong>
                    <span>
                      {uiLanguage === 'zh'
                        ? '上传参考图并填写需求后点击“生成 PSD 文件”。'
                        : 'Upload references, enter the prompt, then click “Generate PSD file”.'}
                    </span>
                    <ul className="psd-preview-empty__steps">
                      <li>
                        {uiLanguage === 'zh'
                          ? '上传源图 / 参考图'
                          : 'Upload source / reference images'}
                      </li>
                      <li>
                        {uiLanguage === 'zh'
                          ? '填写 PSD 文件需求'
                          : 'Describe the PSD file'}
                      </li>
                      <li>
                        {uiLanguage === 'zh'
                          ? '点击生成 PSD 文件'
                          : 'Click Generate PSD file'}
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {plan ? (
              <details className="psd-layer-details">
                <summary>
                  <span>
                    {uiLanguage === 'zh'
                      ? '查看可选拆分明细'
                      : 'View optional decomposition details'}
                  </span>
                  <small>
                    {uiLanguage === 'zh'
                      ? '普通生成无需调整'
                      : 'No changes needed for normal generation'}
                  </small>
                </summary>
                <div className="psd-layer-details__body">
                  <div className="psd-layer-list">
                    {plan.layers.map((layer, index) => (
                      <article
                        key={layer.id}
                        className={`psd-layer-item ${
                          layer.visible ? '' : 'psd-layer-item--hidden'
                        }`}
                      >
                        <button
                          type="button"
                          className={`psd-layer-visibility ${
                            layer.visible ? 'psd-layer-visibility--on' : ''
                          }`}
                          onClick={() => handleToggleLayer(layer.id)}
                          aria-label={
                            uiLanguage === 'zh'
                              ? `${layer.visible ? '隐藏' : '显示'}${
                                  layer.name
                                }`
                              : `${layer.visible ? 'Hide' : 'Show'} ${
                                  layer.name
                                }`
                          }
                        >
                          {layer.visible ? '●' : '○'}
                        </button>
                        <div className="psd-layer-index">{index + 1}</div>
                        <div className="psd-layer-content">
                          <div className="psd-layer-title-row">
                            <input
                              className="psd-layer-name-input"
                              value={layer.name}
                              onChange={(event) =>
                                handleLayerChange(
                                  layer.id,
                                  'name',
                                  event.target.value
                                )
                              }
                              aria-label={
                                uiLanguage === 'zh'
                                  ? `图层 ${index + 1} 名称`
                                  : `Layer ${index + 1} name`
                              }
                            />
                            <span
                              className={`psd-layer-status psd-layer-status--${layer.status}`}
                            >
                              {getStatusLabel(layer.status, uiLanguage)}
                            </span>
                          </div>
                          <div className="psd-layer-field-row">
                            <select
                              value={layer.type}
                              onChange={(event) =>
                                handleLayerChange(
                                  layer.id,
                                  'type',
                                  event.target.value as PsdLayerType
                                )
                              }
                              aria-label={
                                uiLanguage === 'zh'
                                  ? `${layer.name} 类型`
                                  : `${layer.name} type`
                              }
                            >
                              {LAYER_TYPE_OPTIONS.map((type) => (
                                <option key={type} value={type}>
                                  {getLayerTypeLabel(type, uiLanguage)}
                                </option>
                              ))}
                            </select>
                            <label>
                              {uiLanguage === 'zh' ? '不透明度' : 'Opacity'}
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={layer.opacity}
                                onChange={(event) =>
                                  handleLayerChange(
                                    layer.id,
                                    'opacity',
                                    Math.max(
                                      0,
                                      Math.min(100, Number(event.target.value))
                                    ) as PsdLayerDraft['opacity']
                                  )
                                }
                              />
                            </label>
                          </div>
                          <textarea
                            className="psd-layer-description-input"
                            value={layer.description}
                            onChange={(event) =>
                              handleLayerChange(
                                layer.id,
                                'description',
                                event.target.value
                              )
                            }
                            aria-label={
                              uiLanguage === 'zh'
                                ? `${layer.name} 图层说明`
                                : `${layer.name} layer description`
                            }
                          />
                          <textarea
                            className="psd-layer-prompt-input"
                            value={layer.generationPrompt}
                            onChange={(event) =>
                              handleLayerChange(
                                layer.id,
                                'generationPrompt',
                                event.target.value
                              )
                            }
                            aria-label={
                              uiLanguage === 'zh'
                                ? `${layer.name} 生成提示词`
                                : `${layer.name} generation prompt`
                            }
                            placeholder={
                              uiLanguage === 'zh'
                                ? '给图片生成任务的图层素材提示词'
                                : 'Prompt for this layer asset image task'
                            }
                          />
                          <div className="psd-layer-actions">
                            <button
                              type="button"
                              onClick={() => handleMoveLayer(layer.id, -1)}
                              disabled={index === 0}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveLayer(layer.id, 1)}
                              disabled={index === plan.layers.length - 1}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateLayer(layer.id)}
                            >
                              {uiLanguage === 'zh' ? '复制' : 'Duplicate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveLayer(layer.id)}
                              disabled={layer.locked}
                            >
                              {uiLanguage === 'zh' ? '删除' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="psd-workflow-actions">
                    <button type="button" onClick={handleAddLayer}>
                      {uiLanguage === 'zh' ? '+ 添加图层' : '+ Add layer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateLayerAssets()}
                    >
                      {uiLanguage === 'zh'
                        ? '重新准备素材'
                        : 'Prepare assets again'}
                    </button>
                    <button type="button" onClick={handleExportSkeleton}>
                      {uiLanguage === 'zh'
                        ? '准备文件导出'
                        : 'Prepare file export'}
                    </button>
                  </div>
                </div>
              </details>
            ) : (
              <div className="psd-layer-empty-state">
                <p>
                  {uiLanguage === 'zh'
                    ? '生成后会显示 PSD 文件预览；高级拆分明细默认收起，避免干扰主流程。'
                    : 'After generation, a PSD preview appears; advanced decomposition details stay folded away from the main flow.'}
                </p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};

export default AIImagePsdGeneration;
