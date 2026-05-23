## Context

- 当前 `apps/web` 首次访问时，入口 JS 与 CSS 体积过大，且 `Drawnix` 把聊天、AI、工具窗、同步、性能面板、任务恢复等能力一并放入首屏链路。
- 现有 Service Worker 已支持后台 precache，但主要改善二次访问，对首次访问帮助有限。

## Goals / Non-Goals

- Goals:
  - 让用户尽快进入可操作画布
  - 非核心能力改为未触发不挂载，并在 idle 或首次使用时加载
  - 保留当前 SW 的 precache 机制，并新增一层空闲预取
- Non-Goals:
  - 不重做白板核心交互
  - 不新增用户可配置的性能开关
  - 不将用户媒体或任务结果纳入 idle 预取

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

## Risks / Trade-offs

- 非核心功能改为延后挂载后，首次点击聊天/工具/同步可能出现短暂局部 loading。
  - Mitigation: 首屏可操作后使用空闲预取高频组，并在用户第一次触发前尽量提前 warmup。
- 任务恢复、自动插入画布等副作用延后后，恢复状态展示会稍晚。
  - Mitigation: 统一放入 idle 启动器，确保不会阻塞进入画布，但尽早补齐状态。
- 过度拆包可能带来过多小请求。
  - Mitigation: 使用稳定的手动 chunk 分组，限制为少量高价值分组。

## Migration Plan

1. 新增 OpenSpec 变更与 `startup-performance` 需求定义。
2. 拆分 `Drawnix` 壳层与延后层，迁移非核心 UI 与副作用。
3. 为 Web 入口切换到 `runtime` 子入口。
4. 为 Vite 与 SW 增加 manual chunk、idle prefetch manifest、预取消息处理与构建校验。

## Open Questions

- 无
