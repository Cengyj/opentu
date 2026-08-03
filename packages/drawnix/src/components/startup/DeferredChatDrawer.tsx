import React, { useEffect, useState } from 'react';
import ChevronLeftIcon from 'tdesign-icons-react/esm/components/chevron-left';
import {
  useChatDrawer,
  useChatDrawerControl,
} from '../../contexts/ChatDrawerContext';
import type { ChatDrawerProps, ChatDrawerRef } from '../../types/chat.types';
import './deferred-chat-drawer.scss';

type ChatDrawerComponent = React.ForwardRefExoticComponent<
  ChatDrawerProps & React.RefAttributes<ChatDrawerRef>
>;

export function DeferredChatDrawer() {
  const {
    shouldMountDrawer,
    drawerMountStatus,
    drawerLoadAttempt,
    retryChatDrawerMount,
    attachChatDrawer,
    reportChatDrawerLoadError,
    isDrawerOpen,
  } = useChatDrawer();
  const { openChatDrawer } = useChatDrawerControl();
  const [DrawerComponent, setDrawerComponent] =
    useState<ChatDrawerComponent | null>(null);

  useEffect(() => {
    if (!shouldMountDrawer || DrawerComponent) {
      return;
    }

    let active = true;
    import('../chat-drawer/ChatDrawer')
      .then((module) => {
        if (active) {
          setDrawerComponent(() => module.ChatDrawer);
        }
      })
      .catch((error) => {
        if (active) {
          reportChatDrawerLoadError(error);
        }
      });

    return () => {
      active = false;
    };
  }, [
    DrawerComponent,
    drawerLoadAttempt,
    reportChatDrawerLoadError,
    shouldMountDrawer,
  ]);

  if (DrawerComponent) {
    return <DrawerComponent ref={attachChatDrawer} />;
  }

  const hasLoadError = drawerMountStatus === 'error';
  const isLoading = drawerMountStatus === 'loading';
  const label = hasLoadError
    ? '对话加载失败，点击重试'
    : isLoading
    ? '正在加载对话'
    : '展开对话';

  return (
    <button
      type="button"
      className="chat-drawer-trigger deferred-chat-drawer-trigger"
      data-testid="deferred-chat-drawer-trigger"
      aria-label={label}
      aria-expanded={isDrawerOpen}
      aria-busy={isLoading || undefined}
      onClick={hasLoadError ? retryChatDrawerMount : openChatDrawer}
    >
      <ChevronLeftIcon
        size={16}
        className="chat-drawer-trigger__icon"
        aria-hidden="true"
      />
      <span className="deferred-chat-drawer-trigger__status" aria-live="polite">
        {isLoading ? '加载中' : hasLoadError ? '重试' : ''}
      </span>
    </button>
  );
}

export default DeferredChatDrawer;
