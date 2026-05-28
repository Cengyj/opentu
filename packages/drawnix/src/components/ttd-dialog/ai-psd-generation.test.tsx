// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetSource, AssetType } from '../../types/asset.types';
import { TaskStatus, TaskType, type Task } from '../../types/task.types';
import AIImagePsdGeneration, { buildLayerPlan } from './ai-psd-generation';
import {
  buildLayerPlanFromAnalysis,
  buildPsdLayerAnalysisTaskPlan,
  buildPsdLayerImageTaskPlans,
  buildPsdReadyImageTaskPlan,
  parsePsdLayerAnalysisResponse,
  PSD_LAYER_ANALYSIS_MODEL_ID,
  PSD_LAYER_IMAGE_TASK_CONTRACT,
} from './ai-psd-plan';
import {
  createPsdDraftFromPlan,
  updatePsdDraftLayer,
} from './psd-workbench/psd-types';
import {
  buildPsdLayerTaskStateMap,
  getFailedPsdLayerEntries,
  getRetryablePsdLayerIds,
} from './psd-workbench/psd-layer-tasks';
import { buildPsdTaskStats } from './ai-psd-generation-workflow';
import { downloadPsdReadyWorkspacePackage } from './psd-workbench/psd-workspace-package';

const mockState = vi.hoisted(() => ({
  referenceUploadProps: [] as Array<Record<string, unknown>>,
  tasks: [] as Task[],
  addAsset: vi.fn(() => Promise.resolve({ id: 'stored-source-asset' })),
  createTask: vi.fn(() => ({
    id: `task-${mockState.createTask.mock.calls.length}`,
  })),
  triggerBlobDownload: vi.fn(),
}));

type CreateTaskCall = [Record<string, unknown>, TaskType];

vi.mock('tdesign-react', () => ({
  MessagePlugin: {
    success: vi.fn(),
  },
}));

