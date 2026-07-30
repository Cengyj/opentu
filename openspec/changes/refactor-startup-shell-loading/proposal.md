# Change: Refactor Startup Shell Loading

## Why

原 change 已完成一轮壳层拆分，但 2026-07-29 对当前源码和重新构建产物的复审确认启动边界再次发生漂移：

- `Drawnix` 初始渲染仍无条件挂载 `DeferredAIInputBar` 和 `ChatDrawer`。
- Web bootstrap 从根 `@drawnix/drawnix` barrel 导入 analytics release API，使生产 `bootstrap` 静态依赖 `ai-chat` 与 `tool-windows`。
- 当前 startup validator 的禁止组没有 `ai-chat`，且只限制单个入口资产 500KiB，不限制入口静态图总量，因此 `pnpm verify:startup` 错误放行。
- 当前生产构建在 1280×720、本机回环网络、冷 origin、SW 关闭的 5 次样本中，画布可操作前每次收到 39 个服务器请求和 5,859,060B 无压缩正文；5/5 样本都包含 `ai-chat-*`、`tool-windows-*` 与 `DeferredAIInputBar-*`，可操作中位数 1174ms（1152–1276ms）。

这些数据只证明当前资源边界和本机基线，不代表修复后一定快多少。需要重新打开该 change，在不改变现有生成、恢复和存储语义的前提下恢复已经定义的启动行为，并让校验覆盖真实依赖图。

## What Changes

- 拆分首屏画布壳层与延后功能层，非核心能力改为懒挂载或 idle 启动
- 为 Web 入口新增运行时轻量导出边界，避免启动服务通过 UI barrel 进入首包
- 为构建产物新增 `idle-prefetch-manifest.json` 与手动 chunk 分组
- 为 Service Worker 增加空闲预取消息与高频懒加载资源缓存能力
- 增加构建后校验脚本，守护首屏资源边界和入口体积
- 复审修正：bootstrap 的 analytics release API 也必须从轻量 runtime 边界导入
- 复审修正：Chat 抽屉未打开时不挂载；AI 输入在首屏只允许等尺寸轻壳，完整模型/工作流/生成依赖在首次交互或合格 idle 阶段加载
- 复审修正：构建校验必须禁止 `ai-chat`、`tool-windows`、`external-skills` 回流，并限制入口静态图总量，而不只检查单文件
- 补齐初始化失败、首次打开 Chat/AI、任务恢复与产物依赖图回归测试

## Impact

- Affected specs: `startup-performance`
- Affected code: `apps/web`, `packages/drawnix`, `apps/web/src/sw`, `scripts`
- Preserved data/API semantics: 不修改画板、任务、工作流、素材缓存或偏好数据格式；不改变模型/供应商路由；保持 `@drawnix/drawnix` 公开根导出兼容
- User-visible trade-off: Chat/AI 首次激活可出现局部 loading，但画布和输入轻壳布局不得跳动，且必须立即给出可访问的加载反馈
