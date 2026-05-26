// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetType } from '../../types/asset.types';
import { TaskType } from '../../types/task.types';
import AIImagePsdGeneration, { buildLayerPlan } from './ai-psd-generation';
import { buildPsdLayerImageTaskDrafts } from './ai-psd-draft';

vi.mock('tdesign-react', () => ({
  MessagePlugin: {
    success: vi.fn(),
  },
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ language: 'zh' }),
}));

vi.mock('../../hooks/useDeviceType', () => ({
  useDeviceType: () => ({ viewportWidth: 1200 }),
}));

vi.mock('../../hooks/useGenerationHistory', () => ({
  useGenerationHistory: () => ({ imageHistory: [] }),
}));

vi.mock('../../hooks/use-runtime-models', () => {
  const imageModels = [
    { id: 'image-model', label: 'Image Model', type: 'image', vendor: 'OPENAI' },
  ];
  return {
    useSelectableModels: () => imageModels,
  };
});

vi.mock('../../utils/settings-manager', () => ({
  createModelRef: (profileId: string | null, modelId: string) => ({
    profileId,
    modelId,
  }),
  geminiSettings: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  resolveInvocationRoute: () => ({ profileId: 'default', modelId: 'image-model' }),
}));

vi.mock('../../utils/runtime-model-discovery', () => ({
  getPinnedSelectableModel: () => null,
}));

vi.mock('../../utils/model-selection', () => ({
  findMatchingSelectableModel: (models: Array<{ id: string }>, modelId: string) =>
    models.find((model) => model.id === modelId) || null,
  getModelRefFromConfig: (model?: { id: string } | null) =>
    model ? { profileId: 'default', modelId: model.id } : null,
  getSelectionKey: (modelId: string) => modelId,
}));

vi.mock('../../constants/model-config', () => ({
  getCompatibleParams: () => [
    {
      id: 'size',
      label: 'Size',
      valueType: 'enum',
      options: [{ value: '1024x1024', label: '1024x1024' }],
      compatibleModels: [],
      modelType: 'image',
    },
  ],
}));

vi.mock('../../services/prompt-storage-service', () => ({
  promptStorageService: {
    subscribeChanges: () => () => undefined,
  },
}));

vi.mock('../../services/ai-generation-preferences-service', () => ({
  loadScopedAIImageToolPreferences: () => ({ extraParams: { size: '1024x1024' } }),
}));

vi.mock('../ai-input-bar/ModelDropdown', () => ({
  ModelDropdown: () => <div data-testid="model-dropdown">Model</div>,
}));

vi.mock('../ai-input-bar/ParametersDropdown', () => ({
  ParametersDropdown: () => <div data-testid="parameters-dropdown">Params</div>,
}));

vi.mock('../shared', () => ({
  KnowledgeNoteContextSelector: () => <div data-testid="knowledge-selector">Knowledge</div>,
}));

interface MockActionButtonsProps {
  onGenerate: () => void;
  onReset: () => void;
  canGenerate: boolean;
  generateLabel?: string;
}

interface MockPromptInputProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
}

vi.mock('./shared', () => ({
  ActionButtons: ({
    onGenerate,
    onReset,
    canGenerate,
    generateLabel,
  }: MockActionButtonsProps) => (
    <div>
      <button type="button" onClick={onGenerate} disabled={!canGenerate}>
        {generateLabel || '生成'}
      </button>
      <button type="button" onClick={onReset}>
        重置
      </button>
    </div>
  ),
  ErrorDisplay: ({ error }: { error: string | null }) =>
    error ? <div role="alert">{error}</div> : null,
  ReferenceImageUpload: () => <div data-testid="reference-upload">Reference</div>,
  PromptInput: ({ prompt, onPromptChange }: MockPromptInputProps) => (
    <textarea
      aria-label="prompt"
      value={prompt}
      onChange={(event) => onPromptChange(event.target.value)}
    />
  ),
  ResizableDivider: () => <div data-testid="resizable-divider" />,
  getMergedPresetPrompts: () => [],
  loadSavedWidth: () => 360,
  savePromptToHistory: vi.fn(),
}));

