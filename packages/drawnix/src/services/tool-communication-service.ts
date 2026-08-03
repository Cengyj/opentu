/**
 * Tool Communication Service
 *
 * 工具通信服务
 * 管理画布与工具 iframe 之间的 postMessage 通信
 */

import { PlaitBoard } from '@plait/core';
import {
  ToolMessage,
  ToolMessageType,
  MessageHandler,
  PendingMessage,
  InitPayload,
  InsertTextPayload,
  InsertImagePayload,
  type GenerateImagePayload,
  type RequestDataPayload,
  type ToolBridgeCapability,
} from '../types/tool-communication.types';

interface RegisteredToolIframe {
  iframe: HTMLIFrameElement;
  capabilities: ReadonlySet<ToolBridgeCapability>;
}

const INBOUND_CAPABILITY_BY_TYPE: Partial<
  Record<ToolMessageType, ToolBridgeCapability>
> = {
  [ToolMessageType.TOOL_TO_BOARD_INSERT_TEXT]: 'insert-text',
  [ToolMessageType.TOOL_TO_BOARD_INSERT_IMAGE]: 'insert-image',
  [ToolMessageType.TOOL_TO_BOARD_REQUEST_DATA]: 'request-data',
  [ToolMessageType.TOOL_TO_BOARD_CLOSE]: 'close-self',
  [ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE]: 'generate-image',
};

const TOOL_MESSAGE_TYPES = new Set<string>(Object.values(ToolMessageType));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isOptionalPoint(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length === 2 &&
      value.every((coordinate) =>
        typeof coordinate === 'number' && Number.isFinite(coordinate)
      ))
  );
}

function isInsertTextPayload(value: unknown): value is InsertTextPayload {
  if (!isRecord(value) || typeof value.text !== 'string') {
    return false;
  }
  if (!isOptionalPoint(value.position)) {
    return false;
  }
  if (value.style === undefined) {
    return true;
  }
  return (
    isRecord(value.style) &&
    isOptionalFiniteNumber(value.style.fontSize) &&
    isOptionalString(value.style.fontFamily) &&
    isOptionalString(value.style.color) &&
    (value.style.bold === undefined || typeof value.style.bold === 'boolean') &&
    (value.style.italic === undefined || typeof value.style.italic === 'boolean')
  );
}

function isInsertImagePayload(value: unknown): value is InsertImagePayload {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    isOptionalPoint(value.position) &&
    isOptionalFiniteNumber(value.width) &&
    isOptionalFiniteNumber(value.height)
  );
}

function isRequestDataPayload(value: unknown): value is RequestDataPayload {
  return (
    isRecord(value) &&
    (value.dataType === 'board-state' ||
      value.dataType === 'selected-elements' ||
      value.dataType === 'viewport')
  );
}

function isGenerateImagePayload(value: unknown): value is GenerateImagePayload {
  if (
    !isRecord(value) ||
    typeof value.prompt !== 'string' ||
    !isOptionalFiniteNumber(value.width) ||
    !isOptionalFiniteNumber(value.height) ||
    !isOptionalString(value.aspectRatio) ||
    !isOptionalString(value.size) ||
    !isOptionalString(value.messageId) ||
    !isOptionalString(value.batchId) ||
    !isOptionalFiniteNumber(value.batchIndex) ||
    !isOptionalFiniteNumber(value.batchTotal) ||
    !isOptionalFiniteNumber(value.globalIndex)
  ) {
    return false;
  }
  return (
    value.uploadedImages === undefined ||
    (Array.isArray(value.uploadedImages) &&
      value.uploadedImages.every(
        (image) => isRecord(image) && isOptionalString(image.url)
      ))
  );
}

function isValidInboundPayload(
  type: ToolMessageType,
  payload: unknown
): boolean {
  switch (type) {
    case ToolMessageType.TOOL_TO_BOARD_INSERT_TEXT:
      return isInsertTextPayload(payload);
    case ToolMessageType.TOOL_TO_BOARD_INSERT_IMAGE:
      return isInsertImagePayload(payload);
    case ToolMessageType.TOOL_TO_BOARD_REQUEST_DATA:
      return isRequestDataPayload(payload);
    case ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE:
      return isGenerateImagePayload(payload);
    default:
      return true;
  }
}

/**
 * 工具通信服务类
 */
export class ToolCommunicationService {
  private board: PlaitBoard;
  private messageHandlers: Map<ToolMessageType, MessageHandler[]>;
  private pendingMessages: Map<string, PendingMessage>;
  private processedMessageIds: Set<string>;
  private registeredIframes: Map<string, RegisteredToolIframe>;

  // 默认超时时间（毫秒）
  private static readonly DEFAULT_TIMEOUT = 5000;

  // 消息 ID 缓存大小限制
  private static readonly MAX_PROCESSED_IDS = 1000;

  constructor(board: PlaitBoard) {
    this.board = board;
    this.messageHandlers = new Map();
    this.pendingMessages = new Map();
    this.processedMessageIds = new Set();
    this.registeredIframes = new Map();

    this.setupMessageListener();
  }