vi.mock('../../utils/message-plugin', () => ({
  MessagePlugin: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    close: vi.fn(),
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
    tasks: mockState.tasks,
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
  const textModels = [
    {
      id: 'gpt-5.5',
      label: 'GPT-5.5',
      type: 'text',
      vendor: 'OPENAI',
    },
  ];
  return {
    useSelectableModels: (type: string) =>
      type === 'text' ? textModels : imageModels,
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
  resolveInvocationRoute: (routeType: string) => ({
    profileId: 'default',
    modelId: routeType === 'text' ? 'gpt-5.5' : 'image-model',
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
  DEFAULT_TEXT_MODEL_ID: 'gpt-5.5',
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

vi.mock('../../utils/download-utils', () => ({
  triggerBlobDownload: mockState.triggerBlobDownload,
}));

vi.mock('../../contexts/AssetContext', () => ({
  useAssets: () => ({
    addAsset: mockState.addAsset,
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

vi.mock('../media-library/MediaLibraryModal', () => ({
  MediaLibraryModal: (props: {
    isOpen: boolean;
    onSelect: (asset: {
      id: string;
      type: string;
      source: string;
      url: string;
      name: string;
      mimeType: string;
      createdAt: number;
    }) => void | Promise<void>;
  }) =>
    props.isOpen ? (
      <button
        type="button"
        onClick={() =>
          props.onSelect({
            id: 'asset-source',
            type: 'IMAGE',
            source: 'LOCAL',
            url: 'blob:asset-source',
            name: 'library-poster.png',
            mimeType: 'image/png',
            createdAt: 1,
          })
        }
      >
        mock select source from media library
      </button>
    ) : null,
}));

vi.mock('./shared', () => ({
  ErrorDisplay: ({ error }: { error: string | null }) =>
    error ? <div role="alert">{error}</div> : null,
  ReferenceImageUpload: (props: Record<string, unknown>) => {
    mockState.referenceUploadProps.push(props);
    return <div data-testid="reference-upload">Reference</div>;
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

  it('builds a GPT-5.5 high-reasoning visual analysis task before image layers', () => {
    const taskPlan = buildPsdLayerAnalysisTaskPlan({
      prompt: '请拆分这张深圳海报',
      template: 'poster',
      strategy: 'ai-plan',
      language: 'zh',
      model: PSD_LAYER_ANALYSIS_MODEL_ID,
      modelRef: { profileId: 'default', modelId: PSD_LAYER_ANALYSIS_MODEL_ID },
      uploadedImages: [
        { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
      ],
      knowledgeContextRefs: [],
    });

    expect(taskPlan.taskType).toBe(TaskType.CHAT);
    expect(taskPlan.params.model).toBe('gpt-5.5');
    expect(taskPlan.params.modelRef).toEqual({
      profileId: 'default',
      modelId: 'gpt-5.5',
    });
    expect(taskPlan.params.referenceImages).toEqual([
      'data:image/png;base64,cG9zdGVy',
    ]);
    expect(taskPlan.params.params).toMatchObject({
      reasoning_effort: 'high',
      psdLayerAnalysis: true,
    });
    expect(taskPlan.params.prompt).toContain('先完整分析原图');
    expect(taskPlan.params.prompt).toContain('不要使用固定 8 层模板');
    expect(taskPlan.params.prompt).toContain('expectedRegion');
    expect(taskPlan.params.promptMeta?.tags).toContain('psd-layer-analysis');
  });

  it('parses dynamic layer analysis JSON after model thinking text', () => {
    const analysis = parsePsdLayerAnalysisResponse(`<think>{"layers":[]}</think>
最终：
{
  "title": "深圳城市海报",
  "summary": "按真实视觉元素拆分，不重复主标题。",
  "layers": [
    {
      "name": "背景底图",
      "type": "background",
      "include": "底色、纹理、照片氛围",
      "exclude": "全部文字、线条、地图和定位标识",
      "stackingOrder": 1,
      "expectedRegion": { "left": 0, "top": 0, "width": 100, "height": 100 }
    },
    {
      "name": "主标题与副标题",
      "type": "text",
      "include": "深圳标题、英文副标题和紧邻短说明",
      "exclude": "列表正文、坐标、地图和背景",
      "stackingOrder": 4,
      "expectedRegion": { "x": 21, "y": 17, "w": 58, "h": 18 }
    }
  ],
  "warnings": ["标题只允许出现在主标题与副标题层"]
}`);

    expect(analysis.title).toBe('深圳城市海报');
    expect(analysis.layers).toHaveLength(2);
    expect(analysis.layers[1]).toMatchObject({
      name: '主标题与副标题',
      type: 'text',
      include: '深圳标题、英文副标题和紧邻短说明',
      exclude: '列表正文、坐标、地图和背景',
      stackingOrder: 4,
      bounds: { left: 21, top: 17, width: 58, height: 18 },
    });
  });

  it('builds the layer plan from model analysis instead of a fixed poster template', () => {
    const analysis = parsePsdLayerAnalysisResponse({
      title: '深圳城市海报',
      summary: '动态视觉拆层',
      layers: [
        {
          name: '背景底图',
          type: 'background',
          include: '底色、纹理、照片氛围',
          exclude: '全部前景文字和地图',
          stackingOrder: 1,
          expectedRegion: { left: 0, top: 0, width: 100, height: 100 },
        },
        {
          name: '主标题与副标题',
          type: 'text',
          include: '深圳主标题、英文标题和紧邻副标题',
          exclude: '不得包含地图、列表或另一份标题副本',
          stackingOrder: 2,
          expectedRegion: { left: 18, top: 14, width: 64, height: 20 },
        },
        {
          name: '地图定位与坐标',
          type: 'decoration',
          include: '地图轮廓、定位点、经纬度和引线',
          exclude: '不得包含主标题和列表模块',
          stackingOrder: 3,
          expectedRegion: { left: 60, top: 38, width: 28, height: 18 },
        },
      ],
    });

    const plan = buildLayerPlanFromAnalysis(analysis, {
      prompt: '请拆分这张深圳海报',
      template: 'poster',
      strategy: 'ai-plan',
      language: 'zh',
      textPolicy: {
        preferEditableText: true,
        avoidBakedText: true,
      },
      analysisModel: 'gpt-5.5',
    });

    expect(plan.title).toBe('深圳城市海报');
    expect(plan.analysis?.model).toBe('gpt-5.5');
    expect(plan.layers.map((layer) => layer.name)).toEqual([
      '背景底图',
      '主标题与副标题',
      '地图定位与坐标',
    ]);
    expect(plan.layers.map((layer) => layer.name)).not.toContain('视觉主体');
    expect(plan.layers[1].generationPrompt).toContain(
      '不得包含地图、列表或另一份标题副本'
    );
    expect(plan.layers[1].bounds).toEqual({
      left: 18,
      top: 14,
      width: 64,
      height: 20,
    });
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
    expect(plan.layers[1].generationPrompt).toContain(
      '同画布透明栅格层完整保留'
    );
    expect(plan.layers[1].generationPrompt).toContain(
      '不要把文字合并进背景或主体层'
    );
    expect(plan.layers[1].generationPrompt).toContain(
      '只能出现在它所属的一个图层'
    );
  });

  it('builds IMAGE task plans from dynamic visual analysis without native PSD claims', () => {
    const plan = buildLayerPlanFromAnalysis(
      parsePsdLayerAnalysisResponse({
        title: '深圳城市海报',
        layers: [
          {
            name: '背景底图',
            type: 'background',
            include: '背景照片和底色',
            exclude: '标题、坐标、地图和列表',
            stackingOrder: 1,
          },
          {
            name: '主标题与副标题',
            type: 'text',
            include: '主标题和紧邻副标题',
            exclude: '地图、列表、背景',
            stackingOrder: 2,
          },
          {
            name: '地图定位与坐标',
            type: 'decoration',
            include: '地图、定位点和坐标文字',
            exclude: '主标题和列表',
            stackingOrder: 3,
          },
        ],
      }),
      {
        prompt: '品牌活动海报，产品主体需要独立图层',
        template: 'poster',
        strategy: 'ai-plan',
        language: 'zh',
      }
    );

    const taskPlans = buildPsdLayerImageTaskPlans(plan, {
      model: 'image-model',
      modelRef: { profileId: 'default', modelId: 'image-model' },
      size: '1024x1024',
      width: 1024,
      height: 1024,
      extraParams: { size: '1024x1024' },
      language: 'zh',
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
      'psd-layer-3',
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
      autoInsertToCanvas: false,
    });
    expect(taskPlans[0].params.prompt).toContain('同画布硬性要求');
    expect(taskPlans[0].params.prompt).toContain('原始坐标位置');
    expect(taskPlans[0].params.prompt).toContain('真实透明背景的 PNG');
    expect(taskPlans[1].params.prompt).toContain('文字图层要求');
    expect(taskPlans[1].params.prompt).toContain('互斥要求');
    expect(taskPlans[1].params.prompt).toContain('棋盘格');
    expect(`${taskPlans[0].taskType}`).not.toBe('psd');
    expect(taskPlans[0].params.promptMeta?.tags).toEqual([
      ...PSD_LAYER_IMAGE_TASK_CONTRACT.promptMetaTags,
    ]);
    expect(taskPlans[0].params.promptMeta?.tags).not.toContain('layer-plan');
  });

  it('creates a PSD draft and maps per-layer task states by layer id', () => {
    const plan = buildLayerPlanFromAnalysis(
      parsePsdLayerAnalysisResponse({
        title: '深圳城市海报',
        layers: [
          {
            name: '背景底图',
            type: 'background',
            include: '背景照片和底色',
            exclude: '标题、坐标、地图和列表',
            stackingOrder: 1,
          },
          {
            name: '主标题与副标题',
            type: 'text',
            include: '主标题和紧邻副标题',
            exclude: '地图、列表、背景',
            stackingOrder: 2,
          },
          {
            name: '地图定位与坐标',
            type: 'decoration',
            include: '地图、定位点和坐标文字',
            exclude: '主标题和列表',
            stackingOrder: 3,
          },
        ],
      }),
      {
        prompt: '品牌活动海报',
        template: 'poster',
        strategy: 'ai-plan',
        language: 'zh',
      }
    );

    const draft = createPsdDraftFromPlan({
      plan,
      prompt: '品牌活动海报',
      sourceImage: {
        url: 'data:image/png;base64,cG9zdGVy',
        name: 'poster.png',
      },
      analysisTaskId: 'analysis-task',
    });

    expect(draft).toMatchObject({
      id: plan.planId,
      prompt: '品牌活动海报',
      analysisTaskId: 'analysis-task',
      assetBatchId: null,
    });
    expect(draft.layers.map((layer) => layer.status)).toEqual([
      'planned',
      'planned',
      'planned',
    ]);

    const editedDraft = updatePsdDraftLayer(draft, 'psd-layer-2', {
      name: '主视觉标题',
      prompt: '只提取标题像素，不包含地图',
      visible: false,
    });
    expect(editedDraft.layers[1]).toMatchObject({
      name: '主视觉标题',
      prompt: '只提取标题像素，不包含地图',
      visible: false,
    });
    expect(draft.layers[1].name).toBe('主标题与副标题');

    const layerTaskStateMap = buildPsdLayerTaskStateMap(plan.layers, [
      createMockPsdTask({
        id: 'layer-task-1',
        status: TaskStatus.COMPLETED,
        createdAt: 100,
        updatedAt: 100,
        params: {
          psdPlan: { layerId: 'psd-layer-1', layerName: '背景底图' },
        },
        result: {
          url: 'data:image/png;base64,YmFja2dyb3VuZA==',
          format: 'png',
          size: 100,
        },
      }),
      createMockPsdTask({
        id: 'layer-task-1-retry',
        status: TaskStatus.FAILED,
        createdAt: 200,
        updatedAt: 200,
        params: {
          psdPlan: { layerId: 'psd-layer-1', layerName: '背景底图' },
        },
        error: { code: 'API_ERROR', message: 'retry failed' },
      }),
      createMockPsdTask({
        id: 'layer-task-2',
        status: TaskStatus.FAILED,
        params: {
          psdPlan: { layerId: 'psd-layer-2', layerName: '主标题与副标题' },
        },
        error: { code: 'API_ERROR', message: 'quota exceeded' },
      }),
      createMockPsdTask({
        id: 'layer-task-3',
        status: TaskStatus.PROCESSING,
        params: {
          psdPlan: { layerId: 'psd-layer-3', layerName: '地图定位与坐标' },
        },
      }),
    ]);

    expect(layerTaskStateMap['psd-layer-1']).toMatchObject({
      status: 'failed',
      taskId: 'layer-task-1-retry',
      resultUrls: [],
      error: 'retry failed',
    });
    expect(layerTaskStateMap['psd-layer-2']).toMatchObject({
      status: 'failed',
      taskId: 'layer-task-2',
      error: 'quota exceeded',
    });
    expect(layerTaskStateMap['psd-layer-3']).toMatchObject({
      status: 'processing',
      taskId: 'layer-task-3',
    });
    expect(getRetryablePsdLayerIds(layerTaskStateMap)).toEqual([
      'psd-layer-1',
      'psd-layer-2',
    ]);
    expect(
      getFailedPsdLayerEntries(
        [
          createMockPsdTask({
            id: 'old-failed-layer-2',
            status: TaskStatus.FAILED,
            createdAt: 100,
            updatedAt: 100,
            params: {
              psdPlan: {
                layerId: 'psd-layer-2',
                layerName: '主标题与副标题',
              },
            },
            error: { code: 'OLD_ERROR', message: 'old failure' },
          }),
          createMockPsdTask({
            id: 'new-failed-layer-2',
            status: TaskStatus.CANCELLED,
            createdAt: 200,
            updatedAt: 200,
            params: {
              psdPlan: {
                layerId: 'psd-layer-2',
                layerName: '主标题与副标题',
              },
            },
            error: { code: 'USER_CANCELLED', message: 'new cancellation' },
          }),
        ],
        plan.layers
      )
    ).toEqual([
      expect.objectContaining({
        layerId: 'psd-layer-2',
        taskId: 'new-failed-layer-2',
        status: TaskStatus.CANCELLED,
        error: 'new cancellation',
      }),
    ]);
  });

  it('maps PSD layer task state from params.psdPlan.layerId instead of any top-level layerId', () => {
    const plan = buildLayerPlanFromAnalysis(
      parsePsdLayerAnalysisResponse({
        title: '深圳城市海报',
        layers: [
          {
            name: '背景底图',
            type: 'background',
            include: '背景照片和底色',
            exclude: '标题',
            stackingOrder: 1,
          },
          {
            name: '主标题与副标题',
            type: 'text',
            include: '主标题和紧邻副标题',
            exclude: '背景',
            stackingOrder: 2,
          },
        ],
      }),
      {
        prompt: '品牌活动海报',
        template: 'poster',
        strategy: 'ai-plan',
        language: 'zh',
      }
    );
    const taskWithStaleTopLevelLayerId = {
      ...createMockPsdTask({
        id: 'layer-task-from-params',
        status: TaskStatus.COMPLETED,
        params: {
          psdPlan: {
            layerId: 'psd-layer-2',
            layerName: '主标题与副标题',
          },
        },
        result: {
          url: 'data:image/png;base64,aGVhZGxpbmU=',
          format: 'png',
          size: 100,
        },
      }),
      layerId: 'psd-layer-1',
    } as Task & { layerId: string };

    const layerTaskStateMap = buildPsdLayerTaskStateMap(plan.layers, [
      taskWithStaleTopLevelLayerId,
    ]);

    expect(layerTaskStateMap['psd-layer-1']).toMatchObject({
      status: 'planned',
      taskId: null,
    });
    expect(layerTaskStateMap['psd-layer-2']).toMatchObject({
      status: 'ready',
      taskId: 'layer-task-from-params',
      resultUrls: ['data:image/png;base64,aGVhZGxpbmU='],
    });
    expect(
      getFailedPsdLayerEntries(
        [
          {
            ...createMockPsdTask({
              id: 'failed-task-from-params',
              status: TaskStatus.FAILED,
              params: {
                psdPlan: {
                  layerId: 'psd-layer-2',
                  layerName: '主标题与副标题',
                },
              },
              error: { code: 'API_ERROR', message: 'layer failed' },
            }),
            layerId: 'psd-layer-1',
          } as Task & { layerId: string },
        ],
        plan.layers
      )
    ).toEqual([
      expect.objectContaining({
        layerId: 'psd-layer-2',
        layerName: '主标题与副标题',
        taskId: 'failed-task-from-params',
        error: 'layer failed',
      }),
    ]);
  });

  it('summarizes retry status by params.psdPlan.layerId instead of stale top-level layerId', () => {
    const olderFailedTask = {
      ...createMockPsdTask({
        id: 'layer-task-old-failed',
        status: TaskStatus.FAILED,
        createdAt: 100,
        updatedAt: 100,
        params: {
          psdPlan: {
            layerId: 'psd-layer-2',
            layerName: '主标题与副标题',
          },
        },
        error: { code: 'API_ERROR', message: 'old layer failed' },
      }),
      layerId: 'psd-layer-1',
    } as Task & { layerId: string };
    const newerSuccessfulRetry = {
      ...createMockPsdTask({
        id: 'layer-task-new-ready',
        status: TaskStatus.COMPLETED,
        createdAt: 200,
        updatedAt: 200,
        params: {
          psdPlan: {
            layerId: 'psd-layer-2',
            layerName: '主标题与副标题',
          },
        },
        result: {
          url: 'data:image/png;base64,cmV0cnk=',
          format: 'png',
          size: 100,
        },
      }),
      layerId: 'psd-layer-1',
    } as Task & { layerId: string };

    const stats = buildPsdTaskStats(
      [olderFailedTask, newerSuccessfulRetry],
      1,
      'zh'
    );

    expect(stats).toMatchObject({
      total: 1,
      completed: 1,
      failed: 0,
      tone: 'success',
      isActive: false,
    });
  });

  it('builds one PSD-ready image edit task without GPT Image 2 unsupported params', () => {
    const plan = buildLayerPlan(
      '品牌活动海报，产品主体需要独立图层',
      'poster',
      'ai-plan',
      5,
      'zh'
    );

    const taskPlan = buildPsdReadyImageTaskPlan(plan, {
      model: 'gpt-image-2',
      modelRef: { profileId: 'default', modelId: 'gpt-image-2' },
      uploadedImages: [
        { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
      ],
      size: '1024x1024',
      width: 1024,
      height: 1024,
      extraParams: {
        size: '1024x1024',
        response_format: 'url',
        inputFidelity: 'high',
        background: 'transparent',
      },
    });

    expect(taskPlan.taskType).toBe(TaskType.IMAGE);
    expect(taskPlan.params).toMatchObject({
      model: 'gpt-image-2',
      generationMode: 'image_edit',
      background: 'auto',
      outputFormat: 'png',
      batchIndex: 1,
      batchTotal: 1,
      autoInsertToCanvas: false,
    });
    expect(taskPlan.params.referenceImages).toEqual([
      'data:image/png;base64,cG9zdGVy',
    ]);
    expect(taskPlan.params.inputFidelity).toBeUndefined();
    expect(taskPlan.params.params).toEqual({
      size: '1024x1024',
      background: 'auto',
    });
    expect(taskPlan.params.prompt).toContain('当前图片接口返回图片数据');
    expect(taskPlan.params.psdPlan).toMatchObject({
      layerId: 'psd-ready-composite',
      exportTarget: 'psd',
      packaging: 'app-side-required',
      apiNativePsdOutput: false,
    });
    expect(taskPlan.params.promptMeta?.tags).toContain('psd-ready');
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
      extraParams: {
        size: '1024x1024',
        response_format: 'url',
        inputFidelity: 'high',
        background: 'transparent',
      },
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
      expect(taskPlan.params.background).toBe(
        PSD_LAYER_IMAGE_TASK_CONTRACT.background
      );
      expect(taskPlan.params.inputFidelity).toBeUndefined();
      expect(taskPlan.params.params).toEqual({
        size: '1024x1024',
        background: 'auto',
      });
      expect(taskPlan.params.prompt).toMatch(/later app-side PSD packaging/i);
    }
  });
});

describe('AIImagePsdGeneration contract', () => {
  afterEach(() => {
    cleanup();
    mockState.referenceUploadProps = [];
    mockState.tasks = [];
    mockState.addAsset.mockClear();
    mockState.createTask.mockClear();
    mockState.triggerBlobDownload.mockClear();
  });

  const markLayerPlanReviewed = () => {
    fireEvent.click(screen.getByLabelText('我已审阅图层计划'));
  };

  it('exports the PSD mode component for lazy dialog loading', () => {
    expect(AIImagePsdGeneration).toBeTypeOf('function');
  });

  it('renders an Opentu PSD workbench composer without tuning controls', () => {
    const { container } = render(<AIImagePsdGeneration />);

    const root = container.querySelector('.ai-psd-generation-container');
    const workbench = root?.querySelector('.psd-workbench');
    expect(
      root?.classList.contains('ai-psd-generation-container--workbench')
    ).toBe(true);
    expect(workbench).toBeTruthy();
    expect(workbench?.querySelectorAll('.psd-workbench__workspace-grid')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__left-rail')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__center-stage')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__right-rail')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__main-column')).toHaveLength(
      0
    );
    expect(workbench?.querySelectorAll('.psd-workbench__side-column')).toHaveLength(
      0
    );
    expect(workbench?.querySelectorAll('.psd-workbench__region--header')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__region--brief')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__region--canvas')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__region--plan')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__operations')).toHaveLength(
      1
    );
    expect(workbench?.querySelectorAll('.psd-workbench__rail-marker')).toHaveLength(
      3
    );
    expect(screen.getByText('01 简报 / 源图')).toBeTruthy();
    expect(screen.getByText('02 主画布工作台')).toBeTruthy();
    expect(screen.getByText('03 图层 / 状态 / 导出')).toBeTruthy();

    expect(screen.getByText('PSD 分层任务简报')).toBeTruthy();
    expect(
      screen.getByText(/像制作任务单一样管理源图、拆层目标、约束和主操作/)
    ).toBeTruthy();
    expect(screen.getByLabelText('PSD 分层任务简报')).toBeTruthy();
    expect(screen.getByLabelText('PSD 连续画布')).toBeTruthy();
    expect(screen.getByLabelText('PSD 图层计划')).toBeTruthy();
    expect(screen.getByLabelText('PSD 图层计划、状态与导出')).toBeTruthy();
    expect(screen.getByLabelText('PSD 检查器、生成状态与导出')).toBeTruthy();
    expect(screen.getByLabelText('PSD 工作流阶段')).toBeTruthy();
    expect(screen.getByText('画布预览')).toBeTruthy();
    expect(screen.getByText('检查器')).toBeTruthy();
    expect(screen.getByText('需要 1 张参考图')).toBeTruthy();
    expect(screen.getByText('等待分析简报')).toBeTruthy();
    expect(screen.getByText('分析图层结构')).toBeTruthy();
    expect(
      (screen.getByLabelText('PSD 图层提取简报') as HTMLTextAreaElement).value
    ).toBe('');
    expect(screen.queryByTestId('model-dropdown')).toBeNull();
    expect(screen.queryByTestId('parameters-dropdown')).toBeNull();
    const hiddenTuningCopyPattern = new RegExp(
      ['\u56fe\u5c42\u6570\u91cf', '\u6a21\u578b\u53c2\u6570'].join('|')
    );
    expect(screen.queryByText(hiddenTuningCopyPattern)).toBeNull();
    expect(screen.queryByText('尚未生成图层计划')).toBeNull();
    expect(screen.queryByText('PSD 文件预览')).toBeNull();
    expect(screen.getByLabelText('PSD 源图上传区')).toBeTruthy();
    expect(screen.getByText('拖入、粘贴或选择一张源图')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '从素材库选择源图' })
    ).toBeTruthy();
    expect(screen.queryByTestId('reference-upload')).toBeNull();
    expect(
      screen.getByText(/导出始终是 \.psd-ready-workspace\.zip/)
    ).toBeTruthy();
  });

  it('locks the desktop PSD workbench to one no-page-scroll viewport shell', () => {
    const layoutScssPath =
      'packages/drawnix/src/components/ttd-dialog/psd-workbench/_layout.scss';
    const packageCwdLayoutScssPath =
      'src/components/ttd-dialog/psd-workbench/_layout.scss';
    const layoutScss = readFileSync(
      existsSync(layoutScssPath) ? layoutScssPath : packageCwdLayoutScssPath,
      'utf8'
    );

    expect(layoutScss).toContain('.ai-psd-generation-container--workbench');
    expect(layoutScss).toMatch(
      /\.ai-psd-generation-container--workbench\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/
    );
    expect(layoutScss).toMatch(
      /\.psd-workbench\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);[\s\S]*?height:\s*100%;/
    );
    expect(layoutScss).toMatch(
      /\.psd-workbench__workspace-grid\s*\{[\s\S]*?grid-template-columns:[\s\S]*?minmax\(232px,\s*0\.54fr\)[\s\S]*?minmax\(420px,\s*2\.24fr\)[\s\S]*?minmax\(292px,\s*0\.72fr\);[\s\S]*?grid-template-areas:\s*'brief canvas plan';[\s\S]*?min-height:\s*0;/
    );
    expect(layoutScss).toMatch(
      /\.psd-workbench__center-stage\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\);[\s\S]*?var\(--psd-stage-bg\);/
    );
    expect(layoutScss).toMatch(
      /\.psd-workbench__right-rail\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1\.1fr\) minmax\(254px,\s*0\.7fr\);[\s\S]*?overflow:\s*hidden;/
    );
    expect(layoutScss).toContain('psd-workbench__rail-marker--canvas');
    expect(layoutScss).toMatch(
      /\.psd-workbench__operations\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/
    );
    expect(layoutScss).toContain('.psd-workbench__rail-marker--canvas');
    expect(layoutScss).not.toContain('psd-workbench__main-column');
    expect(layoutScss).not.toContain('psd-workbench__side-column');
    expect(layoutScss).not.toMatch(/<<<<<<<|=======|>>>>>>>/);

    const desktopColumns = layoutScss.match(
      /grid-template-columns:\s*minmax\(232px,\s*([\d.]+)fr\)\s*minmax\(420px,\s*([\d.]+)fr\)\s*minmax\(292px,\s*([\d.]+)fr\);/
    );
    expect(desktopColumns).toBeTruthy();
    if (desktopColumns) {
      const [, leftRail, centerStage, rightRail] = desktopColumns.map(Number);
      expect(centerStage).toBeGreaterThan(leftRail + rightRail);
    }
  });

  it('gives PSD mode its own WinBox shell instead of inheriting the generic image frame', () => {
    const dialogPath = 'packages/drawnix/src/components/ttd-dialog/ttd-dialog.tsx';
    const packageCwdDialogPath = 'src/components/ttd-dialog/ttd-dialog.tsx';
    const winboxScssPath = 'packages/drawnix/src/components/winbox/winbox-custom.scss';
    const packageCwdWinboxScssPath = 'src/components/winbox/winbox-custom.scss';
    const dialogSource = readFileSync(
      existsSync(dialogPath) ? dialogPath : packageCwdDialogPath,
      'utf8'
    );
    const winboxScss = readFileSync(
      existsSync(winboxScssPath) ? winboxScssPath : packageCwdWinboxScssPath,
      'utf8'
    );

    expect(dialogSource).toContain('winbox-ai-image-generation--psd');
    expect(winboxScss).toMatch(
      /\.winbox-ai-generation\.winbox-ai-image-generation--psd\s*\{[\s\S]*?\.wb-body\s*\{[\s\S]*?overflow:\s*hidden;/
    );
    expect(winboxScss).toMatch(
      /\.winbox-ai-generation\.winbox-ai-image-generation--psd\s*\{[\s\S]*?\.winbox-content-wrapper\s*\{[\s\S]*?padding:\s*0;[\s\S]*?overflow:\s*hidden;/
    );
    expect(winboxScss).toMatch(
      /\.ai-psd-generation-container--workbench\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/
    );
  });

  it('loads the PSD source image from the media library as well as local upload paths', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      blob: async () => new Blob(['library image'], { type: 'image/png' }),
    })) as unknown as typeof fetch;

    try {
      render(<AIImagePsdGeneration />);

      fireEvent.click(screen.getByRole('button', { name: '从素材库选择源图' }));
      fireEvent.click(
        screen.getByText('mock select source from media library')
      );

      await waitFor(() => {
        expect(
          screen.getAllByText('library-poster.png').length
        ).toBeGreaterThan(0);
      });
      expect(screen.getAllByText('源图已载入').length).toBeGreaterThan(0);
      expect(globalThis.fetch).toHaveBeenCalledWith('blob:asset-source');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('preserves local upload, drag, paste, preview, and brief controls in the PSD source desk', async () => {
    const { container } = render(<AIImagePsdGeneration />);
    const sourceInput = container.querySelector(
      '.psd-source-field__input'
    ) as HTMLInputElement | null;
    const uploader = screen.getByLabelText('PSD 源图上传区');

    expect(sourceInput).toBeTruthy();
    expect(screen.getByText('拖入、粘贴或选择一张源图')).toBeTruthy();
    expect(screen.getByText('用于 CHAT 图层分析；这里只保留 1 张 PSD 分层参考图。')).toBeTruthy();
    expect(screen.getByRole('button', { name: /载入源图/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '从素材库选择源图' })).toBeTruthy();
    expect(screen.queryByTestId('reference-upload')).toBeNull();

    const uploadedFile = new File(['uploaded'], 'uploaded-source.png', {
      type: 'image/png',
    });
    fireEvent.change(sourceInput as HTMLInputElement, {
      target: { files: [uploadedFile] },
    });

    await waitFor(() => {
      expect(screen.getAllByText('uploaded-source.png').length).toBeGreaterThan(0);
    });
    expect(screen.getByRole('img', { name: 'uploaded-source.png' })).toBeTruthy();
    expect(mockState.addAsset).toHaveBeenLastCalledWith(
      uploadedFile,
      AssetType.IMAGE,
      AssetSource.LOCAL,
      'uploaded-source.png'
    );

    fireEvent.click(screen.getByRole('button', { name: '移除源图' }));
    const droppedFile = new File(['dropped'], 'dropped-source.png', {
      type: 'image/png',
    });
    fireEvent.drop(uploader, { dataTransfer: { files: [droppedFile] } });

    await waitFor(() => {
      expect(screen.getAllByText('dropped-source.png').length).toBeGreaterThan(0);
    });
    expect(screen.getByRole('img', { name: 'dropped-source.png' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '移除源图' }));
    const pastedFile = new File(['pasted'], 'pasted-source.png', {
      type: 'image/png',
    });
    fireEvent.paste(uploader, { clipboardData: { files: [pastedFile] } });

    await waitFor(() => {
      expect(screen.getAllByText('pasted-source.png').length).toBeGreaterThan(0);
    });
    expect(screen.getByRole('img', { name: 'pasted-source.png' })).toBeTruthy();
    expect(screen.getByLabelText('PSD 图层提取简报')).toBeTruthy();
    expect(screen.getByRole('button', { name: '分析图层结构' })).toBeTruthy();
  });

  it('reviews GPT-5.5 layer analysis before queuing editable layer assets', async () => {
    const { rerender } = render(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '分析图层结构' }));

    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(1);
    });
    expect(mockState.createTask.mock.calls[0]?.[1]).toBe(TaskType.CHAT);
    expect(mockState.createTask.mock.calls[0]?.[0]).toMatchObject({
      model: 'gpt-5.5',
      referenceImages: ['data:image/png;base64,cG9zdGVy'],
      params: {
        reasoning_effort: 'high',
        psdLayerAnalysis: true,
      },
    });
    expect(screen.getAllByText('gpt-5.5 正在分析图层').length).toBeGreaterThan(
      0
    );
    expect(screen.queryByRole('button', { name: '生成图层素材' })).toBeNull();
    expect(
      mockState.createTask.mock.calls.map((call: CreateTaskCall) => call[1])
    ).toEqual([TaskType.CHAT]);

    mockState.tasks = [
      createMockPsdTask({
        id: 'task-1',
        type: TaskType.CHAT,
        status: TaskStatus.COMPLETED,
        params: mockState.createTask.mock.calls[0]?.[0],
        result: {
          url: '',
          format: 'md',
          size: 100,
          chatResponse: createMockAnalysisResponse(),
        },
      }),
    ];
    rerender(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/gpt-5.5 已完成分析/)).toBeTruthy();
    });
    expect(mockState.createTask).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '生成图层素材' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '生成图层素材' })).toHaveProperty(
      'disabled',
      true
    );
    expect(screen.getByText('4 个动态图层')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: '查看图层：主标题与副标题' })
    );
    fireEvent.change(screen.getByLabelText('图层名称：主标题与副标题'), {
      target: { value: '主视觉标题' },
    });
    fireEvent.change(screen.getByLabelText('图层提示词：主视觉标题'), {
      target: { value: '只提取标题像素，不包含地图' },
    });
    expect(screen.getByDisplayValue('主视觉标题')).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: '隐藏图层：主视觉标题' })[1]
    );
    expect(
      (
        screen.getByRole('checkbox', {
          name: '参与生成与导出：主视觉标题',
        }) as HTMLInputElement
      ).checked
    ).toBe(false);
    fireEvent.click(
      screen.getAllByRole('button', { name: '显示图层：主视觉标题' })[1]
    );
    expect(
      (
        screen.getByRole('checkbox', {
          name: '参与生成与导出：主视觉标题',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);

    markLayerPlanReviewed();
    fireEvent.click(screen.getByRole('button', { name: '生成图层素材' }));

    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(5);
    });
    expect(screen.getByText('同画布图层任务已排队')).toBeTruthy();
    expect(
      screen.getByText(/成功 0 \/ 失败 0 \/ 进行中 0 \/ 排队 4 \/ 总计 4/)
    ).toBeTruthy();
    expect(screen.getByText(/打开任务队列查看/)).toBeTruthy();
    expect(screen.getAllByText(/PSD.*工作区包/).length).toBeGreaterThan(0);
    expect(
      mockState.createTask.mock.calls
        .slice(1)
        .every((call: CreateTaskCall) => call[1] === TaskType.IMAGE)
    ).toBe(true);
    expect(
      mockState.createTask.mock.calls
        .slice(1)
        .some(
          (call: CreateTaskCall) => call[0]?.psdPlan?.layerName === '主视觉标题'
        )
    ).toBe(true);
    expect(
      mockState.createTask.mock.calls
        .slice(1)
        .some((call: CreateTaskCall) =>
          String(call[0]?.prompt).includes('只提取标题像素')
        )
    ).toBe(true);
    expect(screen.getByText('查看图层：主视觉标题')).toBeTruthy();
    expect(screen.getByText('同画布 / 原坐标 / 透明背景')).toBeTruthy();
    expect(screen.queryByText(`查看可选${'拆分'}明细`)).toBeNull();
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull();
  });

  it('summarizes completed PSD layer tasks instead of staying on a static started state', async () => {
    const { rerender, container } = render(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '分析图层结构' }));

    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(1);
    });

    mockState.tasks = [
      createMockPsdTask({
        id: 'task-1',
        type: TaskType.CHAT,
        status: TaskStatus.COMPLETED,
        params: mockState.createTask.mock.calls[0]?.[0],
        result: {
          url: '',
          format: 'md',
          size: 100,
          chatResponse: createMockAnalysisResponse(),
        },
      }),
    ];
    rerender(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '生成图层素材' })).toBeTruthy();
    });
    expect(mockState.createTask).toHaveBeenCalledTimes(1);
    markLayerPlanReviewed();
    fireEvent.click(screen.getByRole('button', { name: '生成图层素材' }));
    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(5);
    });

    expect(
      screen
        .getByRole('progressbar', { name: 'PSD-ready 任务进度' })
        .getAttribute('aria-valuenow')
    ).toBe('0');
    expect(
      screen.getByRole('button', { name: '下载 PSD-ready 工作区包' })
    ).toHaveProperty('disabled', true);
    const layerTaskCalls = mockState.createTask.mock.calls.slice(1);
    const createdBatchId = layerTaskCalls[0]?.[0]?.batchId;
    mockState.tasks = layerTaskCalls.map((call: CreateTaskCall, index) =>
      createMockPsdTask({
        id: `layer-task-${index + 1}`,
        status: TaskStatus.COMPLETED,
        params: {
          ...call[0],
          batchId: createdBatchId,
          batchIndex: index + 1,
          batchTotal: layerTaskCalls.length,
        },
        result: {
          url: `data:image/png;base64,${
            ['YmFja2dyb3VuZA==', 'aGVhZGxpbmU=', 'bWFw', 'Zm9vdGVy'][index]
          }`,
          format: 'png',
          size: 100,
          width: 1024,
          height: 1024,
        },
      })
    );
    rerender(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );

    expect(screen.getByText('同画布图层已生成完成')).toBeTruthy();
    expect(screen.getByText(/成功 4 \/ 总计 4/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '下载 PSD-ready 工作区包' })
    ).toBeTruthy();
    expect(
      screen
        .getByRole('progressbar', { name: 'PSD-ready 任务进度' })
        .getAttribute('aria-valuenow')
    ).toBe('100');
    expect(
      screen.getByRole('button', { name: '下载 PSD-ready 工作区包' })
    ).toHaveProperty('disabled', false);
    expect(screen.getByText('分层结果叠放预览')).toBeTruthy();
    expect(screen.getByText('源图 / 叠放 / 图层目标')).toBeTruthy();
    expect(screen.getByRole('button', { name: /原图对照/ })).toBeTruthy();
    expect(
      container.querySelectorAll('.psd-stage__layer-outline')
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '显示边界' }));
    expect(
      container.querySelectorAll('.psd-stage__layer-outline')
    ).toHaveLength(4);
    expect(
      screen
        .getByRole('img', { name: '叠放图层：主标题与副标题' })
        .getAttribute('src')
    ).toBe('data:image/png;base64,aGVhZGxpbmU=');
    fireEvent.click(screen.getByRole('button', { name: '原图' }));
    expect(screen.getByText('源图预览')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '叠放' }));
    expect(screen.getByText('分层结果叠放预览')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '查看图层：背景底图' }));
    expect(screen.getByText('查看图层：背景底图')).toBeTruthy();
    expect(
      screen
        .getByRole('img', { name: 'PSD 图层结果：背景底图' })
        .getAttribute('src')
    ).toBe('data:image/png;base64,YmFja2dyb3VuZA==');
    fireEvent.click(
      screen.getByRole('button', { name: '下载 PSD-ready 工作区包' })
    );
    await waitFor(() => {
      expect(mockState.triggerBlobDownload).toHaveBeenCalledTimes(1);
    });
    const downloadedBlob = mockState.triggerBlobDownload.mock
      .calls[0]?.[0] as Blob;
    const downloadedFilename = mockState.triggerBlobDownload.mock.calls[0]?.[1];
    expect(downloadedFilename).toContain('.psd-ready-workspace.zip');

    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(downloadedBlob);
    expect(
      Object.keys(zip.files).some((path) => path.startsWith('layers/'))
    ).toBe(true);
    expect(zip.file('source/1-poster.png')).toBeTruthy();
    expect(zip.file('README.md')).toBeTruthy();

    const manifestText = await zip.file('manifest.json')?.async('string');
    expect(manifestText).toBeTruthy();
    const manifest = JSON.parse(manifestText || '{}');
    expect(manifest.officialApiBoundary.apiReturnsNativePsd).toBe(false);
    expect(manifest.officialApiBoundary.apiReturnsImageData).toBe(true);
    expect(manifest.layerContract.sameCanvasAsOriginal).toBe(true);
    expect(manifest.layerContract.photoshopStackingInPlace).toBe(true);
    expect(manifest.assets.generated[0].kind).toBe('same-canvas-layer');
    expect(manifest.assets.generated[0].path).toContain('layers/');
    expect(manifest.assets.generated[0].url).toBeUndefined();
    expect(manifest.assets.references[0].path).toBe('source/1-poster.png');
    expect(manifest.assets.references[0].url).toBeUndefined();
    expect(screen.queryByText(/原生 PSD 下载已完成/)).toBeNull();
  });

  it('shows failed PSD layer counts and points users to task queue errors', async () => {
    const { rerender } = render(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '分析图层结构' }));

    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(1);
    });

    mockState.tasks = [
      createMockPsdTask({
        id: 'task-1',
        type: TaskType.CHAT,
        status: TaskStatus.COMPLETED,
        params: mockState.createTask.mock.calls[0]?.[0],
        result: {
          url: '',
          format: 'md',
          size: 100,
          chatResponse: createMockAnalysisResponse(),
        },
      }),
    ];
    rerender(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '生成图层素材' })).toBeTruthy();
    });
    expect(mockState.createTask).toHaveBeenCalledTimes(1);
    markLayerPlanReviewed();
    fireEvent.click(screen.getByRole('button', { name: '生成图层素材' }));
    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(5);
    });

    const layerTaskCalls = mockState.createTask.mock.calls.slice(1);
    const createdBatchId = layerTaskCalls[0]?.[0]?.batchId;
    mockState.tasks = layerTaskCalls.map((call: CreateTaskCall, index) =>
      createMockPsdTask({
        id: `layer-task-${index + 1}`,
        status: TaskStatus.FAILED,
        params: {
          ...call[0],
          batchId: createdBatchId,
          batchIndex: index + 1,
          batchTotal: layerTaskCalls.length,
        },
        error: { code: 'API_ERROR', message: 'quota exceeded' },
      })
    );
    rerender(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );

    expect(screen.getByText('同画布图层生成失败')).toBeTruthy();
    expect(
      screen.getByText(/成功 0 \/ 失败 4 \/ 进行中 0 \/ 排队 0 \/ 总计 4/)
    ).toBeTruthy();
    expect(screen.getByText(/任务失败。请在任务队列查看错误详情/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '重试图层：背景底图' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '重试全部失败图层' })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '重试图层：背景底图' }));
    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(6);
    });
    expect(mockState.createTask.mock.calls[5]?.[1]).toBe(TaskType.IMAGE);
    expect(mockState.createTask.mock.calls[5]?.[0]?.psdPlan?.layerId).toBe(
      'psd-layer-1'
    );
  });

  it('downloads a partial PSD-ready workspace and records failed layers in manifest', async () => {
    const { rerender } = render(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '分析图层结构' }));

    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(1);
    });

    mockState.tasks = [
      createMockPsdTask({
        id: 'task-1',
        type: TaskType.CHAT,
        status: TaskStatus.COMPLETED,
        params: mockState.createTask.mock.calls[0]?.[0],
        result: {
          url: '',
          format: 'md',
          size: 100,
          chatResponse: createMockAnalysisResponse(),
        },
      }),
    ];
    rerender(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '生成图层素材' })).toBeTruthy();
    });
    markLayerPlanReviewed();
    fireEvent.click(screen.getByRole('button', { name: '生成图层素材' }));
    await waitFor(() => {
      expect(mockState.createTask).toHaveBeenCalledTimes(5);
    });

    const layerTaskCalls = mockState.createTask.mock.calls.slice(1);
    const createdBatchId = layerTaskCalls[0]?.[0]?.batchId;
    const currentLayerTasks = layerTaskCalls.map(
      (call: CreateTaskCall, index) =>
        createMockPsdTask({
          id: `layer-task-${index + 1}`,
          status: index === 0 ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          createdAt: 200 + index,
          updatedAt: 200 + index,
          params: {
            ...call[0],
            batchId: createdBatchId,
            batchIndex: index + 1,
            batchTotal: layerTaskCalls.length,
          },
          result:
            index === 0
              ? {
                  url: 'data:image/png;base64,YmFja2dyb3VuZA==',
                  format: 'png',
                  size: 100,
                  width: 1024,
                  height: 1024,
                }
              : undefined,
          error:
            index === 0
              ? undefined
              : { code: 'API_ERROR', message: 'quota exceeded' },
        })
    );
    mockState.tasks = [
      createMockPsdTask({
        id: 'old-layer-task-1',
        status: TaskStatus.COMPLETED,
        createdAt: 100,
        updatedAt: 100,
        params: {
          ...layerTaskCalls[0]?.[0],
          batchId: createdBatchId,
          batchIndex: 1,
          batchTotal: layerTaskCalls.length,
        },
        result: {
          url: 'data:image/png;base64,b2xkLWJhY2tncm91bmQ=',
          format: 'png',
          size: 100,
          width: 1024,
          height: 1024,
        },
      }),
      createMockPsdTask({
        id: 'old-layer-task-2',
        status: TaskStatus.FAILED,
        createdAt: 100,
        updatedAt: 100,
        params: {
          ...layerTaskCalls[1]?.[0],
          batchId: createdBatchId,
          batchIndex: 2,
          batchTotal: layerTaskCalls.length,
        },
        error: { code: 'OLD_ERROR', message: 'old quota exceeded' },
      }),
      ...currentLayerTasks,
    ];
    rerender(
      <AIImagePsdGeneration
        initialPrompt="品牌活动海报"
        initialImages={[
          { url: 'data:image/png;base64,cG9zdGVy', name: 'poster.png' },
        ]}
      />
    );

    expect(screen.getByText('同画布图层任务未完成')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '下载 PSD-ready 工作区包' })
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: '下载 PSD-ready 工作区包' })
    );

    await waitFor(() => {
      expect(mockState.triggerBlobDownload).toHaveBeenCalledTimes(1);
    });

    const downloadedBlob = mockState.triggerBlobDownload.mock
      .calls[0]?.[0] as Blob;
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(downloadedBlob);
    const manifestText = await zip.file('manifest.json')?.async('string');
    const manifest = JSON.parse(manifestText || '{}');

    expect(manifest.assets.generated).toHaveLength(1);
    expect(manifest.assets.failedLayers).toEqual([
      expect.objectContaining({
        layerId: 'psd-layer-2',
        layerName: '主标题与副标题',
        status: TaskStatus.FAILED,
        error: 'quota exceeded',
      }),
      expect.objectContaining({
        layerId: 'psd-layer-3',
        layerName: '地图定位与坐标',
        status: TaskStatus.FAILED,
      }),
      expect.objectContaining({
        layerId: 'psd-layer-4',
        layerName: '底部信息与装饰',
        status: TaskStatus.FAILED,
      }),
    ]);
  });

  it('omits stale failed layer metadata after a newer retry succeeds', async () => {
    const plan = buildLayerPlanFromAnalysis(
      parsePsdLayerAnalysisResponse(createMockAnalysisResponse()),
      {
        prompt: '品牌活动海报',
        template: 'poster',
        strategy: 'ai-plan',
        language: 'zh',
        textPolicy: {
          preferEditableText: true,
          avoidBakedText: true,
        },
        analysisModel: 'gpt-5.5',
      }
    );
    const olderFailedTask = createMockPsdTask({
      id: 'layer-task-old-failed',
      status: TaskStatus.FAILED,
      createdAt: 1000,
      updatedAt: 1000,
      params: {
        psdPlan: {
          layerId: 'psd-layer-2',
          layerName: '主标题与副标题',
        },
      },
      error: { code: 'API_ERROR', message: 'quota exceeded' },
    });
    const newerSuccessfulRetry = createMockPsdTask({
      id: 'layer-task-new-ready',
      status: TaskStatus.COMPLETED,
      createdAt: 2000,
      updatedAt: 2000,
      params: {
        prompt: 'retry layer',
        model: 'gpt-image-2',
        psdPlan: {
          layerId: 'psd-layer-2',
          layerName: '主标题与副标题',
          layerType: 'text',
        },
      },
      result: {
        url: 'data:image/png;base64,cmV0cnk=',
        format: 'png',
        size: 100,
      },
    });

    await downloadPsdReadyWorkspacePackage({
      task: newerSuccessfulRetry,
      tasks: [olderFailedTask, newerSuccessfulRetry],
      plan,
      prompt: '品牌活动海报',
      referenceImages: [],
      uiLanguage: 'zh',
    });

    const downloadedBlob = mockState.triggerBlobDownload.mock
      .calls[0]?.[0] as Blob;
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(downloadedBlob);
    const manifestText = await zip.file('manifest.json')?.async('string');
    const manifest = JSON.parse(manifestText || '{}');

    expect(manifest.assets.generated).toEqual([
      expect.objectContaining({
        taskId: 'layer-task-new-ready',
        layerId: 'psd-layer-2',
      }),
    ]);
    expect(manifest.assets.failedLayers).toEqual([]);
  });
});

