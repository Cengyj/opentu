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
import {
  buildPsdLayerImageTaskPlans,
  PSD_LAYER_IMAGE_TASK_CONTRACT,
} from './ai-psd-plan';

const mockState = vi.hoisted(() => ({
  actionButtonProps: [] as Array<Record<string, unknown>>,
  referenceUploadProps: [] as Array<Record<string, unknown>>,
  promptInputProps: [] as Array<Record<string, unknown>>,
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
  DEFAULT_IMAGE_MODEL_ID: 'gpt-image-2',
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
  showReset?: boolean;
}

interface MockPromptInputProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  showPresetButton?: boolean;
  showOptimizeButton?: boolean;
}

vi.mock('./shared', () => ({
  ActionButtons: ({
    onGenerate,
    onReset,
    canGenerate,
    hasGenerated,
    generateLabel,
    showReset = true,
  }: MockActionButtonsProps) =>
    (() => {
      mockState.actionButtonProps.push({
        canGenerate,
        hasGenerated,
        generateLabel,
        showReset,
      });
      return (
        <div>
          <button type="button" onClick={onGenerate} disabled={!canGenerate}>
            {generateLabel || '生成'}
          </button>
          {showReset && (
            <button type="button" onClick={onReset}>
              重置
            </button>
          )}
        </div>
      );
    })(),
  ErrorDisplay: ({ error }: { error: string | null }) =>
    error ? <div role="alert">{error}</div> : null,
  ReferenceImageUpload: (props: Record<string, unknown>) => {
    mockState.referenceUploadProps.push(props);
    return <div data-testid="reference-upload">Reference</div>;
  },
  PromptInput: ({
    prompt,
    onPromptChange,
    showPresetButton,
    showOptimizeButton,
  }: MockPromptInputProps) => {
    mockState.promptInputProps.push({ showPresetButton, showOptimizeButton });
    return (
      <textarea
        aria-label="prompt"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
      />
    );
  },
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
      source: 'photoshop',
      status: 'planned',
      sourceSetting: 'photoshop',
      packaging: 'app-side-required',
      nativePsdReady: false,
      apiNativePsdOutput: false,
      downloadWhenSupported: true,
    });
    expect(plan.workflowSteps.map((step) => step.id)).toEqual([
      'image-generation',
      'thinking-layer-split',
      'photoshop-source',
      'export-edit',
    ]);
  });

  it('keeps planned layers editable and includes export-skeleton guidance layers', () => {
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

  it('builds IMAGE task plans for visual layers without native PSD claims', () => {
    const plan = buildLayerPlan(
      '品牌活动海报，产品主体需要独立图层',
      'poster',
      'ai-plan',
      5,
      'zh'
    );

    const taskPlans = buildPsdLayerImageTaskPlans(plan, {
      model: 'image-model',
      modelRef: { profileId: 'default', modelId: 'image-model' },
      size: '1024x1024',
      width: 1024,
      height: 1024,
      extraParams: { size: '1024x1024' },
    });

    expect(taskPlans).toHaveLength(3);
    expect(
      taskPlans.every(
        (taskPlan) =>
          taskPlan.taskType === PSD_LAYER_IMAGE_TASK_CONTRACT.taskType
      )
    ).toBe(true);
    expect(taskPlans.map((taskPlan) => taskPlan.layerId)).toEqual([
      'psd-layer-1',
      'psd-layer-2',
      'psd-layer-5',
    ]);
    expect(taskPlans[0].params.psdPlan).toMatchObject({
      planId: plan.planId,
      layerId: 'psd-layer-1',
      textPolicy: plan.textPolicy,
      exportTarget: PSD_LAYER_IMAGE_TASK_CONTRACT.exportTarget,
      sourceSetting: PSD_LAYER_IMAGE_TASK_CONTRACT.sourceSetting,
      packaging: PSD_LAYER_IMAGE_TASK_CONTRACT.packaging,
      nativePsdReady: PSD_LAYER_IMAGE_TASK_CONTRACT.nativePsdReady,
      apiNativePsdOutput: PSD_LAYER_IMAGE_TASK_CONTRACT.apiNativePsdOutput,
      downloadWhenSupported:
        PSD_LAYER_IMAGE_TASK_CONTRACT.downloadWhenSupported,
    });
    expect(taskPlans[0].params).toMatchObject({
      generationMode: PSD_LAYER_IMAGE_TASK_CONTRACT.generationMode,
      background: PSD_LAYER_IMAGE_TASK_CONTRACT.background,
      outputFormat: PSD_LAYER_IMAGE_TASK_CONTRACT.outputFormat,
      inputFidelity: PSD_LAYER_IMAGE_TASK_CONTRACT.inputFidelity,
      autoInsertToCanvas: false,
    });
    expect(taskPlans[0].params.prompt).toContain('Public Image API limitation');
    expect(taskPlans[0].params.prompt).toContain(
      'Photoshop/PSD export metadata'
    );
    expect(taskPlans[0].params.prompt).toContain(
      'independent transparent PNG layer'
    );
    expect(`${taskPlans[0].taskType}`).not.toBe('psd');
    expect(taskPlans[0].params.promptMeta?.tags).toEqual([
      ...PSD_LAYER_IMAGE_TASK_CONTRACT.promptMetaTags,
    ]);
    expect(taskPlans[0].params.promptMeta?.tags).not.toContain('layer-plan');
  });

  it('keeps PSD packaging explicitly unwired while layer assets stay IMAGE edits', () => {
    const plan = buildLayerPlan(
      'One-click PSD output',
      'poster',
      'quick',
      3,
      'en'
    );
    const taskPlans = buildPsdLayerImageTaskPlans(plan, {
      model: 'image-model',
      width: 1024,
      height: 1024,
    });

    expect(plan.exportSkeleton).toEqual({
      target: PSD_LAYER_IMAGE_TASK_CONTRACT.exportTarget,
      source: PSD_LAYER_IMAGE_TASK_CONTRACT.exportSource,
      status: 'planned',
      sourceSetting: PSD_LAYER_IMAGE_TASK_CONTRACT.sourceSetting,
      packaging: PSD_LAYER_IMAGE_TASK_CONTRACT.packaging,
      nativePsdReady: PSD_LAYER_IMAGE_TASK_CONTRACT.nativePsdReady,
      apiNativePsdOutput: PSD_LAYER_IMAGE_TASK_CONTRACT.apiNativePsdOutput,
      downloadWhenSupported:
        PSD_LAYER_IMAGE_TASK_CONTRACT.downloadWhenSupported,
    });
    expect(taskPlans).not.toHaveLength(0);
    for (const taskPlan of taskPlans) {
      expect(taskPlan.taskType).toBe(TaskType.IMAGE);
      expect(taskPlan.params.psdPlan?.nativePsdReady).toBe(false);
      expect(taskPlan.params.psdPlan?.exportTarget).toBe('psd');
      expect(taskPlan.params.psdPlan?.exportSource).toBe('photoshop');
      expect(taskPlan.params.psdPlan?.apiNativePsdOutput).toBe(false);
      expect(taskPlan.params.outputFormat).toBe('png');
      expect(taskPlan.params.background).toBe('transparent');
      expect(taskPlan.params.prompt).toMatch(/later app-side PSD packaging/i);
    }
  });
});

