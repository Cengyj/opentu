# 多功能工具箱架构设计文档

> Feature: feat/08-multifunctional-toolbox
> Created: 2025-12-08
> Status: 设计阶段

## 📋 概述

多功能工具箱是一个允许用户在画布上嵌入第三方工具网页的功能。工具以 iframe 形式"钉在"画布上，成为画布的原生元素，支持拖拽、缩放、旋转等完整交互能力。

### 核心特性

- ✅ 左侧工具箱抽屉，展示可用工具列表
- ✅ 工具作为画布元素（PlaitTool），完全集成到 Plait 坐标系统
- ✅ 使用 SVG foreignObject 嵌入 iframe
- ✅ 自动继承 Plait 的拖拽、缩放、旋转、选中等能力
- ✅ 支持内置工具和自定义工具
- ✅ 工具状态持久化（随画板数据保存）

---

## 🏗️ 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Drawnix 应用层                            │
│  ┌──────────────────┐         ┌───────────────────────────┐    │
│  │ ToolboxDrawer    │         │   Plait Canvas (SVG)      │    │
│  │ (左侧抽屉)         │         │                           │    │
│  │                  │         │  ┌─────────────────────┐  │    │
│  │ 🍌 香蕉提示词      │  click  │  │ PlaitTool Element   │  │    │
│  │ 📝 小红薯工具      │ ─────> │  │  (foreignObject)    │  │    │
│  │ ⚙️  批处理工具     │         │  │   └─ iframe         │  │    │
│  │                  │         │  └─────────────────────┘  │    │
│  └──────────────────┘         └───────────────────────────┘    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Plait 插件层 (withTool)                      │  │
│  │  - 注册 ToolComponent                                     │  │
│  │  - 提供 ToolTransforms API                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📐 核心组件设计

### 1. 数据模型层

#### PlaitTool 元素（画布元素）

```typescript
/**
 * 工具元素 - 画布上的工具实例
 * 继承 PlaitElement，成为画布的原生元素
 */
export interface PlaitTool extends PlaitElement {
  type: 'tool';

  // 位置和尺寸（画布坐标）
  points: [Point, Point];  // [左上角, 右下角]

  // 旋转角度
  angle: number;

  // 工具标识
  toolId: string;          // 工具定义ID
  url: string;             // iframe URL

  // 可选元数据
  metadata?: {
    name?: string;
    category?: string;
    permissions?: string[];
  };
}
```

#### ToolDefinition（工具配置）

```typescript
/**
 * 工具定义 - 工具箱中的工具配置
 */
export interface ToolDefinition {
  id: string;                // 唯一标识
  name: string;              // 工具名称
  description?: string;      // 工具描述
  icon?: string;             // 图标（emoji 或 icon name）
  category?: string;         // 分类
  url: string;               // iframe URL
  defaultWidth?: number;     // 默认宽度（画布单位）
  defaultHeight?: number;    // 默认高度（画布单位）
  permissions?: string[];    // iframe sandbox 权限
}
```

---

### 2. Plait 插件层

#### withTool 插件

```typescript
/**
 * 工具插件 - 注册 ToolComponent 到 Plait
 */
export const withTool: PlaitPlugin = (board: PlaitBoard) => {
  // 1. 注册元素类型
  board.drawElement = (element: PlaitDrawElement) => {
    if (element.type === 'tool') {
      return ToolComponent;
    }
    return board.drawElement(element);
  };

  return board;
};
```

#### ToolTransforms API

```typescript
/**
 * 工具元素操作 API
 */
export const ToolTransforms = {
  // 插入工具到画布
  insertTool(
    board: PlaitBoard,
    toolId: string,
    url: string,
    position: Point,
    size: { width: number; height: number }
  ): void;

  // 更新工具尺寸
  resizeTool(
    board: PlaitBoard,
    element: PlaitTool,
    newSize: { width: number; height: number }
  ): void;

  // 删除工具
  removeTool(board: PlaitBoard, elementId: string): void;
};
```

---

### 3. 渲染层

#### ToolComponent（画布组件）

```typescript
/**
 * 工具元素渲染组件
 * 继承 CommonElementFlavour，集成到 Plait 渲染流程
 */
export class ToolComponent
  extends CommonElementFlavour<PlaitTool, PlaitBoard>
  implements OnContextChanged<PlaitTool, PlaitBoard>
{
  toolGenerator: ToolGenerator;

  // 初始化生成器
  initializeGenerator(): void;

  // 组件初始化
  initialize(): void;

  // 响应元素变化
  onContextChanged(value, previous): void;

  // 清理资源
  destroy(): void;
}
```