  /**
   * 发送消息给工具（带超时和重试）
   */
  async sendToTool<T>(
    toolId: string,
    type: ToolMessageType,
    payload: T,
    options?: {
      timeout?: number;
      expectReply?: boolean;
    }
  ): Promise<ToolMessage | void> {
    const registration = this.registeredIframes.get(toolId);
    const iframe = registration?.iframe;
    const targetOrigin = iframe
      ? this.resolveIframeTargetOrigin(iframe)
      : null;
    const targetWindow = iframe?.contentWindow;
    if (!targetWindow || !targetOrigin) {
      throw new Error(`Tool iframe not found: ${toolId}`);
    }

    const message: ToolMessage<T> = {
      version: '1.0',
      type,
      toolId,
      messageId: this.generateMessageId(),
      payload,
      timestamp: Date.now(),
    };

    // 如果期待回复，注册 pending 消息
    if (options?.expectReply) {
      return new Promise((resolve, reject) => {
        const timeoutMs = options.timeout || ToolCommunicationService.DEFAULT_TIMEOUT;
        const timeoutId = setTimeout(() => {
          this.pendingMessages.delete(message.messageId);
          reject(new Error('Message timeout'));
        }, timeoutMs);

        this.pendingMessages.set(message.messageId, {
          message,
          resolve,
          reject,
          timeoutId,
        });

        targetWindow.postMessage(message, targetOrigin);
      });
    } else {
      // 不期待回复，直接发送
      targetWindow.postMessage(message, targetOrigin);
    }
  }

  /**
   * Registers the exact iframe window and trusted manifest capabilities.
   * Persisted canvas metadata is intentionally not an authority for these
   * capabilities because imported documents are untrusted input.
   */
  registerToolIframe(
    toolId: string,
    iframe: HTMLIFrameElement,
    capabilities: readonly ToolBridgeCapability[] = []
  ): void {
    const targetOrigin = this.resolveIframeTargetOrigin(iframe);
    if (!targetOrigin) {
      throw new Error(`Unsupported tool iframe URL: ${iframe.src}`);
    }
    this.registeredIframes.set(toolId, {
      iframe,
      capabilities: new Set(capabilities),
    });
  }

  unregisterToolIframe(toolId: string, iframe?: HTMLIFrameElement): void {
    const registration = this.registeredIframes.get(toolId);
    if (!registration || (iframe && registration.iframe !== iframe)) {
      return;
    }
    this.registeredIframes.delete(toolId);
  }

  isToolConnected(toolId: string): boolean {
    const iframe = this.registeredIframes.get(toolId)?.iframe;
    return Boolean(iframe?.isConnected && iframe.contentWindow);
  }