function createMockAnalysisResponse(): string {
  return JSON.stringify({
    title: '深圳城市海报',
    summary: '按真实海报视觉元素动态拆分。',
    layers: [
      {
        name: '背景底图',
        type: 'background',
        include: '底色、纹理、照片氛围',
        exclude: '全部文字、地图、线条和定位标识',
        stackingOrder: 1,
        expectedRegion: { left: 0, top: 0, width: 100, height: 100 },
      },
      {
        name: '主标题与副标题',
        type: 'text',
        include: '深圳主标题、英文副标题和紧邻说明',
        exclude: '地图、列表、背景和另一份标题副本',
        stackingOrder: 2,
        expectedRegion: { left: 18, top: 14, width: 64, height: 20 },
      },
      {
        name: '地图定位与坐标',
        type: 'decoration',
        include: '地图轮廓、定位点、经纬度和引线',
        exclude: '主标题、信息列表和背景',
        stackingOrder: 3,
        expectedRegion: { left: 60, top: 38, width: 28, height: 18 },
      },
      {
        name: '底部信息与装饰',
        type: 'text',
        include: '底部说明文字、分隔线和装饰点',
        exclude: '主标题、地图和背景',
        stackingOrder: 4,
        expectedRegion: { left: 10, top: 72, width: 80, height: 18 },
      },
    ],
    warnings: ['主标题只允许出现在主标题与副标题层。'],
  });
}

function createMockPsdTask(
  overrides: Partial<Task> & {
    params?: Partial<NonNullable<Task['params']>>;
  } = {}
): Task {
  return {
    id: 'task-1',
    type: TaskType.IMAGE,
    status: TaskStatus.PENDING,
    params: {
      prompt: 'psd layer',
      ...(overrides.params || {}),
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
