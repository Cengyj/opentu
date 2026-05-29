import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './ttd-dialog.scss';
import './ai-image-generation.scss';
import './psd-workbench/psd-workbench.scss';
import { MessagePlugin } from 'tdesign-react';
import { useI18n } from '../../i18n';
import { useTaskQueue } from '../../hooks/useTaskQueue';
import { useSelectableModels } from '../../hooks/use-runtime-models';
import {
  ErrorDisplay,
  savePromptToHistory as savePromptToHistoryUtil,
  type ReferenceImage,
} from './shared';
import {
  TaskStatus,
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
  type PsdLayerType,
  type PsdTemplate,
} from './ai-psd-plan';
import {
  buildPsdLayerTaskStateMap,
  getPsdLayerIdsNeedingGeneration,
  getRetryablePsdLayerIds,
} from './psd-workbench/psd-layer-tasks';
import { usePsdWorkbench } from './psd-workbench/usePsdWorkbench';
import {
  PsdWorkbenchView,
  type PsdAnalysisStatus,
} from './psd-workbench/PsdWorkbenchView';
import { PsdHistoryDrawer } from './psd-workbench/PsdHistoryDrawer';
import {
  derivePsdHistoryStatus,
  psdHistoryService,
} from '../../services/psd-history/psd-history-service';
import type { PsdHistoryEntry } from '../../services/psd-history/psd-history-types';
import {
  buildPsdTaskStats,
  getTaskBatchId,
  getTaskResultUrls,
} from './ai-psd-generation-workflow';
import {
  downloadPsdReadyWorkspacePackage,
  normalizePsdLayerTransparency,
} from './psd-workbench/psd-workspace-package';

