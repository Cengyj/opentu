## 1. Startup Shell

- [x] 1.1 为 OpenSpec 新增 `refactor-startup-shell-loading` 变更文档
- [x] 1.2 拆分 Drawnix 首屏壳层与延后功能层
- [x] 1.3 将任务恢复、自动插入、字体/视频恢复等副作用迁移到 idle 启动器
- [x] 1.4 调整 Web 入口运行时导入边界

## 2. Build & Prefetch

- [x] 2.1 配置 manual chunk 分组与 `idle-prefetch-manifest.json`
- [x] 2.2 新增 `SW_PREFETCH_GROUPS` 处理与空闲预取逻辑
- [x] 2.3 增加构建后首屏资源校验脚本

## 3. Verification

- [ ] 3.1 运行 OpenSpec CLI 校验（2026-08-03 执行 `openspec validate refactor-startup-shell-loading --strict`，exit 127：`openspec: command not found`；保持未完成，不伪造通过）
- [x] 3.2 完成原 change 的类型检查与构建基线；重新打开后的最终产物复验由 6.3 跟踪

## 4. 2026-07-29 Evidence Refresh

- [x] 4.1 重新确认 HTML → main → bootstrap → App → Drawnix 正反向启动链
- [x] 4.2 重新构建并记录当前 chunk raw/gzip 体积与 bootstrap 静态 imports
- [x] 4.3 在同机 1280×720 下完成冷/热、SW 关/开各 5 次启动基线
- [x] 4.4 验证 warm SW 在源站停止时仍可离线进入画布，并记录 SW 关闭对照
- [x] 4.5 修复 Vitest 使用 production React 和 App 占位测试，不改变产品行为
- [x] 4.6 用户批准本次重新打开的加载语义、预算与验收阈值

## 5. Boundary Correction (approval required)

- [x] 5.1 先增加会因当前 `ai-chat`/`tool-windows` 回流与总预算而失败的产物级测试
- [x] 5.2 从轻量 runtime 导出 analytics release API，并移除 bootstrap 对根 barrel 的静态依赖
- [x] 5.3 增加轻量 Chat controller/命令队列，未打开时不挂载完整 ChatDrawer
- [x] 5.4 增加等尺寸 AI 输入轻壳；完整 provider/model/workflow 依赖在首次交互立即加载，或在 `isStartupOperable` 后由可取消 idle 回调自动挂载；两条路径复用单飞 loader，自动挂载不聚焦、不提交
- [x] 5.5 统一 Vite、idle manifest 与 validator 禁止组，入口静态图总 raw budget 设为 2,000,000B
- [x] 5.6 补 Chat/AI 首次打开、命令排队/失败重试、AI 草稿/预填回放和初始化失败自动化回归测试
- [x] 5.7 修复 CDN 配置无界等待/重复探测与 SW 普通 idle run 全量扩张
- [x] 5.8 统一 Mermaid `10.9.6` 与传递 uuid `14.0.1`，并启用聊天图表 strict 模式
- [x] 5.9 增加 Drawnix app 专用入口并按依赖层拆分首屏 React、Plait、Slate 与 TDesign vendor，禁止循环 chunk
- [x] 5.10 将 SheetJS 锁定到官方 `0.20.3` tarball，并增加中文字段/多工作表往返合同；将 `@swc-node/core` 兼容锁定为 `1.13.3`
- [x] 5.11 将可选画布浮层、ToolGenerator/工具设置与生图、PPT 图片操作、刷新活动任务检查移入首次真实操作的延迟边界
- [x] 5.12 将 AppMenu、MoreTools、Asset/统一缓存、RetryImage/音频缓存、Minimap 和精细擦除移入各自真实激活或空闲边界；CacheQuota idle/runtime 消费统一 `isStartupOperable` 门槛，并增加单飞、失败重试、卸载防迟到与手势快照合同；延迟缓存边界以显式 `UnifiedCacheService` 公共接口约束声明输出，不泄露实现类的私有 IndexedDB 状态，运行时 singleton 与缓存语义不变（最终边界回归 5 files / 16 tests、目标 lint/typecheck 通过）
- [ ] 5.13 在最终生产产物上复验任务/工作流恢复、初始化失败与 warm offline，不以旧构建或仅单元测试替代浏览器证据
- [x] 5.14 修复 AI 输入轻壳只在交互后升级的问题：传递统一 `isStartupOperable` 门槛，以 1500ms idle timeout/400ms fallback 自动挂载完整运行时；更早交互取消回调并复用 loader，卸载取消，自动挂载不聚焦、不提交。组件合同 9/9、生产 smoke 3/3、零交互探针均通过

## 6. Reverification

