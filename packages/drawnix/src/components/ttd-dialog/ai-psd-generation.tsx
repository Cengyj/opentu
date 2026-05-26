import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type JSZip from 'jszip';
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
import { triggerBlobDownload } from '../../utils/download-utils';

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

interface PsdReadyWorkspaceExportResult {
  filename: string;
  packedAssetCount: number;
  linkedAssetCount: number;
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

function getTaskResultUrls(task: Task | undefined): string[] {
  if (!task?.result) return [];
  if (Array.isArray(task.result.urls) && task.result.urls.length > 0) {
    return task.result.urls.filter((url): url is string => Boolean(url));
  }
  return task.result.url ? [task.result.url] : [];
}

function sanitizeWorkspaceName(value: string | undefined): string {
  const safeName = (value || 'psd-ready-workspace')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72);
  return safeName || 'psd-ready-workspace';
}

function getUrlExtension(url: string | undefined, fallback = 'png'): string {
  if (!url) return fallback;
  const dataUrlMatch = url.match(/^data:image\/([a-z0-9.+-]+);/i);
  if (dataUrlMatch?.[1]) {
    return dataUrlMatch[1].replace('jpeg', 'jpg');
  }

  try {
    const pathname = new URL(url, window.location.href).pathname;
    const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1];
    return extension || fallback;
  } catch {
    const extension = url.split('?')[0]?.match(/\.([a-z0-9]+)$/i)?.[1];
    return extension || fallback;
  }
}

