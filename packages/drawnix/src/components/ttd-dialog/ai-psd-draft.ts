import {
  TaskType,
  type GenerationParams,
  type KnowledgeContextRef,
} from '../../types/task.types';
import type { ModelRef } from '../../utils/settings-manager';
import type { ReferenceImage } from './shared';

export type PsdTemplate =
  | 'poster'
  | 'ecommerce'
  | 'character'
  | 'social'
  | 'custom';
export type PsdLayerStrategy = 'ai-plan' | 'quick' | 'canvas-selection';
export type PsdLayerType =
  | 'background'
  | 'image'
  | 'text'
  | 'decoration'
  | 'adjustment';
export type PsdLayerStatus = 'draft' | 'queued' | 'export-pending';

export interface PsdLayerDraft {
  id: string;
  name: string;
  type: PsdLayerType;
  description: string;
  generationPrompt: string;
  visible: boolean;
  opacity: number;
  status: PsdLayerStatus;
  locked?: boolean;
}

export interface PsdPlanDraft {
  draftId: string;
  title: string;
  template: PsdTemplate;
  strategy: PsdLayerStrategy;
  textPolicy: {
    preferEditableText: boolean;
    avoidBakedText: boolean;
  };
  layers: PsdLayerDraft[];
  exportSkeleton: {
    target: 'psd';
    status: 'draft';
    nativePsdReady: false;
  };
}

export interface PsdLayerImageTaskDraft {
  layerId: string;
  layerName: string;
  taskType: TaskType.IMAGE;
  params: GenerationParams;
}

export const PSD_LAYER_EXTRACTION_PROMPT_ZH =
  '请将这张海报按视觉元素拆分成若干张独立图像，保持每个元素在原海报中的尺寸、比例、透明度和相对位置完全不变。每个导出的图层都使用与原图完全相同的画布尺寸和分辨率，元素保留在原始坐标位置，其余区域透明。确保所有图像导入 Photoshop 后无需移动、缩放或调整，即可按原位叠加还原完整海报。';

export const PSD_LAYER_EXTRACTION_PROMPT_EN =
  'Split this poster into separate images by visual element. Keep each element exactly the same size, proportion, opacity, and relative position as in the original poster. Every exported layer must use the exact same canvas size and resolution as the source image, preserve the element at its original coordinates, and make all other areas transparent. Ensure the images can be imported into Photoshop and stacked in place to reconstruct the full poster without moving, scaling, or adjustment.';

export function getDefaultPsdLayerExtractionPrompt(
  language: 'zh' | 'en'
): string {
  return language === 'zh'
    ? PSD_LAYER_EXTRACTION_PROMPT_ZH
    : PSD_LAYER_EXTRACTION_PROMPT_EN;
}

export const TEMPLATE_OPTIONS: Array<{
  value: PsdTemplate;
  zh: string;
  en: string;
}> = [
  { value: 'poster', zh: '海报', en: 'Poster' },
  { value: 'ecommerce', zh: '电商主图', en: 'E-commerce' },
  { value: 'character', zh: '角色设定', en: 'Character' },
  { value: 'social', zh: '社媒封面', en: 'Social' },
  { value: 'custom', zh: '自定义', en: 'Custom' },
];

export const STRATEGY_OPTIONS: Array<{
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
    enDesc:
      'Create an editable layer plan first; best for the initial workflow.',
  },
  {
    value: 'quick',
    zh: '快速 PSD',
    en: 'Quick PSD',
    zhDesc: '生成预览图和基础图层占位，后续再细化。',
    enDesc:
      'Generate a preview and basic layer placeholders for later refinement.',
  },
  {
    value: 'canvas-selection',
    zh: '从当前画布/选区构建',
    en: 'Build from canvas',
    zhDesc: '优先使用当前画布选区作为图层来源。',
    enDesc: 'Prefer the current canvas selection as layer sources.',
  },
];

export const LAYER_COUNT_OPTIONS = [3, 5, 8];
export const LAYER_TYPE_OPTIONS: PsdLayerType[] = [
  'background',
  'image',
  'text',
  'decoration',
  'adjustment',
];

export function getTemplateLabel(
  template: PsdTemplate,
  language: 'zh' | 'en'
): string {
  const option = TEMPLATE_OPTIONS.find((item) => item.value === template);
  return option ? option[language] : template;
}

export function getLayerTypeLabel(
  type: PsdLayerType,
  language: 'zh' | 'en'
): string {
  const labels: Record<PsdLayerType, { zh: string; en: string }> = {
    background: { zh: '背景', en: 'Background' },
    image: { zh: '图片', en: 'Image' },
    text: { zh: '文字', en: 'Text' },
    decoration: { zh: '装饰', en: 'Decoration' },
    adjustment: { zh: '调整', en: 'Adjustment' },
  };
  return labels[type][language];
}

export function getStatusLabel(
  status: PsdLayerStatus,
  language: 'zh' | 'en'
): string {
  const labels: Record<PsdLayerStatus, { zh: string; en: string }> = {
    draft: { zh: '草稿', en: 'Draft' },
    queued: { zh: '待生成', en: 'Queued' },
    'export-pending': { zh: '待导出', en: 'Export pending' },
  };
  return labels[status][language];
}

