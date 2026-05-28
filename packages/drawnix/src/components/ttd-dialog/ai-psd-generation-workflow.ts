import type JSZip from 'jszip';
import { TaskStatus, type Task } from '../../types/task.types';
import { triggerBlobDownload } from '../../utils/download-utils';
import type { PsdGenerationPlan, PsdLayerType } from './ai-psd-plan';
import type { ReferenceImage } from './shared';

type PsdStatusTone = 'queued' | 'active' | 'success' | 'warning' | 'error';

export interface PsdTaskStats {
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

interface PsdLayerTransparencyResult {
  url: string;
  normalized: boolean;
  reason:
    | 'background-layer'
    | 'already-transparent'
    | 'canvas-unavailable'
    | 'decode-failed'
    | 'no-background-pixels'
    | 'normalized';
}

export const PSD_WORKFLOW_STEPS = {
  zh: [
    { title: '上传原图', description: '提供需要拆分的海报/参考图' },
    {
      title: 'gpt-5.5 高思考分析',
      description: '先识别真实视觉元素，不使用固定图层模板',
    },
    {
      title: '确认图层计划',
      description: '检查图层名称、提示词和参与导出的范围',
    },
    {
      title: '生成图层素材',
      description: '确认后逐层生成同画布透明 PNG',
    },
    {
      title: '下载工作区包',
      description: '显隐、选择、高亮检查后下载 PSD-ready zip',
    },
  ],
  en: [
    {
      title: 'Upload source',
      description: 'Provide the poster/reference image to split',
    },
    {
      title: 'gpt-5.5 reasoning analysis',
      description:
        'Identify real visual elements without a fixed layer template',
    },
    {
      title: 'Review layer plan',
      description: 'Check layer names, prompts, and export inclusion',
    },
    {
      title: 'Generate layer assets',
      description: 'Generate same-canvas transparent PNG layers after review',
    },
    {
      title: 'Download package',
      description: 'Toggle, inspect, then download the PSD-ready zip package',
    },
  ],
} as const;

export function getTaskBatchId(task: Task): string | null {
  const batchId = task.params?.batchId;
  return typeof batchId === 'string' ? batchId : null;
}

function getTaskBatchTotal(task: Task): number {
  const batchTotal = task.params?.batchTotal;
  return typeof batchTotal === 'number' && Number.isFinite(batchTotal)
    ? batchTotal
    : 0;
}

function getTaskUpdatedAt(task: Task): number {
  return task.updatedAt || task.createdAt || 0;
}

function getPsdLayerIdFromTask(task: Task): string | null {
  const layerId = task.params?.psdPlan?.layerId;
  if (typeof layerId !== 'string' || layerId === 'psd-ready-composite') {
    return null;
  }
  return layerId;
}

export function getTaskResultUrls(task: Task | undefined): string[] {
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
    .replace(/[{}[\](),;]+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  return safeName || 'psd-ready-workspace';
}

function shouldStoreUrlInManifest(url: string, packed: boolean): boolean {
  if (!packed) return true;
  return !url.startsWith('data:');
}

function getPsdLayerTypeFromTask(task: Task): PsdLayerType | null {
  const layerType = task.params?.psdPlan?.layerType;
  if (
    layerType === 'background' ||
    layerType === 'image' ||
    layerType === 'text' ||
    layerType === 'decoration' ||
    layerType === 'adjustment'
  ) {
    return layerType;
  }
  return null;
}

function findLayerTypeInPlan(
  plan: PsdGenerationPlan | null,
  layerId: string | null
): PsdLayerType | null {
  if (!plan || !layerId) return null;
  return plan.layers.find((layer) => layer.id === layerId)?.type || null;
}

function findLayerNameInPlan(
  plan: PsdGenerationPlan | null,
  layerId: string | null
): string | null {
  if (!plan || !layerId) return null;
  return plan.layers.find((layer) => layer.id === layerId)?.name || null;
}

function isLightNeutralBackgroundPixel(
  red: number,
  green: number,
  blue: number
): boolean {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const brightness = (red + green + blue) / 3;
  const chroma = max - min;

  if (brightness >= 248 && chroma <= 24) return true;
  if (brightness >= 226 && chroma <= 12) return true;
  if (brightness >= 210 && chroma <= 8) return true;
  return false;
}

function canUseCanvasImageProcessing(): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof Image === 'undefined') return false;
  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().includes('jsdom')
  ) {
    return false;
  }
  return true;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image decode failed'));
    image.src = url;
  });
}

