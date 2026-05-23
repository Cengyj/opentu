import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_MODEL_ID,
  getCompatibleParams,
  getSizeOptionsForModel,
  getStaticModelConfig,
  ModelVendor,
} from '../model-config';
import {
  FOROPENCODE_DEFAULT_MODEL_IDS,
} from '../for-default-models';
import {
  buildDefaultModelVisibilityReportFromModelListResponse,
  classifyDefaultModelId,
  isDefaultProviderDisplayModel,
} from '../default-model-visibility';
import {
  buildForOpenCodeDefaultModelSnapshot,
  formatHiddenModelReport,
} from '../../../../../scripts/sync-foropencode-default-models';

describe('model-config image size options', () => {
  it('为 gpt-image-2 系列暴露扩展比例', () => {
    const expected = [
      'auto',
      '1x1',
      '2x3',
      '3x2',
      '3x4',
      '4x3',
      '4x5',
      '5x4',
      '9x16',
      '16x9',
      '21x9',
    ];

    expect(
      getSizeOptionsForModel('gpt-image-2').map((option) => option.value)
    ).toEqual(expected);
  });

  it('为 gpt-image-2 暴露分辨率和官方画质参数', () => {
    const params = getCompatibleParams('gpt-image-2');
    const qualityParams = params.filter((param) => param.id === 'quality');

    expect(
      params
        .find((param) => param.id === 'resolution')
        ?.options?.map((option) => option.value)
    ).toEqual(['1k', '2k', '4k']);
    expect(qualityParams).toHaveLength(1);
    expect(qualityParams[0]?.options?.map((option) => option.value)).toEqual([
      'auto',
      'low',
      'medium',
      'high',
    ]);
  });

  it('默认图片模型使用已存在的 gpt-image-2', () => {
    expect(DEFAULT_IMAGE_MODEL_ID).toBe('gpt-image-2');
    expect(getStaticModelConfig('gpt-image-2')).toMatchObject({
      id: 'gpt-image-2',
      type: 'image',
      vendor: ModelVendor.GPT,
    });
  });

  it('不再内置已下架的 GPT Image 旧模型', () => {
    expect(getStaticModelConfig('gpt-image-2-vip')).toBeUndefined();
    expect(getCompatibleParams('gpt-image-2-vip')).toEqual([]);
    expect(getStaticModelConfig('gpt-image-1')).toBeUndefined();
    expect(getStaticModelConfig('gpt-image-1.5')).toBeUndefined();
    expect(getCompatibleParams('gpt-image-1')).toEqual([]);
    expect(getCompatibleParams('gpt-image-1.5')).toEqual([]);
  });

  it('ForOpenCode 默认分组 GPT 过滤规则只保留允许的 GPT 模型', () => {
    expect(isDefaultProviderDisplayModel('gpt-image-2')).toBe(true);
    expect(isDefaultProviderDisplayModel('gpt-5.5')).toBe(true);
    expect(isDefaultProviderDisplayModel('gpt-5.4-mini')).toBe(true);
    expect(isDefaultProviderDisplayModel('gpt-image-2-vip')).toBe(false);
    expect(isDefaultProviderDisplayModel('gpt-draw-1024x1536')).toBe(false);
    expect(isDefaultProviderDisplayModel('gpt-4.1-mini-openai-compact')).toBe(
      false
    );
    expect(isDefaultProviderDisplayModel('gpt-5.4-openai-compact')).toBe(false);
    expect(isDefaultProviderDisplayModel('gpt-image-3-openai-compact')).toBe(
      false
    );
    expect(isDefaultProviderDisplayModel('claude-sonnet-4-6')).toBe(false);
    expect(isDefaultProviderDisplayModel('gemini-3-pro')).toBe(false);
    expect(isDefaultProviderDisplayModel('deepseek-v3')).toBe(false);
    expect(classifyDefaultModelId('gpt-5.4-openai-compact')).toMatchObject({
      vendor: 'gpt',
      family: 'gpt-text',
      variantTags: expect.arrayContaining(['compact', 'proxy']),
      visibleByDefault: false,
      hiddenReason: 'compact',
    });
    expect(classifyDefaultModelId('gpt-image-3-openai-compact')).toMatchObject({
      vendor: 'gpt',
      family: 'gpt-image',
      variantTags: expect.arrayContaining(['compact', 'proxy']),
      visibleByDefault: false,
      hiddenReason: 'compact',
    });
    expect(classifyDefaultModelId('gpt-image-2-vip')).toMatchObject({
      vendor: 'gpt',
      family: 'gpt-image',
      variantTags: expect.arrayContaining(['legacy', 'retired']),
      visibleByDefault: false,
      hiddenReason: 'retired',
    });
  });

  it('ForOpenCode 默认模型快照生成只输出上游返回的允许 GPT 模型', () => {
    const fixture = {
      data: [
        { id: 'gpt-image-2' },
        { id: 'gpt-image-2-vip' },
        { id: 'gpt-draw-1024x1536' },
        { id: 'gpt-4.1-mini-openai-compact' },
        { id: 'gpt-5.4-openai-compact' },
        { id: 'gpt-image-3-openai-compact' },
        { id: 'gpt-5.5' },
        { id: 'claude-sonnet-4-6' },
        { id: 'gemini-3-pro' },
        { id: 'deepseek-v3' },
        { id: 'gpt-5.4-mini' },
      ],
    };

    expect(
      buildDefaultModelVisibilityReportFromModelListResponse(fixture)
        .visibleModelIds
    ).toEqual(['gpt-image-2', 'gpt-5.5', 'gpt-5.4-mini']);
    expect(buildForOpenCodeDefaultModelSnapshot(fixture).modelIds).toEqual([
      'gpt-5.5',
      'gpt-image-2',
      'gpt-5.4-mini',
    ]);
    expect(
      buildForOpenCodeDefaultModelSnapshot(fixture).modelIds.some((id) =>
        id.endsWith('openai-compact')
      )
    ).toBe(false);
    const hiddenById = new Map(
      buildForOpenCodeDefaultModelSnapshot(fixture).hiddenReport.map((item) => [
        item.id,
        item.hiddenReason,
      ])
    );
    expect(hiddenById.get('gpt-image-2-vip')).toBe('retired');
    expect(hiddenById.get('gpt-draw-1024x1536')).toBe('draw');
    expect(hiddenById.get('gpt-4.1-mini-openai-compact')).toBe('compact');
    expect(hiddenById.get('gpt-5.4-openai-compact')).toBe('compact');
    expect(hiddenById.get('gpt-image-3-openai-compact')).toBe('compact');
    expect(hiddenById.get('claude-sonnet-4-6')).toBe('non-gpt');
    expect(hiddenById.get('gemini-3-pro')).toBe('non-gpt');
    expect(hiddenById.get('deepseek-v3')).toBe('non-gpt');
    expect(
      formatHiddenModelReport(
        buildForOpenCodeDefaultModelSnapshot(fixture).hiddenReport
      )
    ).toContain('compact');
  });

  it('ForOpenCode 默认模型快照不包含已下架的 gpt-image-2-vip', () => {
    expect(FOROPENCODE_DEFAULT_MODEL_IDS).toContain('gpt-image-2');
    expect(FOROPENCODE_DEFAULT_MODEL_IDS).not.toContain('gpt-image-2-vip');
    expect(
      FOROPENCODE_DEFAULT_MODEL_IDS.some((id) =>
        id.endsWith('openai-compact')
      )
    ).toBe(false);
  });

  it('保留 Gemini preview 的旧 quality 档位参数', () => {
    const params = getCompatibleParams('gemini-3-pro-image-preview');
    const qualityParams = params.filter((param) => param.id === 'quality');

    expect(qualityParams).toHaveLength(1);
    expect(qualityParams[0]?.options?.map((option) => option.value)).toEqual([
      '1k',
      '2k',
      '4k',
    ]);
  });

  it('按模型暴露 HappyHorse 参数控制', () => {
    const t2vParams = getCompatibleParams('happyhorse-1.0-t2v');
    const i2vParams = getCompatibleParams('happyhorse-1.0-i2v');
    const r2vParams = getCompatibleParams('happyhorse-1.0-r2v');
    const editParams = getCompatibleParams('happyhorse-1.0-video-edit');

    expect(getSizeOptionsForModel('happyhorse-1.0-r2v')[0]?.value).toBe(
      '1080P'
    );
    expect(
      r2vParams
        .find((param) => param.id === 'duration')
        ?.options?.map((option) => option.value)
    ).toEqual([
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
    ]);
    expect(
      r2vParams
        .find((param) => param.id === 'ratio')
        ?.options?.map((option) => option.value)
    ).toEqual(['16:9', '9:16', '1:1', '4:3', '3:4']);
    expect(i2vParams.some((param) => param.id === 'ratio')).toBe(false);
    expect(editParams.some((param) => param.id === 'duration')).toBe(false);
    expect(editParams.some((param) => param.id === 'ratio')).toBe(false);
    expect(editParams.some((param) => param.id === 'audio_setting')).toBe(true);
    expect(t2vParams.some((param) => param.id === 'ratio')).toBe(true);
    expect(r2vParams.find((param) => param.id === 'seed')).toMatchObject({
      valueType: 'number',
      min: 0,
      max: 2147483647,
    });
    expect(
      r2vParams
        .find((param) => param.id === 'watermark')
        ?.options?.map((option) => option.value)
    ).toEqual(['true', 'false']);
    expect(
      r2vParams.find((param) => param.id === 'watermark')?.defaultValue
    ).toBe(
      'false'
    );
    expect(getStaticModelConfig('happyhorse-1.0-t2v')?.vendor).toBe(
      ModelVendor.HAPPYHORSE
    );
  });
});
