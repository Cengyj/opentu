# Change: Refactor Startup Shell Loading

## Why

原 change 已完成一轮壳层拆分，但 2026-07-29 对当前源码和重新构建产物的复审确认启动边界再次发生漂移：

- `Drawnix` 初始渲染仍无条件挂载 `DeferredAIInputBar` 和 `ChatDrawer`。
- Web bootstrap 从根 `@drawnix/drawnix` barrel 导入 analytics release API，使生产 `bootstrap` 静态依赖 `ai-chat` 与 `tool-windows`。
- 当前 startup validator 的禁止组没有 `ai-chat`，且只限制单个入口资产 500KiB，不限制入口静态图总量，因此 `pnpm verify:startup` 错误放行。
- 当前生产构建在 1280×720、本机回环网络、冷 origin、SW 关闭的 5 次样本中，画布可操作前每次收到 39 个服务器请求和 5,859,060B 无压缩正文；5/5 样本都包含 `ai-chat-*`、`tool-windows-*` 与 `DeferredAIInputBar-*`，可操作中位数 1174ms（1152–1276ms）。
- 2026-08-03 复审确认启动页会无上限等待优先 CDN 的 `cdn-config.js`，且冷缓存下页面内三条调用链会重复探测同一 `version.json`；Service Worker 的普通 idle run 会把 manifest 所有分组追加到明确请求/default，当前产物可扩张到约 18.8MB，而不是只预取所请求的组。
- 后续入口图追踪确认应用菜单、MoreTools、Minimap、Asset/缓存运行时和精细擦除布尔运算会在用户尚未使用这些能力时进入启动资源；按真实激活边界完成拆分并让 CacheQuota idle/runtime 消费统一 `isStartupOperable` 门槛后，最终生产构建的 `drawnix-app` 为 481,924B、入口静态图为 1,941,175B，所有单文件均不超过 512,000B，未通过提高预算完成验收。
- 用户手册故障的实际响应已定位：目录 URL `/user-manual/` 被 SPA fallback 返回主应用，而显式静态文档 `/user-manual/index.html` 返回带 `opentu-document=user-manual` 标记的真实手册。菜单入口和发布静态合同必须使用显式文档地址，不能依赖目录重写。
- 生产依赖审计确认 Mermaid 10.9.3 位于实际聊天渲染链且存在已发布补丁；`xlsx@0.18.5` 也位于批量生图与模型基准的真实 Excel 导入/导出链。SheetJS 的 npm registry 版本不是修复来源，但上游官方 CDN 提供同一库的 `0.20.3` tarball，因此本 change 以真实中文字段、多工作表往返合同验证后升级，而不是更换解析器或继续保留已知风险版本。

上述修复前数据说明了重新打开该 change 的依据；最终产物数据只记录本次实现已经满足静态预算，不替代仍待完成的浏览器、离线和首次交互验收。整个修正保持现有生成、恢复和存储语义，并让校验覆盖真实依赖图。

## What Changes

