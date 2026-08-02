import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Dialog } from 'tdesign-react';
import { RefreshIcon } from 'tdesign-icons-react';
import { useTaskQueue } from '../../hooks/useTaskQueue';
import './version-update-prompt.scss';

type VersionUpgradePhase =
  | 'idle'
  | 'ready'
  | 'confirming'
  | 'commit-sent'
  | 'activating';

type VersionUpgradeConfirmationIssue =
  | 'waiting-worker-unavailable'
  | 'commit-delivery-failed'
  | 'commit-acknowledgement-pending'
  | 'commit-rejected';

interface VersionUpgradeSnapshot {
  revision: number;
  committedReleaseId: string;
  pendingReleaseId: string | null;
  displayVersion: string | null;
  phase: VersionUpgradePhase;
  metadata: { changelog?: readonly string[] } | null;
  confirmationIssue: VersionUpgradeConfirmationIssue | null;
  confirmationRejectionReason: string | null;
}

interface VersionUpgradeRuntimeView {
  getSnapshot: () => VersionUpgradeSnapshot;
  subscribe: (listener: () => void) => () => void;
  replacePendingRelease?: (
    releaseId: string,
    displayVersion?: string | null
  ) => void;
}

interface VersionUpgradeWindow {
  __OPENTU_VERSION_UPGRADE_RUNTIME__?: VersionUpgradeRuntimeView;
  __debugTriggerUpdate?: (version?: string, releaseId?: string) => void;
}

interface UpgradeTaskBlocker {
  classification: 'unknown-authority';
  reason: 'projection-unavailable';
  count: number;
}

const getVersionUpgradeRuntime = (): VersionUpgradeRuntimeView | null =>
  (window as Window & VersionUpgradeWindow)
    .__OPENTU_VERSION_UPGRADE_RUNTIME__ || null;

const subscribeToNoRuntime = (): (() => void) => () => undefined;
const getNoRuntimeSnapshot = (): null => null;

