import { createTestingBoard, type PlaitBoard } from '@plait/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireToolCommunicationRuntime,
  ensureToolCommunicationRuntime,
  releaseToolCommunicationRuntime,
} from '../plugins/tool-communication-runtime';
import {
  ToolMessageType,
  type InitPayload,
  type ToolBridgeCapability,
  type ToolMessage,
} from '../types/tool-communication.types';
import { ToolCommunicationService } from './tool-communication-service';

interface StubToolIframe extends HTMLIFrameElement {
  contentWindow: Window;
}

function createIframe(src = 'https://trusted-tool.example/app'): {
  iframe: StubToolIframe;
  postMessage: ReturnType<typeof vi.fn>;
} {
  const postMessage = vi.fn();
  const contentWindow = { postMessage } as unknown as Window;
  const iframe = {
    src,
    contentWindow,
    isConnected: true,
  } as StubToolIframe;
  return { iframe, postMessage };
}

function createInboundMessage(
  overrides: Partial<ToolMessage> = {}
): ToolMessage {
  return {
    version: '1.0',
    type: ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE,
    toolId: 'tool-secure',
    messageId: 'message-secure',
    timestamp: Date.now(),
    payload: { prompt: 'security contract' },
    ...overrides,
  };
}

function dispatchToolMessage(
  source: Window,
  origin: string,
  message: ToolMessage
): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: message,
      origin,
      source,
    })
  );
}

