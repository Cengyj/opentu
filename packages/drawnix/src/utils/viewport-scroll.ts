import {
  BoardTransforms,
  getViewportOrigination,
  PlaitBoard,
  type Point,
} from '@plait/core';

/**
 * Return whether a board-space point is visible inside the current viewport.
 */
export function isPointInViewport(
  board: PlaitBoard,
  point: Point,
  margin = 50
): boolean {
  try {
    const boardContainer = PlaitBoard.getBoardContainer(board);
    const containerRect = boardContainer.getBoundingClientRect();
    const zoom = board.viewport.zoom;
    const origination = getViewportOrigination(board);

    if (!origination) {
      return false;
    }

    const viewportLeft = origination[0] + margin / zoom;
    const viewportTop = origination[1] + margin / zoom;
    const viewportRight =
      origination[0] + (containerRect.width - margin) / zoom;
    const viewportBottom =
      origination[1] + (containerRect.height - margin) / zoom;

    return (
      point[0] >= viewportLeft &&
      point[0] <= viewportRight &&
      point[1] >= viewportTop &&
      point[1] <= viewportBottom
    );
  } catch (error) {
    console.warn('Error checking if point is in viewport:', error);
    return false;
  }
}

/** Center the board viewport on a board-space point. */
export function scrollToPoint(board: PlaitBoard, point: Point): void {
  try {
    const boardContainer = PlaitBoard.getBoardContainer(board);
    const containerRect = boardContainer.getBoundingClientRect();
    const zoom = board.viewport.zoom;
    const newOriginationX = point[0] - containerRect.width / (2 * zoom);
    const newOriginationY = point[1] - containerRect.height / (2 * zoom);

    BoardTransforms.updateViewport(
      board,
      [newOriginationX, newOriginationY],
      zoom
    );
  } catch (error) {
    console.warn('Error scrolling to point:', error);
  }
}

/** Center a board-space point only when it is outside the visible viewport. */
export function scrollToPointIfNeeded(
  board: PlaitBoard,
  point: Point,
  margin = 100
): void {
  if (!isPointInViewport(board, point, margin)) {
    scrollToPoint(board, point);
  }
}
