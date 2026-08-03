import type { PlaitBoard, Point } from '@plait/core';
import {
  ToolCommunicationHelper,
  ToolCommunicationService,
} from '../services/tool-communication-service';
import {
  ToolMessageType,
  type InsertImagePayload,
} from '../types/tool-communication.types';
import { ToolTransforms } from '../components/tool-element/tool.transforms';
import { createToolImageGenerationMessageHandler } from './tool-image-generation-handler';

export interface ToolCommunicationRuntime {
  readonly service: ToolCommunicationService;
  readonly helper: ToolCommunicationHelper;
}

interface ToolCommunicationBoard extends PlaitBoard {
  __toolCommunicationRuntime?: ToolCommunicationRuntime;
}

const runtimeConsumerCounts = new WeakMap<
  ToolCommunicationRuntime,
  { count: number }
>();

function setupCommunicationHandlers(
  board: PlaitBoard,
  helper: ToolCommunicationHelper,
  service: ToolCommunicationService
): void {
  helper.onToolReady((toolId) => {
    void helper
      .initTool(toolId, {
        boardId:
          (board as PlaitBoard & { id?: string }).id || 'default-board',
        theme: 'light',
      })
      .catch((error: unknown) => {
        console.error(
          `[ToolCommunication] Tool initialization failed for ${toolId}:`,
          error
        );
      });
  });

  helper.onInsertText(() => {
    // Text insertion is not implemented yet. Keeping the registered handler
    // makes the capability boundary explicit without exposing board state.
  });

  helper.onInsertImage(async (toolId, payload: InsertImagePayload) => {
    if (!payload.url) {
      console.error(`[ToolCommunication] Missing image URL from ${toolId}`);
      return;
    }

    try {
      const { insertImageFromUrlAndSelect } = await import('../data/image');
      let insertPoint: Point;
      if (payload.position && payload.position.length === 2) {
        insertPoint = payload.position;
      } else {
        const viewportRect = board.viewport?.viewBox;
        insertPoint = viewportRect
          ? [
              viewportRect.x +
                viewportRect.width / 2 -
                (payload.width || 200) / 2,
              viewportRect.y +
                viewportRect.height / 2 -
                (payload.height || 200) / 2,
            ]
          : [100, 100];
      }

      await insertImageFromUrlAndSelect(
        board,
        payload.url,
        insertPoint,
        payload.width && payload.height
          ? { width: payload.width, height: payload.height }
          : undefined
      );
    } catch (error: unknown) {
      console.error(
        `[ToolCommunication] Failed to insert image from ${toolId}:`,
        error
      );
    }
  });

  helper.onToolClose((toolId) => {
    const element = ToolTransforms.getToolById(board, toolId);
    if (element) {
      ToolTransforms.removeTool(board, element.id);
    }
  });

  service.on(
    ToolMessageType.TOOL_TO_BOARD_GENERATE_IMAGE,
    createToolImageGenerationMessageHandler(service)
  );
}

/**
 * Initializes the board-scoped iframe bridge synchronously and exactly once.
 * The runtime is loaded with the lazy ToolGenerator chunk, so it is absent
 * from the application startup graph. Failed setup is fully cleaned up and a
 * later ToolGenerator construction can retry without leaving two listeners.
 */
export function ensureToolCommunicationRuntime(
  board: PlaitBoard
): ToolCommunicationRuntime {
  const communicationBoard = board as ToolCommunicationBoard;
  if (communicationBoard.__toolCommunicationRuntime) {
    return communicationBoard.__toolCommunicationRuntime;
  }

  const service = new ToolCommunicationService(board);
  try {
    const helper = new ToolCommunicationHelper(service);
    setupCommunicationHandlers(board, helper, service);
    const runtime = Object.freeze({ service, helper });
    communicationBoard.__toolCommunicationRuntime = runtime;
    runtimeConsumerCounts.set(runtime, { count: 0 });
    return runtime;
  } catch (error: unknown) {
    service.destroy();
    throw error;
  }
}

/**
 * Acquires the board-scoped bridge for one live ToolGenerator. Keeping the
 * reference count next to the lazy runtime lets the last rendered tool release
 * the global message listener without creating one service per iframe.
 */
export function acquireToolCommunicationRuntime(
  board: PlaitBoard
): ToolCommunicationRuntime {
  const runtime = ensureToolCommunicationRuntime(board);
  const consumers = runtimeConsumerCounts.get(runtime) || { count: 0 };
  consumers.count += 1;
  runtimeConsumerCounts.set(runtime, consumers);
  return runtime;
}

/**
 * Releases one live ToolGenerator's bridge ownership. A runtime argument keeps
 * a late/double release from destroying a newer runtime created for the board.
 */
export function releaseToolCommunicationRuntime(
  board: PlaitBoard,
  runtime: ToolCommunicationRuntime
): void {
  const communicationBoard = board as ToolCommunicationBoard;
  if (communicationBoard.__toolCommunicationRuntime !== runtime) {
    return;
  }

  const consumers = runtimeConsumerCounts.get(runtime);
  if (!consumers || consumers.count <= 0) {
    return;
  }

  consumers.count -= 1;
  if (consumers.count > 0) {
    return;
  }

  runtime.service.destroy();
  runtimeConsumerCounts.delete(runtime);
  delete communicationBoard.__toolCommunicationRuntime;
}
