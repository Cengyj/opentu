import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ATTACHED_ELEMENT_CLASS_NAME } from '@plait/core';
import {
  AI_INPUT_FOCUS_EVENT,
  AI_INPUT_PREFILL_EVENT,
  type AIInputFocusEventDetail,
  type AIInputPrefillEventDetail,
} from '../../services/ai-input-ui-events';
import type { AIInputBarRuntimeProps } from './AIInputBarRuntime';
import './deferred-ai-input-bar.scss';

interface DeferredAIInputBarProps {
  isDataReady: boolean;
  isStartupOperable: boolean;
  activationKey: number;
  onEnableToolWindows?: () => void;
  onEnableRuntime?: () => void;
  onShellMounted?: () => void;
}

type RuntimeComponent = React.ComponentType<AIInputBarRuntimeProps>;
type PendingAIInputEvent =
  | { type: typeof AI_INPUT_FOCUS_EVENT; detail: AIInputFocusEventDetail }
  | { type: typeof AI_INPUT_PREFILL_EVENT; detail: AIInputPrefillEventDetail };

const AI_INPUT_IDLE_TIMEOUT_MS = 1500;
const AI_INPUT_FALLBACK_DELAY_MS = 400;

function scheduleAIInputRuntimeLoad(callback: () => void): () => void {
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      idleCallback: () => void,
      options?: { timeout: number }
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const idleId = idleWindow.requestIdleCallback(callback, {
      timeout: AI_INPUT_IDLE_TIMEOUT_MS,
    });
    return () => idleWindow.cancelIdleCallback?.(idleId);
  }

  const timer = window.setTimeout(callback, AI_INPUT_FALLBACK_DELAY_MS);
  return () => window.clearTimeout(timer);
}

