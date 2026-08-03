// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChatDrawerProvider,
  useChatDrawer,
  useChatDrawerControl,
} from '../ChatDrawerContext';
import type { ChatDrawerRef } from '../../types/chat.types';
import { TaskStatus, TaskType, type Task } from '../../types/task.types';
import { LS_KEYS } from '../../constants/storage-keys';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function createDrawerRef(): ChatDrawerRef {
  return {
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    sendMessage: vi.fn(async () => undefined),
    sendWorkflowMessage: vi.fn(async () => undefined),
    updateWorkflowMessage: vi.fn(),
    syncWorkflowTaskUpdate: vi.fn(() => true),
    appendAgentLog: vi.fn(),
    updateThinkingContent: vi.fn(),
    isOpen: vi.fn(() => false),
    retryWorkflowFromStep: vi.fn(async () => undefined),
  };
}

function requireValue<T>(value: T | null, label: string): T {
  if (value === null) {
    throw new Error(`${label} was not initialized`);
  }
  return value;
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('ChatDrawerProvider deferred controller', () => {
  it('mounts the drawer when the persisted user intent is open', () => {
    localStorage.setItem(
      LS_KEYS.CHAT_DRAWER_STATE,
      JSON.stringify({ isOpen: true, width: 600, activeSessionId: null })
    );
    let context: ReturnType<typeof useChatDrawer> | null = null;

    function Harness() {
      context = useChatDrawer();
      return null;
    }

    render(
      <ChatDrawerProvider>
        <Harness />
      </ChatDrawerProvider>
    );

    expect(requireValue(context, 'context').isDrawerOpen).toBe(true);
    expect(requireValue(context, 'context').shouldMountDrawer).toBe(true);
    expect(requireValue(context, 'context').drawerMountStatus).toBe('loading');
  });

  it('queues the first message until the drawer mounts and resolves once', async () => {
    let context: ReturnType<typeof useChatDrawer> | null = null;
    let control: ReturnType<typeof useChatDrawerControl> | null = null;

    function Harness() {
      context = useChatDrawer();
      control = useChatDrawerControl();
      return null;
    }

    render(
      <ChatDrawerProvider>
        <Harness />
      </ChatDrawerProvider>
    );

    let result!: Promise<void>;
    act(() => {
      result = requireValue(control, 'control').sendMessageToChatDrawer(
        'first command'
      );
    });
    expect(requireValue(context, 'context').shouldMountDrawer).toBe(true);
    expect(requireValue(context, 'context').drawerMountStatus).toBe('loading');

    const drawer = createDrawerRef();
    act(() => requireValue(context, 'context').attachChatDrawer(drawer));
    await result;

    expect(drawer.sendMessage).toHaveBeenCalledTimes(1);
    expect(drawer.sendMessage).toHaveBeenCalledWith('first command');
  });

  it('uses the latest imperative ref for commands queued behind async work', async () => {
    let context: ReturnType<typeof useChatDrawer> | null = null;

    function Harness() {
      context = useChatDrawer();
      return null;
    }

    render(
      <ChatDrawerProvider>
        <Harness />
      </ChatDrawerProvider>
    );

    const deferred = createDeferred();
    let firstCommand!: Promise<void>;
    act(() => {
      firstCommand = requireValue(
        context,
        'context'
      ).runWhenChatDrawerReady(async (drawer) => {
        drawer.open();
        await deferred.promise;
      });
      requireValue(context, 'context').enqueueChatDrawerCommand((drawer) =>
        drawer.close()
      );
    });

    const firstRef = createDrawerRef();
    act(() => requireValue(context, 'context').attachChatDrawer(firstRef));
    await waitFor(() => expect(firstRef.open).toHaveBeenCalledTimes(1));

    const refreshedRef = createDrawerRef();
    act(() => {
      requireValue(context, 'context').attachChatDrawer(null);
      requireValue(context, 'context').attachChatDrawer(refreshedRef);
    });
    deferred.resolve();
    await firstCommand;

    await waitFor(() => expect(refreshedRef.close).toHaveBeenCalledTimes(1));
    expect(firstRef.close).not.toHaveBeenCalled();
  });

  it('keeps fire-and-forget open intent across a load failure and retry', async () => {
    let context: ReturnType<typeof useChatDrawer> | null = null;
    let control: ReturnType<typeof useChatDrawerControl> | null = null;

    function Harness() {
      context = useChatDrawer();
      control = useChatDrawerControl();
      return null;
    }

    render(
      <ChatDrawerProvider>
        <Harness />
      </ChatDrawerProvider>
    );

    act(() => requireValue(control, 'control').openChatDrawer());
    act(() =>
      requireValue(context, 'context').reportChatDrawerLoadError(
        new Error('chunk failed')
      )
    );
    expect(requireValue(context, 'context').drawerMountStatus).toBe('error');

    act(() => requireValue(context, 'context').retryChatDrawerMount());
    const drawer = createDrawerRef();
    act(() => requireValue(context, 'context').attachChatDrawer(drawer));

    await waitFor(() => expect(drawer.open).toHaveBeenCalledTimes(1));
    expect(requireValue(context, 'context').isDrawerOpen).toBe(true);
  });

  it('does not load the drawer just to close an unopened drawer', () => {
    let context: ReturnType<typeof useChatDrawer> | null = null;
    let control: ReturnType<typeof useChatDrawerControl> | null = null;

    function Harness() {
      context = useChatDrawer();
      control = useChatDrawerControl();
      return null;
    }

    render(
      <ChatDrawerProvider>
        <Harness />
      </ChatDrawerProvider>
    );

    act(() => requireValue(control, 'control').closeChatDrawer());

    expect(requireValue(context, 'context').shouldMountDrawer).toBe(false);
    expect(requireValue(context, 'context').drawerMountStatus).toBe('idle');
  });

  it('closes after a pending open command finishes loading', async () => {
    let context: ReturnType<typeof useChatDrawer> | null = null;
    let control: ReturnType<typeof useChatDrawerControl> | null = null;

    function Harness() {
      context = useChatDrawer();
      control = useChatDrawerControl();
      return null;
    }

    render(
      <ChatDrawerProvider>
        <Harness />
      </ChatDrawerProvider>
    );

    act(() => requireValue(control, 'control').openChatDrawer());
    act(() => requireValue(control, 'control').closeChatDrawer());

    const drawer = createDrawerRef();
    act(() => requireValue(context, 'context').attachChatDrawer(drawer));

    await waitFor(() => expect(drawer.close).toHaveBeenCalledTimes(1));
    expect(drawer.open).toHaveBeenCalledTimes(1);
    expect(requireValue(context, 'context').isDrawerOpen).toBe(false);
  });

  it('rejects a pending async command when the dynamic module fails', async () => {
    let context: ReturnType<typeof useChatDrawer> | null = null;
    let control: ReturnType<typeof useChatDrawerControl> | null = null;

    function Harness() {
      context = useChatDrawer();
      control = useChatDrawerControl();
      return null;
    }

    render(
      <ChatDrawerProvider>
        <Harness />
      </ChatDrawerProvider>
    );

    let result!: Promise<void>;
    act(() => {
      result = requireValue(control, 'control').sendMessageToChatDrawer(
        'will fail'
      );
    });
    act(() =>
      requireValue(context, 'context').reportChatDrawerLoadError(
        new Error('chunk failed')
      )
    );

    await expect(result).rejects.toThrow('chunk failed');
  });

  it('requests the drawer but leaves task updates buffered until it mounts', () => {
    let context: ReturnType<typeof useChatDrawer> | null = null;

    function Harness() {
      context = useChatDrawer();
      return null;
    }

    render(
      <ChatDrawerProvider>
        <Harness />
      </ChatDrawerProvider>
    );

    const task: Task = {
      id: 'workflow-task',
      type: TaskType.IMAGE,
      status: TaskStatus.PROCESSING,
      params: { prompt: 'workflow update' },
      createdAt: 1,
      updatedAt: 1,
    };

    let handled = true;
    act(() => {
      handled = requireValue(context, 'context').syncWorkflowTaskUpdate(task);
    });
    expect(handled).toBe(false);
    expect(requireValue(context, 'context').shouldMountDrawer).toBe(true);
    expect(requireValue(context, 'context').drawerMountStatus).toBe('loading');
  });
});