#### ToolGenerator（渲染生成器）

```typescript
/**
 * 工具元素渲染生成器
 * 负责实际的 SVG/HTML 渲染
 */
export class ToolGenerator extends Generator<PlaitTool> {
  // 绘制工具元素
  draw(element: PlaitTool): SVGGElement;

  // 更新工具元素
  updateImage(nodeG: SVGGElement, previous: PlaitTool, current: PlaitTool): void;

  // 创建 foreignObject + iframe
  private createForeignObject(element: PlaitTool): SVGForeignObjectElement;

  // 创建 iframe
  private createIframe(element: PlaitTool): HTMLIFrameElement;

  // 清理资源
  destroy(): void;
}
```

---

### 4. UI 组件层

#### ToolboxDrawer（工具箱抽屉）

```typescript
/**
 * 工具箱侧边栏
 * 展示可用工具列表，点击后插入到画布
 */
export const ToolboxDrawer: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ isOpen, onOpenChange }) => {
  // 工具列表
  const tools = useToolboxService().getAvailableTools();

  // 点击工具 -> 插入到画布
  const handleToolClick = (tool: ToolDefinition) => {
    ToolTransforms.insertTool(board, tool.id, tool.url, ...);
  };

  return (
    <div className="toolbox-drawer">
      <ToolList tools={tools} onToolClick={handleToolClick} />
    </div>
  );
};
```

---

### 5. 服务层

#### ToolboxService（工具管理）

```typescript
/**
 * 工具箱管理服务
 * 管理内置工具和自定义工具
 */
export class ToolboxService {
  private builtInTools: ToolDefinition[];
  private customTools: ToolDefinition[];

  // 获取所有工具
  getAvailableTools(): ToolDefinition[];

  // 根据 ID 获取工具
  getToolById(id: string): ToolDefinition | null;

  // 添加自定义工具
  addCustomTool(tool: ToolDefinition): void;

  // 移除自定义工具
  removeCustomTool(id: string): void;
}
```

---

## 🔄 数据流

### 插入工具流程

```
用户点击工具箱中的工具
  ↓
ToolboxDrawer.handleToolClick()
  ↓
ToolTransforms.insertTool(board, toolId, url, position, size)
  ↓
创建 PlaitTool 元素对象
  ↓
DrawTransforms.insertElement(board, toolElement)
  ↓
Plait 触发重新渲染
  ↓
withTool 插件识别 type='tool'
  ↓
实例化 ToolComponent
  ↓
ToolGenerator.draw() 渲染 foreignObject + iframe
  ↓
工具显示在画布上
```

### 拖拽/缩放流程

```
用户拖拽工具元素
  ↓
Plait 原生拖拽系统处理
  ↓
更新 PlaitTool.points
  ↓
触发 ToolComponent.onContextChanged()
  ↓
ToolGenerator.updateImage() 更新位置
  ↓
foreignObject transform 更新
  ↓
工具随画布移动/缩放
```

---

## 🎨 技术实现要点

### 1. SVG foreignObject 嵌入 HTML

```xml
<svg>
  <g data-element-id="tool_123">
    <foreignObject x="100" y="100" width="800" height="600">
      <div xmlns="http://www.w3.org/1999/xhtml" class="tool-container">
        <iframe src="https://tool.com" sandbox="allow-scripts allow-same-origin" />
      </div>
    </foreignObject>
  </g>
</svg>
```

### 2. 画布坐标转换

```typescript
// 屏幕坐标 → 画布坐标
const boardX = (screenX - viewport.offsetX) / viewport.zoom;
const boardY = (screenY - viewport.offsetY) / viewport.zoom;

// 画布坐标 → 屏幕坐标
const screenX = boardX * viewport.zoom + viewport.offsetX;
const screenY = boardY * viewport.zoom + viewport.offsetY;
```

### 3. iframe 安全配置

```typescript
// sandbox 权限
const permissions = [
  'allow-scripts',      // 允许执行脚本
  'allow-same-origin',  // 允许同源访问
  'allow-forms',        // 允许表单提交
];

// allow 属性（Feature Policy）
iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
```

### 4. 数据持久化

工具元素作为 `PlaitElement` 的一部分，自动保存到画板数据中：

```typescript
// 画板数据结构
{
  children: [
    { type: 'geometry', ... },
    { type: 'image', ... },
    {
      type: 'tool',
      id: 'tool_123',
      toolId: 'banana-prompt',
      url: 'https://banana-prompt.com',
      points: [[100, 100], [900, 700]],
      angle: 0
    }
  ],
  viewport: { ... },
  theme: { ... }
}
```

---

## 📂 文件结构

