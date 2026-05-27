import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ttd-dialog.scss';
import './ai-image-generation.scss';
import './ai-psd-generation.scss';
import './ai-psd-workflow-view.scss';
import './ai-psd-workflow-panels.scss';
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
  TaskType,
  type KnowledgeContextRef,
  type Task,
} from '../../types/task.types';
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_TEXT_MODEL_ID,
} from '../../constants/model-config';
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
  buildLayerPlanFromAnalysis,
  buildPsdLayerImageTaskPlans,
  buildPsdLayerAnalysisTaskPlan,
  buildLayerPlan,
  getDefaultPsdLayerExtractionPrompt,
  parsePsdLayerAnalysisResponse,
  type PsdLayerStrategy,
  type PsdGenerationPlan,
  type PsdTemplate,
} from './ai-psd-plan';
import {
  PsdWorkflowView,
  type PsdAnalysisStatus,
} from './ai-psd-workflow-view';
import {
  PSD_WORKFLOW_STEPS,
  buildPsdTaskStats,
  downloadPsdReadyWorkspacePackage,
  getTaskBatchId,
  getTaskResultUrls,
  normalizePsdLayerTransparency,
} from './ai-psd-generation-workflow';

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
  const textModels = useSelectableModels('text');
  const forcedPsdModelRef = createModelRef(
    initialRoute.profileId,
    DEFAULT_IMAGE_MODEL_ID
  );
  const initialTextRoute = resolveInvocationRoute('text', DEFAULT_TEXT_MODEL_ID);
  const forcedAnalysisModelRef = createModelRef(
    initialTextRoute.profileId,
    DEFAULT_TEXT_MODEL_ID
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
  const initialAnalysisMatchedModel =
    findMatchingSelectableModel(
      textModels,
      DEFAULT_TEXT_MODEL_ID,
      forcedAnalysisModelRef
    ) || getPinnedSelectableModel('text', DEFAULT_TEXT_MODEL_ID, null);
  const analysisModel = initialAnalysisMatchedModel?.id || DEFAULT_TEXT_MODEL_ID;
  const analysisModelRef =
    getModelRefFromConfig(initialAnalysisMatchedModel) ||
    forcedAnalysisModelRef;

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
  const [plan, setPlan] = useState<PsdGenerationPlan | null>(null);
  const [psdTaskIds, setPsdTaskIds] = useState<string[]>([]);
  const [psdBatchId, setPsdBatchId] = useState<string | null>(null);
  const [analysisTaskId, setAnalysisTaskId] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [isCreatingAnalysisTask, setIsCreatingAnalysisTask] = useState(false);
  const [isQueuingLayerTasks, setIsQueuingLayerTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processedAnalysisTaskIdRef = useRef<string | null>(null);
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
    setAnalysisTaskId(null);
    setAnalysisMessage(null);
    processedAnalysisTaskIdRef.current = null;
    setError(null);
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
    async (planOverride?: PsdGenerationPlan) => {
      const targetPlan = planOverride || plan;
      if (!targetPlan || isQueuingLayerTasks) return;

      if (uploadedImages.length === 0) {
        setError(
          uiLanguage === 'zh'
            ? '请先上传原始海报或参考图，再生成 PSD 工作区。'
            : 'Upload the source poster or reference image before generating a PSD workspace.'
        );
        return;
      }

      setIsQueuingLayerTasks(true);
      try {
        const serializableImages = await convertUploadedImagesToSerializable();
        const taskPlans = buildPsdLayerImageTaskPlans(targetPlan, {
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
        const nextBatchId = taskPlans[0]?.params.batchId as string | undefined;
        const createdTasks = taskPlans
          .map((taskPlan) => createTask(taskPlan.params, taskPlan.taskType))
          .filter((task): task is Task => Boolean(task));
        const queuedLayerIds = new Set(
          taskPlans.map((taskPlan) => taskPlan.layerId)
        );

        setPsdTaskIds(createdTasks.map((task) => task.id));
        setPsdBatchId(nextBatchId || null);
        setPlan((current) => {
          const basePlan = current || targetPlan;
          return {
            ...basePlan,
            layers: basePlan.layers.map((layer) => ({
              ...layer,
              status:
                createdTasks.length > 0 && queuedLayerIds.has(layer.id)
                  ? 'queued'
                  : 'export-pending',
            })),
          };
        });
        setError(null);

        if (createdTasks.length > 0) {
          void MessagePlugin.success(
            uiLanguage === 'zh'
              ? `已开始生成同画布透明图层（${createdTasks.length} 个图片编辑任务）`
              : `Started same-canvas transparent layer generation (${createdTasks.length} image edit tasks)`
          );
        } else {
          setError(
            uiLanguage === 'zh'
              ? '同画布图层任务创建失败，请检查输入后重试。'
              : 'Failed to create same-canvas layer tasks. Check the input and try again.'
          );
        }
      } catch (err) {
        console.error('Failed to create PSD layer tasks:', err);
        setError(
          uiLanguage === 'zh'
            ? '同画布图层任务创建失败，请检查参考图后重试。'
            : 'Failed to create same-canvas layer tasks. Check the reference image and try again.'
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

  const handlePrimaryAction = useCallback(async () => {
    if (uploadedImages.length === 0) {
      setError(
        uiLanguage === 'zh'
          ? '请先上传原始海报/参考图，然后生成 PSD 工作区。'
          : 'Upload a source poster/reference image before generating a PSD workspace.'
      );
      return;
    }

    if (!prompt.trim()) {
      setError(
        uiLanguage === 'zh'
          ? '请输入 PSD 分层与导出需求'
          : 'Please enter the PSD layer/export requirements'
      );
      return;
    }

    setIsCreatingAnalysisTask(true);
    setError(null);
    setPlan(null);
    setPsdTaskIds([]);
    setPsdBatchId(null);
    setAnalysisTaskId(null);
    processedAnalysisTaskIdRef.current = null;

    try {
      const serializableImages = await convertUploadedImagesToSerializable();
      const taskPlan = buildPsdLayerAnalysisTaskPlan({
        prompt,
        template,
        strategy,
        language: uiLanguage,
        model: analysisModel,
        modelRef: analysisModelRef,
        uploadedImages: serializableImages,
        knowledgeContextRefs,
      });
      const task = createTask(taskPlan.params, taskPlan.taskType);
      if (!task) {
        throw new Error('Failed to create PSD layer analysis task');
      }

      setAnalysisTaskId(task.id);
      setAnalysisMessage(
        uiLanguage === 'zh'
          ? `${analysisModel} 正在分析图层`
          : `${analysisModel} is analyzing layers`
      );
      savePromptToHistoryUtil('image', prompt.trim(), {
        width: 1024,
        height: 1024,
      });
      void MessagePlugin.success(
        uiLanguage === 'zh'
          ? '已提交 gpt-5.5 高思考图层分析'
          : 'Submitted gpt-5.5 high-reasoning layer analysis'
      );
    } catch (err) {
      console.error('Failed to create PSD layer analysis task:', err);
      setError(
        uiLanguage === 'zh'
          ? 'PSD 图层分析任务创建失败，请检查原图和模型配置后重试。'
          : 'Failed to create the PSD layer analysis task. Check the source image and model settings, then retry.'
      );
      setAnalysisMessage(null);
    } finally {
      setIsCreatingAnalysisTask(false);
    }
  }, [
    analysisModel,
    analysisModelRef,
    convertUploadedImagesToSerializable,
    createTask,
    knowledgeContextRefs,
    prompt,
    strategy,
    template,
    uiLanguage,
    uploadedImages.length,
  ]);

  const analysisTask = useMemo(
    () => tasks.find((task) => task.id === analysisTaskId) || null,
    [analysisTaskId, tasks]
  );

  const isAnalysisActive =
    isCreatingAnalysisTask ||
    analysisTask?.status === TaskStatus.PENDING ||
    analysisTask?.status === TaskStatus.PROCESSING;

  useEffect(() => {
    if (!analysisTaskId || !analysisTask) return;
    if (processedAnalysisTaskIdRef.current === analysisTaskId) return;

    if (analysisTask.status === TaskStatus.COMPLETED) {
      processedAnalysisTaskIdRef.current = analysisTaskId;
      try {
        const rawAnalysis =
          analysisTask.result?.analysisData || analysisTask.result?.chatResponse;
        const analysis = parsePsdLayerAnalysisResponse(rawAnalysis, uiLanguage);
        const nextPlan = buildLayerPlanFromAnalysis(analysis, {
          prompt,
          template,
          strategy,
          language: uiLanguage,
          textPolicy: {
            preferEditableText,
            avoidBakedText,
          },
          analysisModel,
        });
        setPlan(nextPlan);
        setAnalysisMessage(
          uiLanguage === 'zh'
            ? `${analysisModel} 已完成分析：${nextPlan.layers.length} 个动态图层`
            : `${analysisModel} analysis complete: ${nextPlan.layers.length} dynamic layers`
        );
        void handleGenerateLayerAssets(nextPlan);
      } catch (err) {
        console.error('Failed to parse PSD layer analysis:', err);
        setError(
          uiLanguage === 'zh'
            ? 'gpt-5.5 图层分析结果无法解析，已停止生成以避免错误拆层。请在任务队列查看原始响应后重试。'
            : 'The gpt-5.5 layer analysis could not be parsed, so generation was stopped to avoid incorrect layers. Check the task queue response and retry.'
        );
        setAnalysisMessage(
          uiLanguage === 'zh'
            ? '图层分析解析失败'
            : 'Layer analysis parsing failed'
        );
      }
      return;
    }

    if (
      analysisTask.status === TaskStatus.FAILED ||
      analysisTask.status === TaskStatus.CANCELLED
    ) {
      processedAnalysisTaskIdRef.current = analysisTaskId;
      setError(
        uiLanguage === 'zh'
          ? 'gpt-5.5 图层分析失败，未继续生成固定模板图层。请检查模型配置或任务队列错误后重试。'
          : 'The gpt-5.5 layer analysis failed, and no fixed-template layers were generated. Check model settings or task queue errors, then retry.'
      );
      setAnalysisMessage(
        uiLanguage === 'zh' ? '图层分析失败' : 'Layer analysis failed'
      );
    }
  }, [
    analysisModel,
    analysisTask,
    analysisTaskId,
    avoidBakedText,
    handleGenerateLayerAssets,
    preferEditableText,
    prompt,
    strategy,
    template,
    uiLanguage,
  ]);

  const generatedLayerCount =
    plan?.layers.filter((layer) => layer.visible && layer.type !== 'adjustment')
      .length || 0;
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
  const completedPsdTasks = useMemo(
    () =>
      psdTasks.filter(
        (task) =>
          task.status === TaskStatus.COMPLETED &&
          getTaskResultUrls(task).length > 0
      ),
    [psdTasks]
  );
  const completedPsdTask = useMemo(
    () =>
      completedPsdTasks.find(
        (task) => task.params?.psdPlan?.layerId === 'psd-ready-composite'
      ) || completedPsdTasks[0],
    [completedPsdTasks]
  );
  const completedPsdResultUrls = useMemo(
    () => completedPsdTasks.flatMap((task) => getTaskResultUrls(task)),
    [completedPsdTasks]
  );
  const completedPsdPreviewUrl = useMemo(() => {
    const compositeTask = completedPsdTasks.find(
      (task) => task.params?.psdPlan?.layerId === 'psd-ready-composite'
    );
    return getTaskResultUrls(compositeTask)[0];
  }, [completedPsdTasks]);
  const layerPreviewUrls = useMemo(() => {
    const entries: Record<string, string[]> = {};
    for (const task of completedPsdTasks) {
      const layerId = task.params?.psdPlan?.layerId;
      if (!layerId || layerId === 'psd-ready-composite') continue;
      const urls = getTaskResultUrls(task);
      if (urls.length > 0) {
        entries[layerId] = urls;
      }
    }
    return entries;
  }, [completedPsdTasks]);
  const [displayLayerPreviewUrls, setDisplayLayerPreviewUrls] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    let cancelled = false;
    setDisplayLayerPreviewUrls(layerPreviewUrls);

    const normalizeLayerPreviews = async () => {
      if (!plan || Object.keys(layerPreviewUrls).length === 0) return;

      const layerTypeById = new Map(
        plan.layers.map((layer) => [layer.id, layer.type])
      );
      const normalizedEntries = await Promise.all(
        Object.entries(layerPreviewUrls).map(async ([layerId, urls]) => {
          const layerType = layerTypeById.get(layerId);
          const normalizedUrls = await Promise.all(
            urls.map(async (url) => {
              const result = await normalizePsdLayerTransparency(url, {
                layerType,
              });
              return result.url;
            })
          );
          return [layerId, normalizedUrls] as const;
        })
      );

      if (!cancelled) {
        setDisplayLayerPreviewUrls(Object.fromEntries(normalizedEntries));
      }
    };

    void normalizeLayerPreviews();

    return () => {
      cancelled = true;
    };
  }, [layerPreviewUrls, plan]);
  const layerPreviewUrlsForDisplay =
    Object.keys(layerPreviewUrls).length > 0 &&
    Object.keys(displayLayerPreviewUrls).length > 0
      ? displayLayerPreviewUrls
      : layerPreviewUrls;

  const analysisStatus = useMemo<PsdAnalysisStatus | null>(() => {
    if (!analysisTaskId && !isCreatingAnalysisTask && !analysisMessage) {
      return null;
    }

    const state: PsdAnalysisStatus['state'] =
      analysisTask?.status === TaskStatus.COMPLETED
        ? 'completed'
        : analysisTask?.status === TaskStatus.FAILED ||
          analysisTask?.status === TaskStatus.CANCELLED
        ? 'failed'
        : isAnalysisActive
        ? 'processing'
        : 'queued';

    return {
      state,
      model: analysisModel,
      title:
        analysisMessage ||
        (uiLanguage === 'zh'
          ? `${analysisModel} 正在分析图层`
          : `${analysisModel} is analyzing layers`),
      detail:
        uiLanguage === 'zh'
          ? '先理解原图真实视觉元素，产出互斥图层 JSON，再生成同画布透明图层。'
          : 'The model first reads the real visual elements, returns mutually exclusive layer JSON, then generates same-canvas transparent layers.',
    };
  }, [
    analysisMessage,
    analysisModel,
    analysisTask?.status,
    analysisTaskId,
    isAnalysisActive,
    isCreatingAnalysisTask,
    uiLanguage,
  ]);

  const handleDownloadPsdReadyResult = useCallback(async () => {
    if (!completedPsdTask) return;

    if (completedPsdResultUrls.length === 0) {
      setError(
        uiLanguage === 'zh'
          ? '当前任务没有可打包的 PSD-ready 结果。'
          : 'This task has no PSD-ready result to package.'
      );
      return;
    }

    try {
      const result = await downloadPsdReadyWorkspacePackage({
        task: completedPsdTask,
        tasks: completedPsdTasks,
        plan,
        prompt,
        referenceImages: uploadedImages,
        uiLanguage,
      });
      void MessagePlugin.success(
        uiLanguage === 'zh'
          ? result.linkedAssetCount > 0
            ? `PSD-ready 资产包已下载，${result.linkedAssetCount} 个跨域资源已记录为链接`
            : 'PSD-ready 资产包已下载'
          : result.linkedAssetCount > 0
          ? `PSD-ready package downloaded; ${result.linkedAssetCount} cross-origin assets were linked`
          : 'PSD-ready package downloaded'
      );
    } catch (err) {
      console.error('Failed to download PSD-ready result:', err);
      setError(
        uiLanguage === 'zh'
          ? 'PSD-ready 资产包打包失败，请先打开原图保存，或稍后重试。'
          : 'Failed to package the PSD-ready workspace. Open the image directly or try again.'
      );
    }
  }, [
    completedPsdResultUrls.length,
    completedPsdTask,
    completedPsdTasks,
    plan,
    prompt,
    uiLanguage,
    uploadedImages,
  ]);

  const inputPanel = (
    <section className="psd-gpt-composer" aria-label="PSD composer">
      <ReferenceImageUpload
        images={uploadedImages}
        onImagesChange={setUploadedImages}
        language={language}
        disabled={isCreatingAnalysisTask || isQueuingLayerTasks}
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
        disabled={isCreatingAnalysisTask || isQueuingLayerTasks}
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
        isGenerating={
          isCreatingAnalysisTask ||
          isAnalysisActive ||
          isQueuingLayerTasks ||
          psdTaskStats.isActive
        }
        hasGenerated={false}
        canGenerate={
          !!prompt.trim() &&
          uploadedImages.length > 0 &&
          !isCreatingAnalysisTask &&
          !isAnalysisActive &&
          !isQueuingLayerTasks
        }
        onGenerate={handlePrimaryAction}
        onReset={handleReset}
        showQuantity={false}
        generateLabel={
          uiLanguage === 'zh'
            ? '生成 PSD 工作区'
            : 'Generate PSD workspace'
        }
        showReset={false}
      />

      <details className="psd-capability-disclosure">
        <summary>{uiLanguage === 'zh' ? '能力边界' : 'Capability boundary'}</summary>
        <p>
          {uiLanguage === 'zh'
            ? 'Opentu 会自动处理生成设置；当前图片接口返回 png/jpeg/webp 图片数据而不是原生 .psd。这里提供可打包的 PSD 工作区包，真正 Photoshop PSD 写入可作为后续本地或服务端打包器接入。'
            : 'Opentu handles generation settings automatically; the current image endpoint returns png/jpeg/webp image data rather than a native .psd. This tool provides a packable PSD workspace, while true Photoshop PSD writing can be added later through a local or server packer.'}
        </p>
      </details>
    </section>
  );

  return (
    <div className="ai-psd-generation-container ai-image-generation-container ai-psd-generation-container--workbench">
      <PsdWorkflowView
        uiLanguage={uiLanguage}
        inputPanel={inputPanel}
        plan={plan}
        analysisStatus={analysisStatus}
        status={plan ? psdTaskStats : null}
        sourceImages={uploadedImages}
        previewUrl={completedPsdPreviewUrl}
        layerPreviewUrls={layerPreviewUrlsForDisplay}
        resultCount={completedPsdResultUrls.length}
        canDownload={!!completedPsdTask && completedPsdResultUrls.length > 0}
        onDownload={handleDownloadPsdReadyResult}
        errorPanel={<ErrorDisplay error={error} />}
      />
    </div>
  );
};

export default AIImagePsdGeneration;
