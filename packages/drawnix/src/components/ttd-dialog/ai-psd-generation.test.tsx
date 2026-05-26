// @vitest-environment jsdom
import React from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AIImagePsdGeneration, { buildLayerPlan } from './ai-psd-generation';
import { buildPsdLayerImageTaskDrafts } from './ai-psd-draft';
import { TaskType } from '../../types/task.types';

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
});

describe('AIImagePsdGeneration contract', () => {
  afterEach(() => cleanup());

  it('exports the PSD mode component for lazy dialog loading', () => {
    expect(AIImagePsdGeneration).toBeTypeOf('function');
  });
});
