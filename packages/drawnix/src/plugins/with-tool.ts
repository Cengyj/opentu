/**
 * With Tool Plugin
 *
 * 工具插件 - 注册 ToolComponent 到 Plait
 */

import {
  PlaitBoard,
  PlaitPlugin,
  PlaitPluginElementContext,
  Point,
  RectangleClient,
  PlaitElement,
  Selection,
  ClipboardData,
  WritableClipboardContext,
  WritableClipboardOperationType,
  WritableClipboardType,
  addOrCreateClipboardContext,
  getSelectedElements,
} from '@plait/core';
import { buildClipboardData, insertClipboardData } from '@plait/common';
import { ToolComponent } from '../components/tool-element/tool.component';
import {
  isToolElement,
  ToolTransforms,
} from '../components/tool-element/tool.transforms';
import { PlaitTool } from '../types/toolbox.types';

/**
 * 判断点是否命中工具元素的标题栏或边缘（用于拖动）
 * 现在只有点击标题栏才算命中，iframe 区域不算命中
 */
function isHitToolElement(element: PlaitTool, point: Point): boolean {
  const rect = RectangleClient.getRectangleByPoints(element.points);
  const [x, y] = point;

  // 检查点是否在元素矩形范围内
  if (
    x < rect.x ||
    x > rect.x + rect.width ||
    y < rect.y ||
    y > rect.y + rect.height
  ) {
    return false;
  }

  // 标题栏高度（与 tool.generator.ts 中一致）
  const TITLEBAR_HEIGHT = 36;

  // 边缘检测范围（用于resize）
  const EDGE_THRESHOLD = 8;

  // 判断是否在标题栏区域
  const inTitleBar = y >= rect.y && y <= rect.y + TITLEBAR_HEIGHT;

  // 判断是否在边缘区域（用于 resize）
  const nearLeftEdge = x >= rect.x && x <= rect.x + EDGE_THRESHOLD;
  const nearRightEdge =
    x >= rect.x + rect.width - EDGE_THRESHOLD && x <= rect.x + rect.width;
  const nearTopEdge = y >= rect.y && y <= rect.y + EDGE_THRESHOLD;
  const nearBottomEdge =
    y >= rect.y + rect.height - EDGE_THRESHOLD && y <= rect.y + rect.height;
  const nearEdge =
    nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge;

  // 只有点击标题栏或边缘时才算命中（允许拖动和 resize）
  // iframe 内容区域不算命中，让 iframe 可以正常交互
  return inTitleBar || nearEdge;
}

/**
 * 判断矩形选框是否命中工具元素
 */
function isRectangleHitToolElement(
  element: PlaitTool,
  selection: Selection
): boolean {
  const rect = RectangleClient.getRectangleByPoints(element.points);
  const selectionRect = RectangleClient.getRectangleByPoints([
    selection.anchor,
    selection.focus,
  ]);
  return RectangleClient.isHit(rect, selectionRect);
}

/**
 * 工具插件
 *
 * 注册工具元素的渲染组件到 Plait 系统
 */
export const withTool: PlaitPlugin = (board: PlaitBoard) => {
  const {
    drawElement,
    getRectangle,
    isHit,
    isRectangleHit,
    isMovable,
    isAlign,
    getDeletedFragment,
    buildFragment,
    insertFragment,
  } = board;

  // 注册工具元素渲染组件
  board.drawElement = (context: PlaitPluginElementContext) => {
    if (context.element.type === 'tool') {
      return ToolComponent;
    }
    return drawElement(context);
  };

  // 注册 getRectangle 方法
  board.getRectangle = (element: PlaitElement) => {
    if (isToolElement(element)) {
      return RectangleClient.getRectangleByPoints(
        (element as PlaitTool).points
      );
    }
    return getRectangle(element);
  };

  // 注册 isHit 方法 - 判断点击是否命中元素
  board.isHit = (element: PlaitElement, point: Point, isStrict?: boolean) => {
    if (isToolElement(element)) {
      return isHitToolElement(element, point);
    }
    return isHit(element, point, isStrict);
  };

  // 注册 isRectangleHit 方法 - 判断矩形选框是否命中元素
  board.isRectangleHit = (element: PlaitElement, selection: Selection) => {
    if (isToolElement(element)) {
      return isRectangleHitToolElement(element, selection);
    }
    return isRectangleHit(element, selection);
  };

  // 注册 isMovable 方法 - 工具元素可移动
  board.isMovable = (element: PlaitElement) => {
    if (isToolElement(element)) {
      return true;
    }
    return isMovable(element);
  };

  // 注册 isAlign 方法 - 工具元素可对齐
  board.isAlign = (element: PlaitElement) => {
    if (isToolElement(element)) {
      return true;
    }
    return isAlign(element);
  };

  // 注册 getDeletedFragment 方法 - 支持删除工具元素
  board.getDeletedFragment = (data: PlaitElement[]) => {
    const toolElements = getSelectedToolElements(board);
    if (toolElements.length) {
      data.push(...toolElements);
      // console.log('Tool elements marked for deletion:', toolElements.length);
    }
    return getDeletedFragment(data);
  };

  // 注册 buildFragment 方法 - 支持复制工具元素
  board.buildFragment = (
    clipboardContext: WritableClipboardContext | null,
    rectangle: RectangleClient | null,
    operationType: WritableClipboardOperationType,
    originData?: PlaitElement[]
  ) => {
    const toolElements = getSelectedToolElements(board);
    if (toolElements.length) {
      const elements = buildClipboardData(
        board,
        toolElements,
        rectangle ? [rectangle.x, rectangle.y] : [0, 0]
      );
      clipboardContext = addOrCreateClipboardContext(clipboardContext, {
        text: '',
        type: WritableClipboardType.elements,
        elements,
      });
      // console.log('Tool elements added to clipboard:', toolElements.length);
    }
    return buildFragment(
      clipboardContext,
      rectangle,
      operationType,
      originData
    );
  };

  // 注册 insertFragment 方法 - 支持粘贴工具元素
  board.insertFragment = (
    clipboardData: ClipboardData | null,
    targetPoint: Point,
    operationType?: WritableClipboardOperationType
  ) => {
    const toolElements = clipboardData?.elements?.filter((value) =>
      isToolElement(value)
    ) as PlaitTool[];
    if (toolElements && toolElements.length > 0) {
      insertClipboardData(board, toolElements, targetPoint);
      // console.log('Tool elements pasted from clipboard:', toolElements.length);
    }
    insertFragment(clipboardData, targetPoint, operationType);
  };

  // console.log('withTool plugin initialized');
  return board;
};

export { isToolElement, ToolTransforms };

/**
 * 获取当前选中的工具元素
 */
function getSelectedToolElements(board: PlaitBoard): PlaitTool[] {
  const selectedElements = getSelectedElements(board);
  return selectedElements.filter(isToolElement) as PlaitTool[];
}
