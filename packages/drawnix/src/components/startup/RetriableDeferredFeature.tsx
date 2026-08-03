import React, { useCallback, useEffect, useRef, useState } from 'react';
import './deferred-features.scss';

interface DeferredFeatureStatusProps {
  label: string;
  status: 'loading' | 'error';
  variant: 'overlay' | 'passive' | 'inline';
  onRetry?: () => void;
  onCancel?: () => void;
}

function DeferredFeatureStatus({
  label,
  status,
  variant,
  onRetry,
  onCancel,
}: DeferredFeatureStatusProps) {
  const isError = status === 'error';
  return (
    <div
      className={`deferred-feature-status deferred-feature-status--${variant}`}
      data-testid={`deferred-feature-${status}`}
      data-feature-label={label}
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      aria-busy={isError ? undefined : true}
    >
      <div className="deferred-feature-status__card">
        {!isError && (
          <span
            className="deferred-feature-status__spinner"
            aria-hidden="true"
          />
        )}
        <span className="deferred-feature-status__message">
          {isError ? `${label}加载失败` : `正在加载${label}`}
        </span>
        <div className="deferred-feature-status__actions">
          {isError && onRetry && (
            <button
              type="button"
              className="deferred-feature-status__button deferred-feature-status__button--primary"
              onClick={onRetry}
            >
              重试
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              className="deferred-feature-status__button"
              onClick={onCancel}
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface RetriableDeferredFeatureProps<Module> {
  loader: () => Promise<Module>;
  renderFeature: (module: Module) => React.ReactNode;
  label: string;
  variant?: 'overlay' | 'passive' | 'inline';
  onCancel?: () => void;
}

/**
 * A user-visible dynamic-import boundary whose rejected import can be retried
 * without a page reload. The supplied loader owns single-flight and successful
 * module caching; this component owns only per-mount user feedback.
 */
export function RetriableDeferredFeature<Module>({
  loader,
  renderFeature,
  label,
  variant = 'overlay',
  onCancel,
}: RetriableDeferredFeatureProps<Module>) {
  const [loadedModule, setLoadedModule] = useState<{
    value: Module;
  } | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'error'>('loading');
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestFeature = useCallback(() => {
    if (loadingRef.current || loadedModule) {
      return;
    }
    loadingRef.current = true;
    setLoadStatus('loading');
    void loader().then(
      (module) => {
        loadingRef.current = false;
        if (mountedRef.current) {
          setLoadedModule({ value: module });
        }
      },
      () => {
        loadingRef.current = false;
        if (mountedRef.current) {
          setLoadStatus('error');
        }
      }
    );
  }, [loadedModule, loader]);

  useEffect(() => {
    requestFeature();
  }, [requestFeature]);

  if (loadedModule) {
    return <>{renderFeature(loadedModule.value)}</>;
  }

  return (
    <DeferredFeatureStatus
      label={label}
      status={loadStatus}
      variant={variant}
      onRetry={loadStatus === 'error' ? requestFeature : undefined}
      onCancel={onCancel}
    />
  );
}

export default RetriableDeferredFeature;