describe('ToolCommunicationService iframe trust boundary', () => {
  const services: ToolCommunicationService[] = [];

  function createService(): ToolCommunicationService {
    const service = new ToolCommunicationService(
      createTestingBoard([], []) as PlaitBoard
    );
    services.push(service);
    return service;
  }

  function registerIframe(
    service: ToolCommunicationService,
    capabilities: readonly ToolBridgeCapability[] = [],
    toolId = 'tool-secure',
    src?: string
  ) {
    const fixture = createIframe(src);
    service.registerToolIframe(toolId, fixture.iframe, capabilities);
    return fixture;
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    services.splice(0).forEach((service) => service.destroy());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects a forged source without consuming its messageId', () => {
    const service = createService();
    const { iframe } = registerIframe(service, ['generate-image']);
    const createTask = vi.fn();
    const handler = vi.fn(() => createTask());
    service.on(ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE, handler);
    const message = createInboundMessage({ messageId: 'reusable-after-forgery' });

    dispatchToolMessage(
      { postMessage: vi.fn() } as unknown as Window,
      'https://trusted-tool.example',
      message
    );

    expect(handler).not.toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();

    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      message
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('rejects the right iframe window when the origin is not exact', () => {
    const service = createService();
    const { iframe } = registerIframe(service, ['generate-image']);
    const createTask = vi.fn();
    const handler = vi.fn(() => createTask());
    service.on(ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE, handler);

    dispatchToolMessage(
      iframe.contentWindow,
      'https://attacker.example',
      createInboundMessage({ messageId: 'wrong-origin' })
    );

    expect(handler).not.toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();
  });

  it('rejects a valid frame without the requested capability before task code', () => {
    const service = createService();
    const { iframe } = registerIframe(service);
    const createTask = vi.fn();
    const handler = vi.fn(() => createTask());
    service.on(ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE, handler);

    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      createInboundMessage({ messageId: 'unauthorized-capability' })
    );

    expect(handler).not.toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();
  });

  it.each<[
    ToolMessageType,
    ToolBridgeCapability,
    Record<string, unknown>,
  ]>([
    [ToolMessageType.TOOL_TO_BOARD_INSERT_TEXT, 'insert-text', { text: 42 }],
    [ToolMessageType.TOOL_TO_BOARD_INSERT_IMAGE, 'insert-image', { url: 42 }],
    [
      ToolMessageType.TOOL_TO_BOARD_REQUEST_DATA,
      'request-data',
      { dataType: 'provider-credentials' },
    ],
    [
      ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE,
      'generate-image',
      { prompt: 42 },
    ],
  ])('rejects invalid %s payloads after capability authentication', (
    type,
    capability,
    payload
  ) => {
    const service = createService();
    const { iframe } = registerIframe(service, [capability]);
    const handler = vi.fn();
    service.on(type, handler);

    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      createInboundMessage({
        type,
        messageId: `invalid-payload-${type}`,
        payload,
      })
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it('executes an authorized capability exactly once', () => {
    const service = createService();
    const { iframe } = registerIframe(service, ['generate-image']);
    const createTask = vi.fn();
    const handler = vi.fn(() => createTask());
    service.on(ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE, handler);
    const message = createInboundMessage({ messageId: 'authorized-once' });

    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      message
    );
    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      message
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('scopes authenticated message IDs to the registered tool identity', () => {
    const service = createService();
    const first = registerIframe(
      service,
      ['generate-image'],
      'first-tool',
      'https://first-tool.example/app'
    );
    const second = registerIframe(
      service,
      ['generate-image'],
      'second-tool',
      'https://second-tool.example/app'
    );
    const handler = vi.fn();
    service.on(ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE, handler);

    dispatchToolMessage(
      first.iframe.contentWindow,
      'https://first-tool.example',
      createInboundMessage({
        toolId: 'first-tool',
        messageId: 'shared-envelope-id',
      })
    );
    dispatchToolMessage(
      second.iframe.contentWindow,
      'https://second-tool.example',
      createInboundMessage({
        toolId: 'second-tool',
        messageId: 'shared-envelope-id',
      })
    );

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('sends only to the iframe URL exact origin', async () => {
    const service = createService();
    const { postMessage } = registerIframe(
      service,
      [],
      'tool-secure',
      'https://trusted-tool.example:8443/path?mode=embedded'
    );

    await service.sendToTool(
      'tool-secure',
      ToolMessageType.BOARD_TO_TOOL_DATA,
      { ready: true }
    );

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ToolMessageType.BOARD_TO_TOOL_DATA,
        toolId: 'tool-secure',
      }),
      'https://trusted-tool.example:8443'
    );
    expect(postMessage.mock.calls[0][1]).not.toBe('*');
  });

  it.each([
    'blob:https://trusted-tool.example/bridge-object',
    'data:text/html,<script>postMessage(1)</script>',
    ['java', 'script:postMessage(1)'].join(''),
  ])('refuses to register a non-http(s) iframe URL: %s', async (src) => {
    const service = createService();
    const { iframe } = createIframe(src);

    expect(() =>
      service.registerToolIframe('tool-secure', iframe, ['generate-image'])
    ).toThrow(`Unsupported tool iframe URL: ${src}`);
    expect(service.isToolConnected('tool-secure')).toBe(false);
    await expect(
      service.sendToTool(
        'tool-secure',
        ToolMessageType.BOARD_TO_TOOL_DATA,
        { ignored: true }
      )
    ).rejects.toThrow('Tool iframe not found: tool-secure');
  });

  it('does not let another registered tool forge a pending reply', async () => {
    const service = createService();
    const target = registerIframe(
      service,
      [],
      'target-tool',
      'https://target-tool.example/app'
    );
    const attacker = registerIframe(
      service,
      [],
      'attacker-tool',
      'https://attacker-tool.example/app'
    );
    const pending = service.sendToTool(
      'target-tool',
      ToolMessageType.BOARD_TO_TOOL_DATA,
      { request: true },
      { expectReply: true, timeout: 1000 }
    );
    const outbound = target.postMessage.mock.calls[0][0] as ToolMessage;

    dispatchToolMessage(
      attacker.iframe.contentWindow,
      'https://attacker-tool.example',
      createInboundMessage({
        type: ToolMessageType.BOARD_TO_TOOL_DATA,
        toolId: 'attacker-tool',
        messageId: 'forged-reply',
        replyTo: outbound.messageId,
      })
    );

    const legitimateReply = createInboundMessage({
      type: ToolMessageType.BOARD_TO_TOOL_DATA,
      toolId: 'target-tool',
      messageId: 'legitimate-reply',
      replyTo: outbound.messageId,
      payload: { accepted: true },
    });
    dispatchToolMessage(
      target.iframe.contentWindow,
      'https://target-tool.example',
      legitimateReply
    );

    await expect(pending).resolves.toEqual(legitimateReply);
  });

  it('keeps authenticated message dedupe state synchronously bounded', () => {
    const service = createService();
    const { iframe } = registerIframe(service, ['generate-image']);
    const handler = vi.fn();
    service.on(ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE, handler);

    for (let index = 0; index <= 1000; index += 1) {
      dispatchToolMessage(
        iframe.contentWindow,
        'https://trusted-tool.example',
        createInboundMessage({ messageId: `bounded-${index}` })
      );
    }

    expect(handler).toHaveBeenCalledTimes(1001);

    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      createInboundMessage({ messageId: 'bounded-0' })
    );
    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      createInboundMessage({ messageId: 'bounded-1000' })
    );

    expect(handler).toHaveBeenCalledTimes(1002);
  });

  it('stops accepting messages after destroy removes the listener', () => {
    const service = createService();
    const { iframe } = registerIframe(service, ['generate-image']);
    const handler = vi.fn();
    service.on(ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE, handler);

    service.destroy();

    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      createInboundMessage({ messageId: 'after-destroy' })
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it('initializes one board bridge and sends board:init without provider credentials', () => {
    const board = createTestingBoard([], []) as PlaitBoard & { id?: string };
    board.id = 'board-without-credentials';
    const runtime = ensureToolCommunicationRuntime(board);
    const repeatedRuntime = ensureToolCommunicationRuntime(board);
    const service = runtime.service;

    expect(repeatedRuntime).toBe(runtime);
    expect(service).toBeInstanceOf(ToolCommunicationService);
    services.push(service);
    const { iframe, postMessage } = registerIframe(service, [], 'tool-secure');

    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      createInboundMessage({
        type: ToolMessageType.TOOL_TO_BOARD_READY,
        messageId: 'tool-ready',
        payload: {},
      })
    );

    expect(postMessage).toHaveBeenCalledTimes(1);
    const [message, targetOrigin] = postMessage.mock.calls[0] as [
      ToolMessage<InitPayload>,
      string,
    ];
    expect(targetOrigin).toBe('https://trusted-tool.example');
    expect(message.type).toBe(ToolMessageType.BOARD_TO_TOOL_INIT);
    expect(message.payload).toEqual({
      boardId: 'board-without-credentials',
      theme: 'light',
    });
    expect(message.payload).not.toHaveProperty('config');
    expect(JSON.stringify(message.payload)).not.toMatch(
      /apiKey|api_key|baseUrl|authorization/i
    );
  });

  it('shares one board listener and destroys it only after the last generator releases it', () => {
    const board = createTestingBoard([], []);
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const firstRuntime = acquireToolCommunicationRuntime(board);
    const secondRuntime = acquireToolCommunicationRuntime(board);
    const destroy = vi.spyOn(firstRuntime.service, 'destroy');
    services.push(firstRuntime.service);

    expect(secondRuntime).toBe(firstRuntime);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'message')
    ).toHaveLength(1);

    releaseToolCommunicationRuntime(board, firstRuntime);
    expect(destroy).not.toHaveBeenCalled();
    expect(ensureToolCommunicationRuntime(board)).toBe(firstRuntime);

    releaseToolCommunicationRuntime(board, secondRuntime);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(
      removeEventListener.mock.calls.filter(([type]) => type === 'message')
    ).toHaveLength(1);

    const replacementRuntime = acquireToolCommunicationRuntime(board);
    services.push(replacementRuntime.service);
    expect(replacementRuntime).not.toBe(firstRuntime);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'message')
    ).toHaveLength(2);

    // A stale release must not tear down the replacement runtime.
    releaseToolCommunicationRuntime(board, firstRuntime);
    expect(ensureToolCommunicationRuntime(board)).toBe(replacementRuntime);
    releaseToolCommunicationRuntime(board, replacementRuntime);
  });

  it('rejects a detached registered iframe even before explicit unregister', () => {
    const service = createService();
    const { iframe } = registerIframe(service, ['generate-image']);
    const handler = vi.fn();
    service.on(ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE, handler);
    Object.defineProperty(iframe, 'isConnected', {
      configurable: true,
      value: false,
    });

    dispatchToolMessage(
      iframe.contentWindow,
      'https://trusted-tool.example',
      createInboundMessage({ messageId: 'detached-frame' })
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