describe('AIImagePsdGeneration contract', () => {
  afterEach(() => {
    cleanup();
    mockState.actionButtonProps = [];
    mockState.referenceUploadProps = [];
    mockState.promptInputProps = [];
    mockState.createTask.mockClear();
  });

  it('exports the PSD mode component for lazy dialog loading', () => {
    expect(AIImagePsdGeneration).toBeTypeOf('function');
  });

  it('renders a GPT-style one-click PSD composer without tuning controls', () => {
    render(<AIImagePsdGeneration />);

    expect(screen.getByText(/像 GPT-Image2 工作流一样准备 PSD/)).toBeTruthy();
    expect(screen.getByText(/只需要参考图和提示词/)).toBeTruthy();
    expect(screen.getByText('思考拆层')).toBeTruthy();
    expect(screen.getByText('源设置：Photoshop')).toBeTruthy();
    expect(screen.getByText('导出与编辑')).toBeTruthy();
    expect(screen.getByText('说明')).toBeTruthy();
    expect((screen.getByLabelText('prompt') as HTMLTextAreaElement).value).toBe(
      ''
    );
    expect(screen.queryByTestId('model-dropdown')).toBeNull();
    expect(screen.queryByTestId('parameters-dropdown')).toBeNull();
    expect(screen.queryByText('重置')).toBeNull();
    const hiddenTuningCopyPattern = new RegExp(
      [
        '\\u6a21\\u677f',
        '\\u7b56\\u7565',
        '\\u56fe\\u5c42\\u6570\\u91cf',
        '\\u6a21\\u578b\\u53c2\\u6570',
        '\\u8349\\u7a3f',
      ].join('|')
    );
    expect(screen.queryByText(hiddenTuningCopyPattern)).toBeNull();
    expect(
      mockState.actionButtonProps[mockState.actionButtonProps.length - 1]
    ).toMatchObject({
      canGenerate: false,
      generateLabel: '准备 PSD 分层/导出',
      showReset: false,
    });
    expect(
      screen.queryByText('\u53ef\u7f16\u8f91 PSD \u8349\u7a3f')
    ).toBeNull();
    expect(screen.queryByText('尚未生成图层计划')).toBeNull();
    expect(screen.queryByText('PSD 文件预览')).toBeNull();
    expect(
      mockState.referenceUploadProps[mockState.referenceUploadProps.length - 1]
    ).toMatchObject({ multiple: false, maxCount: 1 });
    expect(
      mockState.promptInputProps[mockState.promptInputProps.length - 1]
    ).toMatchObject({
      showPresetButton: false,
      showOptimizeButton: false,
    });
    expect(screen.getByText(/公共图片 API 暂不直接返回原生 PSD/)).toBeTruthy();
  });

  it('updates PSD button state and queues layer asset generation from one click', async () => {
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
      generateLabel: '准备 PSD 分层/导出',
    });

    fireEvent.click(screen.getByRole('button', { name: '准备 PSD 分层/导出' }));

    await waitFor(() => {
      latestActionProps =
        mockState.actionButtonProps[mockState.actionButtonProps.length - 1];
      expect(latestActionProps).toMatchObject({
        canGenerate: true,
        hasGenerated: false,
        generateLabel: '准备 PSD 分层/导出',
      });
    });
    expect(screen.getByText('PSD 工作流已启动')).toBeTruthy();
    expect(screen.getByText(/已开始准备 4 个同画布分层素材/)).toBeTruthy();
    expect(screen.getByText(/当前不会伪装成原生 PSD 下载/)).toBeTruthy();
    expect(mockState.createTask).toHaveBeenCalledTimes(4);
    expect(screen.queryByText(`查看可选${'拆分'}明细`)).toBeNull();
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull();
  });
});