export function DeferredAIInputBar({
  isDataReady,
  isStartupOperable,
  activationKey,
  onEnableToolWindows,
  onEnableRuntime,
  onShellMounted,
}: DeferredAIInputBarProps) {
  const [draft, setDraft] = useState('');
  const [loadStatus, setLoadStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [LoadedRuntime, setLoadedRuntime] = useState<RuntimeComponent | null>(
    null
  );
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const runtimeRef = useRef<RuntimeComponent | null>(null);
  const runtimeReadyRef = useRef(false);
  const shouldFocusRef = useRef(false);
  const submitAfterReadyRef = useRef(false);
  const pendingEventsRef = useRef<PendingAIInputEvent[]>([]);
  const replayTimerRef = useRef<number | null>(null);
  const submitTimerRef = useRef<number | null>(null);
  const cancelIdleLoadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (replayTimerRef.current !== null) {
        window.clearTimeout(replayTimerRef.current);
      }
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    onShellMounted?.();
  }, [onShellMounted]);

  const cancelScheduledIdleLoad = useCallback(() => {
    cancelIdleLoadRef.current?.();
    cancelIdleLoadRef.current = null;
  }, []);

  const activate = useCallback(() => {
    cancelScheduledIdleLoad();
    if (runtimeRef.current || loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoadError(null);
    setLoadStatus('loading');
    import('./AIInputBarRuntime')
      .then((module) => {
        if (!mountedRef.current) {
          return;
        }
        runtimeRef.current = module.AIInputBarRuntime;
        setLoadedRuntime(() => module.AIInputBarRuntime);
      })
      .catch((error) => {
        loadingRef.current = false;
        if (!mountedRef.current) {
          return;
        }
        setLoadError(
          error instanceof Error && error.message.trim()
            ? error.message
            : 'AI 输入模块加载失败'
        );
        setLoadStatus('error');
      });
  }, [cancelScheduledIdleLoad]);

  useEffect(() => {
    if (!isStartupOperable || runtimeRef.current || loadingRef.current) {
      return;
    }

    let disposed = false;
    const cancelScheduledLoad = scheduleAIInputRuntimeLoad(() => {
      if (disposed) {
        return;
      }
      cancelIdleLoadRef.current = null;
      activate();
    });
    const cancelIdleLoad = () => {
      disposed = true;
      cancelScheduledLoad();
    };
    cancelIdleLoadRef.current = cancelIdleLoad;

    return () => {
      if (cancelIdleLoadRef.current === cancelIdleLoad) {
        cancelIdleLoadRef.current = null;
      }
      cancelIdleLoad();
    };
  }, [activate, isStartupOperable]);

  useEffect(() => {
    if (activationKey <= 0) {
      return;
    }
    shouldFocusRef.current = true;
    activate();
  }, [activationKey, activate]);

  useEffect(() => {
    const handleFocusRequest = (event: Event) => {
      if (runtimeReadyRef.current) {
        return;
      }
      const detail =
        (event as CustomEvent<AIInputFocusEventDetail>).detail || {};
      pendingEventsRef.current.push({
        type: AI_INPUT_FOCUS_EVENT,
        detail,
      });
      shouldFocusRef.current = true;
      activate();
    };

    const handlePrefillRequest = (event: Event) => {
      if (runtimeReadyRef.current) {
        return;
      }
      const detail = (event as CustomEvent<AIInputPrefillEventDetail>).detail;
      if (!detail) {
        return;
      }
      pendingEventsRef.current.push({
        type: AI_INPUT_PREFILL_EVENT,
        detail,
      });
      shouldFocusRef.current = true;
      activate();
    };

    window.addEventListener(AI_INPUT_FOCUS_EVENT, handleFocusRequest);
    window.addEventListener(AI_INPUT_PREFILL_EVENT, handlePrefillRequest);
    return () => {
      window.removeEventListener(AI_INPUT_FOCUS_EVENT, handleFocusRequest);
      window.removeEventListener(AI_INPUT_PREFILL_EVENT, handlePrefillRequest);
    };
  }, [activate]);

  const handleRuntimeReady = useCallback(() => {
    if (runtimeReadyRef.current) {
      return;
    }
    runtimeReadyRef.current = true;
    loadingRef.current = false;
    setLoadStatus('ready');
    const pendingEvents = pendingEventsRef.current.splice(0);

    replayTimerRef.current = window.setTimeout(() => {
      replayTimerRef.current = null;
      if (!mountedRef.current) {
        return;
      }
      pendingEvents.forEach((pendingEvent) => {
        window.dispatchEvent(
          new CustomEvent(pendingEvent.type, {
            detail: pendingEvent.detail,
          })
        );
      });

      if (shouldFocusRef.current && pendingEvents.length === 0) {
        window.dispatchEvent(new CustomEvent(AI_INPUT_FOCUS_EVENT));
      }

      submitTimerRef.current = window.setTimeout(() => {
        submitTimerRef.current = null;
        if (!mountedRef.current) {
          return;
        }
        const textarea = document.querySelector<HTMLTextAreaElement>(
          '[data-testid="ai-input-textarea"]'
        );
        if (shouldFocusRef.current) {
          textarea?.focus();
          textarea?.setSelectionRange(
            textarea.value.length,
            textarea.value.length
          );
          shouldFocusRef.current = false;
        }
        if (submitAfterReadyRef.current && textarea) {
          submitAfterReadyRef.current = false;
          textarea.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true,
              cancelable: true,
            })
          );
        }
      }, 0);
    }, 0);
  }, []);

  if (LoadedRuntime) {
    return (
      <LoadedRuntime
        isDataReady={isDataReady}
        initialPrompt={draft}
        onReady={handleRuntimeReady}
        onEnableToolWindows={onEnableToolWindows}
        onEnableRuntime={onEnableRuntime}
      />
    );
  }

  return (
    <div
      className={`ai-input-bar deferred-ai-input-bar ${ATTACHED_ELEMENT_CLASS_NAME}`}
      data-testid="deferred-ai-input-bar"
      data-load-status={loadStatus}
      onPointerDown={activate}
    >
      <div className="ai-input-bar__container deferred-ai-input-bar__container">
        <div
          className="deferred-ai-input-bar__toolbar"
          aria-hidden={loadStatus === 'error' ? undefined : true}
        >
          {loadStatus === 'error' ? (
            <button
              type="button"
              className="deferred-ai-input-bar__retry"
              onClick={activate}
              aria-label={loadError || 'AI 输入功能加载失败，点击重试'}
            >
              AI 输入加载失败，点击重试
            </button>
          ) : (
            <>
              <span className="deferred-ai-input-bar__tool-placeholder" />
              <span className="deferred-ai-input-bar__tool-placeholder" />
              <span className="deferred-ai-input-bar__control-placeholder" />
              <span className="deferred-ai-input-bar__control-placeholder deferred-ai-input-bar__control-placeholder--wide" />
              <span className="deferred-ai-input-bar__send-placeholder" />
            </>
          )}
        </div>
        <textarea
          className="ai-input-bar__input deferred-ai-input-bar__input"
          value={draft}
          onFocus={() => {
            shouldFocusRef.current = true;
            activate();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            activate();
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.altKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submitAfterReadyRef.current = true;
              activate();
            }
          }}
          placeholder="描述你想要创建的内容"
          rows={1}
          data-testid="ai-input-textarea"
          aria-label="AI 输入"
          aria-busy={loadStatus === 'loading' || undefined}
        />
        <span className="deferred-ai-input-bar__status" aria-live="polite">
          {loadStatus === 'loading'
            ? '正在加载 AI 输入功能'
            : loadStatus === 'error'
            ? `AI 输入功能加载失败，点击重试：${loadError || ''}`
            : ''}
        </span>
      </div>
    </div>
  );
}

export default DeferredAIInputBar;
