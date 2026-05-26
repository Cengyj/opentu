import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  TaskStatus,
  type KnowledgeContextRef,
  type Task,
} from '../../types/task.types';
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
  buildPsdReadyImageTaskPlan,
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

type PsdStatusTone = 'queued' | 'active' | 'success' | 'warning' | 'error';

interface PsdTaskStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  terminal: number;
  progressPercent: number;
  isActive: boolean;
  tone: PsdStatusTone;
  title: string;
  countSummary: string;
  detail: string;
}

function getTaskBatchId(task: Task): string | null {
  const batchId = task.params?.batchId;
  return typeof batchId === 'string' ? batchId : null;
}

function getTaskBatchTotal(task: Task): number {
  const batchTotal = task.params?.batchTotal;
  return typeof batchTotal === 'number' && Number.isFinite(batchTotal)
    ? batchTotal
    : 0;
}

function buildPsdTaskStats(
  psdTasks: Task[],
  expectedTotal: number,
  uiLanguage: 'zh' | 'en'
): PsdTaskStats {
  const taskBatchTotal = psdTasks.reduce(
    (max, task) => Math.max(max, getTaskBatchTotal(task)),
    0
  );
  const total = Math.max(psdTasks.length, expectedTotal, taskBatchTotal);
  const completed = psdTasks.filter(
    (task) => task.status === TaskStatus.COMPLETED
  ).length;
  const failed = psdTasks.filter(
    (task) => task.status === TaskStatus.FAILED
  ).length;
  const cancelled = psdTasks.filter(
    (task) => task.status === TaskStatus.CANCELLED
  ).length;
  const processing = psdTasks.filter(
    (task) => task.status === TaskStatus.PROCESSING
  ).length;
  const observedPending = psdTasks.filter(
    (task) => task.status === TaskStatus.PENDING
  ).length;
  const pending = observedPending + Math.max(total - psdTasks.length, 0);
  const terminal = completed + failed + cancelled;
  const isActive = total > 0 && terminal < total;
  const progressPercent = total > 0 ? Math.round((terminal / total) * 100) : 0;

  let tone: PsdStatusTone = 'queued';
  let title: string;
  let detail: string;

  if (total > 0 && failed === total) {
    tone = 'error';
    title =
      uiLanguage === 'zh'
        ? 'PSD-ready 生成失败'
        : 'PSD-ready generation failed';
    detail =
      uiLanguage === 'zh'
        ? '任务失败。请在任务队列查看错误详情，调整提示词或参考图后重试。'
        : 'The task failed. Check task queue errors, then adjust the prompt or reference image and retry.';
  } else if (failed > 0 || cancelled > 0) {
    tone = 'warning';
    title =
      uiLanguage === 'zh'
        ? 'PSD-ready 任务未完成'
        : 'PSD-ready task did not complete';
    detail =
      uiLanguage === 'zh'
        ? '请在任务队列查看失败原因或重试；已完成结果仍可在任务队列或素材库查看。'
        : 'Check the task queue for failure details or retry; completed results remain available in the task queue or media library.';
  } else if (total > 0 && completed === total) {
    tone = 'success';
    title =
      uiLanguage === 'zh'
        ? 'PSD-ready 图片已生成完成'
        : 'PSD-ready image is ready';
    detail =
      uiLanguage === 'zh'
        ? '可在任务队列或素材库查看结果；当前不是原生 PSD 下载，后续接入 PSD 打包器后再提供 .psd 文件。'
        : 'View results in the task queue or media library; this is not a native PSD download until PSD packaging is wired.';
  } else if (processing > 0) {
    tone = 'active';
    title =
      uiLanguage === 'zh'
        ? 'PSD-ready 生成中'
        : 'PSD-ready image is generating';
    detail =
      uiLanguage === 'zh'
        ? '正在生成 PSD-ready 结果，请保持页面打开；任务完成或失败后这里会自动更新。'
        : 'Generating the PSD-ready result. Keep this page open; this status updates on completion or failure.';
  } else {
    title =
      uiLanguage === 'zh' ? 'PSD-ready 任务已排队' : 'PSD-ready task queued';
    detail =
      uiLanguage === 'zh'
        ? '已排队 1 个 GPT Image 编辑任务，等待开始生成；若长时间无变化，请打开任务队列查看是否缺少密钥、额度或接口错误。'
        : 'One GPT Image edit task is queued. If this does not change, open the task queue to check credentials, quota, or API errors.';
  }

  const countSummary =
    uiLanguage === 'zh'
      ? failed > 0 || cancelled > 0 || processing > 0 || pending > 0
        ? `成功 ${completed} / 失败 ${failed} / 进行中 ${processing} / 排队 ${pending} / 总计 ${total}`
        : `成功 ${completed} / 总计 ${total}`
      : failed > 0 || cancelled > 0 || processing > 0 || pending > 0
      ? `Completed ${completed} / Failed ${failed} / Processing ${processing} / Queued ${pending} / Total ${total}`
      : `Completed ${completed} / Total ${total}`;

  return {
    total,
    pending,
    processing,
    completed,
    failed,
    cancelled,
    terminal,
    progressPercent,
    isActive,
    tone,
    title,
    countSummary,
    detail,
  };
}

