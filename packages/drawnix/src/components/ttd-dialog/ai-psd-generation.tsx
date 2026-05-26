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
            ? '已开始准备 PSD 文件'
            : 'Started preparing the PSD file'
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
            ? '请先上传原始海报或参考图，再生成 PSD 文件。'
            : 'Upload the source poster or reference image before generating the PSD file.'
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
              ? `已进入 PSD 思考拆层流程（${createdLayerIds.size} 个 Photoshop-ready 图层素材）`
              : `Started the PSD thinking layer-split flow (${createdLayerIds.size} Photoshop-ready layer assets)`
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

  return (
    <div className="ai-psd-generation-container ai-image-generation-container ai-psd-generation-container--one-click">
      <div className="psd-one-click-shell">
        <section className="psd-hero" aria-label="PSD one-click generator">
          <span className="psd-hero__eyebrow">
            {uiLanguage === 'zh'
              ? 'GPT-Image2 风格 PSD 流程'
              : 'GPT-Image2-style PSD flow'}
          </span>
          <h2>
            {uiLanguage === 'zh'
              ? '参考图 + 提示词，准备 Photoshop PSD'
              : 'Reference image + prompt, ready for Photoshop PSD'}
          </h2>
          <p>
            {uiLanguage === 'zh'
              ? '按“图像生成 → 思考拆层 → Photoshop 源设置 → 导出编辑”的方式自动准备，保持单一操作入口。'
              : 'Automatically follows image generation, thinking layer split, Photoshop source setup, and export/edit readiness behind one clear action.'}
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

          <div
            className="psd-workflow-steps"
            aria-label={
              uiLanguage === 'zh' ? 'PSD 工作流阶段' : 'PSD workflow stages'
            }
          >
            {(
              plan?.workflowSteps || [
                {
                  title:
                    uiLanguage === 'zh'
                      ? '图像生成/还原'
                      : 'Image generation/reconstruction',
                  description:
                    uiLanguage === 'zh'
                      ? '参考图和提示词作为唯一输入。'
                      : 'Reference image and prompt are the only inputs.',
                },
                {
                  title:
                    uiLanguage === 'zh' ? '思考拆层' : 'Thinking layer split',
                  description:
                    uiLanguage === 'zh'
                      ? '识别元素并拆成独立图层。'
                      : 'Identify elements and split into independent layers.',
                },
                {
                  title:
                    uiLanguage === 'zh'
                      ? '源设置：Photoshop/PSD'
                      : 'Source: Photoshop/PSD',
                  description:
                    uiLanguage === 'zh'
                      ? '保持同画布坐标，面向 Photoshop 叠放。'
                      : 'Keep same-canvas coordinates for Photoshop stacking.',
                },
                {
                  title: uiLanguage === 'zh' ? '导出与编辑' : 'Export and edit',
                  description:
                    uiLanguage === 'zh'
                      ? 'PSD 打包接入后提供下载/打开。'
                      : 'Download/open PSD when packaging is wired.',
                },
              ]
            ).map((step, index) => (
              <div className="psd-workflow-step" key={step.title}>
                <span className="psd-workflow-step__index">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>

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
                ? '开始拆层并准备 PSD'
                : 'Split layers and prepare PSD'
            }
            showReset={false}
          />

          {plan ? (
            <div className="psd-generation-status" role="status">
              <strong>
                {uiLanguage === 'zh'
                  ? 'PSD 导出准备中'
                  : 'PSD export is being prepared'}
              </strong>
              <span>
                {uiLanguage === 'zh'
                  ? `已进入思考拆层流程，正在准备 ${
                      generatedLayerCount || plan.layers.length
                    } 个 Photoshop-ready 分层素材；原生 PSD 下载将在打包能力接入后开放。`
                  : `Started the thinking layer-split flow and is preparing ${
                      generatedLayerCount || plan.layers.length
                    } Photoshop-ready layer assets; native PSD download opens once packaging is wired.`}
              </span>
            </div>
          ) : null}

          <details className="psd-capability-disclosure">
            <summary>{uiLanguage === 'zh' ? '说明' : 'Note'}</summary>
            <p>
              {uiLanguage === 'zh'
                ? '系统会自动处理生成设置。当前 OpenAI 兼容公共图片 API 暂不直接返回原生 PSD，也不暴露透明背景等模型调参；本功能先生成/编辑同画布分层素材和 PSD 导出骨架，真实 PSD 打包接入后再提供下载或打开文件。'
                : 'Opentu handles generation settings automatically. The current OpenAI-compatible public image API does not directly return native PSD and this UI does not expose model tuning such as transparent-background controls; it prepares same-canvas layer assets plus a PSD export skeleton now, then enables download/open once real PSD packaging is wired.'}
            </p>
          </details>

          <ErrorDisplay error={error} />
        </section>
      </div>
    </div>
  );
};

export default AIImagePsdGeneration;
