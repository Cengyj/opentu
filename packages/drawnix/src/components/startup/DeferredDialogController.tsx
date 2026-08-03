import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './deferred-dialog-controller.scss';

export interface DeferredDialogControllerProps {
  active: boolean;
  container: HTMLElement | null;
  dialogId: string;
  label: string;
  loadController: DeferredDialogControllerLoader;
  onClose: () => void;
  onEnableRuntime?: () => void;
}

export interface LoadedDialogControllerProps {
  container: HTMLElement | null;
  onEnableRuntime?: () => void;
}

export type LoadedDialogController =
  React.ComponentType<LoadedDialogControllerProps>;

export type DeferredDialogControllerLoader = () => Promise<{
  default: LoadedDialogController;
}>;

function describeLoadError(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return '资源加载失败';
  }

  return error.message.trim().slice(0, 160);
}

export function DeferredDialogController({
  active,
  container,
  dialogId,
  label,
  loadController,
  onClose,
  onEnableRuntime,
}: DeferredDialogControllerProps) {
  const [Controller, setController] = useState<LoadedDialogController | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    if (!active || Controller) {
      return;
    }

    let disposed = false;
    setLoadError(null);

    void loadController().then(
      (module) => {
        if (!disposed) {
          setController(() => module.default);
        }
      },
      (error: unknown) => {
        if (!disposed) {
          setLoadError(describeLoadError(error));
        }
      }
    );

    return () => {
      disposed = true;
    };
  }, [active, Controller, loadAttempt, loadController]);

  if (!active) {
    return null;
  }

  if (Controller) {
    return (
      <Controller container={container} onEnableRuntime={onEnableRuntime} />
    );
  }

  const fallback = (
    <div
      className="deferred-dialog-controller"
      data-dialog-id={dialogId}
      data-load-status={loadError ? 'failed' : 'loading'}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${dialogId}-deferred-title`}
      aria-describedby={`${dialogId}-deferred-status`}
    >
      <div className="deferred-dialog-controller__card">
        <div
          className="deferred-dialog-controller__spinner"
          aria-hidden="true"
        />
        <h2
          className="deferred-dialog-controller__title"
          id={`${dialogId}-deferred-title`}
        >
          {label}
        </h2>
        <p
          className="deferred-dialog-controller__status"
          id={`${dialogId}-deferred-status`}
          aria-live="polite"
        >
          {loadError || '正在加载功能组件…'}
        </p>
        <div className="deferred-dialog-controller__actions">
          {loadError && (
            <button type="button" onClick={retryLoad}>
              重试
            </button>
          )}
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );

  return container ? createPortal(fallback, container) : fallback;
}
