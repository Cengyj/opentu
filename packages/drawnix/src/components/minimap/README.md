# Minimap 小地图功能

## 功能概述

Minimap（小地图）是一个画布导航组件，用于解决无限画布中的方向迷失问题。

### 核心功能

✅ **实时缩略图**：显示整个画布的内容概览
✅ **视口指示器**：高亮显示当前可视区域
✅ **点击跳转**：点击小地图任意位置，快速跳转到对应区域
✅ **拖拽移动**：拖拽视口框，平滑移动画布视图
✅ **智能显示**：检测视口缩放或平移后自动显示/隐藏
✅ **自动缩放**：根据内容自动计算最佳缩放比例
✅ **实时同步**：自动跟踪元素变化和视口移动

## 架构设计

### 文件结构

```
packages/drawnix/src/
├── types/
│   └── minimap.types.ts           # TypeScript 类型定义
├── components/
│   └── minimap/
│       ├── Minimap.tsx             # 主组件
│       ├── minimap.scss            # 样式文件
│       └── index.ts                # 导出模块
├── constants/
│   └── z-index.ts                  # VIEW_NAVIGATION/MINIMAP: 4005
├── components/
│   └── view-navigation/            # 当前产品集成层（缩放 + Minimap）
└── drawnix.tsx                     # 挂载 ViewNavigation
```

### 技术栈

- **渲染引擎**: Canvas 2D API
- **状态管理**: React Hooks (useState, useRef, useCallback, useEffect)
- **交互**: Pointer Events API
- **坐标转换**: 自定义 canvas ↔ minimap 坐标系转换
- **样式**: SCSS + CSS Variables

## 使用方法

### 1. 基本使用（已集成）

Minimap 已经集成到 Drawnix 主组件中，无需额外配置：

```tsx
// packages/drawnix/src/drawnix.tsx
<ViewNavigation />
```

`ViewNavigation` 负责顶部缩放按钮、展开状态、视口变化检测和 3 秒自动隐藏，展开时以 `displayMode="always"` 挂载 `Minimap`。下面的直接用法只适用于需要单独复用组件的代码。

### 2. 智能显示模式

```tsx
import { Minimap } from './components/minimap';

// 默认智能显示模式（推荐）
<Minimap board={board} displayMode="auto" />

// 始终显示模式
<Minimap board={board} displayMode="always" />

// 完全手动控制模式
<Minimap board={board} displayMode="manual" />

// 自定义触发条件
<Minimap
  board={board}
  displayMode="auto"
  autoTriggerConfig={{
    autoHideDelay: 3000,               // 3 秒后自动隐藏
  }}
/>
```

### 3. 显示模式说明

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| `auto`（默认） | 智能显示/隐藏 | 推荐用于大多数场景，用户体验最佳 |
| `always` | 始终显示 | 需要持续导航的复杂画布 |
| `manual` | 完全手动控制 | 用户自行决定何时显示 |

### 4. 智能显示触发条件

**交互触发**：
- 用户拖拽画布（空格 + 拖拽）
- 用户缩放画布（滚轮、缩放按钮）
- 默认在交互停止 3 秒后自动隐藏

当前实现没有“元素数量”或“内容分散度”触发器。`autoTriggerConfig` 只接受 `autoHideDelay`。

### 5. 自定义配置

```tsx
import { Minimap } from './components/minimap';

<Minimap
  board={board}
  displayMode="auto"
  config={{
    width: 250,              // 宽度（默认200px）
    height: 180,             // 高度（默认150px）
    position: 'bottom-left', // 位置（默认bottom-right）
    margin: 20,              // 边距（默认16px）
    collapsible: true,       // 可折叠（默认true）
    defaultExpanded: false,  // 默认折叠，由智能显示控制
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    viewportColor: 'rgba(90, 79, 207, 0.3)',
    elementColor: 'rgba(0, 0, 0, 0.5)',
  }}
/>
```

### 6. 配置选项

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `width` | number | 200 | Minimap 宽度（像素） |
| `height` | number | 150 | Minimap 高度（像素） |
| `position` | string | 'bottom-right' | 位置：'bottom-right', 'bottom-left', 'top-right', 'top-left' |
| `margin` | number | 16 | 与边缘的间距（像素） |
| `collapsible` | boolean | true | 是否可折叠 |
| `defaultExpanded` | boolean | false | 默认折叠，由智能显示控制 |
| `displayMode` | string | 'auto' | 显示模式：'auto', 'always', 'manual' |
| `backgroundColor` | string | 'rgba(255, 255, 255, 0.95)' | 背景颜色 |
| `borderColor` | string | 'rgba(0, 0, 0, 0.1)' | 边框颜色 |
| `viewportColor` | string | 'rgba(90, 79, 207, 0.3)' | 视口框颜色 |
| `elementColor` | string | 'rgba(0, 0, 0, 0.5)' | 元素颜色 |
| `autoTriggerConfig.autoHideDelay` | number | 3000 | `auto` 模式交互停止后的隐藏延迟（毫秒） |

