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
export type PsdLayerStatus = 'planned' | 'queued' | 'export-pending';

export interface PsdLayerPlan {
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

export interface PsdGenerationPlan {
  planId: string;
  title: string;
  template: PsdTemplate;
  strategy: PsdLayerStrategy;
  textPolicy: {
    preferEditableText: boolean;
    avoidBakedText: boolean;
  };
  layers: PsdLayerPlan[];
  exportSkeleton: {
    target: 'psd';
    source: 'photoshop';
    status: 'planned';
    nativePsdReady: false;
    apiNativePsdSupported: false;
    downloadAction: 'pending-native-packager';
  };
  workflowSteps: Array<{
    id:
      | 'image-generation'
      | 'thinking-layer-split'
      | 'photoshop-source'
      | 'export-edit';
    title: string;
    description: string;
    status: 'planned';
  }>;
}

export interface PsdLayerImageTaskPlan {
  layerId: string;
  layerName: string;
  taskType: TaskType.IMAGE;
  params: GenerationParams;
}

export const PSD_LAYER_IMAGE_TASK_CONTRACT = {
  taskType: TaskType.IMAGE,
  generationMode: 'image_edit',
  background: 'auto',
  outputFormat: 'png',
  inputFidelity: 'high',
  exportTarget: 'psd',
  nativePsdReady: false,
  promptMetaTags: ['psd-layer', 'photoshop-source', 'layer-split'],
} as const;

export const PSD_LAYER_EXTRACTION_PROMPT_ZH =
  '参考这张图生成/还原设计稿，并进入 PSD 思考拆层流程：先识别独立视觉元素，再按背景、主体、文字、装饰和调整说明拆成可编辑图层。请用 JSON 写清画布尺寸、元素坐标、背景类型和图层堆叠顺序；源设置为 Photoshop/PSD。当前公共图片 API 不直接返回原生 PSD，先输出可用于后续 PSD 打包的分层素材与说明。';

export const PSD_LAYER_EXTRACTION_PROMPT_EN =
  'Use this reference image to generate or reconstruct a design, then follow a PSD thinking/layer-splitting flow: identify independent visual elements first, split them into editable background, subject, text, decoration, and adjustment-note layers, and describe canvas size, element coordinates, background type, and layer stacking order as JSON. Set the source/export target to Photoshop/PSD. The current public image API does not return native PSD directly, so prepare layer assets and metadata for later PSD packaging.';

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
    planned: { zh: '待生成', en: 'Planned' },
    queued: { zh: '待生成', en: 'Queued' },
    'export-pending': { zh: '待导出', en: 'Export pending' },
  };
  return labels[status][language];
}

function createStablePlanId(
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
  return `psd-layer-${hash.toString(36)}`;
}

function buildPsdWorkflowSteps(
  language: 'zh' | 'en'
): PsdGenerationPlan['workflowSteps'] {
  const isZh = language === 'zh';
  return [
    {
      id: 'image-generation',
      title: isZh ? '图像生成/还原' : 'Image generation/reconstruction',
      description: isZh
        ? '使用参考图和提示词生成或还原第一版设计。'
        : 'Use the reference image and prompt to create or reconstruct the first design pass.',
      status: 'planned',
    },
    {
      id: 'thinking-layer-split',
      title: isZh ? '思考拆层' : 'Thinking layer split',
      description: isZh
        ? '先识别独立视觉元素，再拆成背景、主体、文字、装饰和调整说明层。'
        : 'Identify independent visual elements first, then split background, subject, text, decoration, and adjustment notes.',
      status: 'planned',
    },
    {
      id: 'photoshop-source',
      title: isZh ? '源设置：Photoshop/PSD' : 'Source: Photoshop/PSD',
      description: isZh
        ? '图层素材保留同画布坐标，面向 Photoshop 原位叠放。'
        : 'Keep layer assets on the same canvas and coordinates for in-place Photoshop stacking.',
      status: 'planned',
    },
    {
      id: 'export-edit',
      title: isZh ? '导出与编辑' : 'Export and edit',
      description: isZh
        ? '公共图片 API 暂不直接返回原生 PSD；先准备可打包素材，打包接入后提供下载/打开 PSD。'
        : 'The public image API does not return native PSD directly yet; prepare packable assets now and enable PSD download/open once packaging is wired.',
      status: 'planned',
    },
  ];
}

