import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisRecord } from '../types';
import { AnalyzePage } from './AnalyzePage';

vi.mock('../../../hooks/use-drawnix', () => ({
  useDrawnix: () => ({ setAppState: vi.fn() }),
}));

vi.mock('../../../hooks/use-runtime-models', () => ({
  useSelectableModels: () => [],
}));

vi.mock('../../ai-input-bar/ModelDropdown', () => ({
  ModelDropdown: () => <div data-testid="model-dropdown" />,
}));

vi.mock('../../shared', () => ({
  KnowledgeNoteContextSelector: () => <div />,
}));

vi.mock('../../shared/workflow', () => ({
  CreativeBriefEditor: () => <div />,
  VideoParametersRow: () => <div />,
  normalizeCreativeBrief: () => ({}),
}));

vi.mock('../components/ShotTimeline', () => ({
  ShotTimeline: () => <div />,
}));

vi.mock('../components/ShotCard', () => ({
  ShotCard: ({ shot }: { shot: { label: string } }) => <div>{shot.label}</div>,
}));

vi.mock('../../../mcp/tools/video-analyze', () => ({
  videoAnalyzeTool: { execute: vi.fn() },
}));

vi.mock('../../../mcp/tools/canvas-insertion', () => ({
  quickInsert: vi.fn(),
}));

vi.mock('../storage', () => ({
  updateRecord: vi.fn(),
}));

vi.mock('../../../constants/video-model-config', () => ({
  getVideoModelConfig: () => ({
    defaultDuration: '8',
    durationOptions: [],
  }),
}));

vi.mock('../utils', () => ({
  buildVideoPromptGenerationPrompt: vi.fn(),
  readStoredModelSelection: (_key: string, fallback: string) => ({
    modelId: fallback,
    modelRef: null,
  }),
  writeStoredModelSelection: vi.fn(),
}));

vi.mock('../../../services/unified-cache-service', () => ({
  unifiedCacheService: {
    cacheToCacheStorageOnly: vi.fn(),
    deleteCache: vi.fn(),
  },
}));

vi.mock('../../../utils/video-frame-cache', () => ({
  extractFramesFromVideo: vi.fn(),
  cacheFrameBlob: vi.fn(),
}));

vi.mock('../video-source-cache', () => ({
  cacheVideoSource: vi.fn(),
  restoreVideoFileFromSnapshot: vi.fn(async () => null),
}));

vi.mock('../../../services/task-queue', () => ({
  taskQueueService: {
    observeTaskUpdates: () => ({
      subscribe: () => ({ unsubscribe: vi.fn() }),
    }),
  },
}));

vi.mock('../task-sync', () => ({
  syncVideoAnalyzerTask: vi.fn(),
}));

vi.mock('../../../utils/posthog-analytics', () => ({
  analytics: { trackUIInteraction: vi.fn() },
}));

vi.mock('../../../utils/message-plugin', () => ({
  MessagePlugin: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

function createUploadRecord(): AnalysisRecord {
  return {
    id: 'record-upload',
    createdAt: 1,
    source: 'upload',
    sourceLabel: 'missing.mp4',
    sourceSnapshot: {
      type: 'upload',
      cacheUrl: '/__aitu_cache__/video/missing.mp4',
      fileName: 'missing.mp4',
      mimeType: 'video/mp4',
      size: 1024,
    },
    model: 'gemini',
    analysis: {
      totalDuration: 8,
      productExposureDuration: 0,
      productExposureRatio: 0,
      shotCount: 1,
      firstProductAppearance: 0,
      suggestion: '保留已有分析',
      shots: [
        {
          id: 'shot-1',
          startTime: 0,
          endTime: 8,
          description: '已有镜头',
          type: 'opening',
          label: '已有镜头',
        },
      ],
    },
    starred: false,
  };
}

describe('AnalyzePage history source recovery', () => {
  it('keeps the analysis visible and reports an expired upload cache', async () => {
    render(
      <AnalyzePage
        existingRecord={createUploadRecord()}
        onComplete={vi.fn()}
        onRecordsChange={vi.fn()}
      />
    );

    expect(screen.getByText('保留已有分析')).toBeTruthy();
    expect(
      await screen.findByText('原上传视频缓存已失效，无法自动回填视频')
    ).toBeTruthy();
  });
});
