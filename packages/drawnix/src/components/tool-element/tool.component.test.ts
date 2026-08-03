import { createTestingBoard, type PlaitPluginElementContext } from '@plait/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitTool } from '../../types/toolbox.types';
import { ToolComponent } from './tool.component';

const mocks = vi.hoisted(() => ({
  generatorConstructor: vi.fn(),
  canDraw: vi.fn(),
  draw: vi.fn(),
  updateImage: vi.fn(),
  destroyGenerator: vi.fn(),
  registerGenerator: vi.fn(),
  unregisterGenerator: vi.fn(),
}));

vi.mock('./tool.generator', () => ({
  ToolGenerator: class MockToolGenerator {
    constructor() {
      mocks.generatorConstructor();
    }

    canDraw = mocks.canDraw;
    draw = mocks.draw;
    updateImage = mocks.updateImage;
    destroy = mocks.destroyGenerator;
  },
}));

vi.mock('../../plugins/with-tool-focus', () => ({
  registerToolGenerator: mocks.registerGenerator,
  unregisterToolGenerator: mocks.unregisterGenerator,
}));

function createTool(): PlaitTool {
  return {
    id: 'lazy-tool-element',
    type: 'tool',
    toolId: 'lazy-tool',
    url: '/tools/lazy-tool.html',
    points: [
      [10, 20],
      [410, 320],
    ],
    angle: 0,
  };
}

describe('ToolComponent lazy renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canDraw.mockReturnValue(true);
    mocks.draw.mockImplementation(() =>
      document.createElementNS('http://www.w3.org/2000/svg', 'g')
    );
  });

  it('loads and registers the existing renderer only after a tool element initializes', async () => {
    const element = createTool();
    const board = createTestingBoard([], [element]);
    const component = new ToolComponent();
    component.context = {
      board,
      element,
      selected: false,
      hasThemeChanged: false,
    } as PlaitPluginElementContext<PlaitTool>;

    component.initialize();

    expect(mocks.generatorConstructor).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(mocks.generatorConstructor).toHaveBeenCalledTimes(1);
    });

    expect(mocks.canDraw).toHaveBeenCalledWith(element);
    expect(mocks.draw).toHaveBeenCalledWith(element);
    expect(mocks.registerGenerator).toHaveBeenCalledWith(
      board,
      element.id,
      component.toolGenerator
    );
    expect(
      component.getElementG().querySelector('g')
    ).not.toBeNull();

    component.destroy();

    expect(mocks.unregisterGenerator).toHaveBeenCalledWith(board, element.id);
    expect(mocks.destroyGenerator).toHaveBeenCalledTimes(1);
  });

  it('does not create or register a renderer after the component is destroyed', async () => {
    const element = createTool();
    const board = createTestingBoard([], [element]);
    const component = new ToolComponent();
    component.context = {
      board,
      element,
      selected: false,
      hasThemeChanged: false,
    } as PlaitPluginElementContext<PlaitTool>;

    component.initialize();
    component.destroy();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(mocks.generatorConstructor).not.toHaveBeenCalled();
    expect(mocks.registerGenerator).not.toHaveBeenCalled();
    expect(mocks.draw).not.toHaveBeenCalled();
    expect(mocks.unregisterGenerator).toHaveBeenCalledWith(board, element.id);
  });

  it('retries after synchronous renderer runtime initialization fails', async () => {
    const error = new Error('bridge runtime initialization failed');
    mocks.generatorConstructor.mockImplementationOnce(() => {
      throw error;
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const element = createTool();
    const board = createTestingBoard([], [element]);
    const context = {
      board,
      element,
      selected: false,
      hasThemeChanged: false,
    } as PlaitPluginElementContext<PlaitTool>;
    const component = new ToolComponent();
    component.context = context;

    component.initialize();
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        `[ToolComponent] Failed to load tool renderer for ${element.id}:`,
        error
      );
    });

    expect(component.toolGenerator).toBeUndefined();
    expect(mocks.registerGenerator).not.toHaveBeenCalled();

    component.onContextChanged(context, context);
    await vi.waitFor(() => {
      expect(mocks.generatorConstructor).toHaveBeenCalledTimes(2);
    });

    expect(mocks.registerGenerator).toHaveBeenCalledTimes(1);
    expect(mocks.draw).toHaveBeenCalledTimes(1);
    component.destroy();
    consoleError.mockRestore();
  });
});