function buildTextLayerPrompt(
  description: string,
  textPolicy: PsdGenerationPlan['textPolicy'],
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
  textPolicy: PsdGenerationPlan['textPolicy'] = {
    preferEditableText: true,
    avoidBakedText: true,
  }
): PsdGenerationPlan {
  const basePrompt = prompt.trim();
  const templateLabel = getTemplateLabel(template, language);
  const isZh = language === 'zh';
  const layerSeeds: Array<
    Omit<
      PsdLayerPlan,
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
    planId: createStablePlanId(basePrompt, template, strategy, count),
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
      status: 'planned',
    })),
    exportSkeleton: {
      target: 'psd',
      source: 'photoshop',
      status: 'planned',
      nativePsdReady: false,
      apiNativePsdSupported: false,
      downloadAction: 'pending-native-packager',
    },
    workflowSteps: buildPsdWorkflowSteps(language),
  };
}

export interface BuildPsdLayerImageTaskPlansOptions {
  model: string;
  modelRef?: ModelRef | null;
  uploadedImages?: ReferenceImage[];
  knowledgeContextRefs?: KnowledgeContextRef[];
  size?: string;
  width?: number;
  height?: number;
  extraParams?: Record<string, string>;
}

export function buildPsdLayerImageTaskPlans(
  plan: PsdGenerationPlan,
  options: BuildPsdLayerImageTaskPlansOptions
): PsdLayerImageTaskPlan[] {
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
    taskType: PSD_LAYER_IMAGE_TASK_CONTRACT.taskType,
    params: {
      prompt: [
        `[PSD layer: ${layer.name}]`,
        plan.title,
        layer.description,
        'Workflow: think step by step, identify this independent visual element, then prepare it as one Photoshop-ready layer.',
        'Task: export ONLY this layer/visual element from the reference poster as an independent same-canvas PNG layer asset.',
        'Keep the exact same canvas size and resolution as the original poster. Preserve the element at its original coordinates, original size, proportion, opacity, and relative position. If alpha output is supported, make every other pixel transparent; otherwise keep non-target regions clean and separable for later masking/PSD packaging.',
        'Photoshop source setting: treat the export target as Photoshop/PSD so all layer assets can be stacked in place without moving, scaling, or adjustment.',
        'Do not claim or embed a native PSD file; the public image API does not directly return PSD here, so generate one packable layer asset for later PSD packaging and download/open support.',
      ].join('\n'),
      width: options.width,
      height: options.height,
      size: options.size,
      model: options.model,
      modelRef: options.modelRef || null,
      generationMode: PSD_LAYER_IMAGE_TASK_CONTRACT.generationMode,
      background: PSD_LAYER_IMAGE_TASK_CONTRACT.background,
      outputFormat: PSD_LAYER_IMAGE_TASK_CONTRACT.outputFormat,
      inputFidelity: PSD_LAYER_IMAGE_TASK_CONTRACT.inputFidelity,
      uploadedImages: options.uploadedImages || [],
      referenceImages: (options.uploadedImages || []).map((image) => image.url),
      knowledgeContextRefs: options.knowledgeContextRefs || [],
      autoInsertToCanvas: false,
      batchId: `${plan.planId}-layers`,
      batchIndex: index + 1,
      batchTotal: visualLayers.length,
      promptMeta: {
        category: 'image',
        title: `${plan.title} · ${layer.name}`,
        tags: [...PSD_LAYER_IMAGE_TASK_CONTRACT.promptMetaTags],
        knowledgeContextRefs: options.knowledgeContextRefs || [],
      },
      assetMetadata: {
        category: 'GENERAL',
      },
      psdPlan: {
        planId: plan.planId,
        planTitle: plan.title,
        layerId: layer.id,
        layerName: layer.name,
        layerType: layer.type,
        textPolicy: plan.textPolicy,
        exportTarget: PSD_LAYER_IMAGE_TASK_CONTRACT.exportTarget,
        nativePsdReady: PSD_LAYER_IMAGE_TASK_CONTRACT.nativePsdReady,
        apiNativePsdSupported: false,
        source: 'photoshop',
        downloadAction: 'pending-native-packager',
      },
      ...(options.extraParams && Object.keys(options.extraParams).length > 0
        ? { params: options.extraParams }
        : {}),
    },
  }));
}
