import React, { useCallback, useEffect, useState } from 'react';
import './ttd-dialog.scss';
import './ai-image-generation.scss';
import './ai-psd-generation.scss';
import { MessagePlugin } from 'tdesign-react';
import { useI18n } from '../../i18n';
import { useTaskQueue } from '../../hooks/useTaskQueue';
import { useSelectableModels } from '../../hooks/use-runtime-models';
import {
  ActionButtons,
  ErrorDisplay,
  PromptInput,
  ReferenceImageUpload,
  savePromptToHistory as savePromptToHistoryUtil,
  type ReferenceImage,
} from './shared';
import { TaskType, type KnowledgeContextRef } from '../../types/task.types';
import { DEFAULT_IMAGE_MODEL_ID } from '../../constants/model-config';
import {
  createModelRef,
  resolveInvocationRoute,
  type ModelRef,
} from '../../utils/settings-manager';
import { loadScopedAIImageToolPreferences } from '../../services/ai-generation-preferences-service';
import { getPinnedSelectableModel } from '../../utils/runtime-model-discovery';
import {
  findMatchingSelectableModel,
  getModelRefFromConfig,
  getSelectionKey,
} from '../../utils/model-selection';
import {
  buildLayerPlan,
  buildPsdLayerImageTaskPlans,
  getDefaultPsdLayerExtractionPrompt,
  type PsdLayerStrategy,
  type PsdGenerationPlan,
  type PsdTemplate,
} from './ai-psd-plan';

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

const PSD_WORKFLOW_STEPS = {
  zh: [
    { title: '图像生成', description: '上传原图/参考图并描述目标海报' },
    { title: '思考拆层', description: '识别背景、主体、文字、装饰和层级' },
    { title: '源设置', description: '按 Photoshop/PSD 兼容结构准备导出源' },
    { title: '导出编辑', description: 'PSD 打包接入后下载并在 Photoshop 打开' },
  ],
  en: [
    {
      title: 'Image generation',
      description:
        'Upload a source/reference image and describe the target poster',
    },
    {
      title: 'Thinking split',
      description:
        'Identify background, subject, text, decoration, and layer order',
    },
    {
      title: 'Source setting',
      description: 'Prepare export sources for Photoshop/PSD compatibility',
    },
    {
      title: 'Export/edit',
      description:
        'Download and open the PSD in Photoshop when packaging is supported',
    },
  ],
} as const;