export const VersionUpdatePrompt: React.FC = () => {
  const runtime = getVersionUpgradeRuntime();
  const snapshot = useSyncExternalStore(
    runtime?.subscribe || subscribeToNoRuntime,
    runtime?.getSnapshot || getNoRuntimeSnapshot,
    runtime?.getSnapshot || getNoRuntimeSnapshot
  );
  const [showChangelog, setShowChangelog] = useState(false);
  const { activeTasks, isLoading } = useTaskQueue();

  useEffect(() => {
    setShowChangelog(false);
  }, [snapshot?.pendingReleaseId]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !runtime) {
      return;
    }

    const debugWindow = window as Window & VersionUpgradeWindow;
    debugWindow.__debugTriggerUpdate = (
      version = '9.9.9',
      releaseId = `debug-${version}`
    ) => {
      runtime.replacePendingRelease?.(releaseId, version);
    };

    return () => {
      delete debugWindow.__debugTriggerUpdate;
    };
  }, [runtime]);

  if (!snapshot?.pendingReleaseId || !snapshot.displayVersion) {
    return null;
  }

  const taskBlocker: UpgradeTaskBlocker | null =
    activeTasks.length > 0
      ? {
          classification: 'unknown-authority',
          reason: 'projection-unavailable',
          count: activeTasks.length,
        }
      : null;
  const confirmationBlocked = isLoading || taskBlocker !== null;
  const confirmationInProgress =
    snapshot.phase === 'confirming' ||
    snapshot.phase === 'commit-sent' ||
    snapshot.phase === 'activating';
  const confirmationDisabled =
    confirmationBlocked || snapshot.phase !== 'ready';
  const requiresCurrentReleaseReload =
    snapshot.confirmationIssue === 'commit-rejected' &&
    (snapshot.confirmationRejectionReason === 'client-release-mismatch' ||
      snapshot.confirmationRejectionReason === 'already-committed');

  const handleUpdate = () => {
    if (confirmationDisabled) {
      return;
    }
    setShowChangelog(false);
    if (requiresCurrentReleaseReload) {
      window.dispatchEvent(
        new CustomEvent('user-requested-current-release-reload', {
          detail: { committedReleaseId: snapshot.committedReleaseId },
        })
      );
      return;
    }
    window.dispatchEvent(
      new CustomEvent('user-confirmed-upgrade', {
        detail: { releaseId: snapshot.pendingReleaseId },
      })
    );
  };

  const getActionLabel = (): string => {
    if (isLoading) {
      return '正在核对任务';
    }
    if (taskBlocker) {
      return '等待任务完成';
    }
    if (requiresCurrentReleaseReload) {
      return '刷新当前版本';
    }
    if (
      snapshot.confirmationIssue === 'waiting-worker-unavailable' ||
      snapshot.confirmationIssue === 'commit-delivery-failed' ||
      snapshot.confirmationIssue === 'commit-rejected'
    ) {
      return '重试更新';
    }
    if (snapshot.phase === 'confirming') {
      return '正在连接更新服务';
    }
    if (snapshot.phase === 'commit-sent' || snapshot.phase === 'activating') {
      return '正在切换版本';
    }
    return '立即更新';
  };

  const changelog = snapshot.metadata?.changelog;

  return (
    <>
      <div
        className="version-update-prompt"
        data-upgrade-blocker={
          taskBlocker
            ? `${taskBlocker.classification}:${taskBlocker.reason}`
            : undefined
        }
      >
        <div className="version-update-prompt__content">
          <div className="version-update-prompt__message">
            <span className="version-update-prompt__text">
              新版本 v{snapshot.displayVersion} 已就绪
            </span>
            {isLoading && (
              <span className="version-update-prompt__hint">
                正在核对任务执行状态，确认安全后即可更新。
              </span>
            )}
            {taskBlocker && (
              <span className="version-update-prompt__hint">
                检测到 {taskBlocker.count}{' '}
                个活动任务，但当前缺少可验证的执行归属。为避免中断任务或重复计费，任务完成前不会安装更新。
              </span>
            )}
            {snapshot.confirmationIssue === 'waiting-worker-unavailable' &&
              !confirmationBlocked && (
                <span className="version-update-prompt__hint">
                  更新组件暂不可用，本次没有提交升级；可以安全重试。
                </span>
              )}
            {snapshot.confirmationIssue === 'commit-delivery-failed' &&
              !confirmationBlocked && (
                <span className="version-update-prompt__hint">
                  尚未收到更新服务确认，系统会继续核对版本状态；可以安全重试。
                </span>
              )}
            {snapshot.confirmationIssue === 'commit-acknowledgement-pending' &&
              !confirmationBlocked && (
                <span className="version-update-prompt__hint">
                  更新提交已发送，但确认回执尚未到达。系统正在核对权威版本状态，不会重复提交更新。
                </span>
              )}
            {snapshot.confirmationIssue === 'commit-rejected' &&
              requiresCurrentReleaseReload &&
              !confirmationBlocked && (
                <span className="version-update-prompt__hint">
                  当前页面仍在运行旧版本，无法安全跨过已提交的版本。请先刷新到当前版本，再安装新更新。
                </span>
              )}
            {snapshot.confirmationIssue === 'commit-rejected' &&
              !requiresCurrentReleaseReload &&
              !confirmationBlocked && (
                <span className="version-update-prompt__hint">
                  更新服务尚未接受本次切换，版本状态已重新同步；可以安全重试。
                </span>
              )}
          </div>
          {changelog && changelog.length > 0 && (
            <Button
              theme="default"
              variant="text"
              size="small"
              onClick={() => setShowChangelog(true)}
            >
              查看更新内容
            </Button>
          )}
          <Button
            theme="primary"
            size="small"
            onClick={handleUpdate}
            disabled={confirmationDisabled}
            loading={confirmationInProgress}
            icon={<RefreshIcon />}
          >
            {getActionLabel()}
          </Button>
        </div>
      </div>

      <Dialog
        header={`新版本 v${snapshot.displayVersion} 更新内容`}
        visible={showChangelog}
        onClose={() => setShowChangelog(false)}
        width={600}
        footer={
          <Button
            theme="primary"
            onClick={handleUpdate}
            disabled={confirmationDisabled}
            loading={confirmationInProgress}
          >
            {getActionLabel()}
          </Button>
        }
      >
        <div
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '8px',
          }}
        >
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {changelog?.map((item, index) => (
              <li
                key={`${snapshot.pendingReleaseId}:${index}`}
                style={{ marginBottom: '4px', lineHeight: '1.5' }}
              >
                {index + 1}. {item}
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
    </>
  );
};