const PSD_WORKFLOW_STEPS = {
  zh: [
    { title: '图像生成', description: '上传原图/参考图并描述目标海报' },
    { title: '思考拆层', description: '识别背景、主体、文字、装饰和层级' },
    {
      title: '源设置：Photoshop',
      description: '按 Photoshop/PSD 兼容结构准备导出源',
    },
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
  const { createTask, tasks } = useTaskQueue();
  const template: PsdTemplate = 'poster';
  const strategy: PsdLayerStrategy = 'ai-plan';
  const layerCount = 8;
  const [plan, setPlan] = useState<PsdGenerationPlan | null>(null);
  const [psdTaskIds, setPsdTaskIds] = useState<string[]>([]);
  const [psdBatchId, setPsdBatchId] = useState<string | null>(null);
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
    setPsdTaskIds([]);
    setPsdBatchId(null);
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
            ? '请先上传原始海报或参考图，再生成 PSD-ready 结果。'
            : 'Upload the source poster or reference image before generating a PSD-ready result.'
        );
        return;
      }

      setIsQueuingLayerTasks(true);
      try {
        const serializableImages = await convertUploadedImagesToSerializable();
        const taskPlan = buildPsdReadyImageTaskPlan(targetPlan, {
          model: currentModel,
          modelRef: currentModelRef,
          uploadedImages: serializableImages,
          knowledgeContextRefs,
          size: selectedParams.size || '1024x1024',
          width: 1024,
          height: 1024,
          extraParams: selectedParams,
          language: uiLanguage,
        });
        const nextBatchId = taskPlan.params.batchId as string;
        const task = createTask(taskPlan.params, taskPlan.taskType);

        setPsdTaskIds(task ? [task.id] : []);
        setPsdBatchId(nextBatchId);
        setPlan((current) => {
          const basePlan = current || targetPlan;
          return {
            ...basePlan,
            layers: basePlan.layers.map((layer) => ({
              ...layer,
              status: task ? 'queued' : 'export-pending',
            })),
          };
        });
        setError(null);

        if (task) {
          void MessagePlugin.success(
            uiLanguage === 'zh'
              ? '已开始生成 PSD-ready 图片（1 个 GPT Image 编辑任务）'
              : 'Started PSD-ready generation (1 GPT Image edit task)'
          );
        } else {
          setError(
            uiLanguage === 'zh'
              ? 'PSD-ready 任务创建失败，请检查输入后重试。'
              : 'Failed to create the PSD-ready task. Check the input and try again.'
          );
        }
      } catch (err) {
        console.error('Failed to create PSD-ready task:', err);
        setError(
          uiLanguage === 'zh'
            ? 'PSD-ready 任务创建失败，请检查参考图后重试。'
            : 'Failed to create the PSD-ready task. Check the reference image and try again.'
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
          ? '请先上传原始海报/参考图，然后生成 PSD-ready 结果。'
          : 'Upload a source poster/reference image before generating a PSD-ready result.'
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

  const generatedLayerCount = plan ? 1 : 0;
  const psdTasks = useMemo(() => {
    if (!plan || (!psdTaskIds.length && !psdBatchId)) {
      return [];
    }

    const psdTaskIdSet = new Set(psdTaskIds);
    return tasks.filter((task) => {
      if (psdTaskIdSet.has(task.id)) return true;
      return Boolean(psdBatchId && getTaskBatchId(task) === psdBatchId);
    });
  }, [plan, psdBatchId, psdTaskIds, tasks]);
  const expectedPsdTaskTotal =
    psdTaskIds.length || generatedLayerCount || plan?.layers.length || 0;
  const psdTaskStats = useMemo(
    () => buildPsdTaskStats(psdTasks, expectedPsdTaskTotal, uiLanguage),
    [expectedPsdTaskTotal, psdTasks, uiLanguage]
  );

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
            isGenerating={isQueuingLayerTasks || psdTaskStats.isActive}
            hasGenerated={false}
            canGenerate={!!prompt.trim() && uploadedImages.length > 0}
            onGenerate={handlePrimaryAction}
            onReset={handleReset}
            showQuantity={false}
            generateLabel={
              uiLanguage === 'zh'
                ? '生成 PSD-ready 结果'
                : 'Generate PSD-ready result'
            }
            showReset={false}
          />

          {plan ? (
            <div
              className={`psd-generation-status psd-generation-status--${psdTaskStats.tone}`}
              role="status"
            >
              <strong>{psdTaskStats.title}</strong>
              <span className="psd-generation-status__counts">
                {psdTaskStats.countSummary}
              </span>
              <span>{psdTaskStats.detail}</span>
              <div
                className="psd-generation-status__progress"
                aria-label={
                  uiLanguage === 'zh'
                    ? 'PSD-ready 任务进度'
                    : 'PSD-ready task progress'
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={psdTaskStats.progressPercent}
                role="progressbar"
              >
                <span style={{ width: `${psdTaskStats.progressPercent}%` }} />
              </div>
              <small>
                {uiLanguage === 'zh'
                  ? '当前流程会生成 1 张 PSD-ready 图片和 Photoshop/PSD 元数据，不会把图片结果伪装成原生 .psd。'
                  : 'This flow generates one PSD-ready image plus Photoshop/PSD metadata; it does not pretend the image result is a native .psd.'}
              </small>
            </div>
          ) : null}

          <details className="psd-capability-disclosure">
            <summary>{uiLanguage === 'zh' ? '说明' : 'Note'}</summary>
            <p>
              {uiLanguage === 'zh'
                ? '系统会自动处理生成设置；公开 GPT Image API 当前返回图片数据而不是原生 .psd，Opentu 先生成 1 张 PSD-ready 图片和拆层元数据，并把真正 Photoshop/PSD 打包作为后续本地或服务端导出能力。'
                : 'Opentu handles generation settings automatically; the public GPT Image API currently returns image data rather than a native .psd, so Opentu generates one PSD-ready image plus layer metadata and leaves true Photoshop/PSD packaging for a later local or server export step.'}
            </p>
          </details>

          <ErrorDisplay error={error} />
        </section>
      </div>
    </div>
  );
};

export default AIImagePsdGeneration;
