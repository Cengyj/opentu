// @vitest-environment jsdom

import type { PlaitBoard } from '@plait/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitTool, ToolDefinition } from '../../types/toolbox.types';
import { ToolGenerator } from './tool.generator';

const mocks = vi.hoisted(() => ({
  processedUrl: null as string | null,
  manifest: null as ToolDefinition | null,
  acquireCommunicationRuntime: vi.fn(),
  releaseCommunicationRuntime: vi.fn(),
  registerToolIframe: vi.fn(),
  unregisterToolIframe: vi.fn(),
  runtimeEvents: [] as string[],
}));

const BASE_URL_TEMPLATE = ['$', '{baseUrl}'].join('');
const JAVASCRIPT_URL = ['java', 'script:alert(document.domain)'].join('');

vi.mock('../startup/ToolProviderWrapper', () => ({
  ToolProviderWrapper: ({ children }: { children: unknown }) => children,
}));

vi.mock('./tool.transforms', () => ({
  ToolTransforms: {
    removeTool: vi.fn(),
  },
}));

vi.mock('../../services/tool-window-service', () => ({
  toolWindowService: {
    openTool: vi.fn(),
  },
}));

vi.mock('../../utils/url-template', () => ({
  hasTemplateVariables: (url: string) => /\$\{\w+\}/.test(url),
  processToolUrl: (url: string) => ({
    url: mocks.processedUrl ?? url,
    missingVariables: [],
  }),
}));

vi.mock('../../tools/registry', () => ({
  toolRegistry: {
    getManifestById: (toolId: string) =>
      mocks.manifest?.id === toolId ? mocks.manifest : null,
    resolveInternalComponent: () => null,
  },
}));

vi.mock('../../plugins/tool-communication-runtime', () => ({
  acquireToolCommunicationRuntime: (board: PlaitBoard) => {
    mocks.runtimeEvents.push('acquire');
    mocks.acquireCommunicationRuntime(board);
    return {
      service: {
        registerToolIframe: (...args: unknown[]) => {
          mocks.runtimeEvents.push('register');
          mocks.registerToolIframe(...args);
        },
        unregisterToolIframe: mocks.unregisterToolIframe,
      },
      helper: {},
    };
  },
  releaseToolCommunicationRuntime: (...args: unknown[]) => {
    mocks.runtimeEvents.push('release');
    mocks.releaseCommunicationRuntime(...args);
  },
}));

function createTool(
  url: string,
  id = 'external-tool',
  toolId = 'custom-external-tool'
): PlaitTool {
  return {
    id,
    type: 'tool',
    toolId,
    url,
    points: [
      [0, 0],
      [400, 300],
    ],
    angle: 0,
    metadata: {
      name: 'External tool',
    },
  };
}

function createGenerator(element: PlaitTool): ToolGenerator {
  const board = {
    children: [element],
  } as unknown as PlaitBoard;
  return new ToolGenerator(board);
}

function drawIframe(generator: ToolGenerator, element: PlaitTool) {
  const group = generator.draw(element);
  const iframe = group.querySelector('iframe');
  expect(iframe).toBeInstanceOf(HTMLIFrameElement);
  return iframe as HTMLIFrameElement;
}