export async function normalizePsdLayerTransparency(
  url: string,
  options: { layerType?: PsdLayerType | null } = {}
): Promise<PsdLayerTransparencyResult> {
  if (options.layerType === 'background') {
    return { url, normalized: false, reason: 'background-layer' };
  }
  if (!canUseCanvasImageProcessing()) {
    return { url, normalized: false, reason: 'canvas-unavailable' };
  }

  try {
    const image = await loadImageElement(url);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width <= 0 || height <= 0) {
      return { url, normalized: false, reason: 'decode-failed' };
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return { url, normalized: false, reason: 'canvas-unavailable' };
    }

    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const { data } = imageData;
    let alreadyTransparentPixels = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 248) {
        alreadyTransparentPixels += 1;
      }
    }

    const totalPixels = width * height;
    if (alreadyTransparentPixels / totalPixels > 0.02) {
      return { url, normalized: false, reason: 'already-transparent' };
    }

    let transparentPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (
        isLightNeutralBackgroundPixel(
          data[index],
          data[index + 1],
          data[index + 2]
        )
      ) {
        data[index + 3] = 0;
        transparentPixels += 1;
      }
    }

    if (transparentPixels / totalPixels < 0.05) {
      return { url, normalized: false, reason: 'no-background-pixels' };
    }

    context.putImageData(imageData, 0, 0);
    return {
      url: canvas.toDataURL('image/png'),
      normalized: true,
      reason: 'normalized',
    };
  } catch {
    return { url, normalized: false, reason: 'decode-failed' };
  }
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
    console.warn(
      '[AIImagePsdGeneration] Failed to pack asset, linking instead:',
      err
    );
    linkedUrls.push(url);
    return false;
  }
}

