import {
  TaskType,
  type GenerationParams,
  type KnowledgeContextRef,
} from '../../types/task.types';
import { DEFAULT_TEXT_MODEL_ID } from '../../constants/model-config';
import { extractJsonValue } from '../../utils/llm-json-extractor';
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

export interface PsdLayerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PsdLayerAnalysisLayer {
  name: string;
  type: PsdLayerType;
  include: string;
  exclude: string;
  description: string;
  stackingOrder: number;
  bounds?: PsdLayerBounds;
}

export interface PsdLayerAnalysisResult {
  title: string;
  summary: string;
  layers: PsdLayerAnalysisLayer[];
  warnings: string[];
}

export interface PsdLayerPlan {
  id: string;
  name: string;
  type: PsdLayerType;
  description: string;
  generationPrompt: string;
  include?: string;
  exclude?: string;
  stackingOrder?: number;
  bounds?: PsdLayerBounds;
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
  analysis?: {
    model: string;
    summary: string;
    warnings: string[];
    dynamicLayerCount: number;
  };
  exportSkeleton: {
    target: 'psd';
    source: 'photoshop';
    status: 'planned';
    sourceSetting: 'photoshop';
    packaging: 'app-side-required';
    nativePsdReady: false;
    apiNativePsdOutput: false;
    downloadWhenSupported: true;
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

export interface PsdLayerAnalysisTaskPlan {
  taskType: TaskType.CHAT;
  params: GenerationParams;
}

export interface PsdReadyImageTaskPlan {
  taskType: TaskType.IMAGE;
  params: GenerationParams;
}

export const PSD_LAYER_IMAGE_TASK_CONTRACT = {
  taskType: TaskType.IMAGE,
  generationMode: 'image_edit',
  background: 'auto',
  outputFormat: 'png',
  exportTarget: 'psd',
  exportSource: 'photoshop',
  sourceSetting: 'photoshop',
  packaging: 'app-side-required',
  nativePsdReady: false,
  apiNativePsdOutput: false,
  downloadWhenSupported: true,
  promptMetaTags: ['psd-layer-source', 'photoshop-export-source'],
} as const;

export const PSD_LAYER_ANALYSIS_MODEL_ID = DEFAULT_TEXT_MODEL_ID;

export const PSD_LAYER_EXTRACTION_PROMPT_ZH =
  '请将这张海报按视觉元素拆分成若干张独立图像，保持每个元素在原海报中的尺寸、比例、透明度和相对位置完全不变。每个导出的图层都使用与原图完全相同的画布尺寸和分辨率，元素保留在原始坐标位置，其余区域透明。确保所有图像导入 Photoshop 后无需移动、缩放或调整，即可按原位叠加还原完整海报。不要重复导出同一个标题、图标或文字组；不要用白底或棋盘格模拟透明。当前图片接口只返回 png/jpeg/webp 图片数据，不要宣称会直接返回原生 .psd 文件。';

export const PSD_LAYER_EXTRACTION_PROMPT_EN =
  'Split this poster into independent visual-element images while keeping every element at exactly the same size, proportion, opacity, relative position, and original coordinates as the source poster. Every exported layer must use the exact same canvas size and resolution as the original image, with every non-element area transparent. When all images are imported into Photoshop, they must stack in place without moving, scaling, or adjustment to reconstruct the full poster. Do not duplicate the same headline, icon, or text group across multiple layers; do not simulate transparency with a white or checkerboard background. The current image endpoint returns png/jpeg/webp image data, not a native .psd file.';

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
  layerCount: number,
  dynamicSeed = ''
): string {
  const source = `${prompt.trim()}|${template}|${strategy}|${layerCount}|${dynamicSeed}`;
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
      title: isZh ? 'gpt-5.5 高思考拆层' : 'gpt-5.5 reasoning split',
      description: isZh
        ? '先分析原图真实视觉结构，再给出互斥的动态图层计划。'
        : 'Analyze the real visual structure first, then produce a mutually exclusive dynamic layer plan.',
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
        ? '生成同画布透明 PNG 图层，供 Photoshop 原位叠放和后续 PSD 打包器写入。'
        : 'Generate same-canvas transparent PNG layers for Photoshop stacking and later PSD packer writing.',
      status: 'planned',
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readString(
  record: Record<string, unknown>,
  keys: string[],
  fallback = ''
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function clampPercent(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeLayerType(value: unknown): PsdLayerType {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('background') || raw.includes('背景')) return 'background';
  if (raw.includes('text') || raw.includes('文字') || raw.includes('标题')) {
    return 'text';
  }
  if (
    raw.includes('decor') ||
    raw.includes('shape') ||
    raw.includes('line') ||
    raw.includes('装饰') ||
    raw.includes('线')
  ) {
    return 'decoration';
  }
  if (raw.includes('adjust') || raw.includes('effect') || raw.includes('调整')) {
    return 'adjustment';
  }
  return 'image';
}

function normalizeLayerBounds(value: unknown): PsdLayerBounds | undefined {
  if (!isRecord(value)) return undefined;
  const left = readNumber(value, ['left', 'x']);
  const top = readNumber(value, ['top', 'y']);
  const width = readNumber(value, ['width', 'w']);
  const height = readNumber(value, ['height', 'h']);
  if (left === null || top === null || width === null || height === null) {
    return undefined;
  }

  const normalizedLeft = clampPercent(left);
  const normalizedTop = clampPercent(top);
  return {
    left: normalizedLeft,
    top: normalizedTop,
    width: clampPercent(width, 1, 100 - normalizedLeft || 1),
    height: clampPercent(height, 1, 100 - normalizedTop || 1),
  };
}

function getLayerBoundsFromRecord(record: Record<string, unknown>) {
  return (
    normalizeLayerBounds(record.expectedRegion) ||
    normalizeLayerBounds(record.region) ||
    normalizeLayerBounds(record.bounds) ||
    normalizeLayerBounds(record.boundingBox)
  );
}

function normalizeAnalysisLayers(
  rawLayers: unknown,
  language: 'zh' | 'en'
): PsdLayerAnalysisLayer[] {
  if (!Array.isArray(rawLayers)) return [];
  const isZh = language === 'zh';
  const seenNames = new Set<string>();

  return rawLayers
    .map<PsdLayerAnalysisLayer | null>((rawLayer, index) => {
      if (!isRecord(rawLayer)) return null;
      const name =
        readString(rawLayer, ['name', 'layerName', 'title']) ||
        (isZh ? `图层 ${index + 1}` : `Layer ${index + 1}`);
      const normalizedName = name.trim();
      if (!normalizedName || seenNames.has(normalizedName)) return null;
      seenNames.add(normalizedName);

      const include = readString(rawLayer, [
        'include',
        'content',
        'contains',
        'whatToKeep',
      ]);
      const exclude = readString(rawLayer, [
        'exclude',
        'excludes',
        'avoid',
        'whatToRemove',
      ]);
      const description =
        readString(rawLayer, ['description', 'prompt', 'notes']) ||
        [include, exclude ? `${isZh ? '排除' : 'Exclude'}: ${exclude}` : '']
          .filter(Boolean)
          .join('\n');
      const stackingOrder =
        readNumber(rawLayer, ['stackingOrder', 'order', 'zIndex']) || index + 1;
      const bounds = getLayerBoundsFromRecord(rawLayer);

      const layer: PsdLayerAnalysisLayer = {
        name: normalizedName,
        type: normalizeLayerType(rawLayer.type),
        include,
        exclude,
        description,
        stackingOrder,
      };
      if (bounds) {
        layer.bounds = bounds;
      }
      return layer;
    })
    .filter((layer): layer is PsdLayerAnalysisLayer => Boolean(layer))
    .sort((left, right) => left.stackingOrder - right.stackingOrder);
}

function isPsdLayerAnalysisPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Array.isArray(value.layers);
}

export function parsePsdLayerAnalysisResponse(
  response: unknown,
  language: 'zh' | 'en' = 'zh'
): PsdLayerAnalysisResult {
  const parsed =
    typeof response === 'string'
      ? extractJsonValue<Record<string, unknown>>(response, {
          kinds: ['object'],
          predicate: isPsdLayerAnalysisPayload,
        })
      : response;

  if (!isPsdLayerAnalysisPayload(parsed)) {
    throw new Error('PSD layer analysis response does not contain layers');
  }

  const layers = normalizeAnalysisLayers(parsed.layers, language);
  if (layers.length === 0) {
    throw new Error('PSD layer analysis response has no usable layers');
  }

  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : [];

  return {
    title:
      readString(parsed, ['title', 'posterTitle', 'name']) ||
      (language === 'zh' ? 'PSD 分层结果' : 'PSD layer result'),
    summary: readString(parsed, ['summary', 'rationale', 'analysis']),
    layers,
    warnings,
  };
}

function formatLayerBounds(bounds: PsdLayerBounds | undefined): string {
  if (!bounds) return '';
  return `x=${Math.round(bounds.left)}%, y=${Math.round(
    bounds.top
  )}%, w=${Math.round(bounds.width)}%, h=${Math.round(bounds.height)}%`;
}

function buildLayerAnalysisPrompt(
  options: {
    prompt: string;
    template: PsdTemplate;
    strategy: PsdLayerStrategy;
    language: 'zh' | 'en';
  }
): string {
  const isZh = options.language === 'zh';
  const userPrompt = options.prompt.trim();
  const schema = `{
  "title": "short poster/workspace title",
  "summary": "one sentence visual analysis",
  "layers": [
    {
      "name": "natural layer group name",
      "type": "background | image | text | decoration | adjustment",
      "include": "exact visible pixels/elements that belong in this layer",
      "exclude": "all other visible content that must stay out of this layer",
      "stackingOrder": 1,
      "expectedRegion": { "left": 0, "top": 0, "width": 100, "height": 100 }
    }
  ],
  "warnings": ["duplicate-risk or transparency notes"]
}`;

  if (isZh) {
    return [
      '你是 Photoshop 海报分层制作专家。请先完整分析原图，再给 Opentu 生成图片转 PSD 的动态图层计划。',
      '必须使用高思考/最高推理强度来理解画面结构；不要立即生成图片，也不要输出 Photoshop 文件。',
      `用户需求：${userPrompt || '将上传图片拆分为 PSD 分层文件'}`,
      `模板线索：${getTemplateLabel(options.template, options.language)}；策略：${options.strategy}。这些只是线索，不是固定模板。`,
      '核心 PSD 语义：每个导出的图层最终都必须使用与原图完全相同的画布尺寸和分辨率；元素保留原始坐标、尺寸、比例、透明度和相对位置，其余区域透明。',
      '不要使用固定 8 层模板。图层数量必须由图片里实际存在的视觉元素决定，通常 4-12 层；不要编造图片中不存在的 Logo、主体、辅助文字或光影层。',
      '图层必须互斥：同一个主标题、图标、地图、列表、坐标、装饰线或正文模块只能属于一个图层。主体层不得夹带标题；标题层不得生成第二份不同大小的标题。',
      '文字组规则：视觉上紧密绑定的主标题、英文副标题和短说明可以合并为一个文字组；列表模块可以按模块分组，不要机械拆成每个字。',
      '背景层规则：如果需要背景层，它只包含底色/照片/纹理/大面积氛围，不包含任何前景文字、图标、地图、线条或信息模块。',
      'expectedRegion 使用百分比坐标，left/top/width/height 范围 0-100，用来让前端高亮选择区域；无法精确时给出近似包围盒。',
      '只返回严格 JSON，不要 markdown，不要解释。JSON 结构如下：',
      schema,
    ].join('\n');
  }

  return [
    'You are a Photoshop poster-layering specialist. First analyze the source image, then produce a dynamic layer plan for Opentu image-to-PSD.',
    'Use high reasoning effort to understand the image structure; do not generate images and do not output a Photoshop file.',
    `User request: ${userPrompt || 'split the uploaded image into PSD-ready layers'}`,
    `Template hint: ${getTemplateLabel(options.template, options.language)}; strategy: ${options.strategy}. These are hints, not a fixed template.`,
    'Core PSD semantics: every exported layer must use the exact same canvas size and resolution as the original; each element keeps original coordinates, size, proportion, opacity, and relative position; all other pixels are transparent.',
    'Do not use a fixed 8-layer template. The layer count must come from the real visual elements in the image, usually 4-12 layers. Do not invent absent logos, subjects, helper text, or lighting layers.',
    'Layers must be mutually exclusive: the same headline, icon, map, list, coordinates, rule, or body module belongs to one layer only. Subject layers must not include headlines; text layers must not create a second differently sized headline.',
    'Text-group rule: visually attached headline, English subtitle, and short descriptor may be one text group. List modules may be grouped by module; do not mechanically split every character.',
    'Background rule: if a background layer is needed, it contains only base color/photo/texture/large atmosphere and excludes all foreground text, icons, maps, rules, or info modules.',
    'expectedRegion uses percentage coordinates, left/top/width/height in 0-100, so the frontend can highlight selectable regions. Give an approximate bounding box when exact bounds are impossible.',
    'Return strict JSON only, no markdown and no explanation. Use this shape:',
    schema,
  ].join('\n');
}

export function buildPsdLayerAnalysisTaskPlan(options: {
  prompt: string;
  template: PsdTemplate;
  strategy: PsdLayerStrategy;
  language: 'zh' | 'en';
  model?: string;
  modelRef?: ModelRef | null;
  uploadedImages?: ReferenceImage[];
  knowledgeContextRefs?: KnowledgeContextRef[];
}): PsdLayerAnalysisTaskPlan {
  const model = options.model || PSD_LAYER_ANALYSIS_MODEL_ID;
  const referenceImages = (options.uploadedImages || [])
    .map((image) => image.url)
    .filter(Boolean);

  return {
    taskType: TaskType.CHAT,
    params: {
      prompt: buildLayerAnalysisPrompt(options),
      model,
      modelRef: options.modelRef || null,
      referenceImages,
      knowledgeContextRefs: options.knowledgeContextRefs || [],
      autoInsertToCanvas: false,
      params: {
        reasoning_effort: 'high',
        psdLayerAnalysis: true,
        responseIntent: 'json',
        temperature: 0.1,
        max_tokens: 4000,
      },
      promptMeta: {
        category: 'text',
        title:
          options.language === 'zh'
            ? 'PSD 图层高思考分析'
            : 'PSD high-reasoning layer analysis',
        tags: ['psd-layer-analysis', 'gpt-5.5', 'high-reasoning'],
        knowledgeContextRefs: options.knowledgeContextRefs || [],
      },
    },
  };
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
        ? '文字视觉必须作为同画布透明栅格层完整保留，同时记录为后续可编辑文字层的重建参考。'
        : 'Preserve the visible text as a same-canvas transparent raster layer, while keeping it as a reconstruction reference for later editable text.'
      : null,
    textPolicy.avoidBakedText
      ? isZh
        ? '不要把文字合并进背景或主体层；文字图层以原始坐标、尺寸、透明度单独输出。'
        : 'Do not merge text into the background or subject layer; output text separately at its original coordinates, size, and opacity.'
      : null,
    isZh
      ? '同一段标题、说明或编号只能出现在它所属的一个图层里，不要在其他图层里再次生成。'
      : 'The same headline, caption, or numbered copy may appear only in its owning layer; do not regenerate it in any other layer.',
  ].filter(Boolean);

  return [description, ...policyNotes].join('\n');
}

function buildPosterLayerSeeds(
  basePrompt: string,
  templateLabel: string,
  isZh: boolean
): Array<
  Omit<
    PsdLayerPlan,
    'id' | 'visible' | 'generationPrompt' | 'opacity' | 'status'
  >
> {
  return [
    {
      name: isZh ? '背景底图' : 'Background plate',
      type: 'background',
      description: isZh
        ? `提取“${
            basePrompt || templateLabel
          }”中的完整底图、照片/插画场景、底色和大面积氛围。不要包含任何标题、正文、坐标、地图、图标、页眉线、页脚装饰或前景文字元素。`
        : `Extract the complete background plate, photo/illustration scene, base colors, and broad atmosphere from “${
            basePrompt || templateLabel
          }”. Do not include headline, body copy, coordinates, map, icons, header rules, footer decoration, or foreground text elements.`,
      locked: true,
    },
    {
      name: isZh ? '标题文字组' : 'Headline text group',
      type: 'text',
      description: isZh
        ? '只提取主标题以及紧贴主标题的品类名/副标题/短说明，作为一个完整文字组保留在原坐标。不要把主标题拆到其他图层，也不要单独再生成一个不同大小的标题副本。'
        : 'Extract only the main headline plus the closely attached category/subtitle/short descriptor as one complete text group at original coordinates. Do not split the main headline into other layers or generate another differently sized headline copy.',
    },
    {
      name: isZh ? '顶部页眉与装饰线' : 'Top header and rules',
      type: 'decoration',
      description: isZh
        ? '提取顶部小字、城市/地区标识、横线、角落建筑线稿等页眉装饰组，保持原始位置和细线透明度。不要包含主标题。'
        : 'Extract top micro-copy, city/region marks, horizontal rules, corner line-art buildings, and related header decoration at original position and opacity. Do not include the main headline.',
    },
    {
      name: isZh ? '坐标标注组' : 'Coordinate label group',
      type: 'decoration',
      description: isZh
        ? '提取左上或画面中的经纬度、定位图标、引线和坐标标签组，保持原始大小、位置和透明度。不要包含地图轮廓或正文列表。'
        : 'Extract the latitude/longitude copy, pin icon, leader line, and coordinate label group at original size, position, and opacity. Do not include the map outline or body lists.',
    },
    {
      name: isZh ? '地图定位标识' : 'Map locator mark',
      type: 'image',
      description: isZh
        ? '提取地图轮廓、定位圆点、地名标注和相关引线组成的地图标识组，保持原始坐标。不要包含坐标文字或正文列表。'
        : 'Extract the map outline, locator dot, place label, and related leader lines as one map mark group at original coordinates. Do not include coordinate copy or body lists.',
    },
    {
      name: isZh ? '必游地标文字组' : 'Landmark list text group',
      type: 'text',
      description: isZh
        ? '提取“必游地标”等左侧信息模块，包括模块图标、标题、编号圆点和该模块正文列表。只保留这一组内容，不要包含城市气质模块或主标题。'
        : 'Extract the left information module such as “must-see landmarks”, including its module icon, heading, numbered dots, and body list. Keep only this group, excluding the city-character module and main headline.',
    },
    {
      name: isZh ? '城市气质文字组' : 'City character text group',
      type: 'text',
      description: isZh
        ? '提取“城市气质”等右侧信息模块，包括模块图标、标题、编号圆点和该模块正文列表。只保留这一组内容，不要包含必游地标模块或主标题。'
        : 'Extract the right information module such as “city character”, including its module icon, heading, numbered dots, and body list. Keep only this group, excluding the landmark module and main headline.',
    },
    {
      name: isZh ? '底部装饰与脚注' : 'Bottom decoration and notes',
      type: 'decoration',
      description: isZh
        ? '提取底部建筑线稿、分隔线、脚注小字、装饰点和页脚视觉元素。不要包含背景照片、主标题或两个信息模块。'
        : 'Extract bottom line-art buildings, dividers, footnote micro-copy, decorative dots, and footer visuals. Do not include the background photo, main headline, or the two information modules.',
    },
  ];
}

function buildGenericLayerSeeds(
  basePrompt: string,
  template: PsdTemplate,
  templateLabel: string,
  isZh: boolean
): Array<
  Omit<
    PsdLayerPlan,
    'id' | 'visible' | 'generationPrompt' | 'opacity' | 'status'
  >
> {
  return [
    {
      name: isZh ? '背景层' : 'Background',
      type: 'background',
      description: isZh
        ? `提取“${
            basePrompt || templateLabel
          }”中的背景底图、场景、色块和大面积氛围，不包含主体、文字或前景元素。`
        : `Extract the background image, scene, color fields, and broad atmosphere from “${
            basePrompt || templateLabel
          }” without including subject, text, or foreground elements.`,
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
        ? '提取海报中的主要人物、产品或核心视觉对象，保持原始尺寸、边缘、遮挡关系和透明度。不要包含标题文字。'
        : 'Extract the primary person, product, or hero visual object while preserving original size, edges, occlusion, and opacity. Do not include headline text.',
    },
    {
      name: isZh ? '标题文字图层' : 'Headline text layer',
      type: 'text',
      description: isZh
        ? '从原海报中提取标题文字的可见像素，保持原始坐标、尺寸、透明度，其余区域透明。不要在主体层或辅助文字层重复标题。'
        : 'Extract the visible pixels of the headline text from the source poster at original coordinates, size, and opacity with transparency elsewhere. Do not duplicate the headline in the subject or support-copy layers.',
    },
    {
      name: isZh ? '辅助文字图层' : 'Supporting text layer',
      type: 'text',
      description: isZh
        ? '提取副标题、卖点、日期、价格或说明文字等次级文案的可见像素，保持原位透明图层。不要包含主标题。'
        : 'Extract subtitles, selling points, dates, prices, or helper copy as visible pixels in their original in-place transparent layer. Do not include the main headline.',
    },
    {
      name: isZh ? 'Logo/标识' : 'Logo and marks',
      type: 'image',
      description: isZh
        ? '提取品牌 Logo、角标、印章、水印或图形标识，保持与原海报完全一致的位置和透明度。'
        : 'Extract brand logos, badges, seals, watermarks, or graphic marks with their exact original position and opacity.',
    },
    {
      name: isZh ? '装饰元素' : 'Decorations',
      type: 'decoration',
      description: isZh
        ? '提取贴纸、几何图形、纹理、线条等装饰性视觉元素，作为可单独显隐的同画布透明图层。'
        : 'Extract stickers, geometric shapes, textures, lines, and other decorative visuals as independently toggleable same-canvas transparent layers.',
    },
    {
      name: isZh ? '前景强调' : 'Foreground accents',
      type: 'decoration',
      description: isZh
        ? '提取压在主体或文字上方的前景元素、遮挡物、边框或局部强调效果。'
        : 'Extract foreground elements, occluders, frames, or local emphasis effects that sit above the subject or text.',
    },
    {
      name: isZh ? '光影/氛围效果' : 'Lighting and atmosphere',
      type: 'decoration',
      description: isZh
        ? '提取阴影、辉光、烟雾、粒子、渐隐光斑等叠加效果，保留原始透明度和混合观感。'
        : 'Extract shadows, glows, haze, particles, fading light spots, and other overlay effects while preserving opacity and blend appearance.',
    },
  ];
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
  const layerSeeds =
    template === 'poster'
      ? buildPosterLayerSeeds(basePrompt, templateLabel, isZh)
      : buildGenericLayerSeeds(basePrompt, template, templateLabel, isZh);

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
      sourceSetting: 'photoshop',
      packaging: 'app-side-required',
      nativePsdReady: false,
      apiNativePsdOutput: false,
      downloadWhenSupported: true,
    },
    workflowSteps: buildPsdWorkflowSteps(language),
  };
}

