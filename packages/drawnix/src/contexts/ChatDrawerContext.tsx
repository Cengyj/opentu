/**
 * ChatDrawer Context
 *
 * 提供 ChatDrawer 的 ref 访问，使其他组件可以控制 ChatDrawer
 */

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
  type MutableRefObject,
} from 'react';
import type {
  ChatDrawerRef,
  WorkflowMessageData,
  WorkflowMessageParams,
  AgentLogEntry,
} from '../types/chat.types';
import type { GenerationType } from '../utils/ai-input-parser';
import type { ModelRef } from '../utils/settings-manager';
import type { Task } from '../types/task.types';
import { LS_KEYS } from '../constants/storage-keys';

/** 选中内容类型 */
export type SelectedContentType = 'image' | 'video' | 'graphics' | 'text';

/** 选中内容项 */
export interface SelectedContentItem {
  type: SelectedContentType;
  url?: string;
  maskImage?: string;
  text?: string;
  name: string;
  width?: number;
  height?: number;
}

/** 重试处理器类型 */
export type RetryHandler = (
  workflow: WorkflowMessageData,
  startStepIndex: number,
  workZoneId?: string
) => Promise<void>;

export interface DrawerGenerationSubmitParams {
  prompt: string;
  selectedContent: SelectedContentItem[];
  generationType: GenerationType;
  selectedModel: string;
  selectedModelRef?: ModelRef | null;
  selectedParams: Record<string, string>;
  selectedCount: number;
}

export type DrawerGenerationSubmitter = (
  params: DrawerGenerationSubmitParams
) => Promise<void>;

interface ChatDrawerContextValue {
  chatDrawerRef: MutableRefObject<ChatDrawerRef | null>;
  /** 完整抽屉是否已经被请求挂载 */
  shouldMountDrawer: boolean;
  /** 完整抽屉加载状态 */
  drawerMountStatus: 'idle' | 'loading' | 'ready' | 'error';
  /** 完整抽屉加载失败的可展示摘要 */
  drawerLoadError: string | null;
  /** 当前加载尝试，用于显式重试动态 import */
  drawerLoadAttempt: number;
  /** 请求挂载完整抽屉，不直接执行任何业务命令 */
  requestChatDrawerMount: () => void;
  /** 重试加载完整抽屉 */
  retryChatDrawerMount: () => void;
  /** 注册/注销完整抽屉实例 */
  attachChatDrawer: (drawer: ChatDrawerRef | null) => void;
  /** 报告完整抽屉动态加载失败 */
  reportChatDrawerLoadError: (error: unknown) => void;
  /** 将有返回值的命令按顺序投递给完整抽屉 */
  runWhenChatDrawerReady: <T>(
    command: (drawer: ChatDrawerRef) => T | Promise<T>
  ) => Promise<T>;
  /** 将无返回值命令按顺序投递给完整抽屉 */
  enqueueChatDrawerCommand: (command: (drawer: ChatDrawerRef) => void) => void;
  /** 注册重试处理器 */
  registerRetryHandler: (handler: RetryHandler) => void;
  /** 执行重试 */
  executeRetry: (
    workflow: WorkflowMessageData,
    startStepIndex: number
  ) => Promise<void>;
  /** 选中内容 */
  selectedContent: SelectedContentItem[];
  /** 设置选中内容 */
  setSelectedContent: (content: SelectedContentItem[]) => void;
  /** 抽屉是否打开（响应式状态） */
  isDrawerOpen: boolean;
  /** 设置抽屉打开状态 */
  setIsDrawerOpen: (open: boolean) => void;
  /** 抽屉宽度 */
  drawerWidth: number;
  /** 设置抽屉宽度 */
  setDrawerWidth: (width: number) => void;
  /** 注册抽屉生成提交处理器 */
  registerGenerationSubmitter: (
    submitter: DrawerGenerationSubmitter | null
  ) => void;
  /** 从抽屉提交生成任务 */
  submitGenerationFromDrawer: (
    params: DrawerGenerationSubmitParams
  ) => Promise<boolean>;
  /** 根据任务队列事件同步已有工作流消息 */
  syncWorkflowTaskUpdate: (task: Task) => boolean;
}

const ChatDrawerContext = createContext<ChatDrawerContextValue | null>(null);

export interface ChatDrawerProviderProps {
  children: React.ReactNode;
}

