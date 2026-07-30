## Context

- 2026-07-29 当前入口链重新确认：`index.html → main.tsx → bootstrap.tsx → App → lazy Drawnix → initial mounted components`。
- `apps/web/src/app/bootstrap.tsx` 已主要使用 `@drawnix/drawnix/runtime`，但两个 analytics release API 仍来自根 barrel。当前生产 `bootstrap-B0wTCVom.js` 因而静态 import `ai-chat-KsRCwrxK.js`（2,808,742B raw / 837,626B gzip）与 `tool-windows-1WB33Kw7.js`（641,215B / 197,356B）。
- `packages/drawnix/src/drawnix.tsx` 初始无条件挂载 `DeferredAIInputBar` 与 `ChatDrawer`，进一步加载 workflow、skills 与 external-skills 依赖。
- startup validator 会遍历入口静态依赖，但禁止前缀缺少 `ai-chat-`；逐文件 500KiB 预算也不能限制多个小 chunk 的总成本。
- 同构建四组各 5 次基线：冷/SW 关可操作中位数 1174ms、39 请求、5,859,060B 正文；冷/SW 开 1496ms、51 请求、6,517,471B；热/SW 关 468ms；热/SW 开 505ms。该本机口径用于修复前后对照，不外推公网设备。
- 已安装并预热的 SW 在源站停止后 857ms 恢复到可操作画布；离线缓存与存储格式不需要为本 change 重做。

## Goals / Non-Goals

- Goals:
  - 让用户尽快进入可操作画布
  - 非核心能力改为未触发不挂载，并在 idle 或首次使用时加载
  - 保留当前 SW 的 precache 机制，并新增一层空闲预取
  - 让源码挂载边界、package 运行时导出、Vite 分组、idle manifest 与产物校验使用同一组资源边界
  - 保持当前画布、任务、工作流、缓存、升级和崩溃恢复语义
- Non-Goals:
  - 不重做白板核心交互
  - 不新增用户可配置的性能开关
  - 不将用户媒体或任务结果纳入 idle 预取
  - 不改变任务执行线程、模型路由、存储 schema 或迁移版本
  - 不借本 change 重构 Chat/AI 业务逻辑或新增产品能力

## Decisions

- Decision: 维持 `Drawnix` 作为对外组件，但把非核心 UI 与启动副作用挪入独立的延后层组件。
  - Alternatives considered: 直接整体 `lazy(() => import('./drawnix'))`
  - Why not chosen: 会把“进入画布”与“加载整套 UI”继续绑死，无法精细控制首屏与延后能力边界。
- Decision: 为 `@drawnix/drawnix` 增加 `runtime` 子入口，供 `main.tsx` 与 `app.tsx` 读取启动/工作区服务。
  - Alternatives considered: 继续从根 barrel 导出运行时服务
  - Why not chosen: 难以稳定隔离启动服务与 UI 图谱。
- Decision: 通过 `manualChunks + idle-prefetch-manifest` 管理高频延后模块。
  - Alternatives considered: 只依赖 Rollup 默认拆包
  - Why not chosen: 无法稳定产出可校验、可预取的 chunk 分组。
- Decision: 将 bootstrap 所需的 analytics release API 从现有轻量 `runtime` 子入口导出，bootstrap 不再静态引用根 barrel；根 barrel 导出继续保留兼容。
  - Alternatives considered: 只调整 manual chunk，把根 barrel 依赖强制塞入另一个名字。
  - Why not chosen: 改名不改变静态可达关系，也不能阻止 UI 图谱进入 bootstrap。
- Decision: Chat 使用轻量 context/controller 记录打开意图，只有首次打开或需要投递消息时才挂载完整 Drawer；挂载前的命令必须排队或由 state 驱动，不能静默丢失。
  - Alternatives considered: 保持 ChatDrawer 初始挂载，仅依赖浏览器缓存。
  - Why not chosen: 冷启动仍需下载、解析和执行完整 Chat 依赖，不符合未触发边界。
- Decision: AI 输入在首屏保留等尺寸、可聚焦的轻壳以保持现有布局；完整 `WorkflowProvider`、`ModelHealthProvider`、模型目录与生成运行时在首次聚焦/输入/快捷键激活时加载。合格 idle 预取只能 warm cache，不能提前挂载业务副作用。
  - Alternatives considered: 画布可操作后再插入完整 AIInputBar。
  - Why not chosen: 会造成底部布局跳动并改变当前首屏视觉层级。
