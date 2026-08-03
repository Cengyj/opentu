// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BottomActionsSection,
  type BottomActionsSectionProps,
  type TaskQueueActionButtonLoader,
} from './bottom-actions-section';
import { TaskQueueActionButton } from './task-queue-action-button';

const useTaskQueueMock = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useTaskQueue', () => ({
  useTaskQueue: useTaskQueueMock,
}));

vi.mock('../tool-button', () => ({
  ToolButton: ({
    'aria-label': ariaLabel,
    'data-testid': testId,
    onClick,
    selected,
    tooltip,
  }: {
    'aria-label': string;
    'data-testid'?: string;
    onClick?: () => void;
    selected?: boolean;
    tooltip?: React.ReactNode;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      data-selected={selected ? 'true' : 'false'}
      data-tooltip={typeof tooltip === 'string' ? tooltip : undefined}
      onClick={onClick}
    />
  ),
}));

vi.mock('../feedback-button/feedback-button', () => ({
  FeedbackButton: () => <button type="button">feedback</button>,
}));

vi.mock('../icons', () => ({
  FolderIcon: () => <span />,
  ToolboxIcon: () => <span />,
  TaskIcon: () => <span />,
}));

vi.mock('tdesign-react/es/badge', () => ({
  Badge: ({
    children,
    count,
  }: {
    children: React.ReactNode;
    count: number;
  }) => (
    <div data-testid="task-count-badge" data-count={String(count)}>
      {children}
    </div>
  ),
}));

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

function createProps(
  overrides: Partial<BottomActionsSectionProps> = {}
): BottomActionsSectionProps {
  return {
    projectDrawerOpen: false,
    onProjectDrawerToggle: vi.fn(),
    taskPanelExpanded: false,
    onTaskPanelToggle: vi.fn(),
    ...overrides,
  };
}

const LoadedTaskButton: React.FC<{
  taskPanelExpanded: boolean;
  onTaskPanelToggle: () => void;
}> = ({ taskPanelExpanded, onTaskPanelToggle }) => (
  <button
    type="button"
    data-testid="loaded-task-summary"
    data-expanded={taskPanelExpanded ? 'true' : 'false'}
    onClick={onTaskPanelToggle}
  />
);

describe('BottomActionsSection task queue startup boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    useTaskQueueMock.mockReset();
    useTaskQueueMock.mockReturnValue({
      activeTasks: [],
      completedTasks: [],
      failedTasks: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the task runtime unloaded until a real click and preserves that click', async () => {
    const requestIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    const deferred =
      createDeferred<Awaited<ReturnType<TaskQueueActionButtonLoader>>>();
    const loader = vi.fn(() => deferred.promise);
    const onTaskPanelToggle = vi.fn();
    const props = createProps({
      onTaskPanelToggle,
      taskQueueActionButtonLoader: loader,
    });
    const view = render(<BottomActionsSection {...props} />);

    expect(loader).not.toHaveBeenCalled();
    expect(useTaskQueueMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(loader).not.toHaveBeenCalled();
    expect(requestIdleCallback).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('toolbar-tasks'));

    expect(onTaskPanelToggle).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledTimes(1);

    view.rerender(<BottomActionsSection {...props} taskPanelExpanded={true} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ TaskQueueActionButton: LoadedTaskButton });
      await deferred.promise;
    });

    expect(
      screen.getByTestId('loaded-task-summary').getAttribute('data-expanded')
    ).toBe('true');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('single-flights repeated real interactions while the runtime is loading', async () => {
    const deferred =
      createDeferred<Awaited<ReturnType<TaskQueueActionButtonLoader>>>();
    const loader = vi.fn(() => deferred.promise);
    const onTaskPanelToggle = vi.fn();

    render(
      <BottomActionsSection
        {...createProps({
          onTaskPanelToggle,
          taskQueueActionButtonLoader: loader,
        })}
      />
    );

    fireEvent.click(screen.getByTestId('toolbar-tasks'));
    fireEvent.click(screen.getByTestId('toolbar-tasks'));

    expect(loader).toHaveBeenCalledTimes(1);
    expect(onTaskPanelToggle).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferred.resolve({ TaskQueueActionButton: LoadedTaskButton });
      await deferred.promise;
    });

    expect(screen.getByTestId('loaded-task-summary')).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('loads the task runtime when an external action expands the panel', async () => {
    const loader = vi
      .fn<TaskQueueActionButtonLoader>()
      .mockResolvedValue({ TaskQueueActionButton: LoadedTaskButton });

    render(
      <BottomActionsSection
        {...createProps({
          taskPanelExpanded: true,
          taskQueueActionButtonLoader: loader,
        })}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('loaded-task-summary').getAttribute('data-expanded')
    ).toBe('true');
  });

  it('allows a later user interaction to retry a failed load without losing panel actions', async () => {
    const loader = vi
      .fn<TaskQueueActionButtonLoader>()
      .mockRejectedValueOnce(new Error('task summary chunk unavailable'))
      .mockResolvedValueOnce({ TaskQueueActionButton: LoadedTaskButton });
    const onTaskPanelToggle = vi.fn();

    render(
      <BottomActionsSection
        {...createProps({
          onTaskPanelToggle,
          taskQueueActionButtonLoader: loader,
        })}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('toolbar-tasks'));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(onTaskPanelToggle).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId('toolbar-tasks'));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(2);
    expect(onTaskPanelToggle).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('loaded-task-summary')).toBeTruthy();
  });

  it('keeps restoration and task-state subscription owned by the interaction-loaded hook', () => {
    const packageRoot = process.cwd().endsWith('packages/drawnix')
      ? process.cwd()
      : resolve(process.cwd(), 'packages/drawnix');
    const shellSource = readFileSync(
      resolve(packageRoot, 'src/components/toolbar/bottom-actions-section.tsx'),
      'utf8'
    );
    const runtimeSource = readFileSync(
      resolve(
        packageRoot,
        'src/components/toolbar/task-queue-action-button.tsx'
      ),
      'utf8'
    );

    expect(shellSource).not.toContain("from '../../hooks/useTaskQueue'");
    expect(shellSource).not.toContain('ensureTaskStateSyncStarted');
    expect(shellSource).not.toContain('taskQueueService');
    expect(shellSource).not.toContain('requestIdleCallback');
    expect(shellSource).toContain("import('./task-queue-action-button')");
    expect(runtimeSource).toContain("from '../../hooks/useTaskQueue'");
    expect(runtimeSource.match(/\buseTaskQueue\(\)/g)).toHaveLength(1);
  });

  it('subscribes through useTaskQueue only after the delayed button mounts', () => {
    const onTaskPanelToggle = vi.fn();
    useTaskQueueMock.mockReturnValue({
      activeTasks: [{ id: 'active-task' }],
      completedTasks: [{ id: 'completed-task' }],
      failedTasks: [],
    });

    render(
      <TaskQueueActionButton
        taskPanelExpanded={false}
        onTaskPanelToggle={onTaskPanelToggle}
      />
    );

    expect(useTaskQueueMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('task-count-badge').getAttribute('data-count')
    ).toBe('1');
    expect(
      screen.getByTestId('toolbar-tasks').getAttribute('data-tooltip')
    ).toBe('任务队列 (生成中: 1, 已完成: 1, 失败: 0)');

    fireEvent.click(screen.getByTestId('toolbar-tasks'));
    expect(onTaskPanelToggle).toHaveBeenCalledTimes(1);
  });
});