describe('buildLayerPlan', () => {
  it('keeps PSD workflow on existing image task and asset contracts', () => {
    expect(Object.values(TaskType)).not.toContain('psd');
    expect(Object.keys(TaskType)).not.toContain('PSD');
    expect(Object.values(AssetType)).not.toContain('PSD');
    expect(Object.keys(AssetType)).not.toContain('PSD');
  });

  it('builds a local editable PSD plan without creating PSD task types', () => {
    const plan = buildLayerPlan(
      '品牌活动海报，产品主体需要独立图层',
      'poster',
      'ai-plan',
      5,
      'zh'
    );

    expect(plan.template).toBe('poster');
    expect(plan.strategy).toBe('ai-plan');
    expect(plan.layers).toHaveLength(5);
    expect(plan.layers.map((layer) => layer.type)).toEqual([
      'background',
      'image',
      'text',
      'text',
      'decoration',
    ]);
    expect(plan.layers.every((layer) => !layer.id.includes('TaskType.PSD'))).toBe(
      true
    );
    expect(plan.exportSkeleton).toEqual({
      target: 'psd',
      status: 'draft',
      nativePsdReady: false,
    });
  });

  it('builds IMAGE task drafts for visual PSD layers without native PSD claims', () => {
    const plan = buildLayerPlan(
      '品牌活动海报，产品主体需要独立图层',
      'poster',
      'ai-plan',
      5,
      'zh'
    );

    const taskDrafts = buildPsdLayerImageTaskDrafts(plan, {
      model: 'image-model',
      modelRef: { profileId: 'default', modelId: 'image-model' },
      size: '1024x1024',
      width: 1024,
      height: 1024,
      extraParams: { size: '1024x1024' },
    });

    expect(taskDrafts).toHaveLength(3);
    expect(taskDrafts.every((draft) => draft.taskType === TaskType.IMAGE)).toBe(
      true
    );
    expect(taskDrafts.map((draft) => draft.layerId)).toEqual([
      'psd-layer-1',
      'psd-layer-2',
      'psd-layer-5',
    ]);
    expect(taskDrafts[0].params.psdDraft).toMatchObject({
      draftId: plan.draftId,
      layerId: 'psd-layer-1',
      exportTarget: 'psd',
      nativePsdReady: false,
    });
    expect(taskDrafts[0].params.prompt).toContain('Do not claim or embed a native PSD file');
    expect(`${taskDrafts[0].taskType}`).not.toBe('psd');
    expect(taskDrafts[0].params.promptMeta?.tags).toContain('psd-draft');
  });

  it('keeps draft layers editable and includes export-skeleton guidance layers', () => {
    const plan = buildLayerPlan(
      '社媒封面，保留安全区参考',
      'social',
      'quick',
      8,
      'zh'
    );

    expect(plan.title).toBe('社媒封面，保留安全区参考');
    expect(plan.layers).toHaveLength(8);
    expect(plan.layers[0]).toMatchObject({
      name: '背景层',
      type: 'background',
      visible: true,
      locked: true,
    });
    expect(plan.layers.map((layer) => layer.name)).toEqual([
      '背景层',
      '视觉主体',
      '标题文字',
      '辅助信息',
      '装饰元素',
      '前景强调',
      '调色/说明层',
      '安全边距参考',
    ]);
    expect(plan.layers.every((layer) => layer.visible)).toBe(true);
  });
});

describe('AIImagePsdGeneration contract', () => {
  afterEach(() => cleanup());

  it('exports the PSD mode component for lazy dialog loading', () => {
    expect(AIImagePsdGeneration).toBeTypeOf('function');
  });

  it('renders an editable PSD draft editor and layer workflow skeleton', () => {
    render(<AIImagePsdGeneration />);

    expect(screen.getByRole('note').textContent).toContain('不直接返回原生 PSD');
    expect(screen.getByText('PSD 输出配置')).toBeTruthy();
    expect(screen.getByText('PSD 图层计划')).toBeTruthy();
    expect(screen.getByText('尚未生成图层计划')).toBeTruthy();
    expect(
      screen.queryByText(/直接返回原生 PSD 文件|native PSD files returned/i)
    ).toBeNull();
  });

});