const AIImagePsdGeneration = ({
  initialPrompt = '',
  initialImages = EMPTY_REFERENCE_IMAGES,
  initialKnowledgeContextRefs = EMPTY_KNOWLEDGE_CONTEXT_REFS,
}: AIImagePsdGenerationProps = {}) => {
  const { language } = useI18n();
  const uiLanguage = (language === 'zh' ? 'zh' : 'en') as 'zh' | 'en';
  const imageModels = useSelectableModels('image');
  const initialRoute = resolveInvocationRoute('image');
  const defaultPsdPrompt = getDefaultPsdLayerExtractionPrompt(uiLanguage);
  const forcedPsdModelRef = createModelRef(
    initialRoute.profileId,
    DEFAULT_IMAGE_MODEL_ID
  );
  const initialMatchedModel =
    findMatchingSelectableModel(
      imageModels,
      DEFAULT_IMAGE_MODEL_ID,
      forcedPsdModelRef
    ) || getPinnedSelectableModel('image', DEFAULT_IMAGE_MODEL_ID, null);
  const initialModel = initialMatchedModel?.id || DEFAULT_IMAGE_MODEL_ID;
  const initialModelRef =
    getModelRefFromConfig(initialMatchedModel) || forcedPsdModelRef;

  const [currentModel] = useState(initialModel);
  const [currentModelRef] = useState<ModelRef | null>(initialModelRef);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [uploadedImages, setUploadedImages] =
    useState<ReferenceImage[]>(initialImages);
  const [knowledgeContextRefs, setKnowledgeContextRefs] = useState<
    KnowledgeContextRef[]
  >(initialKnowledgeContextRefs);
  const { createTask } = useTaskQueue();
  const template: PsdTemplate = 'poster';
  const strategy: PsdLayerStrategy = 'ai-plan';
  const layerCount = 8;
  const [plan, setPlan] = useState<PsdGenerationPlan | null>(null);
  const [isQueuingLayerTasks, setIsQueuingLayerTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preferEditableText = true;
  const avoidBakedText = true;
  const selectedParams = loadScopedAIImageToolPreferences(
    initialModel,
    getSelectionKey(initialModel, initialModelRef)
  ).extraParams;

  useEffect(() => {
    setPrompt(initialPrompt);
    setUploadedImages(initialImages || []);
    setKnowledgeContextRefs(initialKnowledgeContextRefs || []);
  }, [initialPrompt, initialImages, initialKnowledgeContextRefs]);

  const handleReset = useCallback(() => {
    setPrompt('');
    setUploadedImages([]);
    setKnowledgeContextRefs([]);
    setPlan(null);
    setError(null);
  }, []);

  const handleGeneratePlan = useCallback(
    (showSuccess = true) => {
      if (!prompt.trim()) {
        setError(
          uiLanguage === 'zh'
            ? '请输入 PSD 分层与导出需求'
            : 'Please enter the PSD layer/export requirements'
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
      const titledPlan = { ...nextPlan, title: nextPlan.title || 'PSD 文件' };
      setPlan(titledPlan);
      setError(null);
      savePromptToHistoryUtil('image', prompt.trim(), {
        width: 1024,
        height: 1024,
      });
      if (showSuccess) {
        void MessagePlugin.success(
          uiLanguage === 'zh'
            ? '已开始准备 PSD 分层与 Photoshop 导出'
            : 'Started preparing PSD layers and Photoshop export'
        );
      }
      return titledPlan;
    },
    [
      avoidBakedText,
      layerCount,
      preferEditableText,
      prompt,
      strategy,
      template,
      uiLanguage,
    ]
  );

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
    async (planOverride?: PsdGenerationPlan) => {
      const targetPlan = planOverride || plan;
      if (!targetPlan || isQueuingLayerTasks) return;

      if (uploadedImages.length === 0) {
        setError(
          uiLanguage === 'zh'
            ? '请先上传原始海报或参考图，再准备 PSD 分层。'
            : 'Upload the source poster or reference image before preparing PSD layers.'
        );
        return;
      }

      setIsQueuingLayerTasks(true);
      try {
        const serializableImages = await convertUploadedImagesToSerializable();
        const layerTaskPlans = buildPsdLayerImageTaskPlans(targetPlan, {
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

        for (const taskPlan of layerTaskPlans) {
          const task = createTask(taskPlan.params, TaskType.IMAGE);
          if (task) {
            createdLayerIds.add(taskPlan.layerId);
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
              ? `已开始 PSD 分层准备（排队 ${createdLayerIds.size} 个 Photoshop 图层源）`
              : `Started PSD layer preparation (${createdLayerIds.size} Photoshop layer sources queued)`
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
          ? '请先上传原始海报/参考图，然后准备 PSD 分层。'
          : 'Upload a source poster/reference image before preparing PSD layers.'
      );
      return;
    }

    const targetPlan = handleGeneratePlan(false);
    if (!targetPlan) return;
    void handleGenerateLayerAssets(targetPlan);
  }, [
    handleGenerateLayerAssets,
    handleGeneratePlan,
    uiLanguage,
    uploadedImages.length,
  ]);

  const generatedLayerCount = plan?.layers.filter(
    (layer) => layer.status === 'queued'
  ).length;
  const workflowStages = [
    {
      key: 'image',
      title: uiLanguage === 'zh' ? '图像生成' : 'Image generation',
      description:
        uiLanguage === 'zh'
          ? '使用参考图和提示词建立海报/设计基础。'
          : 'Use the reference image and prompt to establish the poster/design base.',
    },
    {
      key: 'thinking',
      title: uiLanguage === 'zh' ? '思考拆层' : 'Thinking layer split',
      description:
        uiLanguage === 'zh'
          ? '识别画布、元素坐标、层级顺序和可编辑文字。'
          : 'Identify canvas, element coordinates, stacking order, and editable text.',
    },
    {
      key: 'photoshop',
      title: uiLanguage === 'zh' ? '源设置：Photoshop' : 'Source: Photoshop',
      description:
        uiLanguage === 'zh'
          ? '为后续 Photoshop/PSD 打包保留导出元数据。'
          : 'Keep export metadata ready for later Photoshop/PSD packaging.',
    },
    {
      key: 'export',
      title: uiLanguage === 'zh' ? '导出与编辑' : 'Export and edit',
      description:
        uiLanguage === 'zh'
          ? '当前先准备可叠放图层素材，不伪装原生 PSD 下载。'
          : 'Prepare stackable layer assets first; do not fake a native PSD download.',
    },
  ];

  return (
    <div className="ai-psd-generation-container ai-image-generation-container ai-psd-generation-container--one-click">
      <div className="psd-one-click-shell">
        <section className="psd-hero" aria-label="PSD one-click generator">
          <span className="psd-hero__eyebrow">
            {uiLanguage === 'zh'
              ? 'GPT-Image2 风格 PSD 工作流'
              : 'GPT-Image2-style PSD workflow'}
          </span>
          <h2>
            {uiLanguage === 'zh'
              ? '像 GPT-Image2 工作流一样准备 PSD'
              : 'Prepare PSD like the GPT-Image2 workflow'}
          </h2>
          <p>
            {uiLanguage === 'zh'
              ? '只需要参考图和提示词；系统按“图像生成 → 思考拆层 → Photoshop 源设置 → 导出编辑”的流程准备 PSD 工作区。'
              : 'Only a reference image and prompt are needed; Opentu follows image generation → thinking layer split → Photoshop source → export/edit readiness.'}
          </p>
        </section>

        <section className="psd-gpt-composer" aria-label="PSD composer">
          <ReferenceImageUpload
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            language={language}
            disabled={isQueuingLayerTasks}
            multiple={false}
            maxCount={1}
            label={uiLanguage === 'zh' ? '参考图' : 'Reference image'}
            onError={setError}
          />

          <PromptInput
            prompt={prompt}
            onPromptChange={setPrompt}
            presetPrompts={[]}
            language={language}
            type="image"
            disabled={isQueuingLayerTasks}
            onError={setError}
            label={uiLanguage === 'zh' ? '提示词' : 'Prompt'}
            placeholder={defaultPsdPrompt}
            showPresetButton={false}
            showOptimizeButton={false}
          />

          <ol
            className="psd-workflow-steps"
            aria-label={
              uiLanguage === 'zh' ? 'PSD 工作流阶段' : 'PSD workflow stages'
            }
          >
            {PSD_WORKFLOW_STEPS[uiLanguage].map((step, index) => (
              <li key={step.title}>
                <span className="psd-workflow-steps__index">{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
              </li>
            ))}
          </ol>

          <ActionButtons
            language={uiLanguage}
            type="image"
            isGenerating={isQueuingLayerTasks}
            hasGenerated={false}
            canGenerate={!!prompt.trim() && uploadedImages.length > 0}
            onGenerate={handlePrimaryAction}
            onReset={handleReset}
            showQuantity={false}
            generateLabel={
              uiLanguage === 'zh'
                ? '准备 PSD 分层/导出'
                : 'Prepare PSD layers/export'
            }
            showReset={false}
          />

          <ol className="psd-workflow-stages" aria-label="PSD workflow stages">
            {workflowStages.map((stage, index) => {
              const isActive = Boolean(plan) || isQueuingLayerTasks;
              return (
                <li
                  key={stage.key}
                  className={
                    isActive
                      ? 'psd-workflow-stage psd-workflow-stage--active'
                      : 'psd-workflow-stage'
                  }
                >
                  <span className="psd-workflow-stage__index">{index + 1}</span>
                  <span>
                    <strong>{stage.title}</strong>
                    <small>{stage.description}</small>
                  </span>
                </li>
              );
            })}
          </ol>

          {plan ? (
            <div className="psd-generation-status" role="status">
              <strong>
                {uiLanguage === 'zh'
                  ? 'PSD 工作流已启动'
                  : 'PSD workflow started'}
              </strong>
              <span>
                {uiLanguage === 'zh'
                  ? `已排队 ${
                      generatedLayerCount || plan.layers.length
                    } 个同画布分层素材，保留原坐标和 Photoshop/PSD 导出元数据；当前不会伪装成原生 PSD 下载。`
                  : `Started preparing ${
                      generatedLayerCount || plan.layers.length
                    } same-canvas layer assets while preserving coordinates and Photoshop/PSD export metadata; no fake native PSD download is shown.`}
              </span>
            </div>
          ) : null}

          <details className="psd-capability-disclosure">
            <summary>{uiLanguage === 'zh' ? '说明' : 'Note'}</summary>
            <p>
              {uiLanguage === 'zh'
                ? '系统会自动处理生成设置；公开图片 API 当前返回图片数据而不是原生 .psd，Opentu 先生成/编辑同画布分层素材，并把 Photoshop/PSD 打包作为后续本地或服务端导出能力。'
                : 'Opentu handles generation settings automatically; the public Image API currently returns image data rather than a native .psd, so Opentu first generates/edits same-canvas layer assets and keeps Photoshop/PSD packaging for a later local or server export step.'}
            </p>
          </details>

          <ErrorDisplay error={error} />
        </section>
      </div>
    </div>
  );
};

export default AIImagePsdGeneration;
