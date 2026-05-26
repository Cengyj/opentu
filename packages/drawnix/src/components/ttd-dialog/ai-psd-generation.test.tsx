// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetType } from '../../types/asset.types';
import { TaskType } from '../../types/task.types';
import AIImagePsdGeneration, { buildLayerPlan } from './ai-psd-generation';
import { buildPsdLayerImageTaskDrafts } from './ai-psd-draft';

const mockState = vi.hoisted(() => ({
  actionButtonProps: [] as Array<Record<string, unknown>>,
  createTask: vi.fn(() => ({ id: 'task-1' })),
}));

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

vi.mock('../../hooks/useTaskQueue', () => ({
  useTaskQueue: () => ({
    createTask: mockState.createTask,
  }),
}));

vi.mock('../../hooks/use-runtime-models', () => {
  const imageModels = [
    {
      id: 'image-model',
      label: 'Image Model',
      type: 'image',
      vendor: 'OPENAI',
    },
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
  resolveInvocationRoute: () => ({
    profileId: 'default',
    modelId: 'image-model',
  }),
}));

vi.mock('../../utils/runtime-model-discovery', () => ({
  getPinnedSelectableModel: () => null,
}));

vi.mock('../../utils/model-selection', () => ({
  findMatchingSelectableModel: (
    models: Array<{ id: string }>,
    modelId: string
  ) => models.find((model) => model.id === modelId) || null,
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
  loadScopedAIImageToolPreferences: () => ({
    extraParams: { size: '1024x1024' },
  }),
}));

vi.mock('../ai-input-bar/ModelDropdown', () => ({
  ModelDropdown: () => <div data-testid="model-dropdown">Model</div>,
}));

vi.mock('../ai-input-bar/ParametersDropdown', () => ({
  ParametersDropdown: () => <div data-testid="parameters-dropdown">Params</div>,
}));

vi.mock('../shared', () => ({
  KnowledgeNoteContextSelector: () => (
    <div data-testid="knowledge-selector">Knowledge</div>
  ),
}));

interface MockActionButtonsProps {
  onGenerate: () => void;
  onReset: () => void;
  canGenerate: boolean;
  hasGenerated: boolean;
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
    hasGenerated,
    generateLabel,
  }: MockActionButtonsProps) =>
    (() => {
      mockState.actionButtonProps.push({
        canGenerate,
        hasGenerated,
        generateLabel,
      });
      return (
        <div>
          <button type="button" onClick={onGenerate} disabled={!canGenerate}>
            {generateLabel || '生成'}
          </button>
          <button type="button" onClick={onReset}>
            重置
          </button>
        </div>
      );
    })(),
  ErrorDisplay: ({ error }: { error: string | null }) =>
    error ? <div role="alert">{error}</div> : null,
  ReferenceImageUpload: () => (
    <div data-testid="reference-upload">Reference</div>
  ),
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
    expect(
      plan.layers.every((layer) => !layer.id.includes('TaskType.PSD'))
    ).toBe(true);
    expect(plan.exportSkeleton).toEqual({
      target: 'psd',
      status: 'draft',
      nativePsdReady: false,
    });
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

  it('writes editable-text policy into local text-layer prompts', () => {
    const plan = buildLayerPlan(
      '新品发布海报，标题后续需要改字',
      'poster',
      'ai-plan',
      5,
      'zh',
      {
        preferEditableText: true,
        avoidBakedText: true,
      }
    );

    expect(plan.textPolicy).toEqual({
      preferEditableText: true,
      avoidBakedText: true,
    });
    expect(plan.layers[2].generationPrompt).toContain(
      '图片任务只生成版式占位和氛围'
    );
    expect(plan.layers[2].generationPrompt).toContain(
      '不要让图片模型直接生成清晰文字'
    );
  });

  it('builds IMAGE task drafts for visual layers without native PSD claims', () => {
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
      textPolicy: plan.textPolicy,
      exportTarget: 'psd',
      nativePsdReady: false,
    });
    expect(taskDrafts[0].params.prompt).toContain(
      'Do not claim or embed a native PSD file'
    );
    expect(`${taskDrafts[0].taskType}`).not.toBe('psd');
    expect(taskDrafts[0].params.promptMeta?.tags).toContain('psd-draft');
  });
});

describe('AIImagePsdGeneration contract', () => {
  afterEach(() => {
    cleanup();
    mockState.actionButtonProps = [];
    mockState.createTask.mockClear();
  });

  it('exports the PSD mode component for lazy dialog loading', () => {
    expect(AIImagePsdGeneration).toBeTypeOf('function');
  });

  it('renders an editable PSD draft editor and layer workflow skeleton', () => {
    render(<AIImagePsdGeneration />);

    expect(screen.getAllByRole('note')[0].textContent).toContain(
      '只需上传参考图并输入提示词'
    );
    expect(screen.getByText(/点击“生成 PSD 文件”/)).toBeTruthy();
    expect(screen.getByText(/像 GPT 一样/)).toBeTruthy();
    expect(screen.queryByText('可编辑 PSD 草稿')).toBeNull();
    expect(screen.queryByText('尚未生成图层计划')).toBeNull();
    expect(
      screen.queryByText(/直接返回原生 PSD 文件|native PSD files returned/i)
    ).toBeNull();
  });

  it('updates PSD button state, queues layer tasks, and prevents deleting locked base layers', async () => {
    render(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,poster', name: 'poster.png' },
        ]}
      />
    );

    let latestActionProps =
      mockState.actionButtonProps[mockState.actionButtonProps.length - 1];
    expect(latestActionProps).toMatchObject({
      canGenerate: true,
      hasGenerated: false,
      generateLabel: '生成 PSD 文件',
    });

    fireEvent.click(screen.getByRole('button', { name: '生成 PSD 文件' }));

    await waitFor(() => {
      latestActionProps =
        mockState.actionButtonProps[mockState.actionButtonProps.length - 1];
      expect(latestActionProps).toMatchObject({
        canGenerate: true,
        hasGenerated: true,
        generateLabel: '重新生成 PSD 文件',
      });
    });
    expect(screen.getByText(/已按参考图自动拆分透明图层/)).toBeTruthy();
    expect(mockState.createTask).toHaveBeenCalledTimes(4);

    fireEvent.click(screen.getByText('查看自动拆层明细（可选）'));
    const deleteButtons = screen.getAllByRole('button', { name: '删除' });
    expect((deleteButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((deleteButtons[1] as HTMLButtonElement).disabled).toBe(false);
  });
});