  /**
   * 注册消息处理器
   */
  on(type: ToolMessageType, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.push(handler);
    } else {
      this.messageHandlers.set(type, [handler]);
    }
  }

  /**
   * 取消注册处理器
   */
  off(type: ToolMessageType, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 设置全局消息监听器
   */
  private setupMessageListener(): void {
    window.addEventListener('message', this.handleMessage);
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage = (event: MessageEvent): void => {
    // 1. 验证消息格式
    if (!this.isValidToolMessage(event)) {
      return;
    }

    const message: ToolMessage = event.data;

    // 2. 防止重复处理
    const processedMessageKey = this.getProcessedMessageKey(message);
    if (this.processedMessageIds.has(processedMessageKey)) {
      console.warn('[ToolCommunication] Duplicate message:', message.messageId);
      return;
    }
    this.processedMessageIds.add(processedMessageKey);
    this.trimProcessedMessages();

    // 3. 如果是回复消息，解析 pending promise
    if (message.replyTo) {
      this.resolvePendingMessage(message);
      return;
    }

    // 4. 调用注册的处理器
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error('[ToolCommunication] Handler error:', error);
        }
      });
    }
  };

  /**
   * 解析等待中的消息
   */
  private resolvePendingMessage(message: ToolMessage): void {
    const replyTo = message.replyTo;
    if (!replyTo) {
      return;
    }
    const pending = this.pendingMessages.get(replyTo);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pending.resolve(message);
      this.pendingMessages.delete(replyTo);
    }
  }

  /**
   * 验证消息格式和来源
   */
  private isValidToolMessage(event: MessageEvent): boolean {
    const data: unknown = event.data;
    if (!data || typeof data !== 'object') {
      return false;
    }

    const candidate = data as Partial<ToolMessage>;

    // 检查必需字段
    const requiredFields = ['version', 'type', 'toolId', 'messageId', 'timestamp'];
    const hasAllFields = requiredFields.every((field) => field in candidate);

    if (
      !hasAllFields ||
      typeof candidate.type !== 'string' ||
      !TOOL_MESSAGE_TYPES.has(candidate.type) ||
      typeof candidate.toolId !== 'string' ||
      candidate.toolId.length === 0 ||
      typeof candidate.messageId !== 'string' ||
      candidate.messageId.length === 0 ||
      typeof candidate.timestamp !== 'number' ||
      !Number.isFinite(candidate.timestamp)
    ) {
      return false;
    }

    if (
      candidate.replyTo !== undefined &&
      (typeof candidate.replyTo !== 'string' || candidate.replyTo.length === 0)
    ) {
      return false;
    }

    // 检查版本
    if (candidate.version !== '1.0') {
      console.warn(
        '[ToolCommunication] Unsupported message version:',
        candidate.version
      );
      return false;
    }

    const registration = this.registeredIframes.get(candidate.toolId);
    const iframe = registration?.iframe;
    const expectedOrigin = iframe
      ? this.resolveIframeTargetOrigin(iframe)
      : null;
    if (
      !registration ||
      !iframe?.contentWindow ||
      !iframe.isConnected ||
      event.source !== iframe.contentWindow ||
      !expectedOrigin ||
      event.origin !== expectedOrigin
    ) {
      console.warn(
        '[ToolCommunication] Rejected message from untrusted tool frame:',
        candidate.toolId
      );
      return false;
    }

    if (candidate.replyTo) {
      const pending = this.pendingMessages.get(candidate.replyTo);
      if (!pending || pending.message.toolId !== candidate.toolId) {
        console.warn(
          '[ToolCommunication] Rejected unmatched tool reply:',
          candidate.toolId
        );
        return false;
      }
    }

    if (!candidate.replyTo && candidate.type !== ToolMessageType.TOOL_TO_BOARD_READY) {
      const capability = INBOUND_CAPABILITY_BY_TYPE[candidate.type];
      if (!capability || !registration.capabilities.has(capability)) {
        console.warn(
          '[ToolCommunication] Rejected unauthorized tool capability:',
          candidate.type
        );
        return false;
      }
    }

    if (!candidate.replyTo && !isValidInboundPayload(candidate.type, candidate.payload)) {
      console.warn(
        '[ToolCommunication] Rejected invalid tool payload:',
        candidate.type
      );
      return false;
    }

    return true;
  }

  private getProcessedMessageKey(
    message: Pick<ToolMessage, 'toolId' | 'messageId'>
  ): string {
    return `${message.toolId}:${message.messageId}`;
  }

  /**
   * 生成唯一消息 ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取工具 iframe
   */
  private resolveIframeTargetOrigin(iframe: HTMLIFrameElement): string | null {
    try {
      const url = new URL(iframe.src, window.location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      const origin = url.origin;
      return origin === 'null' ? null : origin;
    } catch {
      return null;
    }
  }

  /**
   * 清理过期的消息 ID（防止内存泄漏）
   */
  private trimProcessedMessages(): void {
    if (this.processedMessageIds.size > ToolCommunicationService.MAX_PROCESSED_IDS) {
      const idsArray = Array.from(this.processedMessageIds);
      this.processedMessageIds = new Set(
        idsArray.slice(-ToolCommunicationService.MAX_PROCESSED_IDS)
      );
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    window.removeEventListener('message', this.handleMessage);

    // 清理所有 pending 消息
    this.pendingMessages.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Service destroyed'));
    });

    this.pendingMessages.clear();
    this.messageHandlers.clear();
    this.processedMessageIds.clear();
    this.registeredIframes.clear();
  }
}

/**
 * 工具通信服务的便捷方法
 */
export class ToolCommunicationHelper {
  private service: ToolCommunicationService;

  constructor(service: ToolCommunicationService) {
    this.service = service;
  }

  /**
   * 发送初始化消息
   */
  async initTool(toolId: string, payload: InitPayload): Promise<void> {
    await this.service.sendToTool(toolId, ToolMessageType.BOARD_TO_TOOL_INIT, payload);
  }

  /**
   * 处理工具插入文本请求
   */
  onInsertText(handler: (toolId: string, payload: InsertTextPayload) => void): void {
    this.service.on(ToolMessageType.TOOL_TO_BOARD_INSERT_TEXT, (message) => {
      if (isInsertTextPayload(message.payload)) {
        handler(message.toolId, message.payload);
      }
    });
  }

  /**
   * 处理工具插入图片请求
   */
  onInsertImage(handler: (toolId: string, payload: InsertImagePayload) => void): void {
    this.service.on(ToolMessageType.TOOL_TO_BOARD_INSERT_IMAGE, (message) => {
      if (isInsertImagePayload(message.payload)) {
        handler(message.toolId, message.payload);
      }
    });
  }

  /**
   * 处理工具就绪通知
   */
  onToolReady(handler: (toolId: string) => void): void {
    this.service.on(ToolMessageType.TOOL_TO_BOARD_READY, (message) => {
      handler(message.toolId);
    });
  }

  /**
   * 处理工具关闭请求
   */
  onToolClose(handler: (toolId: string) => void): void {
    this.service.on(ToolMessageType.TOOL_TO_BOARD_CLOSE, (message) => {
      handler(message.toolId);
    });
  }
}
