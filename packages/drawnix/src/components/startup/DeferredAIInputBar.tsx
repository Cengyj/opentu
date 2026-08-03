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
  const shellInputRef = useRef<HTMLTextAreaElement | null>(null);
  const replayTimerRef = useRef<number | null>(null);
  const submitTimerRef = useRef<number | null>(null);
  const [workspaceNoticeVisible, setWorkspaceNoticeVisible] = useState(false);

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

  const activate = useCallback(() => {
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
  }, []);

  useEffect(() => {
    if (isDataReady) {
      setWorkspaceNoticeVisible(false);
    }
  }, [isDataReady]);

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

      if (!detail.generationType && !detail.skillId) {
        shouldFocusRef.current = true;
        shellInputRef.current?.focus();
        return;
      }

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
      setDraft(detail.prompt || '');
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
      data-startup-operable={isStartupOperable ? 'true' : 'false'}
      data-workspace-ready={isDataReady ? 'true' : 'false'}
    >
      <div className="ai-input-bar__container deferred-ai-input-bar__container">
        <div className="deferred-ai-input-bar__toolbar">
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
              <button
                type="button"
                className="deferred-ai-input-bar__tool"
                onClick={activate}
                aria-label="加载附件工具"
              >
                +
              </button>
              <button
                type="button"
                className="deferred-ai-input-bar__tool deferred-ai-input-bar__tool--mode"
                onClick={activate}
              >
                智能
              </button>
              <span className="deferred-ai-input-bar__toolbar-spacer" />
              <button
                type="button"
                className="deferred-ai-input-bar__control"
                onClick={activate}
              >
                自动模型
              </button>
              <button
                type="button"
                className="deferred-ai-input-bar__control"
                onClick={activate}
              >
                参数
              </button>
              <button
                type="button"
                className="deferred-ai-input-bar__send"
                disabled={
                  !isDataReady || !draft.trim() || loadStatus === 'loading'
                }
                aria-label={
                  isDataReady ? '发送' : '工作区恢复完成后才能发送'
                }
                onClick={() => {
                  if (!isDataReady) {
                    setWorkspaceNoticeVisible(true);
                    return;
                  }
                  submitAfterReadyRef.current = true;
                  activate();
                }}
              >
                ↑
              </button>
            </>
          )}
        </div>
        <textarea
          ref={shellInputRef}
          className="ai-input-bar__input deferred-ai-input-bar__input"
          value={draft}
          onFocus={() => {
            shouldFocusRef.current = true;
          }}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.altKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!isDataReady) {
                setWorkspaceNoticeVisible(true);
                return;
              }
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
        {workspaceNoticeVisible && !isDataReady ? (
          <span className="deferred-ai-input-bar__workspace-notice" role="status">
            正在恢复工作区，完成后即可发送
          </span>
        ) : null}
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