export function buildLayerPlanFromAnalysis(
  analysis: PsdLayerAnalysisResult,
  options: {
    prompt: string;
    template: PsdTemplate;
    strategy: PsdLayerStrategy;
    language: 'zh' | 'en';
    textPolicy?: PsdGenerationPlan['textPolicy'];
    analysisModel?: string;
  }
): PsdGenerationPlan {
  const textPolicy = options.textPolicy || {
    preferEditableText: true,
    avoidBakedText: true,
  };
  const dynamicSeed = analysis.layers
    .map((layer) =>
      [
        layer.name,
        layer.type,
        layer.include,
        layer.exclude,
        layer.stackingOrder,
        formatLayerBounds(layer.bounds),
      ].join(':')
    )
    .join('|');
  const title =
    analysis.title ||
    options.prompt.trim() ||
    (options.language === 'zh' ? 'PSD 分层结果' : 'PSD layer result');

  return {
    planId: createStablePlanId(
      options.prompt,
      options.template,
      options.strategy,
      analysis.layers.length,
      dynamicSeed
    ),
    title,
    template: options.template,
    strategy: options.strategy,
    textPolicy,
    analysis: {
      model: options.analysisModel || PSD_LAYER_ANALYSIS_MODEL_ID,
      summary: analysis.summary,
      warnings: analysis.warnings,
      dynamicLayerCount: analysis.layers.length,
    },
    layers: analysis.layers.map((layer, index) => {
      const boundsText = formatLayerBounds(layer.bounds);
      const description = [
        layer.description || layer.include,
        layer.include
          ? options.language === 'zh'
            ? `包含：${layer.include}`
            : `Include: ${layer.include}`
          : '',
        layer.exclude
          ? options.language === 'zh'
            ? `排除：${layer.exclude}`
            : `Exclude: ${layer.exclude}`
          : '',
        boundsText
          ? options.language === 'zh'
            ? `分析区域：${boundsText}`
            : `Analyzed region: ${boundsText}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      return {
        id: `psd-layer-${index + 1}`,
        name: layer.name,
        type: layer.type,
        description,
        generationPrompt:
          layer.type === 'text'
            ? buildTextLayerPrompt(description, textPolicy, options.language)
            : description,
        include: layer.include,
        exclude: layer.exclude,
        stackingOrder: layer.stackingOrder,
        bounds: layer.bounds,
        visible: true,
        opacity: 100,
        status: 'planned',
        locked: layer.type === 'background',
      };
    }),
    exportSkeleton: {
      target: 'psd',
      source: 'photoshop',
      status: 'planned',
      sourceSetting: 'photoshop',
      packaging: 'app-side-required',
      nativePsdReady: false,
      apiNativePsdOutput: false,
      downloadWhenSupported: true,
    },
    workflowSteps: buildPsdWorkflowSteps(options.language),
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
  language?: 'zh' | 'en';
}

function buildPsdPromptSections(
  plan: PsdGenerationPlan,
  language: 'zh' | 'en'
): string[] {
  const layerGuide = plan.layers
    .map((layer, index) => {
      const boundsText = formatLayerBounds(layer.bounds);
      return `${index + 1}. ${layer.name}: ${layer.description}${
        boundsText ? `\n   ${language === 'zh' ? '区域' : 'Region'}: ${boundsText}` : ''
      }`;
    })
    .join('\n');

  if (language === 'zh') {
    return [
      '[PSD-ready workflow]',
      plan.title,
      '请按 Opentu 图片转 PSD 工作流处理：用户提供参考图和提示词，系统自动理解图像并生成可用于后续 Photoshop 分层打包的结果。',
      plan.analysis
        ? `图层计划来源：${plan.analysis.model} 高思考视觉分析；本次根据图片动态识别出 ${plan.analysis.dynamicLayerCount} 个互斥图层，不使用固定模板。`
        : '图层计划来源：本地占位计划，仅用于无模型分析时的草稿。',
      '核心 PSD 语义：按视觉元素拆成若干独立图像，每个导出图层都使用与原图完全相同的画布尺寸和分辨率。',
      '图层内容要求：元素必须保留原始尺寸、比例、透明度、相对位置和原始坐标，其余区域保持透明。',
      'Photoshop 叠放要求：所有图层导入 Photoshop 后无需移动、缩放或调整，即可按原位叠加还原完整海报。',
      '拆层意图：请按互斥的视觉元素组组织结果；同一个标题、图标、地图或正文模块只能出现在一个图层里，避免重复标题、错位标题或不同字号副本。',
      '透明要求：除背景底图外，每个图层都应是真透明 PNG；不要输出白底、灰底或棋盘格来假装透明。',
      '建议图层结构：',
      layerGuide,
      '重要限制：当前图片接口返回图片数据，不会直接返回原生 .psd；不要在图像或元数据里伪装已生成原生 PSD 下载。',
    ];
  }

  return [
    '[PSD-ready workflow]',
    plan.title,
    'Handle this with the Opentu image-to-PSD workflow: the user supplies a reference image and prompt, while the app automatically prepares a result suitable for later Photoshop layer packaging.',
    plan.analysis
      ? `Layer plan source: ${plan.analysis.model} high-reasoning visual analysis; this image produced ${plan.analysis.dynamicLayerCount} mutually exclusive dynamic layers, not a fixed template.`
      : 'Layer plan source: local placeholder plan for draft use when model analysis is unavailable.',
    'Core PSD semantics: split the poster into independent visual-element images; every exported layer must use the exact same canvas size and resolution as the original.',
    'Layer content requirement: preserve each element at its original size, proportion, opacity, relative position, and original coordinates; keep every other area transparent.',
    'Photoshop stacking requirement: when all layers are imported into Photoshop, they must reconstruct the complete poster by stacking in place without moving, scaling, or adjustment.',
    'Layering intent: organize results as mutually exclusive visual-element groups; the same headline, icon, map, or body-copy module may appear in one layer only, avoiding duplicate headlines, shifted headlines, or differently sized copies.',
    'Transparency requirement: except for the background plate, every layer should be a real transparent PNG; do not use a white, gray, or checkerboard background to fake transparency.',
    'Suggested layer structure:',
    layerGuide,
    'Important limitation: the current image endpoint returns image data, not a native .psd; do not pretend a native PSD download has already been generated.',
  ];
}

function stripUnsupportedGPTImage2Params(
  params: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!params) return undefined;
  const next = { ...params };
  delete next.inputFidelity;
  delete next.input_fidelity;
  delete next.response_format;
  if (next.background === 'transparent') {
    next.background = 'auto';
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function buildPsdReadyImageTaskPlan(
  plan: PsdGenerationPlan,
  options: BuildPsdLayerImageTaskPlansOptions & { language?: 'zh' | 'en' }
): PsdReadyImageTaskPlan {
  const sanitizedExtraParams = stripUnsupportedGPTImage2Params(
    options.extraParams
  );
  const batchId = `${plan.planId}-psd-ready`;

  return {
    taskType: PSD_LAYER_IMAGE_TASK_CONTRACT.taskType,
    params: {
      prompt: buildPsdPromptSections(plan, options.language || 'zh').join('\n'),
      width: options.width,
      height: options.height,
      size: options.size,
      model: options.model,
      modelRef: options.modelRef || null,
      generationMode: PSD_LAYER_IMAGE_TASK_CONTRACT.generationMode,
      background: PSD_LAYER_IMAGE_TASK_CONTRACT.background,
      outputFormat: PSD_LAYER_IMAGE_TASK_CONTRACT.outputFormat,
      uploadedImages: options.uploadedImages || [],
      referenceImages: (options.uploadedImages || []).map((image) => image.url),
      knowledgeContextRefs: options.knowledgeContextRefs || [],
      autoInsertToCanvas: false,
      batchId,
      batchIndex: 1,
      batchTotal: 1,
      promptMeta: {
        category: 'image',
        title: `${plan.title} · PSD-ready`,
        tags: [...PSD_LAYER_IMAGE_TASK_CONTRACT.promptMetaTags, 'psd-ready'],
        knowledgeContextRefs: options.knowledgeContextRefs || [],
      },
      assetMetadata: {
        category: 'GENERAL',
      },
      psdPlan: {
        planId: plan.planId,
        planTitle: plan.title,
        layerId: 'psd-ready-composite',
        layerName: 'PSD-ready composite',
        layerType: 'image',
        suggestedLayers: plan.layers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          type: layer.type,
          description: layer.description,
          bounds: layer.bounds,
          include: layer.include,
          exclude: layer.exclude,
        })),
        textPolicy: plan.textPolicy,
        exportTarget: PSD_LAYER_IMAGE_TASK_CONTRACT.exportTarget,
        exportSource: PSD_LAYER_IMAGE_TASK_CONTRACT.exportSource,
        sourceSetting: PSD_LAYER_IMAGE_TASK_CONTRACT.sourceSetting,
        packaging: PSD_LAYER_IMAGE_TASK_CONTRACT.packaging,
        nativePsdReady: PSD_LAYER_IMAGE_TASK_CONTRACT.nativePsdReady,
        apiNativePsdOutput: PSD_LAYER_IMAGE_TASK_CONTRACT.apiNativePsdOutput,
        downloadWhenSupported:
          PSD_LAYER_IMAGE_TASK_CONTRACT.downloadWhenSupported,
      },
      ...(sanitizedExtraParams ? { params: sanitizedExtraParams } : {}),
    },
  };
}

export function buildPsdLayerImageTaskPlans(
  plan: PsdGenerationPlan,
  options: BuildPsdLayerImageTaskPlansOptions
): PsdLayerImageTaskPlan[] {
  const isZh = options.language === 'zh';
  const visualLayers = plan.layers.filter(
    (layer) => layer.visible && layer.type !== 'adjustment'
  );

  return visualLayers.map((layer, index) => {
    const currentLayerBounds = formatLayerBounds(layer.bounds);
    const excludedLayerGuide = visualLayers
      .filter((candidate) => candidate.id !== layer.id)
      .map(
        (candidate, candidateIndex) => {
          const boundsText = formatLayerBounds(candidate.bounds);
          return `${candidateIndex + 1}. ${candidate.name}: ${
            candidate.description
          }${boundsText ? ` (${boundsText})` : ''}`;
        }
      )
      .join('\n');

    return {
      layerId: layer.id,
      layerName: layer.name,
      taskType: PSD_LAYER_IMAGE_TASK_CONTRACT.taskType,
      params: {
        prompt: [
          isZh
            ? `[PSD 同画布图层：${layer.name}]`
            : `[PSD same-canvas layer: ${layer.name}]`,
          plan.title,
          isZh ? '当前图层定义：' : 'Current layer definition:',
          layer.description,
          plan.analysis
            ? isZh
              ? `图层计划来源：${plan.analysis.model} 高思考图片分析；严格服从分析出的动态图层，不要套用固定 8 层结构。`
              : `Layer plan source: ${plan.analysis.model} high-reasoning image analysis; strictly follow the dynamic layers and do not apply a fixed 8-layer structure.`
            : null,
          currentLayerBounds
            ? isZh
              ? `模型分析区域：${currentLayerBounds}。这是选择/高亮参考，不是裁切范围；输出仍必须是整张同画布。`
              : `Analyzed region: ${currentLayerBounds}. This is a selection/highlight hint, not a crop; output must still be the whole same canvas.`
            : null,
          isZh
            ? '工作流：先理解原始海报中的独立视觉元素，再只导出当前这一层，供 Opentu 后续打包为 Photoshop/PSD 工作区。'
            : 'Workflow: understand independent visual elements in the source poster, then export only this one layer for later Opentu Photoshop/PSD packaging.',
          isZh
            ? '任务：只输出当前图层/视觉元素，格式为带真实透明背景的 PNG 图像。'
            : 'Task: export ONLY this layer/visual element as a PNG image with real transparency.',
          layer.type === 'background'
            ? isZh
              ? '背景层例外：背景底图可以覆盖完整画布，但必须排除所有文字、图标、地图、线条和其他前景视觉组。'
              : 'Background exception: the background plate may cover the whole canvas, but it must exclude all text, icons, maps, rules, and foreground visual groups.'
            : null,
          layer.type === 'text'
            ? isZh
              ? '文字图层要求：提取原海报中该文字组的可见像素，不要改写文案、字体外观、位置或透明度，也不要把它合并进其他层。'
              : 'Text layer requirement: extract the visible pixels of this exact text group from the poster without rewriting copy, changing typography, position, or opacity, and do not merge it into other layers.'
            : null,
          isZh
            ? '互斥要求：不要输出以下其他图层的任何内容；如果某个标题、图标或列表已经属于其他图层，本图层必须保持透明。'
            : 'Mutual-exclusion requirement: do not output any content belonging to the other layers below; if a headline, icon, or list belongs to another layer, keep this layer transparent in that area.',
          excludedLayerGuide,
          isZh
            ? '同画布硬性要求：输出图片必须与原海报使用完全相同的画布尺寸和分辨率，不得裁切成局部小图。'
            : 'Same-canvas hard requirement: the output image must use the exact same canvas size and resolution as the original poster; do not crop it into a local asset.',
          isZh
            ? '原位硬性要求：元素必须保留在原始坐标位置，保持原始尺寸、比例、透明度和相对位置，其余区域全部透明。'
            : 'In-place hard requirement: keep the element at its original coordinates with original size, proportion, opacity, and relative position; every other area must be transparent.',
          isZh
            ? '透明硬性要求：除当前图层元素像素外，不要填充白色、灰色、纯色背景或棋盘格；如果当前图层在原图中不存在，请输出同画布全透明 PNG。'
            : 'Transparency hard requirement: except for pixels of this layer element, do not fill white, gray, solid color, or checkerboard backgrounds; if this layer does not exist in the source, output a same-canvas fully transparent PNG.',
          isZh
            ? 'Photoshop 叠放要求：所有导出的图层图像导入 Photoshop 后，无需移动、缩放或调整，即可按原位叠加还原完整海报。'
            : 'Photoshop stacking requirement: when all exported layer images are imported into Photoshop, they must restore the complete poster by stacking in place without moving, scaling, or adjustment.',
          isZh
            ? '边界说明：不要声称或嵌入原生 PSD 文件；这里只生成单个同画布透明图层图像，供后续应用侧 PSD 打包。'
            : 'Boundary: do not claim or embed a native PSD file; generate one same-canvas transparent layer image for later app-side PSD packaging.',
        ]
          .filter(Boolean)
          .join('\n'),
      width: options.width,
      height: options.height,
      size: options.size,
      model: options.model,
      modelRef: options.modelRef || null,
      generationMode: PSD_LAYER_IMAGE_TASK_CONTRACT.generationMode,
      background: PSD_LAYER_IMAGE_TASK_CONTRACT.background,
      outputFormat: PSD_LAYER_IMAGE_TASK_CONTRACT.outputFormat,
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
        exportSource: PSD_LAYER_IMAGE_TASK_CONTRACT.exportSource,
        sourceSetting: PSD_LAYER_IMAGE_TASK_CONTRACT.sourceSetting,
        packaging: PSD_LAYER_IMAGE_TASK_CONTRACT.packaging,
        nativePsdReady: PSD_LAYER_IMAGE_TASK_CONTRACT.nativePsdReady,
        apiNativePsdOutput: PSD_LAYER_IMAGE_TASK_CONTRACT.apiNativePsdOutput,
        downloadWhenSupported:
          PSD_LAYER_IMAGE_TASK_CONTRACT.downloadWhenSupported,
      },
      ...(stripUnsupportedGPTImage2Params(options.extraParams)
        ? { params: stripUnsupportedGPTImage2Params(options.extraParams) }
        : {}),
      },
    };
  });
}