export async function downloadPsdReadyWorkspacePackage(options: {
  task: Task;
  tasks?: Task[];
  plan: PsdGenerationPlan | null;
  prompt: string;
  referenceImages: ReferenceImage[];
  uiLanguage: 'zh' | 'en';
}): Promise<PsdReadyWorkspaceExportResult> {
  const { task, tasks, plan, prompt, referenceImages, uiLanguage } = options;
  const exportTasks = (tasks && tasks.length > 0 ? tasks : [task]).filter(
    (item) => getTaskResultUrls(item).length > 0
  );
  const urls = exportTasks.flatMap((item) => getTaskResultUrls(item));
  if (urls.length === 0 || exportTasks.length === 0) {
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

  let generatedIndex = 0;
  const generatedEntries = (
    await Promise.all(
      exportTasks.map(async (exportTask) => {
        const taskUrls = getTaskResultUrls(exportTask);
        const psdPlan = exportTask.params?.psdPlan;
        const layerId =
          typeof psdPlan?.layerId === 'string' ? psdPlan.layerId : null;
        const layerName =
          typeof psdPlan?.layerName === 'string' ? psdPlan.layerName : null;
        const isNativeLayer =
          Boolean(layerId) && layerId !== 'psd-ready-composite';

        return Promise.all(
          taskUrls.map(async (url, urlIndex) => {
            generatedIndex += 1;
            const layerType =
              getPsdLayerTypeFromTask(exportTask) ||
              findLayerTypeInPlan(plan, layerId);
            const normalizedAsset = isNativeLayer
              ? await normalizePsdLayerTransparency(url, {
                  layerType,
                })
              : ({
                  url,
                  normalized: false,
                  reason: 'background-layer',
                } as const);
            const assetUrl = normalizedAsset.url;
            const extension = getUrlExtension(
              assetUrl,
              exportTask.result?.format || 'png'
            );
            const safeLayerName = sanitizeWorkspaceName(
              layerName || `layer-${generatedIndex}`
            );
            const path = isNativeLayer
              ? `layers/${String(generatedIndex).padStart(
                  2,
                  '0'
                )}-${safeLayerName}.${extension}`
              : urls.length > 1
              ? `generated/generated-${generatedIndex}.${extension}`
              : `generated/generated.${extension}`;
            const packed = await addUrlAssetToZip(
              zip,
              path,
              assetUrl,
              linkedUrls
            );
            if (packed) packedAssetCount += 1;
            return {
              kind: isNativeLayer ? 'same-canvas-layer' : 'generated',
              index: generatedIndex,
              taskId: exportTask.id,
              layerId,
              layerName,
              urlIndex: urlIndex + 1,
              path: packed ? path : null,
              url: shouldStoreUrlInManifest(assetUrl, packed)
                ? assetUrl
                : undefined,
              format: extension,
              alphaNormalized: normalizedAsset.normalized || undefined,
              sameCanvasTransparentLayer: isNativeLayer,
            };
          })
        );
      })
    )
  ).flat();

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
        url: shouldStoreUrlInManifest(image.url, packed)
          ? image.url
          : undefined,
        format: extension,
      };
    })
  );
  const latestTaskByLayerId = new Map<string, Task>();
  for (const candidate of tasks || []) {
    const layerId = getPsdLayerIdFromTask(candidate);
    if (!layerId) continue;
    const current = latestTaskByLayerId.get(layerId);
    if (!current || getTaskUpdatedAt(candidate) >= getTaskUpdatedAt(current)) {
      latestTaskByLayerId.set(layerId, candidate);
    }
  }
  const failedLayerEntries = Array.from(latestTaskByLayerId.values())
    .filter(
      (item) =>
        item.status === TaskStatus.FAILED ||
        item.status === TaskStatus.CANCELLED
    )
    .map((failedTask) => {
      const psdPlan = failedTask.params?.psdPlan;
      const layerId = getPsdLayerIdFromTask(failedTask);
      if (!layerId) return null;
      const layerName =
        typeof psdPlan?.layerName === 'string'
          ? psdPlan.layerName
          : findLayerNameInPlan(plan, layerId);
      return {
        layerId,
        layerName: layerName || layerId,
        taskId: failedTask.id,
        status: failedTask.status,
        error: failedTask.error?.message || failedTask.error?.code || null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

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
    layerContract: {
      sameCanvasAsOriginal: true,
      preserveOriginalCoordinates: true,
      preserveOriginalSizeProportionOpacity: true,
      transparentOutsideElement: true,
      photoshopStackingInPlace: true,
      note:
        uiLanguage === 'zh'
          ? '每个同画布图层图像应与原图尺寸一致，元素保留原始坐标，其余区域透明；导入 Photoshop 后按原位叠加还原海报。'
          : 'Each same-canvas layer image should match the original size, keep the element at its original coordinates, and keep the rest transparent so Photoshop can stack the layers in place.',
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
      failedLayers: failedLayerEntries,
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
              generatedEntries.some(
                (entry) => entry.kind === 'same-canvas-layer'
              )
                ? '在 Photoshop 中把 layers/ 下的同画布透明 PNG 逐层导入，保持原始画布尺寸和坐标不变。'
                : '在 Photoshop 中打开 generated/generated.* 作为当前 GPT Image 结果。',
              '如需对照原图，导入 source/ 下的参考图并置于底层或参考组。',
              '按照 manifest.json 中的 layers 建立图层组、可编辑文字层和参考说明层。',
              '当前包不是原生 .psd；接入 PSD 打包器后可把这些资产自动写入 .psd。',
            ]
          : [
              generatedEntries.some(
                (entry) => entry.kind === 'same-canvas-layer'
              )
                ? 'Import the same-canvas transparent PNG files from layers/ into Photoshop without changing canvas size or coordinates.'
                : 'Open generated/generated.* in Photoshop as the current GPT Image result.',
              'Import source/ references as bottom/reference layers when needed.',
              'Use manifest.json layers to create layer groups, editable text layers, and notes.',
              'This package is not a native .psd; a future packer can write these assets into a .psd.',
            ],
    },
  };

  const readme =
    uiLanguage === 'zh'
      ? `# PSD-ready 工作区包\n\n这不是原生分层 .psd 文件。\n\n根据 OpenAI 官方 API 能力，GPT Image 返回的是图片结果（png/jpeg/webp），不是 Photoshop PSD 文档。本包把同画布透明图层、参考图和 PSD/Photoshop 元数据放在一起，方便你在 Photoshop 中继续编辑，或供后续 PSD 打包器使用。\n\n## 内容\n\n- layers/：同画布透明图层结果（如本次生成了逐层图像）\n- generated/：兼容旧流程的 GPT Image 合成结果\n- source/：上传的参考图（如果浏览器允许打包）\n- manifest.json：图层计划、提示词、画布、同画布图层契约和官方 API 边界说明\n\n## 建议\n\n1. 优先把 layers/ 下图像导入 Photoshop，保持原始画布尺寸和坐标不变。\n2. 导入 source/ 参考图作为对照。\n3. 按 manifest.json 创建可编辑文字层和图层组。\n`
      : `# PSD-ready workspace package\n\nThis is not a native layered .psd file.\n\nPer the OpenAI API capability boundary, GPT Image returns image outputs (png/jpeg/webp), not a Photoshop PSD document. This package keeps same-canvas transparent layer images, references, and Photoshop/PSD metadata together for manual Photoshop editing or a future PSD packer.\n\n## Contents\n\n- layers/: same-canvas transparent layer results when layer images were generated\n- generated/: legacy GPT Image composite result\n- source/: uploaded references when the browser can pack them\n- manifest.json: layer plan, prompt, canvas, same-canvas layer contract, and official API boundary notes\n`;

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

export function buildPsdTaskStats(
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
        ? '同画布图层生成失败'
        : 'Same-canvas layer generation failed';
    detail =
      uiLanguage === 'zh'
        ? '任务失败。请在任务队列查看错误详情，调整提示词或参考图后重试。'
        : 'The task failed. Check task queue errors, then adjust the prompt or reference image and retry.';
  } else if (failed > 0 || cancelled > 0) {
    tone = 'warning';
    title =
      uiLanguage === 'zh'
        ? '同画布图层任务未完成'
        : 'Same-canvas layer tasks did not complete';
    detail =
      uiLanguage === 'zh'
        ? '请在任务队列查看失败原因或重试；已完成结果仍可在任务队列或素材库查看。'
        : 'Check the task queue for failure details or retry; completed results remain available in the task queue or media library.';
  } else if (total > 0 && completed === total) {
    tone = 'success';
    title =
      uiLanguage === 'zh'
        ? '同画布图层已生成完成'
        : 'Same-canvas layers are ready';
    detail =
      uiLanguage === 'zh'
        ? '可在预览区逐层查看生成结果，并下载 PSD 工作区包；当前图片接口返回图片数据，不直接返回原生分层 PSD。'
        : 'View generated layers in the preview area and download a PSD workspace package; the current image endpoint returns image data, not a native layered PSD.';
  } else if (processing > 0) {
    tone = 'active';
    title =
      uiLanguage === 'zh'
        ? '同画布图层生成中'
        : 'Same-canvas layers are generating';
    detail =
      uiLanguage === 'zh'
        ? '正在生成同画布透明图层，请保持页面打开；任务完成或失败后这里会自动更新。'
        : 'Generating same-canvas transparent layers. Keep this page open; this status updates on completion or failure.';
  } else {
    title =
      uiLanguage === 'zh'
        ? '同画布图层任务已排队'
        : 'Same-canvas layer tasks queued';
    detail =
      uiLanguage === 'zh'
        ? `已排队 ${
            pending || total
          } 个图片编辑任务，等待开始生成；若长时间无变化，请打开任务队列查看是否缺少密钥、额度或接口错误。`
        : `${
            pending || total
          } image edit tasks are queued. If this does not change, open the task queue to check credentials, quota, or API errors.`;
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
