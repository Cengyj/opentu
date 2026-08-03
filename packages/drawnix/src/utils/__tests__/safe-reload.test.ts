import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { activeTaskCheck, activeTasksModuleLoaded } = vi.hoisted(() => ({
  activeTaskCheck: vi.fn<() => Promise<boolean>>(),
  activeTasksModuleLoaded: vi.fn(),
}));

vi.mock('../active-tasks', () => {
  activeTasksModuleLoaded();
  return {
    hasActiveLLMTasks: activeTaskCheck,
  };
});

describe('safeReload', () => {
  const confirm = vi.fn<(message: string) => boolean>();
  const reload = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    activeTaskCheck.mockResolvedValue(false);
    confirm.mockReturnValue(true);
    vi.stubGlobal('window', {
      confirm,
      location: { reload },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the active-task graph only when a reload is requested', async () => {
    const { safeReload } = await import('../safe-reload');

    expect(activeTasksModuleLoaded).not.toHaveBeenCalled();

    await expect(safeReload()).resolves.toBe(true);

    expect(activeTasksModuleLoaded).toHaveBeenCalledTimes(1);
    expect(activeTaskCheck).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the user keeps active generation tasks', async () => {
    activeTaskCheck.mockResolvedValue(true);
    confirm.mockReturnValue(false);
    const { safeReload } = await import('../safe-reload');

    await expect(safeReload()).resolves.toBe(false);

    expect(confirm).toHaveBeenCalledWith(
      '当前有正在进行的 AI 生成任务，刷新页面会中断这些任务。确定要刷新吗？'
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads after the user confirms despite active generation tasks', async () => {
    activeTaskCheck.mockResolvedValue(true);
    const { safeReload } = await import('../safe-reload');

    await expect(safeReload()).resolves.toBe(true);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload silently when the lazy active-task check fails', async () => {
    activeTaskCheck.mockRejectedValue(new Error('stale lazy chunk'));
    confirm.mockReturnValue(false);
    const { safeReload } = await import('../safe-reload');

    await expect(safeReload()).resolves.toBe(false);

    expect(confirm).toHaveBeenCalledWith(
      '无法确认当前是否有正在进行的 AI 生成任务。继续刷新可能会中断任务，确定要刷新吗？'
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('allows an explicit reload when the lazy active-task check fails', async () => {
    activeTaskCheck.mockRejectedValue(new Error('stale lazy chunk'));
    confirm.mockReturnValue(true);
    const { safeReload } = await import('../safe-reload');

    await expect(safeReload()).resolves.toBe(true);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('runtime safe reload boundary', () => {
  it('keeps the task queue behind a dynamic import', () => {
    const runtimeSource = readFileSync(
      resolve(__dirname, '../../runtime.ts'),
      'utf8'
    );
    const safeReloadSource = readFileSync(
      resolve(__dirname, '../safe-reload.ts'),
      'utf8'
    );
    const activeTasksSource = readFileSync(
      resolve(__dirname, '../active-tasks.ts'),
      'utf8'
    );

    expect(runtimeSource).toContain(
      "export { safeReload } from './utils/safe-reload';"
    );
    expect(runtimeSource).not.toContain("from './utils/active-tasks'");
    expect(safeReloadSource).toContain("await import('./active-tasks')");
    expect(safeReloadSource).not.toMatch(
      /^import\s+.+from\s+['"]\.\/active-tasks['"];?$/m
    );
    expect(activeTasksSource).not.toContain('function safeReload');
  });
});