function createStableDraftId(
  prompt: string,
  template: PsdTemplate,
  strategy: PsdLayerStrategy,
  layerCount: number
): string {
  const source = `${prompt.trim()}|${template}|${strategy}|${layerCount}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `psd-draft-${hash.toString(36)}`;
}

function buildTextLayerPrompt(
  description: string,
  textPolicy: PsdPlanDraft['textPolicy'],
  language: 'zh' | 'en'
): string {
  const isZh = language === 'zh';
  const policyNotes = [
    textPolicy.preferEditableText
      ? isZh
        ? '文字内容优先保留为后续可编辑文本层，图片任务只生成版式占位和氛围。'
        : 'Prefer keeping copy as later editable text layers; image tasks should only provide layout placeholders and atmosphere.'
      : null,
    textPolicy.avoidBakedText
      ? isZh
        ? '重要文字请保留为后续可编辑文本层，不要让图片模型直接生成清晰文字。'
        : 'Keep important copy as a later editable text layer; do not ask the image model to render crisp text directly.'
      : null,
  ].filter(Boolean);

  return [description, ...policyNotes].join('\n');
}

export function buildLayerPlan(
  prompt: string,
  template: PsdTemplate,
  strategy: PsdLayerStrategy,
  layerCount: number,
  language: 'zh' | 'en',
  textPolicy: PsdPlanDraft['textPolicy'] = {
    preferEditableText: true,
    avoidBakedText: true,
  }
): PsdPlanDraft {
  const basePrompt = prompt.trim();
  const templateLabel = getTemplateLabel(template, language);
  const isZh = language === 'zh';
  const layerSeeds: Array<
    Omit<
      PsdLayerDraft,
      'id' | 'visible' | 'generationPrompt' | 'opacity' | 'status'
    >
  > = [
    {
      name: isZh ? '背景层' : 'Background',
      type: 'background',
      description: isZh
        ? `为“${basePrompt || templateLabel}”建立整体氛围、色调和留白。`
        : `Set the overall atmosphere, palette, and negative space for “${
            basePrompt || templateLabel
          }”.`,
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
    draftId: createStableDraftId(basePrompt, template, strategy, count),
    title:
      basePrompt ||
      (isZh ? `${templateLabel} PSD 计划` : `${templateLabel} PSD plan`),
    template,
    strategy,
    textPolicy,
    layers: layerSeeds.slice(0, count).map((layer, index) => ({
      ...layer,
      id: `psd-layer-${index + 1}`,
      generationPrompt:
        layer.type === 'text'
          ? buildTextLayerPrompt(layer.description, textPolicy, language)
          : layer.description,
      visible: true,
      opacity: 100,
      status: 'draft',
    })),
    exportSkeleton: {
      target: 'psd',
      status: 'draft',
      nativePsdReady: false,
    },
  };
}

export interface BuildPsdLayerImageTaskDraftsOptions {
  model: string;
  modelRef?: ModelRef | null;
  uploadedImages?: ReferenceImage[];
  knowledgeContextRefs?: KnowledgeContextRef[];
  size?: string;
  width?: number;
  height?: number;
  extraParams?: Record<string, string>;
}

export function buildPsdLayerImageTaskDrafts(
  plan: PsdPlanDraft,
  options: BuildPsdLayerImageTaskDraftsOptions
): PsdLayerImageTaskDraft[] {
  const visualLayers = plan.layers.filter(
    (layer) =>
      layer.visible &&
      (layer.type === 'background' ||
        layer.type === 'image' ||
        layer.type === 'decoration')
  );

  return visualLayers.map((layer, index) => ({
    layerId: layer.id,
    layerName: layer.name,
    taskType: TaskType.IMAGE,
    params: {
      prompt: [
        `[PSD draft layer: ${layer.name}]`,
        plan.title,
        layer.description,
        'Task: export ONLY this layer/visual element from the reference poster as an independent transparent PNG layer.',
        'Keep the exact same canvas size and resolution as the original poster. Preserve the element at its original coordinates, original size, proportion, opacity, and relative position. Make every other pixel transparent.',
        'Photoshop stacking requirement: when all exported layer images are imported into Photoshop, they must restore the complete poster by stacking in place without moving, scaling, or adjustment.',
        'Do not claim or embed a native PSD file; generate a single transparent layer image for later PSD packaging.',
      ].join('\n'),
      width: options.width,
      height: options.height,
      size: options.size,
      model: options.model,
      modelRef: options.modelRef || null,
      generationMode: 'image_edit',
      background: 'transparent',
      outputFormat: 'png',
      inputFidelity: 'high',
      uploadedImages: options.uploadedImages || [],
      referenceImages: (options.uploadedImages || []).map((image) => image.url),
      knowledgeContextRefs: options.knowledgeContextRefs || [],
      autoInsertToCanvas: false,
      batchId: `${plan.draftId}-layers`,
      batchIndex: index + 1,
      batchTotal: visualLayers.length,
      promptMeta: {
        category: 'image',
        title: `${plan.title} · ${layer.name}`,
        tags: ['psd-draft', 'layer-plan'],
        knowledgeContextRefs: options.knowledgeContextRefs || [],
      },
      assetMetadata: {
        category: 'GENERAL',
      },
      psdDraft: {
        draftId: plan.draftId,
        draftTitle: plan.title,
        layerId: layer.id,
        layerName: layer.name,
        layerType: layer.type,
        textPolicy: plan.textPolicy,
        exportTarget: plan.exportSkeleton.target,
        nativePsdReady: plan.exportSkeleton.nativePsdReady,
      },
      ...(options.extraParams && Object.keys(options.extraParams).length > 0
        ? { params: options.extraParams }
        : {}),
    },
  }));
}