- 拆分首屏画布壳层与延后功能层，非核心能力改为懒挂载或 idle 启动
- 为 Web 入口新增运行时轻量导出边界，避免启动服务通过 UI barrel 进入首包
- 为动态画布新增仅导出 `Drawnix` 的 app 子入口，并按依赖层稳定拆分首屏框架 vendor
- 为构建产物新增 `idle-prefetch-manifest.json` 与手动 chunk 分组
- 为 Service Worker 增加空闲预取消息与高频懒加载资源缓存能力
- 增加构建后校验脚本，守护首屏资源边界和入口体积
- 复审修正：bootstrap 的 analytics release API 也必须从轻量 runtime 边界导入
- 复审修正：Chat 抽屉未打开时不挂载；AI 输入在首屏只允许等尺寸轻壳，完整模型/工作流/生成依赖在首次交互或合格 idle 阶段加载
- 复审修正：Popup/Link/画笔设置/清空确认等可选画布浮层只在首次真实激活后挂载；工具元素渲染、工具设置、工具生图、PPT 图片覆盖与占位图生成只在对应元素或操作发生时加载
- 复审修正：刷新检查只在用户真实请求刷新时加载活动任务图，未刷新启动不静态引入 TaskQueue/生成依赖
- 复审修正：完整应用菜单、MoreTools 面板、Minimap、Asset/统一缓存重运行时和精细擦除变换分别延迟到真实打开、空闲/展开、统一 `isStartupOperable` 门槛后的空闲初始化或首次显式存储操作、有效多点擦除手势；动态加载必须单飞、失败可重试并忽略卸载后的迟到结果
- 复审修正：构建校验必须禁止 `ai-chat`、`diagram-engines`、`tool-windows`、`external-skills` 回流，并限制入口静态图总量，而不只检查单文件
- 补齐初始化失败、首次打开 Chat/AI、任务恢复与产物依赖图回归测试
- CDN 引导脚本采用有界等待，CDN 选择在单页面内共享同一个 in-flight 探测
- 普通 idle prefetch 只执行明确请求的分组或 manifest defaults；只有发布升级全量预热显式遍历所有分组
- 用户手册菜单固定打开 `./user-manual/index.html`，并由 Service Worker/static release 合同阻止显式手册 HTML 被应用壳替代；保持 21 个已生成页面、版本标记与站内链接完整性
- 将直接与传递 Mermaid 统一锁定到带安全修复的 `10.9.6`，将其 `uuid@9.0.1` 传递链收敛到 `14.0.1`，并将不可信聊天图表渲染切换为 strict security level
- 将 Excel 依赖升级到 SheetJS 官方 `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`，以批量模板中文字段和模型基准多工作表往返合同保护现有业务格式
- 将 Nx 19 / `@swc-node/register` 工具链使用的 `@swc-node/core` 精确锁定为与当前 SWC 依赖图兼容的 `1.13.3`，不在启动优化中进行 Nx、Vite 或 React 大版本迁移
- 将项目 Node engines 收敛到受支持的 22.x，并将 CI 和 Docker builder 从已经结束维护的 Node 20 升级到精确的 Node `22.23.2`；Docker builder 固定到 linux/amd64 `bookworm-slim` manifest digest，保持 glibc 构建兼容并减少浮动镜像与无关构建包暴露面；依赖清单/frozen install 与源码/release identity 分层，避免普通源码提交重复下载依赖
- 修复 Floating UI 对话框和浮层 Hook 的声明推断泄漏，以 `@floating-ui/react` 公开类型定义可移植返回合同；声明生成遇到 TypeScript diagnostics、缺失关键公开声明、pnpm 物理路径、绝对工作区路径或未声明的传递类型依赖时必须失败，并由独立 CI declaration-only 合同守护
- 修复 GitHub Actions 将既有 lint 债务误呈现为编译失败的问题：质量、生产构建与 production artifact 浏览器 smoke 使用职责独立的 job；完整 lint 改由版本化逐诊断 fingerprint 回归门禁执行，并锁定 Nx target、配置、工具版本和已扫描文件。任何新增 error、warning、重复次数、fatal parser error、scope 收窄或新增 Hover 违规都必须阻断 CI；历史诊断减少也必须显式收紧 baseline 后才能通过，禁止用 `continue-on-error`、总数阈值或关闭规则制造绿色状态

## Impact

- Affected specs: `startup-performance`
- Affected code: `apps/web`, `packages/drawnix`, `apps/web/src/sw`, `scripts`, user-manual static document contracts, root/package manifests and `pnpm-lock.yaml`
- Preserved data/API semantics: 不修改画板、任务、工作流、素材缓存或偏好数据格式；不改变模型/供应商路由；保持 `@drawnix/drawnix` 公开根导出兼容
- User-visible trade-off: Chat/AI 首次激活可出现局部 loading，但画布和输入轻壳布局不得跳动，且必须立即给出可访问的加载反馈
- Dependency scope: 继续使用 SheetJS API，但依赖来源改为上游官方 `0.20.3` tarball；Mermaid/uuid 与 SWC 工具链采用精确、可审计的兼容锁定。锁文件、Excel 往返、Mermaid strict 渲染、类型检查与生产构建是同一升级合同，不引入新的 Excel 格式或业务字段迁移
- Build runtime scope: 仅升级 CI 和 Docker 的构建 Node；最终 Nginx 运行时、浏览器 JavaScript 目标、应用数据与网络协议不变
