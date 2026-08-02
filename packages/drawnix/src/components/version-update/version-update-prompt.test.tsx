// @vitest-environment jsdom

import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VersionUpdatePrompt } from './version-update-prompt';

const taskQueueState = vi.hoisted(() => ({
  activeTasks: [] as Array<{ id: string }>,
  isLoading: false,
}));

vi.mock('../../hooks/useTaskQueue', () => ({
  useTaskQueue: () => taskQueueState,
}));

vi.mock('tdesign-react', () => ({
  Button: ({
    children,
    disabled,
    loading,
    onClick,
  }: React.PropsWithChildren<{
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
  }>) => (
    <button disabled={disabled} aria-busy={loading} onClick={onClick}>
      {children}
    </button>
  ),
  Dialog: ({
    children,
    visible,
  }: React.PropsWithChildren<{ visible: boolean }>) =>
    visible ? <div role="dialog">{children}</div> : null,
}));

vi.mock('tdesign-icons-react', () => ({
  RefreshIcon: () => <span />,
}));

type Snapshot = {
  revision: number;
  committedReleaseId: string;
  pendingReleaseId: string | null;
  displayVersion: string | null;
  phase: 'idle' | 'ready' | 'confirming' | 'commit-sent' | 'activating';
  metadata: { changelog?: readonly string[] } | null;
  confirmationIssue:
    | 'waiting-worker-unavailable'
    | 'commit-delivery-failed'
    | 'commit-acknowledgement-pending'
    | 'commit-rejected'
    | null;
  confirmationRejectionReason: string | null;
};

function installRuntime(initialSnapshot: Snapshot) {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();
  const runtime = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replacePendingRelease: vi.fn(),
    setSnapshot(next: Snapshot) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
  (
    window as Window & {
      __OPENTU_VERSION_UPGRADE_RUNTIME__?: typeof runtime;
    }
  ).__OPENTU_VERSION_UPGRADE_RUNTIME__ = runtime;
  return runtime;
}

const readySnapshot = (): Snapshot => ({
  revision: 1,
  committedReleaseId: 'release-current',
  pendingReleaseId: 'release-a',
  displayVersion: '1.0.3',
  phase: 'ready',
  metadata: { changelog: ['routing fixed'] },
  confirmationIssue: null,
  confirmationRejectionReason: null,
});

describe('VersionUpdatePrompt', () => {
  beforeEach(() => {
    taskQueueState.activeTasks = [];
    taskQueueState.isLoading = false;
  });

  afterEach(() => {
    cleanup();
    delete (
      window as Window & {
        __OPENTU_VERSION_UPGRADE_RUNTIME__?: unknown;
        __debugTriggerUpdate?: unknown;
      }
    ).__OPENTU_VERSION_UPGRADE_RUNTIME__;
    delete (
      window as Window & {
        __debugTriggerUpdate?: unknown;
      }
    ).__debugTriggerUpdate;
    vi.restoreAllMocks();
  });

  it('renders a pending release that was published before the deferred UI mounted', () => {
    installRuntime(readySnapshot());

    render(<VersionUpdatePrompt />);

    expect(screen.getByText('新版本 v1.0.3 已就绪')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: '立即更新' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it('keeps the notice visible but disables confirmation for active tasks without ownership projection', () => {
    installRuntime(readySnapshot());
    taskQueueState.activeTasks = [{ id: 'persisted-processing' }];

    render(<VersionUpdatePrompt />);

    expect(screen.getByText('新版本 v1.0.3 已就绪')).toBeTruthy();
    expect(screen.getByText(/缺少可验证的执行归属/)).toBeTruthy();
    expect(
      screen
        .getByText('新版本 v1.0.3 已就绪')
        .closest('.version-update-prompt')
        ?.getAttribute('data-upgrade-blocker')
    ).toBe('unknown-authority:projection-unavailable');
    expect(
      (
        screen.getByRole('button', {
          name: '等待任务完成',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('reacts to authoritative replacement and clear without remounting', () => {
    const runtime = installRuntime(readySnapshot());
    render(<VersionUpdatePrompt />);

    act(() => {
      runtime.setSnapshot({
        ...readySnapshot(),
        revision: 2,
        pendingReleaseId: 'release-b',
        displayVersion: '1.0.4',
      });
    });
    expect(screen.getByText('新版本 v1.0.4 已就绪')).toBeTruthy();

    act(() => {
      runtime.setSnapshot({
        revision: 3,
        committedReleaseId: 'release-b',
        pendingReleaseId: null,
        displayVersion: null,
        phase: 'idle',
        metadata: null,
        confirmationIssue: null,
        confirmationRejectionReason: null,
      });
    });
    expect(screen.queryByText(/新版本/)).toBeNull();
  });

  it('sends the pending release identity when confirmation is eligible', () => {
    installRuntime(readySnapshot());
    const listener = vi.fn();
    window.addEventListener('user-confirmed-upgrade', listener);
    render(<VersionUpdatePrompt />);

    fireEvent.click(screen.getByRole('button', { name: '立即更新' }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      releaseId: 'release-a',
    });
    window.removeEventListener('user-confirmed-upgrade', listener);
  });

  it('keeps a missing-worker failure visible and retryable', () => {
    installRuntime({
      ...readySnapshot(),
      revision: 2,
      confirmationIssue: 'waiting-worker-unavailable',
    });

    render(<VersionUpdatePrompt />);

    expect(screen.getByText(/更新组件暂不可用/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: '重试更新' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it('keeps a rejected commit visible and retryable', () => {
    installRuntime({
      ...readySnapshot(),
      revision: 2,
      confirmationIssue: 'commit-rejected',
    });

    render(<VersionUpdatePrompt />);

    expect(screen.getByText(/更新服务尚未接受本次切换/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: '重试更新' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it('shows an acknowledgement-pending commit as locked against duplicate submission', () => {
    installRuntime({
      ...readySnapshot(),
      revision: 2,
      phase: 'commit-sent',
      confirmationIssue: 'commit-acknowledgement-pending',
    });
    const listener = vi.fn();
    window.addEventListener('user-confirmed-upgrade', listener);

    render(<VersionUpdatePrompt />);

    expect(screen.getByText(/不会重复提交更新/)).toBeTruthy();
    const button = screen.getByRole('button', {
      name: '正在切换版本',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('user-confirmed-upgrade', listener);
  });

  it('offers a current-release reload instead of retrying a deterministic client mismatch', () => {
    installRuntime({
      ...readySnapshot(),
      revision: 2,
      committedReleaseId: 'release-b',
      pendingReleaseId: 'release-c',
      confirmationIssue: 'commit-rejected',
      confirmationRejectionReason: 'client-release-mismatch',
    });
    const commitListener = vi.fn();
    const reloadListener = vi.fn();
    window.addEventListener('user-confirmed-upgrade', commitListener);
    window.addEventListener(
      'user-requested-current-release-reload',
      reloadListener
    );

    render(<VersionUpdatePrompt />);

    expect(screen.getByText(/当前页面仍在运行旧版本/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '刷新当前版本' }));
    expect(commitListener).not.toHaveBeenCalled();
    expect(reloadListener).toHaveBeenCalledTimes(1);
    expect((reloadListener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      committedReleaseId: 'release-b',
    });

    window.removeEventListener('user-confirmed-upgrade', commitListener);
    window.removeEventListener(
      'user-requested-current-release-reload',
      reloadListener
    );
  });
});