- [x] 6.1 运行最终相关 Vitest、App/SW 集成测试和 startup validator：`pnpm test` 292 files / 2,218 tests（2,217 passed、1 skipped、0 failed），startup analyzer 9/9、release static 44/44、manual contract 14/14，均 exit 0
- [ ] 6.2 运行相关 Playwright smoke/feature/visual/responsive；Chromium 1200 已安装到隔离可写缓存，最新 production artifact 经 `web:preview` 运行 smoke 3/3 通过，主画布合同在不点击/填写轻壳的情况下等待完整 AI 输入栏自动出现后继续验证；零交互独立探针记录 342ms 自动挂载、轻壳归零、无焦点抢占、应用请求失败 0。feature/visual/responsive 全矩阵尚未全部执行，因此保持未完成
- [x] 6.3 运行 `drawnix:typecheck`、`web:typecheck`、相关回归、cycles、`git diff --check`、`NX_DAEMON=false pnpm exec nx build web`、`NX_DAEMON=false pnpm exec nx build drawnix --skip-nx-cache`、startup contract 与 `verify:startup`：类型检查/build/diff 均 exit 0，Drawnix JS 与 `vite-plugin-dts` 声明生成无 TypeScript diagnostics，0 cycles；独立 declaration-only 合同扫描 1,071 个声明且关键入口/浮层声明完整。最终 `drawnix-app` 481,924B、入口静态图 1,941,175B、所有单文件不超过 512,000B。全仓 lint 仍 exit 1，但当前 433 errors / 2,441 warnings 相对 HEAD 439 / 2,471 减少 6 / 30，本 change 新增 diagnostics 为 0
- [x] 6.4 用同口径重跑四组各 5 次并报告原始值、中位数、范围、请求/正文和代价；另以 10 次 cold/SW-off 强制门槛确认中位 313ms、最大 375ms、18 请求、1,989,484B，禁止资源和页面/HTTP 失败均为 0。原四组 warm/SW-on 第 2 次有一次 `startup-app` `ERR_ABORTED`，页面仍可操作；稳定 2 秒后追加 5 次均未复现，保留原异常且不推测原因
- [ ] 6.5 复审 Chat/AI 首次交互、任务/工作流恢复、升级、离线与多标签页路径（最终产物已验证 Chat/AI、菜单/工具/Minimap 和 warm offline；任务/工作流真实恢复、升级与多标签页浏览器路径仍未在本轮重新执行）

## 7. Dependency Security & Compatibility

- [x] 7.1 运行冻结锁安装/收敛检查，确认 SheetJS 官方 tarball、Mermaid、uuid 与 `@swc-node/core` 解析结果写入唯一 lockfile
- [x] 7.2 运行 SheetJS 中文字段/多工作表往返和 Mermaid strict 合同：2 files / 3 tests，exit 0
- [x] 7.3 运行 `pnpm audit --prod --json`：464 production dependencies，0 vulnerabilities，exit 0
- [x] 7.4 使用 lock importer/resolution 与 `pnpm why` 复核实际消费者和精确版本；不执行 Nx、Vite、Vitest 或 React 大版本迁移
- [x] 7.5 记录完整工具链审计剩余风险：1,592 dependencies、3 moderate、0 high/critical，exit 1；其中 2 个来自 `@swc/cli → downloader → file-type`、1 个来自 Nx 19 `nx graph` CORS，不把生产审计通过误写为全依赖无风险
- [x] 7.6 根据 Node 官方发布计划将项目 engines 收敛到 22.x，并将 CI 与 Docker builder 从 2026-04-30 已 EOL 的 Node 20 迁移到精确版本 `22.23.2`；builder 固定 linux/amd64 `bookworm-slim@sha256:0f654709…c7e00`，frozen install 独立于源码和 release identity 形成可复用层；本机 Node 22 全量测试/类型/构建已通过，最终 slim builder 兼容性由本次 amd64 发布镜像构建复验
- [x] 7.7 修复 Floating UI 四个导出 Hook 的 `TS2742` 非可移植声明，令 Vite 声明 diagnostics fail-closed，并增加独立 CI declaration-only 生成与关键文件/路径泄漏合同（3/3 测试、1,071 个真实声明扫描通过）
- [x] 7.8 将 GitHub quality、production build、production artifact smoke 拆成职责独立的 job；以六个 Nx 项目和 Drawnix Hover 的 schema v2 逐诊断 fingerprint/scope baseline 替换必然失败的裸 lint，补充新诊断、重复、动态消息、target/config/tool scope、文件退出扫描、Hover 崩溃、Nx 冷启动 JSON stdout、artifact 部分/完整重跑和单调 ratchet 合同；提交 `5184f16989dff8bf138def7f5ead7ecf2aee45b6` 的 GitHub run `30796609345` 已确认 quality、main、smoke、release-e2e 四个 job 全部 success

## 8. User Manual Static Document

- [x] 8.1 用实际响应确认 `/user-manual/` 返回 SPA shell，而 `/user-manual/index.html` 返回带手册标记的 18,467B 静态文档
- [x] 8.2 将应用菜单固定到 `./user-manual/index.html`，并增加禁止退回目录 URL 的合同
- [x] 8.3 验证 21 个生成 HTML 页面、`opentu-document=user-manual`、手册版本 1.0.2、SW 显式 HTML 路由和 release static 字节/标记合同（manual contract 14/14、release static 44/44）
- [x] 8.4 使用最终生产产物从应用菜单打开手册：新窗口为 `/user-manual/index.html`，marker/version 为 `user-manual`/`1.0.2`，sidebar/main 各 1、应用 `#root` 为 0，并成功跳转 `advanced-settings.html`
