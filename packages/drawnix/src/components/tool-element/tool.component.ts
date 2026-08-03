/**
 * Tool Component
 *
 * 工具元素组件
 * 继承 CommonElementFlavour，集成到 Plait 渲染流程
 */

import {
  PlaitBoard,
  PlaitPluginElementContext,
  OnContextChanged,
  RectangleClient,
  ACTIVE_STROKE_WIDTH,
} from '@plait/core';
import {
  CommonElementFlavour,
  ActiveGenerator,
  createActiveGenerator,
  hasResizeHandle,
} from '@plait/common';
import { PlaitTool } from '../../types/toolbox.types';
import type { ToolGenerator } from './tool.generator';
import {
  registerToolGenerator,
  unregisterToolGenerator,
} from '../../plugins/with-tool-focus';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';

interface ToolGeneratorRuntime {
  ToolGenerator: typeof import('./tool.generator').ToolGenerator;
}

const loadToolGeneratorRuntime = createRetriableModuleLoader(
  (): Promise<ToolGeneratorRuntime> => import('./tool.generator')
);

/**
 * 工具元素组件
 *
 * 负责在画布上渲染工具元素，并响应元素变化
 */
export class ToolComponent
  extends CommonElementFlavour<PlaitTool, PlaitBoard>
  implements OnContextChanged<PlaitTool, PlaitBoard>
{
  toolGenerator?: ToolGenerator;
  activeGenerator!: ActiveGenerator<PlaitTool>;
  private renderedG?: SVGGElement;
  private generatorLoadAttempt: Promise<void> | null = null;
  private destroyed = false;

  /**
   * 初始化生成器
   */
  initializeGenerator(): void {
    // 初始化选中状态生成器
    this.activeGenerator = createActiveGenerator(this.board, {
      getRectangle: (element: PlaitTool) => {
        // 从 points 计算矩形边界
        return RectangleClient.getRectangleByPoints(element.points);
      },
      getStrokeWidth: () => ACTIVE_STROKE_WIDTH,
      getStrokeOpacity: () => 1,
      hasResizeHandle: () => {
        return hasResizeHandle(this.board, this.element);
      },
    });
  }

  private drawToolElement(): void {
    if (!this.toolGenerator || this.destroyed) {
      return;
    }

    if (!this.toolGenerator.canDraw(this.element)) {
      console.warn('Cannot draw tool element:', this.element);
      return;
    }

    const g = this.toolGenerator.draw(this.element);
    if (this.destroyed) {
      g.remove();
      return;
    }

    this.renderedG = g;
    this.getElementG().appendChild(g);

    if (this.selected) {
      this.activeGenerator.processDrawing(
        this.element,
        PlaitBoard.getActiveHost(this.board),
        { selected: true }
      );
    }
  }

  private ensureToolGenerator(): void {
    if (this.toolGenerator || this.generatorLoadAttempt || this.destroyed) {
      return;
    }

    const loadAttempt = loadToolGeneratorRuntime()
      .then(({ ToolGenerator }) => {
        if (this.destroyed) {
          return;
        }

        this.toolGenerator = new ToolGenerator(this.board);
        registerToolGenerator(this.board, this.element.id, this.toolGenerator);
        this.drawToolElement();
      })
      .catch((error: unknown) => {
        if (!this.destroyed) {
          console.error(
            `[ToolComponent] Failed to load tool renderer for ${this.element.id}:`,
            error
          );
        }
      })
      .finally(() => {
        if (this.generatorLoadAttempt === loadAttempt) {
          this.generatorLoadAttempt = null;
        }
      });

    this.generatorLoadAttempt = loadAttempt;
  }

  /**
   * 组件初始化
   * 在元素首次渲染时调用
   */
  initialize(): void {
    super.initialize();
    this.destroyed = false;
    this.initializeGenerator();
    this.ensureToolGenerator();
  }

  /**
   * 响应上下文变化
   * 当元素属性变化时调用
   */
  onContextChanged(
    value: PlaitPluginElementContext<PlaitTool, PlaitBoard>,
    previous: PlaitPluginElementContext<PlaitTool, PlaitBoard>
  ): void {
    if (!this.toolGenerator) {
      // The eventual renderer reads the latest element from this component, so
      // updates received during chunk loading do not need a second replay path.
      this.ensureToolGenerator();
      return;
    }

    // 检查 viewport (zoom/scroll) 是否改变
    const viewportChanged =
      value.board.viewport.zoom !== previous.board.viewport.zoom ||
      value.board.viewport.offsetX !== previous.board.viewport.offsetX ||
      value.board.viewport.offsetY !== previous.board.viewport.offsetY;

    // 如果元素本身改变或主题改变，重新绘制
    if (value.element !== previous.element || value.hasThemeChanged) {
      // 查找已渲染的 g 元素
      const elementG = this.getElementG();
      let g = elementG.querySelector('g.plait-tool-element') as SVGGElement;

      if (!g && this.renderedG) {
        g = this.renderedG;
      }

      if (g) {
        // 更新现有元素
        this.toolGenerator.updateImage(g, previous.element, value.element);
      } else {
        // 如果找不到 g 元素，重新绘制
        console.warn('ToolComponent: g element not found, redrawing');
        this.drawToolElement();
      }

      // 更新选中状态高亮
      this.activeGenerator.processDrawing(
        this.element,
        PlaitBoard.getActiveHost(this.board),
        {
          selected: this.selected,
        }
      );
    } else if (viewportChanged && value.selected) {
      // viewport 改变且元素被选中时，更新高亮位置
      this.activeGenerator.processDrawing(
        this.element,
        PlaitBoard.getActiveHost(this.board),
        {
          selected: this.selected,
        }
      );
    } else {
      // 只有选中状态改变时，只更新高亮
      const needUpdate = value.selected !== previous.selected;
      if (needUpdate || value.selected) {
        this.activeGenerator.processDrawing(
          this.element,
          PlaitBoard.getActiveHost(this.board),
          {
            selected: this.selected,
          }
        );
      }
    }
  }

  /**
   * 清理资源
   * 在元素被销毁时调用
   */
  destroy(): void {
    this.destroyed = true;
    super.destroy();

    // 取消注册 ToolGenerator
    if (this.element) {
      unregisterToolGenerator(this.board, this.element.id);
    }

    if (this.activeGenerator) {
      this.activeGenerator.destroy();
    }
    this.toolGenerator?.destroy();
    this.toolGenerator = undefined;
    this.renderedG = undefined;
    // console.log('ToolComponent destroyed');
  }
}
