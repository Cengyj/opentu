# Change: Refactor Startup Shell Loading

## Why

当前首次访问的主入口包和样式包过大，且 `Drawnix` 在首屏同步挂载了大量非核心 UI 与后台副作用，导致用户进入可操作画布前等待较长。

## What Changes

- 拆分首屏画布壳层与延后功能层，非核心能力改为懒挂载或 idle 启动
- 为 Web 入口新增运行时轻量导出边界，避免启动服务通过 UI barrel 进入首包
- 为构建产物新增 `idle-prefetch-manifest.json` 与手动 chunk 分组
- 为 Service Worker 增加空闲预取消息与高频懒加载资源缓存能力
- 增加构建后校验脚本，守护首屏资源边界和入口体积

## Impact

- Affected specs: `startup-performance`
- Affected code: `apps/web`, `packages/drawnix`, `apps/web/src/sw`, `scripts`