## 交互说明

### 用户操作

- **点击**：点击小地图任意位置，画布视口跳转到对应区域（居中）
- **拖拽**：按住鼠标/手指拖动视口框，实时移动画布
- **折叠/展开**：产品集成由 `ViewNavigation` 顶部按钮控制；直接使用且 `collapsible=true` 时由组件内部按钮控制

### 光标变化

- **默认**: `pointer`（鼠标悬停时）
- **拖拽中**: `grabbing`

## 核心实现

### 1. 坐标转换算法

```typescript
// 画布坐标 → Minimap 坐标
canvasToMinimapCoords(canvasX, canvasY) {
  const offsetX = 10; // Minimap 内边距
  const offsetY = 10;

  const x = (canvasX - contentBounds.x) * scale + offsetX;
  const y = (canvasY - contentBounds.y) * scale + offsetY;

  return [x, y];
}

// Minimap 坐标 → 画布坐标
minimapToCanvasCoords(minimapX, minimapY) {
  const offsetX = 10;
  const offsetY = 10;

  const x = (minimapX - offsetX) / scale + contentBounds.x;
  const y = (minimapY - offsetY) / scale + contentBounds.y;

  return [x, y];
}
```

### 2. 自动缩放计算

```typescript
calculateScale(contentBounds) {
  const scaleX = (config.width - 20) / contentBounds.width;
  const scaleY = (config.height - 20) / contentBounds.height;
  return Math.min(scaleX, scaleY, 1); // 不超过 1:1
}
```

### 3. 元素边界提取

支持多种元素类型：
- **基于 points**: tool, image, draw 元素
- **基于 x, y, width, height**: mind map 元素

```typescript
getAllElementBounds() {
  board.children.forEach((element) => {
    if (element.points) {
      bounds = RectangleClient.getRectangleByPoints(element.points);
    } else if (element.x !== undefined) {
      bounds = { x: element.x, y: element.y, width, height };
    }
  });
}
```

### 4. 实时同步

使用 `setInterval` 每 100ms 更新一次：

```typescript
useEffect(() => {
  const intervalId = setInterval(() => {
    render();
  }, 100);
  return () => clearInterval(intervalId);
}, [board, state.expanded, render]);
```

## 渲染实现与性能状态

### 1. Canvas 渲染
- 使用 Canvas 2D 绘制元素的矩形概览和当前视口框
- 当前没有 Canvas 与其他渲染方案的同条件性能对照，不能据此声称性能提升

### 2. 更新时序
- pointer 移动会更新 viewport，并通过 `requestAnimationFrame` 请求一次重绘
- 展开状态下另有 100ms 定时重绘；其空闲和大元素集成本仍是 F-04 的待测假设

### 3. 条件渲染
- `state.expanded=false` 时停止定时重绘
- 空画布仍绘制视口范围，不显示额外空态文案

## 样式定制

### CSS Variables

```scss
.minimap {
  --minimap-bg: rgba(255, 255, 255, 0.95);
  --minimap-border: rgba(0, 0, 0, 0.1);
  --minimap-toggle-bg: rgba(255, 255, 255, 0.9);
  --minimap-toggle-hover-bg: rgba(90, 79, 207, 0.1);
  --minimap-toggle-icon: #666;
}
```

## 事件追踪

当前运行时记录：

- `minimap_navigate` analytics 事件，payload 仅含 `action: click | drag` 和 `displayMode`
- `minimap_container` - Minimap 容器 `data-track`
- `minimap_click_toggle` - 独立组件折叠按钮 `data-track`
- `view_nav_minimap_toggle` - 当前产品集成层展开按钮 `data-track`

## 当前审计状态

- 键盘语义、可访问名称、compact 触控目标和减少动画行为记录在待审批 change：`improve-canvas-navigation-accessibility`，审批前不属于当前运行时能力。
- 100ms 轮询在空画布和大元素集下的成本尚无至少 5 次同条件数据；在测量完成前保留为假设，不声称瓶颈或性能改善。

## 故障排查

### Q1: Minimap 不显示
- 检查 `board` 是否已初始化
- 确认 `state.expanded` 为 `true`

### Q2: 视口框位置偏移
- 检查 viewport 坐标计算是否正确
- 确认 `getViewportOrigination` 返回值有效

### Q3: 点击跳转不准确
- 检查 `minimapToCanvasCoords` 坐标转换逻辑
- 确认 `scale` 计算正确

### Q4: 样式异常
- 确认已导入 `minimap.scss`
- 检查 z-index 冲突

## 参考资料

- [Figma Minimap](https://www.figma.com/)
- [Excalidraw Navigation](https://excalidraw.com/)
- [Miro Minimap](https://miro.com/)
- [Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