describe('ToolGenerator external URL render boundary', () => {
  const generators: ToolGenerator[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.processedUrl = null;
    mocks.manifest = null;
    mocks.runtimeEvents.splice(0);
  });

  afterEach(() => {
    generators.splice(0).forEach((generator) => generator.destroy());
  });

  it('initializes the bridge synchronously before registering an iframe', () => {
    const element = createTool('https://tools.example.test/app');
    const generator = createGenerator(element);
    generators.push(generator);

    expect(mocks.acquireCommunicationRuntime).toHaveBeenCalledTimes(1);
    expect(mocks.registerToolIframe).not.toHaveBeenCalled();

    drawIframe(generator, element);

    expect(mocks.runtimeEvents).toEqual(['acquire', 'register']);
  });

  it.each([
    JAVASCRIPT_URL,
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'blob:https://tools.example.test/unsafe',
    'https://[invalid-host',
  ])('does not assign iframe src for an unsafe canvas tool URL: %s', (url) => {
    const element = createTool(url);
    const generator = createGenerator(element);
    generators.push(generator);

    const iframe = drawIframe(generator, element);

    expect(iframe.getAttribute('src')).toBeNull();
    expect(iframe.hidden).toBe(true);
    expect(iframe.dataset.externalToolUrlError).toBeTruthy();
    expect(mocks.registerToolIframe).not.toHaveBeenCalled();
  });

  it.each([
    ['HTTPS', 'https://tools.example.test/app', '/app'],
    ['HTTP', 'http://tools.example.test/app', '/app'],
    ['relative', '/tools/local-tool.html', '/tools/local-tool.html'],
  ])('assigns a resolved %s iframe URL and tool identity', (_label, url, path) => {
    const element = createTool(url, 'canvas-tool-id');
    const generator = createGenerator(element);
    generators.push(generator);

    const iframe = drawIframe(generator, element);
    const resolved = new URL(iframe.src);

    expect(resolved.pathname).toBe(path);
    expect(resolved.searchParams.get('toolId')).toBe(element.id);
    expect(['http:', 'https:']).toContain(resolved.protocol);
    expect(iframe.hidden).toBe(false);
    expect(mocks.registerToolIframe).toHaveBeenCalledWith(
      element.id,
      iframe,
      []
    );
  });

  it('removes src and bridge registration when a template refresh resolves to an unsafe protocol', () => {
    const element = createTool(`${BASE_URL_TEMPLATE}/tool`, 'template-tool-id');
    mocks.processedUrl = 'https://tools.example.test/tool';
    const generator = createGenerator(element);
    generators.push(generator);
    const iframe = drawIframe(generator, element);
    expect(iframe.getAttribute('src')).toContain(
      'https://tools.example.test/tool'
    );
    expect(mocks.registerToolIframe).toHaveBeenCalledTimes(1);

    mocks.processedUrl = JAVASCRIPT_URL;
    window.dispatchEvent(new Event('gemini-settings-changed'));

    expect(iframe.getAttribute('src')).toBeNull();
    expect(iframe.hidden).toBe(true);
    expect(iframe.dataset.externalToolUrlError).toBe(
      'UNSUPPORTED_PROTOCOL'
    );
    expect(mocks.unregisterToolIframe).toHaveBeenCalledWith(
      element.id,
      iframe
    );
    expect(mocks.registerToolIframe).toHaveBeenCalledTimes(1);
  });

  it('unregisters the previous trusted iframe before a URL update becomes invalid', () => {
    const previous = createTool(
      'https://tools.example.test/app',
      'updated-tool-id'
    );
    const generator = createGenerator(previous);
    generators.push(generator);
    const group = generator.draw(previous);
    const previousIframe = generator.getIframe(previous.id);
    const current = createTool(JAVASCRIPT_URL, previous.id, previous.toolId);

    expect(previousIframe).toBeInstanceOf(HTMLIFrameElement);
    generator.updateImage(group, previous, current);

    const currentIframe = generator.getIframe(previous.id);
    expect(mocks.unregisterToolIframe).toHaveBeenCalledWith(
      previous.id,
      previousIframe
    );
    expect(previousIframe?.src).toBe('about:blank');
    expect(currentIframe).not.toBe(previousIframe);
    expect(currentIframe?.getAttribute('src')).toBeNull();
    expect(currentIframe?.hidden).toBe(true);
  });

  it('unregisters and drops an iframe when an element changes to an internal component', () => {
    const previous = createTool(
      'https://tools.example.test/app',
      'component-tool-id'
    );
    const generator = createGenerator(previous);
    generators.push(generator);
    const group = generator.draw(previous);
    const previousIframe = generator.getIframe(previous.id);
    const current: PlaitTool = {
      ...previous,
      url: undefined,
      component: 'internal-tool-component',
    };

    generator.updateImage(group, previous, current);

    expect(mocks.unregisterToolIframe).toHaveBeenCalledWith(
      previous.id,
      previousIframe
    );
    expect(previousIframe?.src).toBe('about:blank');
    expect(generator.getIframe(previous.id)).toBeUndefined();
    expect(group.querySelector('iframe')).toBeNull();
  });

  it('re-registers bridge capabilities when the manifest identity changes', () => {
    const previous = createTool(
      'https://tools.example.test/app',
      'identity-tool-id',
      'trusted-tool'
    );
    mocks.manifest = {
      id: 'trusted-tool',
      name: 'Trusted tool',
      url: previous.url,
      bridgeCapabilities: ['generate-image'],
    };
    const board = { children: [previous] } as unknown as PlaitBoard;
    const generator = new ToolGenerator(board);
    generators.push(generator);
    const group = generator.draw(previous);
    const previousIframe = generator.getIframe(previous.id);
    const current = { ...previous, toolId: 'custom-tool' };
    board.children = [current];

    generator.updateImage(group, previous, current);

    expect(mocks.unregisterToolIframe).toHaveBeenCalledWith(
      previous.id,
      previousIframe
    );
    expect(mocks.registerToolIframe).toHaveBeenLastCalledWith(
      current.id,
      generator.getIframe(current.id),
      []
    );
  });

  it('releases bridge ownership exactly once when a generator is destroyed', () => {
    const element = createTool('https://tools.example.test/app');
    const board = { children: [element] } as unknown as PlaitBoard;
    const generator = new ToolGenerator(board);

    generator.destroy();
    generator.destroy();

    expect(mocks.releaseCommunicationRuntime).toHaveBeenCalledTimes(1);
    expect(mocks.releaseCommunicationRuntime).toHaveBeenCalledWith(
      board,
      expect.objectContaining({ service: expect.any(Object) })
    );
  });

  it('grants manifest capabilities only when the persisted iframe definition matches', () => {
    mocks.manifest = {
      id: 'trusted-iframe-tool',
      name: 'Trusted iframe tool',
      url: 'https://trusted-tool.example/app',
      bridgeCapabilities: ['generate-image'],
    };
    const element = createTool(
      'https://trusted-tool.example/app',
      'trusted-element',
      'trusted-iframe-tool'
    );
    const generator = createGenerator(element);
    generators.push(generator);

    const iframe = drawIframe(generator, element);

    expect(mocks.registerToolIframe).toHaveBeenCalledWith(
      element.id,
      iframe,
      ['generate-image']
    );
  });

  it('does not grant capabilities to imported data that only reuses a built-in id', () => {
    mocks.manifest = {
      id: 'trusted-iframe-tool',
      name: 'Trusted iframe tool',
      url: 'https://trusted-tool.example/app',
      bridgeCapabilities: ['generate-image', 'insert-image'],
    };
    const element = createTool(
      'https://attacker.example/spoofed-tool',
      'imported-spoof',
      'trusted-iframe-tool'
    );
    const generator = createGenerator(element);
    generators.push(generator);

    const iframe = drawIframe(generator, element);

    expect(mocks.registerToolIframe).toHaveBeenCalledWith(
      element.id,
      iframe,
      []
    );
  });
});
