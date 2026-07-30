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

- [ ] 3.1 运行 OpenSpec CLI 校验（当前环境 CLI 不可用；文件核查已完成，工具阻塞不得伪造为通过）
- [x] 3.2 运行类型检查与构建，确认入口资源边界

## 4. 2026-07-29 Evidence Refresh

- [x] 4.1 重新确认 HTML → main → bootstrap → App → Drawnix 正反向启动链
- [x] 4.2 重新构建并记录当前 chunk raw/gzip 体积与 bootstrap 静态 imports
- [x] 4.3 在同机 1280×720 下完成冷/热、SW 关/开各 5 次启动基线
- [x] 4.4 验证 warm SW 在源站停止时仍可离线进入画布，并记录 SW 关闭对照
- [x] 4.5 修复 Vitest 使用 production React 和 App 占位测试，不改变产品行为
- [ ] 4.6 用户批准本次重新打开的加载语义、预算与验收阈值

## 5. Boundary Correction (approval required)

- [ ] 5.1 先增加会因当前 `ai-chat`/`tool-windows` 回流与总预算而失败的产物级测试
- [ ] 5.2 从轻量 runtime 导出 analytics release API，并移除 bootstrap 对根 barrel 的静态依赖
- [ ] 5.3 增加轻量 Chat controller/命令队列，未打开时不挂载完整 ChatDrawer
- [ ] 5.4 增加等尺寸 AI 输入轻壳，完整 provider/model/workflow 依赖首次交互加载
- [ ] 5.5 统一 Vite、idle manifest 与 validator 禁止组，入口静态图总 raw budget 设为 2,000,000B
- [ ] 5.6 补 Chat/AI 首次打开、命令不丢失、任务恢复、初始化失败和 warm offline 回归测试

## 6. Reverification

- [ ] 6.1 运行相关 Vitest、App/SW 集成测试和 startup validator，记录退出码与统计
- [ ] 6.2 运行相关 Playwright smoke/feature/visual/responsive；浏览器缺失时明确环境阻塞
- [ ] 6.3 运行 typecheck、定向 lint、全仓 test、cycles、build:web、size、verify:startup 并对照 baseline
- [ ] 6.4 用同口径重跑四组各 5 次，报告原始值、中位数、范围、请求/正文和代价
- [ ] 6.5 复审 Chat/AI 首次交互、任务/工作流恢复、升级、离线与多标签页路径
