/**
 * 灵感图 MCP 工具
 *
 * 生成创意灵感图：调用一次生图模型，生成不规则分割的拼贴图，
 * 然后以散落的横向布局插入画布，营造更有创意感的效果
 */

import type {
  MCPTool,
  MCPResult,
  MCPExecuteOptions,
  MCPTaskResult,
} from '../types';
import {
  INSPIRATION_BOARD_DEFAULTS,
} from '../../types/photo-wall.types';
import {
  createInspirationBoardTask as createInspirationBoardCanvasTask,
  type InspirationBoardParams as CanvasInspirationBoardParams,
} from '../../services/canvas-operations/inspiration-board';

/**
 * 灵感图工具参数
 */
export type InspirationBoardParams = CanvasInspirationBoardParams;

/**
 * 灵感图 MCP 工具定义
 */
export const inspirationBoardTool: MCPTool = {
  name: 'generate_inspiration_board',
  description: `灵感图生成工具。根据主题描述生成一组等大小的高质量图片，
以散落的横向布局插入画板，形成有创意感的灵感板效果。

生成策略（重要）：
- 生成紧凑的网格生产图（等大小图片 + 细分割线）
- 智能拆分后获得更多、更大的独立图片
- 拆分后以散落布局插入画布，营造创意效果

与宫格图的区别：
- 宫格图：整齐排列，适合展示类场景
- 灵感图：散落布局 + 随机旋转，更有创意感和艺术感

使用场景：
- 用户想要创建有创意感的灵感板、情绪板
- 用户想要生成主题相关的多角度、多风格图片集合
- 用户想要类似 Pinterest 或 Mood Board 的展示效果
- 用户提到"创意"、"灵感"、"艺术感"等关键词

工作原理：
1. 根据主题生成一张紧凑的网格拼贴图（等大图片 + 细白线分割）
2. 智能检测并按分割线拆分出各个独立图片
3. 以散落的横向布局计算位置（带旋转和层叠）
4. 批量插入到画板

不适用场景：
- 只想生成单张图片（使用 generate_image 工具）
- 想要整齐的网格排列（使用 generate_grid_image 工具）
- 想要生成视频（使用 generate_video 工具）`,

  inputSchema: {
    type: 'object',
    properties: {
      theme: {
        type: 'string',
        description:
          '灵感图主题描述，如"可爱香蕉的各种形态"、"咖啡文化"、"城市街角"等',
      },
      imageCount: {
        type: 'number',
        description: '图片数量，1-16 之间，默认 9',
        default: 9,
      },
      imageSize: {
        type: 'string',
        description: '生成图片的尺寸比例（建议横向）',
        enum: ['16x9', '3x2', '1x1'],
        default: '16x9',
      },
      imageQuality: {
        type: 'string',
        description: '图片质量',
        enum: ['1k', '2k', '4k'],
        default: '2k',
      },
      referenceImages: {
        type: 'array',
        description: '参考图片 URL 列表，用于风格参考',
        items: {
          type: 'string',
        },
      },
      model: {
        type: 'string',
        description: '图片生成模型，不指定时使用用户设置的模型',
      },
      modelRef: {
        type: 'object',
        description: '图片模型所属供应商与模型的稳定引用',
        properties: {
          profileId: { type: 'string' },
          modelId: { type: 'string' },
        },
        required: ['profileId', 'modelId'],
      },
    },
    required: ['theme'],
  },

  supportedModes: ['queue'],

  promptGuidance: {
    whenToUse:
      '当用户想要生成创意灵感图、灵感板、Mood Board 效果时使用。关键词：灵感图、灵感板、创意拼贴、艺术展示、Mood Board、Pinterest 风格。',

    parameterGuidance: {
      theme:
        '主题描述应该具体且有多样性潜力。好的主题：描述一类事物的多种变体、不同角度或不同场景。避免过于具体的单一描述。',
      imageCount:
        '1-16 张，会自动计算最优网格布局（如 9 张 = 3x3，12 张 = 3x4）。',
      imageSize: '建议使用 16x9 横向比例，生成更大尺寸的图片。',
    },

    bestPractices: [
      '主题应强调多样性和变化，如"咖啡的各种形态"而非"一杯咖啡"',
      '可以指定风格混搭，如"写实与插画混合"、"不同时代风格"',
      '描述具体的视觉元素，帮助 AI 生成更丰富的内容',
      '生成的是紧凑网格图，拆分后每张子图都是高质量大图',
    ],

    examples: [
      {
        input: '生成一个可爱香蕉的灵感图',
        args: {
          theme:
            '可爱香蕉的各种形态，包含卡通香蕉、写实香蕉、香蕉角色、香蕉图案等不同风格',
          imageCount: 9,
        },
        explanation: '生成 3x3 网格，拆分后 9 张等大图片以散落布局插入',
      },
      {
        input: '做个城市街角的 Mood Board',
        args: {
          theme:
            '城市街角，包含不同城市、不同时间、不同天气、不同风格的街角场景',
          imageCount: 8,
          imageSize: '16x9',
        },
        explanation: '生成 2x4 网格，横向布局更适合展示街景',
      },
    ],

    warnings: [
      '生成的是紧凑网格生产图，拆分后以散落布局插入画布',
      '实际图片数量取决于网格布局（如 7 张会调整为 2x4 = 8 张）',
      '建议使用横向比例（16x9）以获得更大的子图尺寸',
    ],
  },

  execute: async (
    params: Record<string, unknown>,
    options?: MCPExecuteOptions
  ): Promise<MCPResult> => {
    // taskQueueService 会根据 SW 可用性自动选择正确的服务
    return createInspirationBoardCanvasTask(
      params as unknown as InspirationBoardParams,
      options
    );
  },
};

/**
 * 便捷方法：创建灵感图任务
 */
export function createInspirationBoardTask(
  params: InspirationBoardParams,
  options?: Omit<MCPExecuteOptions, 'mode'>
): MCPTaskResult {
  return createInspirationBoardCanvasTask(params, options);
}
