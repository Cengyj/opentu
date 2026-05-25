import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface AIImagePsdGenerationProps {
  initialPrompt?: string;
  initialImages?: ReferenceImage[];
  initialKnowledgeContextRefs?: KnowledgeContextRef[];
  selectedModel?: string;
  selectedModelRef?: ModelRef | null;
  onModelChange?: (value: string) => void;
  onModelRefChange?: (value: ModelRef | null) => void;
}

type PsdTemplate = 'poster' | 'ecommerce' | 'character' | 'social' | 'custom';
type PsdLayerStrategy = 'ai-plan' | 'quick' | 'canvas-selection';
type PsdLayerType = 'background' | 'image' | 'text' | 'decoration' | 'adjustment';

interface PsdLayerDraft {
  id: string;
  name: string;
  type: PsdLayerType;
  description: string;
  visible: boolean;
  locked?: boolean;
}

interface PsdPlanDraft {
  title: string;
  template: PsdTemplate;
  strategy: PsdLayerStrategy;
  layers: PsdLayerDraft[];
}

const TEMPLATE_OPTIONS: Array<{ value: PsdTemplate; zh: string; en: string }> = [
  { value: 'poster', zh: '海报', en: 'Poster' },
  { value: 'ecommerce', zh: '电商主图', en: 'E-commerce' },
  { value: 'character', zh: '角色设定', en: 'Character' },
  { value: 'social', zh: '社媒封面', en: 'Social' },
  { value: 'custom', zh: '自定义', en: 'Custom' },
];

const STRATEGY_OPTIONS: Array<{
  value: PsdLayerStrategy;
  zh: string;
  en: string;
  zhDesc: string;
  enDesc: string;
}> = [
  {
    value: 'ai-plan',
    zh: 'AI 规划图层',
    en: 'AI layer plan',
    zhDesc: '先生成可编辑的图层结构，适合作为第一版工作流。',
    enDesc: 'Create an editable layer plan first; best for the initial workflow.',
  },
  {
    value: 'quick',
    zh: '快速 PSD',
    en: 'Quick PSD',
    zhDesc: '生成预览图和基础图层占位，后续再细化。',
    enDesc: 'Generate a preview and basic layer placeholders for later refinement.',
  },
  {
    value: 'canvas-selection',
    zh: '从当前画布/选区构建',
    en: 'Build from canvas',
    zhDesc: '优先使用当前画布选区作为图层来源。',
    enDesc: 'Prefer the current canvas selection as layer sources.',
  },
];

const LAYER_COUNT_OPTIONS = [3, 5, 8];

function getTemplateLabel(
  template: PsdTemplate,
  language: 'zh' | 'en'
): string {
  const option = TEMPLATE_OPTIONS.find((item) => item.value === template);
  return option ? option[language] : template;
}

function getLayerTypeLabel(type: PsdLayerType, language: 'zh' | 'en'): string {
  const labels: Record<PsdLayerType, { zh: string; en: string }> = {
    background: { zh: '背景', en: 'Background' },
    image: { zh: '图片', en: 'Image' },
    text: { zh: '文字', en: 'Text' },
    decoration: { zh: '装饰', en: 'Decoration' },
    adjustment: { zh: '调整', en: 'Adjustment' },
  };
  return labels[type][language];
}

export function buildLayerPlan(
  prompt: string,
  template: PsdTemplate,
  strategy: PsdLayerStrategy,
  layerCount: number,
  language: 'zh' | 'en'
): PsdPlanDraft {
  const basePrompt = prompt.trim();
  const templateLabel = getTemplateLabel(template, language);
  const isZh = language === 'zh';
  const layerSeeds: Array<Omit<PsdLayerDraft, 'id' | 'visible'>> = [
    {
      name: isZh ? '背景层' : 'Background',
      type: 'background',
      description: isZh
        ? `为“${basePrompt || templateLabel}”建立整体氛围、色调和留白。`
        : `Set the overall atmosphere, palette, and negative space for “${basePrompt || templateLabel}”.`,
      locked: true,
    },
    {
      name:
        template === 'ecommerce'
          ? isZh
            ? '产品主体'
            : 'Product hero'
          : isZh
          ? '视觉主体'
          : 'Main subject',
      type: 'image',
      description: isZh
        ? '承载主要视觉对象，建议和背景分离便于后期编辑。'
        : 'Holds the primary visual object, separated from the background for editing.',
    },
    {
      name: isZh ? '标题文字' : 'Headline text',
      type: 'text',
      description: isZh
        ? '关键文案尽量作为可编辑文字层，不建议让模型直接烘焙到图片里。'
        : 'Keep key copy as editable text instead of baking it into the generated image.',
    },
    {
      name: isZh ? '辅助信息' : 'Supporting copy',
      type: 'text',
      description: isZh
        ? '副标题、卖点或说明文字，便于在 Photoshop 中快速改字。'
        : 'Subtitles, selling points, or helper copy that can be edited later.',
    },
    {
      name: isZh ? '装饰元素' : 'Decorations',
      type: 'decoration',
      description: isZh
        ? '光效、贴纸、角标、纹理等非核心元素，独立成层方便隐藏。'
        : 'Light effects, stickers, badges, or textures isolated for easy toggling.',
    },
    {
      name: isZh ? '前景强调' : 'Foreground accents',
      type: 'decoration',
      description: isZh
        ? '用于增强纵深和焦点的前景元素。'
        : 'Foreground elements that add depth and visual focus.',
    },
    {
      name: isZh ? '调色/说明层' : 'Adjustment notes',
      type: 'adjustment',
      description: isZh
        ? '记录建议的调色、遮罩或后期微调说明。'
        : 'Notes for color grading, masks, or manual post-production tweaks.',
    },
    {
      name: isZh ? '安全边距参考' : 'Safe-area guide',
      type: 'adjustment',
      description: isZh
        ? '预留裁切、安全区和平台展示边界参考。'
        : 'Guides for crop, safe areas, and platform display bounds.',
    },
  ];

  const count = Math.min(Math.max(layerCount, 3), layerSeeds.length);
  return {
    title: basePrompt || (isZh ? `${templateLabel} PSD 计划` : `${templateLabel} PSD plan`),
    template,
    strategy,
    layers: layerSeeds.slice(0, count).map((layer, index) => ({
      ...layer,
      id: `psd-layer-${index + 1}`,
      visible: true,
    })),
  };
}

