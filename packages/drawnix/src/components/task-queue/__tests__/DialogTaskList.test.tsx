import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskStatus, TaskType, type Task } from '../../../types/task.types';
import { DialogTaskList } from '../DialogTaskList';

const mocks = vi.hoisted(() => ({
  insertImageFromUrl: vi.fn(),
  insertVideoFromUrl: vi.fn(),
  markAsInserted: vi.fn(),
  tasks: [] as Task[],
}));

vi.mock('../VirtualTaskList', () => ({
  VirtualTaskList: ({
    tasks,
    onInsert,
  }: {
    tasks: Task[];
    onInsert: (taskId: string) => void;
  }) =>
    tasks.length > 0 ? (
      <button type="button" onClick={() => onInsert(tasks[0].id)}>
        insert-task
      </button>
    ) : null,
}));

vi.mock('../../../hooks/useFilteredTaskQueue', () => ({
  useFilteredTaskQueue: () => ({
    tasks: mocks.tasks,
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    totalCount: mocks.tasks.length,
    loadedCount: mocks.tasks.length,
    loadMore: vi.fn(),
    retryTask: vi.fn(),
    deleteTask: vi.fn(),
  }),
}));

vi.mock('../../../hooks/use-drawnix', () => ({
  DialogType: {
    aiImageGeneration: 'aiImageGeneration',
    aiVideoGeneration: 'aiVideoGeneration',
  },
  useDrawnix: () => ({ board: { id: 'board-1' }, openDialog: vi.fn() }),
}));

vi.mock('../../../data/image', () => ({
  insertImageFromUrl: mocks.insertImageFromUrl,
}));

vi.mock('../../../data/video', () => ({
  insertVideoFromUrl: mocks.insertVideoFromUrl,
}));

vi.mock('../../../services/task-queue', () => ({
  taskQueueService: {
    getTask: vi.fn(),
    markAsInserted: mocks.markAsInserted,
  },
}));

vi.mock('../../../services/task-storage-reader', () => ({
  taskStorageReader: { getTask: vi.fn() },
}));

vi.mock('../../../utils/ai-image-draft-state', () => ({
  hasAIImageDraftContent: vi.fn(() => false),
}));

vi.mock('../../../utils/image-task-prefill', () => ({
  buildImageTaskPrefillInitialData: vi.fn(() => ({})),
}));

vi.mock('../../../utils/download-utils', () => ({
  buildTaskDownloadItems: vi.fn(() => []),
  smartDownload: vi.fn(),
}));

vi.mock('@aitu/utils', () => ({
  normalizeImageDataUrl: (url: string) => url,
}));

vi.mock('tdesign-react', () => ({
  MessagePlugin: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
  Input: () => <input aria-label="task-search" />,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('tdesign-icons-react', () => ({
  SearchIcon: () => null,
  DeleteIcon: () => null,
}));

vi.mock('../../character/CharacterCreateDialog', () => ({
  CharacterCreateDialog: () => null,
}));

vi.mock('../../dialog/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => true),
    confirmDialog: null,
  }),
}));

vi.mock('../../shared/media-preview', () => ({
  UnifiedMediaViewer: () => null,
}));

vi.mock('../../shared', () => ({
  HoverTip: ({ children }: { children: React.ReactNode }) => children,
}));

function createCompletedTask(type: TaskType): Task {
  return {
    id: `task-${type}`,
    type,
    status: TaskStatus.COMPLETED,
    params: { prompt: 'Generate media' },
    result: { url: `https://example.com/result.${type === TaskType.IMAGE ? 'png' : 'mp4'}` },
    progress: 100,
    createdAt: 1,
    updatedAt: 1,
    retryCount: 0,
    maxRetries: 3,
  };
}

describe('DialogTaskList canvas insertion tracking', () => {
  beforeEach(() => {
    mocks.tasks = [];
    mocks.insertImageFromUrl.mockReset();
    mocks.insertVideoFromUrl.mockReset();
    mocks.markAsInserted.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    [TaskType.IMAGE, mocks.insertImageFromUrl],
    [TaskType.VIDEO, mocks.insertVideoFromUrl],
  ])('marks a successfully inserted %s task as manually inserted', async (type, insertMedia) => {
    const task = createCompletedTask(type);
    mocks.tasks = [task];
    insertMedia.mockResolvedValue(undefined);

    render(<DialogTaskList taskType={type} />);
    fireEvent.click(screen.getByRole('button', { name: 'insert-task' }));

    await waitFor(() => {
      expect(insertMedia).toHaveBeenCalledTimes(1);
    });
    expect(mocks.markAsInserted).toHaveBeenCalledWith(task.id, 'manual');
  });

  it('does not mark an image task when canvas insertion fails', async () => {
    const task = createCompletedTask(TaskType.IMAGE);
    mocks.tasks = [task];
    mocks.insertImageFromUrl.mockRejectedValue(new Error('insert failed'));

    render(<DialogTaskList taskType={TaskType.IMAGE} />);
    fireEvent.click(screen.getByRole('button', { name: 'insert-task' }));

    await waitFor(() => {
      expect(mocks.insertImageFromUrl).toHaveBeenCalledTimes(1);
    });
    expect(mocks.markAsInserted).not.toHaveBeenCalled();
  });
});