function dataUrlToUint8Array(url: string): Uint8Array | null {
  const match = url.match(/^data:([^;,]+)?((?:;[^,]*)*),(.*)$/i);
  if (!match) return null;

  const metadata = match[2] || '';
  const payload = match[3] || '';
  if (metadata.toLowerCase().includes(';base64')) {
    const binary = atob(payload.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  return new TextEncoder().encode(decodeURIComponent(payload));
}

async function readUrlAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { referrerPolicy: 'no-referrer' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.blob();
}

async function addUrlAssetToZip(
  zip: JSZip,
  path: string,
  url: string,
  linkedUrls: string[]
): Promise<boolean> {
  try {
    const inlineData = dataUrlToUint8Array(url);
    if (inlineData) {
      zip.file(path, inlineData);
      return true;
    }

    const blob = await readUrlAsBlob(url);
    zip.file(path, await blob.arrayBuffer());
    return true;
  } catch (err) {
    console.warn('[AIImagePsdGeneration] Failed to pack asset, linking instead:', err);
    linkedUrls.push(url);
    return false;
  }
}

async function downloadPsdReadyWorkspacePackage(options: {
  task: Task;
  plan: PsdGenerationPlan | null;
  prompt: string;
  referenceImages: ReferenceImage[];
  uiLanguage: 'zh' | 'en';
}): Promise<PsdReadyWorkspaceExportResult> {
  const { task, plan, prompt, referenceImages, uiLanguage } = options;
  const urls = getTaskResultUrls(task);
  if (urls.length === 0) {
    throw new Error('No PSD-ready image result URLs to export');
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const generatedAt = new Date().toISOString();
  const workspaceBaseName = sanitizeWorkspaceName(
    plan?.title || task.result?.title || prompt || task.params.prompt
  );
  const linkedUrls: string[] = [];
  let packedAssetCount = 0;

  const generatedEntries = await Promise.all(
    urls.map(async (url, index) => {
      const extension = getUrlExtension(url, task.result?.format || 'png');
      const path =
        urls.length > 1
          ? `generated/generated-${index + 1}.${extension}`
          : `generated/generated.${extension}`;
      const packed = await addUrlAssetToZip(zip, path, url, linkedUrls);
      if (packed) packedAssetCount += 1;
      return {
        kind: 'generated',
        index: index + 1,
        path: packed ? path : null,
        url,
        format: extension,
      };
    })
  );

  const referenceEntries = await Promise.all(
    referenceImages.map(async (image, index) => {
      const extension = getUrlExtension(image.url, 'png');
      const baseName = (image.name || `reference-${index + 1}`).replace(
        /\.[a-z0-9]+$/i,
        ''
      );
      const safeName = sanitizeWorkspaceName(baseName);
      const path = `source/${index + 1}-${safeName}.${extension}`;
      const packed = await addUrlAssetToZip(zip, path, image.url, linkedUrls);
      if (packed) packedAssetCount += 1;
      return {
        kind: 'reference',
        index: index + 1,
        name: image.name,
        path: packed ? path : null,
        url: image.url,
        format: extension,
      };
    })
  );

  const manifest = {
    schema: 'opentu.psd-ready-workspace.v1',
    generatedAt,
    source: 'opentu',
    officialApiBoundary: {
      apiReturnsNativePsd: false,
      apiReturnsLayeredPsd: false,
      apiReturnsImageData: true,
      note:
        uiLanguage === 'zh'
          ? 'OpenAI GPT Image API 返回 png/jpeg/webp 等图片结果，不直接返回原生分层 PSD。本包用于 Photoshop 手动继续编辑或后续 PSD 打包器接入。'
          : 'The OpenAI GPT Image API returns image outputs such as png/jpeg/webp, not a native layered PSD. This package is for Photoshop handoff or future PSD packer integration.',
    },
    task: {
      id: task.id,
      model: task.params.model,
      size: task.params.size,
      outputFormat: task.result?.format || task.params.outputFormat || 'png',
      prompt: task.params.prompt,
    },
    plan: plan
      ? {
          id: plan.planId,
          title: plan.title,
          template: plan.template,
          strategy: plan.strategy,
          textPolicy: plan.textPolicy,
          exportSkeleton: plan.exportSkeleton,
          layers: plan.layers.map((layer) => ({
            id: layer.id,
            name: layer.name,
            type: layer.type,
            visible: layer.visible,
            locked: layer.locked,
            description: layer.description,
          })),
        }
      : null,
    assets: {
      generated: generatedEntries,
      references: referenceEntries,
      linkedUrls,
    },
    photoshopHandoff: {
      canvas: {
        width: task.result?.width || task.params.width || null,
        height: task.result?.height || task.params.height || null,
      },
      recommendedSteps:
        uiLanguage === 'zh'
          ? [
              '在 Photoshop 中打开 generated/generated.* 作为当前 GPT Image 结果。',
              '如需对照原图，导入 source/ 下的参考图并置于底层或参考组。',
              '按照 manifest.json 中的 layers 建立图层组、可编辑文字层和参考说明层。',
              '当前包不是原生 .psd；接入 PSD 打包器后可把这些资产自动写入 .psd。',
            ]
          : [
              'Open generated/generated.* in Photoshop as the current GPT Image result.',
              'Import source/ references as bottom/reference layers when needed.',
              'Use manifest.json layers to create layer groups, editable text layers, and notes.',
              'This package is not a native .psd; a future packer can write these assets into a .psd.',
            ],
    },
  };

  const readme =
    uiLanguage === 'zh'
      ? `# PSD-ready 工作区包\n\n这不是原生分层 .psd 文件。\n\n根据 OpenAI 官方 API 能力，GPT Image 返回的是图片结果（png/jpeg/webp），不是 Photoshop PSD 文档。本包把生成图、参考图和 PSD/Photoshop 元数据放在一起，方便你在 Photoshop 中继续编辑，或供后续 PSD 打包器使用。\n\n## 内容\n\n- generated/：GPT Image 生成结果\n- source/：上传的参考图（如果浏览器允许打包）\n- manifest.json：图层计划、提示词、画布和官方 API 边界说明\n\n## 建议\n\n1. 打开 generated/generated.*。\n2. 导入 source/ 参考图作为对照。\n3. 按 manifest.json 创建可编辑文字层和图层组。\n`
      : `# PSD-ready workspace package\n\nThis is not a native layered .psd file.\n\nPer the OpenAI API capability boundary, GPT Image returns image outputs (png/jpeg/webp), not a Photoshop PSD document. This package keeps the generated result, references, and Photoshop/PSD metadata together for manual Photoshop editing or a future PSD packer.\n\n## Contents\n\n- generated/: GPT Image result\n- source/: uploaded references when the browser can pack them\n- manifest.json: layer plan, prompt, canvas, and official API boundary notes\n`;

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('README.md', readme);

  const zipOutput = await zip.generateAsync({ type: 'arraybuffer' });
  const zipBlob = new Blob([zipOutput], { type: 'application/zip' });
  const timestamp = generatedAt.slice(0, 19).replace(/[T:]/g, '-');
  const filename = `${workspaceBaseName}-${timestamp}.psd-ready-workspace.zip`;
  triggerBlobDownload(zipBlob, filename);

  return {
    filename,
    packedAssetCount,
    linkedAssetCount: linkedUrls.length,
  };
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
        ? '可在下方预览生成图，并下载 PSD-ready 资产包；官方 API 当前返回图片数据，不直接返回原生分层 PSD。'
        : 'Preview the generated image below and download a PSD-ready asset package; the official API currently returns image data, not a native layered PSD.';
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
  const completedPsdTask = useMemo(
    () =>
      psdTasks.find(
        (task) =>
          task.status === TaskStatus.COMPLETED &&
          getTaskResultUrls(task).length > 0
      ),
    [psdTasks]
  );
  const completedPsdResultUrls = useMemo(
    () => getTaskResultUrls(completedPsdTask),
    [completedPsdTask]
  );
  const completedPsdPreviewUrl = completedPsdResultUrls[0];

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
  }, [completedPsdResultUrls.length, completedPsdTask, plan, prompt, uiLanguage, uploadedImages]);

  return (
    <div className="ai-psd-generation-container ai-image-generation-container ai-psd-generation-container--one-click">
      <div className="psd-one-click-shell">
        <section className="psd-hero" aria-label="PSD one-click generator">
          <span className="psd-hero__eyebrow">
            {uiLanguage === 'zh'
              ? '官方式 GPT Image 编辑工作区'
              : 'Official-style GPT Image editing workspace'}
          </span>
          <h2>
            {uiLanguage === 'zh'
              ? '用参考图和提示词准备 Photoshop 工作区'
              : 'Prepare a Photoshop workspace from a reference and prompt'}
          </h2>
          <p>
            {uiLanguage === 'zh'
              ? '参考官方体验：先生成可继续编辑的图像结果，再把生成图、参考图和图层计划打包成 PSD-ready 工作区；不把单张 PNG 伪装成 PSD。'
              : 'Following the official experience: generate an editable image result, then package the result, references, and layer plan as a PSD-ready workspace instead of pretending a PNG is a PSD.'}
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
                  ? '当前流程会生成 1 张 GPT Image 结果，并提供 PSD-ready ZIP 工作区包：生成图、参考图、manifest 和 Photoshop 接力说明。'
                  : 'This flow generates one GPT Image result and offers a PSD-ready ZIP workspace: generated image, references, manifest, and Photoshop handoff notes.'}
              </small>
            </div>
          ) : null}

          {completedPsdPreviewUrl ? (
            <section
              className="psd-result-preview"
              aria-label={
                uiLanguage === 'zh'
                  ? 'PSD-ready 结果预览'
                  : 'PSD-ready result preview'
              }
            >
              <div className="psd-result-preview__header">
                <div>
                  <strong>
                    {uiLanguage === 'zh'
                      ? 'PSD-ready 结果预览'
                      : 'PSD-ready result preview'}
                  </strong>
                  <span>
                    {uiLanguage === 'zh'
                      ? completedPsdResultUrls.length > 1
                        ? `已生成 ${completedPsdResultUrls.length} 张图片；下载将生成 PSD-ready 工作区包。`
                        : '已生成 1 张图片；下载将生成 PSD-ready 工作区包。'
                      : completedPsdResultUrls.length > 1
                      ? `${completedPsdResultUrls.length} images generated; download creates a PSD-ready workspace package.`
                      : 'One image generated; download creates a PSD-ready workspace package.'}
                  </span>
                </div>
                <div className="psd-result-preview__actions">
                  <a
                    className="psd-result-preview__button"
                    href={completedPsdPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {uiLanguage === 'zh' ? '打开原图' : 'Open'}
                  </a>
                  <button
                    type="button"
                    className="psd-result-preview__button psd-result-preview__button--primary"
                    onClick={handleDownloadPsdReadyResult}
                  >
                    {uiLanguage === 'zh'
                      ? '下载 PSD-ready 资产包'
                      : 'Download PSD-ready package'}
                  </button>
                </div>
              </div>
              <a
                className="psd-result-preview__image-link"
                href={completedPsdPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={completedPsdPreviewUrl}
                  alt={
                    uiLanguage === 'zh'
                      ? 'PSD-ready 生成结果'
                      : 'PSD-ready generated result'
                  }
                />
              </a>
              <small>
                {uiLanguage === 'zh'
                  ? '官方 API 当前返回的是图片数据，不是原生分层 PSD；资产包会附带 manifest.json 和 Photoshop 接力说明。'
                  : 'The official API currently returns image data, not a native layered PSD; the package includes manifest.json and Photoshop handoff notes.'}
              </small>
            </section>
          ) : null}

          <details className="psd-capability-disclosure">
            <summary>{uiLanguage === 'zh' ? '说明' : 'Note'}</summary>
            <p>
              {uiLanguage === 'zh'
                ? '系统会自动处理生成设置；公开 GPT Image API 当前返回 png/jpeg/webp 图片数据而不是原生 .psd。Opentu 现在提供 PSD-ready ZIP 工作区包，真正 Photoshop PSD 写入可作为后续本地或服务端打包器接入。'
                : 'Opentu handles generation settings automatically; the public GPT Image API currently returns png/jpeg/webp image data rather than a native .psd. Opentu now provides a PSD-ready ZIP workspace, while true Photoshop PSD writing can be added later through a local or server packer.'}
            </p>
          </details>

          <ErrorDisplay error={error} />
        </section>
      </div>
    </div>
  );
};

export default AIImagePsdGeneration;
