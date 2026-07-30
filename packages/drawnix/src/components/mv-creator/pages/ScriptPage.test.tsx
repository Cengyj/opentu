import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetCategory, AssetSource, AssetType } from '../../../types/asset.types';
import type { MVRecord } from '../types';
import { ScriptPage } from './ScriptPage';

const { updateRecordMock } = vi.hoisted(() => ({
  updateRecordMock: vi.fn(),
}));

vi.mock('../storage', () => ({
  updateRecord: updateRecordMock,
}));

vi.mock('../../../hooks/use-runtime-models', () => ({
  useSelectableModels: () => [],
}));

vi.mock('../../ai-input-bar/ModelDropdown', () => ({
  ModelDropdown: () => <div data-testid="model-dropdown" />,
}));

vi.mock('../../shared', () => ({
  KnowledgeNoteContextSelector: () => <div data-testid="knowledge-context" />,
}));

vi.mock('../../shared/workflow', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../shared/workflow')
  >();
  return {
    ...actual,
    ComboInput: () => <input aria-label="combo" />,
    CreativeBriefEditor: () => <div data-testid="creative-brief" />,
    ModelDropdown: () => <div data-testid="workflow-model" />,
    ShotCard: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    VideoParametersRow: () => <div data-testid="video-parameters" />,
  };
});

vi.mock('../../../services/task-queue', () => ({
  taskQueueService: {
    createTask: vi.fn(),
    getTask: vi.fn(),
    observeTaskUpdates: vi.fn(),
  },
}));

vi.mock('../task-sync', () => ({
  syncMVRewriteTask: vi.fn(),
}));

vi.mock('../../../utils/posthog-analytics', () => ({
  analytics: {
    trackUIInteraction: vi.fn(),
  },
}));

vi.mock('../../media-library', () => ({
  MediaLibraryModal: ({
    isOpen,
    onSelect,
  }: {
    isOpen: boolean;
    onSelect: (asset: {
      id: string;
      type: AssetType;
      source: AssetSource;
      category: AssetCategory;
      url: string;
      name: string;
      mimeType: string;
      createdAt: number;
      characterMeta: { name: string; prompt: string };
    }) => Promise<void>;
  }) =>
    isOpen ? (
      <button
        type="button"
        onClick={() =>
          void onSelect({
            id: 'asset_1',
            type: AssetType.IMAGE,
            source: AssetSource.LOCAL,
            category: AssetCategory.CHARACTER,
            url: 'cache://subject.png',
            name: '素材名称',
            mimeType: 'image/png',
            createdAt: 1,
            characterMeta: {
              name: '主体名称',
              prompt: 'subject appearance',
            },
          })
        }
      >
        使用测试主体
      </button>
    ) : null,
}));

const record: MVRecord = {
  id: 'mv_1',
  createdAt: 1,
  sourceLabel: '测试 MV',
  starred: false,
  selectedClipDuration: 8,
  editedShots: [
    {
      id: 'shot_1',
      startTime: 0,
      endTime: 8,
      duration: 8,
      description: '镜头',
      narration: '',
      type: 'opening',
      label: '开场',
    },
  ],
  characters: [
    {
      id: 'char_1',
      name: '旧名称',
      description: '旧描述',
    },
  ],
};

describe('MV ScriptPage subject asset selection', () => {
  beforeEach(() => {
    updateRecordMock.mockReset();
    updateRecordMock.mockImplementation(
      async (_id: string, patch: Partial<MVRecord>) => [
        { ...record, ...patch },
      ]
    );
  });

  it('persists selected subject identity, description and URL on the record', async () => {
    render(
      <ScriptPage
        record={record}
        onRecordUpdate={vi.fn()}
        onRecordsChange={vi.fn()}
        onNext={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: '选择主体素材' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: '使用测试主体' })
    );

    await waitFor(() =>
      expect(updateRecordMock).toHaveBeenCalledWith(
        'mv_1',
        expect.objectContaining({
          characters: [
            expect.objectContaining({
              id: 'char_1',
              name: '主体名称',
              description: 'subject appearance',
              referenceImageUrl: 'cache://subject.png',
            }),
          ],
        })
      )
    );
  });
});
