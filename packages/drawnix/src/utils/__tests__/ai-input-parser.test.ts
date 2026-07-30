import { describe, it, expect, vi } from 'vitest';
import {
  parseAIInput,
  generateDefaultPrompt,
  getAlignedImageDimensions,
  shouldUseAgentFlow,
  type SelectionInfo,
} from '../ai-input-parser';

// Keep the complete settings-manager contract because parser dependencies also
// resolve provider-aware video defaults through the same module.
vi.mock('../settings-manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../settings-manager')>();

  return {
    ...actual,
    geminiSettings: {
      ...actual.geminiSettings,
      get: vi.fn(() => ({
        imageModelName: 'gemini-3-pro-image-preview',
        videoModelName: 'veo-3',
        audioModelName: 'suno_music',
        textModelName: 'deepseek-v3.2',
      })),
    },
  };
});

// Helper function
const createSelection = (texts: string[] = [], imageCount = 0): SelectionInfo => ({
  texts,
  images: Array(imageCount).fill('mock-image-url'),
  videos: [],
  graphics: [],
});

describe('ai-input-parser', () => {
  describe('getAlignedImageDimensions', () => {
    it('尺寸缺失时保留索引占位，避免后续图片尺寸错配', () => {
      expect(
        getAlignedImageDimensions([
          {},
          { width: 1920, height: 1080 },
        ])
      ).toEqual([undefined, { width: 1920, height: 1080 }]);
    });
  });

  describe('generateDefaultPrompt', () => {
    it('应该在有选中文字时返回合并的文字', () => {
      const result = generateDefaultPrompt(true, ['Hello', 'World'], 0);
      expect(result).toBe('Hello\nWorld');
    });

    it('应该在有单张图片但无文字时返回分析单图的提示词', () => {
      const result = generateDefaultPrompt(true, [], 1);
      expect(result).toContain('分析这张图片');
      expect(result).toContain('推测');
    });

    it('应该在有多张图片但无文字时返回融合多图的提示词', () => {
      const result = generateDefaultPrompt(true, [], 3);
      expect(result).toContain('分析这些图片');
      expect(result).toContain('融合');
    });

    it('应该在无选中元素时返回空字符串', () => {
      const result = generateDefaultPrompt(false, [], 0);
      expect(result).toBe('');
    });

    it('应该优先使用文字而非图片数量', () => {
      const result = generateDefaultPrompt(true, ['Custom prompt'], 5);
      expect(result).toBe('Custom prompt');
    });
  });

  describe('shouldUseAgentFlow', () => {
    it('应该在有额外文字内容时返回 true', () => {
      expect(shouldUseAgentFlow('请帮我生成一张猫的图片')).toBe(true);
    });

    it('应该把未由 UI 消费的模型标记当作普通文字', () => {
      expect(shouldUseAgentFlow('#gemini-3-pro-image-preview')).toBe(true);
    });

    it('应该把未由 UI 消费的参数标记当作普通文字', () => {
      expect(shouldUseAgentFlow('-size=1024x768')).toBe(true);
    });

    it('应该把未由 UI 消费的数量标记当作普通文字', () => {
      expect(shouldUseAgentFlow('+3')).toBe(true);
    });

    it('应该在只有空白文字时返回 false', () => {
      expect(shouldUseAgentFlow(' \n\t ')).toBe(false);
    });

    it('应该在标记样式文字后有内容时返回 true', () => {
      expect(shouldUseAgentFlow('#gemini-3-pro-image-preview 一只可爱的猫')).toBe(true);
    });

    it('应该在空输入时返回 false', () => {
      expect(shouldUseAgentFlow('')).toBe(false);
    });
  });

  describe('parseAIInput', () => {
    describe('场景判断', () => {
      it('场景1: 只有选中元素，没有输入文字 -> direct_generation', () => {
        const result = parseAIInput('', createSelection(['猫'], 1));
        expect(result.scenario).toBe('direct_generation');
        expect(result.hasExtraContent).toBe(false);
      });

      it('场景2: UI 显式选择生成类型 -> direct_generation', () => {
        const result = parseAIInput('一只可爱的猫', createSelection([], 1), {
          generationType: 'image',
          modelId: 'gemini-3-pro-image-preview',
          params: { size: '1024x768' },
        });
        expect(result.scenario).toBe('direct_generation');
        expect(result.hasExtraContent).toBe(true);
      });

      it('场景3: UI 显式指定数量 -> direct_generation', () => {
        const result = parseAIInput('', createSelection([], 1), {
          generationType: 'image',
          count: 4,
        });
        expect(result.scenario).toBe('direct_generation');
        expect(result.hasExtraContent).toBe(false);
      });

      it('场景4: 输入内容包含其他内容 -> agent_flow', () => {
        const result = parseAIInput('请生成一张可爱的猫的图片', createSelection([], 0));
        expect(result.scenario).toBe('agent_flow');
        expect(result.hasExtraContent).toBe(true);
      });

      it('显式 Agent 模式始终进入 agent_flow', () => {
        const result = parseAIInput('一只可爱的猫', createSelection([], 1), {
          generationType: 'agent',
          modelId: 'deepseek-v3.2',
        });
        expect(result.scenario).toBe('agent_flow');
        expect(result.hasExtraContent).toBe(true);
      });
    });

    describe('生成类型判断', () => {
      it('默认应该是图片生成', () => {
        const result = parseAIInput('', createSelection([], 1));
        expect(result.generationType).toBe('image');
      });

      it('选择图片模型时应该是图片生成', () => {
        const result = parseAIInput('', createSelection([], 1), {
          modelId: 'gemini-3-pro-image-preview',
        });
        expect(result.generationType).toBe('image');
        expect(result.modelId).toBe('gemini-3-pro-image-preview');
      });

      it('选择视频模型时应该是视频生成', () => {
        const result = parseAIInput('', createSelection([], 1), {
          modelId: 'veo3',
        });
        expect(result.generationType).toBe('video');
        expect(result.modelId).toBe('veo3');
      });
    });

    describe('提示词处理', () => {
      it('应该使用输入文字作为提示词', () => {
        const result = parseAIInput('一只可爱的猫', createSelection([], 1), {
          generationType: 'image',
          modelId: 'gemini-3-pro-image-preview',
        });
        expect(result.prompt).toBe('一只可爱的猫');
      });

      it('无输入时应该使用选中文字作为提示词', () => {
        const result = parseAIInput('', createSelection(['猫咪', '可爱'], 0));
        expect(result.prompt).toBe('猫咪\n可爱');
      });

      it('无输入无文字但有单张图片时应该生成默认提示词', () => {
        const result = parseAIInput('', createSelection([], 1));
        expect(result.prompt).toContain('分析这张图片');
      });

      it('无输入无文字但有多张图片时应该生成融合提示词', () => {
        const result = parseAIInput('', createSelection([], 3));
        expect(result.prompt).toContain('分析这些图片');
      });
    });

    describe('数量解析', () => {
      it('默认数量应该是 1', () => {
        const result = parseAIInput('', createSelection([], 1));
        expect(result.count).toBe(1);
      });

      it('应该采用 UI 传入的数量 2', () => {
        const result = parseAIInput('', createSelection([], 1), { count: 2 });
        expect(result.count).toBe(2);
      });

      it('应该采用 UI 传入的数量 10', () => {
        const result = parseAIInput('', createSelection([], 1), { count: 10 });
        expect(result.count).toBe(10);
      });

      it('模型与数量应通过同一 options 契约传入', () => {
        const result = parseAIInput('', createSelection([], 1), {
          modelId: 'gemini-3-pro-image-preview',
          count: 3,
        });
        expect(result.count).toBe(3);
      });
    });

    describe('尺寸参数解析', () => {
      it('应该规范化 UI 传入的比例尺寸 16:9', () => {
        const result = parseAIInput('', createSelection([], 1), {
          params: { size: '16:9' },
        });
        expect(result.size).toBe('16x9');
      });

      it('应该规范化 UI 传入的比例尺寸 1:1', () => {
        const result = parseAIInput('', createSelection([], 1), {
          params: { size: '1:1' },
        });
        expect(result.size).toBe('1x1');
      });

      it('应该规范化 UI 传入的比例尺寸 9:16', () => {
        const result = parseAIInput('', createSelection([], 1), {
          params: { size: '9:16' },
        });
        expect(result.size).toBe('9x16');
      });

      it('没有指定尺寸时应该使用模型默认值', () => {
        const result = parseAIInput('', createSelection([], 1), {
          modelId: 'gemini-3-pro-image-preview',
        });
        expect(result.size).toBe('1x1');
      });
    });

    describe('时长参数解析', () => {
      it('应该采用 UI 传入的视频时长 8', () => {
        const result = parseAIInput('', createSelection([], 1), {
          generationType: 'video',
          modelId: 'veo3',
          params: { duration: '8' },
        });
        expect(result.duration).toBe('8');
      });

      it('应该采用 UI 传入的视频时长 16', () => {
        const result = parseAIInput('', createSelection([], 1), {
          generationType: 'video',
          modelId: 'sora-2-pro',
          params: { duration: '16' },
        });
        expect(result.duration).toBe('16');
      });
    });

    describe('parseResult 保留', () => {
      it('应该保留原始解析结果', () => {
        const result = parseAIInput('一只猫', createSelection([], 1), {
          generationType: 'image',
          modelId: 'gemini-3-pro-image-preview',
          count: 2,
        });
        expect(result.parseResult).toBeDefined();
        expect(result.parseResult.selectedImageModel).toBeNull();
        expect(result.parseResult.selectedCount).toBeNull();
        expect(result.parseResult.cleanText).toBe('一只猫');
        expect(result.modelId).toBe('gemini-3-pro-image-preview');
        expect(result.count).toBe(2);
      });
    });

    describe('复杂组合场景', () => {
      it('应该正确组合无文字输入时的 UI 控件状态', () => {
        const result = parseAIInput(
          '',
          createSelection(['猫咪图片'], 1),
          {
            generationType: 'image',
            modelId: 'gemini-3-pro-image-preview',
            params: { size: '16:9' },
            count: 3,
          }
        );

        expect(result.scenario).toBe('direct_generation');
        expect(result.hasExtraContent).toBe(false);
        expect(result.prompt).toBe('猫咪图片');
        expect(result.count).toBe(3);
        expect(result.size).toBe('16x9');
      });
    });

    describe('边界情况', () => {
      it('应该处理空输入且无选中元素的情况', () => {
        const result = parseAIInput('', createSelection([], 0));
        expect(result.scenario).toBe('direct_generation');
        expect(result.prompt).toBe('');
      });

      it('应该处理只有空格的输入', () => {
        const result = parseAIInput('   ', createSelection([], 1));
        expect(result.scenario).toBe('direct_generation');
        expect(result.hasExtraContent).toBe(false);
      });

      it('应该把未消费的无效模型标记保留为 prompt', () => {
        const result = parseAIInput('#invalid-model', createSelection([], 1));
        expect(result.parseResult.selectedImageModel).toBeNull();
        expect(result.prompt).toBe('#invalid-model');
      });

      it('应该处理无效的参数标记', () => {
        const result = parseAIInput('-invalid=value', createSelection([], 1));
        expect(result.parseResult.selectedParams.length).toBe(0);
      });

      it('文本中的数量标记不应覆盖 UI 控件数量', () => {
        const result = parseAIInput('+100', createSelection([], 1), {
          generationType: 'image',
          count: 2,
        });
        expect(result.count).toBe(2);
        expect(result.prompt).toBe('+100');
      });
    });

    describe('控件模型选择', () => {
      it('应该采用 UI 传入的图片模型', () => {
        const result = parseAIInput('', createSelection([], 1), {
          modelId: 'gemini-3-pro-image-preview',
        });
        expect(result.modelId).toBe('gemini-3-pro-image-preview');
      });

      it('未指定 generationType 时应该从视频模型推断类型', () => {
        const result = parseAIInput('', createSelection([], 1), {
          modelId: 'veo3',
        });
        expect(result.generationType).toBe('video');
      });
    });

    describe('完整返回对象快照', () => {
      it('图片生成场景 - 完整参数', () => {
        const result = parseAIInput(
          '一只可爱的橘猫',
          createSelection([], 1),
          {
            generationType: 'image',
            modelId: 'gemini-3-pro-image-preview',
            params: { size: '1:1' },
            count: 2,
          }
        );

        expect(result).toMatchObject({
          scenario: 'direct_generation',
          generationType: 'image',
          modelId: 'gemini-3-pro-image-preview',
          prompt: '一只可爱的橘猫',
          count: 2,
          size: '1x1',
          duration: undefined,
          hasExtraContent: true,
        });

        // parseResult 单独验证（因为包含复杂嵌套对象）
        expect(result.parseResult).toMatchObject({
          selectedImageModel: null,
          selectedVideoModel: null,
          selectedCount: null,
          cleanText: '一只可爱的橘猫',
        });
        expect(result.extraParams).toBeUndefined();
      });

      it('视频生成场景 - 完整参数', () => {
        const result = parseAIInput(
          '一只猫在跳舞',
          createSelection([], 1),
          {
            generationType: 'video',
            modelId: 'veo3',
            params: { duration: '8', size: '16:9' },
          }
        );

        expect(result).toMatchObject({
          scenario: 'direct_generation',
          generationType: 'video',
          modelId: 'veo3',
          prompt: '一只猫在跳舞',
          count: 1,
          duration: '8',
          size: '16x9',
          hasExtraContent: true,
        });

        expect(result.parseResult).toMatchObject({
          selectedImageModel: null,
          selectedVideoModel: null,
          selectedCount: null,
          cleanText: '一只猫在跳舞',
        });
        expect(result.parseResult.selectedParams).toEqual([]);
      });

      it('直接生成场景 - 无额外内容', () => {
        const result = parseAIInput(
          '',
          createSelection(['猫咪', '狗狗'], 2),
          {
            generationType: 'image',
            modelId: 'gemini-3-pro-image-preview',
            params: { size: '16:9' },
            count: 3,
          }
        );

        expect(result).toMatchObject({
          scenario: 'direct_generation',
          generationType: 'image',
          modelId: 'gemini-3-pro-image-preview',
          prompt: '猫咪\n狗狗',
          count: 3,
          size: '16x9',
          hasExtraContent: false,
        });
      });

      it('默认值场景 - 最小输入', () => {
        const result = parseAIInput('', createSelection([], 1));

        expect(result).toMatchObject({
          scenario: 'direct_generation',
          generationType: 'image',
          modelId: 'gemini-3-pro-image-preview', // 来自 mock 的默认值
          count: 1,
          size: '1x1',
          hasExtraContent: false,
        });
        // prompt 应该是单图分析的默认提示词
        expect(result.prompt).toContain('分析这张图片');
      });

      it('Agent 流程场景 - 纯文本输入', () => {
        const result = parseAIInput(
          '请帮我生成一张赛博朋克风格的城市夜景图',
          createSelection([], 0)
        );

        expect(result).toMatchObject({
          scenario: 'agent_flow',
          generationType: 'agent',
          prompt: '请帮我生成一张赛博朋克风格的城市夜景图',
          count: 1,
          hasExtraContent: true,
        });
      });

      it('文本生成场景 - 显式文本模式应直接生成', () => {
        const result = parseAIInput('将参考内容整理为摘要', createSelection([], 1), {
          generationType: 'text',
          modelId: 'deepseek-v3.2',
        });

        expect(result).toMatchObject({
          scenario: 'direct_generation',
          generationType: 'text',
          modelId: 'deepseek-v3.2',
          count: 1,
          hasExtraContent: true,
        });
        expect(result.prompt).toBe('将参考内容整理为摘要');
      });

      it('多图融合场景', () => {
        const result = parseAIInput('', createSelection([], 3));

        expect(result).toMatchObject({
          scenario: 'direct_generation',
          generationType: 'image',
          modelId: 'gemini-3-pro-image-preview',
          count: 1,
          size: '1x1',
          hasExtraContent: false,
        });
        // prompt 应该是多图融合的默认提示词
        expect(result.prompt).toContain('分析这些图片');
        expect(result.prompt).toContain('融合');
      });
    });
  });
});
