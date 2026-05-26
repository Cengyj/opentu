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
import type { KnowledgeContextRef } from '../../types/task.types';
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

  const [currentModel, setCurrentModel] = useState(initialModel);
  const [currentModelRef, setCurrentModelRef] = useState<ModelRef | null>(
    initialModelRef
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const [uploadedImages, setUploadedImages] =
    useState<ReferenceImage[]>(initialImages);
  const [knowledgeContextRefs, setKnowledgeContextRefs] = useState<
    KnowledgeContextRef[]
  >(initialKnowledgeContextRefs);
  const [template, setTemplate] = useState<PsdTemplate>('poster');
  const [strategy, setStrategy] = useState<PsdLayerStrategy>('ai-plan');
  const [layerCount, setLayerCount] = useState(5);
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
  const [promptHistoryVersion, setPromptHistoryVersion] = useState(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(() => loadSavedWidth('psd'));
  const [mobilePanel, setMobilePanel] = useState<'config' | 'preview'>(
    'config'
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewportWidth } = useDeviceType();
  const isCompactLayout = viewportWidth <= 768;
  const { imageHistory } = useGenerationHistory();
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
        ready: 0,
        'export-pending': 0,
      } as Record<PsdLayerDraft['status'], number>
    );

    return {
      totalLayers: layers.length,
      visibleLayers: visibleLayers.length,
      hiddenLayers: layers.length - visibleLayers.length,
      draftLayers: statusCounts.draft,
      queuedLayers: statusCounts.queued,
      readyLayers: statusCounts.ready,
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
    setPrompt(initialPrompt);
    setUploadedImages(initialImages || []);
    setKnowledgeContextRefs(initialKnowledgeContextRefs || []);
  }, [initialPrompt, initialImages, initialKnowledgeContextRefs]);

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
    setPrompt('');
    setUploadedImages([]);
    setKnowledgeContextRefs([]);
    setTemplate('poster');
    setStrategy('ai-plan');
    setLayerCount(5);
    setDraftTitle('');
    setPreferEditableText(true);
    setAvoidBakedText(true);
    setSelectedParams({});
    setPlan(null);
    setError(null);
    setMobilePanel('config');
  }, []);

  const handleGeneratePlan = useCallback(() => {
    if (!prompt.trim()) {
      setError(
        uiLanguage === 'zh'
          ? '请输入 PSD 设计描述'
          : 'Please enter a PSD design description'
      );
      return;
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
    savePromptToHistoryUtil('image', prompt.trim(), {
      width: 1024,
      height: 1024,
    });
    setPromptHistoryVersion((version) => version + 1);
    void MessagePlugin.success(
      uiLanguage === 'zh' ? '已生成 PSD 图层计划' : 'PSD layer plan generated'
    );
  }, [
    avoidBakedText,
    draftTitle,
    layerCount,
    preferEditableText,
    prompt,
    strategy,
    template,
    uiLanguage,
  ]);

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

  const handleGenerateLayerAssets = useCallback(() => {
    if (!plan) return;
    const layerTaskDrafts = buildPsdLayerImageTaskDrafts(plan, {
      model: currentModel,
      modelRef: currentModelRef,
      uploadedImages,
      knowledgeContextRefs,
      size: selectedParams.size || '1024x1024',
      width: 1024,
      height: 1024,
      extraParams: selectedParams,
    });
    const queuedLayerIds = new Set(
      layerTaskDrafts.map((draft) => draft.layerId)
    );
    setPlan((current) =>
      current
        ? {
            ...current,
            layers: current.layers.map((layer) => ({
              ...layer,
              status: queuedLayerIds.has(layer.id)
                ? 'queued'
                : 'export-pending',
            })),
          }
        : current
    );
    void MessagePlugin.success(
      uiLanguage === 'zh'
        ? `已建立 ${layerTaskDrafts.length} 个 IMAGE 图层任务草稿`
        : `Created ${layerTaskDrafts.length} IMAGE layer task drafts`
    );
  }, [
    currentModel,
    currentModelRef,
    knowledgeContextRefs,
    plan,
    selectedParams,
    uiLanguage,
    uploadedImages,
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
        ? '已准备 PSD 导出骨架；真实 PSD 打包由后续导出流程接入。'
        : 'PSD export skeleton prepared; real PSD packaging connects in a later export flow.'
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

            {hasCompatibleParams && (
              <div className="model-params-row">
                <ParametersDropdown
                  selectedParams={selectedParams}
                  onParamChange={handleParamChange}
                  modelId={currentModel}
                  language={language}
                  disabled={false}
                  placement="down"
                />
              </div>
            )}

            <section className="psd-draft-hero" aria-label="PSD draft editor">
              <div>
                <span className="psd-draft-hero__eyebrow">
                  {uiLanguage === 'zh'
                    ? 'PSD 草稿编辑器 · Beta'
                    : 'PSD Draft Editor · Beta'}
                </span>
                <h2>
                  {uiLanguage === 'zh'
                    ? '先编辑图层草稿，再生成图层素材'
                    : 'Edit a layer draft before generating layer assets'}
                </h2>
                <p>
                  {uiLanguage === 'zh'
                    ? '把设计意图拆成可命名、可排序、可隐藏、可调提示词的图层，后续图层素材仍沿用图片生成任务。'
                    : 'Break the design into named, ordered, hideable layers with editable prompts; later layer assets still use image-generation tasks.'}
                </p>
              </div>
              <ol className="psd-draft-steps" aria-label="PSD workflow steps">
                <li>{uiLanguage === 'zh' ? '结构' : 'Structure'}</li>
                <li>{uiLanguage === 'zh' ? '图层素材' : 'Layer assets'}</li>
                <li>{uiLanguage === 'zh' ? '导出骨架' : 'Export skeleton'}</li>
              </ol>
            </section>

            <div className="psd-api-note" role="note">
              <strong>
                {uiLanguage === 'zh' ? 'PSD 说明：' : 'PSD note: '}
              </strong>
              {uiLanguage === 'zh'
                ? 'OpenAI 兼容图片 API 不直接返回原生 PSD。Opentu 会先生成图层计划和预览，后续再由本地/服务端打包 PSD。'
                : 'OpenAI-compatible image APIs do not directly return native PSD files. Opentu first creates a layer plan and preview, then a later local/server exporter can package PSD files.'}
            </div>

            <ReferenceImageUpload
              images={uploadedImages}
              onImagesChange={setUploadedImages}
              language={language}
              disabled={false}
              multiple={true}
              label={
                uiLanguage === 'zh'
                  ? '参考图片 / 设计稿 / 元素素材（可选）'
                  : 'Reference images / designs / assets (optional)'
              }
              onError={setError}
            />

            <PromptInput
              prompt={prompt}
              onPromptChange={setPrompt}
              presetPrompts={presetPrompts}
              language={language}
              type="image"
              disabled={false}
              onError={setError}
            />

            <KnowledgeNoteContextSelector
              value={knowledgeContextRefs}
              onChange={setKnowledgeContextRefs}
              disabled={false}
              language={language}
            />

            <section className="psd-config-card" aria-label="PSD configuration">
              <div className="psd-config-card__header">
                <div>
                  <h3>
                    {uiLanguage === 'zh' ? 'PSD 输出配置' : 'PSD output setup'}
                  </h3>
                  <p>
                    {uiLanguage === 'zh'
                      ? '先规划图层结构，避免把文字和主体全部烘焙到一张图里。'
                      : 'Plan the layer structure first so text and subjects are not all baked into one image.'}
                  </p>
                </div>
                <span className="psd-output-pill">
                  {uiLanguage === 'zh' ? '分层 PSD' : 'Layered PSD'}
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
                        strategy === option.value ? 'psd-strategy--active' : ''
                      }`}
                      onClick={() => setStrategy(option.value)}
                    >
                      <span className="psd-strategy__title">
                        {option[uiLanguage]}
                      </span>
                      <span className="psd-strategy__desc">
                        {uiLanguage === 'zh' ? option.zhDesc : option.enDesc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="psd-control-group psd-control-group--inline">
                <label>
                  {uiLanguage === 'zh' ? '图层数量' : 'Layer count'}
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

            <ErrorDisplay error={error} />
          </div>

          <ActionButtons
            language={uiLanguage}
            type="image"
            isGenerating={false}
            hasGenerated={Boolean(plan)}
            canGenerate={!!prompt.trim()}
            onGenerate={handleGeneratePlan}
            onReset={handleReset}
            showQuantity={false}
            generateLabel={
              plan
                ? uiLanguage === 'zh'
                  ? '重新规划 PSD'
                  : 'Replan PSD'
                : uiLanguage === 'zh'
                ? '生成 PSD 结构'
                : 'Generate PSD plan'
            }
          />
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
                    ? '可编辑 PSD 草稿'
                    : 'Editable PSD draft'}
                </h3>
                <p>
                  {uiLanguage === 'zh'
                    ? '编辑图层名称、类型、提示词、顺序和可见性；后续生成/导出按钮先提供可接线的 UI 骨架。'
                    : 'Edit layer names, types, prompts, order, and visibility; generation/export actions provide the connectable UI skeleton first.'}
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
                  ? `待生成 ${planLayerStats.queuedCount}`
                  : `${planLayerStats.queuedCount} queued`}
              </span>
            </div>

            {plan ? (
              <div className="psd-draft-summary" aria-label="PSD draft status">
                <label htmlFor="psd-draft-title-preview">
                  {uiLanguage === 'zh' ? '草稿标题' : 'Draft title'}
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
                      ? '任务：沿用 IMAGE'
                      : 'Tasks: IMAGE only'}
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
                    ? '图层素材仍沿用 IMAGE 任务草稿；文本策略会写入本地 PSD 草稿元数据，不创建 PSD 专属任务类型。'
                    : 'Layer assets still use IMAGE task drafts; text policy is kept in local PSD draft metadata without creating PSD-specific task types.'}
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
                        ? '尚未生成图层计划'
                        : 'No layer plan yet'}
                    </strong>
                    <span>
                      {uiLanguage === 'zh'
                        ? '填写描述后点击“生成 PSD 结构”。'
                        : 'Write a description and click “Generate PSD plan”.'}
                    </span>
                    <ul className="psd-preview-empty__steps">
                      <li>
                        {uiLanguage === 'zh'
                          ? '先写设计目标，再补参考图'
                          : 'Start with the design goal and add references'}
                      </li>
                      <li>
                        {uiLanguage === 'zh'
                          ? '选择模板与图层策略'
                          : 'Choose a template and layer strategy'}
                      </li>
                      <li>
                        {uiLanguage === 'zh'
                          ? '生成后再细调图层顺序/显隐'
                          : 'Refine order and visibility after generation'}
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {plan ? (
              <>
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
                            ? `${layer.visible ? '隐藏' : '显示'}${layer.name}`
                            : `${layer.visible ? 'Hide' : 'Show'} ${layer.name}`
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
                <button type="button" onClick={handleGenerateLayerAssets}>
                  {uiLanguage === 'zh'
                    ? '建立图层生成骨架'
                    : 'Create layer-generation skeleton'}
                </button>
                <button type="button" onClick={handleExportSkeleton}>
                  {uiLanguage === 'zh' ? '准备导出骨架' : 'Prepare export skeleton'}
                </button>
              </div>
              </>
            ) : (
              <div className="psd-layer-empty-state">
                <p>
                  {uiLanguage === 'zh'
                    ? '图层计划会包含背景、主体、文字、装饰和后期说明，便于后续打包为 PSD。'
                    : 'The plan will include background, subject, text, decorations, and post-production notes for a later PSD package.'}
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