// 默认抽屉宽度
const DEFAULT_DRAWER_WIDTH =
  typeof window !== 'undefined' ? Math.max(375, window.innerWidth * 0.5) : 600;

interface QueuedDrawerCommand {
  execute: (drawer: ChatDrawerRef) => Promise<void>;
  reject?: (error: unknown) => void;
}

function getDrawerLoadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return '对话模块加载失败';
}

function readPersistedDrawerOpenIntent(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const stored = window.localStorage.getItem(LS_KEYS.CHAT_DRAWER_STATE);
    if (!stored) {
      return false;
    }
    const value: unknown = JSON.parse(stored);
    return (
      typeof value === 'object' &&
      value !== null &&
      'isOpen' in value &&
      value.isOpen === true
    );
  } catch {
    return false;
  }
}

/**
 * ChatDrawer Provider
 * 提供 ChatDrawer ref 的访问
 */
export const ChatDrawerProvider: React.FC<ChatDrawerProviderProps> = ({
  children,
}) => {
  const chatDrawerRef = useRef<ChatDrawerRef | null>(null);
  const queuedCommandsRef = useRef<QueuedDrawerCommand[]>([]);
  const commandChainRef = useRef<Promise<void>>(Promise.resolve());
  const initialDrawerOpenRef = useRef<boolean | null>(null);
  if (initialDrawerOpenRef.current === null) {
    initialDrawerOpenRef.current = readPersistedDrawerOpenIntent();
  }
  const initialDrawerOpen = initialDrawerOpenRef.current;
  const drawerMountStatusRef = useRef<
    ChatDrawerContextValue['drawerMountStatus']
  >(initialDrawerOpen ? 'loading' : 'idle');
  const retryHandlerRef = useRef<RetryHandler | null>(null);
  const generationSubmitterRef = useRef<DrawerGenerationSubmitter | null>(null);
  const [selectedContent, setSelectedContent] = useState<SelectedContentItem[]>(
    []
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(initialDrawerOpen);
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [shouldMountDrawer, setShouldMountDrawer] =
    useState(initialDrawerOpen);
  const [drawerMountStatus, setDrawerMountStatus] =
    useState<ChatDrawerContextValue['drawerMountStatus']>(
      initialDrawerOpen ? 'loading' : 'idle'
    );
  const [drawerLoadError, setDrawerLoadError] = useState<string | null>(null);
  const [drawerLoadAttempt, setDrawerLoadAttempt] = useState(0);

  const requestChatDrawerMount = useCallback(() => {
    if (drawerMountStatusRef.current === 'ready') {
      return;
    }

    if (drawerMountStatusRef.current === 'error') {
      setDrawerLoadAttempt((attempt) => attempt + 1);
    }
    drawerMountStatusRef.current = 'loading';
    setShouldMountDrawer(true);
    setDrawerLoadError(null);
    setDrawerMountStatus('loading');
  }, []);

  const scheduleDrawerCommand = useCallback(
    (command: QueuedDrawerCommand) => {
      commandChainRef.current = commandChainRef.current.then(async () => {
        const drawer = chatDrawerRef.current;
        if (!drawer) {
          command.reject?.(new Error('ChatDrawer unavailable'));
          return;
        }
        try {
          await command.execute(drawer);
        } catch (error) {
          command.reject?.(error);
        }
      });
    },
    []
  );

  const flushQueuedCommands = useCallback(
    () => {
      const commands = queuedCommandsRef.current.splice(0);
      commands.forEach((command) => scheduleDrawerCommand(command));
    },
    [scheduleDrawerCommand]
  );

  const attachChatDrawer = useCallback(
    (drawer: ChatDrawerRef | null) => {
      chatDrawerRef.current = drawer;
      if (!drawer) {
        return;
      }

      setDrawerLoadError(null);
      drawerMountStatusRef.current = 'ready';
      setDrawerMountStatus('ready');
      flushQueuedCommands();
    },
    [flushQueuedCommands]
  );

  const rejectQueuedCommands = useCallback(
    (error: unknown, retainFireAndForgetCommands = false) => {
      const commands = queuedCommandsRef.current.splice(0);
      const retainedCommands: QueuedDrawerCommand[] = [];
      commands.forEach((command) => {
        if (command.reject) {
          command.reject(error);
          return;
        }
        if (retainFireAndForgetCommands) {
          retainedCommands.push(command);
        }
      });
      queuedCommandsRef.current.push(...retainedCommands);
    },
    []
  );

  const reportChatDrawerLoadError = useCallback(
    (error: unknown) => {
      chatDrawerRef.current = null;
      drawerMountStatusRef.current = 'error';
      setDrawerLoadError(getDrawerLoadErrorMessage(error));
      setDrawerMountStatus('error');
      rejectQueuedCommands(error, true);
    },
    [rejectQueuedCommands]
  );

  const retryChatDrawerMount = useCallback(() => {
    drawerMountStatusRef.current = 'loading';
    setDrawerLoadError(null);
    setDrawerMountStatus('loading');
    setShouldMountDrawer(true);
    setDrawerLoadAttempt((attempt) => attempt + 1);
  }, []);

  const runWhenChatDrawerReady = useCallback(
    <T,>(execute: (drawer: ChatDrawerRef) => T | Promise<T>): Promise<T> => {
      const drawer = chatDrawerRef.current;
      if (drawer) {
        return new Promise<T>((resolve, reject) => {
          scheduleDrawerCommand(
            {
              execute: async (readyDrawer) => {
                resolve(await execute(readyDrawer));
              },
              reject,
            }
          );
        });
      }

      requestChatDrawerMount();
      return new Promise<T>((resolve, reject) => {
        queuedCommandsRef.current.push({
          execute: async (readyDrawer) => {
            resolve(await execute(readyDrawer));
          },
          reject,
        });
      });
    },
    [requestChatDrawerMount, scheduleDrawerCommand]
  );

  const enqueueChatDrawerCommand = useCallback(
    (execute: (drawer: ChatDrawerRef) => void) => {
      const drawer = chatDrawerRef.current;
      const command: QueuedDrawerCommand = {
        execute: async (readyDrawer) => {
          execute(readyDrawer);
        },
      };
      if (drawer) {
        scheduleDrawerCommand(command);
        return;
      }

      queuedCommandsRef.current.push(command);
      requestChatDrawerMount();
    },
    [requestChatDrawerMount, scheduleDrawerCommand]
  );

  useEffect(() => {
    return () => {
      rejectQueuedCommands(new Error('ChatDrawerProvider unmounted'));
    };
  }, [rejectQueuedCommands]);

  const registerRetryHandler = useCallback((handler: RetryHandler) => {
    retryHandlerRef.current = handler;
  }, []);

  const executeRetry = useCallback(
    async (workflow: WorkflowMessageData, startStepIndex: number) => {
      if (retryHandlerRef.current) {
        await retryHandlerRef.current(workflow, startStepIndex);
      } else {
        console.warn('[ChatDrawerContext] No retry handler registered');
      }
    },
    []
  );

  const registerGenerationSubmitter = useCallback(
    (submitter: DrawerGenerationSubmitter | null) => {
      generationSubmitterRef.current = submitter;
    },
    []
  );

  const submitGenerationFromDrawer = useCallback(
    async (params: DrawerGenerationSubmitParams) => {
      if (!generationSubmitterRef.current) {
        return false;
      }

      await generationSubmitterRef.current(params);
      return true;
    },
    []
  );

  const syncWorkflowTaskUpdate = useCallback(
    (task: Task) => {
      const drawer = chatDrawerRef.current;
      if (drawer) {
        return drawer.syncWorkflowTaskUpdate(task);
      }

      requestChatDrawerMount();
      return false;
    },
    [requestChatDrawerMount]
  );

  const contextValue = useMemo<ChatDrawerContextValue>(
    () => ({
      chatDrawerRef,
      shouldMountDrawer,
      drawerMountStatus,
      drawerLoadError,
      drawerLoadAttempt,
      requestChatDrawerMount,
      retryChatDrawerMount,
      attachChatDrawer,
      reportChatDrawerLoadError,
      runWhenChatDrawerReady,
      enqueueChatDrawerCommand,
      registerRetryHandler,
      executeRetry,
      selectedContent,
      setSelectedContent,
      isDrawerOpen,
      setIsDrawerOpen,
      drawerWidth,
      setDrawerWidth,
      registerGenerationSubmitter,
      submitGenerationFromDrawer,
      syncWorkflowTaskUpdate,
    }),
    [
      attachChatDrawer,
      drawerLoadAttempt,
      drawerLoadError,
      drawerMountStatus,
      drawerWidth,
      enqueueChatDrawerCommand,
      executeRetry,
      isDrawerOpen,
      registerGenerationSubmitter,
      registerRetryHandler,
      reportChatDrawerLoadError,
      requestChatDrawerMount,
      retryChatDrawerMount,
      runWhenChatDrawerReady,
      selectedContent,
      shouldMountDrawer,
      submitGenerationFromDrawer,
      syncWorkflowTaskUpdate,
    ]
  );

  return (
    <ChatDrawerContext.Provider value={contextValue}>
      {children}
    </ChatDrawerContext.Provider>
  );
};

/**
 * Hook to access ChatDrawer ref
 */
export function useChatDrawer(): ChatDrawerContextValue {
  const context = useContext(ChatDrawerContext);
  if (!context) {
    throw new Error('useChatDrawer must be used within a ChatDrawerProvider');
  }
  return context;
}

/**
 * Hook to get ChatDrawer control methods
 * 提供便捷的方法来控制 ChatDrawer
 */
export function useChatDrawerControl() {
  const {
    chatDrawerRef,
    shouldMountDrawer,
    enqueueChatDrawerCommand,
    runWhenChatDrawerReady,
    registerRetryHandler,
    executeRetry,
    selectedContent,
    setSelectedContent,
    isDrawerOpen,
    setIsDrawerOpen,
    drawerWidth,
    setDrawerWidth,
    registerGenerationSubmitter,
    submitGenerationFromDrawer,
    syncWorkflowTaskUpdate,
  } = useChatDrawer();

  return {
    /** 打开 ChatDrawer */
    openChatDrawer: () => {
      setIsDrawerOpen(true);
      enqueueChatDrawerCommand((drawer) => drawer.open());
    },
    /** 关闭 ChatDrawer */
    closeChatDrawer: () => {
      setIsDrawerOpen(false);
      if (chatDrawerRef.current) {
        chatDrawerRef.current.close();
      } else if (shouldMountDrawer) {
        // If an open command is already loading the drawer, preserve ordering
        // so the late mount cannot reopen a drawer the user has closed.
        enqueueChatDrawerCommand((drawer) => drawer.close());
      }
    },
    /** 切换 ChatDrawer 状态 */
    toggleChatDrawer: () => {
      setIsDrawerOpen(!isDrawerOpen);
      enqueueChatDrawerCommand((drawer) => drawer.toggle());
    },
    /** 打开 ChatDrawer 并发送消息 */
    sendMessageToChatDrawer: async (content: string) => {
      await runWhenChatDrawerReady((drawer) => drawer.sendMessage(content));
    },
    /** 打开 ChatDrawer 并发送工作流消息（创建新对话） */
    sendWorkflowMessage: async (params: WorkflowMessageParams) => {
      await runWhenChatDrawerReady((drawer) =>
        drawer.sendWorkflowMessage(params)
      );
    },
    /** 更新当前工作流消息 */
    updateWorkflowMessage: (workflow: WorkflowMessageData) => {
      enqueueChatDrawerCommand((drawer) =>
        drawer.updateWorkflowMessage(workflow)
      );
    },
    /** 追加 Agent 执行日志 */
    appendAgentLog: (log: AgentLogEntry) => {
      enqueueChatDrawerCommand((drawer) => drawer.appendAgentLog(log));
    },
    /** 更新 AI 思考内容（流式追加） */
    updateThinkingContent: (content: string) => {
      enqueueChatDrawerCommand((drawer) =>
        drawer.updateThinkingContent(content)
      );
    },
    /** 获取 ChatDrawer 是否打开 */
    isChatDrawerOpen: () => {
      return isDrawerOpen;
    },
    /** 抽屉是否打开（响应式状态） */
    isDrawerOpen,
    /** 设置抽屉打开状态 */
    setIsDrawerOpen,
    /** 抽屉宽度 */
    drawerWidth,
    /** 设置抽屉宽度 */
    setDrawerWidth,
    /** 注册重试处理器 */
    registerRetryHandler,
    /** 从失败步骤重试工作流 */
    retryWorkflowFromStep: async (
      workflow: WorkflowMessageData,
      stepIndex: number
    ) => {
      await executeRetry(workflow, stepIndex);
    },
    /** 选中内容 */
    selectedContent,
    /** 设置选中内容 */
    setSelectedContent,
    /** 注册抽屉生成提交处理器 */
    registerGenerationSubmitter,
    /** 从抽屉提交生成任务 */
    submitGenerationFromDrawer,
    /** 根据任务队列事件同步已有工作流消息 */
    syncWorkflowTaskUpdate,
  };
}

export default ChatDrawerContext;