```
packages/drawnix/src/
├── types/
│   └── toolbox.types.ts                    # 类型定义
│
├── plugins/
│   └── with-tool.ts                        # Plait 插件
│
├── components/
│   ├── tool-element/                       # 画布元素渲染
│   │   ├── tool.component.ts              # ToolComponent
│   │   ├── tool.generator.ts              # ToolGenerator
│   │   └── tool.component.scss            # 样式
│   │
│   └── toolbox-drawer/                     # UI 组件
│       ├── ToolboxDrawer.tsx              # 主抽屉
│       ├── ToolboxDrawer.scss
│       ├── ToolList.tsx                   # 工具列表
│       └── ToolItem.tsx                   # 工具项
│
├── services/
│   └── toolbox-service.ts                  # 工具管理服务
│
├── constants/
│   └── built-in-tools.ts                   # 内置工具配置
│
└── utils/
    └── tool-helpers.ts                     # 辅助函数
```

---

## 🚀 实施计划

### Phase 1: 基础架构（核心功能）

**目标**: 建立基础框架，实现最小可用版本

1. **类型定义** (30分钟)
   - `toolbox.types.ts` - PlaitTool, ToolDefinition 接口

2. **Plait 插件** (1小时)
   - `with-tool.ts` - withTool 插件
   - `ToolTransforms` API

3. **渲染组件** (2小时)
   - `tool.component.ts` - ToolComponent
   - `tool.generator.ts` - ToolGenerator（foreignObject + iframe）

4. **测试集成** (30分钟)
   - 在 drawnix.tsx 中集成 withTool
   - 手动测试插入工具元素

**验收标准**: 可以通过代码手动插入工具元素到画布，并正常显示 iframe

---

### Phase 2: UI 组件（用户交互）

**目标**: 实现用户可见的工具箱界面

1. **工具箱抽屉** (2小时)
   - `ToolboxDrawer.tsx` - 主组件
   - `ToolList.tsx` - 工具列表
   - `ToolItem.tsx` - 工具项

2. **工具管理服务** (1小时)
   - `toolbox-service.ts` - ToolboxService
   - `built-in-tools.ts` - 内置工具配置

3. **集成到 UnifiedToolbar** (30分钟)
   - 添加工具箱按钮
   - 管理抽屉状态

4. **测试交互** (30分钟)
   - 点击工具插入到画布
   - 拖拽、缩放测试

**验收标准**: 用户可以从工具箱点击工具，工具正常插入到画布并可交互

---

### Phase 3: 优化与完善（可选）

**目标**: 提升用户体验和功能完整性

1. **样式优化** (1小时)
   - 工具箱样式美化
   - 工具元素选中态样式
   - 响应式适配

2. **数据通信** (1-2小时)
   - postMessage 通信协议
   - 复制文本到画布功能

3. **自定义工具** (1小时)
   - 支持用户添加自定义工具
   - 工具配置持久化

4. **错误处理** (30分钟)
   - iframe 加载失败处理
   - 权限错误提示

**验收标准**: 完整的用户体验，支持高级功能

---

## 🎯 关键优势

### 1. 完全集成 Plait 生态

- ✅ 自动支持拖拽、缩放、旋转
- ✅ 自动支持撤销/重做
- ✅ 自动支持复制/粘贴
- ✅ 自动序列化和持久化

### 2. 架构清晰

- ✅ 类似 ImageComponent 的实现模式
- ✅ 复用 Plait 的成熟能力
- ✅ 易于维护和扩展

### 3. 性能优良

- ✅ SVG 原生渲染，性能优秀
- ✅ iframe 隔离，不影响主应用
- ✅ 懒加载工具内容

---

## 📝 注意事项

### 1. iframe 跨域限制

- ⚠️ 第三方网页可能设置了 `X-Frame-Options`，导致无法嵌入
- 🔧 解决方案：提供代理服务或使用支持嵌入的工具

### 2. iframe 通信

- ⚠️ postMessage 需要工具网页配合实现
- 🔧 解决方案：提供标准协议文档，工具开发者按协议实现

### 3. 性能考虑

- ⚠️ 大量工具可能影响性能
- 🔧 解决方案：限制同时显示的工具数量，超出部分隐藏

### 4. 安全考虑

- ⚠️ iframe 可能执行恶意脚本
- 🔧 解决方案：严格的 sandbox 权限控制，白名单机制

---

## 🔗 相关文档

- Plait 官方文档
- [SVG foreignObject 规范](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject)
- [iframe sandbox 文档](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)
- [postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)

---

## 📅 更新日志

- 2025-12-08: 初始架构设计