- Decision: 在 validator 中维护唯一的禁止启动组清单，并新增入口静态依赖图总 raw budget。首轮预算为 2,000,000B，且任何 `ai-chat-`、`tool-windows-`、`external-skills-` JS 都不得进入入口静态图。
  - Alternatives considered: 只补 `ai-chat-` 前缀或继续使用单文件 500KiB。
  - Why not chosen: 只能修复本次名字，仍会放行重命名或多个小 chunk 回流。

## Invariants

- 首屏仍显示与当前同尺寸的 AI 输入区域、工具栏、画布和启动/错误反馈；不新增设置项。
- 未打开 Chat/AI 时不创建其会话、模型健康、工作流提交或生成任务副作用。
- 用户首次打开 Chat/AI 的命令不得丢失；加载中 100ms 内出现可访问状态，成功后继续原操作，失败时可重试。
- 任务恢复、自动插入和 WorkZone/工作流同步仍在现有延后运行时执行；不得因 UI 拆分永久跳过。
- 画板、任务、工作流、偏好、素材与 Cache API 的 key/schema/迁移保持不变。
- SW 仍只预取版本化静态资源，不缓存用户媒体或任务结果；warm offline 行为不得回归。
- 公开根 barrel 继续兼容；只改变 bootstrap 的内部导入路径。

## Risks / Trade-offs

- 非核心功能改为延后挂载后，首次点击聊天/工具/同步可能出现短暂局部 loading。
  - Mitigation: 首屏可操作后使用空闲预取高频组，并在用户第一次触发前尽量提前 warmup。
- 任务恢复、自动插入画布等副作用延后后，恢复状态展示会稍晚。
  - Mitigation: 统一放入 idle 启动器，确保不会阻塞进入画布，但尽早补齐状态。
- 过度拆包可能带来过多小请求。
  - Mitigation: 使用稳定的手动 chunk 分组，限制为少量高价值分组。
- Chat ref 当前在 Drawer 未挂载时为空，直接条件渲染会让 toolbar/消息命令静默失效。
  - Mitigation: 先把打开意图和待投递命令收敛到轻量 context/controller，并为首次打开、发送消息和 workflow 更新补测试。
- AI 输入轻壳与完整组件切换可能丢失 focus、草稿或引发布局偏移。
  - Mitigation: 轻壳持有草稿/focus 激活状态，完整组件复用同一容器尺寸；用 1280×720、平板和移动视口截图验证 CLS/布局连续性。
- 总预算可能因合法核心能力变化而失真。
  - Mitigation: 预算以实际入口图报告输出；任何调整必须带新测量和独立 OpenSpec 审批，不能只提高阈值。

## Migration Plan

1. 先增加产物级失败测试，证明当前 `ai-chat`/`tool-windows` 回流和总预算超限。
2. 从 `runtime` 子入口导出 analytics release API，并切换 bootstrap 内部导入；保留根导出。
3. 将 Chat 打开意图与命令队列迁移到轻量 controller，再条件挂载完整 Drawer。
4. 将 AI 输入拆成等尺寸轻壳和首次交互加载的完整实现，不移动生成/任务数据所有权。
5. 统一 Vite/idle manifest/validator 的禁止组和 2,000,000B 总 raw budget。
6. 由窄到宽验证并重跑四组各 5 次基线；失败时按上述文件边界整体回滚，不执行数据清理或迁移。

## Acceptance Thresholds

- 当前同机冷 origin、SW 关、1280×720、无 throttle、5 次口径下：可操作中位数不得高于 1174ms，范围上界不得高于 1276ms；入口前服务器正文不高于 2,000,000B，请求数不高于 30。
- 热、SW 关同口径 5 次可操作中位数不高于 515ms（当前 468ms + 10% 容差）。
- `ai-chat-*`、`tool-windows-*`、`external-skills-*` JS 在未交互冷启动 5/5 样本中均不得由入口静态图请求；AI 轻壳自身 chunk 可存在，但不能静态依赖这些组。
- 首次 Chat/AI 激活 100ms 内出现可访问 loading/pressed 状态；本地热缓存下 5 次完成挂载的中位数不高于 1000ms。该指标必须新增修复前/后原始值。
- warm SW 源站离线仍能进入可操作画布；初始化失败仍显示错误、日志、安全模式和调试入口。
- 同视口/同主题前后截图中，未交互首屏 AI 输入容器位置和尺寸不变；浏览器报告 CLS 不高于 0.1，移动/平板无新溢出。

## Rollback

- 独立回退 runtime analytics 导出/导入、Chat controller、AI 轻壳和 validator/Vite 改动及对应测试。
- 不删除或迁移 IndexedDB、Cache API、localStorage/sessionStorage 数据。
- 任一首次命令丢失、任务恢复缺失、离线回归或预算/测试失败时整体回滚加载语义；不得只提高预算或放宽断言。