// 持久化「分析后自动生成图层」偏好（与素材库/任务无关，纯 UI 偏好）
const PSD_AUTO_GENERATE_STORAGE_KEY = 'aitu:psd:auto-generate-after-analysis';

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
  const initialTextRoute = resolveInvocationRoute(
    'text',
    DEFAULT_TEXT_MODEL_ID
  );
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
  const analysisModel =
    initialAnalysisMatchedModel?.id || DEFAULT_TEXT_MODEL_ID;
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
  const [psdTaskIds, setPsdTaskIds] = useState<string[]>([]);
  const [psdBatchId, setPsdBatchId] = useState<string | null>(null);
  const [analysisTaskId, setAnalysisTaskId] = useState<string | null>(null);
  const {
    plan,
    setPlan,
    reset: resetPsdWorkbench,
    updateLayerName,
    updateLayerPrompt,
    updateLayerVisibility,
    updateLayerStatuses,
  } = usePsdWorkbench({
    prompt,
    sourceImage: uploadedImages[0] || null,
    analysisTaskId,
    assetBatchId: psdBatchId,
  });
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [isCreatingAnalysisTask, setIsCreatingAnalysisTask] = useState(false);
  const [isQueuingLayerTasks, setIsQueuingLayerTasks] = useState(false);
  const [isDownloadingPsdReady, setIsDownloadingPsdReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [autoGenerateAfterAnalysis, setAutoGenerateAfterAnalysis] = useState(
    () => {
      try {
        return (
          localStorage.getItem(PSD_AUTO_GENERATE_STORAGE_KEY) === 'true'
        );
      } catch {
        return false;
      }
    }
  );
  const handleAutoGenerateAfterAnalysisChange = useCallback(
    (enabled: boolean) => {
      setAutoGenerateAfterAnalysis(enabled);
      try {
        localStorage.setItem(
          PSD_AUTO_GENERATE_STORAGE_KEY,
          String(enabled)
        );
      } catch {
        // localStorage unavailable — keep in-memory only
      }
    },
    []
  );
  const processedAnalysisTaskIdRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const autoGeneratedRef = useRef(false);
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

  const analysisTask = useMemo(
    () => tasks.find((task) => task.id === analysisTaskId) || null,
    [analysisTaskId, tasks]
  );

  const isAnalysisActive =
    isCreatingAnalysisTask ||
    analysisTask?.status === TaskStatus.PENDING ||
    analysisTask?.status === TaskStatus.PROCESSING;
  const hasCompletedLayerAnalysis = Boolean(
    analysisTaskId &&
      processedAnalysisTaskIdRef.current === analysisTaskId &&
      !isAnalysisActive
  );

  const handleGenerateLayerAssets = useCallback(
    async (options: { layerIds?: string[]; force?: boolean } = {}) => {
      const targetPlan = plan;
      if (!targetPlan || isQueuingLayerTasks) return;

      if (!hasCompletedLayerAnalysis) {
        setError(
          uiLanguage === 'zh'
            ? '请先完成图层分析并审阅计划，再生成图层素材。'
            : 'Complete the layer analysis and review the plan before generating layer assets.'
        );
        return;
      }

      if (uploadedImages.length === 0) {
        setError(
          uiLanguage === 'zh'
            ? '请先上传原始海报或参考图，再生成 PSD 工作区。'
            : 'Upload the source poster or reference image before generating a PSD workspace.'
        );
        return;
      }

      const psdTaskIdSet = new Set(psdTaskIds);
      const currentPsdTasks = tasks.filter((task) => {
        if (psdTaskIdSet.has(task.id)) return true;
        return Boolean(psdBatchId && getTaskBatchId(task) === psdBatchId);
      });
      const currentLayerTaskStateMap = buildPsdLayerTaskStateMap(
        targetPlan.layers,
        currentPsdTasks
      );
      const targetLayerIds =
        options.layerIds && options.layerIds.length > 0
          ? options.layerIds
          : getPsdLayerIdsNeedingGeneration(
              targetPlan.layers,
              currentLayerTaskStateMap
            );

      if (targetLayerIds.length === 0) {
        setError(
          uiLanguage === 'zh'
            ? '当前没有需要生成或重试的图层。'
            : 'There are no layers to generate or retry.'
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
          layerIds: targetLayerIds,
        });
        const baseBatchId = taskPlans[0]?.params.batchId as string | undefined;
        const nextBatchId = baseBatchId ? `${baseBatchId}-${Date.now()}` : null;
        const taskPlansForRun = taskPlans.map((taskPlan) => ({
          ...taskPlan,
          params: {
            ...taskPlan.params,
            ...(nextBatchId ? { batchId: nextBatchId } : {}),
          },
        }));
        const createdTasks = taskPlansForRun
          .map((taskPlan) => createTask(taskPlan.params, taskPlan.taskType))
          .filter((task): task is Task => Boolean(task));
        const queuedLayerIds = new Set(
          taskPlansForRun.map((taskPlan) => taskPlan.layerId)
        );

        setPsdTaskIds((currentTaskIds) =>
          Array.from(
            new Set([...currentTaskIds, ...createdTasks.map((task) => task.id)])
          )
        );
        setPsdBatchId(nextBatchId);
        updateLayerStatuses(Array.from(queuedLayerIds), 'queued');
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
      hasCompletedLayerAnalysis,
      isQueuingLayerTasks,
      knowledgeContextRefs,
      plan,
      psdBatchId,
      psdTaskIds,
      selectedParams,
      tasks,
      updateLayerStatuses,
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
    resetPsdWorkbench();
    setPsdTaskIds([]);
    setPsdBatchId(null);
    setAnalysisTaskId(null);
    processedAnalysisTaskIdRef.current = null;
    currentSessionIdRef.current = null;
    autoGeneratedRef.current = false;

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
    resetPsdWorkbench,
    strategy,
    template,
    uiLanguage,
    uploadedImages.length,
  ]);

  useEffect(() => {
    if (!analysisTaskId || !analysisTask) return;
    if (processedAnalysisTaskIdRef.current === analysisTaskId) return;

    if (analysisTask.status === TaskStatus.COMPLETED) {
      processedAnalysisTaskIdRef.current = analysisTaskId;
      try {
        const rawAnalysis =
          analysisTask.result?.analysisData ||
          analysisTask.result?.chatResponse;
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
        setPlan(nextPlan, {
          prompt,
          sourceImage: uploadedImages[0] || null,
          analysisTaskId,
          assetBatchId: psdBatchId,
        });
        setAnalysisMessage(
          uiLanguage === 'zh'
            ? `${analysisModel} 已完成分析：${nextPlan.layers.length} 个动态图层，请检查后生成图层素材`
            : `${analysisModel} analysis complete: ${nextPlan.layers.length} dynamic layers. Review before generating assets`
        );
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
    preferEditableText,
    prompt,
    psdBatchId,
    setPlan,
    strategy,
    template,
    uiLanguage,
    uploadedImages,
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
  const layerTaskStateMap = useMemo(
    () => (plan ? buildPsdLayerTaskStateMap(plan.layers, psdTasks) : {}),
    [plan, psdTasks]
  );
  const retryablePsdLayerIds = useMemo(() => {
    const visibleLayerIds = new Set(
      (plan?.layers || [])
        .filter((layer) => layer.visible && layer.type !== 'adjustment')
        .map((layer) => layer.id)
    );
    return getRetryablePsdLayerIds(layerTaskStateMap).filter((layerId) =>
      visibleLayerIds.has(layerId)
    );
  }, [layerTaskStateMap, plan?.layers]);
  const canGenerateLayerAssets = useMemo(
    () =>
      Boolean(
        plan &&
          !isQueuingLayerTasks &&
          getPsdLayerIdsNeedingGeneration(plan.layers, layerTaskStateMap)
            .length > 0
      ),
    [isQueuingLayerTasks, layerTaskStateMap, plan]
  );
  const expectedPsdTaskTotal =
    psdTaskIds.length > 0 || psdTasks.length > 0
      ? psdTaskIds.length || generatedLayerCount || plan?.layers.length || 0
      : 0;
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
    for (const [layerId, state] of Object.entries(layerTaskStateMap)) {
      if (state.status === 'ready' && state.resultUrls.length > 0) {
        entries[layerId] = state.resultUrls;
      }
    }
    return entries;
  }, [layerTaskStateMap]);
  const [displayLayerPreviewUrls, setDisplayLayerPreviewUrls] = useState<
    Record<string, string[]>
  >({});

  // Stable id:type signature so normalization only re-runs when results or a
  // layer's type actually change — not on unrelated plan edits like toggling
  // visibility, which would otherwise flash the raw (un-normalized) images.
  const layerTypeSignature = useMemo(
    () => (plan?.layers ?? []).map((layer) => `${layer.id}:${layer.type}`).join('|'),
    [plan?.layers]
  );
  // 仅当结果 URL 的「内容」变化时才重新归一化。layerPreviewUrls 在切换显隐时会
  // 因 layerTaskStateMap 重建而产生新引用（内容不变），用内容签名 + ref 避免
  // 把已归一化的图层重置回原图导致闪烁。
  const layerPreviewUrlsRef = useRef(layerPreviewUrls);
  layerPreviewUrlsRef.current = layerPreviewUrls;
  const layerPreviewSignature = useMemo(
    () => JSON.stringify(layerPreviewUrls),
    [layerPreviewUrls]
  );

  useEffect(() => {
    let cancelled = false;
    const currentLayerPreviewUrls = layerPreviewUrlsRef.current;
    setDisplayLayerPreviewUrls(currentLayerPreviewUrls);

    const normalizeLayerPreviews = async () => {
      if (Object.keys(currentLayerPreviewUrls).length === 0) return;

      const layerTypeById = new Map<string, PsdLayerType>(
        layerTypeSignature
          .split('|')
          .filter(Boolean)
          .map((pair) => {
            const separatorIndex = pair.lastIndexOf(':');
            return [
              pair.slice(0, separatorIndex),
              pair.slice(separatorIndex + 1) as PsdLayerType,
            ] as const;
          })
      );
      const normalizedEntries = await Promise.all(
        Object.entries(currentLayerPreviewUrls).map(async ([layerId, urls]) => {
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
  }, [layerPreviewSignature, layerTypeSignature]);
  const layerPreviewUrlsForDisplay =
    Object.keys(layerPreviewUrls).length > 0 &&
    Object.keys(displayLayerPreviewUrls).length > 0
      ? displayLayerPreviewUrls
      : layerPreviewUrls;

  // 把当前 PSD 会话（含进行中）快照进 PSD 历史。
  const sourceImageUrl = uploadedImages[0]?.url;
  const sourceImageName = uploadedImages[0]?.name;
  // 稳定的写入器：每次渲染重绑最新闭包（用 ref 持有，不触发 effect 重跑）。
  const persistSessionSnapshotRef = useRef<(() => void) | null>(null);
  persistSessionSnapshotRef.current = () => {
    if (!plan) return;
    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = `${plan.planId}-${Date.now()}`;
    }
    const states = Object.values(layerTaskStateMap);
    const hasTasks =
      psdTaskIds.length > 0 ||
      states.some(
        (state) => state.status !== 'planned' && state.status !== 'skipped'
      );
    const status = derivePsdHistoryStatus(states, hasTasks);
    const layerResults: Record<string, string[]> = {};
    for (const [layerId, state] of Object.entries(layerTaskStateMap)) {
      if (state.status === 'ready' && state.resultUrls.length > 0) {
        layerResults[layerId] = state.resultUrls;
      }
    }
    void psdHistoryService.upsertEntry({
      id: currentSessionIdRef.current,
      status,
      title: (prompt.trim() || plan.title || 'PSD').slice(0, 24),
      prompt,
      sourceImage: sourceImageUrl
        ? { url: sourceImageUrl, name: sourceImageName }
        : null,
      plan,
      planId: plan.planId,
      psdBatchId,
      analysisTaskId,
      taskIds: psdTaskIds,
      layerResults,
    });
  };

  // 立即落库：会话出现（计划就绪）或进入生成（批次产生）时马上写入，
  // 即使用户随后立刻切走/卸载组件，历史也已持久化。
  useEffect(() => {
    if (plan) persistSessionSnapshotRef.current?.();
  }, [plan, psdBatchId]);

  // 去抖更新：任务状态/结果推进时刷新快照（避免高频写入）。
  useEffect(() => {
    if (!plan) return undefined;
    const timer = setTimeout(() => persistSessionSnapshotRef.current?.(), 500);
    return () => clearTimeout(timer);
  }, [plan, layerTaskStateMap]);

  // 勾选「分析后自动生成图层」时，分析完成且计划就绪后自动触发一次素材生成。
  // ref 守卫确保每个会话只自动触发一次；恢复历史会话已预置为 true 不会触发。
  useEffect(() => {
    if (
      autoGenerateAfterAnalysis &&
      !autoGeneratedRef.current &&
      plan &&
      hasCompletedLayerAnalysis &&
      canGenerateLayerAssets &&
      !isQueuingLayerTasks &&
      psdTaskIds.length === 0
    ) {
      autoGeneratedRef.current = true;
      void handleGenerateLayerAssets();
    }
  }, [
    autoGenerateAfterAnalysis,
    plan,
    hasCompletedLayerAnalysis,
    canGenerateLayerAssets,
    isQueuingLayerTasks,
    psdTaskIds.length,
    handleGenerateLayerAssets,
  ]);

  const handleNew = useCallback(() => {
    setError(null);
    setAnalysisMessage(null);
    setPrompt(defaultPsdPrompt);
    setUploadedImages([]);
    resetPsdWorkbench();
    setPsdTaskIds([]);
    setPsdBatchId(null);
    setAnalysisTaskId(null);
    processedAnalysisTaskIdRef.current = null;
    currentSessionIdRef.current = null;
    autoGeneratedRef.current = false;
  }, [defaultPsdPrompt, resetPsdWorkbench]);

  const handleRestoreHistory = useCallback(
    (entry: PsdHistoryEntry) => {
      currentSessionIdRef.current = entry.id;
      // 恢复历史会话不触发自动生成
      autoGeneratedRef.current = true;
      setError(null);
      setPrompt(entry.prompt);
      const restoredSource = entry.sourceImage
        ? {
            url: entry.sourceImage.url,
            name: entry.sourceImage.name || 'source',
          }
        : null;
      setUploadedImages(restoredSource ? [restoredSource] : []);
      setPsdTaskIds(entry.taskIds);
      setPsdBatchId(entry.psdBatchId);
      setAnalysisTaskId(entry.analysisTaskId);
      if (entry.analysisTaskId) {
        processedAnalysisTaskIdRef.current = entry.analysisTaskId;
      }
      setPlan(entry.plan, {
        prompt: entry.prompt,
        sourceImage: restoredSource,
        analysisTaskId: entry.analysisTaskId,
        assetBatchId: entry.psdBatchId,
      });
      setIsHistoryOpen(false);
    },
    [setPlan]
  );

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
    if (!completedPsdTask || isDownloadingPsdReady) return;

    if (completedPsdResultUrls.length === 0) {
      setError(
        uiLanguage === 'zh'
          ? '当前任务没有可打包的 PSD-ready 结果。'
          : 'This task has no PSD-ready result to package.'
      );
      return;
    }

    setIsDownloadingPsdReady(true);
    try {
      const result = await downloadPsdReadyWorkspacePackage({
        task: completedPsdTask,
        tasks: psdTasks,
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
    } finally {
      setIsDownloadingPsdReady(false);
    }
  }, [
    completedPsdResultUrls.length,
    completedPsdTask,
    isDownloadingPsdReady,
    plan,
    prompt,
    psdTasks,
    uiLanguage,
    uploadedImages,
  ]);

  return (
    <div className="ai-psd-generation-container ai-image-generation-container ai-psd-generation-container--workbench">
      <PsdWorkbenchView
        uiLanguage={uiLanguage}
        prompt={prompt}
        defaultPrompt={defaultPsdPrompt}
        isComposerDisabled={isCreatingAnalysisTask || isQueuingLayerTasks}
        primaryActionLabel={
          plan
            ? uiLanguage === 'zh'
              ? '生成图层素材'
              : 'Generate layer assets'
            : uiLanguage === 'zh'
            ? '分析图层结构'
            : 'Analyze layer structure'
        }
        primaryActionEyebrow={
          plan
            ? uiLanguage === 'zh'
              ? '审阅完成后生成素材'
              : 'Reviewed plan, generate assets'
            : uiLanguage === 'zh'
            ? '先分析再审阅'
            : 'Analyze before generation'
        }
        canRunPrimaryAction={
          plan
            ? canGenerateLayerAssets &&
              hasCompletedLayerAnalysis &&
              !isCreatingAnalysisTask &&
              !isAnalysisActive &&
              !isQueuingLayerTasks &&
              !(
                (psdTaskIds.length > 0 || psdTasks.length > 0) &&
                psdTaskStats.isActive
              )
            : !!prompt.trim() &&
              uploadedImages.length > 0 &&
              !isCreatingAnalysisTask &&
              !isAnalysisActive &&
              !isQueuingLayerTasks
        }
        isPrimaryActionBusy={
          isCreatingAnalysisTask ||
          isAnalysisActive ||
          isQueuingLayerTasks ||
          ((psdTaskIds.length > 0 || psdTasks.length > 0) &&
            psdTaskStats.isActive)
        }
        autoGenerateAfterAnalysis={autoGenerateAfterAnalysis}
        onAutoGenerateAfterAnalysisChange={handleAutoGenerateAfterAnalysisChange}
        onNew={handleNew}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onPromptChange={setPrompt}
        onSourceImagesChange={setUploadedImages}
        onSourceImageError={setError}
        onPrimaryAction={
          plan ? () => void handleGenerateLayerAssets() : handlePrimaryAction
        }
        plan={plan}
        isLayerPlanReviewed={Boolean(plan)}
        analysisStatus={analysisStatus}
        status={
          plan && (psdTaskIds.length > 0 || psdTasks.length > 0)
            ? psdTaskStats
            : null
        }
        sourceImages={uploadedImages}
        previewUrl={completedPsdPreviewUrl}
        layerPreviewUrls={layerPreviewUrlsForDisplay}
        layerTaskStateMap={layerTaskStateMap}
        resultCount={completedPsdResultUrls.length}
        canDownload={!!completedPsdTask && completedPsdResultUrls.length > 0}
        isDownloading={isDownloadingPsdReady}
        onDownload={handleDownloadPsdReadyResult}
        onLayerNameChange={updateLayerName}
        onLayerPromptChange={updateLayerPrompt}
        onLayerVisibilityChange={updateLayerVisibility}
        onRetryLayer={(layerId) =>
          void handleGenerateLayerAssets({ layerIds: [layerId], force: true })
        }
        onRetryFailedLayers={() =>
          void handleGenerateLayerAssets({
            layerIds: retryablePsdLayerIds,
            force: true,
          })
        }
        errorPanel={<ErrorDisplay error={error} />}
      />
      <PsdHistoryDrawer
        uiLanguage={uiLanguage}
        open={isHistoryOpen}
        tasks={tasks}
        activeSessionId={currentSessionIdRef.current}
        onClose={() => setIsHistoryOpen(false)}
        onRestore={handleRestoreHistory}
      />
    </div>
  );
};

export default AIImagePsdGeneration;