const AIImagePsdGeneration = ({
  initialPrompt = '',
  initialImages = [],
  initialKnowledgeContextRefs = [],
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
      selectedModelRef || createModelRef(initialRoute.profileId, initialRoute.modelId)
    ) ||
    getPinnedSelectableModel(
      'image',
      selectedModel || initialRoute.modelId,
      selectedModelRef || createModelRef(initialRoute.profileId, initialRoute.modelId)
    );
  const initialModel =
    selectedModel || initialMatchedModel?.id || imageModels[0]?.id || 'gpt-image-2';
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
  const [mobilePanel, setMobilePanel] = useState<'config' | 'preview'>('config');
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewportWidth } = useDeviceType();
  const isCompactLayout = viewportWidth <= 768;
  const { imageHistory } = useGenerationHistory();

  const visibleImageModels = useMemo(() => {
    const currentMatch = findMatchingSelectableModel(
      imageModels,
      currentModel,
      currentModelRef
    );
    if (currentMatch || !currentModel) {
      return imageModels;
    }
    const pinned = getPinnedSelectableModel('image', currentModel, currentModelRef);
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
    setCurrentModelRef(getModelRefFromConfig(matched) || selectedModelRef || null);
  }, [currentModel, currentModelRef, selectedModel, selectedModelRef, visibleImageModels]);

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
      uiLanguage
    );
    setPlan(nextPlan);
    setError(null);
    setMobilePanel('preview');
    savePromptToHistoryUtil('image', prompt.trim(), { width: 1024, height: 1024 });
    setPromptHistoryVersion((version) => version + 1);
    void MessagePlugin.success(
      uiLanguage === 'zh' ? '已生成 PSD 图层计划' : 'PSD layer plan generated'
    );
  }, [layerCount, prompt, strategy, template, uiLanguage]);

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
            onClick={() => setMobilePanel('config')}
          >
            {uiLanguage === 'zh' ? '生成配置' : 'Setup'}
          </button>
          <button
            type="button"
            className={`ai-generation-mobile-switcher__tab ${
              mobilePanel === 'preview'
                ? 'ai-generation-mobile-switcher__tab--active'
                : ''
            }`}
            onClick={() => setMobilePanel('preview')}
          >
            {uiLanguage === 'zh' ? 'PSD 预览' : 'PSD Preview'}
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
                  <h3>{uiLanguage === 'zh' ? 'PSD 输出配置' : 'PSD output setup'}</h3>
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
                <label>{uiLanguage === 'zh' ? 'PSD 模板' : 'PSD template'}</label>
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
                <label>{uiLanguage === 'zh' ? '图层策略' : 'Layer strategy'}</label>
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
                <label>{uiLanguage === 'zh' ? '图层数量' : 'Layer count'}</label>
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
                    onChange={(event) => setPreferEditableText(event.target.checked)}
                  />
                  {uiLanguage === 'zh'
                    ? '文字尽量作为可编辑文本层'
                    : 'Prefer editable text layers'}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={avoidBakedText}
                    onChange={(event) => setAvoidBakedText(event.target.checked)}
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
              isCompactLayout ? undefined : { width: previewWidth, flexShrink: 0 }
            }
          >
            <div className="psd-preview-header">
              <div>
                <h3>{uiLanguage === 'zh' ? 'PSD 图层计划' : 'PSD layer plan'}</h3>
                <p>
                  {uiLanguage === 'zh'
                    ? '第一版展示可编辑图层结构；下载 PSD 会在后续导出阶段实现。'
                    : 'The first version previews editable layer structure; PSD download belongs to a later export phase.'}
                </p>
              </div>
              <span className="psd-preview-badge">
                {plan ? plan.layers.length : 0}{' '}
                {uiLanguage === 'zh' ? '层' : 'layers'}
              </span>
            </div>

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
                        style={{ ['--layer-index' as string]: index }}
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
                  </div>
                )}
              </div>
            </div>

            {plan ? (
              <div className="psd-layer-list">
                {plan.layers.map((layer, index) => (
                  <article key={layer.id} className="psd-layer-item">
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
                        <strong>{layer.name}</strong>
                        <span className={`psd-layer-type psd-layer-type--${layer.type}`}>
                          {getLayerTypeLabel(layer.type, uiLanguage)}
                        </span>
                      </div>
                      <p>{layer.description}</p>
                    </div>
                  </article>
                ))}
              </div>
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
