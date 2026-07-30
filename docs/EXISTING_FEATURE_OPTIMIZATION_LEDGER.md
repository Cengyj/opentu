# Opentu 现有功能优化账本

> 建立日期：2026-07-29（Asia/Shanghai）  
> 工作目录：`/Users/macos/Downloads/opentu-codex-opentu-cleanup-20260708-145354`  
> 本文件只登记当前源码、规格、构建和运行证据；活动 change 的任务勾选不等同于当前实现已经验证。

## 1. 证据分类与状态

- **已证实事实**：由当前源码、产物、规格或命令退出码直接证明。
- **实测结果**：记录测量对象、条件、步骤、样本和原始值。
- **待验证假设**：只登记怀疑理由和验证方法，验证前不得据此改代码。
- **未知/阻塞**：缺少取得结论所必需的工具、凭据、历史或环境。

功能状态只使用：`未审计`、`调查中`、`已优化`、`已验证`、`阻塞`。

## 2. 环境与新鲜基线

### 2.1 环境

| 项目 | 结果 | 分类 |
| --- | --- | --- |
| Git 工作树 | 当前目录及父级没有 `.git` 元数据；**无法核对工作树和历史，也不能声明工作树干净** | 未知/阻塞 |
| Node.js | `v24.14.0`；最终复验时新 shell 的默认 `PATH` 不再含 `node`，改用 Codex 随附的同类 Node 运行时绝对路径执行，未安装工具 | 已证实事实 + 环境漂移 |
| pnpm | `11.9.0`；仓库 `packageManager` 声明 `pnpm@10.21.0` | 已证实事实 |
| Nx | `19.3.0` | 已证实事实 |
| OpenSpec CLI | 不可用；未安装，改用 `openspec/specs` 与 `openspec/changes` 文件核查 | 工具阻塞 |
| Playwright 浏览器 | Playwright 1.57.0 需要 `chromium_headless_shell-1200`，机器只缓存 revision 1228；使用可回滚临时 symlink 完成兼容性受限的 smoke/feature/visual/responsive 基线，随后已删除 symlink | 已证实环境差异；测试已运行但不能据此证明 revision 完全兼容 |
| 敏感配置 | 没有读取或打印 `.npmrc` 内容、API Key 或 Token；pnpm 只输出项目级认证设置被安全忽略的警告，未显示配置值 | 已证实事实 |
| 构建副作用 | `pnpm build:web` 更新 `apps/web/public/version.json`；已用构建前哈希精确复核并恢复 `version.json` 与 `index.html`。E2E 开发服务 watch 重写 `apps/web/public/sw.js`，运行前后内容哈希同为 `78a242d…977`，但更早历史因无 Git 仍未知 | 已证实事实 + 历史阻塞 |

### 2.2 命令基线

| 命令 | 退出码 | 统计/原始结果 | 归类 |
| --- | ---: | --- | --- |
| `pnpm typecheck` | 0 | 5/5 项目通过 | 通过 |
| `pnpm test` | 1 | react-board：1 文件/8 项通过；drawnix：188 文件中 181 通过、6 失败、1 跳过，1164 项中 1157 通过、6 失败、1 跳过；本次无未处理异常 | 6 个失败簇含 mock、超时、Blob/缓存环境与断言漂移，逐功能复核 |
| `pnpm lint` | 1 | 2026-07-30 修复扫描边界后，六项目共处理 1320 文件、448 errors / 2525 warnings：web 54/162、web-e2e 5/514、drawnix 377/1742、react-board 0/34、react-text 0/26、utils 12/47；精确排除 2099 个包内依赖文件和 3 个已证明生成/vendor bundle | 工具配置噪声已按 2102 files、3807 errors、6089 warnings 的算术闭环移除；门禁仍失败，但剩余均为项目/静态源码债务，不能按规则命中直接认定产品缺陷 |
| `pnpm check:cycles` | 0 | 静态运行时循环检查通过 | 通过 |
| `pnpm build:web` | 0 | 生产构建成功，7,931 modules，约 1m56s；SW 164.75 kB / 43.12 kB gzip；最大 JS 为 diagram-engines 938.39 kB、editor-engines 859.62 kB、ai-chat 845.76 kB gzip | 通过；Sass 废弃和静态/动态重复导入警告只登记为构建观察 |
| `pnpm size` | 1 | 唯一预算失败：AI Chat 844.43/140 kB gzip；Diagram 934.93/950 kB；Editor 858.24/870 kB；其余预算通过 | 已测预算失败；优化加载/拆包语义前需 OpenSpec 审批和可达链测量 |
| `pnpm verify:startup` | 0 | 四个启动资产均低于 512000 B，chunkCycles 为空；直接资产 startup-app 3776 B、startup-runtime 1867 B、入口 JS 345 B | 校验规则通过；与生产浏览器资源边界的覆盖缺口仍见 `STARTUP-001` |
| `pnpm e2e:smoke` | 0（预热服务器与临时 revision 映射） | 2/2 通过，17.1s；原始配置在默认受控 PATH 因硬编码 `npx nx serve web` 先发生环境失败 | 产品 smoke 可运行；配置自启动仍有工具环境依赖 |
| `pnpm e2e:features` | 1 | 默认 3 workers：0/3，均在 10s 内未见 `.drawnix`；单 worker：2/3，通过项分别 8.7s、6.8s，唯一稳定失败为断言“新建文件夹”而当前 UI 名为“新建目录” | 并发启动失败归为测试容量/时序；稳定失败归为 E2E 契约漂移，未据此修改产品 |
| `pnpm e2e:visual` | 1（runner）；报告服务停止后外层 128 | 默认 4 workers：3/40；单 worker：25/40。15 个稳定失败包含旧截图尺寸、动态 UI 稳定性、隐藏 Chat drawer 与重复 `.ai-input-bar` locator | 测试/快照漂移与潜在视觉变化混合，需逐功能对照规格和截图后归因 |
| responsive project（单 worker） | 1 | 修复前 3/11，8 项为 `.ai-input-bar` strict-mode 歧义；改用既有主输入 test id 后首轮 10/11，唯一失败为 375×667 工具栏/输入栏交叠 304 CSS px²；新鲜复验 9/11，除同一几何失败外 640×360 截图单次差异 12%，随后同项 2/2 通过 | 定位器漂移已作无产品行为修复；304 px² 为已证实移动布局缺陷并等待独立审批；截图波动根因待验证，未更新快照/阈值 |

单测与 E2E 失败目前只登记为基线，不在未完成完整调用链前盲修。较早章节中“Playwright 因浏览器缺失阻塞”的历史记录由本节 2026-07-30 新鲜复跑结果取代；各功能的业务状态不因测试变得可运行而自动标记完成。较早功能节中“全仓 lint 当前扫描包内 `node_modules`/vendor”的文字保留为当时基线历史，已由第 40 节的新鲜修复后结果取代；不得再用旧结论评价后续循环。

## 3. 当前可达入口事实

当前入口链已由源码重新确认：

`apps/web/index.html:1184` 启动控制器  
→ `apps/web/index.html:1467-1471` 开发态模块入口 / 生产构建对应入口资产  
→ `apps/web/src/main.tsx:70-84` 懒资源恢复监听与动态导入 bootstrap  
→ `apps/web/src/app/bootstrap.tsx:744-759` 挂载 React App  
→ `apps/web/src/app/app.tsx:32-36` 懒加载 `@drawnix/drawnix`  
→ `packages/drawnix/src/drawnix.tsx:869-932` 工作台 Provider 与画布壳。

内置工具清单由 `packages/drawnix/src/tools/built-in-manifests.tsx:25-176` 注册，共 12 项：多图生成、爆款视频生成、爆款 MV 生成、批量出图、爆款音乐生成、Chat-MJ、模型测试、我的提示词、香蕉提示词、动作场景库、知识库、音乐播放器。只把已进入该注册表或可达界面的代码计入现有功能。

## 4. 现有功能账本

场景缩写：`N` 正常、`E` 空态、`L` 加载、`F` 失败、`C` 取消、`R` 重试、`H` 刷新/关闭恢复、`O` 离线。表中场景是该功能必须审计的适用集合，不代表目前已经通过。

| ID | 完整用户意图与入口 UI | 场景 | 关键源码/数据边界 | 正式 OpenSpec / 活动 change | 主要测试证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 首次或刷新打开应用，尽快进入可操作画布，并可在版本、CDN、SW、懒 chunk 或 React 异常时恢复和完成显式升级 | N,L,F,H,O | `apps/web/index.html`；`apps/web/src/main.tsx`；`apps/web/src/app/bootstrap.tsx`；`apps/web/src/app/app.tsx`；`packages/drawnix/src/components/startup/*`；`packages/drawnix/src/components/version-update/*`；Cache API/SW/localStorage | `release-safe-static-loading`、`smart-cdn-loading` / `refactor-startup-shell-loading`、`fix-version-update-notification-delivery`、`improve-startup-recovery-interface-accessibility`、`improve-version-update-interface-accessibility` | App recovery/persistence 2/2；app-shell/CDN 20/20；ErrorFallback、升级早/晚事件和英文/语义受控诊断 4/4；startup validator、smoke/page visual | **调查完成、实施阻塞：启动加载、升级通知 replay、启动恢复界面与升级界面分别等待四项独立审批；四个本轮问题均有源码/受控诊断证据，无生产行为改动** |
| F-02 | 从项目抽屉创建、搜索、切换、重命名、移动和删除文件夹/画板，并用键盘/辅助技术识别当前层级和状态 | N,E,L,F,C,H | `project-drawer/*`；shared SideDrawer/ContextMenu；`useWorkspace`；`workspace-service.ts`；IndexedDB/sessionStorage/URL | 无独立正式 spec / `fix-workspace-current-deletion-transition`、`improve-workspace-operation-failure-consistency`、`improve-workspace-manager-interface-accessibility` | workspace 3/3 files、27/27；ProjectDrawer受控诊断1/1；1280×720生产DOM/焦点/两张before截图；正式Playwright/compact视口阻塞 | **调查完成、实施阻塞：WORKSPACE-001 已修复；删除转场、存储失败一致性与项目树keyboard/focus/search/i18n分别等待三项审批** |
| F-03 | 编辑画板后自动保存，关闭/刷新/多标签页后恢复，并可备份、还原或 GitHub 同步 | N,E,L,F,C,R,H,O | `app.tsx`；`workspace-storage-service`；`workspace-migration`；`backup-restore/*`；`github-sync/*`；BackupRestoreDialog/SyncSettings/RecycleBin/TokenGuide；IndexedDB/localStorage/sessionStorage/network | `backup-restore` / `fix-backup-restore-current-board-transition`、`improve-backup-sync-interface-accessibility`、`enforce-github-token-encryption` | `app-persistence.spec.tsx`、backup/GitHub 5文件36项、受控界面4项、Token fallback 1项、1280×720生产DOM/焦点/两张before截图 | **调查完成、部分验证：WORKSPACE-PERSIST-001 与文档漂移已修复；恢复转场、界面可访问性/i18n/密码呈现和 Token fail-closed 等待三项审批；TAB-SYNC冲突语义及compact/正式Playwright阻塞** |
| F-04 | 在画布中缩放、平移、搜索、小地图导航、选择/锁定/多选并使用快捷键 | N,E,F,C,H | `view-navigation/*`；`canvas-search/*`；`minimap/*`；`multi-selection-handles/*`；`with-hotkey`、selection utils | 新增待审批 `improve-canvas-navigation-accessibility` | `with-hotkey.test.ts`、`selection-utils.test.ts`、CanvasSearch/LayerPanel replacement、react-board value replacement、interaction/responsive visual、应用内 Chromium | **部分验证：搜索漏项/替换陈旧与图层锁定分叉已修复；导航无障碍待审批；正式 Playwright受浏览器环境阻塞；性能仍为未证实假设** |
| F-05 | 创建和编辑图形、箭头、自由绘制、画笔、文本、链接、粘贴与样式 | N,E,F,C,H | `plugins/*`；`popup-toolbar/*`；`fill-panel/*`；`unified-color-picker/*`；Plait history | `canvas-markdown-toolbar`、`canvas-text-to-speech(-toolbar)` / 新增待审批 `improve-canvas-editing-toolbar-accessibility` | pencil/pen/freehand/text/colour/size tests、应用内 Chromium、drawing/interaction visual（正式 Playwright 阻塞） | **部分验证：尺寸取消与擦除竞态已修复；编辑控件/Tab 无障碍待审批；性能、视觉矩阵和正式 Playwright 阻塞** |
| F-06 | 把已有图片、视频、音频放入画布，预览、变换，并在刷新后恢复 | N,E,L,F,C,R,H,O | `with-image`；image/video/audio data helpers；`media-preview`；image editor；asset/cache；board serialization | `media-preview` / `add-image-3d-rotation-control`、`update-canvas-batch-flow-layout`、三个 F-06 待审批 change | media poster/thumbnail、media fit、image 3D、anchor、WorkZone、batch insertion tests | **部分验证：3D 切选回滚、海报失败降级和远端签名 URL 已修复；预览无障碍、编辑保存恢复和拖放汇总反馈待审批；真实媒体浏览器矩阵阻塞** |
| F-07 | 在底部 AI 输入栏选择生成类型/模型/参数，添加附件、选中内容和知识上下文，优化 prompt 后提交 | N,E,L,F,C,R,H,O | `ai-input-bar/*`；selection/context/prompt services；local preference storage；task/workflow handoff | `ai-input-generation`、`prompt-optimization` / `add-ai-input-paste-images`、`add-ai-generation-state-persistence`、`add-model-scoped-generation-preferences`、`add-generation-context-library`、`improve-ai-input-control-accessibility` | AI input parser/model dropdown/prompt optimize/context tests、AI-input visual/manual | **调查中：解析器测试契约与参考图尺寸索引已修复；三视口粘贴范围/重复/删除、reload与tab重开偏好恢复已验证；空目标模型残留/可提交及输入/附件a11y、移动遮挡等待审批，生成参与和多profile UI夹具阻塞** |
| F-08 | 从独立 AI 图片/视频生成弹窗配置模型、参数、参考图和知识上下文，提交任务，查看进度/结果，并预览、下载、重试、编辑或插入画布；完成结果可从恢复任务集访问 | N,E,L,F,C,R,H,O | `ttd-dialog/ai-{image,video}-generation*`；shared WinBox；`DialogTaskList`；`useTaskQueue`；task queue/media executor；task storage；unified cache；board insertion | `image-generation`、`image-generation-feedback` / generation state/preferences/context、`improve-generation-dialog-task-creation-feedback`、`fix-generation-dialog-maximized-viewport-resize`、`fix-winbox-minimum-size-consistency` | generation dialog/state/history/task queue/media executor/insertion tests、1280×720 shared WinBox和移动旋转应用内浏览器证据；正式 Playwright 阻塞 | **调查中：手动插入追踪已修复；任务创建反馈、旋转响应式与WinBox minimum/restore一致性等待审批；供应商成功流凭据阻塞** |
| F-09 | 配置供应商，发现/排序模型，选择协议与能力版本，健康检查并保存偏好 | N,E,L,F,C,R,H,O | `settings-dialog/*`；`provider-routing/*`；model adapters/health/discovery；IndexedDB/localStorage/network | `provider-routing`、`runtime-model-discovery` / 模型路由 change 簇及 `improve-provider-model-settings-accessibility` | model sort/grouping/discovery/provider/health/adapter/settings tests；1280×720 provider DOM/语义/截图 | **调查完成、实施阻塞**：共享排序已修复；发现竞态/fallback 与跨 profile registry 等待 3 项审批，health/retry binding 等待产品语义；provider表单/开关、模型管理语义和F-09 zh/en内容等待独立审批，compact/theme/populated discovery运行时仍阻塞 |
| F-10 | 在任务面板查看任务进度，控制并发、取消、重试、恢复、历史与结果落盘 | N,E,L,F,C,R,H,O | `task-queue/*`；`task-queue-service.ts`；`media-executor/*`；task storage；RxJS；IndexedDB | 相关要求分散于生成规格 / `add-suno-lyrics-task-and-canvas-flow`、`refactor-sw-duplex-comm`（前提冲突）、三个执行/存储 change 及 `improve-task-queue-responsive-accessibility` | task queue/storage/retry/executor tests、toolbar smoke、1280/390/320 DOM/焦点/语义/几何与组件诊断 | **调查中：角色任务分发已修复；并发/取消/GitHub 持久化及任务界面 a11y/320px/i18n 等待审批；两个不可达旧组件已清理** |
| F-11 | 提交工作流，看到解析、动态步骤、执行、后处理、失败恢复与各 UI 状态同步 | N,E,L,F,C,R,H,O | AIInputBar direct MCP；WorkflowContext/Chat/WorkZone；task snapshots/events；legacy `MainThreadWorkflowEngine` recovery | `ai-input-generation` / `refactor-workflow-shell`、`refactor-ai-json-response-parser`、`fix-main-thread-workflow-recovery-sync`、`improve-workflow-status-interface-accessibility` | converter/engine/hook/linking/sync/bubble/WorkZone tests；真实组件 2/2；390/320 几何、2张before截图、6项对比度 | **调查完成、部分验证：恢复 owner 与 Chat/WorkZone UI 链已重建；测试/文档漂移和一个不可达renderer已清理；恢复/竞态/重复投影/终态及UI键盘/进度/i18n/compact/contrast分别等待两项审批** |
| F-12 | 在 Chat Drawer 创建/切换会话，发送文本/图片，查看流式回复与 Agent/MCP 结果，并在刷新后恢复消息和会话元数据 | N,E,L,F,H；当前普通 Chat 的 C/R 无可达 UI | `chat-drawer/*`；`useChatHandler`；chat/Gemini/provider services；localForage；task/workflow streams；backup | `agent-image-understanding`、`backup-restore` / `fix-chat-message-persistence-consistency`、`fix-chat-inflight-session-isolation`、`improve-chat-drawer-interface-accessibility`，邻接 `fix-main-thread-workflow-recovery-sync` | 8 个 Chat/input/message/provider focused files；真实 localForage+fake-indexeddb 的 Agent patch 顺序诊断 1/1；UI 3/3 files、8/8；1280/390/320 DOM/焦点/几何与4张before截图；正式 Playwright 阻塞 | **调查完成、实施阻塞：累计流日志与无调用 session hook 已修复；Agent workflow 初始 patch 丢失已实测确认；持久化/计数、忙提交/会话隔离和 Drawer shell/session/composer UI 分别等待三项审批** |
| F-13 | 从素材库筛选、预览、收藏、批选、插入和删除资产，并得到配额/缓存/离线反馈 | N,E,L,F,C,R,H,O | `media-library/*`；`AssetContext`；asset/task/cache services；IndexedDB/Cache API/localForage | `media-cache-warnings`、`media-preview` / `update-video-character-asset-reuse`、`fix-media-library-responsive-interaction`、`fix-media-library-selection-contract`、`ensure-media-library-write-consistency`、`refresh-media-library-projection-on-open` | AssetItem/inspector、asset dedupe/utils、cache/image tests；应用内 Chromium 几何/筛选截图；受控多存储失败与TTL时序；正式 Playwright 阻塞 | **调查中：主体徽章投影已红绿修复；响应式、筛选/标签/失败恢复、多存储一致性和重开新鲜度等待四项审批** |
| F-14 | 从 AI 输入历史或工具箱打开“我的提示词”，搜索/筛选/预览/复制/创建/编辑/置顶/删除提示词并复用任务代际记录 | N,E,L,F,C,R,H,O | `prompt-history/*`；`PromptHistoryPopover`；prompt history/storage services；task reader/queue；backup；IndexedDB/PostHog | `prompt-history`、`backup-restore` / `preserve-archived-prompts-in-history`、`improve-prompt-history-dialog-accessibility`、`ensure-prompt-storage-write-consistency` | prompt-history service/tool/popover、task-reader、storage、backup、analytics privacy tests；应用内浏览器证据 | **调查中：测试 mock 已修复；归档可见性、弹窗可访问性和存储一致性等待审批** |
| F-15 | 从工具箱查找/启动工具，在多窗口、嵌入画布和 iframe 中固定、最小化、关闭并遵守权限 | N,E,L,F,C,H,O | toolbox drawer；tool registry/window service；tool element；WinBox；iframe sandbox；localForage/localStorage；当前 GitHub custom-tool sync 不可达 | `toolbox`、`toolbox-plugin-runtime` / `refactor-toolbox-plugin-runtime`、`improve-toolbox-entry-accessibility`、`ensure-toolbox-initialization-consistency`、`ensure-custom-tool-write-consistency`、`remove-deleted-custom-tool-runtime-state`、`fix-tool-window-viewport-transition`、`improve-tool-window-accessibility` | tool-window-service、受控初始化/写失败/删除诊断、Drawnix/toolbox E2E/manual/visual、应用内 Chromium几何与可访问性证据 | **调查中：六项用户可观察改动等待审批；两项无消费者实现已清理并完成定向验证；正式 Playwright 阻塞** |
| F-16 | 在“多图生成”中规划多页提示词、批量生成、恢复历史并导出 ZIP/PPTX/PDF | N,E,L,F,C,R,H,O | `comic-creator/*`；task sync/storage/export；image generation/cache | 无正式归档 spec / `add-comic-strip-generator`、`fix-comic-creator-record-consistency`、`improve-comic-creator-responsive-accessibility` | 4 个定向文件 33/33；应用内 Chromium 几何/DOM/截图；受控真实 storage 竞态；正式 Playwright 阻塞 | **调查完成、部分验证：部分完成项目的 PPTX/PDF 导出已修复；记录一致性/恢复/保存反馈、窄窗响应式和表单 a11y 等待审批** |
| F-17 | 在“爆款视频生成”中提交视频或 prompt/PDF，分析脚本、生成镜头/视频、恢复历史 | N,E,L,F,C,R,H,O | `video-analyzer/*`；batch video utils；workflow/task/cache/storage | `video-analyzer`、`video-batch-generation` / creative brief、PDF、parallel、character reuse、workflow shell、`fix-video-analyzer-record-consistency`、`improve-video-workflow-form-accessibility` | 24 个 F-17/shared workflow 定向文件、应用内 Chromium 几何/DOM/键盘证据；正式 Playwright 阻塞 | **调查完成、部分验证：重复完成记录与恢复错误不可见已修复；批量规格冲突待决策，记录一致性/恢复/表单 a11y/外层窗口改动等待审批** |
| F-18 | 在“爆款 MV 生成”中创建音乐与分镜视频、复用主体素材、恢复记录并导出 | N,E,L,F,C,R,H,O | `mv-creator/*`；shared workflow；audio/video services；task/cache/storage | `video-mv-workflow-parity`、`video-batch-generation`、`audio-generation` / creative brief、character reuse、parallel、workflow shell、`fix-mv-creator-record-consistency`、`improve-mv-creator-navigation-accessibility` | 17 个 MV/shared workflow 定向文件 59/59；3 张应用内 Chromium 截图/DOM/几何；受控真实 storage 竞态；正式 Playwright 阻塞 | **调查完成、部分验证：MV Script 主体素材规格恢复及无消费者清理已验证；批量规格冲突待决策；记录/恢复/持久化反馈、表单/导航和外层窗口等待审批** |
| F-19 | 在“批量出图”中批量编辑参数和参考图、提交多任务、追踪历史并插入结果 | N,E,L,F,C,R,H,O | `batch-image-generation.tsx`；tool adapter/WinBox；kvStorage/IndexedDB；asset library；task queue/storage/RxJS；auto canvas insertion | `image-generation` / `fix-batch-image-cache-initialization`、`improve-generation-dialog-task-creation-feedback`、`improve-batch-image-accessibility`，邻接两个 tool-window change | 8 个任务/偏好/插入定向文件 52/52；3 张应用内 Chromium 截图、DOM/几何/静态时序证据；正式 Playwright 阻塞 | **调查完成、实施阻塞：缓存迟到覆盖、任务创建反馈和表格 a11y 等待审批；task restore/cancel/retry 语义与性能假设未闭合；外层窗口复用既有 change** |
| F-20 | 在“爆款音乐生成”中分析音频、改写歌词、提交 Suno、恢复历史并生成音频/歌词产物 | N,E,L,F,C,R,H,O | `music-analyzer/*`；audio API/adapter；shared workflow；task/storage/cache/board | `audio-generation` / Suno routing、music brief、lyrics、4 项 F-20 独立 change 及 5 项邻接 change | 9 个 F-20 定向文件 48/48；clip_id 红绿测试；受控 storage 竞态；3 视口 Chromium DOM/几何/截图；正式 Playwright 阻塞 | **调查完成、部分修复已验证：provider 行 ID 不再进入 Music Analyzer 续写标识；记录/恢复、缓存、错误安全、a11y、取消、部分提交和外层窗口改动等待审批** |
| F-21 | 打开 Chat-MJ、香蕉提示词和动作场景库外部 iframe 工具，并安全导航/关闭 | N,E,L,F,C,H,O | built-in manifests；URL template；tool-window service；ToolWinBoxManager；canvas ToolGenerator；iframe permissions；external network | `toolbox`、`toolbox-plugin-runtime` / `secure-external-tool-credential-launch`、`improve-external-iframe-load-recovery`、`allow-banana-prompt-clipboard-write`，邻接 F-15 changes | tool-window service 4/4；sentinel 2/2；公开 Banana bundle/hash；policy 三组5/5；1280/768/390 Chromium DOM/几何/7截图；正式 Playwright 阻塞 | **调查完成、实施阻塞：凭据交付/全入口门禁、加载恢复与 Banana WinBox 最小写权限分别等待三项审批；移动/平板当前态已实测，dark/English/正式 E2E 等仍阻塞** |
| F-22 | 在“模型测试”中批量比较模型速度/成本/结果，保存评价与复测 | N,E,L,F,C,R,H,O | `model-benchmark/*`；benchmark service/storage；provider routing；Workbench content UI | `toolbox` / `add-model-benchmark-workbench` 及 5 项 F-22 待审批 change；窗口邻接 F-15 | pure test 6/6；隔离 storage/lifecycle/privacy/handoff 8/8；1280×720 DOM/状态/label/几何/截图；正式 Playwright 阻塞 | **事实建模完成、实施阻塞：成本/排序/停止、存储、生命周期、诊断、快捷交接和内容state/label/i18n等待审批；设置快捷点击缺模型；compact/theme/正式E2E阻塞** |
| F-23 | 在知识库中创建/编辑 Markdown、嵌入媒体、搜索、导入导出并作为生成上下文 | N,E,L,F,C,R,H,O | `knowledge-base/*`；Markdown editor/readonly；KB services；IndexedDB/network sync | `markdown-media-embeds`、`canvas-markdown-toolbar`、`backup-restore` / generation context library 及 7 项 F-23 待审批 change | KB import/export/sync/markdown/media/context 9 文件 41/41；search冷/暖并发4/4诊断及0/100/1000篇各5次基线；390×844 Chromium 几何 | **调查完成、部分验证：缺失素材占位已修复，两组无消费者已清理；保存/搜索最新结果/索引并发、多 store/响应式/a11y/i18n 等待 7 项审批** |
| F-24 | 在音乐播放器和画布音频节点中选择、播放、切歌、恢复播放列表并联动 | N,E,L,F,C,R,H,O | music-player tool；audio-node-element；audio playlist/playback services；asset cache；Web Speech；localForage/localStorage；backup | `canvas-audio-playback`、`backup-restore` / `refactor-toolbox-plugin-runtime`、3 项 F-24 待审批 change；邻接 media/tool-window changes | permanent playback 20/20（jsdom）+ playlist 3/3、组件 1 skipped；隔离播放/playlist/Context 10/10；1280×720 Chromium DOM/截图/5次暖恢复；正式 Playwright 阻塞 | **事实建模完成、实施阻塞：最新播放意图、播放列表写入/恢复/UI投影和浮层a11y等待3项审批；outer WinBox复用既有change；响应式/正式E2E阻塞** |
| F-25 | 创建/编辑/重排 Frame/PPT，预览媒体适配并导出 PPT/PDF 等格式 | N,E,L,F,C,R,H,O | frame element；`services/ppt/*`；MCP PPT tool；office chunks；board data | `ppt-editing`、`ppt-outline-generation` / `report-ppt-export-content-loss`、`improve-ppt-editor-accessibility`、`localize-ppt-editor-workflow` | 页序/Undo 3/3；PPT/Frame 10 files、84/84 executed；2页真实导出路径渲染/overflow/OOXML；1280×720 Chromium；正式 Playwright 阻塞 | **调查完成、部分验证：拖拽后播放/outline/export 页序分叉已修复；导出内容丢失、a11y、i18n 等待 3 项审批；响应式/英文运行时/provider/正式 E2E 阻塞** |
| F-26 | 在设置和工具栏配置主题、颜色、语言、模型、同步与错误反馈 | N,E,L,F,C,R,H,O | settings dialog/shared WinBox/nav；toolbar config；i18n；board theme/color tokens；reachable SyncSettings；localStorage/IndexedDB | 相关要求分散 / `update-ui-color-system`、model/profile changes、hover tip、6 项 F-26 change及shared `fix-winbox-minimum-size-consistency` | 5 个定向文件 36/36；1280×720设置/菜单与390×844、320×568、640×360应用菜单 Chromium 证据；持久化/WinBox/TTS隔离；toolbar反序完成1/1及3张before截图；正式 Playwright 阻塞 | **事实建模完成、部分验证：无调用同步状态组件已清理，TTS 380ms与通用z-index统一候选关闭为非问题；toolbar whole-record race、应用菜单/Settings层叠及compact菜单32px目标已确认；菜单/开关、共享设置窗口/导航 a11y、shared WinBox geometry、通用设置写、toolbar sequential/order写一致性及应用菜单层叠等待 7 项审批；语言持久化缺产品语义，完整responsive/theme/language矩阵仍未闭合** |
| F-27 | 查看 Web Vitals 与性能面板，在崩溃/初始化失败时恢复或导出不泄露敏感信息的诊断日志 | N,E,L,F,C,H,O | analytics/PostHog；page report/Web Vitals；crash logger；unified log；localStorage/SW/IndexedDB；application/SW-debug export；performance panel | 无独立正式 spec / startup、SW transport、provider-domain changes；新增 4 项 F-27 待审批 change | 4 个隔离 sentinel/组件诊断进程，4/4 files、10/10 tests；final PostHog/Blob/SW sink；缺正式 E2E | **事实建模完成、实施阻塞：页面分析、通用诊断边界、性能面板 a11y 与设置写一致性等待 4 项审批；无产品性能/视觉改动；正式浏览器矩阵待实施后验证** |
| F-28 | 在桌面、平板和移动端，以键盘/触控/屏幕阅读器操作上述功能，并保持深浅主题视觉一致 | N,E,L,F,C,R,H,O | responsive/theme/a11y styles and semantics；所有可达 UI；移动画布壳及feature-local evidence/owner pass | `update-ui-color-system` / 42项显式相关活动change；各功能保留独立owner | responsive既有基线、7视口画布壳；多功能受控/生产DOM、焦点、语义、几何与before截图证据 | **调查中：F-01～F-31已有feature-local evidence/owner pass；F-29已补clear-confirm与菜单compact/landscape实测但仍缺theme/high-DPI/full-language等状态，F-30/F-31也只有部分视口；实施多受审批门禁** |
| F-29 | 从应用菜单/快捷键/命令面板打开或保存 `.drawnix`，导出 PNG/JPG，并在确认后清空画板或清理失效媒体链接 | N,E,L,F,C,R,H,O | `app-toolbar/app-menu-items.tsx`；`command-palette/command-registry.ts`；`with-hotkey.ts`；`clean-confirm/*`；`data/{json,blob,types,drawnix-data-validation,embedded-media,filesystem}.ts`；`utils/{image,common}.ts`；board/history；Cache API/IndexedDB/file picker/download | 新增待审批 `prevent-network-failure-media-cleanup`、`stabilize-drawnix-file-export-snapshot`、`improve-drawnix-file-transfer-feedback`、`improve-canvas-clear-confirmation-interface`；F-03/F-26/F-31保留各自边界 | 4批隔离诊断最终5/5；`with-hotkey.test.ts` 21/21但不覆盖文件命令；1280×720、390×844、320×568、640×360生产DOM/焦点/几何及5张before截图；无专属永久round-trip/cleanup/clear-focus测试 | **事实建模完成、实施阻塞：前五项数据/反馈缺陷及clear-confirm返焦BODY、compact按钮62×36均有源码/隔离/生产证据，等待4项独立审批；导入viewport/theme意图、版本策略、cleanup timeout/并发性能和透明占位导出仍为假设/产品语义阻塞** |
| F-30 | 输入 Mermaid 或 Markdown，预览转换结果，并把流程图/思维导图插入当前画布 | N,E,L,F,C,R,H,O | creation toolbar/more-tools/command palette；`use-drawnix.tsx`；`ttd-dialog/{ttd-dialog,mermaid-to-drawnix,markdown-to-drawnix}.tsx`；lazy conversion packages；`board.insertFragment`；history/autosave | 正式 spec 无owner；新增待审批 `stabilize-text-conversion-preview-state`、`preserve-markdown-conversion-draft-feedback`、`improve-text-conversion-dialog-interface`；F-05/F-31分别保留基础编辑/命令面板壳 | 3个临时component diagnostics最终3/3 files、4/4 tests后删除；1280×720与390×844生产DOM/几何/4张before截图；无永久专属测试 | **事实建模完成、实施阻塞：旧解析覆盖新预览、当前输入pending/error仍插入旧结果、语言切换丢Markdown草稿、Markdown load错误标为Mermaid、dialog/input/error语义和390×844 action越界均有组件/生产证据，等待3项独立审批；成功insert/history/reload、完整主题/语言/视口与性能矩阵仍未验证** |
| F-31 | 打开快捷命令面板，搜索当前可用命令，用键盘或指针选择并执行，随后回到原工作流 | N,E,L,F,C,H | app menu/mod+K；`command-palette/{command-palette,command-registry,command-palette.types}.tsx/ts`；`DrawnixDeferredFeatures.tsx`；各命令目标仍归所属功能 | 正式 spec 无owner；新增待审批 `stabilize-command-palette-input-handling`、`improve-command-palette-interface-accessibility`；F-29/F-30及其他功能保留命令结果 | 临时component diagnostic最终1/1 file、2/2 tests后删除；1280×720、390×844、640×360生产DOM/几何/4张before截图；无永久专属测试 | **事实建模完成、实施阻塞：boundary whitespace false-empty、IME Enter误执行、shell/option/status语义缺失、Escape焦点落BODY、compact hit box低于44px、短横屏panel/active row越界及reduced-motion缺口均有组件/生产/静态证据，等待2项独立审批；目标成功/失败、完整主题/语言/视口与性能矩阵仍未验证** |

## 5. OpenSpec 活动变更冲突矩阵

`tasks` 计数只说明文件中的勾选状态。源码已实现多少、是否符合 delta spec，必须在对应功能循环中验证。

2026-07-30 文件级复核：新增 F-13 visible-open freshness approval-only change 后，共有 124 个非 archive change，全部带 delta spec；10 个 tasks 全勾选但未归档，102 个部分完成，12 个 0 完成；按当前 tasks 含 approval/批准/审批文本的机械复核为 95 个（只作门禁索引，不等同于批准状态）。按 delta capability 从当前目录重新分组的既有多-change重叠保持独立检查；F-23新增`knowledge-base-search-index-consistency`、F-29四个、F-30三个及F-31两个capability均各只有一个active owner；F-13新增3个、F-23新增3个、F-29的13个、F-30的9个与F-31的8个Requirement名称逐项机械搜索均全仓唯一。`media-library`已有四个边界互斥的active change，不能声称capability单owner；F-13 freshness只拥有closed-to-open投影读取，不接管write commit、selection或responsive语义。OpenSpec CLI 仍不可用，因此这些数字不是 CLI validate 结果。

| 活动 change | tasks | 关联功能 | 关系/冲突结论 | 当前处理 |
| --- | ---: | --- | --- | --- |
| `add-ai-generation-state-persistence` | 6/7 | F-07/F-08 | 与模型作用域偏好同时修改 AIInputBar 和图片/视频参数恢复；reload与tab close/reopen已实测恢复，空目标模型兼容过滤仍有已证实缺陷 | 合并调查；3.2等待关联change获批修复后验证 |
| `add-ai-input-paste-images` | 8/9 | F-07/F-13 | 复用上传、压缩、素材入库链；三视口真实粘贴已覆盖外部忽略、重复、素材成功反馈和删除；生成参与仍待受控无供应商 harness | 在 F-07 保留 task 3.1 未完成项 |
| `improve-ai-input-control-accessibility` | 2/11 | F-07/F-12/F-28 | AIInputBar 上传/素材库/发送缺名称；共享附件移除也缺名称、仅 hover 显示且16×16。change只拥有本地化名称、非提交类型和preview-local focus/coarse-pointer/≥24px契约；外层移动clearance仍归F-28 | 2 requirements/5 scenarios、三视口browser tree/geometry/截图与proposal/design/tasks/delta已人工校验，等待用户审批后实施 |
| `fix-mobile-toolbar-input-overlap` | 5/17 | F-28；邻接 F-07/F-26 | 640×360/375×667/360×640 下 collapsed unified toolbar 分别与 primary AI input 交叠 456/304/304 CSS px²，toolbar z=4031 覆盖 input z=100；只拥有 mobile clearance/safe-area/short-landscape geometry，不改 AI 提交、toolbar actions、global z-index、desktop/tablet 或其他 a11y change | 1 requirement/5 scenarios、7视口几何、375×667截图、proposal/design/tasks/delta 与唯一 requirement 已人工校验；strict exit127，等待用户审批后先红后绿 |
| `improve-task-queue-responsive-accessibility` | 6/24 | F-10/F-28；邻接 F-07/F-11/F-12/F-26 | 当前可达任务抽屉无名称/焦点进入返回/Escape 契约；状态/类型/选择/任务动作/进度语义不完整；320px 多选入口被裁切且现有文案不消费 zh/en Context。只拥有任务 surface 的 focus/semantics/announcement/localization/compact layout，不接管并发、取消、存储、歌词、错误内容、移动画布壳或 palette | 5 requirements/12 scenarios；1280×720 DOM/焦点、390×844 与 320×568 几何/截图、真实组件诊断已记录；4 必需文件、WHEN/THEN、唯一 requirement 和 owner 冲突已人工校验；strict exit127，等待用户审批 |
| `improve-workflow-status-interface-accessibility` | 7/28 | F-11/F-28；邻接 F-10/F-12 | Chat step/Agent detail为pointer-only，Chat/WorkZone无progress/live semantics，英文Provider仍中文；390px WorkZone target为24×24/24×24/115×26.5，320px长标题把`执行中`逐字竖排；两项small text contrast为1.90/4.41。只拥有两surface的disclosure/progress/labels/compact/contrast，不接管恢复、task projection、Chat shell、task drawer、global palette或dark mode | 5 requirements/11 scenarios；真实组件2/2、390/320 geometry、6项contrast、2张forced-light before截图；4必需文件、四级Scenario、WHEN/THEN、5个全仓唯一requirement和单owner已人工校验；strict exit127，等待用户审批 |
| `improve-chat-drawer-interface-accessibility` | 6/24 | F-12/F-28；邻接 F-01/F-07/F-11 | 390px关闭后唯一trigger和session actions均隐藏且0个可见Chat入口；1280→320→1280把640px宽度状态降为260px；title pointer-only/unnamed edit且Escape连带关Drawer，session row嵌套button/无Space/active语义，close后焦点落body，普通loading/error无bounded status，现有zh/en keys被绕过，compact actions为22–39.6px且resize为mouse-only。只拥有Drawer shell/session/ordinary-state/composer interface，不接管storage/inflight/workflow/startup/provider | 6 requirements/16 scenarios；UI窄测3/3 files、8/8，1280/390/320 DOM/焦点/几何与4张before截图；4必需文件、四级Scenario、WHEN/THEN、6个全仓唯一requirement和单owner已人工校验；strict exit127，等待用户审批 |
| `improve-canvas-navigation-accessibility` | 4/16 | F-04/F-28 | 搜索、缩放和 minimap 的 accessible name/keyboard/44px target/reduced-motion 与现有导航行为相邻；不接管画布编辑控件或全局视觉主题 | proposal/design/tasks/delta 已人工校验，等待用户审批后实施 |
| `improve-canvas-editing-toolbar-accessibility` | 0/14 | F-05/F-28 | popup toolbar 名称、状态、Tab 委托和 compact/touch 目标与 hover/color change 共享 UI 文件；只允许在 F-05 调用链内实施，避免横跨全仓扫改 | proposal/design/tasks/delta 已人工校验，等待用户审批后实施 |
| `improve-generation-dialog-task-creation-feedback` | 6/18 | F-08/F-19/F-20 | `TaskQueueService.createTask` 的具体校验错误在 `useTaskQueue` 被压成 `null`；图片/视频弹窗、批量出图和 Music Analyzer 1–4 个 AUDIO task 都存在全拒绝或中途部分接受反馈缺口；只改变安全错误/计数与 accepted task 关联反馈，不改校验、已接受任务和执行 | 2 requirements/10 scenarios、proposal/design/tasks/delta 与无同名 requirement 已人工校验；严格 CLI 退出 127，等待用户审批 |
| `fix-batch-image-cache-initialization` | 3/15 | F-03/F-19 | 可编辑默认表格与异步 whole-table cache hydration 并存；已接受编辑可被迟到旧快照替换。change 只在初始读取完成前建立可访问 loading/interaction gate，保留 key/schema/备份/后续写入；与 prompt/toolbox 初始化 change 是同类根因但不同 owner | 1 requirement/4 scenarios、静态 happens-before 与浏览器入口已人工校验；OpenSpec CLI 退出127，等待用户审批 loading/draft 语义 |
| `improve-batch-image-accessibility` | 3/17 | F-19/F-28；邻接 F-15 | 表格快捷键只有 pointer 先选单元格后才可达，inactive cells 无 grid/tab entry，多个 icon/checkbox 无稳定本地化名称；外层 WinBox dialog/focus/Escape 仍由 tool-window change 所有 | 2 requirements/5 scenarios、DOM属性、pointer→Enter/Escape与3视口截图已人工校验；等待用户审批 roving focus/grid/name 语义 |
| `fix-generation-dialog-maximized-viewport-resize` | 4/14 | F-08/F-28 | 图片/视频弹窗在移动横屏最大化后旋转到竖屏时，内容断点已切换但 WinBox 保留旧尺寸；变更只约束可见且最大化的生成窗口 | proposal/tasks/delta 与截图证据已人工校验，等待用户审批后实施 |
| `fix-winbox-minimum-size-consistency` | 7/25 | F-08/F-26/F-28；邻接F-13/F-15 | shared wrapper把percentage raw normal size与min-clamped DOM分叉；1280×720 Settings三轮634→634/680→634/680→634，image500→432，video600→432且initial bottom744；Media612→612为负对照。只拥有current-viewport cold/warm stored/rendered constraint、final center与max/restore一致性，不接管orientation、compact、tool/media transition、a11y或caller尺寸 | 2 requirements/8 scenarios；production三caller+负对照、shared/third-party只读根因链、proposal/design/tasks/delta人工校验；strict exit127，等待审批 |
| `improve-prompt-history-dialog-accessibility` | 4/14 | F-14/F-28 | 创建/编辑遮罩没有 dialog/modal/name 语义，焦点留在背景，Escape 不关闭；只调整嵌套表单的焦点/键盘/辅助技术契约，不改视觉、提示词或存储 | proposal/design/tasks/delta 已人工校验，等待用户审批后实施 |
| `improve-settings-toolbar-accessibility` | 5/17 | F-26/F-28 | 应用菜单的语言/图片导出子菜单只有 hover 打开，Enter 反而触发父菜单关闭；桌面 More 原生键盘 click 被触摸判断忽略；画布进度开关无程序化名称；390×844的13项均高32px，低于现有44px compact约定。只拥有这些既有入口及application-menu compact/coarse geometry，不接管 provider、WinBox、clear-confirm、canvas toolbar 或语言持久化 | 3 requirements/8 scenarios；1280×720 keyboard/tree、390×844 row、320×568与640×360内部滚动/active reveal及before截图；proposal/design/tasks/delta、唯一requirement和单owner已机械校验；等待审批 |
| `improve-canvas-clear-confirmation-interface` | 4/18 | F-29/F-28；邻接 F-26/F-31 | desktop menu Escape与390×844真实菜单路径pointer Cancel均在关闭后落BODY；320×568、390×844、640×360对话框完整入视口且锁滚动，但Cancel/Confirm均62×36。只拥有F-29三入口的非持久invocation owner/返焦和caller-scoped compact actions；F-26拥有menu rows，F-31拥有palette handoff，shared ConfirmDialog其余30 consumer不在范围 | 3 requirements/10 scenarios；desktop/compact焦点与三视口几何、2张补充before、4个必需文件、四级Scenario、WHEN/THEN、3个全仓唯一requirement和capability单owner已机械校验；strict CLI仍不可用，等待审批 |
| `improve-settings-surface-accessibility` | 7/28 | F-26/F-28；邻接F-09/F-15 | Settings root无dialog/name/focus；split/max/close为无name/role/tabstop的span；初开与close焦点落BODY、Escape不关闭；四视图current/panel关系缺失，shared title/nav固定中文。只拥有Settings-only WinBox opt-in、guarded focus/Escape、shared nav/panel和shell zh/en，不接管provider/TTS/preset/canvas内容、storage、global/tool WinBox、geometry/theme/compact | 3 requirements/11 scenarios；1280×720 DOM/焦点/状态/1张before截图，proposal/design/tasks/delta人工校验；strict exit127，等待审批 |
| `improve-provider-model-settings-accessibility` | 7/28 | F-09/F-28；邻接F-15/F-22/F-26 | 生产provider页6 input/2 select/3 switch均无程序化label；switch checked只在class；model group为click-only div，discovery filter/vendor/icon action缺state/name；三个内容模块不消费i18n。只拥有F-09 provider/model内容name/state/keyboard/zh-en，不接管discovery/routing/storage/credential/health/benchmark/shared nav/WinBox/compact/theme | 3 requirements/11 scenarios；1280×720 DOM/语义/1张before截图，4/4 files与25/25 pure tests；proposal/design/tasks/delta人工校验；strict exit127，等待审批 |
| `add-audio-generation-suno-routing` | 0/20 | F-08/F-09/F-10/F-20 | 与 provider protocol、profile、Suno lyrics 形成依赖栈；0/20 不能证明源码未实现 | 路由簇统一正反向追踪 |
| `add-comic-strip-generator` | 25/25 | F-16 | 注册表、源码、定向测试和浏览器证明工具已可达；F-16 复审发现部分导出偏离且已恢复，另有记录/恢复/响应式/a11y delta 等待审批；该基础 capability 仍未归档 | 先归档或与两个后续 F-16 change 共同批准，不能仅凭 tasks 全勾选认定闭合 |
| `fix-comic-creator-record-consistency` | 4/17 | F-10/F-16；邻接 F-17 | 真实 storage 并发诊断证明非冲突 patch 丢失；持久 task 恢复只为首项发通用事件；与 F-17 及 `fix-main-thread-workflow-recovery-sync` 共用 task-storage readiness，禁止产生多个全局 coordinator | 3 requirements/3 scenarios 已人工校验；等待用户审批 mutation ordering、唯一 readiness owner 与安全保存反馈 |
| `improve-comic-creator-responsive-accessibility` | 3/16 | F-16/F-28；邻接 F-15/F-17/F-18 | 400px 工具内容内模型输入越界 153 CSS px；多个表单/历史控件和共享导航缺少本地化名称；外层 WinBox 几何/焦点仍由既有两个 tool-window change 所有，`ModelDropdown` 命名 prop 需兼容视频/MV 表单 change | 2 requirements/3 scenarios、同视口截图和 DOM/几何已人工校验；等待用户审批后实施 |
| `add-creative-brief-workflow` | 8/8 | F-17/F-18 | 与 PDF start、主体复用、并行视频和 workflow shell 共享记录/提示词路径 | 视频工作流冲突簇 |
| `add-generation-context-library` | 9/9 | F-07/F-08/F-12/F-23 | 与 AI 输入、内部工具、任务轻量 refs 交叉；未发现直接冲突 | 各入口验证一致性 |
| `add-image-3d-rotation-control` | 10/10 | F-06 | 用户可见能力已进入现有画布链；PPT 明确降级 | 在媒体元素循环验证 |
| `improve-media-preview-accessibility` | 0/10 | F-06/F-28 | 与 `refactor-hover-tip-unification` 共用 `media-preview` 目录；本 change 只约束 dialog/focus/名称/状态/触控/reduced-motion，并明确复用共享 Hover 层 | 3 requirements/4 scenarios 已人工校验，等待用户审批后实施 |
| `improve-media-editor-save-recovery` | 0/9 | F-06 | 把编辑器的 void 保存链改为可等待成功边界，失败保留编辑态；不改缓存 key、元素 schema 或图片几何 | 1 requirement/3 scenarios 已人工校验，等待用户审批后实施 |
| `improve-canvas-media-drop-feedback` | 0/8 | F-06 | 与 `update-canvas-batch-flow-layout` 共用 `canvas-insertion` capability，但只约束用户直接拖放的成功/失败/不支持汇总，不改布局算法 | 1 requirement/4 scenarios 已人工校验，等待用户审批后实施 |
| `fix-media-library-responsive-interaction` | 4/16 | F-13/F-28 | 素材库仍以 800px minimum 打开于 390px viewport，且已有 mobile inspector 没有 true writer；与工具窗口 change 只共享可选 WinBox primitive，必须保持两个 caller 独立 opt-in | 2 requirements/4 scenarios、运行时几何/截图已记录；等待用户审批 compact fit 与显式移动端详情动作 |
| `fix-media-library-selection-contract` | 5/20 | F-07/F-13；邻接 F-05/F-06/F-12/F-17/F-18/F-23 | picker constraint 通过全局 filter mutation 泄漏且 grid 忽略 constraint props；batch label 丢失；插入 consumer 吞失败导致 modal 误关；不改布局、缓存或存储 | 3 requirements/5 scenarios、运行时筛选状态/截图和静态 callback 链已记录；等待用户审批入口隔离、标签和失败保留选择语义 |
| `ensure-media-library-write-consistency` | 7/24 | F-03/F-10/F-13；邻接 F-17/F-18/F-24 | local asset、unified cache、task、playlist、canvas 与 React projection 无跨 store transaction；受控 add/remove/cache-empty 3/3 样本和 delete/subject 静态链确认 false commit；不改 key/schema | 4 requirements/8 scenarios、proposal/design/tasks/delta 已人工建模；等待用户审批 compensation、per-item delete outcome 与 cache availability 语义 |
| `refresh-media-library-projection-on-open` | 4/20 | F-10/F-13；邻接 F-03 | persistent AssetProvider的8秒成功TTL吞掉closed→open freshness；t=1s task+cache已提交并notify后重开仍0卡且三源读取1/1/1，age=8001ms后才读取2/2/2并出现1卡。只拥有真实closed-to-open读取意图和existing single-flight，不接管write commit、live polling、selection、responsive或cross-tab push | 3 requirements/6 scenarios；Node24.14/Vitest3.2.4/jsdom 1/1受控时序、完整正反向链、3个唯一requirement及四个media-library change分权人工校验；strict exit127，等待审批 scoped extra reads/failure retry |
| `ensure-settings-write-consistency` | 4/13 | F-09/F-26；邻接 F-27 | shared manager 先改内存、主 localStorage 写失败后仍 fulfill 并通知；TTS 与 settings draft caller 会得到假成功。只拥有 primary record commit/rollback/safe rejection，明确不改 SW IndexedDB mirror、schema、语言或未测并发顺序 | 1 requirement/3 scenarios、静态 happens-before/逆向 caller 链、proposal/design/tasks/delta 和唯一 requirement 已人工校验；等待审批 commit-before-notify 与跨 caller 失败反馈 |
| `ensure-toolbar-config-write-consistency` | 5/13 | F-26 | remove/show/reorder/reset 先发布配置，IndexedDB write fire-and-forget 且只 console；正常 remove/reset 两次刷新均持久化，失败仍不可观测。只拥有 single sequential interactive durable outcome；已确认的 overlapping ordering 和 a11y 分属其他 owner | 1 requirement/3 scenarios、成功正对照、静态 rejection 链及ordering分权已人工校验；等待审批 awaitable commit/rollback/retry |
| `preserve-toolbar-config-mutation-order` | 4/15 | F-26 | 两次whole-record mutation无sequence owner；deferred boundary按newer→older完成后current `freehand=true`、durable/refresh `false`。只拥有同域semantic mutation accepted order，依赖 sequential outcome change；不接管cross-tab、unload、coalescing、schema或a11y | 1 requirement/4 scenarios；反序完成1/1、4/4文件、WHEN/THEN与全仓唯一requirement人工校验；同capability双owner有明确依赖，strict exit127，等待审批 |
| `fix-application-menu-window-stacking` | 6/20 | F-26/F-28；邻接F-15 | 应用菜单与Settings均computed z=5000，重叠114,395.25 CSS px²且3个topmost sample均命中Settings；shared Popover尾部5000覆盖caller层。反向inventory证明multi/URL tools默认new且无count guard，第501个registered window到5500，故否决fixed-5500-only。change只拥有per-Drawnix managed WinBox stacking host、向后兼容Popover layer与AppToolbar opt-in；不接管keyboard/focus、window geometry/activation值、global normalization或其他overlay | 2 requirements/6 scenarios；1280×720 rect/area/0-of-3 hit、两对照、before截图、6 static sites/5 files及unbounded writer/root seam、4/4 change文件和唯一requirement/capability owner人工校验；strict exit127，等待审批host boundary后先501+受控红测再实施 |
| `sanitize-page-analytics-context` | 4/12 | F-27；邻接 F-01 | page view/unload/visibility/SPA 与 Web Vitals 的 query/referrer sentinel 穿过真实 analytics sanitizer 到 final PostHog capture；只拥有 page origin/path 与 referrer origin payload，不改 PostHog 初始化/事件/metric，故与 startup change 无直接语义冲突 | 1 requirement/4 scenarios、final-sink 2/2 与完整正反向链已人工校验；strict exit127，等待审批 query/fragment-free page 与 origin-only referrer 语义 |
| `sanitize-diagnostic-capture-and-export` | 4/15 | F-27；邻接 F-10/F-20/F-22 | crash/unified/application/SW-debug 的 capture/storage/display/copy/export 缺统一 bounded boundary；只拥有通用 sink defense。模型测试与 Suno changes 仍负责域内 source normalizer，SW duplex只拥有transport机制 | 1 requirement/5 scenarios、crash/export/unified sentinel 6/6 与network URL正对照已人工校验；strict exit127，等待审批 bounded/redacted projection 与forward-only legacy handling |
| `improve-performance-panel-accessibility` | 4/13 | F-27/F-28 | 四个icon action无programmatic name、move handle为pointer-only；只改PerformancePanel semantics/keyboard movement，不改shared HoverTip、threshold/polling、visual layout或storage | 1 requirement/4 scenarios、真实组件DOM 1项a11y诊断与正反向入口已人工校验；strict exit127，等待审批localized name/state与bounded Arrow movement |
| `ensure-performance-panel-write-consistency` | 4/13 | F-27 | pin/position shared localStorage writer吞错仍publish UI；与shared settings/toolbar store完全不同，只拥有panel key的commit/drag-end/rollback/feedback；明确不建global settings抽象或queue | 1 requirement/5 scenarios、QuotaExceeded failure injection 1项与唯一reader/writer链已人工校验；strict exit127，等待审批commit-before-publish和drag-end durable outcome |
| `fix-knowledge-base-editor-save-durability` | 4/15 | F-23 | 标题/正文共用 timer 导致交叉取消，切换/卸载清除 pending save，async reject 无 truthful UI；不承诺强杀进程/断电 durability | 3 项受控诊断已记录；等待用户审批 draft merge、transition flush 和 retry 语义 |
| `fix-knowledge-base-search-result-ordering` | 3/12 | F-23 | 迟到旧 query 可覆盖当前 query/filter 结果；只拥有 UI request identity/commit，不合并由独立change拥有的索引 build/sync singleflight | A/B deferred 乱序 1/1 诊断已记录；等待用户审批最新意图语义 |
| `stabilize-knowledge-base-search-index-initialization` | 4/15 | F-23 | UI search、related notes、MCP共享singleton；cold并发把1篇索引成2条，warm并发把2篇索引成3条并重复store reads。只拥有engine build/sync in-flight operation与共享failure/retry，不接管UI latest-query、scoring、multi-store写、worker或persistent index | 3 requirements/9 scenarios；cold 3/3与warm 1/1受控诊断、0/100/1000篇各5次Node/jsdom基线；4必需文件、WHEN/THEN、3个唯一requirement与single owner已机械校验；strict exit127，等待审批 |
| `ensure-knowledge-base-write-consistency` | 5/21 | F-03/F-23；邻接 GitHub sync | create/update/delete/tag 和 backup/GitHub apply 可跨六个 store 部分提交；保持 schema/backup v1-v2，使用 scoped snapshot/compensation/partial result | 4/4 failure injection 与批导入静态顺序已记录；等待用户审批 |
| `fix-knowledge-base-responsive-layout` | 5/17 | F-15/F-23/F-28 | 390px viewport 中 body scrollWidth 982px，主动作不可达；只对 KB opt-in 复用窗口 viewport primitive，内部 compact pane/44px 由本 change 所有 | DOMRect/390×844 截图已记录；等待用户审批 compact fit、focus 与 desktop width 保留 |
| `improve-knowledge-base-accessibility` | 4/15 | F-23/F-28 | tree/virtual Skill/related/context menu 为 pointer-only，图标动作无 name/state；compact 44px 由 responsive change 所有，名称复用 localization 消息源 | 4 requirements/8 scenarios 已人工核验；等待用户审批键盘/menu/focus 语义 |
| `localize-knowledge-base-interface` | 4/15 | F-23/F-26/F-28 | KB 不消费现有 zh/en context；只翻译 application UI/新默认标题，不翻译或迁移用户/目录/标签/Markdown/Skill 数据 | 4 requirements/7 scenarios 已人工核验；等待用户审批显示别名、locale 格式和新标题语义 |
| `add-model-benchmark-workbench` | 10/19 | F-09/F-22 | 注册、四模态/三比较模式、独立store、路由、反馈和pure ranking已存在；`estimatedCost`永远null、无ranking UI caller、无stop，与原1.2/1.5完成勾选冲突，已校正任务与设计；生命周期/存储/privacy/handoff不塞回此change | 等待用户审批真实cost/unknown语义、ranking UI和stop；四模态真实验证不使用未授权凭据 |
| `ensure-model-benchmark-storage-consistency` | 4/15 | F-22；邻接F-03/F-14/F-15 | delayed constructor load会覆盖ready前session；fire-and-forget whole-state writes反向完成使durable从2 sessions回退到1。只拥有benchmark KV key/readiness/write failure，不复用其他domain queue | 1 requirement/3 scenarios、deferred mock 2条确定性证据、key/schema人工校验；等待审批 |
| `control-model-benchmark-run-lifecycle` | 5/17 | F-10/F-22 | 同session双run产生双provider call；运行中删除不取消调用；刷新后running原样保留。拥有singleflight/stop/delete/interrupted状态，不把benchmark迁入task queue | 1 requirement/4 scenarios、三条mock事实；等待审批truthful abort/non-abort、additive states和no-auto-resume |
| `sanitize-model-benchmark-diagnostics` | 4/14 | F-22/F-27 | 四模态raw response经`rawData`无界持久化/展示；Error.message进KV/UI/export/analytics。只确认任意sentinel传播，不声称真实provider含secret | 1 requirement/3 scenarios、success/error sentinel 2条证据；等待审批bounded DTO/redaction/generic fallback/forward-only历史处理 |
| `scope-model-benchmark-launch-handoff` | 4/13 | F-15/F-22/F-26 | internal tool默认reuse；global atom无identity ack/clear，component-local signature在remount重置；重复read保留旧request。settings实点因两个group均0 models阻塞，不把缺按钮当缺陷 | 1 requirement/3 scenarios、launcher mock与静态reuse/remount链；等待审批identity-checked one-shot语义 |
| `improve-model-benchmark-content-accessibility` | 6/24 | F-22/F-28；邻接F-09/F-15/F-26 | 生产空态点击图片后active class/prompt切换，但4模态/3compare/5history filter均无programmatic selected state；4个文本输入只靠placeholder且visible model/provider概念无label关系；Workbench不消费i18n。只拥有内容state/label/region/zh-en，不接管ranking/stop/live/storage/diagnostic/handoff/WinBox/compact/theme | 3 requirements/9 scenarios；1280×720 DOM/状态/label/几何与既有before截图，proposal/design/tasks/delta人工校验；strict exit127，等待审批 |
| `control-audio-playback-request-lifecycle` | 5/14 | F-24；邻接 F-06/F-13 | 远程A在cache等待时B先完成，A迟到会覆盖B；A旧play rejection会把B置failed；stopAndClear不失效pending request。只拥有shared player async intent，不改cache policy/provider/task | 1 requirement/3 scenarios、deferred cache/play/stop 3条确定性证据；等待审批latest-intent与stop/reading invalidation语义 |
| `ensure-audio-playlist-write-consistency` | 6/19 | F-03/F-13/F-24；邻接 backup/media delete | whole-array并发add丢1/2，同名create并发重复，两个localForage store第二步失败形成partial create/delete/add/remove，旧Context reload覆盖新投影。保留两旧store/schema，新增私有恢复journal；跨tab lock非范围 | 2 requirements/6 scenarios、playlist 6+Context 1条mock事实；等待审批accepted-order mutation、prepared/committed recovery、backup clear与latest reload owner |
| `improve-music-player-control-accessibility` | 4/13 | F-24/F-28；邻接 F-15 | minimized global overlay 的prev/play-next/layout/close为5个空名称native buttons；只拥有内容区现有动作name/state，不接管outer WinBox dialog/focus/title controls或视觉几何 | 1 requirement/3 scenarios、1280×720 accessibility tree/DOM/截图；等待审批localized/state-aware names |
| `add-model-scoped-generation-preferences` | 12/16 | F-07/F-08/F-09 | 与全局生成状态持久化存在恢复优先级重叠；已证实目标类型无可选模型时旧媒体model/params残留且send可用 | 新增空模型清理/阻止提交scenario与2项任务；等待审批后先红后绿，同一偏好状态机建模 |
| `add-multi-provider-profiles` | 0/24 | F-09 | 与 discovery、protocol、默认模型、Kling、Suno 六项叠加；源码已有 profile 相关实现 | 不按 0/24 判定缺失 |
| `add-music-brief-controls` | 8/8 | F-20 | 与 creative brief 概念相近但数据实体和工具不同；未发现直接冲突 | 音乐循环内验证 |
| `fix-music-analyzer-record-consistency` | 5/15 | F-10/F-11/F-20；邻接 F-16/F-17/F-18 | 两个真实 `updateRecord()` 的非冲突 patch 受控交错后确定性丢失一项；deferred task restore 只发一个代表事件；所有相关 domain 必须消费同一个 application task-storage readiness owner | 3 requirements/3 scenarios、proposal/design/tasks/delta 与无同名 requirement 已人工校验；等待用户审批 mutation 排序、全量恢复同步和保存失败反馈 |
| `fix-music-analyzer-upload-cache-lifecycle` | 4/14 | F-10/F-13/F-20 | 上传在 20 MB 校验前写入缓存；cache 成功但 createTask 失败无 owner；failed/cancelled task 又必须保留 retry source，故只按最后 task/record owner 删除 | 2 requirements/4 scenarios、proposal/design/tasks/delta 与无同名 requirement 已人工校验；等待用户审批 preflight 和 cache ownership 语义 |
| `sanitize-suno-provider-error-feedback` | 4/14 | F-10/F-20/F-27 | Suno submit/fetch 原始 HTTP body 进入 Error、task persistence、UI 与日志；只确认任意 body 传播，不声称观察到真实 credential | 1 requirement/3 scenarios、proposal/design/tasks/delta 与无同名 requirement 已人工校验；等待用户审批 bounded allowlist/redaction 与 generic fallback |
| `improve-music-analyzer-accessibility` | 5/17 | F-20/F-28；邻接 F-15/F-17/F-18 | Music 内容区的英文/符号 accessible name、pointer-only upload/history、无 live region 和 40×32 compact action 由本 change 所有；外层 WinBox 与 shared ComboInput 分别复用已有 owner | 4 requirements/5 scenarios、三视口 DOM/几何/截图、proposal/design/tasks/delta 与无同名 requirement 已人工校验；等待用户审批 |
| `add-provider-protocol-routing` | 0/26 | F-09/F-08/F-10 | 模型路由簇核心依赖；源码存在 `provider-routing`，tasks 状态与实现明显不能直接等同 | 以调用链和测试为准 |
| `add-runtime-model-discovery` | 0/16 | F-09 | 与 multi-profile/default models 共同决定目录合并和 fallback | 模型循环统一验证 |
| `add-stitch-design-workflow` | 0/15 | 不属于现有功能 | 明确新增 Stitch 设计闭环，不属于“只优化已有能力”实施范围 | 仅登记候选提案，不实施 |
| `add-suno-lyrics-task-and-canvas-flow` | 0/22 | F-08/F-09/F-10/F-20/F-24 | 与 audio routing 共享任务类型、Suno 提交和画布落点；F-20 证明 lyrics selector 会纳入 forced music continuation/upload/advanced aliases，新增 executable action capability 过滤要求 | 7 requirements/17 scenarios 与无同名 requirement 已人工校验；等待用户审批歌词 action/result/queue/canvas 与 selector capability 语义 |
| `add-video-prompt-pdf-context` | 7/8 | F-17 | 复用 Chat PDF 路径并接入既有 VideoAnalysisData；与视频簇共享记录/恢复 | 在 F-17 一并验证 |
| `refactor-ai-json-response-parser` | 5/5 | F-11/F-16/F-17/F-18/F-20/F-25 | 跨多个 AI JSON 入口，但声明不改业务 schema/降级；禁止脱离功能链全仓扫改 | 每个消费者验证 |
| `refactor-hover-tip-unification` | 15/16 | F-05/F-07/F-13/F-15/F-28 | 横跨视觉交互；全仓一次迁移会违反逐功能原则 | 随各功能审计收口 |
| `fix-workspace-current-deletion-transition` | 3/14 | F-02/F-03 | 当前/最后画板删除后的 App、service、URL、sessionStorage 与关闭恢复相邻；不改 schema，但改变删除成功后的活动画板 | 等待用户批准“无剩余画板时创建默认空画板”后实施 |
| `fix-backup-restore-current-board-transition` | 2/11 | F-03 | 项目导入后的 workspace reload 把当前画板降为元数据投影，导致对话框绕过既有非空确认分支；修复只改变恢复后的切换门槛 | 等待用户批准“非空当前画板确认后才切换”后实施 |
| `improve-backup-sync-interface-accessibility` | 6/34 | F-03/F-28；邻接 F-26 | 受控组件与1280×720生产证据确认备份/同步modal命名、tab/文件键盘、进度/结果状态、焦点返回、同步disclosure/控件命名、密码呈现及zh/en契约缺口；只拥有F-03界面，不改变备份、同步、Token存储或shared dialog/menu语义 | 6 requirements/18 scenarios、4项受控诊断、两张before截图与proposal/design/tasks/delta已记录；等待用户审批后实施，compact/theme/after矩阵仍未闭合 |
| `enforce-github-token-encryption` | 5/23 | F-03；安全邻接 F-26/F-27 | Token正常路径为PBKDF2+AES-256-GCM，但Web Crypto缺失/抛错时shared helper返回可逆`OPENTU_FB:`并被TokenService当加密值持久化/使用；只拥有Token fail-closed与同key安全重写，不改Gist payload或自定义同步密码存储 | 3 requirements/8 scenarios；非凭据哨兵1/1证明不同密码可恢复fallback；等待用户审批安全存储失败阻断与迁移语义 |
| `improve-workspace-operation-failure-consistency` | 2/12 | F-02 | 与前一 change 共享删除入口，但只约束持久化失败、内存提交顺序与错误反馈；不改变成功删除转场 | 等待用户批准 persist-first、明确错误与部分成功语义 |
| `improve-workspace-manager-interface-accessibility` | 5/31 | F-02/F-28；邻接 F-03/F-04/F-25 | 1280×720 production drawer无name，open后focus留trigger且到首drawer control隔17 stops；current board row为generic DIV/tabIndex-1/无current，More tabbable但空名称且opacity0；受控Enter 0/0、pointer 1/1；no-match误报true empty；English Provider仍中文。只拥有ProjectDrawer opt-in shell/tree/menu/状态/i18n/keyboard resize，不接管workspace数据语义、其他drawer/menu默认、Frame/Layer或import/export | 6 requirements/20 scenarios；component 1/1、两张before、proposal/design/tasks/delta、WHEN/THEN、6个唯一requirement已人工校验；strict exit127，等待审批，compact几何仍阻塞 |
| `refactor-startup-shell-loading` | 13/26 | F-01 | 当前源码/产物与 delta spec 的延后挂载边界不一致，见 `STARTUP-001`；2026-07-29 已重新打开 tasks | proposal/design/delta 已更新，等待用户审批 4.6 后实施 |
| `fix-version-update-notification-delivery` | 4/21 | F-01 | `bootstrap.tsx` 在延迟挂载前发出一次性 `sw-update-available`，同版本随后被去重，唯一消费者无 snapshot/replay；只拥有 page-local readiness/replay，不改 SW/version storage/cache/task guard/commit/reload | 2 requirements/6 scenarios；早于挂载时 prompt=false/fetch=0，挂载后同事件 prompt=true/fetch=1；四文件、WHEN/THEN、唯一 requirement 已人工校验，strict exit127，等待审批 |
| `improve-startup-recovery-interface-accessibility` | 5/25 | F-01/F-28；邻接 F-27 | React ErrorFallback 无 blocking-region/focus/disclosure/progress 语义；HTML boot terminal error 把进度置 100% 且无应用内 retry/safe/debug 动作。只拥有既有恢复入口的语义、焦点、compact/motion 与 runtime-language bridge，不接管诊断隐私、启动拆包或 crash storage | 5 requirements/11 scenarios；ErrorFallback 受控语义 1/1 与 inline controller 静态证明；人工格式/owner 校验完成，strict exit127，等待审批 |
| `improve-version-update-interface-accessibility` | 4/22 | F-01/F-28；邻接 F-26 | English Provider 仍显示中文升级 UI，新增提示无 status，changelog 无 dialog/modal contract；只拥有 application copy/status/modal/focus/reduced-motion，不接管 replay、active-task guard、COMMIT_UPGRADE、布局/z-index 或 release data 翻译 | 4 requirements/8 scenarios；英文/语义受控诊断 1/1；人工格式/owner 校验完成，strict exit127，等待审批 |
| `refactor-sw-duplex-comm` | 0/20 | F-01/F-10/F-11/F-12 | proposal 以 SW 创建/执行任务和广播 Chat 流为前提；当前任务与工作流执行在主线程，设计前提过时 | 暂停实施，先重写或关闭 proposal |
| `enforce-task-queue-concurrency-limit` | 2/11 | F-10 | 普通任务绕过 Hook 的 20 并发边界；受控样本峰值 21/21 | 等待用户批准统一调度和排队状态 |
| `fix-task-queue-external-cancellation` | 4/13 | F-10/F-11/F-20 | 任务面板取消虽 abort service controller，但 Suno submit/fetch/sleep、Music Analyzer 三条 dedicated CHAT 路径和音频缓存后迟到 completed 窗口未完整消费/保护；取消后页面/历史还需保留 retry association | 2 requirements/9 scenarios 与无同名 requirement 已人工校验；等待用户批准外部任务取消终态与 late writeback 语义 |
| `fix-main-thread-workflow-recovery-sync` | 3/15 | F-11/F-12；邻接 F-10/F-03 | 新 AIInputBar workflow 由 task/chat/board 持有，旧 WorkZone 却调用不存在的 SW claim 并回退到 legacy workflow store；同时约束旧事件不覆盖新 Context、单一 task 投影和 Chat 终态一致性，不改变任务取消、schema 或备份语义 | 5 requirements/8 scenarios 已人工校验，等待用户批准后先补恢复/竞态/调用次数测试再实施 |
| `fix-chat-message-persistence-consistency` | 4/18 | F-12；邻接 F-03/F-11/F-27 | Chat storage 已增加计数但普通/工作流 caller 再次累加；普通终态和 tool workflow patch 缺少可等待、有序的持久化边界；与 workflow recovery change 共享 ChatMessage 文件但不处理 task 投影 | 5 requirements/9 scenarios 已人工校验，等待用户批准后先补 count、延迟写、失败和 tool-call 顺序测试再实施 |
| `fix-chat-inflight-session-isolation` | 4/17 | F-12 | 忙时第二次发送被 hook 静默拒绝但 composer 清空；普通/工作流 session load 无最新选择 guard；保持单请求限制且不新增队列、停止或并行能力 | 3 requirements/6 scenarios 已人工校验，等待用户批准 busy feedback、draft 保留和 origin-session 隔离语义 |
| `ensure-prompt-storage-write-consistency` | 4/15 | F-03/F-07/F-08/F-12/F-14 | prompt cache 初始化会覆盖初始化期间接受的 mutation；独立 fire-and-forget 写与备份读取之间无 durable boundary；不改 key/schema，但改变备份/import 等待与失败语义 | proposal/design/tasks、prompt-history 与 backup-restore delta 已人工校验，等待用户审批后实施 |
| `fix-runtime-model-discovery-stale-response` | 2/11 | F-09 | 同 profile 新凭据发现先成功后，迟到旧响应会覆盖目录并持久化；delta 与现有 discovery/multi-profile change 修改同 capability 但无同名 requirement | 等待用户批准“最新发现/失效意图拥有 catalog 状态”语义 |
| `fix-runtime-model-discovery-failure-fallback` | 3/12 | F-09 | 仅凭据 signature 会把从未成功发现的 profile 视为 authoritative，首次 loading/error 令共享 selector 变空；与 discovery/multi-profile 的 fallback 定义重叠但使用独立 requirement | 等待用户批准“只有成功目录启用 provider-only，signature 仍阻止旧模型 pin”语义 |
| `persist-github-synced-task-history` | 2/11 | F-03/F-10 | GitHub 下载页只恢复内存，未持久化；批量事件只携带一个代表任务 | 等待用户批准终态任务本地持久化与批量刷新 |
| `preserve-archived-prompts-in-history` | 4/14 | F-10/F-14 | 任务队列按 100 条活跃上限把最旧终态任务标为 archived 并保留 IndexedDB；提示词 reader 默认排除 archived，与 backup-restore 的完整历史 requirement 冲突 | proposal/design/tasks/delta 已人工校验，等待用户审批后实施 |
| `refactor-toolbox-plugin-runtime` | 8/9 | F-15/F-21/F-24 | proposal 仍以注册中心、独立工具目录和统一内部/iframe 解析尚未引入为前提，但当前正式 `toolbox-plugin-runtime` spec、registry 和独立工具目录已存在；剩余 3.3 不能作为重复实施架构的依据 | 在 F-15/F-24 按现源码复审已实现 requirement 和缺失测试，之后请求归档或重写决策 |
| `improve-toolbox-entry-accessibility` | 4/14 | F-15/F-28 | 只约束工具卡片的 role/name/Enter/Space 和 delete/insert/window 按钮名称；不修改 registry、窗口/画布语义、iframe 权限、持久化、分析 schema 或视觉几何；未发现同名 requirement | proposal/design/tasks/delta 已人工校验，等待用户审批后先测后改 |
| `ensure-toolbox-initialization-consistency` | 4/17 | F-15/F-21/F-27 | 自定义工具 localForage 初始化无共享 readiness，已接受 mutation 会被迟到读取覆盖；可达 drawer 与 pinned launcher 可读取 provisional catalog；`useToolFromUrl` 已证明无生产调用并删除；GitHub tool sync 只在无调用者的 `syncPaged()` 内，已排除 | 1 requirement/4 scenarios 已人工校验，等待用户审批 readiness、失败隔离与 mutation 等待语义 |
| `ensure-custom-tool-write-consistency` | 3/15 | F-15/F-27 | add/update/remove/clear/import 先改内存后写盘，写失败后 caller 报失败但 catalog 已改变；依赖 initialization change 的 ready boundary，但使用独立 durable commit requirement | 1 requirement/3 scenarios 已人工校验，等待用户审批 persist-then-commit 与有序 mutation 语义 |
| `remove-deleted-custom-tool-runtime-state` | 3/15 | F-15/F-21 | 成功删除 catalog 后 window/pin owner 无清理，形成不可启动 launcher；与 write consistency change 共享“持久化成功”门槛，但额外改变窗口关闭、pin localStorage 和 canvas-derived transient 语义 | toolbox-plugin-runtime 1/3、toolbox 1/2 已人工校验，等待用户审批 |
| `fix-tool-window-viewport-transition` | 7/21 | F-15/F-17/F-18/F-19/F-20/F-22/F-28 | 非最大化工具在compact受400px minimum与旧x/y影响；F-20仅266px可见且close出界；F-22在1280×720 auto-max仍为1280×860、超出140px且无scroll recovery。现change用独立ordinary/maximized tool branches，共享`WinBoxWindow.tsx`但不接管F-08 generation maximized语义 | 1 requirement/5 scenarios、五个工具几何证据和无同名 requirement已人工校验；等待审批compact clamp/往返恢复与tool-max viewport fit；F-22修后补1280×720可达性 |
| `improve-tool-window-accessibility` | 6/19 | F-15/F-17/F-18/F-19/F-20/F-24/F-28 | 外层工具 WinBox 及标题控件无 dialog/button/name/键盘/focus/Escape 契约；F-20和F-24均确认insert/split/min/max/full/close为无role/name/tab stop的span；各工具内容区由各自change所有 | 1 requirement/6 scenarios、多个工具 DOM 证据和无同名 requirement 已人工校验；等待用户审批窗口焦点/键盘与 launcher menu 语义 |
| `secure-external-tool-credential-launch` | 4/18 | F-21；邻接 F-15/F-26 | Chat-MJ built-in 把全局 `${apiKey}` 放进第三方 fragment；drawer 有缺 key 门禁，但 launcher/new-window/canvas popup 直接创建 state。保留用户明确创建且有泄漏警告的 custom template，不建立新 credential vault | 2 requirements/5 scenarios、sentinel 2/2、credential-free shell 和无同名 requirement 已人工校验；等待用户审批内置不交付与全入口 preflight 语义 |
| `improve-external-iframe-load-recovery` | 4/17 | F-21；邻接 F-15/F-28 | WinBox external branch 无 loading/error/retry；Pose 桌面3s blank、追加10s后可用；390/768下Banana/Pose四项3s也白屏无status，而外窗均完整入视口；canvas loader/error z-index1被白底iframe z-index10确定性遮挡。只拥有iframe内容生命周期，不接管外窗geometry/focus/permissions | 1 requirement/5 scenarios、7张截图/三视口DOM几何/静态 stacking 证据和无同名 requirement 已人工校验；等待用户审批 10s honest-slow、error 和 retry 语义 |
| `allow-banana-prompt-clipboard-write` | 4/19 | F-21；邻接 F-15/F-28 | Banana 描述含复制且公开 bundle 在 secure context 调 `navigator.clipboard.writeText`，rejection 不进 fallback；WinBox 无 allow。5/5 cross-origin 对照证明无allow写false/denied，write-only写true/prompt且读false/denied。只拥有Banana WinBox最小Feature Policy，不接管sandbox、canvas或其他工具 | 1 requirement/4 scenarios、公开document/bundle hash、三组5次policy raw values、4/4 files和全仓唯一requirement/capability已人工校验；strict exit127，等待用户审批write-only边界 |
| `fix-video-analyzer-record-consistency` | 4/16 | F-10/F-11/F-17；邻接 F-18/F-20 | F-17 的 load-modify-save 在并发 add/patch 时确定性丢更新；task storage ready 后 shared sync 没有全量补扫；Script/Generate 多个写入 reject 无安全可见反馈。与 `fix-main-thread-workflow-recovery-sync` 共用 task-storage readiness，实施前必须确定一个全局 owner | 3 requirements/4 scenarios、proposal/design/tasks/delta 和无同名 requirement 已人工校验；等待用户审批记录 mutation 排序、全量恢复同步和失败反馈语义 |
| `improve-video-workflow-form-accessibility` | 4/15 | F-17/F-18/F-28 | F-17 初始页 10/10 控件无程序化名称；共享 `ComboInput` 无 combobox/listbox/option 语义，Arrow/Enter/Escape 实测不能选择或关闭；只改共享视频表单，不接管外层 WinBox | 2 requirements/4 scenarios、proposal/design/tasks/delta 和无同名 requirement 已人工校验；等待用户审批命名与键盘交互契约 |
| `fix-mv-creator-record-consistency` | 4/17 | F-10/F-11/F-18；邻接 F-16/F-17 | 真实 MV storage 并发诊断证明非冲突 favorite/title patch 确定性丢失；task storage ready 后 shared sync 没有全量补扫；Analyze/Script/Generate/History 写入 reject 无独立安全反馈。必须与 comic/video analyzer/主线程恢复 change 共用唯一 readiness owner | 3 requirements/3 scenarios、proposal/design/tasks/delta 和无同名 requirement 已人工校验；等待用户审批 MV-key mutation ordering、恢复协调和保存失败反馈 |
| `improve-mv-creator-navigation-accessibility` | 3/16 | F-18/F-28；邻接 F-16/F-17 | 中文 MV UI 的共享导航实际暴露 `history`、`starred`、`←`；音乐 clip 与历史 record 行只有 pointer activation。表单由 video form change、外层窗口由 tool-window change 所有；共享导航 optional props 必须与 F-16 复用一个契约 | 2 requirements/3 scenarios、Chromium DOM/名称、proposal/design/tasks/delta 和无同名 requirement 已人工校验；等待用户审批本地化名称与 Enter/Space/nested-control 语义 |
| `report-ppt-export-content-loss` | 4/14 | F-25 | image-first 主页面图片 404 时 exporter 吞错、写空白页并报告全成功；change 只拥有 required-content failure、legacy omission result、反馈/analytics，不改页面布局/缓存/任务/顺序。与 comic tool export 是独立服务 | 1 requirement/3 scenarios、synthetic 404 诊断、proposal/design/tasks/delta 和唯一 requirement 已人工校验；等待用户审批阻断下载与 partial warning 语义 |
| `improve-ppt-editor-accessibility` | 4/14 | F-25/F-28 | PPT toolbar、AddFrame W/H 和 slideshow 多组 icon/options 无名称/状态，透明控件可保留焦点；只拥有 PPT 内容控件，不接管 project drawer/WinBox 外壳。与 PPT i18n 共用 strings，实施时复用同 catalog | 2 requirements/5 scenarios、live Chromium DOM/source、proposal/design/tasks/delta 和唯一 requirement 已人工校验；等待用户审批 localized names/pressed/focus-visible 语义 |
| `localize-ppt-editor-workflow` | 3/14 | F-25/F-26/F-28 | `FramePanel`仅少数分支使用 language，AddFrame/Slideshow没有语言owner；change 本地化现有系统copy和新默认页名，不翻译/迁移旧名、prompt/provider/file。与 a11y change 同文件，建议先建立可见copy catalog再复用accessible-only keys | 2 requirements/4 scenarios、静态控制流、proposal/design/tasks/delta 和唯一 requirement 已人工校验；英文运行时截图仍阻塞，等待用户审批数据兼容边界 |
| `refactor-workflow-shell` | 18/18 | F-11/F-17/F-18/F-20 | 声明无行为变化，但与三个工作流容器及任务同步共用路径 | 复审存储键和恢复不变量 |
| `update-canvas-batch-flow-layout` | 10/10 | F-06/F-08/F-13/F-19 | 多个批量插入写入者应复用同一布局算法；未见规格冲突 | 反向追踪所有写入者 |
| `update-default-text-models` | 20/21 | F-07/F-09/F-12 | 与 discovery/profile 合并、旧选择 pin 和 provider routing 叠加 | 模型路由簇 |
| `update-kling-capability-version-routing` | 0/22 | F-08/F-09/F-17 | 依赖 provider binding，将能力模型与执行版本分离 | 模型路由后验证视频 |
| `update-ui-color-system` | 15/15 | F-13/F-26/F-28 | 跨功能视觉规范，不构成单独产品功能 | 作为每轮视觉验收依据 |
| `update-video-batch-parallel-generation` | 8/8 | F-10/F-17/F-18 | **直接行为冲突**：正式 `video-batch-generation` 仍要求串行、尾帧传递和失败后继续重试；delta 改为镜头独立并行且不传尾帧 | F-17 前必须先决策并同步正式 spec |
| `update-video-character-asset-reuse` | 9/11 | F-13/F-17/F-18 | 与素材“主体”分类、两个视频工具记录和生成步骤共享数据 | 同一冲突簇联合验证 |
| `stabilize-command-palette-input-handling` | 4/16 | F-31 | 生产` Mermaid `为0项而`Mermaid`为1项；受控IME Enter组成态close1/perform1。只拥有matching-only boundary trim和composition key delegation，不改raw input、registry、predicate/order、dispatch或命令目标 | 3 requirements/9 scenarios、四必需文件、8项唯一名称中的3项与单capability owner已人工核验；等待用户审批 |
| `improve-command-palette-interface-accessibility` | 6/23 | F-31/F-28；邻接所有命令目标 | 27个production row和modal/search/list无对应语义，Escape落BODY；390×844 input/row为22.5/37.390625px，640×360 panel至y474且wrapped active row全不可见；只拥有shell semantics/focus/status/compact/landscape/motion，目标UI/反馈仍归各功能 | 5 requirements/15 scenarios、4张before、component focus 1项及单capability owner已人工核验；等待用户审批 |

## 6. 建议处理顺序

1. **F-01 启动壳、懒加载、PWA 与恢复**：入口依赖所有功能；已有可复现的边界漂移、构建产物证据和独立 active change，能建立测量/审批模板。
2. **F-03 + F-02 工作区持久化与项目管理（分两个连续循环）**：直接涉及用户数据完整性、关闭恢复和迁移，风险高于视觉整理。
3. **F-10 任务队列**：生成、工作流、聊天、工具历史和素材落盘的共同执行底座；先解决 SW proposal 的过时前提。
4. **F-09 模型发现/供应商/协议路由**：六个活动 change 叠加，是所有 AI 调用正确性的前置条件。
5. **F-07、F-08 AI 输入与直接生成**：在任务与路由边界稳定后审查参数、附件、状态恢复和自动插入。
6. **F-11、F-12 工作流与聊天**：共享任务事件和恢复，但分别保持独立用户场景。
7. **F-13 素材库与缓存**：承接生成结果、知识/主体素材和离线缓存，随后可审 F-23 知识库。
8. **F-17、F-18、F-20、F-16、F-19、F-22 各内置生成工具**：先解决视频正式规格冲突；每个工具单独闭环。
9. **F-15、F-21、F-24 工具箱/外部工具/播放器**：依赖启动分块与工具运行时结论。
10. **F-04、F-05、F-06 画布交互与元素**：按用户意图分循环，不按组件或 500 行规则拆分。
11. **F-25 PPT/Frame**：在画布媒体与任务链稳定后审导出一致性。
12. **F-14、F-26、F-27**：提示词历史、设置和诊断分别闭环。
13. **F-28 响应式/无障碍/视觉一致性**：它是每个功能循环的验收门；最后再做一次全局复审，而不是把修复推迟到最后。

lint 扫描边界属于独立工具链循环：第 40 节已完成配置修复和验证；后续仍不得把剩余规则命中在没有功能证据链时直接计为业务缺陷。

## 7. 第一个功能循环：F-01 启动壳、懒加载与恢复

### 7.1 用户场景、范围和非范围

用户首次或刷新打开工作台，只需要尽快进入可操作画布；尚未点击 AI 输入、聊天、工具箱、同步、命令面板或性能面板。网络慢、CDN 失败、旧 SW、懒 chunk 失效或上次崩溃时，用户应得到连续且可恢复的启动反馈。

范围：HTML 启动壳、main/bootstrap、首个 React/Drawnix 挂载、工作区恢复边界、CDN 与 SW 注册、版本升级、idle prefetch、懒资源自愈、首屏 chunk 分组/预算、启动错误 UI 和相关分析事件。

非范围：任务本身的执行语义、模型路由、打开后的 Chat/AI 功能逻辑、工具业务内容；这些只检查“是否在未触发时进入启动链”。

### 7.2 当前正向调用链

导航  
→ `apps/web/index.html:688-1432` 选择 CDN/本地启动资产、早期 SW 和自愈策略  
→ `apps/web/index.html:1184-1190` 暴露启动进度/ready/error 控制器  
→ `apps/web/src/main.tsx:29-70` 注册 lazy import 恢复监听  
→ `apps/web/src/main.tsx:72-84` 更新进度并动态导入 bootstrap  
→ `apps/web/src/app/bootstrap.tsx:45-58` 标记崩溃加载、初始化日志和 release context  
→ `apps/web/src/app/bootstrap.tsx:266-339` 首帧后调度分析、数据库清理/迁移、工具栏配置、内存与 Web Vitals  
→ `apps/web/src/app/bootstrap.tsx:342-742` 注册/检查 SW、同步 CDN、分阶段升级  
→ `apps/web/src/app/bootstrap.tsx:744-759` React Root → ErrorBoundary → App  
→ `apps/web/src/app/app.tsx:247-264` 结束启动遮罩并请求离线静态资源预取  
→ `apps/web/src/app/app.tsx:266-520` 初始化工作区、迁移、URL/会话画板选择、关闭快照恢复、异步视频 URL 恢复  
→ `apps/web/src/app/app.tsx:32-36` 动态导入 Drawnix  
→ `packages/drawnix/src/drawnix.tsx:323-401` 建立 UI 状态与延后运行时开关  
→ `packages/drawnix/src/drawnix.tsx:869-932` Provider/画布核心挂载  
→ `packages/drawnix/src/drawnix.tsx:1675-1682` 初始挂载 DeferredAIInputBar  
→ `packages/drawnix/src/drawnix.tsx:1758-1760` 初始挂载 ChatDrawer  
→ 用户触发 AI/工具后才由 `packages/drawnix/src/drawnix.tsx:373-401` 启用生成/工具运行时  
→ `DrawnixDeferredRuntime.tsx:47-154,429-540` 恢复任务、建立任务/工作流同步并自动插入结果。

状态所有者：HTML `window.__OPENTU_BOOT__`、App 的加载/数据准备 state、WorkspaceService/IndexedDB、Drawnix UI state、SW registration/version state、localStorage 的崩溃与 close snapshot 标记。

主要副作用：DOM/script/style 请求、SW 注册与消息、Cache API 预取、IndexedDB 初始化/迁移、local/sessionStorage 读写、PostHog/Web Vitals、任务/字体/媒体恢复。

### 7.3 反向追踪清单

- 启动遮罩消失：`App isLoading/showCrashDialog/initError` → `bootController.markReady()` → HTML controller。
- 可操作画布：Drawnix/Wrapper/ViewNavigation DOM → App lazy Drawnix → bootstrap root → main dynamic bootstrap → HTML 启动资产。
- 首屏网络资源：浏览器请求 → Vite chunk imports/manualChunks → source static/dynamic imports → initial mounted components。
- SW/Cache 写入：SW message/registration → bootstrap 和 startup-prefetch 调用者 → App/Drawnix idle 或用户触发入口。
- 崩溃/旧 chunk 恢复：reload/错误 UI → lazy-asset-recovery、ErrorBoundary、crashRecoveryService → window error/unhandledrejection/vite preload error。
- 后续必须补齐：所有启动分析事件写入者、SW on/off、冷/热缓存、断网、升级 waiting/commit、safe mode 与多标签页交叉路径。

### 7.3.1 当前恢复状态矩阵

| 状态 | 证据 | 当前结论 |
| --- | --- | --- |
| 正常冷/热、SW 关/开 | 四组各 5 次浏览器 + 服务端测量 | 20/20 次出现可操作“选择 — V”；原始值见 `STARTUP-001` |
| 空工作区 | `app.tsx:405-425` | 源码会选择首个画板或创建“我的画板1”；尚缺独立行为测试 |
| 工作区加载 | `app.tsx:266-320` | 启动遮罩先结束、工作区继续初始化；实际 UI 连续性已在正常样本观察，慢 IndexedDB 未模拟 |
| 工作区初始化失败 | `app.tsx:511-520,900-913` + 新 App test | 已验证显示错误信息、安全模式和调试入口；日志导出按钮也由同一 UI 渲染 |
| 连续崩溃 | `crash-recovery-service.ts:57-95,199-228` + `app.tsx:269-385,869-897` | 静态链已确认；尚缺隔离 localStorage 的行为测试，保留为待验证 |
| stale lazy chunk | `lazy-asset-recovery.ts:99-201` + app-shell routing test | 识别错误、每版本/模块只自动 reload 一次、清静态 cache 并要求 SW update；纯路由 bypass 测试通过，完整 reload 尚缺浏览器故障注入 |
| CDN 失败/回源 | `cdn-fallback.spec.ts` 15 项 | CDN 偏好、404/失败回源、熔断/冷却、最终恢复 probe 已通过窄测试；真实外部 CDN 未测，避免凭据/网络噪声 |
| SW 注册失败/显式关闭 | `bootstrap.tsx:342-350,476-493` | 源码明确继续源站启动；SW 关闭、源站停止的实测对照为 `ERR_CONNECTION_REFUSED`，不记产品缺陷 |
| warm offline | 已安装/预热 7333 origin 后停止全部源站 | 实测无导航错误，857ms 出现可操作画布；证明当前 warm offline 基线有效 |
| staged SW 升级 | `bootstrap.tsx:349-742` | 正向代码链已确认；waiting/ready/commit 浏览器注入尚未完成，待验证 |
| Playwright smoke/feature/visual/responsive | 临时映射现有 revision 1228 后完成复跑 | smoke 2/2；feature 单 worker 2/3；visual 单 worker 25/40；responsive 3/11。失败按测试时序、定位器、快照与待核视觉变化分开登记，临时映射已删除 |

### 7.4 本轮验收标准

- 未触发 Chat/AI/工具窗时，首屏加载边界与批准后的 startup spec 一致。
- 入口静态依赖检查能对实际禁止组失败；不是只对单文件 500 KiB 做局部预算。
- 冷/热、SW on/off 各至少 5 次；记录浏览器、视口、网络/CPU、遮罩消失、画布可操作、请求数/传输量、中位数和范围。
- CDN/SW/动态 import 失败、离线、升级、safe mode 有可复现结果；环境不能运行的路径明确阻塞。
- 相关单测、startup validator、typecheck、cycles、build、size 和可运行的 E2E 没有新增失败。
- 若修改视觉启动状态，提供同视口/同主题前后截图；若无视觉修改，明确记为不适用。
- 规格、tasks、校验脚本和文档的启动边界一致，变更可独立回滚。

### 7.5 OpenSpec 门禁

该功能的候选修复会改变 Chat/AI/工具 chunk 的加载/挂载时机和首屏预算语义，属于用户可观察加载行为与性能语义变化。必须先更新独立 change `refactor-startup-shell-loading`，提交证据、方案、风险、测试与回滚，并等待用户批准；审批前只调查、测量和写提案，不实施产品代码。

## 8. 当前问题记录

### [STARTUP-001] 非核心 AI/聊天资源进入未触发的启动链，校验未覆盖 AI Chat

**状态**：已证实事实（源码/产物/浏览器行为）+ 实测基线；修复前后差值仍须在审批后实施时测量。

**用户场景**：用户首次或刷新进入工作台，等待画布可操作，但没有点击聊天、AI 输入或工具窗。

**复现方式**：

1. 运行当前生产构建并以 `http://127.0.0.1:7288/?sw=0` 打开，禁用 SW 干扰。
2. 导航后在启动遮罩仍为 52% 时记录已加载脚本/样式。
3. 等待画布出现可操作“选择 — V”控件，不点击 Chat/AI/工具入口，再记录资源。
4. 检查生产 bootstrap 的静态 import 与 `pnpm verify:startup` 禁止前缀。

**当前行为与原始值**：

- 启动遮罩 52% 时：5 个 script、4 个 stylesheet。
- 画布可操作且未触发非核心入口时：28 个 script、9 个 stylesheet。
- 此时已请求 `ai-chat-KsRCwrxK.js`、`tool-windows-1WB33Kw7.js`、`DeferredAIInputBar-CQJU1jwn.js` 及 workflow/skills 相关 chunk。
- 当前产物：
  - `ai-chat-KsRCwrxK.js`：2,808,742 B raw / 837,626 B gzip。
  - `tool-windows-1WB33Kw7.js`：641,215 B raw / 197,356 B gzip。
  - `DeferredAIInputBar-CQJU1jwn.js`：93,397 B raw / 31,996 B gzip。
  - `bootstrap-B0wTCVom.js`：300,003 B raw / 92,783 B gzip。
- `bootstrap-B0wTCVom.js` 静态 import `startup-runtime-BrfuwjQS.js`、`ai-chat-KsRCwrxK.js` 和 `tool-windows-1WB33Kw7.js`。
- `pnpm verify:startup` 仍退出 0。
- 该命令本次报告的入口静态依赖图仅为 `index-wBC_34dQ.js`（345 B）、`startup-app-TWeifuNq.js`（3,776 B）和 `startup-runtime-BrfuwjQS.js`（1,867 B），另计入口 CSS 14,208 B，总计 20,196 B；输出同时将 `ai-chat`、`tool-windows`、`external-skills` 列为 idle-prefetch 分组，但没有把浏览器在可操作前实际请求这些组作为失败条件。

**五次启动测量环境与口径（2026-07-29）**：

- 构建：当前 `pnpm build:web` 产物，源码未实施启动修复；页面由 Python `ThreadingHTTPServer` 从 `dist/apps/web` 提供，不启用 gzip。
- 浏览器：Codex 应用内 Chromium；精确版本接口未暴露，记为未知；视口由 JPEG 截图 SOF 元数据确认是 1280×720。
- 设备/网络/CPU：当前 macOS 主机，本机 `127.0.0.1` 回环网络，无网络限速、无 CPU 限速；因此数据不是公网或低端设备结论。
- “冷”：每个样本使用独立端口/独立 origin，浏览器此前未访问该 origin；SW 开启组同时包含首次注册、安装与预缓存成本。
- “热”：固定 origin 先完整加载并空闲 6.5 秒，再连续刷新 5 次；SW 开启组由同一 origin 的已安装 SW 控制。
- `loadMs`：浏览器导航调用返回的 load-event 观测时间。
- `operableMs`：从导航开始，每 25ms 轮询无障碍 DOM 快照，首次出现 `radio "选择 — V"` 的时间；绝对值包含自动化轮询开销，但四组使用同一口径。
- `请求/正文`：只统计 `operableMs` 之前服务器实际收到的请求；正文是无压缩本地响应 body 字节，不含 header，不等同公网 gzip 传输量。304 和 SW/HTTP cache 命中的正文按 0 计。

| 条件 | 5 次 `loadMs` 原始值 | 5 次 `operableMs` 原始值 | `operableMs` 中位数（范围） | 到可操作时服务器请求 | 到可操作时服务正文 |
| --- | --- | --- | --- | --- | --- |
| 冷、SW 关 | 102, 143, 207, 160, 214 | 1167, 1276, 1261, 1152, 1174 | **1174ms**（1152–1276） | 每次 39 | 每次 5,859,060 B |
| 冷、SW 开 | 209, 234, 177, 184, 156 | 1592, 1496, 1362, 1500, 1239 | **1496ms**（1239–1592） | 每次 51（含 1 次 304） | 每次 6,517,471 B |
| 热、SW 关 | 82, 141, 107, 101, 94 | 443, 482, 466, 468, 468 | **468ms**（443–482） | 每次 1 | 每次 53,897 B |
| 热、SW 开 | 113, 137, 113, 257, 170 | 513, 546, 458, 505, 430 | **505ms**（430–546） | 每次 2（含 1 次 304） | 每次 53,897 B |

冷启动 10/10 个样本在可操作前都由服务器返回 `ai-chat-*`、`tool-windows-*` 和 `DeferredAIInputBar-*`。冷、SW 关的 39 个请求中包含 5,859,060 B 无压缩正文；这是“非核心资源进入未触发冷启动链”的直接测量证据。SW 冷启动组相对 SW 关闭组的可操作中位数为 +322ms，并多 12 个服务器请求与 658,411 B 正文；该差值只适用于本机首次 SW 安装/预缓存条件，不外推为一般用户性能结论。热启动资源由 HTTP/SW cache 命中，服务器只观察到 HTML 和 SW 更新检查；这不能证明浏览器没有加载、解析或执行静态依赖。

**预期行为**：`openspec/changes/refactor-startup-shell-loading/specs/startup-performance/spec.md:3-21` 要求首屏先进入可操作画布，Chat、AI、工具窗不阻塞；非核心能力未触发不挂载或在浏览器空闲时延后启动。具体禁止的资源组和总预算需在 change 审批中精确定义，不能在调查阶段自行改写。

**静态证据与精确位置**：

- `packages/drawnix/src/drawnix.tsx:1675-1682`：DeferredAIInputBar 初始无条件挂载。
- `packages/drawnix/src/drawnix.tsx:1758-1760`：ChatDrawer 初始无条件挂载。
- `apps/web/src/app/bootstrap.tsx:19-22`：bootstrap 从根 barrel `@drawnix/drawnix` 导入两个 analytics 符号。
- `packages/drawnix/src/index.ts:1-57`：根 barrel 导出 Drawnix、utils、Gemini、路由、适配器和多项服务；analytics 位于 `:23-28`。
- `packages/drawnix/src/runtime.ts:1-33`：轻量 runtime 入口没有导出这两个 analytics 符号。
- `apps/web/vite.config.ts:582-595`：Chat 相关模块被分到 `ai-chat`。
- `apps/web/vite.config.ts:765-782`：静态可达模块与 idle group 的 manual chunk 判定。
- `scripts/validate-startup-bundle.js:7-12`：禁止前缀只有 diagram/tool-windows/external-skills，没有 `ai-chat-`。
- `scripts/validate-startup-bundle.js:212-232`：校验能遍历 HTML 入口和直接动态入口的静态依赖，但只按上述前缀失败。
- `scripts/validate-startup-bundle.js:242-258`：体积预算逐文件计算，不限制首屏资源总量。

**完整问题调用链**：

导航 → HTML/main 动态导入 bootstrap → bootstrap 静态导入根 Drawnix barrel → Vite 将根图谱中的 Chat/UI 模块分到 `ai-chat`/`tool-windows` → bootstrap 产物静态 import 两个重 chunk → 浏览器在画布可操作前后加载它们；同时 Drawnix 初始渲染无条件触发 AIInputBar 与 ChatDrawer lazy import → 未交互时继续加载其组件依赖 → startup validator 遍历到资源但 `DISALLOWED_PREFIXES` 未包含 `ai-chat-`，且只检查单文件 raw 500 KiB → 命令返回 0。

**影响范围**：所有生产启动；冷缓存、慢网和 CPU 受限环境的影响数值尚未完成 5 次测量。不能据此宣称启动耗时提高了多少。Chat/AI 首次交互、SW idle prefetch、任务恢复与工具窗也可能受修复时机影响，必须列为回归边界。

**证据强度**：

- 初始挂载与导入关系：高（当前源码 + 当前生产产物）。
- 未触发仍请求资源：高（同一生产构建的浏览器请求观察）。
- 校验放行原因：高（校验源码 + 退出码 0）。
- 本机启动时序与服务器资源成本：中高（四组各 5 次，同构建同视口；浏览器精确版本和内存 API 未暴露，且未模拟公网/CPU 限速）。
- 修复带来的时间、请求、内存差值：待验证（尚未获批实施，无优化后样本）。

**根因**：启动边界同时在源码挂载、package 导出边界、Vite 分组和校验禁止清单中表达，当前四处定义发生漂移；现有校验没有把 `ai-chat` 纳入禁止组，也没有总启动链预算，因此无法阻止该回流。

**候选方案（待 OpenSpec 审批）**：

1. 最小方案：将 bootstrap 所需 analytics release API 移入/导出于轻量 runtime 边界；ChatDrawer 改为由打开状态首次挂载；AI 输入保留轻壳但把模型/工作流/生成运行时推迟到用户激活；校验把批准后的禁止组和总启动资源预算建模为唯一清单。
2. 备选 A：只给校验增加 `ai-chat-`。可快速阻止回归，但当前构建会失败，不能修复根 barrel 与无条件挂载。
3. 备选 B：仅依赖 SW idle prefetch。热缓存可能缓解网络等待，但不消除主线程解析/执行和冷启动回流，不符合未触发边界。
4. 备选 C：重写整个启动架构。影响过大且没有证据支持，拒绝作为首轮最小改动。

**风险**：Chat ref/context 调用在组件未挂载时失效；AI 输入首次激活出现状态丢失或额外延迟；任务/工作流恢复被错误推迟；manual chunk 改动造成新循环或 CSS 闪烁；SW 预取组与实际 chunk 名失配。

**验证方法**：先补产物级回归测试使当前构建因 AI Chat 回流而失败；再验证 Chat/AI 首次打开、任务恢复和错误路径。使用同一构建、浏览器、视口、网络/CPU，冷/热与 SW on/off 各至少 5 次，记录遮罩消失、可操作控件、请求/传输量、长任务与样本范围；执行相关单测、startup validator、typecheck、cycles、build、size 和可用 E2E/视觉截图。

**回滚方式**：该 change 只触及独立 runtime 导出、条件挂载/轻壳、Vite/validator 与对应测试；按 change 文件清单反向恢复这些提交即可。不得清空用户存储或改数据格式；若任何恢复/首次交互不变量失败，整体回滚加载边界改动。

### [STARTUP-002] Web 测试配置使用 production React，App 启动测试为不可执行占位

**状态**：已证实并已修复（工具链/测试问题；无产品行为变化）。

**用户场景**：工作区初始化失败时，用户不能停留在白屏，应看到错误原因、日志、安全模式和调试入口。

**复现方式与当前/预期行为**：

1. 修改前运行 `pnpm exec vitest run --config apps/web/vite.config.ts apps/web/src/app/app.spec.tsx apps/web/src/sw/app-shell-routing.spec.ts apps/web/src/sw/cdn-fallback.spec.ts`。
2. 第一次结果退出 1：2 个文件/20 项测试通过，`app.spec.tsx` 在收集期因 `describe is not defined` 失败。
3. 将占位测试替换为真实 React 测试后再次运行，退出 1：Testing Library `act()` 报 `act(...) is not supported in production builds of React`。
4. 预期是 Vitest 使用 React development，并真实执行初始化失败恢复断言。

**证据与调用链**：

- 修改前 `apps/web/src/app/app.spec.tsx:1-6`（基线记录）：没有 Vitest import，唯一断言是 `expect(true)`，没有导入或渲染 App。
- `apps/web/vite.config.ts:1154-1171`：配置以命令行是否含 watch/serve 决定 React 环境；修改前所有 Vitest 命令都被定义为 `production`。
- 产品路径 `App initialize()` → `WorkspaceService.initialize()` reject → `setInitError`（`app.tsx:266-520`）→ `ErrorFallbackUI`（`:900-913`）。
- 测试路径 Vitest → web Vite define → React package production branch → Testing Library `render/act`；因此即使补真实测试也无法执行。

**根因**：测试文件和 Vite 环境两个独立问题叠加：占位文件依赖未启用的 globals 且没有行为断言；构建配置没有识别 `process.env.VITEST === 'true'`，把组件测试强制到 production React。

**修复与替代方案**：

- 实际修复：`apps/web/vite.config.ts:1154-1171` 增加只在 Vitest 进程为真的 `isTestMode`，测试使用 React development；`apps/web/src/app/app.spec.tsx:1-69` mock 工作区初始化失败并断言错误标题、错误消息、安全模式、调试入口和错误日志调用。
- 替代 A：开启 Vitest globals 并保留 `expect(true)`；会制造无行为价值的“通过”，拒绝。
- 替代 B：只把命令改成 serve/watch；污染命令语义且不能修复占位测试，拒绝。
- 替代 C：为所有测试引入 jest-dom；当前 Chai truthy/role 断言已满足，不需要新增全局依赖。

**影响范围与风险**：只影响 web Vitest 模式和一项 App 测试；`VITEST` 判定错误若泄漏到生产会改变 React 构建分支，因此生产 build/typecheck 必须复验。mock 只覆盖初始化失败，不代表正常、crash 或 stale chunk 路径已经覆盖。

**验证结果**：

- 同一窄 Vitest 命令最终退出 0：3/3 文件通过，21/21 项测试通过。
- `pnpm exec eslint apps/web/src/app/app.spec.tsx apps/web/vite.config.ts` 退出 0。
- `pnpm exec tsc -p apps/web/tsconfig.spec.json --noEmit` 退出 2，错误位于未修改的 `model-config.ts`、`image-viewer.ts`、`logger/index.ts`（CommonJS module/import.meta 与 viewer CSS 类型）；登记为现有 spec tsconfig 基线，不归因于本修复。
- 修复后的全仓 `pnpm typecheck` 退出 0，5/5 项目通过；生产 `pnpm build:web` 退出 0；因此未观察到本测试修复新增的类型或生产构建失败。
- 无视觉变更，前后截图不适用。

**回滚方式**：只需反向恢复 `apps/web/vite.config.ts` 的 `isTestMode` 三行和 `apps/web/src/app/app.spec.tsx`；不涉及用户数据、产物 schema 或缓存清理。

## 9. 当前阻塞与下一证据

- OpenSpec CLI 不可用：文件级核查可以继续，但 CLI validate 结果属于阻塞，不能伪造。
- Playwright 精确 revision 仍缺失：已用临时映射完成一轮兼容性受限的 smoke/feature/visual/responsive 基线并删除映射；通过与失败统计见第 2.2 节，不能把 revision 1228 结果冒充目标 revision 1200 的完全兼容验证。
- Git 元数据缺失：不能确认既有修改归属、历史根因或生成文件的原始值；所有改动必须保持小范围并提供逐文件回滚清单。
- `STARTUP-001` 已完成冷/热、SW on/off 各 5 次基线；尚无获批后的优化版本，因此不得作修复前后“更快/更慢”结论。
- 启动恢复状态矩阵和 `refactor-startup-shell-loading` proposal/design/tasks/delta spec 已更新；当前任务 13/26，实施门 `4.6 用户批准` 尚未完成。下一步必须等待用户批准加载边界与 2,000,000 B 入口静态图 raw budget，审批前不实施产品加载改动。
- F-02 的 WORKSPACE-002/003 已分别形成 `fix-workspace-current-deletion-transition` 与 `improve-workspace-operation-failure-consistency`；两项实施门均等待用户批准，审批前不修改删除成功转场或存储失败反馈。

## 10. 第二个功能循环：F-02 工作区、文件夹与画板管理

### 10.1 功能名称、用户场景与边界

用户从左侧工具栏打开“项目”，在“画布管理”中创建文件夹/画板、切换、重命名、复制、拖拽或菜单移动、重排、多选和删除；刷新后再次管理时，画板内容、名称、层级、顺序和当前选择仍保持一致。

范围：项目抽屉的画布管理页；文件夹/画板创建、切换、重命名、复制、移动、重排、展开、多选与删除；`useWorkspace` 状态桥；WorkspaceService 内存索引；IndexedDB board/folder/state store；当前画板的 sessionStorage 与 URL 更新；成功、空态、加载、验证失败、存储失败、取消、刷新恢复和离线本地操作。

非范围：项目抽屉的 PPT/Frame 与图层页（F-18/F-04）；ZIP 导入导出、备份恢复、迁移、多标签页和 GitHub 同步语义（F-03，F-02 只记录相邻副作用）；画布元素编辑本身（F-05/F-06）。

正式规格与活动 change：当前 `openspec/specs` 没有工作区项目管理独立正式 spec，也没有直接活动 change。`refactor-startup-shell-loading` 只把工作区恢复列为启动不变量，不授权修改数据格式；本轮以当前可达 UI、类型、实现、测试和浏览器行为为事实源。若方案改变删除、排序、恢复、schema 或跨标签页语义，必须新建独立 change；恢复“管理元数据不得改变画布元素”的既有数据保真行为不需要审批。

### 10.2 当前正向与反向调用链

正向入口：

`bottom-actions-section.tsx:108-123` “打开项目”按钮  
→ `drawnix.tsx:457-472` 切换 `projectDrawerOpen`  
→ `DrawnixDeferredFeatures.tsx:215-224` 条件挂载 ProjectDrawer  
→ `ProjectDrawer.tsx:1031-1054` 订阅 `useWorkspace`  
→ `ProjectDrawer.tsx:1119-1392,1571-1589` 收集创建/重命名/删除/复制/移动/切换意图  
→ `useWorkspace.ts:136-378` 转为 WorkspaceService Promise 并持有 hook error  
→ `workspace-service.ts:151-965` 更新 folders/boardMetadata/loadedBoards/兼容 boards Map、发出 RxJS 事件并调用存储  
→ `workspace-storage-service.ts:316-472` localForage/IndexedDB `folders`、`boards`、`state` store  
→ `workspace-service.ts:1188-1234` 事件触发 UI refresh 与可选 GitHub dirty/deletion 副作用  
→ `useWorkspace.ts:116-132` 重建树/currentBoard/state  
→ `ProjectDrawer.tsx:1790-1820` 渲染加载、空态或树；切换时 `app.tsx:527-575` 更新 URL/sessionStorage、恢复媒体 URL 并设置画布值。

反向写入者：

- 完整 Board 的核心写入口为 `workspace-storage-service.ts:346-349 setItem(board.id, board)`，没有字段合并。
- WorkspaceService 的管理写入者为 `workspace-service.ts:278,451,517,627,737,774,960`；相邻导入/备份/GitHub sync 也直接调用同一存储入口，留给 F-03 复审并发语义。
- 初始化与 reload 在 `workspace-service.ts:91-113,1290-1303` 只加载 BoardMetadata，再为兼容 `boards` Map 合成 `elements: []` 的 Board。
- 最终打开路径在 `workspace-service.ts:852-905` 从 loadedBoards 命中或 IndexedDB `loadBoard`，随后 `app.tsx:527-552` 把 `board.elements` 写入画布。

状态所有者与不变量：

- `boardMetadata`：所有画板轻量元数据；`loadedBoards`：最多 3 个完整 Board；`boards`：兼容 Map，可能同时装完整 Board 和 `elements: []` 投影；`WorkspaceState.currentBoardId`：内存，sessionStorage 做标签页隔离；URL 由 App 层同步。
- 不变量：创建、重命名、复制、移动、重排和“仅删目录”不得改变非目标画布元素；切换前保存当前画布；失败不得留下内存/IndexedDB 两份状态分叉；删除内容前必须显式确认；刷新后仍能加载完整画布。
- 存储失败无自动重试；rename/move 会抛回 UI toast，create/delete/copy 由 hook 转为空值或 false，但 ProjectDrawer 没有统一渲染 hook error。该错误反馈差异先登记为待浏览器验证，不与 WORKSPACE-001 混修。

### 10.3 状态与测试基线

| 状态 | 当前证据 | 分类 |
| --- | --- | --- |
| 正常创建/切换 | ProjectDrawer 创建前调用 `onBeforeSwitch`，创建后 switch 并通知 App；隔离浏览器实测可创建第二画板并刷新恢复 | 已证实 |
| 空态/加载 | `ProjectDrawer.tsx:1790-1798` 显示“加载中...”或“暂无画板/创建第一个画板” | 已证实（源码；视觉待系统 E2E） |
| 名称验证失败 | service 拒绝空、>100 字和同级重名；当前 node UI 在 `ProjectDrawer.tsx:376-390` 把全空白提交视为取消并还原名称，非空验证错误才进入 warning/保留编辑态 | 已证实（源码 + 浏览器）；空白取消没有规格证据证明是缺陷 |
| 删除取消/确认 | `ProjectDrawer.tsx:1823-1894` 区分画板、多选、仅删目录、删除目录及文件；浏览器取消后原画板仍存在 | 已证实（源码 + 浏览器） |
| 存储测试 | 用隔离内存 localForage 修复原测试环境后，定向 3/3 文件、27/27 测试通过；不带 `--environment jsdom` 的误调用因 `window is not defined` 退出 1，已单列为调用环境错误 | 通过；误调用不是产品失败 |
| Playwright | 仓库浏览器可执行文件缺失 | 环境阻塞 |
| 应用内浏览器 | 1280×720、本地生产构建、隔离 origin、SW 关闭；成功完成 WORKSPACE-001 复现 | 实测证据，不冒充 Playwright |

### 10.4 本轮验收标准与门禁

- 管理路径对未加载、有内容的画板执行重命名、复制、移动、重排和“仅删目录”后，重新加载的 `elements` 深度等于操作前；目标元数据按意图变化。
- 当前画板切换前保存、URL/sessionStorage 更新、删除确认、名称校验和空态不回归。
- 先建立不依赖真实 IndexedDB 的隔离回归测试；测试必须证明当前实现失败，再实施修复。
- 不改变 IndexedDB 数据结构、数据库版本、store/key、公开工作区 API、GitHub 同步协议或用户可观察操作语义。
- 定向测试、drawnix typecheck/定向 lint、全仓 typecheck 与可用浏览器复现通过；全仓既有失败逐项与基线比较。
- WORKSPACE-001 是恢复数据保真不变量的 bug 修复，不需要 OpenSpec 审批；任何扩大到批量操作语义、跨标签页并发或存储迁移的方案另行过门禁。

### [WORKSPACE-001] 刷新后管理未加载画板会用空元数据投影覆盖完整内容

**状态**：已证实、已修复并完成本问题复验（F-02 整体尚未退出）。

**用户影响**：用户刷新后不先打开某画板，直接对其重命名、移动、重排、复制或删除其父目录但选择“仅删目录”，该画板的元素可被永久替换为空数组。复制路径会生成空副本；移动/重排还可能覆盖同目录其他未加载画板。影响本地 IndexedDB 中的用户创作数据，优先级按 P0 数据完整性处理。

**复现与当前/预期行为**：

1. 在隔离 origin 的生产构建中创建画板 A，绘制 140×110 矩形；DOM 出现“图形元素”和宽高属性。
2. 创建并切换到画板 B，触发 `onBeforeSwitch → saveBoard` 保存 A。
3. 刷新页面；B 作为当前画板加载，A 只进入元数据 Map。
4. 不打开 A，在项目抽屉把“我的画板1”重命名为“含矩形画板”，随后打开 A。
5. 当前行为：重命名成功，但 A 显示空画布，原矩形消失。
6. 预期行为：名称变化，A 的元素、viewport、theme 和时间以外的内容保持不变。

**静态证明与精确位置**：

- `workspace-storage-service.ts:416-437` 初始化只提取 BoardMetadata，不含 elements。
- `workspace-service.ts:91-113` 和 `:1290-1303` 将 metadata 合成为 `{ ...metadata, elements: [] } as Board` 放入兼容 `boards` Map。
- `workspace-service.ts:496-518` renameBoard 从 `boards` 取该投影并整体保存。
- 相同模式覆盖 `deleteFolder` 的迁根 `:256-284`、moveBoard `:551-641`、moveFolder 重排同级画板 `:646-750`、reorderItems `:756-788`；copyBoard `:793-820` 直接深拷贝投影的空 elements。
- `workspace-storage-service.ts:346-349` 使用 `setItem` 整体替换，没有合并现有完整 Board。
- `workspace-service.ts:852-905` 后续 switchBoard 从存储读取已被覆盖的空 Board；`app.tsx:527-552` 将空 elements 设置为画布值。

**完整调用链**：项目抽屉双击名称/移动菜单/拖拽/复制/仅删目录 → ProjectDrawer handler → useWorkspace wrapper → WorkspaceService 从混合语义 `boards` Map 读取合成 Board → `workspaceStorageService.saveBoard` 整体 setItem → IndexedDB 完整记录被空 elements 覆盖 → RxJS tree refresh/成功 toast → 用户稍后 switchBoard → loadBoard 返回空 elements → App 设置空画布。

**根因**：为降低启动内存而引入的 BoardMetadata/按需加载边界没有贯穿管理写入路径；兼容 `boards: Map<string, Board>` 同时承载“完整实体”和“仅元数据投影”，类型无法表达二者差异，写入者把后者误当成可持久化完整实体。

**候选方案与替代方案**：

1. 最小方案：在存储服务增加保留 elements 的 metadata patch 原语；WorkspaceService 的重命名/移动/重排/仅删目录只提交明确元数据字段，同时同步 boardMetadata 与已加载 Board；copyBoard 在复制前显式读取完整 Board。
2. 备选 A：所有管理操作先加载完整 Board 再整体保存。能保真，但移动/重排会加载目标目录所有大画板，抵消按需加载收益。
3. 备选 B：初始化重新加载全部 Board。可绕开缺陷，但恢复此前已经优化掉的启动内存与 IndexedDB 成本，拒绝。
4. 备选 C：只修 renameBoard。相同根因有多个当前 UI 可达写入者，会保留数据丢失路径，拒绝。

**风险**：metadata patch 与画布自动保存并发时的最后写入顺序；loadedBoards/boardMetadata/兼容 boards 三份缓存字段分叉；批量/拖拽重排的顺序更新不完整；复制时读取失败的错误传播。

**验证方法**：使用内存存储 mock 构造“初始化只返回 metadata、存储仍有非空 elements”，对 rename/move/reorder/copy/deleteFolder-only 逐项断言存储元素深度不变；再执行同一浏览器步骤确认矩形仍显示。运行定向测试、相关工作区测试、typecheck、lint、全仓测试、cycles/build 并对照基线。

**回滚方式**：只反向恢复 workspace storage metadata patch、WorkspaceService 对应管理写入和新增测试；不清空 IndexedDB、不回退版本、不迁移用户数据。若管理元数据或切换恢复出现回归，整体回滚代码，不执行数据清理。

**实际改动与关键位置**：

- `workspace-storage-service.ts:117-119,180,321-344,376-408` 增加受限 `BoardMetadataUpdate`、每画板写队列与保留 `elements` 的 read-modify-write。
- `workspace-service.ts:259-283,340-371,527-543,576-833` 将重命名、移动、重排和“仅删目录”改为 metadata patch；复制未加载画板时显式读取完整 Board；三份内存索引按完整/元数据状态同步。
- `workspace.types.ts:108-125` 把 create options 的 `name` 调整为可选，与现有默认命名实现和调用者一致，无运行时行为变化。
- `workspace-board-metadata-persistence.test.ts:154-222` 覆盖 6 个 service 数据保真入口；`workspace-storage-metadata-update.test.ts:84-133` 覆盖 patch 保真与 canvas-save/metadata-patch 顺序；`workspace-rename-validation.test.ts:6-88` 改用隔离内存 localForage，消除测试环境对真实 IndexedDB 的错误依赖。

**红绿证据**：修复前新增 service 测试 1 文件、6/6 失败，全部读取到 `elements: []`；修复后定向 3/3 文件、27/27 通过。生产浏览器按相同步骤复验，重命名并打开 A 后 100×100 矩形仍存在。修复前截图：`docs/evidence/f02-workspace/workspace-001-broken.png`；修复后截图：`docs/evidence/f02-workspace/workspace-001-fixed.png`。

**验证结果**：

- `pnpm exec vitest run --environment jsdom <3 workspace files>`：退出 0，3/3 文件、27/27 测试通过。
- `pnpm exec vitest run <同 3 文件>`：退出 1，2 个 suite 在初始化时 `window is not defined`、25 项跳过，属于漏传 jsdom 的命令环境错误；存储层 2 项仍通过。
- `nx run drawnix:typecheck`：退出 0；全仓 `pnpm typecheck`：退出 0，5/5 项目通过；定向 lint：退出 0（产品文件只有既有 warning）；`pnpm check:cycles`：退出 0。
- `tsc -p packages/drawnix/tsconfig.spec.json --noEmit`：退出 2；错误来自既有测试类型漂移和 CommonJS/import.meta 配置，输出未命中本轮新增测试。
- `pnpm test`：退出 1；172 文件为 161 通过、10 失败、1 跳过，1068 项为 1051 通过、16 失败、1 跳过，另 1 个未处理异常。新鲜基线为 170 文件中 158/11/1、1060 项中 1024/35/1；本轮新增 2 文件全部通过，原 workspace 19 项由环境失败转为通过，剩余失败仍在既有模型排序、图片转换、工作流超时、提示词历史和 mock 漂移簇。
- `pnpm build:web`：退出 0；主应用 7931 模块、1m41s，SW 54 模块、1.61s。
- `pnpm size`：退出 1；AI Chat 844.14/140 kB gzip，Diagram 934.93/950 kB，Editor 858.24/870 kB，属于 F-01 既有预算债务；本轮未改对应 chunk。
- `pnpm verify:startup`：退出 0；入口静态图 4 个资源、无循环；该校验覆盖缺口仍由 STARTUP-001 跟踪。
- Playwright smoke/feature/visual/responsive：缺少 `chromium_headless_shell-1200`，未运行；应用内浏览器证据不冒充 Playwright。

**性能与视觉结论**：本修复增加 metadata patch 的一次受控读取来换取数据保真，未进行元数据操作延迟前后 5 次测量，因此不宣称更快或更省内存。没有视觉样式改动；前后截图只证明相同用户路径的矩形数据是否存在，不宣称视觉提升。

### [WORKSPACE-002] 删除当前/最后画板后 App 继续编辑已删除内容

**状态**：已证实缺陷；用户可观察转场等待 OpenSpec 审批，未实施。

**用户影响**：用户删除唯一当前画板，或删除包含当前画板的目录及内容后，抽屉已经显示“暂无画板”，但已删除画板元素仍显示并可编辑。WorkspaceService、App `currentBoardId/value`、URL/sessionStorage 和存储记录分叉；刷新前的编辑没有持久化目标。删除非最后当前画板且仍有候选时，现有单画板路径能切换到候选，未复现该分支异常。

**复现与当前/预期行为**：

1. 在隔离生产构建创建唯一画板并放置 100×100 矩形。
2. 项目抽屉右键当前画板，确认删除；或把当前画板放入目录并选择“删除目录及文件”。
3. 当前行为：抽屉显示“暂无画板/创建第一个画板”，矩形及属性工具条仍留在画布。
4. 预期行为候选：删除后所有状态指向存在的剩余画板；若无剩余画板，创建并激活默认空画板。该选择需用户审批。

**证据与完整调用链**：ProjectDrawer `handleDeleteBoard`（`ProjectDrawer.tsx:1243-1269`）→ `useWorkspace.deleteBoard`（`useWorkspace.ts:231-240`）→ `WorkspaceService.deleteBoard` 仅清 service ID/Map（`workspace-service.ts:546-573`）→ ProjectDrawer 只有找到 `firstBoard` 才调用 `onBoardSwitch`；无候选时 App `handleBoardSwitch`（`app.tsx:527-552`）从未运行，旧 `value/currentBoardId` 保留。目录路径 `ProjectDrawer.tsx:1210-1220` → `workspace-service.ts:288-315` 删除记录但不清当前 ID，也没有切换。`saveState`（`workspace-service.ts:1168-1181`）在 ID 为空时不移除旧 sessionStorage。最终 UI 由抽屉事件刷新为空树，而画布仍由 App 旧 value 渲染。截图：`docs/evidence/f02-workspace/workspace-002-last-board-delete-stale-canvas.png`。

**根因**：删除被实现为记录操作，活动画板转场分散在 ProjectDrawer 的单画板 handler；service 没有向 App 表达“当前画板已被删除”的结果，最后画板、批量和目录级联分支没有共享状态机。

**候选方案与替代方案**：推荐在成功删除后统一执行 post-delete transition：排除完整删除 ID 集选择第一剩余画板，无剩余时用现有 create/switch 创建默认空画板，并同步 App/URL/sessionStorage。备选是允许无画板并清空、禁用整个 Drawnix 编辑器；当前没有完整无持久化目标状态机，修改面更大。第三个备选是只清空旧画布但继续允许编辑，仍会产生不可保存内容，拒绝。

**风险与验证**：目录递归候选选取竞态、替代画板创建失败、关闭快照误恢复和多标签页旧 ID。批准后必须先补单画板/批量/目录级联/失败测试，同构建路径各 5 次，验证新画板为空、刷新不恢复删除元素、非当前删除与取消不切换。

**OpenSpec 与回滚**：`openspec/changes/fix-workspace-current-deletion-transition/*` 已写明方案、阈值和回滚；tasks 3/14，等待 1.4 审批。回滚只恢复 post-delete transition 与测试，不迁移或清理 IndexedDB，也不恢复用户确认删除的数据。

### [WORKSPACE-003] 存储失败会先提交内存状态且项目抽屉缺少反馈

**状态**：已证实事实（当前调用顺序与错误传播静态证明）；实际设备发生频率未知，行为修复等待 OpenSpec 审批。

**用户影响**：若单次 IndexedDB 写/删拒绝，createFolder/createBoard 可留下只存在于内存的幽灵项；renameFolder 可把失败名称泄漏到对象引用；deleteBoard/deleteFolderWithContents 可在存储仍有记录时先从内存移除，刷新后“重新出现”。deleteBoard 还在本地删除成功前启动远程删除。create/delete/copy 的 Hook 返回 `null/false`，ProjectDrawer 没有失败 toast 并会关闭删除对话框。浏览器环境无法安全强制单次 IndexedDB 拒绝，故发生频率和浏览器具体错误文案为未知。

**静态证明与调用链**：`workspace-service.ts:151-194,433-484` 先 `Map.set` 后 await save；`:240-256` 原地修改 Folder 后 await；`:546-573` 先远程 sync、清 current、删三份 Map 后 await delete；`:288-315` 目录级联同样 memory-first。异常进入 `useWorkspace.ts:136-166,205-240,277-286` 后被转成 `null/false`；`ProjectDrawer.tsx:1120-1154,1198-1220,1243-1269,1336-1347` 只处理成功分支或无失败提示。最终 UI 与 IndexedDB 发生分叉，刷新重新从存储构建树。

**根因**：service 的成功提交边界不一致：新增 metadata patch 已 storage-first，但 folder/create/delete 仍 memory-first；Hook 错误协议在 throw、boolean 和 nullable 之间分裂，ProjectDrawer 没有统一消费 `error`。

**候选方案与替代方案**：推荐单记录 persist-first，再更新内存/事件；Folder 使用不可变副本；本地删除成功后才触发远程删除；保留现有返回类型但 UI 明确处理 `null/false`。批量/递归无法凭当前 LocalForage API承诺跨 store ACID，只准确报告部分成功。备选是为每条路径编写回滚，需恢复三份 Map/current/session/object 引用，风险更高；引入事务层和 schema 迁移超出证据范围。

**风险与验证**：成功 UI 需等待现有同一次 I/O，但不新增请求；远程删除触发稍晚；部分成功反馈需要精确计数。批准后注入单次存储拒绝，断言内存/存储快照不变、成功事件和远程删除为 0、失败提示一次且无敏感内容。

**OpenSpec 与回滚**：`openspec/changes/improve-workspace-operation-failure-consistency/*` 已写明方案；tasks 2/12，等待 1.3 审批。回滚只恢复提交顺序、错误反馈与测试，不清理或迁移用户存储。

### 10.5 F-02 当前退出判断

WORKSPACE-001 的数据保真修复可以独立回滚，相关定向测试、构建、类型、循环和浏览器路径已复验；但 F-02 **未达到退出标准**。WORKSPACE-002 是已确认的当前/最后画板删除状态缺陷，WORKSPACE-003 是已确认的失败一致性缺陷，两项都需要用户批准后实施和复审。当前可以在不越过审批门的前提下转入 F-03 调查；F-02 保持“调查中/审批阻塞”，不能标记“已验证”。

## 11. 第三个功能循环：F-03 自动保存、关闭恢复、备份与同步

### 11.1 功能名称、用户场景与边界

**功能名称**：用户编辑当前画板后自动保存，在关闭/刷新或其他标签页写入后恢复一致内容，并可通过 v4 ZIP 或 GitHub Gist 备份与同步持久数据。

**范围**：App 画板/viewport 自动保存；关闭快照的 localStorage 兜底和启动回灌；同画板标签页版本通知；v4 complete/incremental 导出、merge/replace 导入、加密 secrets、workspace state 恢复；WorkspaceService 画板写入与 reload；GitHub workspace 事件、自动上传、启动 pull、冲突合并和本地落盘；可达 BackupRestoreDialog 与 SyncSettings/TokenGuide/RecycleBin 的 modal、键盘、焦点、状态、zh/en、凭据呈现和 Token 安全存储边界。

**非范围**：不审计任务自身的执行/重试状态机（F-10）、素材缓存全部配额语义（F-13）、提示词历史 UI（F-14）、一般供应商凭据 UX（F-26）、shared TDesign Dialog/ConfirmDialog/Menu 的全局默认、GitHub payload 加密或自定义同步密码存储策略。本轮只跟踪这些域是否被备份/恢复、是否影响画板持久化不变量，或是否直接进入可达 F-03 数据保全界面。

**对应规格/活动 change**：正式 `openspec/specs/backup-restore/spec.md` 要求 v4 完整环境、replace restore、加密 secrets、完整任务/提示词保真、v2/v3 兼容以及主应用/sw-debug 共享核心。`fix-backup-restore-current-board-transition`、`improve-backup-sync-interface-accessibility` 与 `enforce-github-token-encryption` 均已建立但审批未完成；三者分别拥有恢复转场、F-03界面、Token安全持久化/使用，互不代替。F-02 的两个工作区 change 与删除后的关闭恢复相邻，继续保持审批阻塞。

### 11.2 当前正向与反向调用链

**自动保存与关闭恢复**：Drawnix `onChange` → `App.handleBoardChange`（`apps/web/src/app/app.tsx:721-769`）收集 `children/viewport/theme` → 单调 persistence revision 标记待写（`:188-213`）→ `WorkspaceService.saveCurrentBoard/saveBoard`（`packages/drawnix/src/services/workspace-service.ts:951-989`）更新完整 Board → `WorkspaceStorageService.saveBoard` 每画板写队列 → localForage/IndexedDB → 完成对应 revision；页面 `visibilitychange/pagehide/beforeunload`（`app.tsx:839-912`）若仍有 revision 未完成，把最新完整 payload 写入 `aitu_board_close_snapshot_v1` 并尽力再次 flush IndexedDB。启动时 `loadBoardCloseSnapshot`（`:121-155`）与 IndexedDB Board `updatedAt` 比较，较新快照进入画布并异步 `saveBoard` 回灌（`:459-502`），没有更新 revision 时才清除快照。

**标签页同步**：保存完成 → `markTabSyncVersion(boardId)`（`app.tsx:757-766`；`packages/drawnix/src/hooks/useTabSync.ts:118-125`）写 localStorage 版本、tabId、boardId → 当前可见标签页 500ms 轮询/恢复可见立即检查（`useTabSync.ts:56-110`）→ 同 board 且非本 tab 时调用 `App.handleTabSyncNeeded`（`app.tsx:647-719`）→ `WorkspaceService.reloadBoard` 强制从 IndexedDB 读取并替换缓存（`workspace-service.ts:921-948`）→ 恢复视频 URL → 更新 App value/最新快照并重置 persistence epoch。写入者反向追踪还包括 `useWorkspace.saveBoard`（`useWorkspace.ts:301-315`）。

**ZIP 备份恢复**：应用菜单 `BackupRestore` → Drawnix lazy deferred feature（`DrawnixDeferredFeatures.tsx:135-156`）→ `BackupRestoreDialog` 校验选项/密码/时间范围（`backup-restore-dialog.tsx:175-235`）→ facade（`services/backup-restore/index.ts:10-24`）→ `BackupExportService` 收集 workspace state、提示词、环境、知识库、完整画板、素材和任务（`backup-export-service.ts:88-265`）→ shared backup core/part manager → JSZip/自动下载 → `ExportResult`/toast。反向导入从文件 input（`backup-restore-dialog.tsx:241-309`）→ 导入前保存当前画板 → manifest v2-v4 校验 → 环境、提示词、素材、项目、知识库、任务依次写回（`backup-import-service.ts:60-233`）→ 项目发生变化时 `workspaceService.reload()` → `ImportResult`/域统计/警告/错误 → 关闭时恢复 backed workspace state 或刷新运行时（`backup-restore-dialog.tsx:91-173`）。

**GitHub 同步**：`WorkspaceService.saveBoard` 成功 emit `boardUpdated`（`workspace-service.ts:951-977`）→ service 自身的动态 import 后备和已挂载 `GitHubSyncProvider` 订阅分别调用 `syncEngine.markDirty`（`workspace-service.ts:1191-1247`；`GitHubSyncContext.tsx:354-410`）→ 配置允许时 debounce `pushToRemote`（`sync-engine.ts:1694-1704,1846-1883`）→ 序列化/加密 → GitHub Gist。启动 pull 只在 GitHubSyncProvider 挂载且 token/gist 有效时空闲调度（`GitHubSyncContext.tsx:231-299`）；远端内容经 deserialize/merge → `dataSerializer.applySyncData` 写 folders/boards、处理 tombstone、reload workspace（`data-serializer.ts:918-1025`）→ context 处理当前画板 reload/切换（`GitHubSyncContext.tsx:120-210,505-582`）。Provider 当前只由同步设置和素材库的 deferred wrapper 挂载；是否要改为全局启动语义没有正式规格，暂不认定缺陷。

### 11.3 已知基线与本轮验收标准

- 修改前全仓基线为 170 文件中 158 通过、11 失败、1 跳过；1060 项中 1024 通过、35 失败、1 跳过；1 个未处理异常。F-02 后全仓为 172 文件中 161/10/1、1068 项中 1051/16/1；剩余失败簇未落在本轮新增回归测试。
- F-03 现有专属窄测：`backup-utils`、`backup-crypto`、GitHub blob/KB/paged sync 共 5/5 文件、36/36 项通过；paged sync 同时输出既有 `indexedDB is not defined` 异步配置写入噪声，但退出码为 0。
- F-03 界面受控诊断隔离复跑退出 0，1/1 文件、4/4 项；Token fallback 非凭据哨兵诊断退出 0，1/1 文件、1/1 项。临时诊断文件均已删除，原始结构化结果保存在 `docs/evidence/f03-backup-sync/metrics.json`。
- 生产 Chromium `127.0.0.1:7393/?sw=0`、1280×720、DPR 1、无配置 throttle、单样本确认两个可达对话框的语义/焦点事实并生成两张 before 截图；未读取浏览器存储、未发起真实远端操作。当前 Browser binding 不能调整视口，因此 320/390 几何仍未知。
- Playwright 仍因缺少 `chromium_headless_shell-1200` 阻塞；OpenSpec CLI 仍不可用；无 Git 元数据，不能核对历史或干净状态。
- 本轮退出需要：并发自动保存和关闭快照不丢最新 revision；恢复/错误/刷新路径有定向测试；备份 v4 文档与源码一致；用户可见恢复转场通过审批并验证，或保留明确阻塞；标签页冲突语义在受控时序证据前只登记假设；全仓类型、测试、循环、构建和预算不新增回归。

### [WORKSPACE-PERSIST-001] 较早保存完成会掩盖仍待写的较新画布

**状态**：已证实缺陷，已修复并完成窄验证。

**用户影响与复现**：构造同一画板连续变更 A、B，并延迟两个 `saveCurrentBoard` Promise；A 完成、B 仍 pending 时触发 `beforeunload`。旧实现用一个 boolean 表示 pending，A 完成会把它置 false，因此不写 B 的 localStorage 关闭快照；如果 B 快照已写，A 的旧完成也会提前删除它。当前行为可能在页面关闭中断 B 的 IndexedDB 写入时丢失最新变更；预期是只有最新 revision 已落盘后才能清快照。

**证据与调用链**：红测试 `apps/web/src/app/app-persistence.spec.tsx:96-153` 首次运行 1/1 失败，`beforeunload` 后没有包含第二次变更的快照。链路为 Drawnix onChange → `handleBoardChange` → boolean pending → 两个 `saveCurrentBoard` Promise → 旧 Promise 完成清 pending/快照 → beforeunload 跳过 snapshot。完整写入/恢复节点见 11.2。

**根因与方案**：boolean 只能表达“有/无”，不能标识异步完成对应哪次变更。最小修复在 `app.tsx:188-213` 引入单调 `persistenceRevisionRef/persistedRevisionRef`；每次画布/viewport 写入取得 revision，完成只确认自己的 revision，只有 `persistedRevision >= persistenceRevision` 才清快照；切板、tab reload 和 close-snapshot 回灌重置或推进同一 epoch。备选的全局 Promise 串行链会把 UI 层与存储调度重复耦合，且 WorkspaceStorageService 已负责每画板写序，未采用。

**风险、验证与回滚**：风险是切板/tab reload 后旧 Promise 完成污染新画板 pending 状态；通过 reset epoch 和 `Math.max` 避免旧 revision 倒退。定向 `app-persistence.spec.tsx + app.spec.tsx` 两次复跑均退出 0、2/2 文件、2/2 测试；最终补丁后 `nx run web:typecheck` 与新增测试单文件 lint 均退出 0。回滚只恢复 App pending 跟踪和该回归测试，不清理 localStorage/IndexedDB；旧快照仍由现有 boardId/updatedAt 校验处理。

### [BACKUP-RESTORE-001] workspace reload 后把非空当前画板误判为空并自动切换

**状态**：已证实缺陷；用户可观察转场等待 OpenSpec 审批，未实施。

**用户影响与静态复现**：在非空画板 A 上导入包含画板 B 且 workspaceState 指向 B 的项目备份；导入前 A 被保存。项目写入完成后 `workspaceService.reload()` 清空完整缓存，再用 metadata + `elements: []` 重建 `boards`；关闭结果对话框时 `handleWorkspaceRestore` 读取该投影，将 A 判定为空并自动切到 B，不展示组件已经存在的确认框。预期候选是从完整持久化 A 判断空态：非空时确认，取消则保持 A；真正空时仍自动切换。

**证据与完整调用链**：`backup-restore-dialog.tsx:270-289` → `backup-import-service.ts:163-205` → `workspace-service.ts:1291-1328` 清 `loadedBoards` 并建立空投影 → `workspace-service.ts:1010-1022` `getCurrentBoard` 返回投影 → `backup-restore-dialog.tsx:91-137` `elements.length === 0` → 自动 `onSwitchBoard` → deferred feature `workspaceService.switchBoard` → App `handleBoardSwitch` → URL/sessionStorage/value。反向从确认框分支可见它只在 `isCurrentBoardEmpty === false` 时调用，而 reload 后该条件对存在的当前画板不可达。

**根因、候选方案、风险与回滚**：根因是 UI 把按需加载的 metadata projection 当作完整实体。推荐复用 `WorkspaceService.isBoardEmptyAsync` 按 ID 读取完整 Board；备选的导入前 elements 快照会再造一份与最终保存可能分叉的状态，未选。风险是关闭结果时新增一次按 ID IndexedDB 读取，以及读取失败时的错误反馈。`openspec/changes/fix-backup-restore-current-board-transition/*` 已写明测试、阈值和回滚；tasks 2/11，等待 1.3 审批。回滚不迁移或清理任何导入数据。

### [BACKUP-DOC-001] 功能文档仍描述旧三域与 Blob API

**状态**：已证实文档漂移，已修复。

**证据与修复**：旧 `docs/FEATURE_FLOWS.md:654-718` 只列提示词/项目/素材、只描述增量导入，并示例把 `exportToZip` 返回值当 Blob 再调用 `downloadZip`。当前 `types.ts:16-182`、export/import service 和 formal spec 明确为 v4、complete/incremental、merge/replace、tasks/knowledgeBase/environment、加密 secrets、域统计和 `ExportResult`；part manager 在 finalize 时已自动下载。文档已同步到当前 API、ZIP 域和缓存刷新链，不改运行时。

**验证与回滚**：通过逐项对照 `types.ts`、export/import service、shared backup core/part manager 与 formal spec 复核；没有专属 Markdown 构建器。回滚只恢复该文档段落，不影响代码或数据。

### [TAB-SYNC-001] 远端 reload 后，排队的旧本地 viewport 仍会写回

**状态**：已证实时序行为；是否构成缺陷因冲突优先级规格缺失而阻塞，未修改产品代码。

**用户影响与当前/预期**：若一个标签页在本地 pan/zoom 防抖等待期间收到同画板的远端保存，当前 App 先显示远端画板与 viewport，随后可能把本地更早的 viewport 写回 IndexedDB。元素取自 reload 后的远端 Board，因此本次证据没有显示元素丢失；用户可观察到的风险是跨标签页 viewport 回跳和共享 viewport 版本被改写。预期行为未知：仓库没有规定远端 viewport 优先、本地最后交互优先或字段级合并。

**受控复现与原始结果**：在 Node `v24.14.0`、Vitest `v3.2.4`、jsdom、单次样本中，诊断 harness 先调用 `onViewportChange({zoom: 2})` 启动 500ms timer，再让 `reloadBoard` 返回远端元素 `remote` 与 `{zoom: 3}`，等待 `onTabSyncNeeded` 和 100ms sync 保护窗结束。命令退出 0，1/1 文件、1/1 测试通过，测试耗时 1147ms；最终 `saveCurrentBoard` 的原始 payload 为远端 `children:[{id:'remote'}]`、旧本地 `viewport:{zoom:2}`、`theme:undefined`。临时诊断 spec 随后移除，没有留在产品测试树。

**完整调用链与根因**：Drawnix viewport event → `App.handleViewportChange`（`app.tsx:779-837`）捕获旧 viewport 并排队 500ms → `useTabSync.checkSync`（`useTabSync.ts:60-87`）→ `handleTabSyncNeeded`（`app.tsx:647-719`）只设置 `isSyncingRef`、reload 远端 Board、reset revision，并在 100ms 后清 flag → 旧 timer 在 `isSyncingRef === false` 后运行 → 从当前 Board 取远端 elements，但从闭包取旧 viewport → `saveCurrentBoard` → IndexedDB。根因事实是 sync 开始时没有取消/归并既有 viewport timer；缺失的是冲突所有权规则，而非调用链证据。

**候选方案、风险、验证与回滚**：远端优先方案是在 sync 开始时取消旧 timer，并使对应 revision 失效；本地优先方案是在 reload 前 flush/等待本地 viewport；字段级方案需显式版本或冲突元数据。三者会产生不同用户结果，当前不得代选。用户确定语义后需独立 OpenSpec，使用两个 WorkspaceService/标签页和可控 IndexedDB transaction 覆盖本地早/晚、隐藏/恢复、写失败与刷新；回滚只恢复 timer/revision 协调，不迁移 Board schema。

### [BACKUP-UI-A11Y-002] 备份对话框的 modal/tab/文件选择与焦点契约不完整

**状态**：已证实缺陷；用户可观察界面行为等待 `improve-backup-sync-interface-accessibility` 审批，未实施。

**用户影响、复现与预期**：生产1280×720打开“备份 / 恢复”，根节点有`role=dialog`但无名称，视觉tab没有tablist/tab/selected语义，关闭后焦点落到`body`。受控fixture中ZIP入口为`DIV`、`tabIndex=-1`；Enter触发文件选择0次，pointer触发input click 2次。预期是可命名modal、键盘/指针等价的单一文件激活、可识别/切换的tab状态及安全焦点返回，不改变`.zip`、merge/replace或服务调用。

**证据、调用链与根因**：`backup-restore-dialog.tsx:334-364,629-644`、`drawnix.tsx:553-561`；应用菜单→Drawnix open state→deferred dialog→tab/dropzone→hidden input/service→result/close→`body`。反向写入者仅为文件input/备份服务回调和open-state owner。源码+受控keyboard/pointer+生产DOM/焦点三类证据，强度高。根因是视觉结构与programmatic dialog/tab/file/focus contract未连接，且菜单项在modal打开前卸载。

**方案、风险、验证与回滚**：提案使用现有heading关系、labelled tabs、一个native文件激活owner，并捕获invoker/稳定菜单launcher；仅给div补`tabIndex`的备选仍保留双激活owner，未选。验证role/relationship、初始/关闭焦点、nested confirm precedence、Enter/Space/pointer精确次数及服务调用不变；风险为双文件框、处理期切tab、Escape泄漏或返回断连节点。回滚只移除界面/焦点 wiring，无数据迁移。

### [BACKUP-STATUS-A11Y-003] 备份进度与终态没有程序化状态

**状态**：已证实缺陷；等待同一界面 change 审批，未实施。

**用户影响、复现与预期**：受控导出回调发出37%与`fixture progress`时，没有progressbar、`aria-valuenow`或live status；导入成功、部分错误、警告与错误结果也只是普通内容。屏幕阅读器用户无法获知长操作百分比或区分终态。预期是确定进度值、简洁live消息及success/partial/warning/error语义，不移动焦点、不改变回调/toast。

**证据、调用链与根因**：`backup-restore-dialog.tsx:534-540,646-652,655-731`；export/import callback→React progress/message/result state→TDesign Progress/普通文本→accessibility tree，反向写入者只有两个service callback与`setImportResult`。受控组件证据强度高；没有时长或性能结论。根因是视觉Progress和文本没有F-03 programmatic status contract。

**方案、风险、验证与回滚**：提案增加component-scoped progressbar/status/alert与polite消息节流；每次更新移焦点的备选会干扰输入并重复播报，未选。验证0/37/100、消息更新、部分成功/警告/错误、busy/disabled、单操作和焦点不动；风险为公告噪声或百分比/消息陈旧。回滚只移除ARIA/live wiring。

### [SYNC-UI-A11Y-004] 云同步 modal、disclosure 与控件名称不完整

**状态**：已证实缺陷；等待同一界面 change 审批，未实施。

**用户影响、复现与预期**：生产断开态root是`DIV tabindex=0`，无dialog/modal/name；默认X是`SPAN tabindex=-1`且无名称，Escape虽可关闭但焦点落到`body`。受控连接态的Gist与回收站header均为click-only DIV；Enter加载0/0次，pointer为1/1次。Token、自动同步、密码与icon-only删除缺程序化名称。预期是F-03 scoped named modal、native named controls/disclosures、键盘/指针等价、状态正确且每次激活只调用一次。

**证据、调用链与根因**：`SyncSettings.tsx:442-530,565-605,608-793`、`RecycleBin.tsx:170-390`；菜单→deferred provider/dialog→context/service state→TDesign/HTML controls→confirm/service callback→inline state/toast/close。源码+生产DOM/焦点+受控精确调用证据强度高；不外推shared TDesign所有caller。根因是F-03 owner依赖视觉shell/default close与styled-div disclosure，却未补自身semantic/focus/label contract。

**方案、风险、验证与回滚**：提案只在组件内增加semantic shell/custom close/native disclosure/labels；全局修改TDesign会影响无证据caller，未选。验证断开/连接、loading/empty/error/current、close/Escape/confirm、全部名称/状态与服务参数；风险为nested modal焦点、重复load或删除target漂移。回滚为UI-only，无存储清理。

### [SYNC-CREDENTIAL-PRESENTATION-005] 自定义同步密码的新输入默认明文显示

**状态**：已证实的凭据呈现缺陷；等待同一界面 change 审批，未实施。

**用户影响、复现与预期**：受控连接态`.sync-settings__password-input`为`type=text`且无label。源码把存储密码的masked/unmasked display插入placeholder，但新输入始终明文，现有“显示/隐藏”不控制它，增加肩窥与录屏暴露。预期是新输入与存储显示默认mask、仅经现有显式action揭示，明文不进入placeholder/name/status/log，传给现有save/clear service的字节不变。

**证据、调用链与根因**：`SyncSettings.tsx:119-140,165-208,731-793`；`syncPasswordService.getPassword`→stored-password state→mask/show→placeholder，新输入→`customPassword`→`savePassword`。源码+受控DOM证据强度高，未读取真实密码。根因是同一text field混合解释placeholder、存储秘密显示和新秘密输入。

**方案、风险、验证与回滚**：提案使用默认masked password input与具程序化状态的显隐action；删除reveal会移除既有控制，改变存储则属另一安全决策，均未选。验证masked typing、显隐、name/state、byte-identical save、clear/reopen与输出无secret；风险是替换值无法核对或accessible output泄密。回滚只恢复呈现，存储记录不变。

### [BACKUP-SYNC-I18N-006] 备份与同步界面绕过现有中英文 provider

**状态**：已证实缺陷；等待同一界面 change 审批，未实施。

**用户影响、复现与预期**：在`I18nProvider defaultLanguage="en"`下渲染owner，“备份 / 恢复”和“云端同步”仍存在；BackupRestoreDialog、SyncSettings、RecycleBin、TokenGuide均未消费`useI18n`。英语用户会在备份、进度、结果、校验与确认路径遇到中文。预期是application-authored copy随zh/en初始值与live switch更新，而board/file/user/Gist/provider/imported文本及凭据逐字节保持。

**证据、调用链与根因**：`i18n.tsx:589-631`、`backup-restore-dialog.tsx:91-754`、`SyncSettings.tsx:45-860`、`RecycleBin.tsx:27-390`、`TokenGuide.tsx:18-127`；I18nProvider→已翻译菜单入口→lazy F-03 owner（当前绕过context）→中文literal/message。源码+受控provider证据强度高。根因是本地化只到应用菜单，未进入懒挂载的F-03 components。

**方案、风险、验证与回滚**：提案增加typed F-03 keys及sentinel数据保真测试；浏览器locale推断和翻译raw error/data会绕过语言owner或改变数据，未选。验证zh/en初始/live、全部状态、sentinel逐字节与service参数；风险为部分翻译或误译标识符。回滚key/consumer/tests，无迁移。

### [SYNC-TOKEN-ENCRYPTION-007] GitHub Token fallback 被当作加密记录持久化与使用

**状态**：已证实安全契约缺陷；安全/存储/恢复语义等待独立 `enforce-github-token-encryption` 审批，未实施。

**用户影响、复现与预期**：仅把`globalThis.crypto`置为undefined，用密码A加密固定非凭据哨兵，再用密码B解密；结果prefix=`OPENTU_FB:`、`isEncrypted=true`、不同密码恢复明文=true。Web Crypto不可用或AES抛错时，已验证GitHub Token可被可逆Base64存入localStorage并用于Authorization，而TokenGuide无条件声明本地AES-256。预期是只有verified AES记录可被提交/使用，或以不泄密的状态阻断并允许恢复。

**证据、调用链与根因**：`github-sync/token-service.ts:28-47`、`crypto-utils.ts:53-68`、`packages/utils/src/crypto/aes-gcm.ts:161-220,257-260`、`TokenGuide.tsx:95-99`；Token input→GitHub validation/scope→TokenService→CryptoUtils→shared AES/fallback→localStorage→decrypt→Authorization。反向唯一写入者为TokenService。源码+确定性1/1非凭据诊断证据强度高；正常PBKDF2/AES-256-GCM路径已验证为非问题。

**方案、风险、验证与回滚**：提案对新Token fail closed，并只在成功生成、验证和同key写入AES后缓存/使用fallback明文；失败保留旧fallback、不删除/不使用/不泄露。只改文案会保留可逆bearer credential，全局删除fallback会影响无证据消费者，均未选。验证正常AES、crypto不可用/抛错、旧secure保留、两种fallback prefix、原子迁移成功/失败、malformed record、redaction与既有GitHub回归；风险是unsupported环境暂失同步及迁移覆盖recoverable value。回滚兼容已迁移AES但不能还原不安全fallback。

### [SYNC-PASSWORD-STORAGE-008] 自定义同步密码存储策略缺少可判定的安全契约

**状态**：待验证假设，未创建提案、未修改代码。

**怀疑依据与阻塞**：`sync-password-service.ts:24-49,72-117`静态证明当前使用浏览器特征派生值做XOR+Base64存储；这是实现事实，但仓库中未找到threat model说明该密码需满足fail-closed AES、session-only还是每次同步输入。因此不能从算法形态直接认定产品缺陷，也不能与Token change混改。

**调用链、验证计划与候选决策**：SyncSettings输入/保存→syncPasswordService→localStorage→GitHub payload crypto consumer；反向消费者还包括同步解密。取得产品安全契约后，需要用非凭据sentinel验证存储、重启恢复、错误、清除和同步兼容，再分别评估Web Crypto fail-closed、仅会话保存或保持现状。任何方案都会改变凭据可用性/恢复语义，需独立OpenSpec与回滚设计；在决策前保持未知/阻塞。

### 11.4 F-03 当前退出判断

WORKSPACE-PERSIST-001 已用红绿测试修复；BACKUP-DOC-001 已同步文档；备份与 GitHub sync 现有专属测试 36/36 通过。新增界面/Token受控诊断5/5通过，1280×720生产浏览器事实和两张before截图已留档。F-03 仍未达到退出标准：BACKUP-RESTORE-001、BACKUP-UI-A11Y-002至BACKUP-SYNC-I18N-006及SYNC-TOKEN-ENCRYPTION-007分别等待三项OpenSpec审批；TAB-SYNC-001的冲突优先级需要用户/规格决策；自定义同步密码安全契约、compact几何与正式Playwright仍阻塞。当前没有产品性能或视觉实现，不宣称更快、更小或更美；已有before证据但没有after截图/结论。

**当前验证结果**：

- `pnpm exec vitest run --config apps/web/vite.config.ts app-persistence.spec.tsx app.spec.tsx`：退出 0，2/2 文件、2/2 测试；最终补丁后复跑结果一致。
- `pnpm exec eslint apps/web/src/app/app-persistence.spec.tsx`：退出 0。把 `app.tsx` 一并加入时退出 1：4 个 error 位于既有 Nx module-boundary/no-inferrable 行，2 个 warning 位于既有 non-null/any 行；没有命中本轮 revision 代码。
- `pnpm exec vitest run --config packages/drawnix/vite.config.ts <backup/github 5 files>`：退出 0，5/5 文件、36/36 测试；paged sync 输出既有无 IndexedDB 异步配置写入噪声。
- 临时F-03界面诊断首次探索退出1，1/4项通过、3项失败、14.10s；失败揭示pointer文件click为2、TDesign根无dialog role及shared barrel的无关IndexedDB噪声。修正隔离后退出0，1/1文件、4/4项、9.43s（test time 480ms）；临时文件已删除。
- 临时Token fallback诊断退出0，1/1文件、1/1项、685ms（test time 5ms）；固定非凭据哨兵结果为`OPENTU_FB:`、reported encrypted=true、不同密码恢复明文=true；临时文件已删除，未打印哨兵内容。
- 应用内生产Chromium：`dist/apps/web`、1280×720、DPR1、单样本、无配置throttle；只打开/关闭备份与断开态云同步，未读browser storage、未触发远端请求。两张before截图位于`docs/evidence/f03-backup-sync/`；tab/server已关闭。该结果是浏览器证据，不等同Playwright通过。
- `nx run web:typecheck`：退出 0；全仓 `pnpm typecheck`：退出 0，5/5 项目；`pnpm check:cycles`：退出 0。
- `pnpm test`：退出 1；172 文件为 161 通过、10 失败、1 跳过；1068 项为 1051 通过、16 失败、1 跳过；1 个未处理异常。与 F-02 后基线完全一致，本轮没有新增失败。
- `pnpm build:web`：退出 0；主应用 7,931 模块、2m13s，SW 54 模块、2.38s；仍有既有 Sass 与动态/静态混合导入告警。该命令再次更新 `apps/web/public/version.json` buildTime，因无 Git 历史无法比较旧值。
- `pnpm size`：退出 1；AI Chat 844.14/140 kB gzip，Diagram 934.93/950，Office 269.19/300，Editor 858.24/870，Media Viewer 12.19/20；与 F-02 后预算值一致。
- `pnpm verify:startup`：退出 0；入口静态图无循环，idle-prefetch 分组存在；F-01 的覆盖缺口仍未解决。
- Playwright smoke/feature/visual/responsive：仍缺少 `chromium_headless_shell-1200`，没有运行。应用内浏览器已作为F-03生产DOM/焦点与before截图证据，但不替代正式Playwright，也不构成before/after视觉改善结论。

## 12. 第四个功能循环：F-10 任务队列、执行、恢复与历史

### 12.1 功能名称、用户场景、范围与门禁

**功能名称**：用户从直接生成、工作流或内置工具创建 AI 任务，在任务面板与画布看到进度，能够取消、重试、刷新恢复、查看归档历史，并让终态结果持久化供工作流、素材库和提示词历史复用。

**范围**：任务参数校验/清理；主线程创建与执行；图片/视频/音频/Chat/角色任务分发；供应商 route snapshot；进度、错误、取消、重试、超时和结果写回；`aitu-app/tasks`；旧库迁移；刷新恢复和远端轮询；RxJS → Jotai/任务面板/工作流/锚点/自动插入；100 条活跃保留与归档分页；备份/GitHub 任务记录入口。

**非范围**：模型输出质量与供应商发现（F-09）；工作流解析与动态步骤业务语义（F-11）；素材配额/预览（F-13）；各内置工具自身的批次状态机（F-16～F-20）。本轮只追踪这些消费者如何创建、观察、取消、恢复或持久化任务。

**规格与活动 change**：正式 `image-generation-feedback` 要求生命周期反馈与原位重试；`backup-restore` 要求终态/归档任务保真；`ppt-outline-generation` 规定 PPT 图片最多 5 个 in-flight；`video-batch-generation` 仍规定串行与失败重试。`refactor-sw-duplex-comm` 以 SW 创建/执行任务为前提，与当前主线程实现冲突，保持暂停。新建 `enforce-task-queue-concurrency-limit`、`fix-task-queue-external-cancellation`、`persist-github-synced-task-history` 三个执行/存储 change，以及后续 F-28 子循环的 `improve-task-queue-responsive-accessibility`，均停在审批门且所有权互不替代。

**本轮验收**：创建/执行/终态调用链有双向证据；角色、普通、外部工作流和恢复分发不重复；取消/重试/迟到写回一致；远端可恢复任务保留 route/remoteId；终态/归档/GitHub/备份跨刷新可读；相关窄测与全仓基线无新增失败。并发、取消和 GitHub 存储三项因改变调度/执行/存储语义，审批前只写 change，不实施。

### 12.2 当前完整调用链

**普通队列任务正向链**：直接生成 UI（`ai-image-generation`、`ai-video-generation`、批量图片、角色对话框）或 MCP queue 工具（`queue-utils.ts:107-169`）→ `useTaskQueue.createTask` / `taskQueueService.createTask` → `task-queue-service.ts:1904-1977` 校验、清理、建立 Task/route snapshot、内存 Map、IndexedDB fire-and-forget、`taskCreated`/analytics → 普通图片/视频/Chat 直接进入私有 `executeTask`（`:609-1189`），音频走 adapter 特化分支，角色任务修复后以 `pending` 交给 `useTaskExecutor` → media executor / adapter / 网络或轮询 → `taskStorageWriter` 写 `aitu-app/tasks` → `waitForTaskCompletion` / progress 回调 → 内存终态与 TaskEvent → Jotai 任务列表、工作流同步、图片锚点、自动插入、素材/画布标记。

**工作流外部任务链**：`MainThreadWorkflowEngine.executeToolStep`（`workflow-engine/engine.ts:341-425`）→ `media-generation/image|video` → 先 `claimTaskForCurrentSession`、`taskStorageWriter.createTask`、`trackExternalTask`（image `:119-154`；video `:58-107`）→ fallback executor/adapter 用工作流 signal 执行并直接写 IndexedDB → `waitForTaskCompletion` → `syncTaskFromStorage` → result 回到工作流 step → workflow storage/event → WorkflowContext、ChatDrawer、WorkZone/锚点。该外部 signal 当前没有登记到 task service，形成 `TASK-CANCEL-001`。

**状态与 UI 反向链**：任务面板/工具栏/版本升级提示读取 `useTaskQueue` 的 Jotai atoms（`useTaskQueue.ts:64-119,275-325`）← `ensureTaskStateSyncStarted` 订阅 `observeTaskUpdates`（`:189-209`）← 唯一内存 Map 写入者为 task service 的 create/update/progress/cancel/retry/delete/restore/storage sync。画布结果反向写入 `markAsInserted`（`task-queue-service.ts:2460-2486`）；素材落盘标记写入 `markAsSaved`（`:2440-2458`）。终态超出 100 条时从活跃 Map 移除并在 IndexedDB 标 `archived`（`:2488-2525`）；`ArchivedTaskList` 再经 reader cursor 分页读取。

**启动与恢复链**：`DrawnixDeferredRuntime` → `useTaskStorage` 先迁移旧 `sw-task-queue`，再读取 `aitu-app/tasks`（`useTaskStorage.ts:45-78`）→ `restoreTasks` 按 `updatedAt` 合并并剥离大参数 → 当前会话/较新内存快照跳过中断判定 → 无 `remoteId` 的中断任务标失败；异步图片/音频和带 `remoteId` 视频保留 polling → `useTaskExecutor` 恢复异步图片/音频，`fallbackMediaExecutor.resumePendingTasks` 在 idle 后恢复视频（`DrawnixDeferredRuntime.tsx:117-154`；`fallback-executor.ts:1184-1340`）。刷新后调用链以 route snapshot 保持原供应商。

**存储写入者反向链**：`taskStorageWriter.save/updateProgress/updateRemoteId/complete/fail/archive/import/delete` 的调用者包括 task service、fallback executor、media-generation、备份导入和角色元数据；reader 的消费者包括启动恢复、素材轻量记录、提示词摘要、归档列表、备份和 GitHub。本轮确认 GitHub `TaskSyncService.syncTasks` 下载分支只调用内存 `restoreTasks`，没有 writer。

### [TASK-CHARACTER-001] 角色任务被送入不支持该类型的即时媒体执行器

**状态**：已证实缺陷，已用红绿测试修复。

**用户场景与复现**：用户在已完成视频的角色提取对话框选择时间段并确认。入口 `CharacterCreateDialog.tsx:68-102` 调用通用 `createTask(..., TaskType.CHARACTER)` 并提示“已加入队列”。修改前任务立即为 `processing`，随后私有 media switch 落入 `default` 并抛出 `Unsupported task type: character`；真正的 `executeCharacterTask` 只由 Hook 对 `pending` 事件调用。红测试退出 1，1/1 失败，原始 stderr 精确出现 `task-queue-service.ts:1097 Unsupported task type: character`，断言收到 `processing` 而非 `pending`。

**当前/预期与调用链**：旧链为对话框 → `useTaskQueue.createTask` → service 即时 execute → unsupported → failed；预期现有链为对话框 → pending `taskCreated` → `useTaskExecutor.ts:650-680` 订阅 → `executeCharacterTask`（`:353-451`）→ Character API polling → `characterStorageService.saveCharacter` → completed Task/result。影响范围仅 `TaskType.CHARACTER`；图片/视频/音频/Chat 仍由原服务执行。

**根因与修复**：通用 `createTask` 和 `retryTask` 在所有类型上硬编码 `PROCESSING + executeTask`，与已存在的角色专用 owner 分叉。修复在 `task-queue-service.ts:1916-1974,2217-2260` 明确 `usesDedicatedTaskExecutor`：角色首次创建和失败/取消后重试都以 `pending` 发事件且不进入私有 media executor，Hook 自己推进 `processing`。备选是在 service 内复制 Character API/角色存储逻辑，会制造两个 owner，未采用。

**证据强度、验证与回滚**：强度为可达 UI + 双执行 owner 静态证明 + 两轮红绿集成测试。新测试 `task-queue-service-image-retry.test.ts:447-505` 同时断言首次创建及失败后重试都发出 pending event、无 startedAt/phase、media executor/完成轮询调用均为 0；首次红测收到 processing，重试复审红测再次收到 processing，修复后均退出 0、1/1。回滚只恢复角色创建/重试分发条件和该测试，不迁移/删除 Task 或 Character 数据。

### [TASK-CONCURRENCY-001] 普通任务绕过声明的共享并发上限

**状态**：实测确认；执行/排队语义等待 OpenSpec 审批，未实施。

**用户影响与受控复现**：批量/多个入口可在同一时段创建超过 20 个普通任务。临时 Vitest 诊断把 `generateImage` 固定在同一未完成 Promise gate，连续创建 21 个普通图片任务；Node 24.14.0、Vitest 3.2.4、无网络、单次确定性样本，21 个执行器全部进入，峰值原始值 **21**，共享常量为 **20**。命令退出 0，1/1 文件、1/1 测试、780ms；临时测试随后移除。发生频率和真实供应商/内存代价未知，不宣称已测性能回归。

**当前/预期与完整链**：`createQueueTask`/批量 UI → `createTask`（`task-queue-service.ts:1904-1974`）→ 每项直接 `executeTask`（`:609-620`）→ executor；唯一读取 `AI_GENERATION_CONCURRENCY_LIMIT` 的代码位于 `useTaskExecutor.ts:193-228,565-576`，但它只订阅 pending/恢复任务（`:578-615,650-680`），普通 `processing` 任务不进入。候选预期由 `enforce-task-queue-concurrency-limit` 定义：所有模型执行入口共享 20 许可，第 21 个保持可观察排队。

**根因、方案与替代**：调度权分属 service 即时路径和 Hook 恢复路径，常量只约束后者。推荐在非 React 的执行服务边界建立单一许可；备选是把所有任务改 pending 并依赖 Hook 挂载，因非 React/工作流入口和启动时机不变量较差而未选。风险是排队状态、开始时间、取消、公平性和恢复顺序改变。

**验证与回滚**：批准后先补 21 任务、排队取消、失败释放和恢复交错测试；5 次样本峰值均须 `<=20`，第 21 个释放前 provider 调用为 0。回滚只移除许可调度/状态映射，不修改 Task schema。change `openspec/changes/enforce-task-queue-concurrency-limit/*` 为 2/11，等待 1.3。

### [TASK-CANCEL-001] 任务面板取消无法到达工作流外部任务的执行所有者

**状态**：已证实静态调用链；用户可观察取消语义等待 OpenSpec 审批，未实施。

**用户场景与静态复现**：运行工作流图片/视频任务 → 任务面板进入选择模式 → 选择 `processing` 任务并点取消。UI 只验证状态后调用 `batchCancelTasks`（`TaskQueuePanel.tsx:407-457`）→ `useTaskQueue.ts:95-99,318-322` → `TaskQueueService.cancelTask`。该方法只查 `taskAbortControllers`（`task-queue-service.ts:2172-2189`），而 map 只由私有普通执行路径填充（`:609-620`）。工作流 task 在 `media-generation` 用 `trackExternalTask` 登记；真正 signal 来自 workflow engine（image `:341-394` / media-generation `:178-191`），`trackExternalTask` 没有取消句柄参数（task service `:2298-2323`）。

**当前/预期与反向写回**：当前内存先变 `cancelled/blocked`，所以 `syncTaskFromStorage` 会忽略事件；但 fallback executor 的 `completeTask` 直接 `get + save`（`task-storage-writer.ts:245-269`），不检查 blocked，仍可把 IndexedDB 改回 completed。`waitForTaskCompletion` 返回存储结果后，workflow step 仍走成功赋值。刷新从 IndexedDB 读取 completed，产生内存/存储/工作流分叉。候选预期是取消到达实际本地 owner，迟到 progress/success 不覆盖取消；不承诺撤回供应商不支持取消的远端作业。

**影响、根因与方案**：影响工作流外部图片/视频、角色专用执行、恢复轮询和任何不由 service 私有 controller 拥有的 task；角色 owner 还会在 Task 终态写回前先保存 Character 记录（`useTaskExecutor.ts:353-417`）。普通 service 任务已有 9/9 测试中的取消迟到写回保护。根因是 task identity 与 execution ownership 没有统一取消注册，blocked guard 只存在内存同步层。推荐外部/专用入口登记幂等取消句柄并在所有终态 `finally` 注销，同时存储与衍生记录写入检查取消；备选按 workflowId 取消整个工作流会扩大单任务操作范围，未选。

**验证与回滚**：批准后对普通/角色/外部图片/外部视频/恢复各注入可控 signal 和迟到完成，取消后 5/5 本地停止或丢弃结果、内存/IDB 保持 cancelled、角色记录/自动插入/workflow completed 为 0，句柄最终为 0。回滚不触碰远端作业或历史数据。change `openspec/changes/fix-task-queue-external-cancellation/*` 后续由 F-20 补充 Suno 与 Music Analyzer 场景，当前为 4/13，等待用户批准取消终态与 late writeback 语义。

### [TASK-GITHUB-SYNC-001] GitHub 下载任务只进入内存且批量 UI 事件不完整

**状态**：已证实静态存储/事件链；存储语义等待 OpenSpec 审批，未实施。

**用户场景与复现**：用户在另一设备有已完成图片/视频任务，本设备执行 GitHub sync。`sync-engine` 多条用户/启动路径调用 `TaskSyncService.syncTasks`；下载页在 `task-sync-service.ts:481-490` 转换 task 后只调用 `taskQueueService.restoreTasks` 并直接把整页数量计入 downloaded。`restoreTasks`（`task-queue-service.ts:2350-2429`）没有任何 writer 调用，只改 Map；批量完成时仅发 `taskCreated(allTasks[0])`。刷新时 `useTaskStorage.ts:71-78` 只读 IndexedDB，因此这些远端任务消失；已经启动的 Jotai 订阅也只会增量看到代表任务（`useTaskQueue.ts:128-155,200-202`）。

**当前/预期、影响与证据**：当前 sync 可报告下载成功但没有 durable record，影响跨设备任务历史、素材/提示词视图和刷新恢复；备份导入不是同根因，因为它在 restore 前已 `taskStorageWriter.importTasks` 且关闭时刷新。证据强度为唯一下载写入路径/唯一启动读取边界/事件 payload 的完整静态证明；真实 GitHub 发生频率需要用户配置与凭据，未用外部账号测量。候选预期是按 ID + updatedAt 持久化成功后才计数并批量刷新全部实际合并任务。

**根因、方案与替代**：`restoreTasks` 名称被当作 durable restore，但契约实际仅为 memory merge；事件类型也没有 batch payload。推荐存储层 transaction 内 merge-if-newer，返回成功 ID，再更新内存并发一次完整 snapshot 信号。备选 `replaceExisting:true` 会用页中旧副本覆盖本地较新记录；逐任务 event 会放大 UI 更新，均未选。

**验证与回滚**：批准后覆盖远端新增/较新、本地较新/相等、单条/事务失败、50 条批量 UI 与关闭 reader 后重读；成功计数必须等于实际写入数。回滚不删除已同步的兼容终态 Task。change `openspec/changes/persist-github-synced-task-history/*` 为 2/11，等待 1.3。

### [TASK-DOC-001] 功能文档仍把任务和工作流描述为 Service Worker 执行

**状态**：已证实文档漂移，已修复。

**证据、改动与回滚**：旧 `docs/FEATURE_FLOWS.md:25-145,300-320,749-840` 引用了当前不存在的 SW queue/handlers/workflow-executor、`swTaskQueueService`、SW broadcast、`submitWorkflowToSW` 和任务 SW 无限分页。当前 `services/task-queue/index.ts:1-21` 明确“all task execution happens on main thread”；`workflowSubmissionService` 返回 `usedSW:false`；SW task-queue 目录只剩 storage/types/channel/debug/util，`useTaskQueue.loadMore` 是空操作，归档才由 reader 分页。文档现已改为主线程 create/execute/storage/RxJS、MainThreadWorkflowEngine、当前 SW 边界和活跃/归档真实加载策略；同时同步 reader/writer/Hook 源码注释。回滚只恢复 Markdown/注释，不影响运行时。

### 12.3 当前基线、非问题与退出判断

- 初始 F-10 窄基线：task queue/storage recovery/image retry/media executor/fallback utils 共 5/5 文件、32/32 测试，退出 0。`media-executor`/fallback utils 输出 `localStorage is not defined` 的 crypto 初始化 stderr，但不影响断言或退出码，分类为测试环境噪声。
- 修复后 F-10 窄簇：同 5/5 文件、33/33 测试通过，退出 0；其中 `task-queue-service-image-retry.test.ts` 最终为 9/9。`pnpm nx run drawnix:typecheck` 与全仓 `pnpm typecheck` 均退出 0，全仓 5/5 TypeScript 项目通过。一次未固定桌面 Node PATH 的全仓 typecheck 在 Nx 启动前以 `node: not found` 退出 1，属于运行环境失败；固定到桌面提供的 Node 24.14.0 后复跑通过。
- 全仓 `pnpm test` 退出 1：172 个文件中 161 通过、10 失败、1 跳过；1069 项中 1052 通过、16 失败、1 跳过；1 个未处理异常。与本轮前稳定基线相比，失败文件、失败用例、跳过和异常数均未增加，新增角色回归使总用例和通过数各增加 1。失败仍为既有模型排序、缓存图片/data URL、GPT Image Blob mock、Sora 时长、提示词消息 mock、工作流/Chat 超时和 settings/storage mock 漂移。
- `pnpm check:cycles` 退出 0（无静态 runtime import cycle）；`pnpm build:web` 退出 0（应用 7931 modules，约 1m55s；SW 54 modules，约 2.09s）；`pnpm verify:startup` 退出 0（4 个 startup assets 均低于 512000 bytes，chunk cycle 为空）。构建仍输出既有 Sass 弃用、CSS `:export` 和动静态导入重叠警告。
- `pnpm size` 退出 1：Startup App 1.94/820 kB、Startup Runtime 1.01/5 kB、Diagram Engines 934.93/950 kB、Office Data 269.19/300 kB、Editor Engines 858.24/870 kB、Media Viewer 12.19/20 kB；AI Chat 844.19/140 kB gzip，仍是唯一超限项。相对本轮前 844.14 kB 的单次新鲜构建值增加 0.05 kB；预算通过/失败集合未变化，但数值增量保留为剩余风险，不声称体积改善。一次等价可选字段写法实测为 844.20 kB，因更大已撤回。
- 全仓 `pnpm lint` 退出 1并再次扫描包内 `node_modules`；例如 `react-text` 单项即为 3143 problems（1144 errors、1999 warnings），不能计为业务源码缺陷。F-10 相关定向 lint 退出 1（5 errors、38 warnings），命中均为既有测试 empty async mock、Nx lazy-library boundary 和 empty catch，新角色创建/重试分发代码无命中。
- `pnpm e2e:smoke` 首次因 webServer 子进程没有 `npx` 在启动前退出 127；手动用相同 Nx/Vite 配置启动 `http://localhost:7200` 后复跑，2/2 smoke 用例均因缺少 `/Users/macos/Library/Caches/ms-playwright/chromium_headless_shell-1200/.../chrome-headless-shell` 在 5ms 内失败，未执行页面断言。feature、visual 与 responsive 场景共享该 Chromium 前置条件，未重复制造相同失败；未擅自下载浏览器。
- 四个 F-10 change 均已人工核查 proposal/design/tasks/delta：`enforce-task-queue-concurrency-limit` 为 1 operation/1 requirement/3 scenarios，`fix-task-queue-external-cancellation` 后续由 F-20 扩展为 1/2/9，`persist-github-synced-task-history` 为 1/2/5，`improve-task-queue-responsive-accessibility` 为 1/5/12；文件齐全、没有同名 requirement。后者与其他 change 共享部分 UI 文件但明确隔离执行/存储/歌词/错误内容/移动画布壳语义。OpenSpec CLI 仍不可用；后者新鲜 strict 命令退出 127，不能声称 CLI validation 通过。
- 已验证非问题：普通 service 任务取消后 abort signal 且迟到完成不覆盖 cancelled；大字段图片编辑任务在内存剥离后可从 IndexedDB 回灌重试；当前会话 task/较新 runtime state 不会被启动存储快照误判中断；route snapshot 可随外部视频任务持久化与 storage sync。
- `TASK-CHARACTER-001` 已完成红绿修复；文档漂移已同步。未修改视觉样式，没有前后截图或“更美观”结论；未做性能优化，不声称更快/更省内存。
- F-10 **尚未达到退出标准**：TASK-CONCURRENCY-001、TASK-CANCEL-001、TASK-GITHUB-SYNC-001 及任务界面五项用户可观察问题分别等待 OpenSpec 审批；批准项尚无修后性能/浏览器/视觉/zh-en 证据。无 Git 元数据，仍无法核对历史、diff 或工作树干净度。

### 12.4 F-28 子循环：任务面板响应式、无障碍与本地化

**用户场景、范围与验收**：用户从统一工具栏打开已有任务队列，在桌面/移动端查看状态与进度、筛选/搜索、进入多选并使用现有预览/下载/编辑/重试/插入/删除动作；键盘、触控和辅助技术应能识别同一操作且中文/英文应用文案一致。范围只含 live entry、drawer、status/type/search/selection、list/item/action/progress/error、archive 与 compact layout；并发、取消、恢复/持久化、歌词结果、错误内容净化、移动画布壳和 workflow 语义保留既有 owner。验收需覆盖命名 surface、焦点进入/返回、nested Escape、tabs/pressed/selection/action/progress/live semantics、320px 不裁切、44×44 compact targets、zh/en 与同状态前后截图。全部会改变用户可观察行为，需 `improve-task-queue-responsive-accessibility` 审批，故本轮只完成事实、提案、无调用清理和当前行为前证据。

**真实入口与正反向链校正**：当前入口不是旧 `TaskToolbarButton`，而是 `Drawnix taskPanelExpanded` → `UnifiedToolbar` lazy `TaskQueuePanel` → `BottomActionsSection:144-165` 的 named native `ToolButton(data-testid=toolbar-tasks)` → `TaskQueuePanel:1008-1330` → `BaseDrawer`/`SideDrawer` → `VirtualTaskList`/`ArchivedTaskList` → `TaskItem`。反向从 action/progress/list DOM 回到 panel handler → `useTaskQueue`/task service或画布/媒体 service → RxJS/Jotai、IndexedDB/cache/board → 同一 UI；执行/恢复全链仍见 12.2。浏览器键盘注入同样不能激活无关 native minimap button 或推进 Tab，因此归控制工具限制，不作为“原生按钮键盘失效”证据。

**[TASK-UI-A11Y-001]（已证实，待审批）**：1280×720 pointer 打开后 drawer root 为无 role/name 的 `DIV`，焦点仍在入口；入口是第 27 个 focusable，前 12 个 drawer controls 位于它之前，之后四项属于 AI input。close 无名称，`TaskQueuePanel:1250-1267` 显式 `closeOnEsc=false`。链为 trigger → Drawnix state → lazy panel → drawer root/header → focus/Escape → close callback/trigger。根因是 live trigger 语义完整但 shared drawer 只有视觉壳且 queue 未协调 focus/Escape。候选为 named non-modal surface、heading initial focus、nested overlay 优先、invoker restoration；modal trap/backdrop和全局无条件 Escape 均改变现有交互，未选。风险是 lazy/animation race 和 portal ownership；批准后组件加 1280/768/390/320 keyboard/pointer/nested 测试，回滚 task-specific props/effects/tests，无数据动作。

**[TASK-FILTER-A11Y-002]（已证实，待审批）**：五个状态项都是 `DIV`、无 `role=tab/aria-selected` 且 `tabIndex=-1`；六个类型动作中五个 icon-only 无名称，active 仅 CSS；多选的 select-all/row checkbox 均无名称。链为 task arrays/count → Tabs/type/search state → filtered list/selection Set → batch handler → task service → projection。根因是把 TDesign visual tab/icon/checkbox wrapper 当作自描述控件。候选为 roving tabs、named `aria-pressed` native buttons、关联 selection context；验证必须断言 pointer/keyboard 结果集合与 callback 次数不变，回滚 markup/ARIA/tests。

**[TASK-ITEM-A11Y-003]（实测证实，待审批）**：Node 24.14.0、Vitest 3.2.4、jsdom、三条 synthetic/local task 的真实组件诊断 exit 0、1/1 文件/1/1 测试、12.68s；11 个动作中 7 个无名称，preview 为不可聚焦 `DIV`，error details 为不可聚焦 `SPAN`，progressbar/live region 均 0。链为 task status/result/error/cache → `TaskItem:522-1001`/progress display → DOM → callback → panel/service → event projection。候选为 direct localized names、只把已有 actionable affordance 改 native keyboard control、一个 determinate progressbar 和 bounded terminal live announcement；whole-row button未选。风险为重复 callback、公告噪声、raw error 进入名称；临时诊断已删除，批准后转永久隐私 sentinel/state matrix，回滚 semantics/tests 不改 task。

**[TASK-RESPONSIVE-004]（实测证实，待审批）**：Codex Chromium、DPR1、浅色观感、无网络/CPU throttle、每视口 1 个 deterministic CSS geometry 样本。390×844 行可容纳但 pin/close/type/multi-select/delete/insert 多个 hit box 小于当前 44×44 compact 惯例；320×568 时 filter `clientWidth=296/scrollWidth=366`，多选 `x=310..378`，超 drawer 58px并被裁切。链为 viewport media query → full-width drawer → fixed/no-wrap filters/search/action → `overflow:hidden` → 多选入口不可用 → batch actions。候选为 scoped two-row wrapping + 44px target；隐藏动作或继续缩小未选。风险是列表高度和长英文；批准后在320/390/568×320/200%/zh-en/light-dark测 geometry、scroll、截图；回滚 compact SCSS/tests，无存储影响。

**[TASK-I18N-005]（已证实静态控制流，待审批）**：可达 `TaskQueuePanel`、`TaskItem`、progress/list/archive和shared drawer labels均为中文 literal且不消费 `useI18n`；唯一 language state 在 `I18nProvider` 只重渲染消费者，故这些 literals 不随现有语言变化。链为 language menu → Context state → 无 consumer → queue DOM仍中文。候选是现有 typed zh/en source中的 application-owned labels/names；用户 prompt/title、provider/model、URL/ID/error/task/result/cache/board/analytics数据保持 byte-for-byte。风险为长英文导致320px回归，必须与响应式 change同批验证；回滚 keys/usages/tests，无迁移。运行时英文截图尚未取得，不伪造。

**[TASK-DEAD-006]（已证实并清理）**：全仓正反 import/export/JSX/registry/package-export 搜索证明 `TaskToolbarButton.tsx`、`TaskSummary.tsx` 无生产消费者；live DOM和 source唯一入口为 `BottomActionsSection`。已删除两文件与只服务 `.task-toolbar-button` 的 SCSS；`specs/001-batch-task-queue` 顶部现标为历史计划/清单，tracking 两文档改指当前 owner且保留事件 `toolbar_click_tasks`。无运行时/包体结论，因为未导入模块本就不在 bundle。风险仅为仓库外 deep import，但 package exports 不公开该路径；无 Git 元数据，回滚需从外部备份反向恢复两文件/样式和文档，不涉及数据。

**OpenSpec/证据**：新 change 含 proposal/design/tasks/delta 四类必需文件，1 个 ADDED operation、5 个全仓唯一 requirement、12 个四级 WHEN/THEN scenarios，每个 requirement至少一个 scenario；owner conflict 人工检查通过。`openspec validate improve-task-queue-responsive-accessibility --strict` 新鲜退出 127（command not found），不安装 CLI、不声称 strict 通过。证据在 `docs/evidence/f10-task-queue-accessibility/`：`metrics.json`、`diagnostics.md`、390/320 before PNG；SHA-256 分别 `57a9f7d1…e43e`、`c727b4bd…34c1`。无 after screenshot，因为行为实施待审批。

**清理验证与宽门禁**：post-cleanup absence/reference 搜索 exit 0。定向任务 queue/storage/executor 为 6/6 files、37/37 tests、exit 0；Drawnix typecheck exit 0；full typecheck exit 0、5/5 projects；cycles exit 0。skip-cache full test exit 1：Drawnix 189 files=184 pass/4 fail/1 skip，1165 tests=1161 pass/3 fail/1 skip；react-board 1/1、8/8；四簇仍为 cached image data URL、GPT Blob mock、Sora duration、PPT settings mock，与最新清理前 baseline 的 identity/count 相同且无 task-queue failure。task-directory lint exit 1，3 errors/33 warnings均为保留文件既有 module-boundary/type/non-null/emoji 命中，不能归因本轮删除。build:web exit 0，7931 app modules/约1m39s，SW54/1.48s；build side effects 已按前哈希恢复。size exit 1，仅 AI Chat 844.43/140 kB；startup exit 0。browser drawer 已关闭、tabs finalized、Vite显式停止。

**性能/视觉、回滚与退出**：清理不可达模块没有可观测运行时路径，也不宣称更快/更小；size集合与基线相同。视觉只保留390/320同状态 before 证据，不用主观措辞替代修后对照。F-10仍**未达到功能退出标准**：四个执行/存储/界面 OpenSpec change 等待批准，001–005没有修后 keyboard/focus/Escape/a11y/zh-en/theme/landscape/zoom/visual结果；并发/取消/GitHub persistence也未实施。可独立回滚清理/文档/change，不删除或迁移用户数据。F-28 下一只读选择为 F-11 workflow UI，因其直接消费刚确定的task projection并影响 WorkflowContext/Chat/WorkZone/anchors；F-12随后单独审计。

## 13. 第五个功能循环：F-09 模型发现、排序、供应商配置与协议路由

### 13.1 功能名称、用户场景、范围与门禁

**功能名称**：用户在设置中管理多个供应商及凭据，获取、筛选和排序模型，将模型与所属 profile 一起选入预设或单次生成，最终按 profile/binding/protocol 发往对应网络端点，同时看到健康状态并按模型来源恢复参数偏好。

**范围**：设置对话框的 profile 创建/启停/凭据保存/模型获取；provider-scoped catalog；旧单供应商迁移；模型分类、去重、排序、筛选与旧选择 pin；`modelId + profileId`、preset 和 local selection 持久化；route 解析、binding 推断、adapter 选择、transport；健康缓存/badge；`selectionKey || modelId` 作用域偏好。

**非范围**：不评判模型生成质量（F-08）、任务队列调度和终态（F-10）、各工具的业务参数状态机（F-16～F-20）或 benchmark 工作台自身体验（F-22）；本轮只跟踪它们如何保留模型所有权并选择路由。

**规格与活动 change**：正式 `runtime-model-discovery` 规定同族新版优先、同版本按推荐分降序，且所有 selector 共用排序；正式 `provider-routing` 要求按单次请求 schema 选 binding。已逐件读取 `add-runtime-model-discovery`、`add-provider-protocol-routing`、`add-multi-provider-profiles`、`add-model-scoped-generation-preferences`、`update-default-text-models`、`update-kling-capability-version-routing`、`add-model-benchmark-workbench`、`add-audio-generation-suno-routing` 的 proposal/design/tasks/delta；它们之间存在实现已可达但 tasks 未勾选的状态漂移，不以勾选数代替源码和测试证据。

**本轮验收**：同 ID 跨 profile 不丢所有权；选择、preset、任务 route snapshot 和 retry 指向同一 profile/binding；发现的加载、失败、空目录、凭据切换和 stale selection 有一致状态；健康错误与缓存行为符合规格；共享排序满足正式 requirement；相关窄测、typecheck/lint 不回归。排序修复是恢复已有正式规格，无需新 change；若需改发现竞态、缓存、存储或路由语义，必须先建独立 change 并等待审批。

### 13.2 当前完整调用链

**供应商与发现正向链**：设置入口 → `settings-dialog.tsx:1445-1506` 保存当前 draft、校验 API key、规范化 base URL 并调用 `runtimeModelDiscovery.discover` → `runtime-model-discovery.ts:1531-1623` 把 profile state 置 loading，fetch `/models`，校验 HTTP/JSON/data/非空，按 endpoint/ID/owner 转换 `ModelConfig` → `providerCatalogsSettings.update` 写 settings/localStorage 并由 config writer 写 IndexedDB → 发现对话框 `applySelection` 仅更新该 profile 的 selected IDs → settings reconcile preset → 各 selector 通过 `use-runtime-models` 订阅 store，调 `getSelectableModels` 合并所有启用 profile 的已选条目，以 `selectionKey=profileId::modelId` 分组并共享 `sortModelsByDisplayPriority`。

**选择和调用正向链**：ModelDropdown/Chat selector/设置 preset 交付 `modelId + sourceProfileId` → `createModelRef` 与 route-specific local selection/preset 保留 pair → `resolveInvocationRoute` 以显式选择覆盖 preset default → `resolveInvocationPlanFromRoute` → `InvocationPlanner` 按 `profileId:modelId:operation` 查 profile 和 binding，按 binding ID/request schema/优先级定位协议 → `resolveAdapterForBinding` 先匹配 request schema/protocol → `ProviderTransport.prepareRequest/send` 注入该 profile 的 base URL、auth 和 headers → 网络响应回到 media/chat 执行器、任务事件、画布/对话框。route planner 失败时返回 null，adapter registry 才走 legacy bare-ID fallback。

**状态与持久化反向链**：设置模型列表/空态/错误态 ← profile-specific `RuntimeModelDiscoveryState` ← catalog settings 唯一写入边界；选择器条目 ← `getSelectableModels/getPinnedSelectableModel` ← 各 catalog 的 `models/discoveredModels` 及 profile enabled state；最终请求 URL/header/body ← `ProviderTransport` ← `InvocationPlan.provider/binding/modelRef` ← settings repository ← provider profile/catalog/preset。参数偏好以 `selectionKey || modelId` 为 key 读写 config storage，同 ID 不同 profile 在 profile-aware UI 中不共用偏好。

**健康链**：`ModelHealthContext/useModelHealth` 读 profile-aware model ref → `modelHealthFetcher` 仅对 `foropencode.com` 发请求，其他 base URL 不声称健康数据 → fetch 结果按 1 分钟缓存，UI 每 5 分钟刷新 → `getHealthStatus(modelId, profileId)` 按 group-aware key 返回 → `ModelHealthBadge`。网络失败时 fetcher 返回缓存/空结果，是否应在 UI 显示 error 仍需要规格与浏览器对照，当前不作缺陷结论。

### [MODEL-ORDER-001] 同族新版模型被旧版推荐分或名称启发式压低

**状态**：已证实缺陷，已用红绿测试修复。

**用户场景、复现与当前/预期**：用户打开 AI 输入、Chat、生成对话框或设置模型列表。修复前 F-09 窄测的 10 文件中 1 文件失败，99 项中 97 通过、2 失败；原始顺序分别为 `gemini-2.5-flash-image → gemini-3.1-flash-image-preview → gemini-3-pro-image-preview` 和 `gemini-3-flash-image-preview → gemini-3-pro-image-preview`。正式 `runtime-model-discovery/spec.md:15-27` 预期同 normalized family 新版本在前，同版本再按推荐分降序，且各 selector 共用。

**完整调用链与影响**：静态/remote catalog → `runtimeModelDiscovery.getSelectableModels` 或设置 vendor group → `sortModelsByDisplayPriority/compareModelsByDisplayPriority` → ModelDropdown、Chat selector、AI input 和 settings UI。此问题只改变展示优先级，不改用户当前选择、profile、route、缓存或存储格式。证据强度为正式 requirement + 当前可达共享 comparator + 现有失败 + 新增红绿用例。

**根因、修复与备选**：旧 comparator 先比推荐分、`new`、名称和 tier，后比版本，且没有判定 normalized family，与 requirement 顺序相反。`model-sort.ts:13-23,136-162,201-256` 现以 model ID 生成 family key，忽略版本/日期/分辨率及 `vip/async/preview/flash/pro/ultra/max`；比较顺序为 explicit sort → 同族版本 → 推荐分 → new → 跨族 family → tier/quality → VIP/fallback/label。跨族仍先用策展推荐分，保留 GPT 图片既有用例。备选是为 Gemini 写死顺序或让每个 selector 局部排序，会违反共享策略且无法覆盖 remote model，未采用。

**验证、风险与回滚**：新增同族新版压过旧版高分、同版本推荐分压过 tier 两项用例；修复前 8 项中 3 失败、5 通过，修复后 8/8。复审又在 `model-sort.test.ts:143-159` 直接从真实 `IMAGE_MODELS` 取三个 Gemini 条目，当前 9/9、退出 0。主要风险是家族 token 归一过度；已用跨族推荐分、分辨率和 tier 用例约束。回滚仅恢复 comparator 顺序/family helper 并移除四项回归用例，不需要迁移任何用户数据。

### [MODEL-DISCOVERY-RACE-001] 迟到的旧凭据响应覆盖最新 provider catalog

**状态**：实测证实；已创建独立 OpenSpec change，等待审批，运行时未修改。

**用户影响、复现与当前/预期**：用户为同一 provider profile 更换 API key 或快速重新获取模型。Node 24.14.0、Vitest 3.2.4、无网络、单次确定性可控 Promise 样本：先启动 old-key，再启动 new-key；让第二个响应先返回 `new-key-model`，再让第一个返回 `old-key-model`。诊断测试 1/1 失败，期望 `['new-key-model']`，实际 `['old-key-model']`，退出 1。预期是最新发现或凭据失效意图拥有当前 catalog，过期 success/failure 不写状态或弹误导错误。

**完整调用链、根因与影响范围**：设置 API key/base URL → `handleFetchModels` → `runtimeModelDiscovery.discover` → 每次先 `setCatalogState(loading, persist=false)` → 两个 fetch 异步竞争 → 每个响应均无条件 `setCatalogState(ready)` → `providerCatalogsSettings.update` → settings/localStorage/IndexedDB → runtime registry/store event → selector/preset/settings UI。`invalidateIfConfigChanged` 可清空目录，但不使 in-flight 请求失效。影响同 profile 的发现状态、已选集、selector 可见条目、preset reconcile 候选及持久化 catalog；profile-aware planner 可能随后用旧 catalog 推断 binding。证据强度为可达 UI + 双请求受控失败 + 唯一状态/持久化写入链。

**候选方案、风险、验证与回滚**：提案 `fix-runtime-model-discovery-stale-response` 为每 profile 建立单调 request ownership，新发现、credential invalidation 和 clear 使旧 token 过期；过期 success/failure 均不提交 catalog/status/error/persistence/event。只 abort fetch 不能防止已返回响应的迟到提交，未作为唯一方案。风险是 stale outcome 若被 settings catch 当普通失败，仍会覆盖新 ready 状态；design 要求用调用端测试约束。批准后验证新成功→旧成功、新成功→旧失败、in-flight→invalidation、in-flight→clear 和两 profile 并行；回滚只移除 token/stale handling 及测试，不迁移或删除 catalog。

**OpenSpec 核查**：proposal/design/tasks/delta 四类文件齐全；delta 为 1 operation/1 requirement/5 scenarios，全仓无第二个同名 requirement。与 `add-runtime-model-discovery` 和 `add-multi-provider-profiles` 共用 capability，但不修改它们的现有 requirement，无直接规范冲突。OpenSpec CLI 不可用，`validate --strict` 退出 127 属工具阻塞。临时诊断用例已移除，原 discovery 测试 21/21、退出 0，审批前不留新失败。

### [MODEL-RUNTIME-DEDUP-001] 同 ID 跨 profile 在全局 runtime registry 中被折叠

**状态**：实测证实规格不一致；运行时代码未修改，等待既有 `add-provider-protocol-routing` 审批。

**用户影响、复现与当前/预期**：用户在 provider A、B 中都选择 `shared-model`，两项可以有不同默认参数、能力和协议 binding。Node 24.14.0、Vitest 3.2.4、无网络、单次确定性样本中，profile-aware selector 保留 2 项；全局 runtime registry 期望同时存在 `provider-a::shared-model` 与 `provider-b::shared-model`，实际只有 `provider-a::shared-model`，诊断 1/1 失败。`add-provider-protocol-routing/spec.md:65-80` 明确要求发现与选择保留 profile/binding provenance，且不得仅按 `modelId` 折叠 global runtime model。当前 profile-aware planner 并未在该实验中路由错误；已证实影响限定为 global bare-ID registry 及其消费者，不能扩张为“所有请求都错路由”。

**完整调用链、根因与范围**：profile A/B catalog → `runtime-model-discovery.ts:1234-1259` catalog state → `getSelectableModels():1336-1350` 按 state/`selectionKey` 保留两项；同一次 state 同步 → `resolveRuntimeModels():1266-1278` 以裸 `model.id` 的 `Set` 丢弃第二项 → `setRuntimeModelConfigs():1281-1283` → `model-config.ts:1406-1417` 单数组 registry → `getModelsByType/getModelConfig():1454-1465` 以及默认参数、能力和兼容参数 bare-ID 读取者。反向追踪从 `getModelConfig()` 只能定位第一条 runtime model，无法恢复调用者选择的 profile。根因是 profile-aware catalog 被投影到不携带 selection identity 的旧单数组，并在投影处提前去重。

**方案、风险、验证与回滚**：既有 `add-provider-protocol-routing` 已拥有完全相同 requirement，不创建重复 change。最小候选是在 runtime registry 保留 profile-aware identity，并让有 `ModelRef` 的消费者按 selection key 读取；备选是删除全局 runtime registry、全部改读 catalog repository，影响面更大且当前无必要。主要风险是 bare-ID 旧调用者遇到同 ID 多项时的兼容选择；实施前必须明确 legacy fallback 并覆盖 selector、默认参数、adapter 和 transport。批准后将诊断转永久集成测试，断言 2 条 registry identity、各自默认/能力、各自 binding 与请求；回滚只恢复 registry 投影和测试，不改 catalog 存储 schema。当前未实施，回滚不涉及用户数据。

### [MODEL-DISCOVERY-FALLBACK-001] 首次发现失败后共享模型 selector 失去静态 fallback

**状态**：实测证实；已创建 `fix-runtime-model-discovery-failure-fallback`，等待审批，运行时代码未修改。

**用户影响、复现与当前/预期**：用户启用供应商、保存首次凭据并点击获取模型；服务返回 401。Node 24.14.0、Vitest 3.2.4、无网络、单次确定性 401 样本中，设置错误路径把 state 置为 `error`，`discoveredModels/models` 都为空；共享文本 selector 期望继续返回策展默认 `gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna`，实际为 `[]`，诊断 1/1 失败，退出 1。`add-runtime-model-discovery/spec.md:17-21` 要求失败消息可见且静态 fallback 保持；`add-multi-provider-profiles/spec.md:36-49` 又限定静态默认只在没有 authoritative catalog 时可用，但未定义“只有 signature、从未成功”是否 authoritative。

**完整调用链、根因与范围**：设置保存 `settings-dialog.tsx:1710-1729` → `invalidateIfConfigChanged():1460-1481` 清旧目录并写新 signature → 获取按钮 `settings-dialog.tsx:1445-1506` → `discover():1531-1560` 写 loading/signature → HTTP 失败 → catch 调 `setError():1625-1634` 并显示 Message → `hasAuthoritativeModelCatalog():84-92` 因 signature 返回 true → `isProviderSelectionMode/getSelectableModels():1320-1350` 用空 runtime models 替代静态默认 → AI 输入、Chat、生成对话框和设置模型列表。反向从空 selector 可唯一回到全局 provider mode 判定；失败消息自身仍可见。根因是“凭据失效边界”和“成功目录证据”共用同一 helper；signature 对旧 model pin 是必要的，但不足以证明存在成功 catalog。

**方案、风险、验证与回滚**：独立 change 将 selector-success 与 credential-bound 判定拆开：只有 enabled profile 的成功目录启用 provider-only；signature 继续阻止新凭据下旧 provider model ref 被 pin。直接删除 signature 判定会使旧模型复活，未采用；失败时恢复旧凭据目录也违反立即失效不变量。风险是 loading → success 的候选列表切换及旧持久化目录缺少成功时间；设计以 `discoveredAt` 或非空 discovered models 兼容旧数据。批准后覆盖首次 loading、HTTP/non-JSON/missing-data/empty-list、凭据失效旧 pin、多 profile 成功+失败；回滚只恢复 selector mode 判定和测试，无 schema/迁移/数据删除。

**OpenSpec 核查**：proposal/design/tasks/delta 齐全；delta 人工核查为 1 operation/1 requirement/4 scenarios，全仓无同名 requirement。与两个发现 change 共用 capability，但通过独立 requirement 只定义 successful catalog 边界。CLI `validate --strict` 仍因命令不存在退出 127。临时失败测试已移除，原 discovery 文件恢复 21/21、退出 0。

### 13.3 待验证假设、已验证非问题与当前基线

- **MODEL-HEALTH-ERROR-HYP-001（待验证假设）**：`model-health-service.ts:87-140` 在 HTTP/网络失败时返回缓存/空数组而不 reject；`ModelHealthContext.tsx:73-91` 只有 reject 才设置 `error`，因此该字段在当前 fetcher 下通常不可达，badge 消费者也不展示错误。当前源码确证的是 stale/empty fallback，不足以证明这是缺陷：2026-07-30 再次完整核查正式 `runtime-model-discovery`/`provider-routing` 和相关 discovery/protocol proposal、design、tasks、delta，`add-runtime-model-discovery/design.md` 明确把健康状态排除在该变更外，protocol design 也只排除健康度自动择优；没有文件定义 health fetch 失败的 UI 语义。验证需要先由产品明确“保留旧健康状态但标陈旧”或“显示不可用错误”，再以可控 HTTP/网络失败和浏览器 badge 对照测试；决策前不改代码。回滚不适用，因为未实施。
- **MODEL-RETRY-BINDING-HYP-001（未知/待决策）**：任务在 `task-queue-service.ts:1945-1948,2321-2328` 保存 `invocationRoute.binding` 快照；fresh retry 在 `2197-2259` 清 `remoteId`、重新提交并保留 task params，但图像执行在 `922-928` 只把`model/modelRef`交给当前executor，未直接消费旧binding快照。永久回归`task-queue-service-image-retry.test.ts:335-371`证明两次执行保留原`profileId + modelId`。2026-07-30规格复核确认：active provider-routing delta要求从选择恢复provider/binding并走同一provider-specific binding，task concurrency design要求retry的“路由快照保持不变”，但两者都没有区分“复用旧binding bytes”与“用同一ModelRef按当前配置重解binding”；`Task.invocationRoute`类型注释只明确async resume使用原supplier，而fresh retry是新submission。两种解释会在配置变更后产生不同网络/schema行为，证据不足以选边。需要用户定义冻结或刷新语义后，再在失败后修改同profile/model binding并观测URL/schema；当前不判缺陷、不修改。
- **已验证非问题**：设置发现按钮在 loading 时禁用并显示 spinner；HTTP/非 JSON/缺 data/空列表都抛可见 Message，且空列表显示内联 error state；profile catalog 存储和选择器 `selectionKey` 已按 profile 隔离；planner repository 以 `profileId:modelId:operation` 查 binding；健康 badge 消费 profile-aware key；偏好已以 `selectionKey || modelId` 隔离；现代任务的 fresh retry 保留原 `modelRef/profileId`。
- 修复后 F-09 窄簇覆盖 model sort/model grouping/runtime discovery/settings manager/settings repository/provider routing/adapter registry/model health/image route integration/AI preference/ModelDropdown，并加入 task queue image retry：**12/12 文件、120/120 用例通过，退出 0**。宽测首次暴露 `model-grouping.test.ts:90-93` 仍断言旧局部字符串顺序；该用例只验证 Gemini 分组，实际分组函数已在 `model-grouping.ts:100-104` 接入正式共享 comparator，真实目录又为 `omni-flash`/components 配置 93/48 推荐分，因此保留精确断言并同步为 `omni-flash → omni-flash-components`。修正前宽测该项 1/1 失败，修正后定向 2/2、F-09 窄簇 120/120。crypto/localStorage/IndexedDB 和 Browserslist stderr 为已有 Node 测试环境/工具提示，没有使窄测断言或退出码失败。首次复跑因固定 Node PATH 未注入，Vitest 启动脚本找不到 `node`，退出 127，分类为命令环境失败；注入 Node 24.14.0 后通过。精确引用扫描 `rg -n "hooks/useModelHealth|export function useModelHealth\\(|from .*useModelHealth['\"]" packages apps` 无命中，退出 1，证明删除的重复 Hook 没有残留引用。
- `pnpm exec eslint packages/drawnix/src/utils/model-sort.ts packages/drawnix/src/utils/__tests__/model-sort.test.ts` 退出 0；`pnpm nx run drawnix:typecheck` 退出 0。一次未固定 PATH 的只读 package script 查询在 `node` 前退出 127，固定到桌面 Node 24.14.0 后查询成功，不计为产品失败。`tsx` 未安装，真实静态目录验证改为永久 Vitest 用例而不安装工具。
- 宽验证（Node 24.14.0）：`pnpm typecheck` 5/5 projects、退出 0；`pnpm check:cycles` 无静态运行时循环、退出 0；`pnpm test` 172 文件中 164 通过/7 失败/1 跳过，1073 项中 1061 通过/11 失败/1 跳过，另 1 个既有 mock 未处理异常，退出 1。当前失败为 prompt-history feedback mock、GPT image Blob 测试环境、Sora duration 断言、workflow import timeout、cached image conversion、两套模块 mock 漂移及 benchmark storage mock；F-09 的 12 文件均通过，本轮未新增失败。
- `pnpm build:web` 在 7931 modules 上退出 0；Sass deprecation、CSS `:export` 和 dynamic/static import 混用为既有构建警告。`pnpm verify:startup` 退出 0，startup CSS/app/runtime/index 四项分别 14,208/3,776/1,867/345 bytes，均低于各自 512,000 bytes 阈值，chunk cycles 为空。`pnpm size` 退出 1：AI Chat 844.24 kB gzip，超过 140 kB 预算 704.24 kB；Startup App 1.94 kB、Runtime 1.01 kB、Diagram 934.93 kB、Office 269.19 kB、Editor 858.24 kB、Media Viewer 12.19 kB 均在各自预算内。排序修复没有宣称或测得 bundle/启动性能改善。
- 当时全仓 `pnpm lint` 扫描包内 `node_modules`，至少一个 package 汇总为 3143 problems（1144 errors/1999 warnings），最终退出 1；这是 F-09 当轮的历史基线，扫描边界后来已由第40节修复，当前全仓结果为1320 files、448 errors/2525 warnings且不再含该依赖树。本轮 `model-sort.ts`、`model-sort.test.ts`、`model-grouping.test.ts` 定向 lint 退出 0。Playwright 1.57.0 首次因 config 使用当前环境缺失的 `npx` 启动 server 而退出 1；以等价 `pnpm nx serve web` 启动 7200 后，smoke 2/2 在 browser launch 前失败，明确缺少 `chromium_headless_shell-1200`。本机只有 revision 1228，未擅自下载；feature/visual/responsive 同一 Chromium 阻塞，不重复运行。
- 本次没有修改视觉样式，不提供“更美观”结论；没有做性能优化，不宣称更快/更小。排序修复是确定性 comparator 语义恢复，验收指标为顺序而非耗时。
- F-09 **尚未达到退出标准**：MODEL-DISCOVERY-RACE-001 与 MODEL-DISCOVERY-FALLBACK-001 等待各自 OpenSpec 审批；MODEL-RUNTIME-DEDUP-001 等待既有 `add-provider-protocol-routing` 审批；health error 与 retry binding 冻结语义缺少产品 requirement，保持待决策而不改代码。正式 Playwright 仍受缺失 `chromium_headless_shell-1200` 阻塞；OpenSpec CLI 不可用，活动 change 只能手工核对；无 Git 元数据，无法核对历史、diff 或工作树干净度。

### 13.4 F-28 feature-local provider/model settings interface pass

**场景、范围和证据环境**：用户在设置中选择供应商，编辑 connection/pricing/credential 字段，启停 profile，获取并筛选 provider-scoped models，再把选中目录保存给 preset/route consumers。本次只审 `SettingsDialog` provider内容、`PricingFieldGroup` 和 `ModelDiscoveryDialog`，不接管shared四视图nav、WinBox、discovery/routing/health/storage/credential或benchmark。当前 `dist/apps/web` 由本地7395提供，Codex Chromium 1280×720、DPR1、无throttle、1个确定性DOM/截图样本；没有读browser storage/API Key/Token，没有触发provider/price/health请求、switch或save。安全选择一次`codex`后恢复`default`。证据位于 `docs/evidence/f09-provider-model-settings/`。

#### [F09-PROVIDER-FORM-A11Y-007]

**状态**：已证实，等待 `improve-provider-model-settings-accessibility` 审批。**用户影响/复现/当前与预期**：生产DOM中6个input、2个native select的`id/aria-label/aria-labelledby`全为null；9个visible label的`for`全为null且与控件为sibling。3个`role=switch` button同样没有name relationship或`aria-checked`，其中两个provider enabled状态只由`t-is-checked` class表达。预期是现有visible label/instruction与实际control关联，actual switch暴露current state，不改变值/回调。`settings-dialog.tsx:1885-1958,2170-2431`和`pricing-field-group.tsx:78-121`给出精确写入链；API Key reveal已有名称，是非问题。

**调用链/根因/方案/风险/验证/回滚**：settings entry→draft/profile→visible sibling label/TDesign value→DOM；根因是没有native containment/for/ID/ARIA关系且Switch callsite未建立name/state contract。候选为stable ID/native或ARIA关系并检查actual switch；placeholder-only与duplicate hidden controls未选。风险是TDesign prop只落wrapper、label click重复toggle或private value进入name；批准后测pointer/Tab/Enter/Space、exact callback、mask/draft/persistence和credential sentinel。回滚F-09关系/keys/tests/style，无数据迁移。

#### [F09-MODEL-MANAGEMENT-A11Y-008]

**状态**：已证实静态控制流，populated production state因无目录/凭据阻塞，等待同一change审批。**用户影响/证明/当前与预期**：`settings-dialog.tsx:2612-2780`以non-focusable `div onClick`拥有group collapse，row test/remove icon buttons只靠HoverTip；`model-discovery-dialog.tsx:253-270,302-351,403-420`的type filters只有active class，vendor button无`aria-expanded`，model test icon无name。现有checkbox被label包裹，是非问题。成功链为fetch→discoveredModels→dialog local filter/vendor/selection→applySelection→catalog/preset→summary。预期是同一action/selection具native/equivalent keyboard/name/state且不触发额外调用。

**根因/方案/风险/验证/回滚**：现有state owner没有投影到DOM semantics，group header还把collapse container和benchmark action放在同一区域。候选为separate native disclosure+benchmark sibling、consistent current filter、vendor expanded/control和direct localized action names；给div补key handler或只保留hover未选。风险为hit area改变、collapse/benchmark double activation和group keyboard contract漂移；批准后用synthetic local models验证exact callbacks、focus/state、search/order/selection和zero external requests。回滚markup/keys/tests/styles，不碰catalog。

#### [F09-PROVIDER-I18N-009]

**状态**：已证实静态控制流，等待同一change审批。**用户影响/证明/当前与预期**：`drawnix.tsx:870-938`由`I18nProvider`包裹，`i18n.tsx:599-631`拥有zh/en；三个F-09内容模块均不消费`useI18n`，normal/empty/loading/failure/form/discovery copy使用fixed Chinese branches，因此已有English选择不能改变这些application strings。运行时English screenshot未取得，不伪造；shared language submenu缺陷由F-26所有。候选为typed F-09 zh/en keys，只翻译application framing/names，provider/model/URL/key/price/error/catalog/preset/route/analytics数据byte-for-byte。

**风险/验证/回滚**：long English可能overflow，live switch可能重置draft/selection/expanded/focus，错误实现还会翻译或泄露private/provider data。批准后覆盖initial/live zh-en、normal/empty/loading/failure/synthetic discovery、state/focus和zero side effects；回滚keys/usages/tests，无migration。

**相邻事实与owner**：shared四视图nav的4个按钮只有active class、无`aria-current/pressed/selected`；settings内容root无role/name且production初开focus在BODY。这两项跨F-26/F-15边界，不由F-09 change接管。provider selector已正确用`aria-pressed`，pointer切换后state移动且已恢复default。

**OpenSpec/验证/清理**：新change为3 requirements/11 scenarios/7 of 28 tasks，proposal/design/tasks/delta齐全；四级Scenario、11 WHEN/THEN、全仓唯一requirement和单active owner人工通过。strict CLI exit127，不声称通过。直接Vitest窄测4/4 files、25/25 tests、2.05s、exit0。一次package wrapper误把目标参数变成full Drawnix run：184 pass/4 fail/1 skip files，1161 pass/3 fail/1 skip tests，90.86s、exit1；四簇仍为cached image、GPT Blob mock、Sora duration、PPT settings mock，和本轮前baseline相同且无F-09 focused failure。截图为1280×720 JPEG、64,850 bytes、SHA256 `5a6f4f63…54f7`；无after、性能或视觉改善声明。Browser tab已关闭，server Ctrl-C exit0，端口无listener，临时诊断文件不存在。

**复审/退出**：F-09 feature-local F-28 owner gap现已闭合为一项独立审批change，但没有实现。provider/model content的after keyboard/screen-reader/zh-en/visual结果、populated discovery runtime以及compact/touch/theme/high-DPI仍未闭合；原三项路由/discovery审批与两项产品语义阻塞不变。因此F-09仍未达到功能退出标准。

## 14. 第六个功能循环：F-07 AI 输入、上下文与提交

### 14.1 功能名称、用户场景、范围与门禁

**用户场景**：用户在画布底部输入 prompt，选择图片、视频、音频、文本或 Agent/Skill 模式及模型/参数/数量，附加本地图片、素材库图片、画布选中内容和知识库笔记；用户可以优化 prompt，随后提交并看到工作流、任务进度、结果、素材记录和画布插入。正常、空输入、上传/粘贴加载与失败、重复提交防护、任务失败、取消、重试、刷新恢复和离线降级均属于最终验收范围。

**范围**：`drawnix.tsx:172-176,1676-1691` 的懒入口；`DeferredAIInputBar.tsx:13-49`；`AIInputBar.tsx` 的请求级状态、图片导入/粘贴、偏好、解析、工作流 UI handoff 与主线程 MCP 步骤执行；`ai-input-parser.ts`、`workflow-converter.ts`、`useWorkflowSubmission.ts`；prompt 优化；知识上下文轻量引用；任务/缓存/画布结果边界。**非范围**：生成供应商自身质量、F-08 独立生成对话框、F-11 恢复工作流引擎内部语义、F-13 素材库完整管理、F-23 知识库编辑器，以及未经审批的新能力。

**规格与活动 change**：正式 `ai-input-generation/spec.md:6-86`、`prompt-optimization/spec.md:6-37`；活动 `add-ai-input-paste-images`、`add-ai-generation-state-persistence`、`add-model-scoped-generation-preferences`、`add-generation-context-library`、`refactor-hover-tip-unification` 和 `update-default-text-models`。它们分别与附件导入、恢复优先级、profile-aware 参数作用域、执行期上下文、工具提示和模型目录相交；本轮只修复有证据且不改变既有产品语义的问题。

**已知基线与验收**：F-07 前解析器文件因 settings mock 缺失生产导出无法收集；修正 mock 后，50 项中 22 项仍断言已不再由 UI 使用的文本标记契约。正式 Playwright 运行时缺少 `chromium_headless_shell-1200`；应用内浏览器随后可提供受控本地交互与视口证据，但不冒充正式套件。最低验收要求解析器、转换器、prompt、上下文和 Agent media route 窄测不回归；参考媒体的 URL 与尺寸保持位置对应；文档准确描述当前执行边界；typecheck、cycles、构建、启动预算无新增失败；已有全仓失败保持同簇或减少。任何可观察的可访问性、持久化、路由、缓存或恢复语义改变均先经过 OpenSpec。纯测试契约修复、参考图索引正确性修复和注释/文档同步是恢复当前接口不变量，无需新增审批。

### 14.2 当前完整调用链与状态边界

**正向链**：`drawnix.tsx:1676-1691` → `DeferredAIInputBar.tsx:42-48` → `AIInputBar`。文本、上传/粘贴/素材库图片、选中内容和知识 refs 进入组件请求级状态；粘贴只在输入栏聚焦/激活时由 `AIInputBar.tsx:2668-2710` 接管并复用本地图片导入链，素材库单选/批选由 `2398-2427` 追加。选择模型时 `2713-2759` 删除 `#` 触发符并把 `modelId/modelRef/selectionKey` 写入控件状态；类型、模型、参数、数量和 Skill 由 `ai-generation-preferences-service.ts:532-602,766-806` 读取、兼容过滤并写 localStorage。提交由 `AIInputBar.tsx:3097-3100` 的 ref/state 双锁防止同页面快速重复进入，`3171-3217` 将内容分类并调用 `parseAIInput(input, selection, options)`，然后 `workflow-converter.ts:232-518,526-665,730-1078` 生成直接或 Agent/Skill 工作流。

`useWorkflowSubmission.ts:459-529` 只完成 `WorkflowContext.startWorkflow`、Chat Drawer message handoff 和 retry context 注册，并明确返回 `usedSW:false`；`AIInputBar.tsx:3900-3944` 随后在页面主线程按顺序调用 `mcpRegistry.executeTool`，动态步骤也在同一执行循环处理。`generate_image/video/audio/text` MCP → `TaskQueueService.createTask():1904-1971` → `executeTask():609-1210` → media executor / invocation route / provider transport；`ai_analyze` 由 Agent/文本模型生成后续步骤。任务由 `taskStorageWriter` 写 `aitu-app/tasks`，RxJS `observeTaskUpdates():2446-2448` 和工作流/后处理事件更新 Chat Drawer、WorkZone、图片锚点、画布插入和素材库。Service Worker 不创建或执行这些新任务。

**知识与优化支链**：`KnowledgeNoteContextSelector` 在 `AIInputBar.tsx:4878-4885` 只保存规范化轻量 refs；converter/MCP/task params 继续只携带 refs。`task-queue-service.ts:503-540` 在真正执行前调用 generation context service，后者按 `generation-context-service.ts:8-10,134-211` 的 10 条笔记、每条 3,000 字符、总 12,000 字符预算读取最新笔记，跳过删除/不可读项并有界拼接。Prompt 优化由 `AIInputBar.tsx:5143-5169` 传 `ai-input.<generationType>` scenario，`prompt-optimization-service.ts:295-334` 选择共享 scenario/知识库模板并调用模型，最终通过 `onApply` 回填输入框；错误留在共享 dialog 状态，不会自动提交原请求。

**反向链**：画布/素材/Chat Drawer 最终结果 ← 工作流后处理与 TaskEvent ← `taskStorageWriter` 终态和 `TaskQueueService.emitEvent` ← 生成 MCP 创建的 task ← `AIInputBar` 的 workflow step ← converter ← parser options/selection ← 底部输入栏事件。工作流消息和重试记录 ← `sendWorkflowMessage` 的 retry context ← 同一 parsed input、model ref、selection、reference image 和 knowledge refs。偏好反向唯一写入者为 `saveAIInputPreferences/saveScopedAIInputModelParams`；当前 prompt、上传内容和 knowledge refs 在成功交接后由 `AIInputBar.tsx:3693-3696,3736-3739` 清空，不持久化为下一次请求。`workflowSubmissionService.submit():510-525` 当前没有生产调用者；该 service 在本链只参与恢复订阅、取消和恢复期 WorkZone/engine，留待 F-11 单独审计。

### [AI-INPUT-TEST-001] 解析器测试同时存在模块 mock 漂移与已废弃 UI 文本契约

**状态**：已证实测试缺陷，已修复并复验。

**用户影响、复现与当前/预期**：用户运行时行为不直接改变；影响是 AI 输入解析回归套件无法收集，修正收集后又产生 22 条假失败，无法为提交链提供可信门禁。复现环境为 Node 24.14.0、Vitest 3.2.4、无网络：旧 mock 缺少 `providerPricingCacheSettings`，suite 在执行断言前失败；保留生产导出后，50 项中 28 通过、22 失败。当前 UI 在 `AIInputBar.tsx:2713-2759,3025-3062` 选择模型/参数/数量时删除触发符并通过 options 保存控件值；解析器 `ai-input-parser.ts:259-340` 优先读取 options。预期测试覆盖这一当前公开调用契约，而不是继续把 `#model/-size/+count` 文本当作 UI 提交值。

**调用链、根因与影响范围**：测试 mock → parser 导入 → provider-aware 视频默认依赖 → settings-manager 完整导出；旧 mock 用手写子集替换整个模块，依赖扩展后收集失败。测试输入 → `parseAIInput` → `parseInput` 与 options 优先级 → ParsedGenerationParams；22 条断言仍描述旧文本语法，和可达 UI 分叉。影响限定为 `ai-input-parser.test.ts` 的可信度与全仓测试统计，未证明生产 parser 本身存在对应 22 个缺陷。证据强度为确定性收集错误、22 条原始失败、当前 UI/函数签名和修后全量通过。

**修复、备选、风险、验证与回滚**：`ai-input-parser.test.ts:10-27` 改为 `importOriginal` 后只覆盖 `geminiSettings.get`，保留完整生产契约；`116-220,224-307,345-420` 改为以 `ParseAIInputOptions` 表达 UI 选择，并保留无效文本留在 prompt 的边界用例。备选是继续补齐逐项 mock 或恢复已不可达的 UI 文本协议，前者会继续随模块导出漂移，后者会改变产品行为，均未采用。风险是误删底层 `parseInput` 覆盖；现有 parse-input 独立测试和本文件无效标记用例继续覆盖。修后该文件 51/51，且 F-07 16 文件 182/182。回滚只恢复该测试文件；不涉及运行时、缓存、存储或用户数据。

### [AI-INPUT-DIMENSIONS-001] 混合未知/已知参考图尺寸时索引被压缩

**状态**：已证实生产缺陷，已用红绿测试修复。

**用户影响、复现与当前/预期**：用户附加两张参考图，第一张尺寸读取失败，第二张为 1920×1080。修复前 `filter(Boolean)` 形式的收集得到 `[{1920,1080}]`，而系统提示词按数组索引在 `system-prompts.ts:232-239` 将该值标成“图片1”，造成模型收到错误的参考图尺寸映射。预期 URL、graphics 与尺寸数组始终按位置对应；未知尺寸保留 `undefined`，第二张仍标成图片2。确定性回归样本修复前期望 `[undefined,{1920,1080}]`、实际 `[{1920,1080}]`，1/1 失败。

**完整调用链与根因**：上传/粘贴/素材库/画布选中内容 → `AIInputBar.tsx:3171-3199` 分出 images + graphics → 旧尺寸收集过滤未知项 → `SelectionInfo.imageDimensions` → parser/converter → MCP `AgentContext.selection`（`mcp/types.ts:272`）→ `generateReferenceImagesPrompt` 按 `i` 生成 `[图片N](width×height)` → Agent/Skill 模型请求。反向从最终系统提示词的 `[图片1](1920x1080)` 可追到唯一尺寸数组写入者。根因是对位置型数据应用压缩过滤，破坏 `imageDimensions[i] ↔ referenceImages[i]` 不变量。影响 Agent/Skill 多参考图提示词中的尺寸标签和尺寸建议；没有证据表明图片 URL 顺序或直接媒体请求被重排。证据强度为完整静态读写链和红绿样本。

**修复、替代、风险、验证与回滚**：新增 `getAlignedImageDimensions()`（`ai-input-parser.ts:81-90`），使用 map 保留未知占位；`AIInputBar.tsx:3179-3194` 改为该 helper；`SelectionInfo`、`MCP AgentContext` 与 prompt helper 类型改为 `Array<ImageDimensions | undefined>`（`ai-input-parser.ts:95-105`、`mcp/types.ts:272`、`system-prompts.ts:227-260`），下游读取每个索引后判空。备选是以 URL 为 key 的 map，会引入重复 URL/graphics identity 规则且超出最小修复；在 prompt 生成器处猜测错位无法恢复丢失位置，未采用。风险是下游未判空；首次 typecheck 确实捕获 2 处 `dim` 可空错误，已改为索引读取后判空。回归测试位于 `ai-input-parser.test.ts:38-46`；修后 parser、workflow converter、Agent media routing 共 105/105，F-07 窄簇 182/182，Drawnix 与全仓 typecheck 通过。回滚恢复四处类型/收集逻辑并移除用例；无序列化、迁移、缓存键或数据删除。

### [AI-INPUT-DOC-001] 工作流文档把新 AIInputBar 提交错误归入 service/SW engine

**状态**：已证实文档与注释漂移，已同步；运行时未改。

**用户影响、复现与当前/预期**：维护者按旧 `FEATURE_FLOWS` 会把 AIInputBar 新提交追到 `workflowSubmissionService.submit`、`MainThreadWorkflowEngine` 或 SW，可能在错误边界修复任务、取消和恢复问题。静态反向扫描确认 `workflowSubmissionService.submit()` 没有生产调用者；实际 handoff 在 `useWorkflowSubmission.ts:459-529`，执行在 `AIInputBar.tsx:3900-3944`。预期文档区分“新提交的 UI handoff + AIInputBar MCP 执行”和“service 的恢复/取消/恢复期 engine”。

**调用链、修复、风险、验证与回滚**：错误文档/注释 → 调查者理解的入口 → 错误归因；真实链已在 14.2 记录。`FEATURE_FLOWS.md:25-76,254-298` 已改为主线程 TaskQueue 和真实工作流提交机制；`useWorkflowSubmission.ts:1-10`、`workflow-submission-service.ts:1-9` 同步职责注释；AIInputBar 局部名改为 `prepareWorkflowSubmission`（`AIInputBar.tsx:2026-2031,3658-3664`）。备选是删除无调用者的 service submit，但其恢复期邻接行为属于 F-11，当前没有足够不可达/兼容证据，未删除。仅文档和局部私有命名，运行风险低；typecheck、测试、build 已覆盖。回滚恢复文档/注释/局部名，不影响数据。

### [AI-INPUT-A11Y-001] 三个纯图标按钮没有可访问名称

**状态**：已证实可访问性不一致；已创建 OpenSpec change，等待审批，运行时未修改。

**用户影响、复现与当前/预期**：屏幕阅读器或浏览器 accessibility tree 枚举底部 AI 输入栏的上传、素材库和发送按钮。当前 `AIInputBar.tsx:4842-4875,5032-5051` 的按钮只有图标和 HoverTip，没有按钮自身文本或 `aria-label`；上传/素材按钮也没有显式 `type="button"`。同项目 Chat Drawer 等价控件在 `EnhancedChatInput.tsx:519-558,612-624` 已提供 `aria-label`，工具按钮还明确 `type="button"`。1280×720、768×1024、390×844真实浏览器样本每档均有1个对应DOM按钮、按“上传图片/从素材库选择/发送”名称均为0，accessibility snapshot显示 unnamed button。预期三个操作暴露本地化 accessible name，键盘激活保持原动作，非提交工具不触发表单提交。证据强度为三视口浏览器tree、可达DOM源码、等价组件对照和HTML按钮语义。

**调用链、方案、风险、验证与回滚**：辅助技术 → button accessible-name computation → 当前无文本/ARIA → 无操作名称；键盘 Enter/Space → 原生 button → 现有 `handleUploadClick` / `setShowMediaLibrary(true)` / `handleGenerate('button')`。change `improve-ai-input-control-accessibility` 的 proposal/design/tasks/delta 已人工核查为 1 个 ADDED operation、2 个 requirements、5 个 scenarios，全仓无同名 requirement；OpenSpec CLI 不可用，不能声称 strict validate。批准后的本段最小实现仍是为三按钮加中英文 `aria-label`，为上传/素材加 `type="button"`，不改 class、布局、点击或提交逻辑，并以 role/name 测试覆盖中英文；共享移除控制由下一问题和同change第二requirement独立约束。风险是标签语言与当前 UI language 切换不同步；测试应在两种 language 下重渲染验证。回滚只移除属性和对应测试，无数据影响。审批前不修改运行时。

### [AI-INPUT-A11Y-002] 共享附件移除按钮无名称、仅 hover 可见且命中框为 16×16

**状态**：已证实可访问性/触控缺陷；已扩展同一 OpenSpec change，等待审批，运行时未修改。

**用户影响、复现、当前与预期**：在主 AI 输入粘贴两张合成图后，1280×720、768×1024、390×844每档均有2个共享remove button，但按“移除”名称为0；每个rect精确16×16。before截图的非hover状态没有移除提示；`selected-content-preview.scss:187-223`设置默认`opacity:0`且只有item `:hover`变为1，没有focus/focus-visible或non-hover规则。当前mouse hover后可正确2→1→0；屏幕阅读器不能识别操作，键盘焦点没有可见恢复规则，非hover触控没有持久可发现入口。预期保持只删对应附件和不提交的现语义，同时提供本地化可区分名称、focus/non-hover可见性和不覆盖邻项的≥24×24目标。

**完整调用链、根因、范围与证据**：`AIInputBar.tsx:5053-5062`和`EnhancedChatInput.tsx:411-424`→shared `SelectedContentPreview`→`:163-167 canRemove`→`:222-238` HoverTip包裹icon-only button→caller `onRemove(index)`→uploaded state filter→两composer projection；reverse从所有remove DOM只回到该shared writer。根因是把HoverTip当成button semantic label和唯一discoverability state。影响主输入/Drawer的uploaded attachments；无`onRemove`的canvas selection/implicit refs不受影响。证据为exact browser names/rect、三截图、CSS和唯一caller chain；physical touch的hover仿真仍未知，但默认unnamed/invisible/16×16不依赖该未知。

**方案、替代、风险、验证与回滚**：`improve-ai-input-control-accessibility`现为2 requirements/5 scenarios并新增design；bounded display metadata生成zh/en名称、fine pointer保留现hover、focus和coarse/non-hover显示、preview-local target≥24且hit test不压邻项。只加label会保留视觉/target defect；全局把thumbnail放大到44无证据。风险是遮住相邻缩略图、泄露URL/Base64或fine-pointer视觉噪声；批准后测重复名、zh/en、Enter/Space、focus、coarse pointer、adjacent hit、三视口/light-dark。回滚shared attributes/CSS/tests，无数据/API/storage影响。

### [AI-INPUT-MODEL-001] 目标类型没有可选模型时保留旧媒体模型与参数并允许提交

**状态**：已证实正确性/UX缺陷；已更新 `add-model-scoped-generation-preferences`，等待审批，运行时未修改。

**用户影响、复现、当前与预期**：在1280×720、zh-CN、light、current `dist/apps/web`的fresh loopback origin中，从已有`gpt-image-2`的图片模式切到没有可选模型的音频模式。稳定DOM同时显示`选择模型 (↑↓ Tab)`和图片参数`自动, 1K, 自动`；输入无害文本`F07 local validation only`后，send button的`disabled`属性为null、class为`ai-input-bar__send-btn active`。此前同run的视频空模型状态也显示`选择模型`和`16:9, 1K, 自动`。当前用户看到“无模型”，却仍可携带旧媒体model/params进入音频/视频提交；预期清除旧类型投影，并在存在目标类型兼容模型前阻止提交。本轮未点击send、未产生provider request。

**完整调用链、根因、范围与证据**：`GenerationTypeDropdown.onSelect`（`AIInputBar.tsx:4889-4894`）→`setGenerationType`→目标`currentModels`为空（`:1529-1542`）→类型effect没有next model（`:1404-1422`）→仅在provider-selection mode执行的clear分支在当前built-in fallback mode不运行（`:1433-1439`）。`ModelDropdown.tsx:358-399`又对空列表调用`onSelect('', null)`，但绑定的`handleModelSelect`在空ID找不到config后直接return（`AIInputBar.tsx:2768-2782`），第二条clear也被吞掉。旧`selectedModel`继续进入`compatibleParams`（`:1605-1636`）并渲染参数（`:5005-5017`）；`canGenerate`只检查prompt/content（`:4752`），send因此启用（`:5032-5051`）。若点击，`handleGenerate`会把新generationType和旧model送到credential route与`parseAIInput`（`:3076-3085,3142-3156,3201-3217`）。反向从active send唯一回到`canGenerate`，从旧参数唯一回到上述model owner/两条失败clear链。影响限定bottom AI input的空目标modality；独立生成Dialog未取得同类证据。证据强度为稳定浏览器DOM/attribute/class、before截图和完整唯一读写链。

**候选方案、替代、风险、验证与回滚**：现change新增“目标类型无兼容模型”scenario：统一nullable selection transition，清除model/ref/params，并把有效目标模型纳入send可用条件。注入built-in fallback会冲突authoritative provider-only empty-state语义且不能解决真实不支持modality；仅隐藏参数仍会把旧model送入payload，均未采用。风险是目录加载瞬时空态误清有效选择；批准后必须以现有runtime catalog readiness区分loading与resolved-empty，补component红绿测试覆盖empty/loading/later-available，并复跑同UI步骤确认旧参数消失、send禁用、有效模型出现后恢复。回滚只恢复selection reconciliation、send guard及测试；不改key/schema/migration/task/cache，不删除用户数据。完整环境、原始可见值、截图hash见`docs/evidence/f07-ai-input/preference-persistence.md`和`preference-metrics.json`。

### 14.3 活动 change 状态、待验证项与已验证非问题

- `add-ai-input-paste-images` 为 8/9：三视口真实 `Meta+V` 均记录 primary preview `0→0（外部）→1→2→1→0`，浏览器错误0、无横向document overflow，并观察到既有素材成功反馈；3.2已完成，3.1的移除/重复部分完成。生成参与仍未提交验证：静态链明确`allContent→effectiveContent→selection.images→referenceImages→workflow`，但credential preflight先于转换，不能用无凭据点击证明context，也不得调用供应商，故3.1保持未勾选。
- `add-ai-generation-state-persistence` 为 6/7：浏览器通过visible controls设为`图片/gpt-image-2/16:9、2K、标准/2个`后，同源reload和关闭tab再新开同URL均完整恢复，3.1已完成。3.2仍未完成：切到无目标模型的audio/video已证实`AI-INPUT-MODEL-001`，修复受OpenSpec审批门禁约束。
- `add-model-scoped-generation-preferences` 为 12/16：单测已覆盖 `selectionKey || modelId` 存取；图片参数在`图片→文本→图片`后恢复，但当前只有1个image、0个video、0个audio可选模型，不能冒充5.2要求的三媒体双模型切换。5.3同ID跨profile只有service单测，没有安全UI profile/catalog fixture；新增4.3/5.4拥有空模型清理和验证，均等待审批。
- `add-generation-context-library` 为 9/9；generation context service、queue、AI input converter 和 Agent route 的当前窄测通过。已验证的是轻量 refs、执行期最新读取、数量/长度上限和缺失降级；没有外部模型凭据，因此未重新声称真实供应商请求成功。
- **已验证非问题**：AIInputBar 新提交不经 Service Worker；prompt/上传/knowledge refs 是当前请求状态并在成功 handoff 后清空，类型/模型/参数/数量/Skill 是本地偏好；知识正文没有复制进任务记录；模型与参数来自 options 而不是可见 prompt 标记；`workflowSubmissionService.submit()` 的无生产调用不足以单独证明整个 service 可删除。

### 14.4 验证结果、性能/视觉证据与退出判断

- 窄测（Node 24.14.0、Vitest 3.2.4、无网络）：F-07 相关 16/16 文件、182/182 用例通过，退出 0；其中 parser 51/51，parser + workflow converter + Agent media routing 105/105。测试运行中的 IndexedDB 缺失、UnifiedCache fake store、Browserslist 和 sourcemap stderr 是既有 Node/mock 环境噪声，没有导致这些断言或命令失败。
- 定向 ESLint：parser/test/system-prompts/AIInputBar 退出 0，18 条 warning、0 error。更宽的修改文件 lint 退出 1，命中 `mcp/types.ts` 3 个既有 `import/first` error 和 workflow service 2 个既有 `no-case-declarations` error；新测试曾有 1 条 `no-inferrable-types`，已修复。没有把 warning 或既有规则命中认定为 F-07 产品缺陷。
- 浏览器粘贴矩阵：current `dist/apps/web`、Codex in-app Chromium exact build未知、light/zh-CN、无CPU/network throttle、每视口1样本。1280×720、768×1024、390×844均为`initial0/outside0/inside1/duplicate2/remove1/remove0`；document clientWidth等于scrollWidth，error log 0。remove target三档均16×16；upload/library/send/remove预期name count均0。三张before截图、精确DOMRect/hash/bytes与所有限制见`docs/evidence/f07-ai-input/`。截图扩展了既有`F28-LAYOUT-002`到390×844 attachment-preview状态，但未单独取toolbar rect，故不虚构新intersection area。
- 浏览器偏好矩阵：current `dist/apps/web`、port7400 fresh origin、1280×720、zh-CN/light、无throttle、每transition 1个功能样本；visible state从`图片/gpt-image-2/自动、1K、自动/1个`改为`16:9、2K、标准/2个`，reload与tab close/reopen均完整恢复。`图片→文本→图片`恢复model params但count按源码规则归1，不将未规格化的per-type count当缺陷。空audio model样本确认model label为空态、旧图片params仍显示、填prompt后send active；没有点击send或调用provider。单张before screenshot为1280×720 JPEG/JFIF bytes（`.png`后缀），详见`preference-persistence.md`/`preference-metrics.json`。
- 偏好service定向复跑（Node 24.14.0、Vitest 3.2.4、`packages/drawnix` cwd）退出0：1/1 file、11/11 tests、2.64s。前两次从仓库根传入不匹配Vitest相对include边界的filter，均在收集前以“No test files found”退出1，归类命令作用域错误而非产品/测试失败；修正cwd后通过。`indexedDB is not defined` ConfigWriter stderr为既有jsdom环境噪声，没有导致断言失败。
- `pnpm nx run drawnix:typecheck` 退出 0；`pnpm typecheck` 5/5 projects、退出 0；`pnpm check:cycles` 退出 0。
- 全仓单测默认 reporter 两次均退出 1；为避免延迟 stderr 淹没统计，另以 Vitest JSON reporter运行同一 Drawnix 测试集，退出 1并写临时报告：172 个文件记录中 166 个状态通过、6 个失败；1124 项中 1113 通过、10 失败、1 pending。相比 F-07 前 1073 项，解析器此前未收集的 50 项与新增 1 项回归现均通过。10 个失败断言分布为 Prompt History 4、GPT Image Blob 1、Sora duration 1、Workflow timeout 3、cached image conversion 1；另有 PPT generation settings mock 收集失败。它们都位于既有失败簇，F-07 16 个文件全部通过；workflow timeout 数量在不同全仓运行间波动，不能归因于本轮。
- `pnpm build:web` 退出 0：主应用 7,931 modules、单次约 1m29s，SW 54 modules、约 1.41s；Sass deprecation、CSS `:export` 和动态/静态 import 混用为既有告警。构建命令更新 `version.json` 的构建时间；无 Git 元数据，无法与历史内容核对。
- `pnpm verify:startup` 退出 0：startup CSS/app/runtime/index 分别 14,208/3,776/1,867/345 bytes，4/4 低于各自 512,000 bytes，chunk cycles 为空。`pnpm size` 退出 1：AI Chat 844.24 kB gzip，超过 140 kB 预算 704.24 kB；Startup App 1.94 kB、Runtime 1.01 kB、Diagram 934.93 kB、Office 269.19 kB、Editor 858.24 kB、Media Viewer 12.19 kB 均在预算内。与 F-07 前同一已知 size 失败一致。
- 本轮没有性能优化；构建和 size 只用于回归，单样本构建时间不构成“更快”证据。没有修改可见样式；尺寸修复改变发送给模型的隐藏结构化上下文，不提供“更美观”结论。AI-INPUT-A11Y-001/002和AI-INPUT-MODEL-001尚未实施，因此只有before evidence，不伪造after accessibility tree或视觉截图。
- Playwright smoke/feature/visual/responsive 仍在 browser launch 前被缺失的 `chromium_headless_shell-1200` 阻塞；没有擅自下载浏览器。应用内浏览器证据只解除上述明确记录的paste/primary-preview/zh-light三视口项，不冒充正式suite。OpenSpec CLI 仍不可用，只能人工校验。目录没有 Git 元数据，无法核对历史、diff 或工作树干净度。
- F-07 **尚未达到退出标准**：AI-INPUT-A11Y-001/002、AI-INPUT-MODEL-001与关联F28移动clearance等待用户批准；粘贴生成参与、兼容过滤修后验证、三媒体双模型与同ID跨profile UI偏好仍缺安全完整证据；dark、English、keyboard focus/Enter/Space、physical touch、zoom/high-DPI、validation/compression/quota/offline/recovery仍未闭合。刷新与tab close/reopen参数恢复已经实测闭合；已确认的解析器测试、尺寸索引和文档漂移均已修复；本次新增浏览器子循环只改proposal/tasks/evidence，运行时0。

## 15. F-08 独立图片/视频生成弹窗功能循环（调查中）

### 15.1 功能、场景、范围、规格与验收门

**功能名称与用户场景**：用户从统一工具栏或既有任务“编辑/重试”入口打开独立图片或视频生成弹窗，配置模型、参数、参考图、知识上下文和自动插入，提交一个或多个任务；随后在同一弹窗看到加载、进度、完成、失败、取消和恢复任务，能够搜索、预览、下载、重试、编辑或手动插入画布。

**本轮范围**：`unified-toolbar`/既有任务入口 → `TTDDialog` → `AIImageGeneration`/`AIVideoGeneration` → `useTaskQueue` → `TaskQueueService` → 主线程 media executor/provider adapter → task storage/unified cache → RxJS/Jotai 恢复任务集 → `DialogTaskList` → 预览、下载、编辑、重试和画布插入。**非范围**：底部 AIInputBar（F-07）、音频/文本/Agent、批量出图工具（F-19）、视频分析器/MV（F-17/F-18）、供应商目录语义（F-09）和任务队列全局调度语义（F-10）。

**正式规格与活动变更**：正式 `image-generation`、`image-generation-feedback`；相关活动 change 为 `add-ai-generation-state-persistence`、`add-model-scoped-generation-preferences`、`add-generation-context-library`、`update-kling-capability-version-routing`。本轮另建立 `improve-generation-dialog-task-creation-feedback` 和 `fix-generation-dialog-maximized-viewport-resize`；两者均为独立、可回滚的用户可观察行为 change，等待批准。前者后来由 F-19/F-20 追加场景，当前为 6/18 tasks、2 requirements/10 scenarios；后者仍为 4/14 tasks、2 requirements/5 scenarios。OpenSpec CLI 不可用，不能声称 strict validation；人工检查确认两者各有 1 个 ADDED operation，且全仓无同名 requirement。

**进入本轮时的基线**：F-07 后全仓 typecheck 5/5 和静态运行时循环检查通过；全仓单测有 Prompt History、GPT Blob、Sora duration、Workflow timeout、cached image conversion 与 PPT mock 收集等既有失败；AI Chat size budget 既有超限；lint 仍扫描包内 `node_modules`；Playwright 缺 `chromium_headless_shell-1200`；目录没有 Git 元数据；外部生成没有供应商凭据。上述环境/基线不能冒充 F-08 产品缺陷或通过证据。

**本轮验收标准**：正常、空态、创建拒绝、执行失败、取消、重试、刷新恢复、预览/下载、手动/自动插入均有证据；任务和媒体结果的正反调用链闭合；桌面/平板/移动和旋转后的设置/任务面板可达；没有新增 typecheck、测试、循环、构建或预算回归；规格/注释同步。任务创建具体反馈和最大化窗口随视口变化需要 OpenSpec 审批；审批前只调查、测试当前行为和写 proposal，不修改对应运行时。

### 15.2 当前正向与反向调用链

**打开与状态所有者**：统一工具栏 `handleAIImageClick/handleAIVideoClick`（`packages/drawnix/src/components/toolbar/unified-toolbar.tsx:437-447`；移动折叠入口 `:498-523`）调用 `useDrawnix.openDialog`；任务列表编辑也可由 `DialogTaskList.tsx:260-329` 从 IndexedDB reader、service 内存或当前 atom 任务反向回填。`TTDDialog` 读取 `openDialogTypes` 和按类型初始数据（`ttd-dialog.tsx:51-73`），把图片/视频分别挂到共享 `WinBoxWindow`（`:723-881`）。图片/视频表单状态由各组件的 React state 持有；`useDeviceType.viewportWidth <= 768` 决定移动双页签和单面板显示（`ai-image-generation.tsx:267-282,946-987`；`ai-video-generation.tsx:244-252,1214-1255`）。模型选择由当前 invocation route/model ref 与模型作用域偏好对齐；知识上下文只在任务参数保存轻量 refs，执行前再解析正文。

**提交、默认值与转换**：图片 `ActionButtons.onGenerate` → `handleGenerate`（`ai-image-generation.tsx:703-908,1072-1086`）先用 ref 防双击、检查 prompt/API key，把字符串宽高转为整数并默认 1024，将 File 转为可序列化 data URL、剥离 mask 之外的大对象，组合 model/modelRef、size/aspect ratio、参考图、knowledge refs、自动插入和外部批次元数据，再调用 `createTask(..., IMAGE)`；多任务逐项创建并记录 task IDs。视频走等价链（`ai-video-generation.tsx:1020-1209,1400-1457`），额外验证 storyboard 时长和模型要求的图片槽，再转换 duration/size/uploaded images/model params。两者的请求级 `generatingLockRef` 只覆盖同步参数准备与任务创建，不拥有后台执行生命周期。

**任务、执行、存储、缓存与返回**：`useTaskQueue` 的 write atom 调用 `TaskQueueService.createTask`（`useTaskQueue.ts:82-93,226-237`）。service 验证/净化参数，建立 invocation route 快照和 PROCESSING task，写内存 Map、异步持久化 IndexedDB、发 `taskCreated`/分析事件并 fire-and-forget 执行（`task-queue-service.ts:1904-1977`）。`executeTask` 为每个 task 建 AbortController、执行期解析知识正文并在无凭据时落 FAILED（`:609-652`）；`executorFactory.getExecutor()` 明确返回主线程 `FallbackMediaExecutor`（`media-executor/factory.ts:1-45`），图片/视频映射到 `generateImage/generateVideo`（`task-queue-service.ts:868-1015`），adapter/provider route 完成网络提交、轮询和取消。进度、终态与失败创建新 Task 对象，发 RxJS event，终态写 task storage（`:872-895,1136-1188`）；媒体 executor/cache 路径把可缓存远端结果落统一缓存，缓存失败时保留原 URL，不把缓存失败升级为生成失败。Service Worker 不创建或执行这些任务。

**UI、恢复与反向写入者**：`ensureTaskStateSyncStarted` 订阅 service event 并增量更新 Jotai；内存为空时延迟 500ms 从 task storage reader 恢复，最多 `MAX_RETAINED_TASKS`（`useTaskQueue.ts:121-210`）。`DialogTaskList` 从共享恢复任务集按类型、可选 ID、搜索词过滤（`DialogTaskList.tsx:35-63,145-161`），将状态、进度和结果交给虚拟列表；预览只接受有结果的图片/视频/非歌词音频（`:339-356`），下载走 `buildTaskDownloadItems/smartDownload`（`:181-210`），编辑/再生成优先读持久化任务（`:260-329`），重试/删除回到 shared task actions。手动图片插入唯一写入者为 `insertImageFromUrl` 循环，视频为 `insertVideoFromUrl`，全部成功后 `markAsInserted(taskId, 'manual')` 持久化 `insertedToCanvas` 并发送插入分析事件（`:213-243`；`task-queue-service.ts:2470-2495`）。刷新后任务状态来自 IndexedDB，媒体 URL 可来自统一缓存；外部 URL、Cache API 或 IndexedDB 不可用时的完整离线体验尚未有真实浏览器样本。

**并发、取消、重试、隐私与测试边界**：后台并发、外部任务取消和 retry ownership 属 F-10，本轮只确认弹窗复用同一 service actions；任务 service 的 duplicate execution set 和每任务 AbortController 位于 `task-queue-service.ts:609-620`。错误通过 task.error、弹窗 `error` state 和 TDesign Message 到达用户；提案要求只透出安全的已识别 validation reason，不透出 stack、凭据、请求 payload 或 provider response。当前测试覆盖 dialog state、preferences/history、generation adapter、task service/hook、cache 与 auto/manual insertion；正式真实 provider 成功、浏览器刷新/离线、Playwright responsive/visual 仍分别受凭据和 Chromium 阻塞。

### [GEN-DIALOG-ERROR-001] 任务创建边界丢弃具体参数错误

**状态**：已证实；用户可见反馈 change 等待批准，运行时未修改。

**用户影响与复现**：现有 frame/预填入口可把超过 4096px 的尺寸带入图片弹窗。`validateGenerationParams` 拒绝后，service 抛出 `Invalid parameters: Width must not exceed 4096 pixels`，但 Hook 捕获所有异常只返回 `null`（`useTaskQueue.ts:82-93`）；图片/视频组件因此走 generic `任务创建失败`，其 `Invalid parameters` 分支（`ai-image-generation.tsx:901-937`、`ai-video-generation.tsx:1169-1205`）不可达。诊断测试 `useTaskQueue.test.ts:30-58` 注入该具体错误，原始结果为 Hook 返回 `null`。当前行为是不告诉用户应修正哪个参数；预期候选是保留安全、可操作的既有校验原因并保持表单，未知错误继续 generic。

**调用链、根因、范围与证据强度**：frame/表单尺寸 → dialog task params → Hook write atom → `TaskQueueService.createTask` validation throw（`task-queue-service.ts:1904-1909`）→ Hook catch/null → dialog generic error。根因是 Hook 的 `Task | null` 契约没有错误通道，而不是校验规则或 provider。影响图片和视频的创建期拒绝；没有创建、执行或持久化 task。证据为完整静态链和 1 次可控 Hook 样本，强度高。

**方案、替代、风险、验证与回滚**：`improve-generation-dialog-task-creation-feedback` 提议增加 typed result 或等价安全错误通道，识别 invalid parameter 后中英文呈现；不改 public service throw、限制、provider、缓存、并发或恢复。备选让组件直接调用 service 会绕过共享 atom 同步，未选；把所有 Error.message 原样展示有泄密风险，未选。批准后先把诊断测试改为契约红绿测试，再加两种 dialog 和 unknown fallback 测试。回滚只恢复 Hook 返回契约和渲染分支，无数据迁移。

### [DIALOG-INSERT-TRACKING-001] 弹窗手动插入成功没有登记任务插入状态

**状态**：已证实并修复。

**用户影响、复现与预期**：用户在图片/视频生成弹窗的完成任务中点击“插入”。修复前 `DialogTaskList.handleInsert` 只写画布并提示成功，没有调用任务 service 的唯一 `markAsInserted`；任务记录、插入分析和依赖该字段的其他 UI 仍认为未插入。红灯测试 `DialogTaskList.test.ts:142-183` 中图片、视频成功插入均未收到 `markAsInserted`，失败插入不标记分支已符合预期；原始结果 1 文件、2 失败/1 通过、退出 1。预期是所有目标媒体成功落画布后登记 manual insertion，失败不登记。

**调用链、根因、影响与证据强度**：完成 task → `VirtualTaskList.onInsert` → `DialogTaskList.handleInsert` → `insertImageFromUrl`/`insertVideoFromUrl` → success toast；反向从 `Task.insertedToCanvas` 可追到 `TaskQueueService.markAsInserted`（`task-queue-service.ts:2470-2495`），旧弹窗路径缺失该写入，其他入口不补写。影响手动插入的图片/视频任务状态与分析，不影响画布实际元素或媒体缓存。证据为唯一写入者反向追踪和红灯样本，强度高。

**修复、替代、风险、验证与回滚**：在图片 URL 全部 await 完成后和视频 await 完成后调用 `markAsInserted(taskId, 'manual')`（`DialogTaskList.tsx:213-243`）。备选在单个 `insert*FromUrl` 内全局标记会缺 task ID 并污染非任务插入，未采用；提前标记会把失败当成功，未采用。绿灯为同文件 3/3、退出 0，覆盖图片成功、视频成功、图片失败。回滚移除两次调用和测试文件即可；无 schema、缓存键或媒体删除。

### [GEN-DIALOG-RESPONSIVE-001] 最大化弹窗在设备旋转后保留旧视口尺寸

**状态**：已证实；已写独立 OpenSpec change，等待批准，运行时未修改。

**用户影响与受控复现**：在应用内 Chromium 浏览器、单次样本、本地构建 `http://localhost:7200/` 中，把视口设为 `844×390`，从工具栏打开图片弹窗，随后切到 `390×844`。图片 WinBox 的 raw rect/inline size 仍为 `844×390`，任务页签 rect 为 `x=418.5,y=65,width=393.5,height=42`、`visiblePixels=0`，指针点击失败：目标点 `(615.25,86)` 在视口外。视频弹窗按相同步骤得到同一 `844×390` 和 `visiblePixels=0`。控制样本在 `390×844` 冷启动后直接打开图片弹窗，WinBox 为 `390×844`，任务页签 `x=197,y=65,width=172,height=42`、可见面积 `7,224px²`，document scrollWidth 为 390；桌面 `1280×720` 直接打开时弹窗 rect 为 `x=148,y=208,width=984,height=352`，body 无横向溢出。浏览器版本未由控制接口暴露，记为未知；不能把该手工 Chromium 样本冒充 Playwright 套件。

**当前/预期、调用链与根因**：当前内容层的 `useDeviceType` 收到 resize/orientationchange 并切到 compact tab UI，但共享 WinBox 仍保持旧最大化 bounds，导致半个 UI 和关闭控件移出视口；预期候选是可见且已最大化的生成弹窗按当前 viewport 重算几何，同时不 remount 表单/任务状态。入口 → `TTDDialog autoMaximize={isMobile}`（`ttd-dialog.tsx:724-855`）→ WinBox 创建后 `maximize()`（`WinBoxWindow.tsx:945-952`）→ 旋转 → `useDeviceType.ts:118-149` 更新内容 → `autoMaximize` 仍为 true → effect 再调用 `maximize()`（`WinBoxWindow.tsx:1180-1185`）→ 第三方实例因 `max===true` no-op。上游 WinBox 源码 `node_modules/winbox/src/js/winbox.js:386-397` 在 resize 只更新 root size 并保留“adjust window sizes” TODO，`:1117-1133` 只在非 max 时计算新 bounds。证据为两类对照样本、指针失败、截图和共享源码链，强度高。

**方案、替代、风险、验证与回滚**：`fix-generation-dialog-maximized-viewport-resize` 提议在共享 wrapper 内加入有清理的、仅针对 visible+maximized generation dialog 的 viewport 同步，不 remount children；明确排除 non-max/min/split/hidden 状态和任务执行语义。备选以 viewport 作为 React key 会丢 prompt/附件/active panel，未选；纯 CSS 强制 width/height 会让 WinBox 内部 geometry 与 DOM 分叉，未选；全局调整所有 WinBox 会扩大 F-15 范围，未选。批准后需要 wrapper 红绿测试、双向旋转、listener cleanup、非最大化不变和图片/视频 browser 流；回滚移除 listener/测试，无持久化迁移。证据截图位于 `docs/evidence/f08-generation-dialog/`。

### [DIALOG-COMMENT-DRIFT-001] 弹窗任务集和 batchId 注释描述旧执行边界

**状态**：已证实并同步；运行时未改。

**证据、调用链与影响**：初始源码注释把 `DialogTaskList` 描述为“当前会话/SW RPC 分页”，并把单任务 `batchId` 描述为绕过 SW 重复检测；实际 `useFilteredTaskQueue` 消费共享内存+IndexedDB 恢复任务集（`DialogTaskList.tsx:1-6,52-63`），任务在主线程执行，batchId 是批次/外部工作流关联元数据（`ai-image-generation.tsx:853-879`，视频等价任务参数路径）。旧注释不会改变用户运行行为，但会把维护调查导向不存在的 SW 执行边界。证据为当前正反调用链；无 Git 元数据，不能补充历史 diff。

**修复、替代、验证与回滚**：只更新上述三处注释，不删除 API、不重命名字段。备选删除注释会丢失恢复集合和关联元数据意图，未选。Typecheck、窄测和 build 覆盖语法/运行无变化；回滚恢复注释不会影响数据。

### [DIALOG-BATCH-PARTIAL-001] 多图手动插入部分成功后的语义未知

**状态**：待验证假设，未修改。

**怀疑理由与验证方法**：`DialogTaskList.tsx:221-243` 顺序 await 多个图片 URL，并只在循环全部完成后标记；若第 N 张插入失败，前 N-1 张已经进入画布、task 不标记，用户重试可能再次插入前 N-1 张。静态代码证明“先前写入不回滚”，但仓库没有说明部分成功应标记、逐项标记、回滚还是在重试时去重，因此不能把候选语义当缺陷。验证需要可控 board 插入器在第二张失败，记录画布元素、toast、task flag 和再次点击结果，再由产品规格决定 all-or-nothing 或 partial-success 反馈；任何方案都会改变用户可见结果，应另走审批。

### 15.3 验证、性能/视觉证据与退出判断

- F-08 窄簇：固定 Node `v24.14.0`、Vitest `v3.2.4`、无外部网络，15/15 文件、77/77 用例通过，退出 0。新增 `DialogTaskList.test.tsx` 和 `useTaskQueue.test.ts` 定向复验为 2/2 文件、4/4 用例、退出 0；两文件定向 ESLint 退出 0。测试 stderr 中 `indexedDB is not defined`、Browserslist 和受控插入失败日志为既有测试环境/预期失败分支输出，没有导致命令失败。
- `pnpm nx run drawnix:typecheck` 退出 0；`pnpm typecheck` 为 5/5 项目、退出 0；`pnpm check:cycles` 退出 0、无静态运行时循环。
- 全仓 Drawnix 为 174 文件：167 通过、6 失败、1 跳过；1128 项：1116 通过、11 失败、1 跳过，另有 1 个既有未处理 mock 异常。失败簇为 Prompt History 4、GPT Blob 1、Sora duration 1、Workflow timeout 4、cached image conversion 1，以及 PPT settings mock 收集失败；F-08 新增测试均通过。react-board 1/1 文件、8/8；utils 25/25 文件、471/471。带 `--reporter=dot` 的 Nx runner 在 Vitest 子进程统计完成后不退出，取得统计后中止，根命令退出 130，分类为 runner 句柄异常而不是“全仓通过”或 F-08 产品失败。
- `pnpm build:web` 退出 0：主应用 7,931 modules、单次约 1m29s；SW 54 modules、约 1.49s。`pnpm verify:startup` 退出 0。`pnpm size` 退出 1：AI Chat 844.24 kB gzip，超过 140 kB 预算 704.24 kB；其余预算通过，与既有基线一致。`pnpm lint` 退出 1，仍扫描包内 `node_modules`，至少汇总 3,143 problems（1,144 errors/1,999 warnings）；新增测试定向 lint 通过，不能用全仓噪声判 F-08 回归。
- 本轮没有性能实现，因此不宣称更快、更省内存或更小；单次构建时间只作回归记录。响应式调查是功能/视觉可达性实测而非性能结论。正常冷开与旋转失败截图分别为 `docs/evidence/f08-generation-dialog/mobile-cold-open-390x844.jpg`、`mobile-rotation-landscape-to-portrait-390x844.jpg`、`video-rotation-landscape-to-portrait-390x844.jpg`；尚未修复，所以没有伪造“修后”截图。浏览器调查后已恢复视口、关闭调查标签并终止本地 server。
- Playwright smoke/feature/visual/responsive 仍在 browser launch 前被缺失的 `chromium_headless_shell-1200` 阻塞；应用内浏览器证据不冒充套件通过。真实图片/视频 provider 成功、慢网、离线和远端 URL 失效路径因没有外部凭据而阻塞。OpenSpec CLI、Git 历史限制保持不变。
- F-08 **尚未达到退出标准**：`GEN-DIALOG-ERROR-001` 与 `GEN-DIALOG-RESPONSIVE-001` 等待用户审批；多图部分成功语义未知；正式 Playwright/视觉/响应式和真实供应商成功流阻塞。`DIALOG-INSERT-TRACKING-001` 已红绿修复，注释已同步，当前窄测/typecheck/cycle/build 未新增失败。两个已批准前置 change 可分别实施和回滚，不互相改变任务、缓存、存储或 provider 语义。

## 16. F-14 “我的提示词”与提示词历史功能循环（调查中）

### 16.1 功能、场景、范围、规格与验收门

**功能名称与用户场景**：用户从 AI 输入历史面板或工具箱打开“我的提示词”，按图片、视频、音频、文本、Agent、PPT 公共和 PPT 页面分类以及 Skill/关键词筛选任务代际记录；用户可以查看轻量结果预览、复制发送提示词、创建、基于记录创建、编辑允许的字段、置顶、批量删除，并在刷新/恢复后继续复用。加载、空态、失败、手动取消弹窗、刷新/关闭恢复和本地离线读取属于本轮；生成任务自身的取消/重试执行属于 F-10。

**范围与非范围**：范围为内置工具注册/窗口入口、AI 输入 popover、`PromptHistoryTool`、`prompt-history-service`、`prompt-storage-service`、终态 task reader、任务归档、IndexedDB、提示词备份/恢复、PostHog 隐私摘要以及相关测试/视觉/键盘路径。非范围为任务执行/媒体缓存语义（F-10/F-13）、工具箱卡片/WinBox 的全局键盘契约（F-15/F-28）、AI 输入提交（F-07）、新增云同步或跨标签页提示词同步，以及未经批准的新能力。

**正式规格与活动变更**：正式 `openspec/specs/prompt-history/spec.md:6-30` 只记录任务 lineage、五类/Skill 筛选和 hover 预览；`backup-restore/spec.md:35-42` 要求终态和 archived generation history 完整保留供提示词历史等消费者使用。当前实现还包含 `ppt-common`、`ppt-slide`、pinned-first 排序和手动创建/编辑/删除/置顶，正式 prompt-history spec 未完整记录。已建立三个独立 change：`preserve-archived-prompts-in-history`（4/14）、`improve-prompt-history-dialog-accessibility`（4/14）、`ensure-prompt-storage-write-consistency`（4/15）。三者分别改变 archived 可见性、键盘/辅助技术行为和存储/备份时序；均等待用户审批，审批前未修改对应运行时。

**进入本轮基线与验收**：进入本轮时 Prompt History 四个测试文件合计 37 通过/4 失败，失败集中于 `PromptHistoryTool` feedback mock 漂移；Playwright 缺 `chromium_headless_shell-1200`，但应用内 Chromium 可进行受控只读 UI 检查；本地 IndexedDB 只有 1 条可显示终态任务，不能代表大库。退出至少要求任务与手动记录的正反链闭合，归档/加载/空态/失败/创建/编辑/置顶/删除/复制/预览/刷新与存储错误有证据，三个已确认行为问题已获批修复或明确阻塞，定向与全仓验证无新增回归，规格/文档同步，性能和视觉结论均有同条件样本。

### 16.2 当前完整正向/反向调用链与状态边界

**入口与加载**：工具箱 manifest `tools/built-in-manifests.tsx:115-124` 将 `prompt-history` 注册为可达的“我的提示词”；registry 在 `tools/registry.tsx:25-31` 动态加载工具模块，再由 `tools/tools/prompt-history/index.tsx:7-47` 懒加载组件并提供撑满窗口的 loading fallback。另一入口为 `PromptHistoryPopover.tsx:214-267`：按当前 generation type 动态取得 registry/window service，传 `initialCategory` 打开同一工具。`PromptHistoryTool.tsx:178-203` 的 React state 拥有分类、Skill、搜索、页游标、加载、选择、预览和 create/edit dialog；`loadPage():226-282` 使用递增 request id 丢弃陈旧返回，UI limit 固定为 30，加载异常记录失败摘要并显示“我的提示词加载失败”。没有 AbortController 或自动重试；刷新按钮/重新筛选重新发起读取，窗口关闭由 F-15 window owner 管理。

**任务/手动记录聚合**：`getPromptHistoryPage():517-573` 先同步读取手动 history，再以 80 条批次反复调用 `getPromptHistoryTaskSummaries`，读取 COMPLETED/FAILED/CANCELLED 轻量摘要；reader `task-storage-reader.ts:596-668` 用 `createdAt` 倒序 cursor，只把 prompt metadata/轻量 result/error 映射到 UI。服务通过 `taskSummaryToPromptHistoryRecord():271-316` 依 category 选择 initial/sent prompt、去除知识正文、推导标题/Skill/标签/结果预览，再应用 edit override。`aggregatePromptHistoryRecords():449-515` 以有效 sent prompt 去重，删除标记过滤，合并 task IDs、source prompts、tags/previews，选择较新的任务状态并按 pinned-first、其余时间倒序；搜索/分类/Skill 在聚合后执行，最后才按 offset/limit 切 UI 页。

**交互、写入与返回**：表格/空态/loading/done 在 `PromptHistoryTool.tsx:668-965` 渲染；复制走 Clipboard API wrapper，媒体预览走 `UnifiedMediaViewer`。创建/编辑 state 在 `:506-615` 收集 title、sent prompt、tags、category、pinned；create 写 general history + override + optional pin，edit 只在无生成结果的手动记录上允许改 sent prompt，否则只改 metadata；pin/delete 进入 prompt storage，而不会删除 task 或媒体结果。存储服务维护 general/image/video history、七类 preset、deleted contents 和 overrides 六个内存域，键由 `LS_KEYS_TO_MIGRATE` 映射到 IndexedDB；`prompt-storage-service.ts:267-313` 异步初始化全部域，`:350-424` 的同步 mutation 先改内存、各域再 fire-and-forget 写 IndexedDB，并通过版本化 change event 刷新 popover/tool 消费者。备份 export 在 `backup-export-service.ts:289-314` 初始化后从内存读取三类 history，但直接从 IndexedDB 重读 preset/deleted/overrides；import merge/replace 写同一 keys 后 reset cache。没有 prompt 数据迁移版本变更或 Cache API 边界。

**归档、恢复、离线与错误**：任务队列超过 `STORAGE_LIMITS.MAX_RETAINED_TASKS=100` 时，`task-queue-service.ts:2498-2535` 从内存移除最旧终态任务并异步将 IndexedDB 记录标为 `archived=true`；当前 prompt service 没传 `includeArchived`，reader 默认 false。页面刷新后手动 history/override/pin/delete 来自 IndexedDB，任务 lineage 来自 task store；本地数据在无网络时仍可聚合，但远端 image/video/audio preview 是否可离线显示取决于 F-13 缓存状态，当前没有充分样本。失败任务在 `buildPromptHistoryResultPreview` 中直接使用 `task.error.message`；当前实测可显示 JSON parser 的技术文本，但仓库没有规定保留诊断细节还是显示安全摘要，因此保持待决策，不改。

**分析、隐私与测试**：打开、搜索、复制、创建、编辑、置顶和删除调用 `trackPromptAction`；`posthog-analytics.ts:346-383` 解构 prompt/requirements 并只提交长度、bucket、行数等摘要，再经 `sanitizeObject` 后 idle capture。永久回归 `posthog-analytics.test.ts:20-56` 注入唯一原文并证明 payload 和 JSON 均不包含它。主要单测为 `prompt-history-service.test.ts`、`PromptHistoryTool.test.tsx`、`PromptHistoryPopover.test.tsx`、prompt storage/task reader/backup tests和本轮 privacy test；正式 E2E/visual/responsive 仍被 Playwright 浏览器缺失阻塞。

### [PROMPT-HISTORY-TEST-001] Tool feedback mock 与生产导入边界漂移

**状态**：已证实测试缺陷，已修复并复验。

**用户影响、复现、当前与预期**：运行时行为不改变；旧测试 mock `tdesign-react.MessagePlugin`，生产组件实际从 `utils/message-plugin` 导入，导致创建/校验反馈断言观察不到调用。进入本轮的四文件簇为 37 通过/4 失败；失败集中在 Tool create/edit feedback。预期测试 mock 实际依赖并等待提交后的异步 reload，从而为反馈和数据刷新提供可信门禁。

**调用链、根因、范围与证据**：test mock → React component import `PromptHistoryTool.tsx:8` → wrapper `MessagePlugin` → create/edit handlers `:549-609` → feedback/reload；mock 在调用链之外，因此断言失败并伴随未等待的 React `act` 告警。修复仅触及 `PromptHistoryTool.test.tsx:36-38,381-416`：mock 当前 wrapper，并 waitFor 第二次 page load。证据强度高（确定性 4 个失败、当前导入和绿灯结果）。不影响运行时、用户数据、存储、分析或视觉。

**方案、替代、风险、验证与回滚**：选择 mock 边界 wrapper，未改组件去迎合测试；备选继续 mock TDesign 会重复漂移，未采用。风险仅为遗漏异步状态更新，现有 `waitFor` 覆盖保存后的 reload。修后原四文件簇 41/41、退出 0；回滚恢复该测试文件，不需要数据清理。

### [PROMPT-HISTORY-ARCHIVE-001] 自动归档任务仍持久化但从提示词历史消失

**状态**：已证实；`preserve-archived-prompts-in-history` 等待审批，运行时未修改。

**用户影响、复现、当前与预期**：用户累计超过 100 个活跃任务后，最旧终态任务被自动归档。确定性静态链和 reader 测试证明：记录仍在 IndexedDB 且 `archived=true`，但提示词历史调用 reader 时没有 `includeArchived:true`，默认过滤该记录。当前行为是旧 prompt lineage 不可见；`backup-restore/spec.md:35-42` 已要求 archived generation history 保留供 prompt history 等视图使用，因此预期是 F-14 消费者读取 archived 终态摘要，同时不让归档任务回到活跃 task queue。

**完整调用链与根因**：任务终态/新任务 → `enforceRetentionLimit():task-queue-service.ts:2498-2535` → `taskStorageWriter.archiveTasks():443-472` → IndexedDB `archived=true` → 工具 `getPromptHistoryPage():530-535` → reader 默认 `includeArchived=false`（`task-storage-reader.ts:596-604`）→ cursor `:634-638` 跳过 → 聚合/UI。反向从缺失记录可唯一追到 prompt reader 的 archive filter；task row 未删除。根因是“活跃队列默认过滤”被 prompt-history consumer 隐式继承，与持久化/备份不变量漂移。影响超过 active retention 的图片、视频、音频、文本、Agent/PPT 终态 lineage；不影响任务数据本身、素材缓存或 active task panel。

**候选方案、替代、风险、验证与回滚**：独立 change 只让 prompt history 明确传 `includeArchived:true`，保留 status/type/offset/limit；不改变 reader 默认值、归档阈值或活跃队列。备选全局改 reader 默认会把 archived 数据带回其他消费者，风险过大；把 archived prompt 复制到另一 store 会重复数据，未采用。风险是大库读取时间和相同 prompt 聚合结果增大。批准后先加 archived included/nonterminal excluded/batch pagination 测试，再做 100/1,000 条真实 IndexedDB 五次对照。回滚恢复单个 consumer option 和测试，无迁移或数据删除。

### [PROMPT-HISTORY-A11Y-001] 创建/编辑遮罩没有 modal dialog 与焦点契约

**状态**：已证实；`improve-prompt-history-dialog-accessibility` 等待审批，运行时未修改。

**用户影响、复现、当前与预期**：应用内 Chromium、本地 `http://127.0.0.1:7200/`、1280×720 与 390×844 各单次受控样本：点击“新建提示词”后 `document.activeElement` 仍是背景按钮；`[role=dialog]` 与 `[aria-modal=true]` 都为 0；按 Escape 后 form 仍为 1；背景控件仍在 accessibility tree。当前键盘/屏幕阅读器用户会在被遮罩内容中移动；预期候选是打开后焦点进入有名称的 modal dialog，Tab/Shift+Tab 留在其中，Escape/取消/遮罩/保存关闭并把焦点还给触发者，视觉和数据语义不变。

**完整调用链与根因**：新建/行编辑按钮 → `handleOpenCreateDialog/handleOpenEditDialog():PromptHistoryTool.tsx:506-543` 只 set state → `:973-1106` 渲染 `role=presentation` mask + 无 dialog/name/modal 属性的 form → 浏览器焦点保持触发者；Escape 无 handler → state 不清。反向从 accessibility tree/form 可追到此唯一嵌套 dialog。根因是组件只实现 pointer/form 展示状态，没有 modal focus/keyboard contract。影响 create/edit 键盘和辅助技术路径；工具箱卡片与 WinBox 本身的 focus 归 F-15/F-28。

**候选方案、替代、风险、验证与回滚**：proposal 约束在当前组件内增加 label、dialog/modal 语义、invoker ref、初始 focus、focus trap、Escape 和安全 focus restore；不换 TDesign/portal、不改视觉和存储。替换整套 dialog 会扩大 z-index/portal/视觉风险，未采用。风险是 disabled/hidden controls、触发者因 reload 消失和 media viewer portal；批准后用 component tests 覆盖 create/edit、正反 Tab、全部 close path、fallback restore，再在两视口复验 accessibility tree 和布局。回滚移除 refs/effect/ARIA/tests，无数据迁移。

### [PROMPT-STORAGE-CONSISTENCY-001] 初始化、内存 mutation 与 IndexedDB/备份之间无一致性边界

**状态**：已证实；`ensure-prompt-storage-write-consistency` 等待审批，存储与备份运行时未修改。

**用户影响、复现、当前与预期**：两个 Node 24.14.0/Vitest 3.2.4、mock kv storage 的单次确定性诊断分别证明数据分叉。A：持有初始 history read，期间调用 `addPromptHistory`，读返回后内存只有旧记录、持久层只有新记录，1/1 诊断通过、59ms。B：持有 override write，内存已解析编辑后 prompt 后立即收集备份，backup `promptHistoryOverrides=[]`，1/1 诊断通过、1,061ms；crypto/localForage stderr 属 Node 环境噪声。临时诊断测试已删除。预期候选是初始化期间接受的 mutation 正确 replay，写入按接受顺序持久化，并让备份/import 在早先写完成或明确失败后继续。

**完整调用链与根因**：bootstrap idle/init、tool/AI input/Chat/prompt optimize 等同步 mutation → `ensureCacheInitialized():prompt-storage-service.ts:350-359` 建 provisional cache → fire-and-forget writers `:365-424` → 尚在 flight 的 `initPromptStorageCache():267-313` 无 shared promise/version，完成后覆盖缓存；另一链为 edit/create → override 内存更新/write pending → backup `collectPromptData():backup-export-service.ts:289-314` 直接重读 IndexedDB → stale payload。import merge/replace也可被更早 pending write 迟到覆盖。根因是 async read/write 与 synchronous API 之间没有 single-flight、mutation replay、写序或 flush contract。影响 general/image/video history、preset pin/delete、deleted contents、overrides和备份/恢复；不改 schema/key 也能发生。

**候选方案、替代、风险、验证与回滚**：change 设计单一 initialization promise、按接受序 replay pre-init mutation、不可变 snapshot 的有序 write chain 和 typed `flushPendingWrites()`；backup export/import 在 prompt boundary await flush，安全报告失败。阻塞整个 workbench 会改变启动可用性，未采用；任意 sleep 不能证明持久化，未采用；只从内存备份会掩盖 reload/import 竞态，未采用。风险是六域 replay 重复、串行写延迟和 failure feedback 隐私；批准后覆盖延迟 read、逆序完成、1/10/100 rapid writes、immediate backup、merge/replace、rejection与原文不泄露。回滚删除 queue/replay/flush/await，现有 key/schema 数据保持可读，不清库。

### [PROMPT-HISTORY-PERF-HYP-001] UI 分页前会扫描并聚合全部终态任务

**状态**：待验证假设；当前纯内存结果不足以构成性能瓶颈，不修改代码。

**怀疑理由、静态证明与受控测量**：`getPromptHistoryPage():517-573` 的 while 循环读取到 `page.hasMore=false`，聚合/筛选后才 `slice(offset, offset+limit)`；所以 UI 的 30 条页不会限制底层总扫描。受控环境为当前源码、Node 24.14.0、Vitest 3.2.4、无网络、mock 80 条分页 reader、0 个手动记录、唯一 prompt 的已完成 image tasks、无 pin/delete/override/search，先 warm-up 2 次，再各 10 次完整内存 mapping+aggregation：100 条原始 `0.621,0.877,0.906,0.946,0.821,0.754,0.665,0.722,0.545,0.547ms`，中位 **0.738ms**、范围 0.545–0.946；1,000 条原始 `7.246,3.903,5.380,10.409,4.144,7.542,10.070,4.382,4.115,6.519ms`，中位 **5.950ms**、范围 3.903–10.409。临时 benchmark 2/2、退出 0，随后删除。

**结论、验证与回滚**：该测量只说明此主机上的内存映射/聚合没有达到明显长任务量级；mock 不包含真实 IndexedDB cursor、archived skip、事务/磁盘、复杂 duplicate previews、UI render 或低端设备，不能外推。浏览器仅有 1 条记录时冷开工具五次 `351,341,362,348,363ms`（中位 351，341–363），热刷新 `315,304,316,316,313ms`（中位 315，304–316），其中还包含浏览器控制和 React。要验证假设需在同浏览器/构建下写入可恢复的 100/1,000 条匿名 fixture，冷/热各至少五次，分别记录 IndexedDB read、聚合、commit、内存并清理 fixture；涉及用户库前必须使用隔离 origin。没有实施，回滚不适用。

### 16.3 规格漂移、视觉/响应式与待决策边界

- **PROMPT-HISTORY-SPEC-DRIFT-001（已证实，未改正式 spec）**：正式 capability 名为“提示词历史”，可达产品名为“我的提示词”（manifest `built-in-manifests.tsx:116-123`）；正式分类只有 image/video/audio/text/Agent（`prompt-history/spec.md:18-23`），实现还含 `ppt-common/ppt-slide`（`PromptHistoryTool.tsx:41-53`）；正式要求 reverse chronological，实现在 `prompt-history-service.ts:510-514` pinned-first 后倒序；正式 spec 未记录手动创建、编辑、删除、置顶。当前行为和测试一致，不能把规格文字直接判定为运行缺陷。应在三个行为 change 获批边界确定后，用独立、无运行时改动的 spec 同步提交完整现状，避免与 pending delta 并行改同一 requirement；OpenSpec CLI 当前不可用，不能声称 strict validation。
- **PROMPT-HISTORY-ERROR-DETAIL-HYP-001（未知/待决策）**：失败 task 当前把 `task.error.message` 原样显示为 preview，浏览器已观察到 `Unexpected token...` 技术文本。没有 prompt-history 错误展示或隐私 requirement 规定保留诊断细节还是安全摘要；验证需以含 provider payload/URL/credential-like token 的受控错误做 DOM/analytics/log 检查并取得产品语义，决策前不改。
- **F-15/F-28 邻接问题**：工具箱“插入”和“窗口打开”纯图标按钮在应用内 Chromium 中没有 accessible name，卡片为不可键盘聚焦的 clickable `div`；这是所有工具共享入口，不混入 F-14。Prompt Tool 内的 row action 已有 aria-label。触控实测为行操作 28×28、顶部 icon 32×32、分类按钮高 28、checkbox 13×13；提高目标会改变全表布局，当前只登记尺寸，不凭审美立项。
- **视觉/响应式实测**：应用内 Chromium 精确版本接口未暴露；本地 `http://127.0.0.1:7200/`，桌面 1280×720、移动 390×844、浅色主题、当前仅 1 条终态任务。移动 WinBox `374×680` 完全位于视口，prompt root `374×365`；table viewport 333px、内部 table 1034px，依赖组件内横向滚动，document width 保持 390、无页面级横溢出；create form 可达。截图为 `docs/evidence/f14-prompt-history/desktop-empty-1280x720.jpg`、`desktop-list-1280x720.jpg`、`mobile-list-390x844.jpg`、`mobile-create-dialog-390x844.jpg`。深色主题没有在当前配置工具栏暴露可操作入口，浏览器控制接口也不能模拟 `prefers-color-scheme`，因此深色视觉为阻塞，不声称通过。

### 16.4 当前验证与退出判断

- 定向测试（Node 24.14.0、Vitest 3.2.4、无外部网络）命令包含 prompt history service/storage/tool/popover 与 analytics privacy：**5/5 文件、42/42 用例通过，退出 0**；其中原 F-14 四文件从 **37 通过/4 失败** 变为 **41/41**，新增隐私回归 **1/1**。Popover 仍输出既有 `act(...)` 环境告警，但断言和退出码不受影响；不把告警直接判定为产品缺陷。两个修改测试文件的定向 ESLint 退出 0；`pnpm nx run drawnix:typecheck` 退出 0。
- 宽验证：`pnpm typecheck` 5/5 项目、退出 0；`pnpm check:cycles` 无静态运行时循环、退出 0。`pnpm test` 退出 1；第一次与 typecheck 并行时额外观察到 1 次 `UserMessageBubble` 5s 超时，顺序复跑未复现，未增加任意 timeout。顺序包级精确统计为 **201 文件：195 通过、5 失败、1 跳过；1608 项：1601 通过、6 失败、1 跳过；另 1 个未处理异常**。Drawnix 为 175 文件 169/5/1、1129 项 1122/6/1、退出 1；react-board 1/1 文件 8/8、utils 25/25 文件 471/471，均退出 0。剩余失败为 PPT settings mock 收集、GPT Blob 环境、Sora duration、3 个 workflow import timeout、cached image conversion；Prompt History 文件全部通过，较 F-08 基线减少其 4 个失败且没有新增 F-14 失败。
- `pnpm build:web` 退出 0：Web 7,931 modules、单次 1m38s，SW 54 modules、1.55s；Sass/CSS、dynamic/static import 和 Browserslist 输出为既有警告。当前 `PromptHistoryTool` chunk 23.78 kB raw/7.50 kB gzip、CSS 12.63/2.36 kB；没有修前同条件值，不作体积改善结论。`pnpm verify:startup` 退出 0，入口 CSS/app/runtime/index 为 14,208/3,776/1,867/345 bytes，chunk cycles 为空。`pnpm size` 退出 1：AI Chat 844.24/140 kB，超过 704.24 kB；Startup App 1.94 kB、Runtime 1.01 kB、Diagram 934.93 kB、Office 269.19 kB、Editor 858.24 kB、Media Viewer 12.19 kB 均在当前预算内。
- `pnpm lint` 退出 1；六个可见 package 汇总分别含 5,401、59、59、3,143、519、1,628 problems，继续混有 package 内 `node_modules`、vendored/public 文件和既有源码错误，分类仍为工具边界噪声与历史债务混合，不能归因于 F-14；本轮两个修改测试文件定向 lint 退出 0。构建脚本更新 `apps/web/public/version.json` 的 buildTime；无 Git 元数据，无法与历史值比较或还原为已知前值。
- 三个 pending change 的 proposal/design/tasks/delta 文件均齐全；人工核查没有同名 requirement 冲突：archive delta 为 1 requirement/3 scenarios，a11y 为 1/3，storage consistency 的 prompt-history 为 2/4、backup-restore 为 1/3。固定 Node PATH 后 `openspec --version` 仍为 command not found、退出 127，不能声称 strict validation。Playwright 1.57.0 仍只安装 revision 1228，而配置所需 `chromium_headless_shell-1200` 缺失；本轮没有新的正式 F-14 自动 spec，smoke/feature/visual/responsive 保持既有 browser-launch 阻塞，应用内 Chromium证据不冒充套件通过。
- 本轮没有性能实现，只有优化前/现状基线，不宣称更快、更小或更省内存；没有视觉修改，因此不存在“修后更美观”结论。浏览器调查后已恢复视口、关闭标签并停止本地 server；没有创建或删除用户提示词。临时 benchmark 已删除，仓库只保留测量值和方法。
- F-14 **尚未达到退出标准**：归档可见性、嵌套弹窗可访问性、prompt storage/backup 一致性三项等待审批；真实 100/1,000 条 IndexedDB 性能、深色主题和正式 Playwright 受隔离数据/浏览器环境阻塞；失败详情语义未知；正式 prompt-history spec 仍需在 pending delta 边界确定后同步。测试 mock 和分析隐私门禁已完成，当前没有依据修改其他运行时。

## 17. F-15 工具箱、工具窗口与画布工具循环

### 17.1 功能边界、规格、基线与验收门

**功能名称与用户场景**：用户从左侧工具箱打开抽屉，搜索或按分类选择一个内置/自定义工具；可以直接插入画布或在一个/多个 WinBox 中打开，随后移动、缩放、分屏、最大化、最小化、恢复、常驻、取消常驻、关闭或从窗口插回画布。URL 工具在 iframe sandbox 内运行，内部工具由 registry 懒加载；需要 `${apiKey}` 的 URL 先进入设置并在配置成功后继续原动作。页面刷新后自定义目录和常驻 launcher 恢复，普通窗口矩形/打开状态只属于当前会话；离线时内置组件和本地目录仍可读，外部 iframe 的可用性取决于目标网络。

**范围与非范围**：范围为工具箱按钮/抽屉、搜索/分类/空态、自定义工具添加删除、API-key 延后动作、registry、窗口服务/RxJS、WinBox wrapper、多实例/launcher、本地持久化、窗口与画布双向转换、iframe 权限、相关埋点、响应式与键盘路径。非范围为各内置工具自身业务（F-16—F-24）、任务/工作流执行（F-10/F-11）、Prompt History 内层 create/edit dialog（F-14）、生成弹窗的 maximized 响应式（F-08）、新增 canvas iframe 错误覆盖层/自动重试、不可达 GitHub custom-tool sync，以及跨标签页工具目录同步。

**正式规格与活动变更**：正式 `toolbox/spec.md:22-59` 约束多实例工具栏、launcher、右键新窗口和默认常驻；`toolbox-plugin-runtime/spec.md:7-40` 约束 iframe/internal 共用打开、最小化、画布嵌入、多实例和默认窗口行为。`refactor-toolbox-plugin-runtime` 的 proposal 仍把 registry/独立工具目录当作未引入前提，但当前 `registry.tsx:10-120` 与正式 spec 已包含该能力；剩余任务不能直接执行。六个独立行为 change 均等待批准：`improve-toolbox-entry-accessibility`（4/14）、`ensure-toolbox-initialization-consistency`（4/17）、`ensure-custom-tool-write-consistency`（3/15）、`remove-deleted-custom-tool-runtime-state`（3/15）、`fix-tool-window-viewport-transition`（当前 7/21，已由 F-17～F-22 追加普通/auto-max工具证据）、`improve-tool-window-accessibility`（当前 6/19，已由 F-17～F-20 追加证据）。审批前只完成证据、提案和无行为死代码清理。

**进入本轮的基线**：全局 typecheck 5/5、cycles 通过；全仓测试/size/lint 和正式 Playwright 已按第 2 节分类为既有失败或环境/工具噪声。本功能唯一现有定向自动回归为 `services/__tests__/tool-window-service.test.ts` 的 4 个默认窗口/常驻用例；没有 `ToolItem`、`ToolWinBoxManager`、`WinBoxWindow`、launcher menu 或 custom-tool storage 的正式组件/服务测试。应用内 Chromium 能提供受控运行证据，但不冒充 Playwright suite。

**本轮验收标准**：正反调用链及存储/权限/恢复边界完整；所有已证实问题拥有独立可回滚 change；无消费者代码清理不改变可达行为；定向 lint/typecheck/test/build 不新增失败；同一窗口在桌面/compact 往返时标题控件可达且用户矩形语义明确；卡片、外层窗口和 launcher menu 的键盘/名称/focus/Escape 契约可自动与浏览器复验；存储初始化、写失败和删除 runtime 协调的诊断转成永久回归。后六项均会改变用户可观察或存储/恢复语义，**需要 OpenSpec 审批**，所以本轮不能标为完成。

### 17.2 完整正向、反向调用链与状态不变量

**入口、加载与目录**：`bottom-actions-section.tsx:125-141` 的有名称 `ToolButton` → `Drawnix.handleToolboxDrawerToggle():493-508` 同时启用 deferred/tool-window runtime 并处理抽屉互斥 → `DrawnixDeferredFeatures.tsx:226-232` 懒渲染 drawer → `ToolboxDrawer.tsx:304-354` 从 `toolboxService` 同步读取、搜索、分类 → `ToolList.tsx:45-72` → `ToolItem.tsx:137-194`。内置目录是 `built-in-manifests.tsx:25-176` 的 12 项，并由 `registry.tsx:10-120` 解析内部组件；自定义目录由 `toolbox-service.ts:24-90` 单例构造时 fire-and-forget 读取 localForage `aitu:custom-tools` version `1.0`，最大 50 项。drawer 的 loading 只覆盖懒 chunk；当前没有自定义目录 readiness/loading/error state。

**卡片动作与 API-key 门**：卡片 pointer click 或显式 window 按钮 → `ToolboxDrawer.handleToolOpenWindow():269-299`；insert 按钮 → `handleToolInsert():190-220`。若 URL 模板需 key，pending action 保存在组件 ref，打开 settings；`ToolboxDrawer.tsx:79-99` 在 settings 关闭后重读 `geminiSettings`，有 key 时 100ms 后继续，无 key 则静默取消。window 路径在 `:225-264` 调用 service、记录 tool ID/name/category/type 而不记录 URL/key，并关闭 drawer；insert 路径在 `:104-184` 用 board container、zoom、viewport origination 和 manifest/default size 计算中心，`ToolTransforms.insertTool()` 后记录同类摘要并关闭 drawer。board 未就绪时只写 console warning；当前入口在 Board 之后可达，尚无反例证明为产品缺陷。

**窗口状态、并发与最终 UI**：`toolWindowService.openTool():325-398` 根据 `supportsMultipleWindows` 或 URL 默认决定 `new/reuse`，应用 manifest/caller/user pin 优先级；`openNewToolInstance():400-442` 创建 UUID instance、级联位置、activation order 和 session-only state → `BehaviorSubject` `notify():841-848` → `ToolWinBoxManager.tsx:71-79` 与 `MinimizedToolsBar.tsx:80-90`。manager 按 activation order 渲染 `WinBoxWindow`，内部组件通过 registry/React.lazy/Suspense，URL 工具通过 `processToolUrl` 后写 iframe `src/title/sandbox`（`ToolWinBoxManager.tsx:335-438`）。service 的 minimize/restore/toggle/position/size/pin 在 `tool-window-service.ts:444-585`；pin IDs/info 与显式偏好分别持久化到 `aitu-pinned-tools`、`aitu-tool-pin-preferences`（`:18-21,133-218,719-743`），窗口 instance/矩形不持久化。多调用可同步进入 service，但 JS 单线程顺序更新 Map；iframe/内部工具各自的网络/任务并发由其功能负责。

**WinBox、视口和工具栏**：`WinBoxWindow.tsx:607-819` 动态 WinBox 实例拥有 close/min/max/focus/move/resize callback，另在 `:823-870` 注入 split/insert controls；Portal 将 React 内容挂到 `.wb-body`。manager 的 `useDeviceType():118-152` 监听 resize/orientation，`getWindowSize():ToolWinBoxManager.tsx:107-128` compact 时请求 `viewport-16 × viewport-60` 上限，wrapper 的默认 minimum 为 400×300（`WinBoxWindow.tsx:148-180`）并在 props 改变时 `resize()`（`:1210-1235`）。toolbar 从 observable 派生每实例图标或 closed launcher；左键打开/切换可见性，右键 menu 触发 pin/unpin、close、new window（`MinimizedToolsBar.tsx:92-172,178-245`）。刷新只恢复 pin launcher，不恢复普通窗口或矩形。

**窗口插回画布与画布反向弹出**：WinBox insert control 取 live DOM rect（`WinBoxWindow.tsx:837-870`）→ manager `handleInsertToCanvas():198-275` 校验 board、先关闭 instance、把屏幕矩形按 board container/origination/zoom 转画布坐标 → `ToolTransforms.insertTool():13-46` → board change/工作区保存链持久化 `PlaitTool`。反向为 Plait plugin `withTool.ts:328-380` → `ToolComponent.ts:48-95` → `ToolGenerator.createForeignObject():191-283` → internal registry 或 iframe；标题“打开为弹窗”在 `tool.generator.ts:397-400,658-700` 先删除 board element再构造 definition/open service。画布 iframe 在 `:540-589` 保存模板 URL、追加 element `toolId`、应用 metadata sandbox，settings change 会重算 template URL（`:52-77`）；destroy 在 `:703-735` 移除 listeners、停止 iframe 和卸载 React roots。

**失败、取消、恢复、离线与隐私**：搜索无结果显示“未找到匹配的工具”；内部组件有 Suspense loading；自定义 add/delete 用 TDesign message 和确认框，storage rejection 进入 error feedback。窗口 close/minimize 是即时 session state，没有重试；iframe 外部网络失败只有浏览器事件/当前画布 loader 文本，正式 spec 没有可见重试 requirement。API-key 设置关闭且未配置等价取消，不发起目标 URL。外部 iframe 的 sandbox 来自 manifest/画布 metadata，默认 `allow-scripts allow-same-origin`；自定义表单明确提示目标 URL 可能泄露 key（`CustomToolDialog.tsx:194-202`）。toolbox analytics 记录动作、tool ID/name/category、自定义标志、搜索长度/结果数和窗口几何，不记录 raw URL/key；目标 iframe 请求本身必然得到处理后的 URL。没有证据证明 analytics payload 泄露 credential。

**反向追踪与不可达边界**：真实工具窗口 DOM 的写入者只有 active `ToolWindowState` → manager → wrapper；toolbar launcher 的写入者只有 pin state/persisted info → `getToolbarTools()`。`PlaitTool` 的生产插入写入者是 drawer 与 manager 两处，反向均回到可见 insert controls。`toolSyncService.syncTools()` 的唯一调用在 `SyncEngine.syncPaged():2463-2537`，而全仓没有 `syncPaged()` caller；当前 `GitHubSyncContext.tsx:330-519` 只调用 `sync()`，所以 GitHub custom-tool sync 不计为可达 F-15 能力或初始化 change 消费者。

### [TOOLBOX-INIT-001] 自定义目录初始化可覆盖已接受 mutation

**状态**：已证实；`ensure-toolbox-initialization-consistency` 等待审批，运行时未修改。

**用户影响、复现、当前与预期**：受控 Node 24.14.0/Vitest 3.2.4/localForage mock 持有构造时 `getItem`，调用并完成 add，再释放旧快照；1/1 诊断通过、退出 0，最后内存查不到新工具而持久快照只有新工具。另一个确定性路径是 persisted custom tool 在 drawer 首次同步 render 时暂时缺失且 service 无完成通知。当前已接受 mutation 可被迟到初始化覆盖；候选预期是 built-ins 立即可用，但需要 custom catalog 的 mutation/launcher 等待唯一 readiness，初始化完成触发 mounted drawer refresh，read failure 不覆写未读数据。

**证据、调用链、根因与范围**：`toolbox-service.ts:34-37` 不保存 initialize promise；`:66-90` 迟到赋值整个数组；`:115-183,233-277` mutation 不等待；drawer `ToolboxDrawer.tsx:304-354` 只有 local refreshKey；launcher `MinimizedToolsBar.tsx:106-112` 同步查目录。完整链为 app import singleton → localForage read pending → add/remove/launcher/drawer → provisional array → old read assignment → UI/内存/持久层分叉。证据强度高（静态时序 + 确定性受控复现）；影响自定义目录、add/remove 和 pinned custom launcher，不影响 built-ins/schema。

**候选方案、替代、风险、验证与回滚**：保留 single-flight readiness/result；异步 persisted mutation 在成功初始化后运行，drawer 完成时 refresh，launcher await 同一 boundary。轮询/isInitialized/增加 100ms 不能证明 I/O 完成；mutation journal/replay扩大冲突规则，未选。风险是慢 IndexedDB 延迟 custom 动作、read failure 改为明确失败；批准后将诊断转 permanent tests，覆盖 read failure/StrictMode/重复 readiness/卸载。回滚移除 readiness/consumer awaits/tests；key/version/schema 不变，无数据清理。

### [TOOLBOX-WRITE-001] 写失败后内存目录仍提交失败动作

**状态**：已证实；`ensure-custom-tool-write-consistency` 等待审批，运行时未修改。

**用户影响、复现、当前与预期**：受控 Node/Vitest mock 让 `setItem` reject；`addCustomTool` reject 后 `getToolById` 仍返回新增项，1/1 诊断通过、退出 0。UI 在 `CustomToolDialog.tsx:129-151` 告知添加失败，但后续同步读取会看到“失败”的工具。预期是 resolved mutation 同时落盘/入内存，rejected mutation 两边都保持最后成功快照，并按接受顺序处理重叠操作。

**证据、调用链、根因与范围**：`toolbox-service.ts:96-109` rethrow 写失败；add/remove/update/clear/import 在 `:146-148,153-160,180-184,233-235,260-275` 先改共享数组。链为 dialog/delete/internal import → mutation → memory commit → localForage reject → caller error → sync getters仍见 changed catalog；后续一次成功写可能把失败动作一起落盘。证据强度高；影响五类 mutation 及后续读取，当前 GitHub import 路径不可达但仍共享同一内部不变量。

**候选方案、替代、风险、验证与回滚**：在 readiness 后使用 ordered mutation chain，从最后 committed immutable snapshot 派生、先 persist 再 commit memory，失败后 queue 可继续。乐观更新再 rollback 会在并发时覆盖后一个操作，未选。风险是慢写串行化；批准后覆盖 1/10/50 项五次延迟、反序完成、duplicate/max checks、失败后成功与 caller feedback。回滚有序 helper/tests 即可，无迁移。

### [TOOLBOX-DELETE-001] 删除 catalog 后残留不可启动窗口/launcher 状态

**状态**：已证实；`remove-deleted-custom-tool-runtime-state` 等待审批，运行时未修改。

**用户影响、复现、当前与预期**：Node 24.14.0/jsdom/Vitest 受控链“add → open → pin → delete → close”后，catalog lookup 为 null、`isPinned(id)` 仍 true、toolbar 仍含 launcher；1/1、退出 0。点击 launcher 在 `MinimizedToolsBar.tsx:106-112` 因定义缺失只 warning。预期候选是 durable delete 后关闭该 ID 全部实例并清除 pin/info/preference，但保留画布序列化元素；cancel/missing/write failure 不清 runtime。

**证据、调用链、根因与范围**：drawer `ToolboxDrawer.tsx:391-427` 只调用 catalog remove；service `toolbox-service.ts:153-163` 不协调 window owner；pin owner/launcher fallback 位于 `tool-window-service.ts:133-218,746-783`。反向从 stale launcher → pinned metadata → catalog delete 可唯一复现。证据强度高；影响 deleted custom tool 的 open/minimized/multi-instance/launcher，本轮不删除 board data。

**候选方案、替代、风险、验证与回滚**：成功持久删除后按 tool ID 原子清全部 runtime/pin state；canvas-derived definition 可开 transient window但不存在 catalog 时不可新 pin。只 unpin 会遗留活跃窗口；删除 canvas 是超出确认文案的破坏性操作；把 URL 存入 pin localStorage 会扩张隐私/schema，均未选。风险是成功删除会关闭未保存 iframe/React 内态，需更新确认文本和测试。回滚 cleanup 调用/API/tests；已删除工具的 pin 状态不会自动复原，但无数据库迁移。

### [TOOLBOX-ENTRY-A11Y-001] 卡片和图标动作缺少键盘/可访问名称

**状态**：已证实；`improve-toolbox-entry-accessibility` 等待审批，运行时未修改。

**用户影响、复现、当前与预期**：应用内 Chromium、本地 dev、浅色、1280×720 单次 accessibility/Tab 样本：可见 tool card 不进入顺序焦点；insert/open buttons name 为空。源码 `ToolItem.tsx:125-144` 只在 plain div onClick 打开，`:153-192` 三类 icon-only button 无 `aria-label`。当前键盘/屏幕阅读器不能发现卡片默认动作和重复按钮目标；候选预期是 card 具 button-equivalent role/name/tab stop 和 Enter/Space，子按钮具包含工具名的名称且不双触发。

**调用链、根因、范围与证据**：ToolList callbacks `ToolList.tsx:59-66` → ToolItem card/actions → drawer API-key/window/insert/delete chain；根因是 hover tip/视觉 clickable 没有建立 DOM keyboard/name contract。证据强度高（源码 + runtime tree）；影响所有内置/自定义卡片，不含外层 WinBox/launcher menu。

**候选方案、替代、风险、验证与回滚**：保留 div 结构，加 role/tabIndex/name 和 native-like Enter keydown/Space keyup，child target guard；按钮加 tool-specific aria-label。整卡改 native button 会非法嵌套现有 buttons，未选。风险是 Tab stops 增多和焦点样式；批准后 component/browser 覆盖 pointer/Enter/Space 单次触发、child isolation、可见 focus、两视口。回滚语义 props/handler/tests，无数据影响。

### [TOOLBOX-VIEWPORT-001] 已打开窗口进入 compact 后标题控件越界且桌面矩形丢失

**状态**：已证实 + 实测；`fix-tool-window-viewport-transition` 等待审批，运行时未修改。

**用户影响、复现、当前与预期**：同一 Prompt History 实例从 1280×720（rect `80,20,1120×680`）直接缩至 390×844，window right `505.89`、close right `493.89`，分别超出 115.89/103.89px；再缩 320×568，window 保持 `x=80,width=400`，close `438..468` 完全不可见；恢复 1280×720 后只剩 `400×508`，没有恢复原矩形。冷开 320×568 控制样本是 `8,30,304×508` 且可达。环境为当前源码、本地 dev、应用内 Chromium exact version 不可得、浅色、Prompt History 已热加载；每个几何状态一次确定性样本，不作时延统计。当前缺陷仅是“已打开窗口的 viewport 转场”，不是普遍移动端冷开溢出；候选预期是 opt-in tool window compact clamp 后标题控件可达、自动布局不覆盖用户矩形、扩展时恢复，compact 手动操作优先。

**调用链、根因、范围与证据**：resize/orientation → `useDeviceType.ts:118-152` → manager `getWindowSize():107-128` 请求 304/374 width → wrapper 默认 `minWidth=400` `WinBoxWindow.tsx:148-180` → size effect `:1210-1235` 重设 minimum/resize → WinBox clamp 回 400；没有同步 clamp x/y，且 onresize `:797-818` → manager `handleResize():157-169` → service state size，污染恢复源。截图：`docs/evidence/f15-toolbox/viewport-transition-390x844.png`、`viewport-transition-320x568.png`，冷开控制 `compact-window-320x568.png`。证据强度高（同实例 live geometry + 控制样本 + 完整代码链）；影响 opt-in 非 minimized/maximized/split tool windows。

**候选方案、替代、风险、验证与回滚**：wrapper 新增只由 manager 启用的 viewport constraint transaction：按 available rect 降有效 minimum、resize+move、抑制自动 callback持久化、保存/恢复 live user rect、rAF 合并；手动拖缩替换 restore candidate。只降 manager minWidth 不解决 x/y、same-breakpoint shrink和state污染；CSS或 remount 会造成几何分叉/丢内容；全局策略跨功能，未选。与 `fix-generation-dialog-maximized-viewport-resize` 共用 wrapper，但通过 non-max tool vs visible+max generation 状态互斥。批准后 fake WinBox tests 与至少五次双向时延/几何、两方向旋转、多实例/隐藏/min/max/split复验。回滚 opt-in prop/transaction/tests，无存储字段或迁移。

### [TOOLBOX-WINDOW-A11Y-001] 外层工具窗口和标题控件没有 dialog/button/focus/Escape 契约

**状态**：已证实；与下一问题共用 `improve-tool-window-accessibility`，等待审批，运行时未修改。

**用户影响、复现、当前与预期**：应用内 Chromium、本地 dev、浅色、1280×720 Prompt History：WinBox root 的 role/name/tabindex 均为空；insert/split/min/max/close 五个可见约 32×32 `SPAN` 均无 role/name/tabindex；打开后焦点不进入窗口，按 Escape 后 `winboxCount=1`。当前键盘与屏幕阅读器无法识别/操作外层窗口 actions；候选预期为 named non-modal dialog、title controls button semantics/name/Enter/Space、打开/恢复的安全 focus entry、未被 nested surface 处理时 active window Escape、close/minimize安全恢复焦点。

**调用链、根因、范围与证据**：service open/restore → manager `ToolWinBoxManager.tsx:335-438` → wrapper constructor `WinBoxWindow.tsx:607-624` → third-party DOM；custom controls `:823-870` 只有 click；`:1127-1208` 只监听 pointer/focus activation，无键盘/escape。反向从 root/control DOM 唯一回到此 wrapper。证据强度高；影响 F-15 opt-in outer window，不扩张到 Prompt History 内层 dialog或其他 WinBox consumers。

**候选方案、替代、风险、验证与回滚**：wrapper 接受 tool-specific a11y labels，创建后装饰 root/visible controls并复用现有 click；只在 focus 位于 active window 且 event 未被 nested surface处理时 Escape，per-instance保存 invoker。patch node_modules/全局 WinBox 会跨功能且脆弱；只加 tabIndex仍无名称/角色，未选。风险是抢内部 autofocus、nested Escape、双实例焦点；批准后 fake/component/browser 覆盖中英名称、one/two instances、所有 close/minimize/restore path及视觉几何。回滚 opt-in decoration/handlers/tests，无数据影响。

### [TOOLBOX-LAUNCHER-MENU-A11Y-001] launcher 上下文动作只有鼠标右键且菜单无语义/焦点

**状态**：已证实；`improve-tool-window-accessibility` 等待审批，运行时未修改。

**用户影响、复现、当前与预期**：同环境右键 named launcher 后 activeElement 为 `BODY`；“常驻工具栏”“关闭”是无 role/tabindex 的 `LI`。`MinimizedToolsBar.tsx:178-241` 的 launcher `ToolButton` 本身已有 name，但 Dropdown `trigger="context-menu"` 没有 keyboard opening。当前键盘用户到达 launcher 后仍不能使用 pin/close/new-window；候选预期是 Shift+F10/ContextMenu key 打开同一选项，menu/menuitem、初始焦点、arrow/Home/End、Enter/Space、Escape/outside close 和 focus restore。

**调用链、根因、范围与证据**：toolbar observable → named ToolButton → pointer-only TDesign Dropdown → `handleContextMenuAction():121-140` → service pin/close/new；根因在 trigger/menu DOM，不在 action service。项目已有 `components/menu/menu.tsx:29-117` 与 `menu-item.tsx:82-93` 的键盘/role primitives。证据强度高；选项可用性与 pointer action保持不变。

**候选方案、替代、风险、验证与回滚**：用项目 Menu/MenuItem 适配 launcher surface，保留 current options/actions/placement theme并增加标准 context keys。直接 patch TDesign DOM或全局 Dropdown跨边界，未选。风险是 popup placement/z-index/样式差异；批准后组件和三视口同状态前后截图/几何验证。回滚 menu adapter/handlers/tests，不修改 pin数据。

### [TOOL-CANVAS-ERROR-STATE-DEAD-001] 画布 iframe 错误状态子系统没有可达消费者

**状态**：已证实事实；已完成无行为清理。

**用户影响、复现、当前与预期**：清理前 `createIframe()` 的 load state/onload/onerror 会在 `createForeignObject()` 返回前被外层 handler覆盖；`tool-load-error` 全仓无 listener，`getLoadState/retryLoad` 无 caller，`ToolErrorOverlay` 无 import。当前真实 UI 只有 loader，load 时移除、error event 时改成“加载失败”；清理预期是完全保持该可达行为，不把旧历史文档宣称的 overlay/retry复活成现有产品功能。

**证据、调用链、根因与范围**：当前唯一行为位于 `tool.generator.ts:191-283`，iframe construction/sandbox 位于 `:540-589`；反向搜索 `ToolErrorOverlay|tool-load-error|detectCorsError|getLoadState|retryLoad` 在生产源码零命中。残留 `.tool-error-overlay` selector 只有 `tool.component.scss` 的全局 import 链，且无 DOM writer，因此一并清理。历史 `specs/008-multifunctional-toolbox/PHASE3_*.md` 已加审计警告；正式 OpenSpec 没有 overlay/retry requirement。证据强度高（所有写入者/调用者反查）；影响只包含无消费者 Map/timeout/events/component/types/CSS bytes。

**实际方案、替代、风险、验证与回滚**：删除 `ToolErrorOverlay.tsx`、`tool-error.types.ts`、未被消费的 load state/API/event/timeout/覆写 handler、`tool-error-overlay.scss` 及 import，保留当前外层 load/error handler。恢复 overlay/retry会新增用户能力，只记候选提案；不实施。风险是遗漏动态字符串 listener/import，已用全仓 `rg` 和 typecheck反查；回滚需从外部备份恢复删除文件/片段，因为无 Git 元数据，不能依赖 history。无用户数据/缓存变化。

### [TOOL-DEEP-LINK-DEAD-001] `useToolFromUrl` 没有生产入口

**状态**：已证实事实；已完成无行为清理。

**用户影响、复现、当前与预期**：删除前全仓只有该 hook 自身声明/注释，无 import/caller；应用内 Chromium 320×568 直接打开 `?tool=prompt-history` 后参数保留且窗口数为 0。真实入口仍是 toolbar/drawer/popover/service；删除预期是不改变任何可达行为，也不把 query deep-link 当成现有能力修复。

**证据、调用链、根因与范围**：生产入口树从 `Drawnix.tsx:301-550,1600-1639` 不引用该 hook，当前全仓反查 `useToolFromUrl` 无生产命中；不存在正向入口或最终 UI writer。证据强度高（静态全仓反查 + direct URL negative control）。已删除 `packages/drawnix/src/hooks/useToolFromUrl.ts`，并从 initialization change 排除。候选 deep-link 若有产品价值需独立 proposal。回滚需从外部备份恢复文件；没有 schema/URL rewrite/用户数据变更。

### 17.3 性能、视觉、假设与规格漂移

**性能现状实测（无优化前后结论）**：当前源码、本地 Vite dev、应用内 Chromium exact version不可得、浅色、1280×720、Prompt History chunk已热加载；每次计时包含浏览器控制和约 300ms 动画，不能外推为 React/render 时间。drawer 点击到打开 5 次原始 `350,314,315,303,316ms`，中位 **315ms**、范围 303–350；Prompt History card 点击到搜索框可见 5 次 `312,316,314,313,302ms`，中位 **313ms**、范围 302–316。采样中一次 Codex Browser Statsig network timeout 属控制环境噪声，不计 Opentu 缺陷。没有实施性能改动或同条件 before/after，不能声称更快、更小或更省内存。

**视觉/响应式现状**：保留 `desktop-drawer-1280x720.png`、`mobile-drawer-390x844.png`、`desktop-window-1280x720.png`、`mobile-window-390x844.png` 及三张 viewport/control截图于 `docs/evidence/f15-toolbox/`。冷开 390/320 compact 无页面级横溢出；已打开窗口转场缺陷见 `TOOLBOX-VIEWPORT-001`。本轮没有视觉样式优化，因此无“更美观”结论；删除的 error CSS没有当前 DOM命中。深色主题、英文标题/菜单长度、高 DPI、reduced motion和 iframe 外网错误正式视觉仍未充分验证。

**[TOOLBOX-INSERT-VIEWPORT-HYP-001]（待验证假设，不修改）**：manager `handleInsertToCanvas():198-275` 在读取 `getViewportOrigination()` 前先 `closeTool()`；类型允许 origination 缺失，此时窗口已关闭且没有插入。现有可达入口通常在 board 初始化后，浏览器样本未复现 origination 缺失，不能判定缺陷。验证需在 board switch/init边界控制 origination 返回、点击 insert并检查 window/board/analytics；若能复现，用户可观察的 close ordering需独立 change或证明是恢复正式 spec行为。

**不可达/候选能力边界**：GitHub tool sync 的代码存在但无用户入口，不能把其 provisional catalog读认定为现有功能问题；未来若接通 `syncPaged()`，必须重新审计加密、冲突、write ordering和用户反馈。canvas iframe 可见 error overlay/retry只有历史文档，没有当前 spec/consumer；记录为候选产品提案，不实施。

**规格/历史漂移**：正式 runtime spec 已描述统一 registry、internal/iframe、多实例/嵌入/默认常驻，故 `refactor-toolbox-plugin-runtime` 的“尚未引入”前提过时，应由用户决定归档或重写剩余任务；不能据旧 proposal重复架构。`specs/008-*` 的 Phase 3 文档曾把已无消费者的 error overlay/retry写成完成能力，现已加审计警告。正式 toolbox Purpose仍是 TBD且产品名/完整目录未覆盖；待六个 pending delta 边界确定后做无运行时行为的 spec同步，避免并行修改同一 capability。

### 17.4 当前改动、验证与退出判断

- **实际运行时代码改动**：删除无生产引用的 `hooks/useToolFromUrl.ts`；删除未接入产品链的 `ToolErrorOverlay.tsx`、`tool-error.types.ts` 及 `tool.generator.ts` 内被覆盖/无消费者的 load state、timeout、detect/retry/event；随后删除孤立 `tool-error-overlay.scss` 及 `tool.component.scss` import。保留当前 iframe loader成功移除/error event文本、registry、window、canvas、sandbox、storage和analytics行为。历史 Phase 3文档只增加审计警告；六个行为 change只写 proposal/design/tasks/delta。
- **定向验证**：`pnpm exec vitest run packages/drawnix/src/services/__tests__/tool-window-service.test.ts` 退出 **0**，1/1 文件、4/4用例通过、2.37s；`pnpm nx run drawnix:typecheck` 退出 **0**，Nx明确报告 project target成功。清理前后 `rg` 反查删除 API/组件/hook；退出 1代表无匹配，不误报命令失败。`pnpm exec eslint packages/drawnix/src/components/tool-element/tool.generator.ts` 退出 **0**，0 errors/4个既有 `any`/non-null warnings。样式尾项删除后的构建/宽验证见后续同节追加结果。
- **OpenSpec 校验**：两个本轮新增 change 均有 proposal/design/tasks/delta；在 F-22 追加auto-max工具场景后，人工校验 `fix-tool-window-viewport-transition` 为 1 ADDED requirement/5 scenarios、7/21，`improve-tool-window-accessibility` 为 1/6，正式/其他活动 spec无同名 requirement。OpenSpec CLI 不可用，strict validate保持退出127工具阻塞；不能声称 CLI validation通过。
- **本轮宽验证（清理后顺序运行）**：`pnpm typecheck` 退出 **0**，5/5 项目通过；`pnpm check:cycles` 退出 **0**；`pnpm build:web` 退出 **0**，Web 转换 7,930 modules、1m43s，SW 转换 54 modules、1.75s，当前 `tool-windows` 为 639.10 kB raw / 197.88 kB gzip。缺少清理前同源码状态、同构建条件样本，所以该体积只登记为现状，**不宣称体积改善**。`pnpm verify:startup` 退出 **0**。`pnpm size` 退出 **1**，AI Chat 844.24/140 kB gzip，仍是已登记预算失败；本轮没有提高预算。`pnpm lint` 退出 **1**，输出仍混入 package 内 `node_modules` 与 vendored 文件，保持既有工具边界噪声分类；修改的 generator 定向 ESLint 仍为退出 0、0 errors/4 warnings。
- **全仓测试对照**：根命令 `pnpm test` 退出 **1**；Drawnix 精确统计为 175 文件：168 通过、6 失败、1 跳过，1129 项：1119 通过、9 失败、1 跳过，另 1 个未处理异常。失败簇仍为 cached image conversion、GPT Blob、Sora duration、PPT mock 与 workflow timeout。该轮额外观察到一次 `UserMessageBubble` timeout，立即按同一文件顺序单独复跑为 1/1 通过、退出 **0**，登记为运行波动，不通过提高 timeout 掩盖。`workflow-engine.test.ts` 单独复跑为 13/15 通过、2 个 5 秒 timeout、退出 **1**；Node 环境同时输出既有 `localStorage`/crypto 初始化噪声。此前顺序基线同文件为 3 个 timeout，且本轮清理不在工作流/聊天调用链，因此没有证据把这些失败归因于 F-15；也不把失败减少表述为修复。
- **环境阻塞**：正式 Playwright配置所需 `chromium_headless_shell-1200`缺失而环境只有其他 revision，smoke/feature/visual/responsive均不能启动；应用内 Chromium证据只作为手工受控样本。无 Git元数据，无法生成可信 diff、核对历史或把删除文件自动恢复；回滚依赖本次文件清单和外部副本。未读取/输出 `.npmrc` credential值。
- **调查环境清理**：完成几何与可访问性取证后已把应用内浏览器恢复并关闭本轮标签，停止本地 Vite server；人工终止 server 的退出码 128 不属于产品测试失败。没有创建、删除或改写用户自定义工具、画布内容或 pin 数据。
- **退出判断**：F-15 **尚未达到退出标准**。无消费者清理和现有 service test/typecheck已完成；但 initialization、durable write、delete runtime、card accessibility、viewport transition、window/launcher accessibility 六项均等待用户审批，相关永久测试/前后性能/前后视觉尚不能实施；正式 Playwright和部分主题/外网状态受环境阻塞。当前没有授权依据继续修改这些运行时语义。

## 18. F-04 画布导航、搜索、选择、锁定与快捷键循环

### 18.1 功能边界、规格、基线与验收门

**功能名称与用户场景**：用户在已有画布中使用鼠标、触控板、触屏或键盘缩放和平移，利用缩放菜单或小地图定位内容；通过快捷键/命令面板查找文本并在匹配项之间前后导航；使用选择、套索、Shift 多选和图层面板定位/锁定元素，随后继续编辑或刷新/切换画板。正常、空画布、无匹配、长查询、大量元素、移动端、触控、键盘、画板替换和多标签页同步均属于范围。

**范围与非范围**：范围为 `ViewNavigation`、`Minimap`、画布搜索、命令面板/快捷键入口、Plait viewport/selection 本地 wrapper、手形/选择/套索、锁定命中规则、图层面板与多选控制点，以及 viewport/元素锁定的现有保存链。非范围为具体图形/文本样式编辑（F-05）、媒体元素专属命中与变换（F-06）、Frame/PPT 编辑器业务（F-25）、项目树 CRUD（F-02）、AI 对选中内容的消费（F-07）以及全应用通用无障碍收口（F-28）；相邻链只验证本功能状态是否正确传递。

**正式规格与活动变更**：当前 `openspec/specs` 没有画布导航、搜索、小地图、套索或通用锁定 capability；搜索现有行为只能由可达 UI、命令注册、源码和测试建立契约。`update-canvas-batch-flow-layout` 只消费 viewport 计算插入布局，不规定导航；`update-ui-color-system` 的 selection requirement 限定素材库；新增 `add-stitch-design-workflow` 明确把核心画布交互排除在该新增能力之外。没有直接活动 change 冲突。搜索漏项和图层派生状态属于恢复入口文字/画板数据已经表达的既有行为，可在红测试后直接修复；触控尺寸、搜索动作名称和小地图键盘导航会改变辅助技术/交互可观察行为，须使用独立 OpenSpec change 并等待审批。

**进入本轮的窄基线**：按各包自己的 Vitest 配置运行，Drawnix `with-hotkey.test.ts` + `selection-utils.test.ts` 为 2/2 文件、29/29 用例通过、退出 0；react-board `board.spec.tsx` 为 1/1 文件、8/8 用例通过、退出 0。一次从仓库根直接混合传入三个路径的命令退出 1：selection test 得到 `document is not defined`、react-board 别名无法解析；随后包级配置复跑全部通过，故该次只登记为**错误测试入口导致的环境/配置失败**，不计产品缺陷。现有 E2E 只覆盖缩放按钮改变百分比、三个缩放视觉状态和不同视口仍可见；没有搜索、minimap keyboard、lasso、lock/board replacement 或多选控制点的正式自动流。正式 Playwright仍受既有 browser executable 缺失阻塞，应用内 Chromium样本不冒充 suite。

**本轮验收标准**：两个连续同名文本必须都被计数，正则特殊字符无异常，Enter/Shift+Enter 循环且 Escape 清理高亮；画板/多标签页内容替换后图层列表和 lock action以当前 `board.children` 为唯一事实源；缩放/平移/小地图/快捷键现有语义无回归；批准后的所有 icon action有名称、小地图有明确键盘导航、compact 触控目标达到 change 约束；窄测试、相关浏览器流、typecheck/lint/cycles/build/全仓基线没有新增失败。性能结论必须至少 5 次同条件前后样本；无视觉改动则明确不适用。

### 18.2 完整正向、反向调用链与状态不变量

**缩放与平移正向链**：始终挂载的 `drawnix.tsx:1755-1756` → `ViewNavigation.tsx:87-131` 的 ±0.1、fit viewport、100%、fit selected/first Frame 与 PPT global → `BoardTransforms` → `board.viewport` → react-board `Wrapper.tsx:87-105` 识别 viewport operation并调用外部 onChange/onViewportChange → App `app.tsx:779-800` 更新最新 snapshot并防抖写当前画板。触控双指由 `with-pinch-zoom-plugin.ts:19-176` 记录两个 pointer、区分平移/捏合并 clamp `MIN_ZOOM/MAX_ZOOM`；滚轮缩放/原生滚动由 `use-board-event.ts:23-76` 把 scroll/ctrl-or-meta wheel转换为 viewport。手形、选择、套索入口来自统一工具栏/更多工具/命令面板和 `with-hotkey.ts:317-410`，最终都写 Plait pointer及 Drawnix appState；空闲/刷新后 pointer保持组件默认，不写 IndexedDB。

**小地图状态与返回链**：父 `ViewNavigation.tsx:59-69,133-223` 拥有展开/手动展开和 100ms viewport轮询/3s自动隐藏；展开时以 `displayMode="always"` 挂载 `Minimap`。子组件 `Minimap.tsx:147-200` 每次读取顶层 `board.children`边界和 viewport；`:408-504,808-820` 展开时立即并每100ms重绘 canvas；pointer down/move `:506-590` 把 minimap坐标映射回画布中心并 `updateViewport`，随后 viewport operation走上述保存链。analytics只记录 `minimap_navigate` 的 click/drag与 displayMode（`:517-521,576-590`），不记录画布文本或坐标；容器另有 `data-track`。父级缩放按钮有 i18n aria-label，minimap toggle当前为中文硬编码名称。

**搜索正向链**：用户在非输入态按 mod+F（`with-hotkey.ts:143-160`），或应用菜单 → 快捷命令 → `command-registry.ts:299-307`“搜索画布内容” → `appState.openCanvasSearch` → `DrawnixDeferredFeatures.tsx:116-117,192-204` 懒加载 `CanvasSearch`。组件在 `canvas-search.tsx:29-55` 递归当前 `board.children`，用 `extractTextFromElement`取得文本；200ms debounce后 `:70-83` 建匹配并写 react-text全局高亮；`:103-148` 以矩形中心调用 `selection-utils.ts:1453-1484` 的 `scrollToPoint`，Enter/Shift+Enter循环，Escape/卸载清高亮。状态只在组件内存；无请求、缓存、重试、持久化或显式analytics，失败获取矩形被静默跳过并保持搜索面板。

**选择、套索、多选与锁定链**：selection/toolbar/hotkey → Plait核心 pointer/hit/selection → `Drawnix.handleSelectionChange():817-845` 读取全部 selected elements、必要时打开 Frame editor并把 ID写入内存 appState供相邻功能消费。套索 `with-lasso-selection.ts:240-374` 在 active SVG绘制临时路径，实时以 AABB/角点/中心/边相交筛选，pointer up通过 `Transforms.addSelectionWithTemporaryElements`提交；Shift合并旧选择，overlay和路径只属于当前手势。多选含 freehand/pen时 `MultiSelectionHandles.tsx:66-183` 用 rAF观察 viewport/selection/children length并展示四角 handle，实际 resize由 `with-multi-resize.ts`处理。图层面板 `LayerPanel.tsx:419-500` 可定位并选择未锁元素，`:532-558` 把 `locked`写回元素；最后注册的 `with-locked-element.ts:7-31` 包裹 `isHit/isRectangleHit/isMovable`，因此被锁元素不能从画布命中/框选/移动。元素属性经 board onChange进入工作区保存，不新增 schema或迁移。

**反向追踪与替换/恢复边界**：最终百分比只来自 live `board.viewport.zoom`；viewport的 UI写入者包含 ViewNavigation、Minimap、Plait scroll/wheel/pinch、图层定位、Frame/PPT定位和搜索滚动，反向都汇入同一 `BoardTransforms`/App viewport保存路径。最终搜索计数的唯一写入者是 `matches.length/currentIndex`，入口只有 mod+F和命令注册。最终 lock命中只读序列化元素的 `locked`；写入入口当前只有图层面板。App切换画板与多标签页 reload分别在 `app.tsx:560-607,647-719` 替换 `value.children`；react-board `Wrapper.tsx:201-246` 保留同一 board实例并直接替换 `board.children`、清 history/selection、更新 list render。普通 selection、搜索查询、小地图展开和多选 overlay不持久化；viewport和 element.locked随画板保存。离线不影响本地导航/搜索/选择；外部同步失败属于 F-02/F-03反馈链。

### [CANVAS-SEARCH-001] 共享全局正则导致连续同名画布文本漏计

**状态**：已证实事实（当前源码 + Node语义控制 + 应用内 Chromium真实画布）；已用红绿测试修复并完成真实页面复验。

**用户影响、复现、当前与预期**：当前源码、本地 Vite、SW关闭、应用内 Chromium、浅色、1280×720，在画布创建两个独立文本元素且内容均为 `needle`；从应用菜单 → 快捷命令 → 搜索画布内容，输入 `needle`并等待既有200ms debounce，面板显示 **`1 / 1`**。DOM反查有两个不同 `foreignObject` 下的 Slate leaf `needle`，所以不是数据未创建。预期是两个可读元素均进入结果并显示 `1 / 2`，Enter可到第二项。独立 Node 24.14.0 控制值 `['needle','needle','prefix needle']` 对同一 `/needle/gi` 依次得到 `true,false,true`，原始 `lastIndex` 为 `6,0,13`。

**证据、调用链、根因与影响范围**：修复前匹配 memo构造一个带 `g` 的 regex，再在 `filter` 对所有文本复用 `regex.test(text)`；ECMAScript全局正则的 `lastIndex` 跨字符串推进，第二个同长字符串从索引6开始而失败。链为两个 Slate文本 → recursive collect → shared global regex → 第二项 false → matches length 1 → UI `1 / 1` → 只导航一个矩形。证据强度高；影响相同查询命中的顺序与文本长度组合，大小写不敏感要求不受影响，特殊字符已经 escape；不影响数据、highlight query或存储。

**实施、替代、风险、验证与回滚**：`canvas-search.tsx:69-79` 已把只用于“是否包含”的正则从 `gi` 改为 `i`；或改用 `toLocaleLowerCase().includes()`会改变正则大小写/Unicode细节，未选；每轮手动重置 `lastIndex=0`可行但易回归，未选。`canvas-search.test.tsx:55-79` 的连续同名红测在修复前失败、修复后通过。真实页面在1280×720、浅色、100%页面缩放下重新输入 `needle` 得到 `1 / 2`，Enter到 `2 / 2`，Shift+Enter回到 `1 / 2`，Escape关闭搜索并清理高亮；随后已清空两项测试画布内容。风险仅为以前漏掉的结果现在出现，属于恢复入口语义；回滚正则 flag与对应测试，不影响数据。

### [CANVAS-SEARCH-STALE-001] 搜索保持打开时同实例 children 替换不刷新匹配结果

**状态**：已证实事实；已用独立红绿测试修复。

**用户影响、复现、当前与预期**：用户打开搜索并得到 `1 / 1` 后，画板切换/多标签页 reload把同一 react-board实例的 children 从一个匹配元素替换为两个匹配元素。受控组件时序保持 `board` identity不变、赋新 children并 rerender；修复前 2 项搜索测试中替换用例失败，UI仍找不到 `1 / 2`，退出1。预期搜索始终反映当前 `board.children`。

**证据、调用链、根因与范围**：App replacement → `Wrapper.tsx:227-245` 保留 board identity并直接赋新 children → `CanvasSearch` rerender → 原 `useMemo([query, board])`不重算 → 旧 matches/count/导航矩形。`canvas-search.test.tsx:81-104` 是同实例确定性复现。影响搜索打开期间的画板/同步替换；普通查询变化会重算，不影响持久化或搜索字符串。

**实施、替代、风险、验证与回滚**：`canvas-search.tsx:69-79` 把当前 children identity提升为实际被 memo消费的 `boardChildren` 快照，与 react-board替换契约对齐，同时不禁用 exhaustive-deps。强制重建整个 board/搜索组件会清空更多 UI状态，未选；删除 memo会在任意父渲染重复遍历，缺少性能依据，未选。修复前定向 1/2通过、1/2失败；修复后2/2通过，F-04簇33/33。风险是 replacement rerender时多一次当前 children遍历，这是取得正确结果所需的既有搜索计算；未声称性能改善。回滚移除该快照依赖和替换用例，无数据迁移。

### [LAYER-STATE-001] 画板/同步替换 children 后图层列表和锁定动作复用旧派生状态

**状态**：已证实事实（完整静态时序 + 当前 react-board replacement测试契约）；已用红绿测试修复并完成真实页面时序复验。

**用户影响、复现、当前与预期**：保持项目抽屉“图层”tab挂载，在浏览器前进/后退切换画板或另一标签页触发当前画板 reload；App传入新的 children，但 LayerPanel的列表 memo依赖仍全部不变，能够继续显示旧元素；即使因后续 operation刷新，`lockedIds.has(id) || element.locked`可显示锁定，而 `toggleLock`只按 `lockedIds.has(id)`决定新值，外部新增的 locked 元素第一次“解锁”会再次写 `locked: true`。预期是每次 render/board replacement均以当前 `board.children`为目录和 lock事实源，用户 action只翻转当前元素值。

**证据、调用链、根因与影响范围**：App replacement `app.tsx:584,705-706` → `Wrapper.tsx:227-245` 保留 board identity、赋新 children/clear selection/listRender.update且不触发 LayerPanel本地 setter → `LayerPanel.tsx:423-430` 的 lockedIds只在首次 mount初始化 → layers useMemo `:445-465`不把 current children identity作为依赖 → toggle `:532-558`读取本地集合而不是 item当前值。`board.spec.tsx:134-199`已确认 value replacement保留组件并清 history/selection。影响图层tab在外部 replacement期间的列表、定位、selection和lock写入；画布渲染本身使用新 children，形成UI/画布分叉。普通本地 setNode会触发 afterChange/refreshKey，不构成同一路径；hiddenIds本来只属session UI，是否跨 replacement清理仍需在测试中确认，不擅自改持久化语义。

**实施、替代、风险、验证与回滚**：`LayerPanel.tsx:420-457,524-540` 删除锁定的重复owner，layers直接从当前 element读取 `locked`、memo观察 `board.children` identity、toggle翻转 `item.locked`并在当前 children重新找 index。强制给整个 Drawnix/Board加 boardId key会重建所有插件/UI状态，扩大F-02/F-03语义，未选；只观察 `board` identity无效。`LayerPanel.test.tsx:102-138`覆盖旧元素消失/新元素出现和外部locked元素一次解锁；纯化红测修复前两项均失败，修复后均通过。真实项目抽屉显示两个当前 `needle`；首项外部锁定时 action class为active，一次点击后立即移除active，随后清画布并确认空态。`hiddenIds`仍是现有session-only显示状态，本轮不改变其持久化语义。回滚组件派生逻辑/测试，无迁移。

### [CANVAS-NAV-A11Y-001] compact导航触控目标与搜索/minimap语义不完整

**状态**：已证实 + 实测；用户可观察交互变更需独立 OpenSpec审批，运行时未修改。

**用户影响、复现、当前与预期**：同一应用内 Chromium切到390×844、浅色、100%页面缩放；缩小、百分比、放大、minimap toggle实测依次为 **28×28、36×28、28×28、24×24px**，而样式注释 `view-navigation.scss:220`声明触控最小44px。展开后实际 minimap canvas为108×72，但 `role/aria-label/tabindex`均为空，不能键盘导航。搜索真实DOM的上一个/下一个/关闭三个 button也都无 accessible name；按钮视觉仅为图标+HoverTip。候选预期需经change明确：compact触控hit area、搜索动作名称、minimap作为可命名二维导航或等价键盘控件、focus/Enter/Space/方向键与不抢占画布快捷键。

**证据、调用链、根因与范围**：CSS `view-navigation.scss:209-356`在768/640/480三层逐步把36/32缩至28/24，和注释/触控验收目标冲突；搜索 `canvas-search.tsx:185-210`未设置aria-label；Minimap `Minimap.tsx:858-914`只绑定pointer/mouse/touch且canvas无语义。入口及最终动作仍走现有 zoom/search/minimap链，故不是不可达代码。证据强度高；影响移动触控、键盘和屏幕阅读器，不改变视觉品牌、viewport算法、search匹配或analytics schema。

**候选方案、替代、风险、验证与回滚**：创建独立 `improve-canvas-navigation-accessibility`，把视觉glyph与不小于change阈值的透明/布局hit area分离；为search buttons添加中英具体名称；为minimap提供已命名、可聚焦的键盘导航与说明，并尊重reduced motion。仅增加title/HoverTip不能形成可访问名称或触控面积，未选；把整个canvas改为普通button不足以表达二维导航，未选。风险为右上角空间、ChatDrawer避让、焦点顺序和方向键冲突；批准后组件+浏览器在1280×720、768、390、320，中文/英文、浅/深、键盘/触控验证并保留同状态截图。回滚a11y props/keyboard adapter/hit-area styles/tests，无数据影响。

### [CANVAS-DOC-001] 小地图 README 描述已移除参数、错误集成点和未测性能结论

**状态**：已证实文档漂移；已同步文档，不改运行时。

**用户/维护影响、静态证明与预期**：维护者按 README 的 `enableInteractionTrigger`、`interactionShowDuration`、`enableContentComplexityTrigger`、`minElementCount`、`contentSpreadThreshold`示例使用组件会遇到当前类型不接受这些字段；文档还声称 Drawnix直接挂载 Minimap、z-index 4030和元素数/分散度触发，而当前可达链为 `drawnix.tsx:1755-1756` → `ViewNavigation` → `Minimap(displayMode=always)`，`MinimapAutoTriggerConfig`只有 `autoHideDelay`，常量为4005。文档把 Canvas和100ms轮询写成“性能优化”，但没有对照测量。预期 README只陈述当前代码和已测结论。

**调用链、修复、风险、验证与回滚**：README使用说明 → 维护者集成 → TypeScript `minimap.types.ts:64-110`/运行时 `Minimap.tsx:217-299`。已在 `components/minimap/README.md`同步产品集成层、唯一auto配置、3秒默认、颜色/z-index、analytics/data-track以及轮询未测状态，并移除不存在的暗色代码片段和未审批的功能清单。替代是保留旧示例并标 deprecated，但源码没有兼容字段，未选。只改文档，无运行时/视觉/数据风险；核对方式是逐项反查当前类型、调用者和事件写入者。回滚README文本即可。

### 18.3 待验证假设、性能与视觉现状

**[CANVAS-MINIMAP-POLL-HYP-001]（待验证假设，不修改）**：ViewNavigation在展开/收起状态都每100ms读取viewport（`ViewNavigation.tsx:168-207`），Minimap展开时另每100ms遍历所有顶层children并重绘（`Minimap.tsx:408-504,808-820`）；MultiSelectionHandles还常驻rAF并JSON stringify viewport/selection（`multi-selection-handles.tsx:118-156`）。代码证明轮询存在，但没有当前CPU/render时长和1/100/1000元素的5次原始样本，不能称为性能瓶颈或擅自改成事件驱动。验证需在同浏览器、同视口、固定元素集合测空闲主线程、render调用/耗时、输入延迟和最小化/展开对照；若改变刷新/自动显示语义，必须先提OpenSpec。

**[GLOBAL-PAGE-ZOOM-BLOCK-HYP-001]（产品语义未知，不修改）**：bootstrap可达的 `prevent-pinch-zoom-service.ts:163-179` 在document范围阻止所有Ctrl/Cmd+wheel默认行为，而react-board只在viewport container处理相同手势；这会影响画布外UI上的浏览器页面缩放，但当前没有正式spec说明应用是否有意锁定page zoom，也未完成浏览器对照/系统辅助缩放验证。任何范围收窄都会改变用户可观察缩放语义，需先测量并请求产品决策。

**视觉/响应式现状**：1280×720桌面导航按钮具名称且缩放/菜单可见；390×844缩放菜单实测边界 `x=247..367.69,y=43..205`，未越出390×844 viewport，focus进入首项，因此当前不登记菜单溢出缺陷。小地图自动展开/3s隐藏与父toggle均可达；本轮尚无视觉改动或前后截图，所以不作“更美观”结论。深色、英文长度、320宽、200%页面缩放、高DPI和reduced motion仍待复验。

### 18.4 实施、验证、OpenSpec与退出判断

**实际改动与根因映射**：`canvas-search.tsx:69-79`分别移除stateful全局regex flag、观察replacement children，解决 `CANVAS-SEARCH-001` 与 `CANVAS-SEARCH-STALE-001`；`LayerPanel.tsx:420-457,524-540`移除lock重复owner并观察当前children，解决 `LAYER-STATE-001`；新增 `canvas-search.test.tsx:55-104`、`LayerPanel.test.tsx:102-138`，以及 `vitest.config.ts:12-18` 的 `@plait-board/react-text` source alias；`components/minimap/README.md`同步当前集成与未测性能事实。没有修改公开API、元素/viewport序列化、缓存、迁移、任务、analytics schema、视觉样式或第三方源码。

**红绿与窄验证（Node 24.14.0、pnpm 11.9.0、Vitest 3.2.4）**：纯化后的首轮红测为2文件/3项全部失败、退出1：连续同名搜索没有`1 / 2`、replacement仍显示old layer、解锁写`{locked:true}`；修复后首轮F-04簇4/4文件、32/32通过、退出0。复审新增search replacement用例，修复前该文件1/2通过/1/2失败、退出1，修复后2/2通过、退出0；最终F-04簇4/4文件、33/33通过、退出0。react-board既有replacement为8/8通过。应用内 Chromium修复后搜索/循环/Escape和LayerPanel一次解锁均通过，测试画布已清空、viewport已reset、调查标签已finalize，7200/7335两个server均停止。

**静态与宽验证**：定向 ESLint退出0、0 errors/15 warnings；warnings为触达文件既有non-null/any/hook与两个未用import信号，本轮不机械扩修。`pnpm nx run drawnix:typecheck`退出0；`pnpm typecheck`退出0（5/5项目）；`pnpm check:cycles`退出0。`pnpm test`退出1；为获得未截断统计又单独复跑Drawnix：177文件中171通过/5失败/1跳过，1133项中1125通过/7失败/1跳过，另1个既有mock未处理异常。失败仍为cached image conversion、GPT Blob环境、Sora duration和workflow import timeout；两个F-04文件通过。与F-15的175文件/1129项相比，新增2文件/4项全部通过；失败数从6文件/9项波动到5文件/7项，不能宣称本轮修复了无关基线。

**构建、预算与lint**：`pnpm build:web`退出0，app转换7930 modules、1m48s，SW转换54 modules、1.68s；Sass、CSS `:export`、dynamic/static import与大chunk为既有警告。当前构建 `ai-chat` 2809.55kB raw/845.59kB gzip、diagram 3122.33/938.38、editor 2588.34/859.62；缺少同源码状态修复前重复样本，不据此宣称体积变化。`pnpm verify:startup`退出0，startup CSS/app/runtime/index分别14208/3776/1867/345 bytes，chunk cycles为空。`pnpm size`退出1，AI Chat 844.24kB gzip超过140kB预算704.24kB，其余列示预算通过；未提高预算。`pnpm lint`退出1，六项目输出仍含5401(1995/3406)、59(12/47，重复汇总一次)、3143(1144/1999)、519(5/514)、1628(722/906) problems，保持扫描包内node_modules、模块边界与既有源码噪声分类；定向lint证明本轮无error。

**正式浏览器与工具阻塞**：相关Playwright命令选择 smoke主画布、visual主画布/缩放/响应式与responsive导航共5项。第一次因配置webServer硬编码`npx`且受控PATH无npx而退出1/127；显式启动7200后复跑到浏览器launch，5/5均在约4–6ms内因缺少`chromium_headless_shell-1200`失败，属于测试环境失败，未执行产品断言。OpenSpec CLI `validate improve-canvas-navigation-accessibility --strict`退出127；人工核查新增change包含proposal/design/tasks/delta，delta为1 operation/1 requirement/6 scenarios，全仓只有该requirement一个命中，现有正式/活动change无直接同名或文件行为冲突。

**性能、视觉与OpenSpec门禁**：本轮正确性修复没有可声称的性能或视觉改善，故无伪造前后数据/截图；构建产物只作现状。100ms双轮询和MultiSelectionHandles rAF仍仅是 `CANVAS-MINIMAP-POLL-HYP-001`，缺少0/100/1000元素至少5次同条件CPU/render样本，未修改。已创建 `improve-canvas-navigation-accessibility`，明确search action名称、minimap二维键盘语义、≤768px的44×44目标与reduced-motion；审批前未改运行时，当前 `CANVAS-NAV-A11Y-001` 保持阻塞。

**回滚与退出判断**：正确性回滚为恢复regex `g`、移除两个children依赖/当前lock派生并删除四项回归用例与测试alias；文档回滚只恢复README；没有用户数据/缓存/迁移操作。F-04 **尚未达到退出标准**：三项已确认正确性问题和文档漂移已解决且宽验证无本轮回归，但已确认的无障碍P2等待用户审批、正式Playwright受浏览器revision阻塞，性能轮询仍未完成足以升级为问题的测量。下一步只能在获批后实施a11y change；审批前可继续调查不依赖该行为决策的下一功能。

## 19. F-05 图形、箭头、自由绘制、画笔、文本、链接、粘贴与样式编辑循环

### 19.1 功能名称、用户场景、范围、规格与验收门

**功能名称与用户场景**：用户从统一左侧工具栏、双击空白画布出现的快捷工具栏或键盘快捷键选择文本、图形、箭头、自由绘制、矢量钢笔、蒙版、橡皮擦等工具；通过单击、拖拽或多锚点手势创建元素，使用 Escape/Enter/Backspace、临时手形和撤销/重做结束或恢复操作；再从选择态 popup toolbar 修改填充、描边、文字、链接、宽高、图层和其他现有属性。用户也可以把普通文本或 Markdown 从剪贴板粘贴为文本或 Card。最终元素与属性进入同一 board operation/history、工作区保存、刷新恢复和多标签页同步链。

**范围与非范围**：范围为可达创建入口、pointer/creation mode 所有者、Plait/Drawnix 创建插件、文本浮层、普通文本/Markdown 粘贴、选择态样式/链接/尺寸/duplicate/delete、undo/redo、取消/完成、保存恢复、键盘/触控/主题/响应式语义。图片/视频/音频的上传、任务生成与素材库插入分别留在 F-06/F-08/F-10/F-13；Frame/PPT、Card 知识库编辑和 TTS 播放引擎分别留在 F-18/F-17/音频循环，但本轮核对 popup toolbar 对这些能力的入口契约，不扩修其内部服务。Mermaid/Markdown 转换弹窗不作为普通手势创建实现重构。

**正式规格与活动 change**：`canvas-markdown-toolbar/spec.md:6-49` 约束 Markdown Card 保存、克隆、合并和知识库 binding 收敛；`canvas-text-to-speech/spec.md:6-36` 与 `canvas-text-to-speech-toolbar/spec.md:6-23` 约束选择文本、Card 局部选区和暂停/继续。没有覆盖普通图形/箭头/自由绘制/尺寸输入/粘贴基础语义的正式 capability。活动 `refactor-hover-tip-unification` 已要求应用视觉 hover 统一使用 `HoverTip/HoverCard`，任务除既有全仓 lint 阻塞外已勾选；`update-ui-color-system` 要求通用状态使用共享 token，其任务已勾选，但仍是未归档 change。两者与 F-05 的 tooltip/color 审计相邻；不能把未记录的尺寸键盘、触控或本地化行为直接混入这两个 change。OpenSpec CLI 当前退出 127，只能人工核查文件。

**进入本轮的窄基线**：固定 Node 24.14.0、pnpm 11.9.0、Vitest 3.2.4、jsdom、无网络，运行 pencil、pen create、freehand hand-mode、hotkey、unified color drag、TTS text extraction、resize utils 和两个 Markdown embed 文件：**9/9 文件、52/52 用例通过，退出 0**。TTS queue 用例因 board mock 缺 `getRectangle` 向 stderr 输出两次位置计算错误，但断言和退出码通过；这是测试噪声，不能直接认定运行缺陷。主/快捷/更多工具栏、文本浮层、paste、link、SizeInput、fill/stroke 和完整 popup toolbar 没有现有专属组件回归。

**本轮验收标准与门禁**：正反调用链覆盖所有状态所有者和保存边界；先以红测证明已确认缺陷；Escape/Enter/blur、pen/freehand完成与取消、paste、undo/redo、正常选择/样式写入没有本轮回归；用户可观察的新键盘名称、触控面积、颜色/布局或本地化要求先进入独立 OpenSpec change 并等待批准。纯粹恢复 `SizeInput` 源码已经表达的 Escape“恢复原值”语义属于现有行为 bug 修复，可直接实施；不改变元素 schema、缓存、迁移、网络、任务或恢复语义。

### 19.2 完整正向、反向调用链与状态不变量

**创建入口与 pointer 链**：`drawnix.tsx:1625-1639` 可达 `UnifiedToolbar`，后者在 `unified-toolbar.tsx:553` 挂载 `CreationToolbar`；配置后的按钮在 `creation-toolbar.tsx:496-514,535-562,665-743` 先调用 `finishPenOnToolSwitch`，再更新 `BoardCreationMode`、`board.pointer` 和 `DrawnixState.pointer`。图形/箭头/freehand 子项分别在 `shape-picker.tsx:84-102`、`arrow-picker.tsx:48-65`、`freehand-panel.tsx:79-108` 同步 board pointer/creation mode；工具选择只属于当前 session，不序列化。空白区域双击由 `drawnix.tsx:1381-1471` 排除 Card、媒体和 interactive foreignObject 后显示 `QuickCreationToolbar`，其 `quick-creation-toolbar.tsx:182-203,400-535` 汇入同一 pointer 和 picker 链。`with-hotkey.ts:143-413` 是键盘反向入口：输入态保护后切换 pen/mask/laser/eraser/freehand、形状、箭头、Frame、手形、选择和 lasso，并把 app state 与 board pointer同步。

**形状/箭头/文本写入链**：`drawnix.tsx:743-776` 的插件顺序从 `withDraw/withGroup/withMind/withCommonPlugin` 进入 hotkey、freehand、pen、resize、pencil、link 和最终 fallback。Plait draw 的 pointer 手势通过 `Transforms.insertNode`/operation 写入 geometry、arrow/text 等公开元素类型；`withDefaultFill.ts:63-96` 在 afterChange 后只为指定基本 geometry 补白色 fill。文本工具另有应用层单击入口：`drawnix.tsx:1526-1545` 把屏幕点转换为 viewBox point并建立 `inlineTextInput`；`1331-1379,1694-1724` 聚焦 contenteditable，非空 blur 用 `DrawTransforms.insertText` 写入，必要时按新元素 ID修正非有限 `textHeight`，然后回到 selection；Escape只取消浮层，不插入文本并保留文本工具。真实页面 1280×720、浅色、100%下已验证：`f05-inline-text` 输入后 Escape 消失且画布无该文本；`f05-committed` blur 后生成唯一可见文本，选择态出现 popup toolbar。

**freehand、pen、pencil、取消和历史链**：`with-freehand-create.ts:17-258` 在 drawing mode 缓存本次 stroke 设置，pointer move采集 viewBox points/pressure并只渲染临时 SVG，普通 pointer up把一个 Freehand node 插入历史；global pointer up当前以 `complete(true)`清理而不插入。`with-freehand-erase.ts:24-170` 收集路径和命中项，pointer up整体删除 Freehand并异步对支持的几何执行 precise erase，对不支持项按当前排除规则删除。`with-pen-create.ts:224-264,298-516` 用 board WeakMap 持有未序列化锚点/预览，Enter或切换工具在至少两个锚点时插入一个 PenPath，Escape取消，Backspace/Delete/mod+Z只退当前锚点；闭合路径选中新元素，开放路径保持 pen。`with-pencil.ts:5-38` 的 WeakMap只决定 pencil mode时哪些 pointer event可下传，mouse drawing被挡而中键/Space手形下传；相关 32 个 hotkey/pen/freehand/pencil断言均通过。完成后的 node operation进入 Plait history，`with-hotkey.ts:416-427` 与 toolbar 的 undo/redo调用 `board.undo/redo`；未完成预览不持久化。

**粘贴与链接链**：`with-common.tsx:13-38` 把 `withTextPastePlugin` 放在图片插件外层；`with-text-paste.ts:69-146` 只接管有 `ClipboardData.text`且无 Plait elements 的纯文本，trim后由 `parseMarkdownToCards`决定插入 Card，否则每行最多50字符的现有规则换行并 `DrawTransforms.insertText`；文件/媒体/复制元素继续委托原 `insertFragment`。真实页面受控写入剪贴板后 Meta+V：`f05 plain paste`生成一个文本元素；`# F05 Paste Card\n\nF05 markdown body`生成 640×124 的 `.card-element`，标题和正文均可见。`buildTextLinkPlugin` 在 `with-text-link.tsx:33-99` 只于 selection/hand、非move/resize/edit状态用 rAF命中 `.plait-board-link`，把 DOM/editor/link node和 hover/edit标志写入 app state；最终 `LinkPopup`/`PopupLinkButton`编辑 Slate link，link state本身不保存，Slate element operation随画板保存。

**选择与样式写入链**：选择后 `PopupToolbar` 在 `popup-toolbar.tsx:330-680` 从唯一 `getSelectedElements(board)`派生 fill/stroke/text/size/merge等可见状态；fill/stroke/font在 `fill-button.tsx`、`stroke-button.tsx`、`font-color-button.tsx` 进入 `transforms/property.ts` 的 Plait Property/Text transforms，尺寸在 `size-input.tsx:31-130,135-279` 从 selection rectangle计算 scale并按元素类型 `Transforms.setNode`，duplicate/delete分别进入 core fragment/remove operation。属性的持久事实源是 board element；popover、lock ratio、临时输入、hover、link popup和toolbar位置是 session UI。操作失败没有网络重试层；本地 transform异常目前多数没有专用用户反馈。离线不影响本地创建和样式，知识库/媒体/AI相邻动作的外部失败属于各自功能循环。

**最终写入与恢复反向链**：最终 SVG/foreignObject/Card/selection toolbar反查到相应 Plait node的唯一当前属性；node operation触发 `Wrapper onChange` → `drawnix.tsx:1594-1600` → `app.tsx:721-770 handleBoardChange`，在 data-ready且非tab-sync时更新 React value、pending revision、最新 board数据，并调用 `WorkspaceService.saveCurrentBoard`；`workspace-service.ts:951-989` 更新 elements/viewport/theme/updatedAt后交给 storage并发出 `boardUpdated`。刷新/切板由 F-02/F-03已建模的 IndexedDB、close snapshot和tab-sync链替换 children；pointer、未完成stroke/pen、inline input、selection和popup不恢复。元素 schema、history grouping和 clipboard element格式由 Plait现有契约持有，本轮不得更改。

### [CANVAS-SIZE-ESC-001] Escape 取消尺寸编辑反而提交缩放

**状态**：已证实事实，已完成红绿修复与当前应用内 Chromium 复审。

**用户影响、复现、修复前行为与预期**：当前源码、本地 Vite、SW开发构建、应用内 Chromium、1280×720、浅色、100%页面缩放；从“形状”选择 Rectangle并拖出一个 **170×100** 矩形，选择态宽高比默认锁定。在宽度输入填 `300`，联动高度显示 `176`，按 Escape；修复前最终输入和选择矩形均为 **300×176**。`size-input.tsx:288-293` 的修复前 Escape 分支明确把宽高恢复为 `selectionRect`并 blur，所以由源码表达的预期是取消草稿并保持170×100，不产生 element operation。

**证据、调用链、根因与影响范围**：width input `onChange` → state `300/176` → `handleKeyDown(Escape)`排队 `setWidth/setHeight(170/100)` → 同步 `input.blur()` → `onBlur={applySize}`仍读取本轮闭包的 `300/176` → `scaleX/scaleY` → `scaleElement` → `Transforms.setNode(points)` → board history/onChange/save → UI 300×176。根因是取消状态更新与 blur提交共享同一处理器而没有区分提交来源；证据强度高。影响所有显示 `SizeInput` 的可缩放选择，lock开关只改变第二维联动，不消除提交；无网络、缓存、迁移或数据格式影响。

**方案、红绿验证、风险与回滚**：最小方案已在 `size-input.tsx:284-309,324-325` 用组件内 `skipNextBlurApplyRef` 区分 Enter/Escape 主动触发的下一次 blur；Enter 显式 `applySize` 一次，Escape 恢复值且跳过 blur apply，普通鼠标/Tab blur 仍提交。只在 Escape 移除 `blur()`会留下焦点和键盘路由变化，未选；把 state setter 改同步不可行，直接把原尺寸传给 `applySize`仍会制造一次无意义 transform，未选。修复前新增 `size-input.test.tsx:95-138`，1 文件 3 项中 Escape 错误写入和 Enter 重复写入两项失败、普通 blur 一项通过；修后同命令 **1/1 文件、3/3 用例通过，退出 0**。真实页面复审以 400×235 矩形输入 300×176：Escape 后仍为 400×235；Enter 后为 300×176；一次 Meta+Z 恢复 400×235，证明没有额外尺寸 operation。无网络、存储格式、缓存或迁移改动。回滚为恢复直接 `onBlur={applySize}`和旧 keydown 分支并删除该测试；无数据回滚。

### [CANVAS-EDIT-A11Y-001] popup尺寸控件缺少可访问名称且交互目标仅18×18

**状态**：已证实 + 实测；用户可观察语义/触控/颜色改动需要独立 OpenSpec审批，运行时未修改。

**用户影响、复现与证据**：同一真实文本/矩形选择态，popup toolbar的两个 `.size-input`、`.size-lock-button`、`.size-preset-button`在 accessibility snapshot中分别表现为两个无名称 textbox和两个无名称 button；DOM确认四者 `aria-label/title`为空。桌面实测输入36×18、lock与preset按钮18×18；`size-input.tsx:301-355` 的视觉 W/H和`HoverTip`不会建立 input/button的accessible name。中文界面另显示硬编码 `Link`，shape/arrow chooser来自 `shape-picker.tsx:28-63`、`arrow-picker.tsx:19-35` 的英文title；这是本地化不一致事实，但没有正式命名要求时不直接改文案。`size-input.scss:16-18,55-112`还使用蓝色 `--color-primary` fallback，而活动 `ui-color-system`要求共享品牌token；是否迁移及视觉对照需纳入批准边界。

**调用链、候选方案、风险与验证**：selection → PopupToolbar `state.hasSizeInput` → SizeInput controls → key/blur/Popover → scale operation；名称缺失不影响鼠标写入，但屏幕阅读器无法区分宽、高、锁定比例与预设。候选 change应为宽高输入建立中英label，为lock/preset使用动态名称和pressed/expanded关系；在触控断点提供不小于批准阈值的hit area而不扩大数值输入视觉glyph；再决定是否把 Link/picker label纳入同一紧密surface及按已批准color token替换focus/active蓝。风险为popup总宽、320/390/768溢出、Tab顺序、Popover焦点和与F-04 44px门禁重复；批准后在桌面/平板/移动、中文/英文、浅/深、200%缩放和键盘/触控下测量并截图。回滚a11y props/样式/token映射，无数据影响。

### [CANVAS-EDIT-TAB-001] 画布热键层无动作仍取消原生 Tab 导航

**状态**：已证实事实（源码控制流 + 特征测试 + 当前应用内 Chromium）；修复会改变键盘可观察行为，已加入 `improve-canvas-editing-toolbar-accessibility`，等待审批且运行时未修改。

**用户影响、复现、当前与候选预期**：本地 Vite、应用内 Chromium、1280×720、浅色、100%页面缩放，把焦点置于画布 BODY 且指针位于 board 后按 Tab，`document.activeElement` 仍为 BODY，无法沿浏览器顺序进入工具栏。确定性 jsdom 特征测试构造无 modifier、可取消的 Tab，结果 `defaultPrevented=true`，pointer/app state 均无写入且旧 `globalKeyDown` 未获委托。当前正式 spec 没有规定该焦点路径，因此候选预期已进入待审批 delta：画布拥有焦点且无文本编辑时，Tab 不被画布热键取消，浏览器把焦点移到 DOM 顺序的下一控件，画布状态零变化。

**证据、完整调用链、根因与影响范围**：document `keydown` → `packages/react-board/src/hooks/use-plugin-event.tsx:82-91` → `board.globalKeyDown` → Drawnix 插件的输入态与 pointer-inside 条件 → `with-hotkey.ts:317-410` 无 modifier 分支。该分支只对已知快捷键执行动作，但对任何其余按键仍无条件 `preventDefault()`并 return；Tab 因而没有画布动作也不能执行浏览器 default action。`with-hotkey.test.ts:310-325` 的特征测试与原有热键簇 **1/1 文件、21/21 用例通过，退出 0**。反向链从停留在 BODY 的最终焦点追至唯一取消者即该无条件分支；Delete 仍由后续 `board.keyDown` 处理，真实页面已证实能删除选中矩形，不能把此事实扩大成所有键盘删除失效。证据强度高；影响指针位于画布时的原生向前 Tab 路径，Shift+Tab 带 modifier 不经过同一分支，尚未证明其目标顺序正确。

**候选方案、替代、风险、验证与回滚**：delta 选择在无 modifier 快捷键分支前识别 Tab 并直接委托/返回，不调用 `preventDefault`，不编程指定焦点；后者会把插件耦合到响应式工具栏挂载和新焦点顺序，未选。风险是暴露应用现有 DOM 顺序中的相邻焦点缺口，以及改变依赖旧取消行为的未知调用者；批准后先把特征断言改为 `defaultPrevented=false`、零状态写入，再在1280/768/390/320、中英、深浅主题记录 Tab/Shift+Tab 实际目标与可访问树。回滚只恢复旧 hotkey 分支并恢复特征测试，不涉及元素、历史、缓存、迁移或持久数据。

### [ERASER-ASYNC-RACE-001] 前一笔精确擦除异步完成会清空下一笔手势

**状态**：已证实事实，已完成确定性红绿修复。

**用户影响、复现、当前与预期**：用户连续快速擦除两个支持精确布尔擦除的非 Freehand 元素，第一笔 `executePreciseErase` 尚未完成时开始第二笔。受控 Promise 测试按第一笔 down/move/up → 保持第一笔 pending → 第二笔 down/move → 释放第一笔 → 第二笔 up 的固定顺序执行；修复前第二笔没有进入精确擦除，调用次数预期 2、实际 1。预期每个已经 pointer up 的手势只消费自己的 path/命中元素，前一笔异步尾部不得更改后一笔状态。

**证据、完整调用链、根因与影响范围**：`board.pointerDown` → `isErasing/elementsToDelete/eraserPath` → `pointerMove`/`throttleRAF`采样 → `pointerUp` → 未等待的异步 `complete` → `findElementsInEraserPath` → `executePreciseErase` → Plait element operation/history/onChange/save。修复前 `complete` 在 `await executePreciseErase` 之后才读取/清空插件闭包中的共享手势状态；第二笔已覆盖这些变量时，第一笔恢复会把第二笔清空，第二笔 pointer up 最终委托基础 handler。`with-freehand-erase.test.ts:119-142` 用两个不同 x 区间和 deferred executor 对调用次数及基础 pointerUp 委托建立确定性证明；证据强度高。影响快速连续的橡皮擦手势，不改变元素 schema、缓存、网络、任务或工作区存储格式。

**方案、替代、风险、验证与回滚**：`with-freehand-erase.ts:61-98` 在 pointer up 进入 `complete` 时同步快照本笔 path 和 element IDs，立即释放共享 `isErasing/elementsToDelete/eraserPath`；随后的删除、精确擦除和 unsupported 检查只读本笔快照。为每笔创建独立 Promise 队列会改变擦除并发/反馈时序且无必要，未选；简单等待前一笔会阻塞下一笔输入，未选。红测 **1/1 文件、0/1 通过、1 失败，退出 1**，实际精确擦除 1 次；修后同一测试 **1/1 文件、1/1 用例通过，退出 0**，精确擦除 2 次且基础 pointerUp 为 0。风险集中在 Freehand 整体删除和 unsupported 删除仍必须使用同一笔命中集合，最终窄簇继续覆盖；回滚为恢复异步函数内共享状态读取/清理并删除测试，无数据迁移或持久记录回滚。

### 19.3 待验证假设、规格漂移、性能与当前退出状态
- **F05-TEST-ISOLATION-001（已证实工具链问题，已修复）**：扩展 `SizeInput` 连续 Escape/Enter → 普通 blur 用例时，后续用例首次 focus 会让上一用例遗留的已挂载 input 触发 blur；红测在 Escape 后预期 0 次写入而观察到前一组件的 1 次 `setNode(300×176)`，调用链为上一测试 `render` → 无 `cleanup` → 下一测试 `focus` → 上一 input blur → 上一 `applySize` mock。它只污染测试调用计数，不是当前应用行为。`size-input.test.tsx:2-3,90-97` 已增加 Testing Library `cleanup` 的 `afterEach`；替代方案在每个用例手工 `unmount` 重复且易漏，未选。修后同文件连续路径 **5/5 通过、退出0**，并在 `144-173` 证明 Escape/Enter 各自的程序化 blur 被消费后，下一次普通 blur 分别产生且只产生一次提交。回滚删除 `cleanup/afterEach` 和两项连续测试即可；不涉及生产源码或数据。
- **DEFAULT-FILL-PATH-HYP-001（待验证假设）**：`with-default-fill.ts:73-94` 在timer前缓存数组path而非element ID，并提前把ID放入processed set；同一宏任务中在目标前插入/删除元素可能让timer检查并写入另一元素。普通人机 pointer事件间timer会先运行，当前没有可达批量创建入口与真实错误结果，不能称缺陷。验证需用同board同步双insert/重排控制证明原元素未填充且不能自愈，再反查该时序是否来自现有用户入口。
- **CANVAS-TTS-SPEC-DRIFT-001（已证实漂移，未改正式spec）**：正式 TTS spec只承诺朗读当前选择/整卡与pause/resume；当前 `text-to-speech-utils.ts:191-229` 会把画布所有Card按位置加入reading queue，现有测试明确断言该行为，`popup-toolbar.tsx:1253-1280`交给共享音乐播放器。首次读出的仍是当前选择，后续是否自动读其他Card取决于播放模式；当前没有change记录这项队列扩展，不能擅自删除或把spec扩成新能力。需先确定这是既有产品语义还是漂移实现，再以独立change同步行为或恢复规格。
- **性能与视觉现状**：本轮尚无可宣称的性能改善。现有创建链的freehand move逐点平滑/重绘、pen rAF预览、eraser rAF+布尔运算和popup position更新均需按0/100/1000元素与短/长笔画至少五次测量后才能升级为瓶颈；不能仅凭loop/rAF优化。当前真实页面矩形170×100、文本、普通paste和640×124 Markdown Card均可见；还未完成深色、英文、320/390/768、200%缩放、reduced-motion和高DPI截图，因此不宣称视觉通过或改善。
- **当前退出判断**：F-05 已完成本轮可无审批执行的正确性修复和窄到宽回归，状态为部分验证而非完成。`CANVAS-SIZE-ESC-001`、`ERASER-ASYNC-RACE-001`与测试隔离均已闭环；`CANVAS-EDIT-A11Y-001`和`CANVAS-EDIT-TAB-001`等待同一独立 change 审批；`DEFAULT-FILL-PATH-HYP-001`、擦除/自由绘制性能仍缺可达证据或五次同条件测量；正式 Playwright、完整响应式/主题/缩放视觉矩阵受浏览器环境和审批边界阻塞。故尚未达到 F-05 功能退出标准，但这些阻塞不妨碍继续调查 F-06。

### 19.4 实际改动、复审与验证记录

**实际改动与根因映射**：`size-input.tsx:284-309,324-325` 用一次性 blur 来源标志修复 Escape 提交和 Enter 双提交；`size-input.test.tsx:90-173` 覆盖取消、显式提交、普通失焦和连续操作，并清理跨用例 DOM；`with-freehand-erase.ts:49-98` 让异步擦除只读手势快照，`with-freehand-erase.test.ts:119-142` 固定两笔并发时序；`with-hotkey.test.ts:310-325` 只描述当前 Tab 吞键事实，生产 `with-hotkey.ts` 未在审批前改变。OpenSpec 新增/更新 `improve-canvas-editing-toolbar-accessibility` 的 proposal/design/tasks/delta，现覆盖名称、状态、本地化、44×44 激活区和原生 Tab 委托；没有改元素 schema、序列化、clipboard、缓存、网络、任务、迁移或工作区持久化格式。

**窄测试、类型与 lint**：初始 9 文件 **52/52**；两项生产修复和 Tab 特征测试、连续输入覆盖后，最终固定 Node 24.14.0、pnpm 11.9.0、Vitest 3.2.4、jsdom、无外部网络运行 11 文件 **59/59 通过，退出0，6.60s**。第一次未显式传 jsdom 的聚合命令为 11 文件中 7 通过/4 失败、42 通过/15 失败，全部失败均为 `document is not defined` 且产品断言未运行，归类为命令环境噪声；加 `--environment jsdom` 后同簇通过。`pnpm nx typecheck drawnix` 退出0；定向 ESLint 退出0、0 error/1 个既有 `selectionRect` hook 依赖 warning，不能仅凭该 warning 扩修。

**真实页面复审与清理**：应用内 Chromium、本地 Vite、1280×720、浅色、100%。尺寸修复复审为 400×235 → 草稿300×176 → Escape仍400×235；Enter提交300×176，一次 Meta+Z 恢复400×235。后续新矩形正常创建并显示尺寸输入；普通文本和 Markdown Card 粘贴可达，刷新后元素仍恢复。Tab 从画布 BODY 后焦点仍在 BODY，与特征测试一致。结束时删除 `f05-committed`、`f05 plain paste`、`F05 Paste Card/F05 markdown body` 和复审矩形，清空选中内容预览与剪贴板，把视图恢复100%，关闭测试页并停止开发服务（会话退出130来自显式 Ctrl+C）。本轮生产修复不改变 CSS 或视觉，所以没有伪造“更美观”的前后截图；已有控件18×18和无名称截图只作为待审批 change 的前证据。

**宽回归**：`pnpm typecheck` 退出0，5/5 projects；`pnpm check:cycles` 退出0、无静态运行时循环。`pnpm test` 退出1：Drawnix汇总179文件中171通过/7失败/1跳过，1140项中1129通过/10失败/1跳过，另1个既有mock未处理异常；react-board 1文件8/8通过，utils使用缓存且没有新失败。剩余簇为 cached image转换、Sora duration、GPT Blob测试环境、5个workflow import timeout、2个chat bubble timeout、PPT settings mock收集和benchmark storage mock；F-05最终11文件均通过，未观察到本轮新增失败。`pnpm build:web`退出0，app 7,930 modules、约2m04s，SW 54 modules、1.97s；Sass/CSS、动态/静态import和大chunk警告保持既有分类。`pnpm verify:startup`退出0，startup CSS/app/runtime/index为14208/3776/1867/345 bytes，chunk cycles为空。

**预算、工具与正式浏览器**：新鲜构建后 `pnpm size`退出1，仅 AI Chat **844.24/140 kB gzip** 超限704.24 kB；Diagram **934.93/950**、Editor **858.24/870**、Office **269.19/300**等列示预算通过。F-05没有同源码修复前构建样本，且改动不以包体为目标，因此只登记现状，不宣称性能改善。`pnpm lint`退出1并再次扫描包内`node_modules`，输出数十万字符、第三方与既有源码债务混合；定向lint是本轮边界证据。相关 Playwright选择smoke主画布、feature主画布、visual主画布、visual/responsive导航共5项，5/5均在4–15ms于browser launch前失败，缺少`chromium_headless_shell-1200`，没有执行产品断言。OpenSpec CLI严格验证退出127；人工核查change为4个必需文件、1个ADDED operation、1个requirement、7个scenarios，同名requirement全仓唯一。

**回滚与剩余风险**：正确性回滚分别恢复 SizeInput直接blur逻辑、擦除共享异步状态并删除对应测试；测试/文档回滚删除特征用例和change目录。无Git元数据，无法自动核对历史、生成可信diff或声称工作树干净，实际恢复需要依据上述文件和外部副本。剩余高可信问题为待审批的编辑控件语义/触控目标与原生Tab路径；TTS队列规格归属未知；性能和视觉结论未满足功能退出门槛。下一步在不依赖这些审批的条件下进入F-06画布媒体与复合元素调查。

## 20. F-06 画布媒体插入、预览、变换与刷新恢复循环

### 20.1 用户场景、边界、规格与验收门禁

**用户场景**：用户把已有图片、视频或音频文件直接放入画布；元素可见、可选择和变换，图片/视频可双击进入预览，图片可编辑或做 3D 视觉旋转；画板保存并刷新后，元素 URL、几何和变换仍恢复。正常、空、加载、单项失败、批次部分失败、取消、重试、刷新恢复和离线缓存均属于本功能的适用场景。

**范围与非范围**：范围只含现有图片/视频/音频的直接画布插入、元素渲染与几何、图片/视频预览、图片编辑保存、3D 变换、Cache API/资产 URL 与 board 序列化。音频播放模式/播放列表留在 F-24；Frame/PPT 留在 F-25；Card 知识库编辑留在 F-23；WorkZone/生成锚点的任务进度和结果插入留在 F-11/F-08。本轮已反查这些相邻元素以确认媒体节点边界，但不把它们并入同一修复。

**规格与活动 change**：正式 `openspec/specs/media-preview/spec.md:5-32` 要求优先海报、海报失败自动降级 `<video>`、成功海报点击后播放；`canvas-audio-playback` 的播放 requirement 不属于本轮。`add-image-3d-rotation-control` 要求取消回滚、确认一次 history、旧元素兼容和 PPT 降级；`update-canvas-batch-flow-layout` 只约束服务/MCP 批量插入布局。新增 `improve-media-preview-accessibility`（0/10）、`improve-media-editor-save-recovery`（0/9）和 `improve-canvas-media-drop-feedback`（0/8）分别改变辅助技术/触控、异步保存恢复和拖放结果反馈，均等待用户批准，审批前没有实施对应运行时代码。

**已知基线与验收标准**：F-05 后全仓 typecheck 5/5、循环检查通过；Drawnix/全仓仍有 cached-image 转换、GPT Blob mock、Sora duration、workflow/chat 超时、PPT settings mock 和 benchmark storage mock 等既有失败簇。F-06 要求三项已确认正确性问题先红后绿；直接插入、预览、变换、保存/刷新正反链闭合；不新增类型、循环、测试、构建、启动或包体预算失败；任何性能/视觉结论必须有同条件前后测量/截图。由于本轮生产代码没有 CSS 变更，也没有修复前同源码性能样本，不得宣称视觉或性能改善。

### 20.2 当前正向/反向调用链、数据与状态所有者

**直接文件插入正向链**：浏览器 `DragEvent.dataTransfer.files: FileList` → Plait `board.drop` → `with-image.tsx:372-412` → `getDroppedMediaFiles` 在 `:54-75` 按 MIME 分类 → 图片进入 `data/image.ts:228-325 insertImage`，视频/音频先在 `with-image.tsx:147-217` 经 `assetStorageService.addAsset` 和必要的 `unifiedCacheService` 元数据/封面写入，再进入 `data/video.ts:195-319 insertVideoFromUrl` 或 `data/audio.ts:414-508 insertAudioFromUrl` → Plait 插入 element/selection operation → `drawnix.tsx:1594-1600` Wrapper `onChange` → `app.tsx:721-770 handleBoardChange` → `workspace-service.ts:951-989 saveCurrentBoard` → IndexedDB。多文件落点由 `with-image.tsx:129-140` 的现有 3 列网格计算；直接拖放不使用 `update-canvas-batch-flow-layout` 的服务/MCP流式布局。

**预览与变换正向链**：画布 `dblclick` → `drawnix.tsx:1403-1443` 命中图片/视频 → `collectCanvasMediaItems/openMediaPreview`（`:1136-1189`）持有本次 item 列表和初始索引 → `UnifiedMediaViewer` portal（`:1726-1740`）→ `useViewerState` 持有单图/对比/缩放/槽位 session 状态 → `MediaViewport` 输出 `<img>/<video>/<audio>`，`ThumbnailQueue.tsx:139-210` 输出可选择缩略图，视频缩略图进入 `VideoPosterPreview`。图片 3D 链为单选 → `popup-toolbar.tsx:2245` → `image-3d-transform-button.tsx:164-275` → `Transforms.setNode(transform3d)`；预览更新使用 `withoutSaving`，确认使用 `withNewBatch`。普通图片渲染在 `plugins/components/image.tsx:264-340` 读取 `transform3d`，几何 `points` 不变。

**编辑保存链**：预览工具栏进入 edit → `UnifiedMediaViewer.tsx:148-184,652-667` → `ImageEditorContent` → `ImageEditorCore` canvas 处理 → `pendingImageUrl` → overwrite/insert callback → `drawnix.tsx:1196-1321` 写 `/__aitu_cache__/image/edited-image-*.png`、解码尺寸并更新/插入 Plait node → 同一 board 保存链。当前编辑 mode、裁剪/滤镜/旋转 history、pending data URL 和预览索引只在内存，不随刷新恢复；已成功写入的 stable URL、元素尺寸/points/`transform3d` 属于 board/Cache 持久事实源。

**反向链与边界**：最终画布图片/视频/音频节点的 URL、points、尺寸和媒体元数据反查到上述三类 data helper 与编辑 handler；最终 `transform3d` 的画布写入者包括 3D panel 和现有 transform helper，F-06 本轮修改只触及 panel 的目标 ID。最终预览 UI 不写持久数据，关闭/Escape 只清 session state。远端 `http(s)`、data/blob URL 不由本地 thumbnail Cache 生成；本地 `/__aitu_cache__/`、`/asset-library/` URL 可加 `thumbnail` 并经 SW channel 生成。离线能否恢复取决于 board IndexedDB 与对应 Cache entry 同时存在；本轮不修改 key、迁移、清理、网络重试、分析 schema 或隐私日志。

### [CANVAS-IMAGE3D-SELECTION-001] 切换选中图片时未确认 3D 预览回滚到错误元素

**状态**：已证实事实；已完成回归测试和最小修复。证据强度高（确定性组件时序、唯一写入 helper 和 current board 断言）。

**用户影响、复现、当前与预期**：在图片 A 打开 3D 面板并把旋转改为 45°但不确认，随后把 popup toolbar selection 切到已有 transform 的图片 B。修复前关闭 effect 使用最新 prop 元素定位，A 的临时预览未正确恢复并会把 A 的 opening transform 写到 B；预期是只恢复开始编辑的 A，B 完全不变且不产生 history batch。`image-3d-transform-button.test.tsx:79-123` 固定 A/B 和 rerender 顺序，直接断言 A 无 transform、B 保留 `{rotateX:12, rotateY:0,perspective:1000}`、`withNewBatch` 为 0。

**调用链、根因与影响范围**：单选 A → `popup-toolbar.tsx:2245` → 面板打开 → slider → `previewTransform` → `Transforms.setNode` → selection prop 变 B → `useEffect(elementId)` → close/restore。根因是 editing start 的 transform 与动态 `element` prop 没有绑定到同一个稳定 ID；影响普通图片 3D 未确认预览的切选/取消，不影响 points、视频、音频、PPT、缓存或 schema。

**方案、替代、风险、验证与回滚**：`image-3d-transform-button.tsx:171-219` 现在同时快照 `activeElementIdRef` 和 start transform，`:178-200,244-267` 的预览、恢复、确认与取消都按该 ID 查当前 path；元素不存在时 helper 安全返回。让父级用 `key=element.id` 强制重挂载仍需可靠 cleanup 且把正确性依赖父级生命周期，未选；把旧 element object 留在 ref 会在 board node replacement 后陈旧，未选。最终该文件 3/3 与 F-06 10 文件 46/46 通过；确认仍仅 1 个 batch。回滚为恢复动态 prop ID 并删除切选回归测试；无数据迁移，但会重新暴露错误元素写入风险。

### [MEDIA-POSTER-FALLBACK-001] 可点击海报探测失败后停留空占位而不降级视频

**状态**：已证实为正式规格回归；已修复并测试。证据强度高（正式 requirement、受控 `Image.onerror` 与最终 DOM）。

**用户影响、复现、当前与预期**：`activateVideoOnClick=true` 的详情/预览场景传入无法作为图片加载的视频或失效海报，触发 poster probe error。修复前该模式把“显示 `<video>`”仅留给点击，失败后可停在 placeholder；正式 `media-preview` 要求海报不可用时自动回退视频。测试 `VideoPosterPreview.test.tsx:48-69` 在未点击时触发 `onerror`，要求立即存在 `video[src=原 URL][controls]`；`:71-95` 同时固定成功海报在用户点击前不切换。

**调用链、根因与范围**：画布双击 → Unified viewer → `ThumbnailQueue.tsx:176-186`/其他可达调用者 → `VideoPosterPreview.tsx:122-146` 选择候选 → probe `onload/onerror` → `scheduleRetry` → poster 或 `<video>`。根因是 poster final-failure 与 deliberate click activation 共用了 `activateVideoOnClick` 门槛，违反“失败自动降级、成功等待点击”的两个不同状态。`VideoPosterPreview.tsx:168-222` 现对无候选或重试耗尽统一 `setShowVideo(true)`；成功仍在 `:274-300` 等待点击。

**方案、替代、风险、验证与回滚**：最小修复只改 final-failure 状态转移；直接取消海报优先会违反正式规格并增加首次视频解码，未选；无限重试会持续占用请求且仍无可见结果，未选。风险是失败时 `<video>` 进入 DOM 较早，但 `preload/controls` 仍由 caller 控制。2/2 回归和 F-06 窄簇通过。回滚恢复旧 final-failure gate 并删除失败降级测试；无持久数据影响。

### [MEDIA-REMOTE-THUMBNAIL-001] 远端签名媒体 URL 被追加 thumbnail 参数

**状态**：已证实事实；先红后绿修复。证据强度高（纯 URL 输入输出、当前 hook 调用链和确定性断言）。

**用户影响、复现、当前与预期**：输入 `https://cdn.example.com/video.mp4?signature=abc123&expires=999999`。修复前红测 2 项中 1 项失败，Expected 为原签名 URL，Received 为追加 `&thumbnail=small`；签名资源请求语义被改变，并使 poster 候选与原视频不同、静态上可进入最多 4 次重试。预期是外部 http(s)、data 和 blob URL 原样返回；只有应用控制的虚拟缓存路径使用 thumbnail 参数。测试 `useThumbnailUrl.test.tsx:25-45` 同时覆盖远端保真与本地 `/__aitu_cache__/...` 仍带 `thumbnail=large`。

**调用链、根因与范围**：`ThumbnailQueue/AssetItem/VideoPosterPreview` → `useThumbnailUrl.ts:281-306` → 修复前无协议边界的 `getThumbnailUrl` → 浏览器/SW请求。根因是把应用虚拟 URL 的 SW 查询参数协议扩展到任意 URL。`useThumbnailUrl.ts:64-99,159-168,219-229,296-303` 现在对 data/blob/http/https 同时跳过 URL 改写和本地缩略图生成，本地虚拟 URL 保持原逻辑。影响所有调用该 hook 的远端图片/视频预览；不改变远端源 URL本身、Cache key、board schema 或 provider路由。

**方案、替代、风险、验证与回滚**：按 `signature/expires` 参数名白名单会漏掉其他供应商签名协议，未选；对所有相对/自有绝对虚拟路径保留既有 SW 处理。风险是普通远端图片不再请求应用缩略图，而直接使用来源资源；这是现有跨域/签名边界，是否增加远端专用代理属于新增能力，未混入。红测原始值如上，绿测 hook 2/2、相关窄簇 46/46。未做五次网络耗时测量，因此不宣称更快。回滚删除 bypass helper/测试会重新破坏签名 URL；无数据迁移。

### [MEDIA-PREVIEW-A11Y-001] 全屏媒体预览缺少 modal/focus/完整控件语义

**状态**：已证实当前 DOM/样式事实；候选行为等待 `improve-media-preview-accessibility` 审批，运行时未修改。实际屏幕阅读器/真实媒体矩阵因样本注入阻塞，发生频率未知。

**用户影响、复现、当前与候选预期**：从画布双击图片/视频后，`UnifiedMediaViewer.tsx:691-742` 把覆盖全屏的 plain `div` portal 到 body，没有 `role=dialog`、`aria-modal`、标题、初始 focus、Tab containment 或 focus restoration。工具栏仍有无名按钮（`ViewerToolbar.tsx:213-219,241-246,275-281`），viewport方向/插入/下载/编辑按钮无名称（`MediaViewport.tsx:798-836,943-1011`），缩略图 `role=button` 无 item/当前/槽位名称状态（`ThumbnailQueue.tsx:153-170`）。CSS 在窄屏仍有 26–28px 控件并含 smooth scroll/transition，但无 reduced-motion 分支（`MediaViewport.scss:415-481`、`ThumbnailQueue.scss:25,56`、`UnifiedMediaViewer.scss:18`）。候选预期是已有动作可由键盘、触控和辅助技术识别/操作，不增加媒体功能。

**调用链、根因与范围**：invoker focus → 画布 dblclick/其他 preview caller → viewer portal → toolbar/viewport/thumbnail → close → 当前 focus 由浏览器自行决定。根因是视觉 modal 与键盘/辅助技术状态机从未建立，Hover 文本也未成为控件独立名称。影响所有 UnifiedMediaViewer 调用者；不影响 URL、解码、编辑结果、缓存或 board。

**方案、替代、风险、验证与回滚**：change 选择 labelled modal、稳定初始 focus、Tab/Shift+Tab 圈定、Escape 与 return focus、localized name/state、批准阈值触控目标和 reduced-motion；视觉 hover 必须复用 `HoverTip/HoverCard`。只增加 `title` 无法建立 modal/focus/state 且违反共享 hover 规范，未选；引入新的 focus/tooltip 库无必要。风险是隐藏控件进入 tab order、320–390px toolbar 溢出和中英文宽度变化。批准后需组件红绿测试和 1280/768/390/320、中英、深浅、200%缩放、reduced-motion 的同状态截图/可访问树。回滚只移除语义/focus helper/样式/i18n与测试，无数据影响。

### [MEDIA-EDITOR-SAVE-RECOVERY-001] 异步覆盖/插入失败前编辑态已被清空

**状态**：已证实静态控制流；等待 `improve-media-editor-save-recovery` 审批，运行时未修改。证据强度高（callback 类型、调用顺序和唯一 pending state owner），实际 Cache/board 失败频率未知。

**用户影响、复现、当前与候选预期**：编辑图片后选择覆盖或插入，并让 Cache 写入、图片解码或 board 操作 reject。当前 callback 类型为 void（`media-preview/types.ts:71-74`、`ImageEditorContent.tsx:15-24`）；`ImageEditorCore.tsx:720-745` 调用 callback 后同步清 `pendingImageUrl`、关选项并 close；`UnifiedMediaViewer.tsx:502-517` 又同步 `handleBackToPreview`。实际 handlers 在 `drawnix.tsx:1196-1321` 执行多个 await，但 catch 后只显示错误且不向上抛。结果是失败消息出现时可重试的编辑产物和 edit state 已丢失；候选预期是成功后退出，失败保留产物/编辑态并禁止重复提交。

**调用链、根因与范围**：save toolbar → editor canvas `toDataURL` → `pendingImageUrl` → overwrite/insert → viewer wrapper → Drawnix Cache/decode/Transforms → board save/错误消息。根因是跨四层的异步 persistence 被 void contract 截断，内层和外层均把“已调用”当成“已成功”。影响内置图片编辑覆盖/插入；下载动作、原图预览、缓存 key、几何算法和 schema 不属于此根因。

**方案、替代、风险、验证与回滚**：change 要求 callback 可等待、Drawnix 在保留现有错误提示后 rethrow、单一 in-flight 状态、fulfilled 后才 clear/back，rejected 后可重试/取消。仅延迟 `handleBackToPreview` 而仍由 core 清 pending 不足以恢复；把 edited data URL 另存新恢复库会扩大数据格式和隐私面，未选。风险是 viewer unmount 后 setState、同步 caller兼容和 Cache成功/board失败留下无引用对象；不自动删除用户媒体。批准后覆盖覆盖/插入成功、Cache失败、decode/board失败、双击、pending中关闭/取消和刷新。回滚恢复 void callbacks和立即退出，无迁移；已写 Cache对象保持可用。

### [CANVAS-MEDIA-DROP-FEEDBACK-001] 直接多媒体拖放失败仅写 console 且批次结果不可见

**状态**：已证实静态行为；等待 `improve-canvas-media-drop-feedback` 审批，运行时未修改。证据强度高（所有 per-file catch、返回值和 UI writer 反查）；浏览器真实 drop 因文件注入能力阻塞。

**用户影响、复现、当前与候选预期**：一次拖入多个支持/不支持文件，使一个或全部支持文件在资产写入或插入时失败。`with-image.tsx:54-75` 静默排除不支持文件；`:219-262` 每文件 catch 后只 `console.error` 并继续，最终无结果返回；`:372-390` 一旦有支持文件即同步 `return true`。因此成功、部分失败、全失败和不支持数量均没有用户反馈，成功项仍保留。候选预期是批次 settle 后一次本地化汇总，部分成功不回滚，不声称失败项已插入。

**调用链、根因与范围**：DOM drop → board plugin → MIME分类 → 逐文件 asset/cache/data helper → per-file catch → viewport restore → 无 UI writer。反向搜索该错误前缀和函数返回者，没有 Message/状态消费者。根因是 orchestration 返回 `Promise<void>` 且吞掉单项结果，顶层 handled boolean只代表接管事件而非插入成功。影响用户直接拖放图片/视频/音频；URL拖入、粘贴、素材库插入以及服务/MCP批量流式布局不在本 change。

**方案、替代、风险、验证与回滚**：change 选择每项 success/failure、unsupported计数，批后显示一次 summary，保留成功项和既有 viewport anchor；全批事务回滚会删除已成功用户数据且没有恢复策略，未选；逐文件 toast会产生噪声且顺序不稳定，未选。风险是错误详情泄露文件名/URL，故用户消息只给安全计数、详细异常留诊断且不得记录 token/内容。批准后确定性覆盖全成功/部分/全失败/混合不支持、三媒体和刷新恢复。回滚恢复 void loop/无汇总并删除测试；不迁移或清理资产。

### 20.3 验证、性能/视觉证据、OpenSpec 与退出判断

**窄测试与类型**：最终命令 `pnpm --dir packages/drawnix test <10 个 F-06 文件>` 在 Node 24.14.0、pnpm 11.9.0、Vitest 3.2.4、jsdom、无外部网络下退出 0，**10/10 文件、46/46 测试通过，6.22s**；其中 3D 3/3、poster 2/2、thumbnail 2/2。`pnpm nx typecheck drawnix` 退出 0；先前 `pnpm typecheck` 退出 0、5/5 projects；`pnpm check:cycles` 退出 0。定向 ESLint 复跑退出 1，只剩 `useThumbnailUrl.ts:9` 的既有 Nx lazy-library 全局规则 error 与 `VideoPosterPreview.tsx:259` 的既有 ref-cleanup warning；本轮新测试非空断言已改为显式失败分支且不再告警。

**宽回归**：F-06 修复后首次 `pnpm test` 退出 1：182 文件中 174 通过/7失败/1跳过，1147 项中1136通过/10失败/1跳过，1个未处理异常；相对 F-05 增加的3文件/7测试全部通过，失败簇未增加。随后一次因多余 `--` 误启动的 Drawnix全套真实结果为退出1：182文件176通过/5失败/1跳过，1147项1139通过/7失败/1跳过、1异常；差值来自workflow/chat定时用例本次少失败，不能当作产品修复。稳定失败仍属于 cached image、GPT Blob mock、Sora duration、workflow timeout、PPT settings mock和benchmark storage mock。

**生产构建与预算**：默认 PATH 的首次 `pnpm build:web` 退出1且在 `node scripts/update-version.js` 前后边界报 `node: command not found`，归类为环境失败；使用桌面已配置的 Node 路径后同命令退出0，app **7,930 modules、1m39s**，SW **54 modules、1.67s**。构建更新了 `apps/web/public/version.json` 的 buildTime；无Git元数据无法对历史值。`pnpm verify:startup` 退出0：CSS/app/runtime/index 为 **14,208/3,776/1,867/345 B**，chunk cycles为空。`pnpm size` 退出1：AI Chat **844.2/140 kB gzip** 仍超 **704.2 kB**；Diagram **934.93/950**、Editor **858.24/870**、Office **269.19/300**、F-06 Media Viewer **12.19/20 kB** 均在预算内。

**性能与视觉**：三项生产修复恢复目标元素、URL和fallback状态，不以性能为目标；没有修复前同源码的冷/热启动、网络或渲染至少5次样本，因此不宣称更快/更省内存。远端 URL 修复静态上取消了错误候选进入最多四次 poster retry 的条件，但没有延迟实测。生产 CSS 未修改，故没有“更美观”的前后截图。应用内 Chromium只确认 `http://localhost:7200` 在1280×720、浅色、100%下可加载；该唯一画板只有既有 Card、素材库0项，控制工具不能向原生 file chooser 注入文件，二进制剪贴板也未进入媒体路径，所以没有媒体插入、预览或刷新恢复截图。结束时未删除/修改该Card，剪贴板恢复空文本，标签关闭，开发服务显式Ctrl+C退出130。

**OpenSpec核查**：三个新增 change 文件分别为4/4/3个必需文件，各1个 `ADDED` operation，合计5个唯一 requirement、11个 scenario；与 `refactor-hover-tip-unification` 和 `update-canvas-batch-flow-layout` 的目录/capability重叠已在proposal中明确分界。`command -v openspec` 退出1，无法运行 `validate --strict`，只能声明人工结构校验，不能宣称CLI验证通过。

**回滚与退出判断**：生产回滚分别恢复3D panel使用动态 selection ID、poster失败旧门槛和远端 URL统一追加thumbnail，并删除对应回归测试；测试质量回滚只恢复非空断言，没有运行时影响。无Git元数据，无法自动生成可信diff或证明工作树干净，实际回滚需按上述文件/行和外部副本执行。F-06目前为**部分验证，未达到退出标准**：三项正确性缺陷已闭环，类型/循环/构建/启动和F-06包体无新增失败；但三个用户可观察change待审批，真实媒体正常/失败/部分失败/取消/重试/离线/刷新以及桌面/移动/深浅/键盘/触控矩阵缺浏览器文件样本能力。上述阻塞不妨碍进入不依赖它们的下一个功能循环。

## 21. F-11 工作流解析、执行、恢复与 UI 同步循环

### 21.1 循环入口、边界与审批判断

**功能与用户场景**：用户从 AI 输入栏提交一个已有生成/Agent/Skill 意图，看到输入解析、初始及动态步骤、主线程执行或队列任务、后处理、Chat/WorkZone/画布结果；失败后能重试，刷新后能从已有记录恢复且不会重复请求或干扰另一个正在运行的工作流。

**范围**：`AIInputBar` 的 workflow 创建与步骤循环、`useWorkflowSubmission` 的 UI handoff、WorkflowContext、Chat workflow message、WorkZone、task-to-workflow linking/sync、任务快照与事件、兼容 `workflowSubmissionService`/`MainThreadWorkflowEngine` 恢复。**非范围**：F-10 的任务调度/并发/外部取消终态；F-12 的普通 Chat 会话、消息计数和模型请求；F-08 的独立生成弹窗；F-16—F-20 的领域工具状态机；F-03 的完整备份/GitHub 同步语义。相邻系统只追踪写入/恢复边界，不在本轮混改。

**规格与活动变更**：正式 `ai-input-generation`、`agent-image-understanding`、`image-generation-feedback`；已完成的 `refactor-workflow-shell` 只覆盖三个内置工具壳，`refactor-ai-json-response-parser` 已落地；`refactor-sw-duplex-comm` 仍以 SW 创建/执行 task 和广播 Chat workflow 为前提，与当前源码冲突，不能作为实施依据；取消归等待审批的 `fix-task-queue-external-cancellation`。本轮新增 `fix-main-thread-workflow-recovery-sync`：5 个 requirements、8 个 scenarios、3/15 tasks 完成，OpenSpec CLI 不可用，仅人工核查，运行时任务等待用户批准。

**已知基线与本轮验收**：F-06 后 typecheck 5/5、循环检查和生产构建通过；全仓仍有 cached-image、GPT Blob mock、Sora duration、workflow/chat timing、PPT settings、benchmark storage 等既有失败簇；AI Chat size-limit 仍超预算。本轮要求新提交/恢复 owner 有双向静态证据，窄测试无超时且不加载无关 IndexedDB/config 副作用，不新增类型、lint、测试、循环、构建、启动或预算失败；刷新 task 恢复、双 workflow 乱序、每目标单次投影和 Chat 终态必须在审批后先红后绿。生产 CSS 未改且没有同条件前后样本，不作性能或视觉改善结论。

### 21.2 事实模型、完整调用链与状态边界

**正向链（新 AIInputBar 提交）**：底部输入栏提交 → `AIInputBar.tsx:3202-3324` 的 `parseAIInput` 与 `convertToWorkflow/convertSkillFlowToWorkflow` → `AIInputBar.tsx:3658-3665` 调用 `useWorkflowSubmission.submitWorkflow` → `useWorkflowSubmission.ts:459-528` 以同一 `WorkflowDefinition` 写入单槽 WorkflowContext、持久化 Chat workflow message 并固定返回 `usedSW:false` → `AIInputBar.tsx:3900-4075` 顺序调用 `mcpRegistry.executeTool` 执行初始和动态步骤。同步工具直接返回并更新步骤；队列工具返回 `taskId`，步骤保持 running（`AIInputBar.tsx:3938-3949`），后续由主线程 TaskQueue、media executor/供应商路由、`aitu-app/tasks` 和 RxJS TaskEvent 驱动。TaskEvent、后处理事件和自动插入最终投影到 WorkflowContext、Chat message、WorkZone、图片锚点、画布与素材缓存。`workflowSubmissionService.submit():510-525` 全仓生产搜索无调用者，因此新链不进入 `MainThreadWorkflowEngine`，也不写 `aitu-app/workflows`。

**正向链（兼容 engine）**：显式 service submit/恢复入口 → `workflowSubmissionService.tryFallbackEngine` → `MainThreadWorkflowEngine.submitWorkflow/resumeWorkflow` → `workflowStorageWriter` 写 `aitu-app/workflows`（`workflow-engine/engine.ts:57-79,118-159`；`workflow-storage-writer.ts:40-61`）→ fallback executor → service events → `useWorkflowSubmission`/DeferredRuntime/WorkZone。该链是 legacy owner，不能与 task-backed 新链等同。

**反向链**：最终画布结果/素材记录 ← 自动插入和后处理 ← task terminal event/result ← task storage writer/executor ← 队列 MCP ← workflow step；最终 WorkZone workflow ← `AIInputBar`、`useTaskWorkflowSync`、DeferredRuntime 和 fallback workflow event 的写入者；最终 Chat workflow ← `sendWorkflowMessage` 创建与 `updateWorkflowMessage`/task fallback 更新；最终 WorkflowContext ← AIInputBar start/update、recovered event、WorkZone fallback restore。刷新后的事实分散在 `tasks`、Chat message、board/WorkZone；只有 legacy engine 在 `workflows` store 有记录。GitHub workflow 同步读取 legacy store，因而不是新 AIInputBar workflow 的完整恢复源。

**类型、转换和状态所有者**：输入为 `ParsedGenerationParams`、reference media、可选 `WorkflowRetryContext` 和可选既有 `WorkflowDefinition`；converter 固化 model/modelRef、count/size/duration、selection、knowledge refs、batch metadata 和 pending steps；submit 返回 `{workflowId, usedSW}`。运行态核心为 `WorkflowDefinition`，持久 UI 投影为 `WorkflowMessageData`，外部任务为含 `workflowId/batchIndex/taskId/result/error/status` 的 `Task`。WorkflowContext 只持有一个 active workflow；Chat storage 持有消息和 workflow 投影；board 持有 WorkZone；TaskQueue/IndexedDB task store 持有队列事实；legacy engine 内存 Map/workflows store 持有兼容事实。步骤状态为 pending/running/completed/failed/skipped，legacy 类型另含 `pending_main_thread`；task 状态映射到上述步骤状态。

**默认值、副作用和并发**：未显式模型/参数由 parser 与全局/作用域偏好填充；submit UI handoff 失败时仍继续主线程执行；同步步骤按数组顺序运行，`ai_analyze` 可追加动态步骤；队列步骤在 `taskId` 返回后异步完成。输入在 handoff 后清空；提交锁在 `AIInputBar.tsx:3699-3706,3741-3748` 一秒后释放，所以旧队列任务与新 workflow 同时存在是源码允许的状态。副作用包括 Chat/board/IndexedDB 写、供应商请求、RxJS 事件、画布插入、提示词历史和分析事件。取消/超时/重试由 workflow、task、供应商多层分别处理，当前不具备单一原子事务。

**持久化、缓存、刷新、离线、错误与隐私**：task store 保存远端恢复所需 task 快照；Chat 与 board 保存 UI 投影；legacy workflow store 由 engine 写。没有跨三者的 crash-atomic transaction，恢复必须幂等且按 owner 对账。工作流本身不定义额外 Cache API key；媒体结果缓存/失效归 F-06/F-13。离线只能恢复已持久化状态和本地资源，不能完成需要供应商网络的步骤；当前没有证据证明页面关闭后仍有 SW workflow executor。同步失败通过 step error、Chat status 和 WorkZone error 传播；日志/埋点会记录 workflow/task ID、类型和时序，当前阅读未发现本轮新增敏感 payload 输出，但未做独立隐私运行采样。任务取消、超时和重试的完整终态仍受 F-10 change 门禁。

**场景覆盖现状**：正常同步转换/engine/状态映射已有单测；空输入和输入 loading 属 F-07；同步失败、队列失败和 bubble terminal 有局部测试；取消由 F-10 负责且本轮无可达 `cancelWorkflow` UI 调用；重试入口存在于 Chat/WorkZone，但 task-backed 刷新后重试尚无完整恢复测试；刷新恢复 owner 当前存在已确认缺陷；离线只有持久化静态证明，无受控浏览器验证；多 workflow 乱序没有现有测试。桌面/平板/移动、深浅主题、键盘/焦点、慢网络和视觉状态在本轮没有新截图证据。

### 21.3 问题证据与决策

#### [WORKFLOW-RECOVERY-OWNER-001]

**状态**：已证实；高强度当前源码静态证明，运行时修复待 OpenSpec 审批。**用户影响/范围**：刷新超过 60 秒且仍有 pending/running step 的新 AIInputBar WorkZone，即使 task store 仍有可恢复任务，也可被标成“工作流已丢失”或“恢复工作流失败”；影响 task-backed 新工作流的刷新恢复，不证明所有实例必现。**复现/当前与预期**：构造新链产生的 WorkZone 与 task 快照，令 `createdAt` 超过 60 秒后刷新；当前 `WorkZoneContent.tsx:64-105` 进入 claim，SW initialized 时在 `:137-181` 调用未定义的 `claimWorkflow` 并由 `:225-226` 标失败，未 initialized 时由 `:145-177` 查询仅覆盖 legacy store 的 fallback 后可标丢失。预期是 task storage ready 后先对账 task snapshot，只有兼容 workflow-store 记录才交给 engine，且不得重复 provider 请求。**调用链/根因**：board WorkZone → WorkZoneContent claim → 不存在的 SW RPC或 legacy service/store → failure callback → board 状态；与此同时真实恢复数据位于 task store。`claimedWorkflows` 是永不 delete 的模块级 Set（`:32-33,95-105`），首次失败后同页不再尝试。根因是 owner 从 SW/engine 迁到 AIInputBar+TaskQueue 后恢复边界未迁移。**方案/替代/风险**：批准 change 后按 task-linked/legacy-owner 分类并等待 task storage ready；保留确有 workflow-store 记录的 engine fallback。给 SW 新增 claim 被否决，因为会恢复已过时的执行边界；启发式把无 metadata task 绑定到 WorkZone 被否决，因可串任务。风险是恢复顺序和旧记录兼容，需幂等对账测试。**验证/回滚**：5 次 pending/processing refresh、completed/failed/cancelled snapshot、无 task、legacy store 各自受控测试和浏览器刷新；断言零重复请求。回滚 owner classifier/coordinator/tests 整组，无 schema/migration；旧实现会重新暴露错误失败。

#### [WORKFLOW-ACTIVE-CONTEXT-RACE-001]

**状态**：已证实；高强度可达静态竞态，待同一 change 审批。**用户影响/范围**：用户在 workflow A 的队列任务未结束时提交 workflow B，A 的迟到事件可把单槽 WorkflowContext 从 B 替换为 A，造成当前进度、后续事件和重试目标分叉。**复现/当前与预期**：A 留在旧 WorkZone，等待提交锁一秒释放（`AIInputBar.tsx:3699-3706,3741-3748`）后启动 B，再让 A 终态事件到达；`useTaskWorkflowSync.ts:84-125` 只匹配当前 context，匹配不到便在 `:132-175` 更新旧 WorkZone/Chat，随后 `:177-209` 无条件 restore A。预期 A 的持久 UI 更新而 active B 不变。**调用链/根因**：TaskEvent → `processTaskEvent` → current context miss → WorkZone match → board/Chat write → unconditional `restoreWorkflow`；根因是把历史投影恢复与当前 active owner 合并。**方案/替代/风险**：协调器仅在 workflow ID 与 active ID 相等时写 Context，否则直写匹配的 Chat/WorkZone；“所有 matched WorkZone 都 restore”不选。风险是既有后续事件依赖 Context 的隐藏顺序，需两 workflow 事件序列覆盖。**验证/回滚**：对 A 发 10 个 pending/processing/terminal 乱序事件，断言 B ID/steps 不变、A 投影收敛；回滚 coordinator 与序列测试，无存储格式变化。

#### [WORKFLOW-TASK-SYNC-DUP-001]

**状态**：已证实；高强度重叠订阅/写入者静态证明，实际重复写次数待审批后用 spy 测量。**用户影响/范围**：同一 task event 可沿多个消费者更新 Context、Chat 或 WorkZone，产生重复持久化、陈旧状态覆盖和额外渲染；不能在未测量前宣称具体次数或性能损耗。**复现/当前与预期**：发出一个匹配 workflow 的 TaskEvent；消费者包括 `AIInputBar.tsx:1695-1827`、`useTaskWorkflowSync.ts:270-399`、`DrawnixDeferredRuntime.tsx:429-531`，并可经 Chat `handleSyncWorkflowTaskUpdate`（`ChatDrawer.tsx:1287-1318`）fallback；AIInputBar 自身先调用 Chat fallback再写 Context/Chat/WorkZone。预期每个逻辑目标每事件一次、相同投影无重复 Chat storage write。**调用链/根因**：TaskQueue observable → 四条订阅/回退链 → 多状态 owner；根因是增量叠加订阅但没有 authoritative projection 或 event ordering contract。**方案/替代/风险**：审批后先加调用次数/乱序测试，再集中到一个按 taskId 优先、workflowId+batch slot 兜底的协调器；直接删除任一订阅不选，因为各链仍承载图片后处理、批次失败和恢复差异。风险是去重暴露顺序依赖。**验证/回滚**：synthetic event 对 Context/Chat/WorkZone spy，终态重复 write 为 0，并覆盖图片/视频/失败/取消；整组回滚协调器和订阅调整。

#### [WORKFLOW-CHAT-TERMINAL-001]

**状态**：已证实；高强度状态写入静态证明，用户可观察修复待审批。**用户影响/范围**：不创建 task 的纯同步 text/ai_analyze/insert workflow 完成后，ChatMessage 仍可持久化为 STREAMING；刷新/切会话时被重新选作进行中 workflow。**复现/当前与预期**：提交只含同步 MCP 的 workflow；创建消息固定 `MessageStatus.STREAMING`（`ChatDrawer.tsx:1120-1130`），常规步骤更新只写 `{workflow}`（`:1242-1279`），而只有 task fallback 在 `:1287-1315` 同时派生 message status；加载/切会话按 STREAMING 查 active（`:480-484,808-812`）。当前 workflow steps 完成但外层 message status 不变；预期 workflow/message terminal status 在同一消息写边界收敛并保留 retry context。**调用链/根因**：同步 MCP → WorkflowContext/WorkflowMessageData → `handleUpdateWorkflowMessage` → Chat storage partial update → refresh active lookup；根因是 bubble/内部步骤与外层 ChatMessage 使用两套终态派生。**方案/替代/风险**：复用统一 normalized-step 派生并在 updateMessage 同时写 workflow/status；只在加载时忽略旧 STREAMING 不选，因为持久化仍漂移。风险是部分成功/可重试映射，需表驱动测试。**验证/回滚**：completed/failed/skipped/running/retry/resume 表和刷新选取测试；回滚 status 派生与测试，无 schema 变化。

#### [WORKFLOW-RECOVERED-EVENT-DEAD-001]

**状态**：已证实的无生产 writer 边界；低风险清理候选，暂不修改。**用户影响/范围**：当前没有直接用户行为缺陷证据，但消费者增加理解与测试面。**复现/证据/当前与预期**：生产搜索只有事件类型 `workflow-submission-service.ts:162-176` 和消费者 `useWorkflowSubmission.ts:203-273`、`DrawnixDeferredRuntime.tsx:402-410`；`recoverWorkflows():209-250` 只返回 active records，只对 failed 发 `failed`，没有 `recovered` writer。当前消费者不可由生产 event 到达；预期由待审批恢复设计决定重新定义或删除。**调用链/根因**：不存在 writer → 两个订阅分支；根因是旧事件契约漂移。**方案/替代/风险**：完成 owner change 时一并决定删除，或若确需 legacy event 则添加唯一 writer+测试；当前机械删除可能与批准后的恢复协调器相冲突。**验证/回滚**：全仓 writer/caller 搜索及 event contract 测试；若删除则恢复 union/消费者即可。

#### [WORKFLOW-PENDING-MAIN-THREAD-HYP-001]

**状态**：待验证假设。**用户影响/范围**：仅当历史 `workflows` store 真有 `pending_main_thread` 记录时，resume 检出可恢复状态但执行器可能永远不执行该 step。**复现/证据/当前与预期**：当前只有类型与读取（`workflow-engine/types.ts:20-28`；`engine.ts:128-145`），生产搜索无 writer；`workflow-factory.ts:57-71` 只返回 pending。缺少真实历史记录/迁移版本证据，不能认定用户缺陷或修改。**调用链/根因假设**：legacy IDB row → engine resume → 保持 pending_main_thread → executable filter 排除。**候选方案/替代/风险**：先取得匿名化 store schema/version 样本或迁移夹具；若存在，再通过独立兼容 change 明确 normalize/skip，而不是直接把所有该状态改 pending（可能重放 DOM/canvas side effect）。**验证/回滚**：历史 fixture 的一次性恢复测试；在证据前无改动、无需回滚。

#### [WORKFLOW-TEST-ISOLATION-001]

**状态**：已证实工具链问题，已修复。**用户影响/范围**：不改变产品行为；原 F-11 七文件窄测 110 项中 1 项因首个 engine 动态导入 5,004 ms 超时失败，并触发无关 ConfigWriter/UnifiedCache/IndexedDB 副作用，降低恢复链验证可信度。**复现/当前与预期**：修复前同一命令为 6/7 文件、109/110 项，engine case 超时；`workflow-engine.test.ts` 每项 reset module 并 mock 旧边界，converter test 初始化整个 MCP。预期测试只加载被测契约且在默认 timeout 内稳定完成。**调用链/根因**：test dynamic import → service barrel → media/config/storage side effects；converter import `../../../mcp` → 全工具初始化；根因是 mock 边界已随实现漂移。**方案/替代/风险**：`workflow-engine.test.ts:10-41` 静态导入 engine 并 mock真实 `media-executor`、`media-generation`、storage writer；`workflow-converter.test.ts:16,59-73` 只导入纯 registry并注册最小 `generate_image`；定向 lint 捕获的 import-order 与空回调由顶层 import 和 `vi.fn()` 收口。提高 timeout 或伪造 IndexedDB 不选，因为掩盖无关加载。无运行时风险。**验证/回滚**：首次修后 engine 单文件 15/15、8 ms test/1.47 s suite；lint 修正后复跑 15/15、9 ms test/1.66 s suite；最终明确七文件清单 112/112、6.89 s。回滚两个测试文件会恢复超时/噪声，不影响生产。

#### [WORKFLOW-DOC-OWNER-DRIFT-001]

**状态**：已证实文档/注释漂移，已修复。**用户影响/范围**：影响维护者对执行和恢复 owner 的判断，不直接改变用户运行行为。**复现/证据**：旧 `FEATURE_FLOWS` 与 service/Chat/WorkZone 注释把新 workflow 指向 service/SW；当前正向搜索证明 `submit()` 无生产 caller，`useWorkflowSubmission` 固定 `usedSW:false`，AIInputBar 直接 executeTool。**调用链/根因**：过时说明 → 错误架构前提 → 可能把修复放进 SW/legacy store；根因是主线程迁移后文档未同步。**方案/替代/风险**：`FEATURE_FLOWS.md:25-76,254-298` 记录主线程 task 和真实提交链；`workflow-storage-reader.ts:1-6`、`workflow-submission-service.ts:1-9,825-833`、`ChatDrawer.tsx` 与 `WorkZoneContent.tsx:64-65,137-139` 明确兼容边界。删除 legacy service 不选，因恢复 caller 仍可达。仅注释/文档风险低。**验证/回滚**：当前源码正反搜索和窄测试；回滚文档会恢复漂移，无数据影响。

### 21.4 实际改动、验证、性能/视觉和退出判断

**实际改动与根因映射**：没有实施任何受审批约束的运行时语义修改。新增 `openspec/changes/fix-main-thread-workflow-recovery-sync/{proposal.md,design.md,tasks.md,specs/workflow-runtime-recovery/spec.md}`，覆盖 `RECOVERY-OWNER`、`ACTIVE-CONTEXT-RACE`、`TASK-SYNC-DUP`、`CHAT-TERMINAL`；测试隔离修改 `services/__tests__/workflow-engine.test.ts` 和 `components/ai-input-bar/__tests__/workflow-converter.test.ts`；owner 文档同步修改 `workflow-storage-reader.ts`、`workflow-submission-service.ts`、`ChatDrawer.tsx`、`WorkZoneContent.tsx` 与 `docs/FEATURE_FLOWS.md`。这些改动不改变公开 API、task/chat/board/workflow schema、缓存 key、模型路由、并发、恢复数据或画布插入。

**窄验证**：Node 24.14.0、pnpm 11.9.0、Vitest 3.2.4、jsdom、无供应商网络/凭据。明确命令覆盖 engine、converter、useWorkflow、generation utils、task linking、task sync 和 WorkflowMessageBubble，退出 0，**7/7 文件、112/112 项、6.89s**；engine 单文件最终 15/15，测试执行 9ms、suite 1.66s。仍有 `useWorkflow`/converter 的 `indexedDB is not defined` ConfigWriter stderr，但没有 5 秒 timeout，归测试环境配置噪声，不计产品缺陷。`pnpm nx typecheck drawnix` 退出 0。

**lint、类型与循环**：第一次六个修改文件定向 ESLint 退出 1（6 errors/21 warnings），其中本轮测试的 import-order 和三个 empty callback 共 4 errors；修正后复跑退出 1（2 errors/21 warnings），剩余 errors 仅为 `workflow-submission-service.ts:641,672` 的既有 `no-case-declarations`，本轮测试新增 error 为 0。`pnpm lint` 退出 1并继续扫描包内 `node_modules`；仅 `react-board` 子项目即 3,143 problems（1,144 errors/1,999 warnings），同时混有既有源码告警，不能计为 F-11 业务缺陷。`pnpm typecheck` 退出 0、5/5 projects；`pnpm check:cycles` 退出 0，无静态运行时循环。

**全仓测试对照**：第一次 `pnpm test` 在执行测试前因 Nx cache artifact machine ID 不匹配退出 1，分类为工具缓存环境失败，未删除缓存；`NX_SKIP_NX_CACHE=true pnpm test` 真实执行后退出 1：Drawnix **182 文件中 177 通过/4失败/1跳过，1147 项中1143通过/3失败/1跳过，1个未处理异常**。失败为 cached-image data URL、GPT remote Blob mock、Sora web duration、PPT settings mock收集和 benchmark storage mock异常，均在 F-06/既有基线簇内；F-11 七文件全部通过，原 workflow engine timeout 未再出现。不能把失败数波动表述为产品修复。

**构建、预算与启动**：`pnpm build:web` 退出 0：app 7,930 modules、1m34s，SW 54 modules、2.23s；构建更新 `apps/web/public/version.json` 的 buildTime。`pnpm verify:startup` 退出 0：CSS/startup-app/startup-runtime/index 为 14,208/3,776/1,867/345 B，chunk cycles 为空。`pnpm size` 退出 1：AI Chat **844.2/140 kB gzip**，超 704.2 kB；Diagram **934.93/950**、Editor **858.24/870**、Office **269.19/300**、Media Viewer **12.19/20 kB** 通过。与 F-06 新鲜产物相同预算格局，本轮无生产 bundle 改动，不归因于 F-11。

**Playwright 与浏览器**：首次 smoke 因 config 的 `npx nx serve web` 在当前 PATH 中找不到 `npx` 而退出 127；用等价 `pnpm nx serve web` 显式启动并复跑后，2/2 smoke 均在 browser launch 前失败：Playwright 需要 `chromium_headless_shell-1200`，机器仅缓存 1228。开发服务随后显式 Ctrl+C 退出 130。feature、visual、responsive 共用同一不可用 browser，未重复运行，分类为测试环境阻塞；未安装浏览器。仓库没有可控断言的 provider workflow E2E，`ai-workflow` 仅存在手册 GIF 脚本，不能替代 refresh/race/status 验证。

**性能与视觉**：测试隔离把 engine suite 从可复现的 5,004ms timeout 降到首次修后 1.47s、lint修正后1.66s，但这是 Node/Vitest 测试工具性能，不是用户运行时性能。生产实现和 CSS 未改，没有修复前后同条件五次浏览器样本、render/commit、task latency、内存、Web Vitals 或截图，因此不宣称产品更快、更省内存或更美观。真实 provider 正常/失败/慢任务、刷新恢复和双 workflow 浏览器矩阵缺可控凭据/任务 fixture，并且运行时方案尚未批准。

**规格、回滚与剩余风险**：OpenSpec CLI `command -v openspec` 退出 1，无法 `validate --strict`；四个必需文件、1 个 ADDED delta、5 requirements/8 scenarios 已人工检查。回滚可分别删除本 change、恢复两个测试的旧 import/mock 和恢复上述注释/文档；没有数据迁移或删除。无 Git 元数据，无法自动生成可信 diff、核对历史或声称工作树干净，实际回滚需依照文件清单和外部副本。

**当前退出判断**：F-11 为**部分验证，未达到退出标准**。真实链、owner、状态/持久化边界、七文件窄测和文档漂移已闭环；四项用户可观察的高可信恢复/同步问题必须等待 `fix-main-thread-workflow-recovery-sync` 批准后先测后改；`recovered` 死事件需随该设计收口；历史 `pending_main_thread` 缺数据证据；取消归 F-10 待审批 change；浏览器恢复/离线/响应式/视觉与五次性能验收均未完成。这些阻塞不妨碍继续下一个不依赖审批的完整功能循环。

## 22. F-12 Chat 会话、流式回复、Agent/MCP 与刷新恢复循环

### 22.1 用户场景、边界、规格与验收门禁

**用户场景**：用户打开 Chat Drawer，创建或切换会话，在 Agent 模式发送文本或图片，看到流式回复或工具工作流；会话、消息、错误和工作流记录在刷新后仍属于正确会话，且忙碌、失败和持久化状态不丢失用户输入。

**范围**：Chat Drawer 打开/关闭、会话创建/选择/重命名/删除、普通 Agent 文本与图片附件、模型/协议路由、流式 UI、Agent 工具回调、session/message localForage、drawer localStorage、完整备份的 Chat store 边界、Chat 分析/LLM 日志。**非范围**：F-11 的 task-backed workflow 恢复协调器；F-10 的任务取消/重试；F-09 的模型发现算法；F-13 的素材库内部；新增 Chat 队列、并行会话请求、停止或重新生成 UI。

**真实能力边界**：`ChatHandler` 虽暴露 `stop()`/`regenerate()`，生产搜索没有 UI 或外部调用者；`ChatMessagesArea` 只渲染消息、workflow reply/retry 和预览，`EnhancedChatInput` 没有停止按钮。因此普通 Chat 的 C/R 不是当前可达用户能力，不能把隐藏函数当作已验收功能。Workflow step retry 仍属于现有 F-11/F-12 邻接能力。

**规格与活动 change**：正式 `agent-image-understanding` 只规定受支持文本 binding 的图片输入；`backup-restore` 要求完整备份包含 chats；`add-generation-context-library`、`add-video-prompt-pdf-context` 和 `update-default-text-models` 与附件/模型相邻；`refactor-sw-duplex-comm` 以 SW Chat/task 执行为前提，与当前主线程链冲突。本轮建立 `fix-chat-message-persistence-consistency`（5 requirements/9 scenarios、4/18 tasks）、`fix-chat-inflight-session-isolation`（3 requirements/6 scenarios、4/17 tasks）与界面独立 owner `improve-chat-drawer-interface-accessibility`（6 requirements/16 scenarios、6/24 tasks）；OpenSpec CLI 仍不可用，只完成文件/格式/同名 requirement 人工校验，运行时实施等待用户审批。

**本轮验收**：正反向覆盖会话 CRUD、文本/图片、正常流、错误、忙提交、快速切会话、刷新、workflow message、备份和日志；先用可控 promise/存储复现计数、终态写、第二次发送和 A→B 乱序；相关测试、类型、lint、全仓命令不新增失败；性能/视觉只在同条件至少五次与截图证据后下结论。

### 22.2 正向、反向调用链与状态/数据不变量

**普通 Agent 正向链**：`drawnix.tsx:1758-1760` 挂载 ChatDrawer → `ChatDrawerTrigger.tsx:28-43` 打开 → `ChatDrawer.tsx:1600-1719` 会话/模型/input UI → `EnhancedChatInput.tsx:257-382` 在 `generationType === 'agent'` 时构造 text/data-file 消息 → `ChatDrawer.tsx:857-906` 校验 API key、必要时创建会话、调用 handler → `useChatHandler.ts:123-181` 发送锁、用户消息转换与先行持久化、历史组装 → `chat-service.ts:170-295` 根据 binding 图片能力构造 GeminiMessage、系统 prompt 和 AbortSignal → `gemini-api/client.ts:100-107` → `gemini-api/services.ts:592-646` 等待 settings、解析 text route/binding、校验配置 → `apiCalls.ts:687-701,709-749` 或 `:372-424` 通过 `providerTransport` 发送 OpenAI/Google 流式 HTTP → 累计流回 `chat-service.ts:283-311` → `useChatHandler.ts:185-324` 更新占位消息、解析 tool call、终态/错误 → `ChatMessagesArea.tsx:89-177` 渲染 loading/content/error/workflow → `chat-storage-service.ts:101-124` 写 messages/session → `posthog-analytics.ts` 与 `llm-api-logger.ts` 记录长度、耗时、状态和截断诊断。

**图片输入转换**：`EnhancedChatInput.tsx:140-235,316-345` 本地/素材图片形成 data URL 或 URL attachment → `chat-utils.ts:152-177` 转 ChatMessage attachments → `chat-service.ts:117-161,227-262` 由 `supportsTextBindingImageInput`、最大图片数和 message-utils 决定历史/当前图片 part → Google 路径 `apiCalls.ts:180-230` 转 inline_data，OpenAI 路径保留 image part。正式 spec 明确不支持图片的 binding 必须保持 text-only。

**Agent 工具链**：普通流 `done` → `useChatHandler.ts:196-254` parseToolCalls/inject model/`mcpRegistry.executeTool` → `ChatDrawer.tsx:306-431` 创建 WorkflowMessageData、更新 Chat store、执行工具、写 step/终态 → `WorkflowMessageBubble`、task/workflow fallback 与画布结果。task-backed 后续状态、恢复 owner 和 Chat terminal 统一仍由待审批 F-11 change 负责。

**会话与刷新链**：create/select/rename/delete UI `ChatDrawer.tsx:768-850` → `chat-storage-service.ts:41-95` sessions/messages localForage；初次挂载 `ChatDrawer.tsx:450-495` 从 drawer localStorage 选 active session并加载 workflow，`useChatHandler.ts:97-121` 独立加载普通/raw messages；抽屉开关/active ID 写 `ChatDrawer.tsx:497-503` → localStorage。完整环境备份 `environment-backup-service.ts:170-205` 原样读取两个 Chat stores，恢复 `:524-531` 原样写回。

**工作流 Chat 直写链**：AIInput/Drawer generation → ChatDrawer ref `sendWorkflowMessage` → `ChatDrawer.tsx:909-1023` 选择 append/new session → `:1025-1138` 构造用户+workflow 两条消息并依次持久化 → `:1151-1163` 同步 UI/raw refs → task/workflow 更新 `:1242-1408` patch 同一消息。该链不经过普通 `useChatHandler.sendMessage`。

**反向追踪**：可见普通消息只能由 `useChatHandler` state/load 写入；持久化 ChatMessage writer 是 `useChatHandler` 普通终态、ChatDrawer workflow pair 和 ChatDrawer `updateMessage` patch；会话 metadata writer 只有 storage service、普通 handler 的额外手工写及 workflow pair 的额外手工写；session 列表只读 ChatDrawer 的 `sessions` state；provider 请求只由 `chatService → defaultGeminiClient → sendChatWithGemini → callApiStreamRaw → providerTransport` 发出；Chat 备份只原样收集/恢复 localForage records。全仓没有其他 `messageCount` 业务 writer。

**状态与不变量**：UI Message 与 durable ChatMessage 是两种类型；`rawMessagesRef` 是下一轮模型历史 owner，React `messages` 是当前可见 owner，`sessions`/`activeSessionId` 属于 ChatDrawer，AbortController 和发送锁当前均为全局单请求边界。消息 ID 是 localForage key；session/message 是不同 store，跨 store 无事务。用户消息在网络前 awaited；当前助手终态、session terminal metadata 和多处 workflow patch 是 fire-and-forget。分析事件记录 model、长度、耗时与错误；LLM logger 会保存截断 prompt/result，未在本轮改其隐私策略。

### 22.3 问题证据、方案与决策

#### [CHAT-STREAM-LOG-001]

**状态**：已证实并修复。**用户影响/范围**：不改变 Chat 可见回复；累计流被再次拼接会让 LLM 诊断结果错误，并随 chunk 数增加中间字符串复制。未做运行时五次测量，因此不宣称性能提升。**复现/当前与预期**：底层 OpenAI `apiCalls.ts:825-833` 和 Google `:491-500` 都按 `a → ab → abc` 回调累计全文；修复前 `services.ts:633-640` 执行 `resultText += chunk`，失败测试原始值为 `aababc`，预期日志记录最终累计值 `abc` 且 visible callbacks 不变。**调用链/根因**：provider SSE → apiCalls cumulative callback → services 把 cumulative 误当 delta → LLM log；根因是相邻层流契约解释相反。**方案/替代/风险**：`services.ts:637-640` 改为赋值最新累计值；把底层改成 delta 不选，因为 ChatService 和注释均依赖累计值，且会扩大调用面。风险只在非标准 adapter 回调语义，现有两个生产协议均已反查。**验证/回滚**：新增 `services.test.ts`；修复前 1/1 失败并记录 `aababc`，修复后 1/1 通过，F-12 八文件 26/26 通过，Drawnix typecheck 通过；回滚单行赋值与测试即可，无数据迁移。

#### [CHAT-MESSAGE-COUNT-001]

**状态**：已证实，高强度顺序与算术静态证明；修复等待审批。**用户影响/范围**：ChatSession 持久化/备份 metadata 与真实消息数不一致；当前 SessionItem 不显示 count，故不夸大为可见 badge 错误。**复现/当前与预期**：初始 `N`，普通 user `addMessage` 得 `N+1`，手工 user update 得 `N+2`，assistant insert 与旧 snapshot `+2` 最终均写 `N+3`，但只有两条记录；workflow 两次 awaited insert 后再 `+2` 得 `N+4`。预期两条记录即 `N+2`。**证据/调用链**：`chat-storage-service.ts:101-113` → `useChatHandler.ts:139-152,259-284`；workflow `ChatDrawer.tsx:1087-1138`；backup `environment-backup-service.ts:188-190,524-531`。**根因**：存储服务和调用者同时拥有同一 metadata 算术，且普通终态复用旧 session snapshot。**候选方案/替代/风险**：`fix-chat-message-persistence-consistency` 规定 storage-only owner、同 ID replace 不增计数、打开会话惰性纠正且不改 updatedAt；全库启动扫描不选，因消息 store 无 session 索引且附件可大。新增 IDB read 和惰性纠正成本需测量。**验证/回滚**：新会话成功/错误/workflow/replace/delete/legacy fixture，断言 records=count；回滚 storage ownership/调用者删除和测试，schema/key 不变。

#### [CHAT-TERMINAL-DURABILITY-001]

**状态**：已证实的异步完成边界缺失；修复等待审批。**用户影响/范围**：最后回复已显示且发送锁已释放时，助手终态仍可能未写入 IndexedDB；立即刷新/备份可读到缺失助手消息，写失败只形成未处理 rejection。**复现/当前与预期**：令 assistant `addMessage` promise 保持 pending；`useChatHandler.ts:259-288` 不 await 就把 status/lock 置 ready，错误路径 `:303-354` 相同。当前 send 可先完成；预期 durable terminal boundary 等待成功或报告安全失败。**调用链/根因**：provider done/error → synchronous onStream callback → fire-and-forget localForage → ready/return；根因是流进度回调同时承担异步终态提交，却没有 promise 汇合点。**候选方案/替代/风险**：记录并 await terminal persistence promise，存储失败进入明确 Chat error；固定延时不选。代价是最后 token 后 busy 稍延长，必须测五次。**验证/回滚**：可控 deferred storage success/reject、立即 refresh/backup fixture；回滚 promise boundary 和测试，不改记录格式。

#### [CHAT-TOOL-PERSIST-RACE-002]

**状态**：已证实的正确性/刷新恢复缺陷；高强度生产调用顺序与当前 storage 实测证据，修复等待既有 `fix-chat-message-persistence-consistency` 审批。**用户影响/范围**：普通 Agent tool response 已在 React 中展示 pending workflow 时，若刷新发生在后续 tool terminal patch 前，持久消息可只含 assistant marker 而没有初始 workflow steps；不影响无 tool 的普通 assistant response，也不把 F-11 task terminal recovery 归入本问题。生产发生频率和窗口时长未知。**复现/当前与预期**：使用当前 `chat-storage-service.ts`、localForage 和 fake-indexeddb 6.2.5，清空 store 并创建 session；对不存在的同一 assistant ID 先启动 `updateMessage(id,{workflow})`，随后启动 `addMessage(baseMessage)`，等待两者 fulfilled 后调用 `getMessages(sessionId)`。当前唯一记录等于完整 base message，但 `workflow === undefined`；预期 base record 先 durable，初始 patch 后刷新读回包含 workflow。**证据**：生产顺序为 `useChatHandler.ts:196-254` 在 done callback 同步调用 tool callback → `ChatDrawer.tsx:328-360` 启动未 await workflow patch → 回到 `useChatHandler.ts:257-275` 后才启动 base insert；`chat-storage-service.ts:127-135` 对不存在 ID 的 update 返回 fulfilled no-op。固定 Node 24.14.0、Vitest 3.2.4、jsdom；1/1 文件、1/1 测试，13ms，Vitest 1.21s、wall 2.37s、退出0。临时诊断测试已删除；通过断言描述的是当前缺陷，不是期望契约。完整原始记录见 `docs/evidence/f12-chat-drawer-ui/persistence-diagnostics.md` 和 `persistence-metrics.json`。**调用链/根因**：provider done → synchronous `onToolCalls` → partial patch reads absent ID and silently no-op → complete base insert → refresh `getMessages`；根因是调用者在建立完整 record 不变量前发布 patch，而两个 fire-and-forget `Promise<void>` 无法表达或强制提交顺序。**候选方案/替代/风险**：沿既有 change 先持久化并等待完整 assistant base，再应用初始 workflow patch，并把 terminal patch 纳入同一顺序测试；partial upsert 不选，因为缺 session/role/content/timestamp，固定延时或重试 fulfilled no-op 也不能证明 durability。风险是 storage rejection 反馈、发送 busy 时点、tool start ordering 和 count/session metadata 重复写，必须与同一 change 的 terminal/count/session requirements 联测。**验证/回滚**：审批后先加入永久红测，控制 base/patch settlement 并断言 refresh bytes，再覆盖正常/错误、storage rejection、附件、count 和 session projection；回滚 sequencing 与测试即可，无 key/schema/migration/cleanup。

#### [CHAT-BUSY-SEND-DROP-001]

**状态**：已证实的可达调用链；用户行为修复等待审批。**用户影响/范围**：第一条普通 Chat 仍流式时，第二条输入会从 composer 消失，但没有消息、存储或网络请求，也无反馈。**复现/当前与预期**：选择 Agent，发送让 provider promise 保持 pending；输入第二条并 Enter/点击发送。`EnhancedChatInput.tsx:304-382` 调用 onSend 后同步清空，`useChatHandler.ts:128-135` 因锁直接 return；`ChatDrawer.tsx:1706-1719` 没传 busy state。预期第二请求不自动排队，但草稿/附件保留并明确显示 busy。**调用链/根因**：composer → wrapper → handler lock reject → void contract → composer unconditional clear。**方案/替代/风险**：`fix-chat-inflight-session-isolation` 增加 accepted/busy 结果和 submit-only busy 状态；整框禁用不选，因为会阻止用户起草，自动队列不选因为是新功能。风险是需要区分编辑可用与提交可用。**验证/回滚**：deferred first send + second draft/attachments，断言 API/storage 0 次新增、草稿保留、反馈一次；回滚 contract/UI/test，无持久化变化。

#### [CHAT-SESSION-LOAD-RACE-001]

**状态**：待验证假设，高可信跨会话竞态；审批前不实施。**用户影响/范围**：快速 A→B 时，迟到 A 读取存在覆盖 B 可见消息和 raw provider history 的允许时序；随后 B 消息可带入 A 上下文。**复现/证据**：普通 load `useChatHandler.ts:97-121` 与 workflow load `ChatDrawer.tsx:785-821` 都无 cleanup/request identity；任何完成都写共享 state/ref。IndexedDB 实际乱序样本尚因浏览器环境阻塞未取得。**调用链/根因假设**：select A/read A → select B/read B/commit B → late A/commit A → send B uses raw A；根因是 session selection 与 async projection 没有 latest-owner contract。**候选方案/风险**：递增 request identity + requested session guard；依赖 IDB 完成顺序或取消迭代不选。需覆盖删除、新建、错误、unmount 与 workflow map；未验证前不改运行时代码。

#### [CHAT-SESSION-METADATA-STALE-001]

**状态**：已证实的内存/持久化分叉；修复等待审批。**用户影响/范围**：普通 Chat 写入会更新 durable session `updatedAt`，但会话列表仍显示旧时间/排序直到刷新；workflow 直写则显式 setSessions，两个入口体验不一致。**复现/证据**：`chat-storage-service.ts:101-113` 更新 session；ChatDrawer visible sessions state 在 `:140-142`，普通 handler没有 setter/callback；workflow `:1132-1149` 手工同步。SessionItem `:72-114` 直接读内存 updatedAt。**调用链/根因**：normal addMessage → durable session only → SessionItem stale state；根因是 session metadata 没有 committed projection。**候选方案/风险**：持久化 change 在 durable boundary 后返回/同步 committed metadata并重排；定时 reload 不选。风险是 origin request 在用户查看另一个 session 时只应更新列表，不得替换可见消息。**验证/回滚**：正常成功/失败、A request/B visible、workflow pair 的 time/order test；回滚 session projection 和测试。

#### [CHAT-HIDDEN-CONTROLS-001]

**状态**：已证实事实，当前不是可达产品功能。**影响/证据**：`useChatHandler.ts:367-415` 实现 stop/regenerate，`chat-ui.types.ts:44-50` 暴露接口；生产搜索没有 `.stop()`/`.regenerate()` caller，ChatMessagesArea 的 assistant actions 为空，EnhancedChatInput 仅发送。不能以隐藏实现声称用户已有取消/重试，也不能直接判定其 partial-as-success/重复 ID 行为是用户缺陷。**处理**：暂保留为设计输入；session isolation 明确不新增按钮/队列，若以后要暴露必须独立提案和状态语义。无改动、无需回滚。

#### [CHAT-DEAD-SESSIONS-HOOK-001]

**状态**：已证实无生产调用并已清理。**用户影响/范围**：无可达行为变化；旧 `useChatSessions.ts` 复制 ChatDrawer 的 session owner，但全仓只有自身定义及 `UseChatSessionsReturn` 类型，无 import/export/test/caller。**复现/证据/调用链**：`rg useChatSessions|UseChatSessionsReturn` 修前只命中该文件与 `chat.types.ts`，没有入口→hook 或 hook→UI 链；修后搜索 0 命中。**方案/替代/风险**：删除孤立 hook 和专用类型；保留“以防未来使用”不选，因为当前账本只维护真实可达能力。风险由 Drawnix typecheck覆盖。**验证/回滚**：清理后 `pnpm nx typecheck drawnix` 退出 0；恢复文件与类型即可，无数据影响。

#### [CHAT-DUPLICATE-ID-COUNT-HYP-001]

**状态**：待验证假设。**影响/证据**：`addMessage()` 对现有 key 使用 setItem 仍递增 count，但当前可达普通/工作流生成 ID 路径未证明会重复；唯一明确复用原 user ID 的 `regenerate()` 没有生产 UI caller。**验证方法**：审批后的 storage contract test覆盖 same-ID replace，并继续反查外部 ref 同毫秒 ID 碰撞；在可达重复路径确认前不得把它单独称为现有用户缺陷。

### 22.4 实际改动、验证、性能/视觉、回滚与退出判断

**实际改动与根因映射**：未实施两项待审批的持久化/会话语义。新增两个独立 OpenSpec change 共 8 个文件；`gemini-api/services.ts` 只把累计 stream 日志从二次拼接改为最新累计值，并新增 `services.test.ts`；删除无调用 `useChatSessions.ts` 及其孤立返回类型。`CHAT-TOOL-PERSIST-RACE-002` 只补充既有 persistence change 的实测依据、账本和 `docs/evidence/f12-chat-drawer-ui/persistence-{diagnostics.md,metrics.json}`，临时诊断测试已删除。没有改 Chat/session schema、store/key、附件、provider 请求、task/MCP、workflow retry、备份版本、CSS 或视觉几何。

**测试与类型**：初始 Chat 七文件窄测退出 0，7/7 文件、25/25 项、11.46s；新增日志复现测试修复前退出 1、1/1 失败，原始收到 `aababc`；修复后单文件退出 0、1/1，7ms tests/948ms suite。静态 import 修正前的八文件窄测退出 0，8/8 文件、26/26 项、10.62s；修正后最终八文件集合（含 workflow media）退出 0，8/8 文件、27/27 项、11.81s，`UserMessageBubble`/`ChatMessagesArea` 分别 44/51ms。真实 Chat storage 顺序诊断退出0，1/1文件、1/1项、13ms，Vitest 1.21s、wall 2.37s；临时测试已删除且只证明当前缺陷，不是长期 pass 契约。一次误纳入已知 cached-image 基线文件的扩展命令退出 1，7/8 文件、26/27 项，唯一失败仍为 `message-utils.test.ts:99`，没有归为 F-12 回归。EnhancedChatInput 测试仍打印 `indexedDB is not defined` ConfigWriter stderr及既有 React `act(...)` warning，另有第三方 sourcemap/Browserslist 提示，均未导致 F-12 断言失败并分类为测试环境/工具配置噪声。清理 dead hook 前后 `pnpm nx typecheck drawnix` 均退出 0；最终 `pnpm typecheck` 退出 0、5/5 projects，`pnpm check:cycles` 退出 0。

**全仓测试对照**：第一次 `pnpm test` 退出 1：182 文件中 175 通过、6 失败、1 跳过，1145 项中 1139 通过、5 失败、1 跳过，另有 1 个未处理异常；新增的两个失败是全仓并行负载下 `ChatMessagesArea`/`UserMessageBubble` 动态 import 超过 5 秒。把测试组件导入移到静态收集阶段后第二次 `pnpm test` 仍因基线退出 1，但恢复为 177 通过、4 失败、1 跳过，1141 通过、3 失败、1 跳过，另有同一未处理异常；剩余为 cached image conversion、GPT Blob mock、Sora duration、PPT settings mock suite 与 benchmark storage mock 异常，F-12 新增/相关测试均通过。该测试隔离修正不改生产模块加载方式。

**lint**：定向 ESLint 首次退出 1：新测试 1 个 import/first error、`services.ts` 1 个既有 Nx lazy-module boundary error和9个既有 warning；新测试 import 顺序修正后，三份本轮测试文件最终退出 0。单独检查 `services.ts` 退出 1，只剩 `services.ts:43` 既有 module-boundary error与9 warnings。未为本轮放宽规则或改 lazy chunk 边界。

**构建、启动和体积**：新鲜 `pnpm build:web` 退出 0；应用 7,930 modules transformed，build-app 1m31s，SW 54 modules、1.55s，最终 `sw.js` 43.12kB gzip。构建会把 `apps/web/public/version.json.buildTime` 更新为 `2026-07-29T06:19:57.895Z`，这是命令副作用，且因无 Git 元数据只能标记 `gitCommit: unknown`。`pnpm verify:startup` 退出 0：startup app 3,776 bytes、runtime 1,867 bytes、entry 345 bytes、CSS 14,208 bytes，四项均低于各自 512,000 bytes 门禁且 chunk cycles 为空。`pnpm size` 退出 1：Startup App 1.94kB、Runtime 1.01kB、Diagram Engines 934.93kB/950kB、Office Data 269.19kB/300kB、Editor Engines 858.24kB/870kB、Media Viewer 12.19kB/20kB 均在预算内；AI Chat 844.2kB gzip 超 140kB 预算 704.2kB，是重新构建确认的既有债务。本轮只改一个运行时赋值且没有建立前后产物对照，不能把体积归因于 F-12 修复，也未提高预算。

**性能与视觉**：失败测试证明字符串内容错误，storage 顺序诊断证明 workflow patch 可丢失；13ms 是 jsdom 中单个测试用例耗时，不是 IndexedDB 产品性能。没有浏览器、CPU、长回复样本或五次运行数据，不能宣称响应更快、持久化更快或内存更低，也不宣称生产发生频率。生产 CSS/DOM 未改，没有前后截图；既有 drawer/page visual 与 manual scripts只能证明入口存在，正式 Playwright仍被缺少 `chromium_headless_shell-1200` 阻塞。供应商正常/错误流缺外部凭据和可控网络 fixture。

**规格、回滚和剩余风险**：两个 delta 的 requirement/scenario header、四文件结构、同名 requirement 冲突均人工检查；persistence change 的 evidence task 1.3 已由真实 localForage/fake-indexeddb 顺序复现补强，仍是18 tasks中4项完成。CLI `command -v openspec` 退出1，无法 strict validate。累计流修复可回滚 `services.ts` 单行和测试；dead hook 可恢复文件与类型；proposal 可独立删除。无 Git 元数据，无法生成可信 diff或核对历史。高优先剩余风险是忙发送丢草稿、普通终态 durable boundary、已确认的 Agent workflow初始patch丢失，以及仍待验证的A→B load/in-flight session隔离；message count和列表 metadata属于持久化/一致性 P2。

**当前退出判断**：F-12 为**调查完成、实施阻塞，未达到退出标准**。真实正反向链、可达/不可达边界、八文件数据链测试基线、Agent patch真实storage顺序复现、日志契约修复、dead hook清理、全仓回归对照、生产构建/启动/体积门禁和三项独立 proposal 已完成；`fix-chat-message-persistence-consistency`、`fix-chat-inflight-session-isolation` 与 `improve-chat-drawer-interface-accessibility` 必须分别获得用户批准后先补失败/竞态/界面测试再实施。供应商流式/刷新/附件成功流、五次持久化和切会话性能样本仍阻塞或待实施，不能标记已验证。

### 22.5 Chat Drawer shell、会话控件与普通状态界面子循环

**用户场景与边界**：用户在桌面、平板或手机打开/关闭现有 Chat Drawer，编辑当前标题，打开会话列表并选择/重命名/删除会话，读取普通消息的空/加载/失败状态，通过 composer 添加图片/素材并发送。本子循环只调查 Drawer disclosure/宽度/焦点/Escape、title/session DOM、普通状态语义、composer 名称/locale 和 compact 几何；F-11 workflow bubble、message/session storage、busy/in-flight、provider/task/workflow、附件转换、startup lazy mount 均不在此 owner。

**正反向链**：`drawnix.tsx:177-181,1758-1760` → `ChatDrawer.tsx:135-158` open/width → `ChatDrawerTrigger.tsx:18-45` → toggle/close `ChatDrawer.tsx:753-766` → shell `:1580-1722` → CSS `chat-drawer.scss:20-50,234-266,744-985`。title 由 `sessions + activeSessionId` 在 `ChatDrawer.tsx:1521-1571` 派生，heading/input `:1614-1632` 最终写入 `handleRenameSession :842-851`；session list 从 `:1647-1684` 到 `SessionList.tsx:46-91`、`SessionItem.tsx:90-136`，反向进入 select/rename/delete 和 Chat storage。普通 message/status 从 `useChatHandler` 到 `ChatMessagesArea.tsx:89-177`；composer 从 `EnhancedChatInput.tsx:488-627` 回到现有 normal/workflow submit callback。宽度还同步到 `ChatDrawerContext` 并由 `ViewNavigation.tsx:71-85` 消费。

**新鲜窄基线与环境分类**：三文件 UI 命令退出0，3/3 files、8/8 tests、11.60s；现有 ConfigWriter `indexedDB is not defined`、React `act(...)`、Browserslist 与第三方 sourcemap 为不致失败的测试环境/工具噪声。production build 由 Python server 本地提供给 Codex in-app Chromium；没有 provider/API/telemetry 调用，也没有读取 browser storage。正式 Playwright 的已知 headless revision 阻塞没有被误报为产品失败。

#### [CHAT-DRAWER-MOBILE-ENTRY-002]

**状态**：已证实，待 `improve-chat-drawer-interface-accessibility` 审批。**用户影响/复现/当前与预期**：390×844 打开 Drawer，点关闭并等 350ms；当前 Drawer hidden、trigger `display:none`、可见 Chat/对话命名控件 0 个，普通用户无法重开；预期同一现有 Drawer 始终保留一个命名入口。**证据/调用链/根因**：`chat-drawer.scss:744-787` 隐藏唯一 trigger，`:949-957` 隐藏 compact session actions；生产 reverse search 无第二 UI opener；`Drawnix → trigger → handleToggle → close → media rule → no user event`。注释假定“其他方式”但当前没有注册。**方案/替代/风险/验证/回滚**：保留或重定位同 callback 的 ≥44px compact 入口；不新增 destination、不依赖 workflow auto-open。风险为 toolbar/safe-area/z-index/startup controller 重叠；320/390/768 pointer/Enter/Space 验证；回滚 scoped markup/style，无数据变化。

#### [CHAT-DRAWER-WIDTH-ROUNDTRIP-003]

**状态**：已证实的响应式状态缺陷，待审批。**用户影响/复现/当前与预期**：1280 初始640px → 320 → 1280 后 Drawer 实测260px/x=1020，低于声明375px并导致内容窄列换行；reload恢复640px。预期 compact 全屏不覆盖 desktop preference，返回640±1px。**证据/调用链/根因**：`ChatDrawer.tsx:287-298` 在320把共享 state写为`innerWidth-60=260`，`chat-drawer.scss:744-750`用`100vw!important`暂时遮蔽，返回desktop时因只缩不增而保留260；该state还经Context进入`ViewNavigation.tsx:71-85`。根因是preferred/effective width共用且无恢复策略。**方案/替代/风险/验证/回滚**：分离保留preferred width与compact effective CSS；仅回升到375不选，因为仍丢用户宽度。验证10次往返、drag/cache/context/nav；回滚width state和测试，不迁移key。

#### [CHAT-DRAWER-TITLE-EDIT-004]

**状态**：已证实的键盘/焦点缺陷，待审批。**用户影响/复现/当前与预期**：title是不可聚焦click-only `h2`；pointer进入的input无label/name；Escape取消后同一事件继续关闭Drawer。预期native named edit、labelled input，Escape只取消并返回编辑入口。**证据/调用链/根因**：`ChatDrawer.tsx:544-555,1525-1571,1614-1632`；真实DOM/input属性和随后closed snapshot。heading pointer handler、未命名input与window Escape缺nested owner。**方案/替代/风险/验证/回滚**：native button/equivalent与edit-specific Escape；给heading补tabIndex/key listener不选。需防Enter+blur双保存；以storage call count验证；回滚markup/handlers。

#### [CHAT-SESSION-STRUCTURE-005]

**状态**：已证实，待审批。**用户影响/复现/当前与预期**：active session row为`role=button`且嵌套两个native button，只处理Enter不处理Space，无active语义；edit/delete在无hover时opacity 0且各22×32。预期native selection与sibling actions、explicit active、Enter/Space、focus/touch可见。**证据/调用链/根因**：`SessionItem.tsx:17-70,90-136`、`SessionList.tsx:46-90`、`chat-drawer.scss:555-712`与真实accessibility tree/geometry；row承担select同时包裹action。**方案/替代/风险/验证/回滚**：list/listitem+selection button+sibling actions、focus-within/pointer-coarse；更多row key listener不选。验证长zh/en title、dialog focus、callback count；回滚结构/style。

#### [CHAT-DRAWER-FOCUS-REGION-006]

**状态**：已证实，待审批。**用户影响/复现/当前与预期**：Drawer无role/name，trigger无controls；focused textarea用真实Escape关闭后active为body。预期named non-modal region、关联disclosure、从内部关闭回可见opener；programmatic auto-open不抢focus。**证据/调用链/根因**：`ChatDrawerTrigger.tsx:28-43`、`ChatDrawer.tsx:544-555,1582-1601`及真实attributes/active element；当前只有视觉open state无region/focus lifecycle。**方案/替代/风险/验证/回滚**：`aria-controls`+complementary region+user opener capture；modal trap不选。覆盖nested dialog/auto-open；回滚semantics/focus code。

#### [CHAT-DRAWER-STATUS-007]

**状态**：已证实的唯一render contract缺口，待审批。**用户影响/复现/当前与预期**：normal submitted/streaming与error当前只有visual div/text/class，无bounded status/live/alert；预期generic localized lifecycle/error各一次，不宣布prompt/response/chunks。**证据/调用链/根因**：`useChatHandler → ChatMessagesArea.tsx:89-177`和lazy fallback `ChatDrawer.tsx:1688-1694`；无其他writer。**方案/替代/风险/验证/回滚**：bounded status/alert；整 transcript live不选，避免重复和隐私。用unchanged rerender和secret sentinel验证；移除semantics即可回滚。

#### [CHAT-DRAWER-I18N-008]

**状态**：已证实的localization boundary缺陷，待审批。**用户影响/复现/当前与预期**：`i18n.tsx:132-149,324-340,513-530`已有Chat双语keys，但Drawer/Trigger/Session/Message components绕过Context；Enhanced input虽读language却在`:419,461`固定`zh`、`:621`固定发送。预期application copy/locale随zh/en，stored/user/provider数据不变。**调用链/根因**：global owner → literals/`zh-CN` → visible copy；根因是已有表未接线与partial hardcode。**方案/替代/风险/验证/回滚**：复用keys、补focused keys、preview/time用active locale；不翻译data。双语switch+sentinel byte验证；回滚literals/props，无迁移。

#### [CHAT-DRAWER-TOUCH-009]

**状态**：实测交互几何缺陷，待审批。**用户影响/复现/当前与预期**：1280 trigger 18×48；320 close 36×32.1、upload/library 34×32.1、send 39.6×39.4；session action 22×32，均未达到compact/pointer-coarse 44×44 convention。**证据/调用链/根因**：真实DOMRect与`chat-drawer.scss:195-266,615-711,744-985`；小desktop control仅部分放大且session依赖hover。**方案/替代/风险/验证/回滚**：只扩大hit box/显示focus/non-hover，不放大glyph或隐藏动作；验证320/390/zoom/landscape无overflow/overlap且callback一次；回滚scoped CSS。

#### [CHAT-DRAWER-RESIZE-010]

**状态**：已证实，待审批。**用户影响/复现/当前与预期**：8px resize handle为generic div，无role/name/tab/orientation/value，仅mouse-down，keyboard无法调整existing width。预期desktop semantic vertical separator/equivalent，用Arrow进入同一clamp owner；compact仍隐藏。**证据/调用链/根因**：`ChatDrawer.tsx:157-158,254-304,1595-1600`、`chat-drawer.scss:57-87,756-758`和browser attributes；唯一链无keyboard event。**方案/替代/风险/验证/回滚**：同一width owner增加separator keyboard；额外hidden按钮不选。验证pointer/key/cache/context一致；回滚handle markup/event。

**证据、规格与退出判断**：完整报告/原始值在`docs/evidence/f12-chat-drawer-ui/diagnostics.md`和`metrics.json`；截图为normal desktop、390、320和desktop round-trip narrow四张。新change含4必需文件、6 requirements/16四级Scenarios/24 tasks（6 evidence/manual tasks完成），每个Scenario有WHEN/THEN、6个requirement全仓唯一、capability单owner；`openspec validate ... --strict`退出127，分类为CLI不可用。未修改任何生产组件/CSS/storage/request behavior。F-12整体仍为三项审批阻塞，未达到退出标准。

## 23. F-13 素材库浏览、选择、写入与画布联动功能循环

### 23.1 功能名称、用户场景、范围、规格与验收门禁

**功能与用户场景**：用户从画布工具栏、AI 输入、Chat、生成工具、Frame、填充或知识库入口打开素材库；浏览或按类型、来源、主体类别、搜索、播放列表筛选本地上传、AI 任务和统一缓存素材；预览、收藏、下载、重命名或把图片设为主体；单选/批选后插入调用方；删除素材时同步其播放列表、画布引用和可见状态；刷新、离线或缓存异常后仍看到与实际持久化状态一致的结果。

**范围**：本循环覆盖 `drawnix.tsx` 的统一打开状态、`MediaLibraryModal/Grid/Inspector/AssetItem`、`AssetContext`、localForage 素材元数据、任务存储、统一 IndexedDB 元数据、Cache API 媒体、音频播放列表、画布插入/删除、配额与缓存警告。正常、空态、加载、失败、取消、重试、刷新、离线和部分成功均在边界内。全屏媒体预览/编辑器的保存语义属于 F-06，具体生成任务执行属于 F-08/F-10，工作流主体字段回填属于 F-17/F-18；本轮只验证这些系统与素材库的接口，不改变其内部算法。

**正式规格与活动 change**：正式 `openspec/specs/media-cache-warnings/spec.md:4-54` 约束缓存失败角标、模型无关判断、列表渲染不逐项跨域探测和成功缓存不误报；`openspec/specs/media-preview/spec.md:4-32` 约束视频海报、失败降级和详情点击播放。活动 `update-video-character-asset-reuse` 已批准主体分类、独立主体名和轻量元数据复用，任务为 9/11；主体卡片即时投影修复是恢复该规格。四项新 change 都改变用户可观察或存储/读取/恢复语义，故必须等待审批：`fix-media-library-responsive-interaction`（4/16，2 requirements/4 scenarios）、`fix-media-library-selection-contract`（5/20，3/5）、`ensure-media-library-write-consistency`（7/24，4/8）和 `refresh-media-library-projection-on-open`（4/20，3/6）。它们分别限定响应式/移动详情、picker constraint/标签/完成边界、多存储写入、closed-to-open投影新鲜度；没有合并成全仓提案。

**冲突结论**：响应式 change 与 `fix-tool-window-viewport-transition` 只共享可选的 `WinBoxWindow` viewport primitive，素材库与工具窗口 caller 必须分别 opt-in；与全屏 `improve-media-preview-accessibility` / `improve-media-editor-save-recovery` 不重叠。selection change 保留 `add-ai-input-paste-images`、`update-video-character-asset-reuse` 的允许类型并不改 `update-canvas-batch-flow-layout` 的布局。write-consistency change 保留 `media-cache-warnings` 的无逐卡远程探测、主体复用数据形态和当前 key/schema/provider route。freshness change只消费已提交source，保留write-consistency的commit owner和existing single-flight；不订阅尚未settle的task event、不加live polling/cross-tab push，也不接管selection/responsive。

**已知基线与本轮验收**：F-13 六文件窄簇在修改后为 6/6 文件、25/25 项、5.59s、退出 0；新增TTL缺陷诊断1/1文件、1/1项、87ms、退出0后已删除。Drawnix typecheck、全仓 typecheck、cycles、build 和 startup此前通过；全仓测试和 size 仍有既有失败，正式 Playwright 的历史阻塞由顶部新鲜基线更新，不能沿用旧“完全不可运行”结论。退出要求是主体投影、响应式控制可达、constraint 隔离、单/批选择完成语义、上传/删除/主体的真实 commit、closed-to-open新鲜度、部分失败/刷新/离线恢复均通过定向和宽验证；任何性能结论至少五次同条件前后样本，视觉结论需同数据/主题/视口前后证据。本轮四项待审批行为尚未实施，因此只能达到“事实调查完成、部分修复验证”，不能标记已验证。

### 23.2 正向、反向调用链、数据与状态不变量

**入口与窗口正向链**：统一画布入口从 `UnifiedToolbar` / 快捷工具栏进入 `drawnix.tsx:529-550`，把默认 `BROWSE` 或 caller 提供的 `SELECT` 配置写入 `mediaLibraryConfig` 并打开；`DrawnixDeferredFeatures.tsx:121-132` 延迟挂载 Modal 并传递 type、single/batch callback 和两个 label。AI 输入的直接入口为 `AIInputBar.tsx:5178-5187`，以 `SELECT + IMAGE` constraint 打开。Modal 在 `MediaLibraryModal.tsx:343-414` 创建 85% WinBox、桌面最小 800×500，并将 Grid 与桌面 Inspector 相连；`MediaLibraryModal.tsx:416-443` 在移动布局渲染既有 bottom Drawer。

**加载、筛选与最终 UI**：`AssetProvider` 挂载时初始化 localForage/playlist（`AssetContext.tsx:424-479`）；Modal open 同时调用 `loadAssets/checkStorageQuota`（`MediaLibraryModal.tsx:71-77`）。`AssetContext.tsx:762-888` 依次读取 localForage 本地记录、终态 task、统一缓存记录，按本地 content identity 去重、保留 AI 结果并按时间排序；React `assets` 是本会话可见 projection。Grid 当前只读取全局 `filters`，`MediaLibraryGrid.tsx:281-311,446-469` 调用 `filterAssets`，再叠加 playlist；grid/list/compact 由 `AssetItem.tsx:46-396` 显示预览、类型/AI/主体/同步/缓存警告、收藏和插入动作。桌面 Inspector 提供详情、重命名、主体、下载、删除和选择动作；移动端同一 Inspector 只有 Drawer 可见时可达。

**上传与配额链**：文件 input/拖入 → `MediaLibraryModal.tsx:204-294` 校验媒体/ZIP/100MB，逐个调用 `AssetContext.addAsset` → `AssetContext.tsx:1012-1094` → `asset-storage-service.ts:302-405` 内容哈希/去重/配额 → `unified-cache-service.ts:1223-1323` 先写 Cache API response、再写统一 IndexedDB metadata → localForage asset metadata → React merge → `navigator.storage.estimate` 配额与 Message/analytics。输入是 `File|Blob + AssetType/Source/name`，输出是 `Promise<Asset>`；公开 key/schema 未在本轮改变。

**选择与画布插入链**：Grid 点击写 local/global selected ID；Inspector/双击/批选 → `MediaLibraryModal.tsx:123-190` 用单一 `isSelectingRef` 去重、await callback、fulfilled 后 close、finally 清 pending。画布 creation toolbar 的 single/batch consumers 位于 `creation-toolbar.tsx:291-365`，quick toolbar 位于 `quick-creation-toolbar.tsx:208-236,259-324`；它们调用图片/视频/音频 helper 或共享 batch insertion，并显示 Message。其他直接 Modal callers包括 MV/video analyzer、fill、Markdown/KB、Chat、comic、batch generation 和 reference upload；审批后必须按同步 projection、local conversion、board insertion、persistent write 四类逐一核对 fulfill/reject 契约。

**主体链**：Inspector 表单 → `AssetContext.markAssetAsSubject`（`AssetContext.tsx:1471-1518`）→ `markAssetAsCharacter`（`character-asset-metadata-service.ts:23-57`）→ unified cache、AI task 或 local metadata → React 把同 ID/URL projection 更新为 `CHARACTER + characterMeta` → `AssetItem.tsx:144,221-231,353-363` 显示徽章/名称。主体名独立于素材 `name`，没有写图片二进制或 workflow 全对象。

**删除与反向链**：single Inspector → `MediaLibraryModal.tsx:322-341` 当前先按 URL/ID 删除画布元素，再 await `AssetContext.removeAsset`；batch → `MediaLibraryGrid.tsx:921-960` 同样 canvas-first。Context 根据 local/AI/unified-cache source 展开 dedupe IDs/URLs、更新 Cache/task/localForage/playlist，再更新 React；本地 service 当前在 `asset-storage-service.ts:584-613` 先删 cache 后删 metadata。反向从画布引用、playlist item、React card、task/local/unified metadata 和 Cache response 查 writer，均回到上述 single/batch path、上传 path、task completion 或主体 path；没有一个浏览器事务可同时覆盖这些 owner。

**并发、恢复、缓存与错误**：`loadAssetsPromiseRef` 合并同进程并发加载；成功后 `AssetContext.tsx:766-779` 有 8 秒 TTL。受控t=1s task+cache提交/notify/重开证明该TTL在source read前return，三源读取仍1/1/1、卡片0，age=8001ms后才2/2/2、卡片1；Provider没有task/cache/visibility/focus订阅。可见卡片的 `useUnifiedCache.ts:14-45` 各自读取 cacheInfo并订阅进程内cache notify，但不能创建缺失卡片，也不是多标签页完整projection同步。刷新重新从三类 durable source 合并；Cache API 不可用时当前读取保留 metadata，离线远程项依赖既有 cache warning/URL，未证明可播放即不作成功结论。失败通过 Context `error`、TDesign Message、console 诊断和 `asset_upload_success/failed`、`asset_delete` analytics 传播；上传埋点含 ID/type/source/size/MIME/error 文本，不含 blob 内容，但错误对象是否含供应商 URL 仍需在各调用边界持续审计。

### 23.3 问题证据、决策、验证与回滚

#### [F13-SUBJECT-BADGE-STALE-001]

**状态**：已证实并红绿修复；证据强度高（正式主体规格、确定性 React rerender、修复前后断言）。**用户影响/场景**：用户在素材详情把图片设为主体后，Context 已提交 `category/characterMeta`，但当前卡片可能继续没有“主体”徽章；再次修改主体名时 hover 仍可显示旧名，直到另一次导致 card 重渲染的 prop 变化。当前行为与 `update-video-character-asset-reuse` 的持久化后即时可复用表达不一致。

**复现、调用链与根因**：`AssetItem.test.tsx:64-95` 以同 ID 从 `GENERAL` rerender 为 `CHARACTER/红色跑车`；修复前找不到“主体”。`:97-132` 把同主体名 A 改为 B；修复前 B tooltip 为空。链路是 Inspector保存 → `AssetContext.tsx:1483-1505` durable writer成功后替换 asset object → `AssetItem.tsx:144,221-231` 读取可见字段 → 自定义 comparator。根因是旧 comparator只比较 id/name/cacheWarning/视图/选中等字段，漏掉了两个直接决定 DOM 的字段。影响网格和列表主体徽章/tooltip，不影响素材标题、缓存、schema、任务或工作流记录。

**方案、替代、风险、验证与回滚**：`AssetItem.tsx:399-414` 最小增加 `asset.category` 与 `asset.characterMeta?.name` 比较；删除自定义 comparator 会扩大所有 card render 面且没有性能测量，未选；比较整个 asset object会使上层无关 object replacement 全部重渲染，未选。风险是主体更新多一次必要 render。红测退出 1、2/2 按目标失败；绿测单文件退出 0、1/1 文件2/2项、57ms，F-13 窄簇 25/25 通过。回滚删除这两项比较和测试即可，无持久化恢复；回滚会重新暴露已复现的陈旧 UI。

#### [F13-MOBILE-VIEWPORT-001]

**状态**：实测缺陷，等待 `fix-media-library-responsive-interaction` 审批；证据强度高（当前源码、真实 Chromium DOMRect 和截图），发生频率未采集。**用户影响/复现**：当前源码、应用内 Chromium、浅色、100%缩放、`390×844`，从画布直接打开通用素材库。viewport 为 390×844；WinBox `left=29,right=829,width=800,top=64,bottom=781`，上传按钮 `left=781,right=817`，`documentScrollWidth=390`。窗口右部、上传和标题控制超出可视区域，文档本身没有滚动通道可抵达；预期是窄屏冷开、resize、orientation 后现有控制均在 viewport 内且桌面几何不变。截图为 `docs/evidence/f13-media-library/mobile-overflow-390x844.jpg`。

**调用链、根因与范围**：入口 → `MediaLibraryModal.tsx:343-363` 的 85% + `minWidth=800` → `WinBoxWindow.tsx:1210-1235` 只对 numeric dimension/minima resize、不重定位越界窗口 → `MediaLibraryModal.tsx:96-106` 虽切换 mobile layout仍保留桌面 minimum。影响小于 800px 的素材库现有操作，不影响素材数据、筛选或其他未 opt-in WinBox。

**候选方案、替代、风险、验证与回滚**：change 规定 caller opt-in 的 viewport fit，在可容纳时保留 800×500/85%，compact 时同时减 effective minimum、resize 和 reposition，不 remount、不持久化 automatic rect。只改 CSS/minWidth不能处理旧 x/y；全局约束所有 WinBox越出本 change；自动 maximize没有往返恢复契约，均未选。风险是与工具窗口共享 wrapper primitive冲突、快速 resize重复布局和移动控制拥挤。批准后先加 cold/resize/orientation/非 opt-in/identity 红测，做 1280/768/390/320/844×390 中英深浅/200%矩阵与至少5次 event-to-stable geometry。回滚移除素材库 opt-in/测试，无迁移。

#### [F13-MOBILE-DETAIL-001]

**状态**：已证实可达性缺陷，等待同一响应式 change 审批；证据强度高（唯一状态 writer 反查和同素材桌面/移动受控 DOM），真实屏幕阅读器矩阵待审批后验证。**用户影响/复现**：受控图片在桌面 Inspector 可看到重命名、主体、下载、删除；切到 `390×844` 后选择同卡片，无 Drawer且无这些详情动作。`MediaLibraryModal.tsx:53` 初值 false，全仓无 `setShowMobileInspector(true)`；`:118-121` 只有 close writer，`:416-443` 虽渲染 Drawer，`:108-116` 注释提到“详情按钮”但没有 DOM action。预期是不改变单击选中/批选的前提下，选中素材后有显式、可键盘和辅助技术识别的详情入口。

**调用链、根因与范围**：mobile detection → desktop Inspector unmount → grid select只写 selected ID → `showMobileInspector` 永远 false → Drawer/Inspector不可见。根因是状态机只实现关闭边，没有打开事件。影响移动端 rename/subject/download/delete/select details；双击预览和普通 card selection仍独立。

**候选方案、替代、风险、验证与回滚**：在选中素材时显示 localized details button，激活才打开现有 Drawer，关闭后保留 selection并尽可能还焦；自动单击开 Drawer会干扰浏览/批选，未选；重复实现第二个 mobile inspector未选。需验证无选中无可用空动作、virtualized card卸载焦点 fallback、Escape/Tab/触控尺寸。回滚删除 action/focus wiring/localization/tests即可，无数据影响。

#### [F13-FILTER-LEAK-001]

**状态**：实测缺陷，等待 `fix-media-library-selection-contract` 审批；证据强度高（真实 Chromium pressed state、截图、数据流静态反查）。**用户影响/复现**：在 1280×720 浅色、100%环境先从 AI Input 打开 image-only picker，确认 `图片：0 aria-pressed=true`，关闭后从画布打开通用素材库。通用入口仍为全部 false、图片 true、视频 false、音频 false；截图 `docs/evidence/f13-media-library/filter-leak-general-entry-1280x720.jpg`。预期 invocation constraint 只限制本次 picker，不修改用户原来的通用浏览 filter。

**调用链、根因与范围**：`AIInputBar.tsx:5178-5187` `filterType=IMAGE` → `MediaLibraryModal.tsx:79-87` 把 constraint 写入 `AssetContext.filters` → close无 restore → general open沿用同一 Provider状态 → `MediaLibraryGrid.tsx:446-469` 只读 global filters。更直接的静态证明是 Grid props 在 `MediaLibraryGrid.tsx:281-289` 未解构 `filterType/filterCategory`，因此显式 constraint 不能由 Grid独立执行。影响所有 constrained picker 与之后 general entry；search/source/sort/playlist存储格式不变。

**候选方案、替代、风险、验证与回滚**：保留 Context为用户 browse filter owner，以 `constraint ?? userFilter` 派生本次 effective predicate，并清除不符合新 invocation 的 selection；open/close snapshot restore会在并发/StrictMode/用户同时改 filter时恢复陈旧状态，未选；close总重置“全部”会丢用户偏好，未选。批准后以两类型/类别fixture覆盖 open/close/reopen、source/search/sort/playlist、constraint change，做同状态前后截图和5次 callback/ready测量。回滚恢复 effect/旧 predicate；无 schema/migration，但泄漏重新出现。

#### [F13-BATCH-LABEL-001]

**状态**：已证实静态契约缺失，等待 selection change 审批；证据强度高（公开类型、生产 caller、唯一 inspector输出）。**用户影响/当前与预期**：AI Input 和工具栏已分别传 `batchSelectButtonText`（例如 `AIInputBar.tsx:5185-5187` 的“批量插入对话框”），但 Modal `MediaLibraryModal.tsx:24-33` 没有解构该 prop，桌面/移动 Inspector只收到 `selectButtonText`；`MediaLibraryInspector.tsx:57-70,302-318` 也只使用 single label。批量动作因此显示错误的单选文案。预期 single/batch分别使用对应 label，未传 batch时保留当前默认。

**调用链、根因与范围**：caller config → `DrawnixDeferredFeatures.tsx:123-132` 正确透传 → Modal prop截断 → Inspector batch button复用 single label。根因是公共 contract 在两个组件边界未贯通。仅影响 SELECT模式 action文本，不影响选择集合、callback或插入布局。

**候选方案、风险、验证与回滚**：把 batch prop贯通 Modal→两端 Inspector并在 batch action单独 fallback；删除公共 prop会破坏既有 caller意图，复用 single label已由静态链证伪。验证 distinct/omitted label、count suffix、中英/320px溢出；回滚 prop wiring/tests即可，无数据影响。

#### [F13-INSERT-FAIL-CLOSE-001]

**状态**：已证实可达控制流缺陷，等待 selection change 审批；证据强度高（await/fulfilled语义和两个生产 consumer），实际浏览器插入失败频率未知。**用户影响/复现**：在单选 insertion helper reject，或 batch executor返回 `{success:false}` 时，creation/quick toolbar先显示错误但其 Promise仍 fulfilled；Modal于是执行 `onClose`，用户选择与筛选消失，无法直接重试。`MediaLibraryModal.tsx:123-190` 本身正确地只在 await fulfilled 后关闭，且 `docs/MEDIA_LIBRARY_INSERTION_LESSONS.md:107-121` 记录“成功后再关闭”。当前与文档/预期冲突。

**调用链与根因**：single：Modal → `creation-toolbar.tsx:291-314` / quick `:208-236` catch吞异常 → fulfilled → Modal close；batch：Modal → creation `:318-364` / quick `:259-324` 把 result failure只转 Message并正常 return，quick还关本地 UI。根因是 consumer把“已显示错误”当成 callback成功，跨层 Promise contract失真。影响画布两个可达插入入口；已经成功插入的部分结果不能在没有 per-item outcome时自动回滚。

**候选方案、替代、风险、验证与回滚**：consumer在保留既有单次安全 Message后 rethrow/throw，Modal内部捕获 rejection、保持 modal/selection/effective filters、清 pending且不产生 unhandled rejection；自动重试/队列是新功能，未选；让 rejection逃出 event handler会制造未处理异常，未选。风险是部分 batch可能已有成功画布元素，故保留选择只供人工核对且不自动重复提交。批准后用 deferred promise覆盖 success/reject/double activation/retry/unmount和所有直接 caller审计。回滚恢复 fulfilled-on-error与旧 Modal handler，无持久化迁移。

#### [F13-STORAGE-WRITE-CONSISTENCY-001]

**状态**：实测的跨存储 commit缺陷，等待 `ensure-media-library-write-consistency` 审批；证据强度高（确定性 failure injection + 静态顺序），浏览器真实失败率和跨标签竞态未知。**用户影响/复现环境**：Node 24.14.0、Vitest 3.2.4、jsdom、deterministic localForage/unified-cache/Cache API mocks；临时诊断 1/1文件、3/3项、17ms、退出0，随后删除以免把错误行为固化为契约。原始值：(1) cache success后 metadata add reject：`cacheMediaFromBlob=1, deleteCache=0, ADD_FAILED`；(2) cache delete success后 metadata remove reject：`deleteCache(url)=1, removeItem(id)=1`，fixture metadata仍可读，`REMOVE_FAILED`；(3) Cache API可读且 `keys=[]` 时 `getAllAssets()`仍返回 `/asset-library/` record。当前可留下无 owner cache、或保留指向已删除媒体的 metadata，并把“可读空 cache”误当“无法判断”；预期一个 truthful success/partial/failure边界。

**调用链、根因与影响**：上传 `asset-storage-service.ts:332-405` → `unified-cache-service.ts:1251-1323` → localForage；删除 `asset-storage-service.ts:584-613` 反向执行；读取 `asset-storage-service.ts:426-457` 以 `validCacheUrls.size>0` 才过滤。根因是三个不同存储无事务，代码也没有“本次新建/既有共享”的补偿信息或 cache availability状态。影响本地上传/刷新/删除和配额；content-addressed cache可能被其他 merged record/task共享，不能盲删。

**候选方案、替代、风险、验证与回滚**：按 source定义 authoritative owner，记录 attempt前 cache是否存在；晚期必需写失败只补偿本次新建且当前无引用的 cache；删除先 snapshot/remove metadata，cache失败时恢复并返回显式 partial；available-empty、available-with-keys、unavailable/error分开。引入通用 distributed transaction/repository/event bus无证据且过度设计，未选；所有失败都删 cache有用户数据风险，未选；持久 journal改变schema，现阶段未选。风险是补偿本身失败/跨标签竞态、额外 IDB操作和代表 card变化。批准后每一边界红测、共享cache guard、restore失败、五次正常/失败 add/delete/load操作数和时延、刷新/离线/两标签验证。回滚恢复顺序/result类型并保留容错 read，不做cache purge或迁移。

#### [F13-DELETE-CANVAS-FIRST-001]

**状态**：已证实静态顺序缺陷，等待 write-consistency change审批；证据强度高（唯一 action path和 await顺序），实际存储失败频率未知。**用户影响/当前与预期**：single在 `MediaLibraryModal.tsx:322-341`、batch在 `MediaLibraryGrid.tsx:921-960` 都先删除画布元素，再调用 durable删除。后者 reject时画布内容已丢而素材仍存在；预期未 commit的素材及画布引用都保留并可重试，partial batch只移除成功项。

**调用链、根因与范围**：确认删除 → 按 cache URL或asset ID调用 Plait transforms → durable Context/service → error Message。根因是把不可持久化的 canvas mutation当作预处理，且 Context `void`结果不能表达 per-item commit。影响引用被删素材的当前 board和history，不应扩展为删除所有历史board或新建全局引用索引。

**候选方案、替代、风险、验证与回滚**：durable结果先 settle，再按 succeeded IDs/URLs在一个既有 history boundary内删除对应 canvas元素；用 Plait undo补偿失败不能跨刷新保证durability，未选。风险是 durable commit后页面在canvas mutation前关闭，需以刷新projection和明确partial diagnostics复核，但优于先丢画布。批准后覆盖single/batch success/failure/partial与无关元素不变。回滚恢复canvas-first，无schema变化但风险重新出现。

#### [F13-BATCH-DELETE-PROJECTION-001]

**状态**：已证实的 partial-success投影缺陷，等待 write-consistency change审批；证据强度高（`Promise.allSettled`结果到React predicate的完整静态链）。**用户影响/当前与预期**：`AssetContext.tsx:1211-1390` 收集 `successIds/errors`，但 `:1350-1358` 只要某 dedupe key出现在请求集合就隐藏整个 group，不检查失败record是否仍存在；`:1375-1380` warning后正常 resolve。Grid随后 `MediaLibraryGrid.tsx:953-956` 清空全部 selection并退出批选。混合失败时剩余可用record不可见、失败项不可直接重试；预期从实际剩余 authoritative records重建group，失败项保持可见/选中，并返回逐项结果。

**调用链与根因**：selected cards → 展开 dedupe IDs/URLs → per-record allSettled → request-level dedupe-key filter → warning/fulfilled → Grid clear selection。根因是内部已有逐项结果却被 `Promise<void>` 和 request-level projection压扁。影响本地merged group、playlist cleanup、batch UI和canvas删除；成功独立项不应回滚。

**候选方案、风险、验证与回滚**：返回 structured succeeded/failed/cleanup-partial，按实际剩余 records/cache metadata重建 affected group，selection按content identity保留失败项，playlist只清commit项。全批all-or-nothing无法跨store原子回滚，未选。风险是representative card ID变化，必须验证favorite/details/canvas references。回滚result/reconcile/tests即可，不迁移数据。

#### [F13-SUBJECT-WRITE-CONSISTENCY-001]

**状态**：已证实静态 false-success/partial-write路径，等待 write-consistency change审批；证据强度高（所有source分支与boolean contract），实际失败率未知。**用户影响/当前与预期**：`character-asset-metadata-service.ts:23-57` 先写 cache metadata并忽略 `updateCachedMedia` boolean；cache-only返回 false仍直接成功，AI task/local后续失败时cache已经先改变。`AssetContext.tsx:1471-1518` 只有整个函数resolve才更新React，因此失败后刷新可能从cache投影出主体，而当前UI未提交/操作报错。预期 local、AI、cache-only按各自 authoritative store成功后才显示，false或authority reject不能报clean success，partial需reconcile。

**调用链、根因与范围**：Inspector subject form → cache-first helper → source branch task/local → React badge/message。根因是把cache projection当所有source的第一 authority并丢弃其“没有目标”返回值。影响主体category/name/prompt，不改变素材title/media或workflow lightweight引用。

**候选方案、替代、风险、验证与回滚**：先写source-authoritative local/task；cache-only把false当failure；secondary cache projection失败强制read/reconcile并报告partial，React永不从failed authority预先提交。只在catch反向再写旧metadata没有稳定旧快照且补偿也会失败，未选。批准后覆盖local/AI/cache-only、false、task/local reject、secondary failure、refresh。回滚恢复cache-first/helper行为，不迁移schema。

#### [F13-LOAD-TTL-STALE-002]

**状态**：已证实，等待`refresh-media-library-projection-on-open`审批；原`F13-LOAD-TTL-STALE-HYP-001`已由受控时序取代。**用户影响/复现/当前与预期**：Node24.14、Vitest3.2.4、jsdom、fake clock，t=10000空源初始化后三类reads=1/1/1、cards=0；t=11000提交1个completed image task与匹配cache metadata、投递全部cache subscriber并按Modal open调用`loadAssets`，reads仍1/1/1、cards仍0、Provider cache subscribers=0；t=18001再次调用才reads=2/2/2并显示`task-new`。当前用户快速重开会看到旧快照且无loading/stale表达；候选预期是closed→open开始前已提交的source在该次settled projection出现。

**完整调用链、根因与范围**：`drawnix.tsx:869-936`持久Provider包住`DrawnixDeferredFeatures.tsx:121-133`条件Modal；`MediaLibraryModal.tsx:71-77`open→无参数`loadAssets`；`AssetContext.tsx:74,766-779`以成功年龄在三源读取前return；eligible path`:787-897`才读local/task/cache并发布React/global map。反向从task完成`task-queue-service.ts:472-484,834-866`和cache settle/notify`unified-cache-service.ts:1301-1318,1445-1468`都找不到AssetContext subscriber；单卡`useUnifiedCache`订阅不能创建缺失card。根因是persistent-provider background reuse与用户visible-open共用无freshness intent的API，TTL没有source generation/invalidation。影响已确认task/cache及所有不直接写本Context projection的durable writer；`addAsset :1022-1076`直接setAssets是负对照，不归入缺陷。already-open live appearance与发生频率未定义/未测，不扩大结论。

**候选/替代、风险、验证与回滚**：最小方案为existing load owner增加scoped visible-open intent：先共享in-flight，再只对真实closed→open绕过success-age return；background保留TTL，失败不清old cards/不推进success timestamp，下次open重试。不全局删TTL、不以cache-only listener触发三源reload、不投影可能先于durable settlement的task event、不poll、不remount Provider。风险是每次真实重开的三源读取、StrictMode重复effect和init/open snapshot边界；批准后先永久红测task/cache/local/overlap/failure/retry/read counts，再在隔离browser origin对0/100/1000项前后各5次，1,000项median>250ms或出现≥50ms long task则暂停而非放宽freshness。回滚freshness参数/Modal调用/tests即可，无data/cache/schema恢复。完整证据见`docs/evidence/f13-media-library/ttl-diagnostics.md`与`ttl-metrics.json`。

### 23.4 实际改动、验证、性能/视觉、规格与退出判断

**实际改动与根因映射**：唯一生产修复仍是 `AssetItem.tsx:399-414` 的memo可见字段比较，永久测试仍只新增 `AssetItem.test.tsx:64-132` 两项回归。F-13现有四项独立approval-only OpenSpec change；本次新增freshness change四个文件与`ttl-diagnostics.md`/`ttl-metrics.json`，临时缺陷诊断已删除。没有实施compact fit、mobile details、constraint隔离、label wiring、callback rejection、storage compensation、delete result、cache availability或visible-open freshness；没有改CSS、asset/task/board schema、cache key、migration、provider route或用户数据。

**窄验证**：主体修复红测退出1，2/2目标断言失败；绿测 `pnpm --dir packages/drawnix test packages/drawnix/src/components/media-library/AssetItem.test.tsx` 退出0，1文件2测试、57ms。最终F-13六文件集合退出0，6/6文件、25/25项、5.59s。`pnpm nx typecheck drawnix`退出0；对 `AssetItem.tsx` 与 `AssetItem.test.tsx` 的定向ESLint退出0。受控多存储诊断退出0、1/1文件3/3项、17ms；TTL诊断退出0、1/1文件1/1项、87ms、Vitest2.00s、wall3.30s；两类临时诊断均已删除且只证明当前缺陷，不作为长期pass契约。

**全仓回归**：默认 `pnpm test` 首次退出1且未运行产品测试，Nx报“本地cache artifact不是本机生成”，分类为工具配置失败；未执行 `nx reset`。`NX_SKIP_NX_CACHE=true pnpm test` 进入真实测试后退出1：183文件177通过/5失败/1跳过，1147项1142通过/4失败/1跳过，另1个未处理异常，总时166.33s。失败为cached image conversion、GPT Blob mock、Sora duration、PPT settings mock suite、task-queue retry全仓负载超时及benchmark kvStorage mock异常；timeout文件单独复跑退出0、1/1文件10/10项、1.79s，原超时用例1.035s。F-13新增2项全部通过，未出现F-13失败。`pnpm typecheck`退出0、5/5项目；`pnpm check:cycles`退出0。

**lint、构建、启动与体积**：`pnpm lint`退出1，继续扫描包内`node_modules`，输出约847KB；示例 `react-board` 为3143 problems（1144 errors/1999 warnings），并混有项目既有e2e/source项，分类为无效全仓门禁/第三方噪声，未在F-13盲修。`pnpm build:web`退出0，app 7,930 modules、1m39s，SW 54 modules、1.45s、43.12kB gzip；构建更新 `apps/web/public/version.json.buildTime`，无Git元数据无法恢复历史值。`pnpm verify:startup`退出0，CSS 14,208B、startup app 3,776B、runtime 1,867B、entry345B、chunk cycles空。`pnpm size`退出1：Startup 1.94kB、Runtime1.01kB、Diagram934.93/950、Office269.19/300、Editor858.24/870、Media Viewer12.19/20均在预算；AI Chat844.24/140kB超704.24kB，与F-12新鲜构建一致，是既有唯一超限，不能归因于两项comparator比较。

**性能与视觉证据**：主体修复没有至少五次React commit/操作前后样本，不宣称更快、更省内存或包体更小。TTL 87ms是jsdom测试用例时长，不是IndexedDB产品性能；0/100/1000项browser五次样本尚未执行，不能称TTL为性能瓶颈或声称候选更快。响应式DOMRect仅一次缺陷复现，不是性能统计。生产CSS未改，因此没有“更美观”结论；两张JPEG经`file`验证分别为390×844和1280×720，只是修复前证据。待审批行为没有修复后截图。F-13旧“Playwright完全阻塞”已被顶部新鲜全局基线部分取代，但本功能仍无批准后同状态after或专属正式flow。

**OpenSpec人工校验与回滚**：四项change均有4个必需文件，delta都使用`## ADDED Requirements`且每项至少一个`#### Scenario:`；freshness为3 requirements/6 scenarios/20 tasks/4 checked、6 WHEN/6 THEN，3个名字全仓唯一。`media-library` deliberate四owner由write/selection/responsive/freshness分权，不能声称capability单owner。`openspec validate refresh-media-library-projection-on-open --strict`退出127，CLI不可用，属于工具阻塞而非通过。主体修复可独立回滚comparator两项和测试；四项proposal也可各自删除，均无迁移。由于当前目录没有Git元数据，无法生成可信diff、核对历史或声明工作树干净。

**当前退出判断**：F-13 为**调查完成、部分修复已验证、其余实施阻塞，未达到退出标准**。`F13-SUBJECT-BADGE-STALE-001`已完成红绿与宽回归；响应式/移动详情、筛选/标签/失败保留选择、多存储真实commit/删除投影/主体authority和closed-to-open新鲜度分别等待四项用户审批。TTL假设已升级为`F13-LOAD-TTL-STALE-002`确认问题，不再列为未知；但browser性能、already-open live意图、跨标签/离线/刷新/失败重试、同状态after和专属正式Playwright仍未闭合。可独立继续下一个功能调查，但不得把F-13标为已验证；任一change获批后应回到F-13，按tasks先红测再实施和复审。

## 24. F-23 知识库编辑、搜索、媒体、导入导出与生成上下文循环

### 24.1 功能、用户场景、范围、规格与验收门禁

**用户场景**：用户打开知识库，创建/重命名/分类笔记，编辑 Markdown 和标签，搜索或查看相关笔记，嵌入素材，导入/导出/备份/GitHub 同步，将笔记插入画布，并在生成任务执行时作为轻量引用上下文。

**范围**：`built-in-manifests.tsx:148-156` 与 `tools/registry.tsx:33-37` 可达入口；`drawnix.tsx:403-454` 窗口打开/定位；`KnowledgeBaseContent.tsx`、`KBUnifiedTree.tsx`、`KBNoteEditor.tsx` 及相关/提取/标签 UI；`knowledge-base-service.ts`的六个 localForage store；`kb-search-engine.ts`；`kb-import-export-service.ts`、backup shared core 和 GitHub KB sync；Markdown `asset://` 编辑/只读渲染；`generation-context-service.ts`到 task queue 执行边界。**非范围**：F-13 素材库内部写入语义、F-10 任务取消/重试、F-15 全局 WinBox 窗口语义、新的云知识库/协作能力和未审批的产品行为。

**正式规格与活动 change**：已核对 `openspec/specs/markdown-media-embeds/spec.md`、`canvas-markdown-toolbar/spec.md`、`backup-restore/spec.md` 和已完成的 `add-generation-context-library`。下表七项新 change 都有 proposal/design/tasks/delta spec 四个必需文件，delta 均为 `## ADDED Requirements` 且每个 requirement 至少一个 `#### Scenario:`；全仓精确 requirement 名搜索只命中各自 delta。OpenSpec CLI 不可用，因此这是人工结构/冲突核验，**不是 strict validation 通过**。

| change | 所有的可观察语义 | 相邻冲突边界 | 状态 |
|---|---|---|---|
| `fix-knowledge-base-editor-save-durability` | 合并标题/正文 draft、切换/卸载 flush、saving/failed/retry | 不承诺进程终止/断电 durability，不修多 store transaction | 等待审批 |
| `fix-knowledge-base-search-result-ordering` | 只允许最新 query/filter 提交搜索结果 | 不合并独立change拥有的索引build/sync单飞 | 等待审批 |
| `stabilize-knowledge-base-search-index-initialization` | cold build/warm sync单一in-flight owner、共享settlement与结算后retry | 不接管UI latest-query、TF-IDF、persistent index或multi-store transaction | 等待审批 |
| `ensure-knowledge-base-write-consistency` | CRUD、tag、导入/同步的 scoped compensation 与 partial result | 保持 schema/backup version，不引入通用分布式事务 | 等待审批 |
| `fix-knowledge-base-responsive-layout` | 知识库 opt-in viewport fit 和 compact pane 导航 | 复用 `fix-tool-window-viewport-transition` 的窗口原语；本 change 所有内部 pane 与 compact 44px 目标 | 等待审批 |
| `improve-knowledge-base-accessibility` | 树/菜单/图标动作语义、键盘和 focus return | 不接管 compact 44px；名称复用 localization 消息源 | 等待审批 |
| `localize-knowledge-base-interface` | zh/en UI、日期/计数、系统目录显示别名、新默认标题 | 不翻译/迁移旧目录、笔记、标签、Markdown 或 Skill 数据 | 等待审批 |

**进入本轮的基线与验收**：初始窄测为 6/6 文件、25/25 项、退出 0。验收要求是正常/空/加载/失败/取消/重试/切换/刷新/离线的状态契约和正反调用链闭合；未通过审批的保存、搜索、多 store、响应式、可访问性和本地化不实施。缺失素材修复是恢复现有 `markdown-media-embeds` requirement；两组无消费者清理不改可达行为，均无需新审批。

### 24.2 当前完整正向/反向调用链、数据与状态不变量

**入口与 UI owner**：工具箱 manifest `built-in-manifests.tsx:148-156` → registry 懒加载 `tools/registry.tsx:33-37` → `tools/tools/knowledge-base/index.tsx:6-45` → WinBox 900×700 → `KnowledgeBaseContent`。工具栏 toggle 和画布 Card/popup 深链分别经 `drawnix.tsx:403-422` 和 `kb:open`/`kb:open-note` `:424-454`。React 状态的 owner 是 `KnowledgeBaseContent.tsx:60-314`：目录/笔记 meta/标签/选中/展开/搜索/右栏/宽度；编辑 draft、语音、Skill output type 和素材插入对话属于 `KBNoteEditor.tsx:74-185,255-273`。

**编辑、持久化与画布投影**：标题/正文 DOM event → 同一 500ms `saveTimeoutRef` `KBNoteEditor.tsx:80,141-175` → async `KnowledgeBaseContent.handleUpdateNote` `:567-603` → `knowledgeBaseService.updateNote` → `noteContentsStore` 后 `notesStore` `knowledge-base-service.ts:324-350` → React `allNotes/currentNote` → `window.__drawnixBoard` 上已关联 Card `Transforms.setNode`。六个 localForage instance 为 directories/notes/tags/noteTags/noteContents/noteImages（`knowledge-base-service.ts:33-72`）；正文与 meta 分离，`getNoteById` 兼容 meta 中的旧 content `:279-287`。当前没有跨 store transaction/journal，也没有编辑保存 cancel token/retry UI。

**目录、标签与搜索**：树行 create/select/rename/delete/duplicate/context menu → `KnowledgeBaseContent` handler → KB service → refreshData → tree/editor/right panel。新笔记默认为「新笔记」或「新Skill」并按目录内标题加数字（`KnowledgeBaseContent.tsx:541-565`）。搜索输入/selectedDirId → 300ms timer → 单例 `KBSearchEngine.search` → `ensureIndex` 扫描 meta/content → TF-IDF/cosine 结果 → `semanticResults` → tag filter/order → tree（`KnowledgeBaseContent.tsx:316-350`、`kb-search-engine.ts:91-213,405-416`）。`KBRelatedNotes.tsx:34-47`与registered `search_notes` MCP `knowledge-base-tool.ts:69-121`使用同一singleton/readiness；UI当前只clear timer、没有request identity，engine也没有in-flight build/sync owner，两根因分别由两个独立change拥有。

**Markdown 媒体**：编辑器从素材库选择 `Asset` → `buildBlockAssetEmbedMarkdown` 写入 `asset://id`（`KBNoteEditor.tsx:257-265`）→ Markdown 保存→编辑 NodeView 或 `MarkdownReadonly`读取模块级 asset projection。`AssetContext.loadAssets` 合并 local/task/Cache API（`AssetContext.tsx:766-897`）并发布 `idle/loading/ready/error` 和 map（`asset-map-store.ts:11-43`）；三个 consumer 在 projection 未 ready 时显示 loading，ready 且 ID 不存在时显示永久缺失占位（`MarkdownReadonly/index.tsx:1087-1116`、asset NodeView `:80-85,285-294`、image NodeView `:142-154,320-329`）。asset cache key/失效属 F-13，本轮不改。

**导入、导出、备份和 GitHub**：UI → JSON/ZIP/Markdown adapter `kb-import-export-service.ts:48-313` → six stores。ZIP 导出并行读笔记，ZIP 导入先建目录、后并行导入笔记（`:92-182`）。完整备份复用 `apps/web/public/sw-debug/shared/backup-core.js:367-452`；backup replace 先 clear KB 再导入（`backup-import-service.ts:175-188,235-253`）。GitHub 正反向为 sync engine → `knowledgeBaseSyncService.merge/apply` → directories/tags/note meta/content/noteTags/images 顺序 upsert（`knowledge-base-sync-service.ts:170-224`）→ sync result/log。网络、Gist 凭据、加密和跨设备冲突属 GitHub 边界；无凭据时本地编辑/搜索/导出仍可用。

**生成上下文反向链**：最终 provider prompt/task `promptMeta.knowledgeContextRefs` ← `TaskQueueService.resolveTaskKnowledgeContext` `task-queue-service.ts:502-541` ← `buildKnowledgeContextBlock` 按 noteId 从 KB stores 读正文（`generation-context-service.ts:143-213`）← AI input/workflow/KnowledgeNoteContextSelector 的轻量 refs。默认上限为 10 篇、每篇 3,000 字符、总计 12,000（`:8-10`）；missing/empty/limit 被跳过，video 仍有 prompt 长度上限。刷新后只要 KB stores 与 task refs 存在即可重建；离线可读本地笔记但不能完成需网络的生成。

**错误、取消、日志与测试边界**：UI handler 主要以 TDesign Message/console 传播 import/export/storage 错误；编辑 timer 没有真实的取消/失败/重试状态，搜索 catch 把结果置 null。Related search catch投影空engine result并保留fallback；MCP catch返回失败对象。GitHub 通过 unified sync log 记录计数/ID/错误；本轮静态阅读没发现新增 secret/全文日志，但没有做独立隐私运行采样。正式测试位于 Markdown asset/media-size utils、`kb-import-export-service.test.ts`、GitHub `kb-sync.test.ts`、`generation-context-service.test.ts`、queue passthrough 和 `KnowledgeNoteContextSelector.test.ts`；未找到永久`KBSearchEngine`/related/MCP search测试，仓库没有 F-23 专属 Playwright flow。

### 24.3 问题证据、决策、风险、验证与回滚

#### [F23-MISSING-ASSET-PLACEHOLDER-001]

**状态**：已证实并修复；证据强度高（正式 spec + 三个渲染面红测 + 绿测）。**用户影响/复现/当前与预期**：素材投影已加载但库为空时，打开包含已删除 `asset://id` 的笔记；修复前 `MarkdownReadonly`、video/audio NodeView 和 image NodeView 都停在 loading skeleton，与 `markdown-media-embeds` 要求的可见缺失占位冲突。临时红测 1/1 文件、3/3 失败、退出 1；预期是 loading 只在 projection 未完成时出现，ready-empty 显示「素材不存在或已删除」。

**调用链/根因/方案**：AssetProvider → module map → three renderers → loading/missing UI；根因是把 `map.size===0` 同时当作「未加载」和「已加载且无资产」。`asset-map-store.ts:11-39` 新增 `idle/loading/ready/error`，`AssetContext.tsx:462-474,781-897,967-978,1558-1564` 发布真实状态，三个 consumer 按 status 分支。只给缺失 ID 加 timeout 不能区分慢加载，未选。**风险/验证/回滚**：风险是 Provider 初始空数组被误发 ready，因此 `lastSuccessfulLoadRef` 守卫只在首次成功后投影。正式测试 `markdown-asset-missing-state.test.tsx:67-145` 最终 4/4，Markdown 四文件 18/18，F-23 聚合 41/41，typecheck/build 通过。回滚 status/store/Provider/three consumer 和新测试即可，无 schema/cache key/迁移。

#### [F23-EDITOR-CROSS-FIELD-DROP-001]

**状态**：已证实，等待 editor-durability change 审批。**用户影响/复现/证据**：输入新标题，500ms 内编辑正文；受控组件诊断中标题 save callback 为 0、正文 callback 为 1，标题丢失。诊断合计 1/1 文件、3/3 项、90ms、退出 0，文件随后删除，不把错误行为留为长期 pass 契约。当前标题和正文互相取消；预期同一 draft 的两字段合并持久化。

**调用链/根因/候选/风险/验证/回滚**：两个 input handler → 同一 `saveTimeoutRef` `KBNoteEditor.tsx:80,141-175` → `onUpdateNote`；后一字段的 `clearTimeout` 删除前一字段 payload。候选是用 note-scoped draft snapshot 合并所有 dirty fields 并串行 commit；两个独立 timer 仍会产生乱序 meta/content save，未选。风险是保存中继续输入和 stale completion；批准后先红测 field merge/save-in-flight/reject/retry，再用 revision 守卫验证。回滚 draft coordinator/status UI 即可，不迁移数据。

#### [F23-EDITOR-TRANSITION-DROP-001]

**状态**：已证实，等待同一 editor-durability change 审批。**用户影响/复现/当前与预期**：输入后 500ms 内切换笔记或关闭知识库；诊断两条路径的 save callback 均为 0。`note?.id` effect `KBNoteEditor.tsx:106-139` 和 unmount cleanup `:267-273` 直接 clear timer，待保存 payload 不可恢复。预期是在释放旧 editor state 前启动该 note 的 pending commit，不把未 settle 的结果标为已保存。

**根因/方案/风险/验证/回滚**：根因是 timer 被当成 draft owner，而不是调度器。候选是 transition/unmount 同步启动 async flush、用 note ID/revision 绑定 payload；不承诺浏览器进程被强杀或断电后持久。localStorage 全文 journal 会新增隐私/容量/迁移语义，未选。风险是 old note completion 覆盖 new note UI，必须以 note ID 隔离。批准后覆盖 switch/unmount/in-flight 输入和刷新边界；回滚 flush/revision/tests，无 schema 回滚。

#### [F23-EDITOR-SAVE-ERROR-001]

**状态**：已证实的静态 Promise contract 缺陷，等待 editor-durability change 审批；真实 IndexedDB reject 频率未知。**用户影响/当前与预期**：`KBNoteEditor` 把 `onUpdateNote` 定义为 void，timer 中不 await/catch `KBNoteEditor.tsx:147-160`；实际 consumer 是 async IDB+canvas `KnowledgeBaseContent.tsx:567-603`。reject 时没有 saving/failed/retry UI，且会形成未处理 Promise；预期是如实呈现失败并在 editor 仍挂载时保留可重试 draft。

**方案/风险/验证/回滚**：将 callback 明确为 `Promise<void>`，用 revision-aware save state 串行、显示 saving/saved/failed 和显式 retry。只加 `.catch(console.error)` 仍会对用户谎报，未选。风险是 retry 使用过期 payload 和快速输入状态闪烁；批准后用可控 deferred rejection/resolve 与焦点/文案测试验收。回滚 Promise/status/retry UI 与测试。

#### [F23-SEARCH-RACE-001]

**状态**：实测，等待 search-ordering change 审批；证据强度高（受控 Promise 乱序）。**用户影响/复现/原始时序**：查询 A 启动，后输入 B；B 先 resolve 后 UI 显示 B，A 迟到 resolve 后 UI 被覆盖为 A，与当前输入 B 不一致。临时诊断 1/1 文件、1/1 项、93ms、退出 0，随后删除。

**调用链/根因/方案/风险/验证/回滚**：query/dir → timer → `engine.search` →任意完成顺序 → 无条件 `setSemanticResults` `KnowledgeBaseContent.tsx:316-336`。cleanup 只清 timer，无法取消已启动 Promise。最小方案是 monotonically increasing request ID/query+filter snapshot，只最新 request 可 commit；改写 search engine 或引入全局 request manager 超出范围。风险是 clear query/unmount 后迟到 commit，必须同样 invalidate。批准后将当前诊断转为正式 A/B、filter、clear、reject 测试；回滚 request guard/tests，无数据影响。

#### [F23-STORAGE-CONSISTENCY-001]

**状态**：实测的多 store 部分提交，等待 write-consistency change 审批；证据强度高（deterministic localForage failure injection），真实存储失败频率未知。**复现/原始结果**：临时诊断 1/1 文件、4/4 项、8ms、退出 0，随后删除；(1) create 正文写 reject 后 meta 仍存在，形成 ghost note；(2) update meta 写 reject 后是新正文+旧标题/时间；(3) delete meta remove reject 后标签和正文已删、meta 仍在；(4) `setNoteTags` 第一个新关联写 reject 后旧标签已全清空。预期是成功才报 commit，失败时恢复 scoped snapshot 或返回真实 partial result。

**调用链/根因/方案/风险/验证/回滚**：CRUD/tag UI → `knowledge-base-service.ts:290-362,524-537` →多个独立 IDB transaction；代码顺序 await，后续 reject 不回滚早期写。候选是每个 operation 先读最小 snapshot，按不变量排序写，失败做 bounded compensation 并返回 structured outcome；通用 Repository/事件总线和新 journal schema 没有证据，未选。风险是 compensation 也失败或两标签页竞态，必须呈现 partial 而非谎报 rollback。批准后把四项 failure injection 转为红测，加 compensation-failure/刷新/两标签并记录五次正常/失败操作数与时延。回滚 operation result/compensation/tests，保留现有 schema/version，不清理用户数据。

#### [F23-BATCH-IMPORT-SYNC-PARTIAL-001]

**状态**：已证实的静态顺序，等待 write-consistency change 审批；真实 ZIP/Gist 失败样本未测。**用户影响/当前与预期**：备份 import core 依次写 directory/tag/note meta/content/noteTag/image（`backup-core.js:378-449`），GitHub apply 依次写同类数据（`knowledge-base-sync-service.ts:185-223`）。任一后续 await reject 时 JS 立即抛出，早期 stores 已提交；backup replace 还在导入前 clear KB。上层 `backup-import-service.ts:242-252` 折叠为整域失败计数，不返回已提交对象。预期是 merge/replace/sync 都报告真实 commit，并在 replace 前具备可恢复 snapshot。

**根因/方案/风险/验证/回滚**：根因是批处理复用多 store adapter，却只有 all-success count/throw 契约。候选是执行前保留本域 scoped snapshot，统一 per-entity committed/failed/compensationFailed result；replace 只在 snapshot 可恢复后 clear。将所有数据塞入一个 IDB record 会改 schema/性能/兼容，未选。风险是大库 snapshot 内存/时延和 Gist merge 竞态，必须五次小/大 fixture 测量并守住现有 backup v1/v2。批准后 failure-inject 每个 store boundary、merge/replace/GitHub apply/刷新对账；回滚 adapter result/snapshot/tests，不删存量数据。

#### [F23-RESPONSIVE-001]

**状态**：实测的可达性/几何问题，等待 responsive change 审批。**环境/复现/原始值**：应用内 Chromium，390×844 CSS px、DPR 1、浅色、100% 缩放；打开知识库 WinBox。`.kb-drawer__body clientWidth=389, scrollWidth=982`；左栏 280px，editor 400px 从 x=471 开始，右栏 300px 右边界 x=1172，三个 editor title action 全在 viewport 外；WinBox x=190,width=400,right=590。截图/原始 JSON 为 `docs/evidence/f23-knowledge-base/knowledge-base-390x844-before.png` 与 `...-metrics.json`，图片经 `file` 验证为 390×844 JPEG。CSS `knowledge-base-drawer.scss:8-23,69-90` 的 non-shrinking 280 + min 400 + 300 布局与运行几何一致。

**当前/预期/方案/风险/验证/回滚**：当前 compact 用户需水平滚动穿过 982px 且主编辑动作不可见；预期窗口适配 viewport 且树/editor/details 可导航，不覆写桌面保存宽度/编辑 draft。候选是仅知识库 opt-in 窗口 fit + container-driven single-pane navigation；把三栏全压到390px或改全局 WinBox 超出证据范围。风险是 breakpoint 往返 remount editor、丢 draft/focus、写坏 desktop width。批准后在320×568、390×844、844×390、tablet/desktop、light/dark 记录同 fixture DOMRect/scrollWidth/focus/前后截图，compact target ≥44×44。回滚 opt-in/observer/pane UI/styles/tests，不需 preference 迁移。

#### [F23-A11Y-001]

**状态**：已证实，等待 accessibility change 审批；证据为精确 DOM contract + 浏览器属性样本，未推断具体读屏器兼容。**用户影响/复现**：仅用键盘进入目录/笔记树、系统 Skill 或右键菜单；`KBUnifiedTree.tsx:241-330,394-454,467-503,559-614` 使用 pointer-only `div onClick` 和无 menu/menuitem/focus/Escape 的 portal。编辑器与右栏图标按钮 `KBNoteEditor.tsx:305-365`、`KnowledgeBaseContent.tsx:1099-1142` 没有名称/状态关系；390×844 样本的三个 editor action `aria-label/title` 均为 null。当前 pointer 可用，键盘/辅助技术不能等价完成用户意图。

**方案/替代/风险/验证/回滚**：保留嵌套 action 时使用有效 row selection/disclosure control，加 localized name、selected/expanded/tab/controls，context menu 进入焦点、Escape 关闭并返回 invoker，删除后焦点移到 next/previous/owner。只加 `tabIndex` 仍无名称/激活契约，整行包 native button 会造成 nested interactive，均未选。风险是 Enter/Space 双激活、全局快捷键冲突和删除后焦点丢失。批准后 RTL/user-event + browser accessibility snapshot 覆盖 zh/en、light/dark、desktop/compact。回滚 scoped role/name/keyboard/focus/tests，无数据影响。

#### [F23-I18N-001]

**状态**：已证实的可达 UI 契约不一致，等待 localization change 审批。**用户影响/证据/当前与预期**：应用 i18n 明确只有 `zh|en` 且提供 typed `useI18n` `i18n.tsx:1-24,620-642`；知识库可达组件/工具 adapter 没有任何 `useI18n` import。搜源记录约 340 个中文命中，这只是盘点信号，不将注释/标识/数据机械判为缺陷。精确 DOM 已确认空态、placeholder、按钮 tip、Message、默认标题和日期是中文字面量（例 `KBNoteEditor.tsx:275-365`、`KnowledgeBaseContent.tsx:541-565,1066-1073`），因此切为 English 不会更新它们；预期只有 application-owned UI 随语言，用户数据原样保留。

**方案/风险/验证/回滚**：扩展现有 typed dictionary，按 tree/editor/tag/search/import/status/a11y 分组；系统默认目录仅 render-time alias，不改存储名/路由；只对新建无标题笔记使用当前语言。重命名旧目录或翻译所有中文命中会损坏数据，未选。风险是 English 长度溢出、默认标题重名和 locale sort/search 漂移。批准后验证两语 key 完整性、mixed-language user data、日期/计数、搜索/排序/导入导出和全视口前后截图。回滚 keys/hooks/props/tests；审批后新建的英文标题已是用户数据，回滚时不自动重命名。

#### [F23-DEAD-SAVE-SUBSYSTEM-001]

**状态**：已证实无生产消费者并清理。**证据/调用链/影响**：清理前 `kb-save-manager.ts` 只被同样无消费者的 `kb-save-state-tracker.ts` 引用；全仓排除 node_modules/dist 后没有 import/export/registry/test/caller，package exports 也不暴露该深路径。因此不存在用户入口 → save subsystem 或 subsystem → UI/store 链。原定义文件已删除，当前无可引用行号；目录缺 Git 元数据，无法从历史恢复可信旧行号。已删 `kb-save-manager.ts`、`kb-save-state-tracker.ts` 和仅由 tracker 使用的 `KBSaveState/KBSaveStateInfo`；不改当前 editor timer/store。**验证/风险/回滚**：精确符号/路径复搜为 0，Drawnix/全仓 typecheck、F-23 窄测、build 通过。风险是未被静态搜索覆盖的字符串动态导入，registry/package exports 反查未发现。回滚需从外部备份恢复两文件/两类型；无用户数据或存储回滚。

#### [F23-DEAD-KB-IMAGE-SERVICE-001]

**状态**：已证实无生产消费者并清理。**证据/当前与预期**：清理前 `kb-image-service.ts` 没有 import、registry、test、package export 或可达调用者；当前正式媒体协议是 `asset://`。删除该整文件只去除平行且漂移的实现。保留 `KBNoteImage`、noteImages store、backup/GitHub v2 数据结构和已有用户数据（当前引用见 `knowledge-base-service.ts:58,72`、`kb-import-export-service.ts:42,77-85,195-213`），没有进行数据删除/迁移。原文件已删且无 Git 历史，无当前行号。**验证/风险/回滚**：路径/符号复搜 0，typecheck、41/41 窄测、backup/GitHub tests、build 通过。回滚仅能从外部备份恢复文件；不恢复/改写 store 数据。

#### [F23-SEARCH-INDEX-CONCURRENCY-002]

**状态**：已证实正确性缺陷并实测重复工作，等待 `stabilize-knowledge-base-search-index-initialization` 审批；service并发证据强，真实browser发生频率/性能未知。**用户影响、复现、当前与预期**：cold一篇同时两search，current meta/dir/content读`2/2/2`，second结果`[note-0]`、later first为`[note-0,note-0]`，最终documentCount2；warm已有`base`再新增`new`，两search读meta/dir`2/2`、content`[new,new]`，结果`[base,new]`后`[base,new,new]`，最终3 docs/2 durable notes。MCP直接map engine rows，因此可见重复结果；UI/related虽然下游去重，仍承受shared state与读放大。预期同engine一次build/sync owner、durable ID唯一、各entry readiness后继续自身projection。

**完整链、根因、方案、风险、验证/回滚**：UI `KnowledgeBaseContent:316-336`、related `KBRelatedNotes:34-47`、MCP registration/execute `mcp/index.ts:82-98`/`knowledge-base-tool.ts:69-121`→singleton→`search/getRelatedNotes`→`ensureIndex :182-188`→两个caller各自`buildIndex/syncIndex :91-177`→在content await两侧直接clear/append共享documents/versions/directory map→duplicate result/sink。preferred为engine-local nullable in-flight Promise、guarded finally释放、重叠waiter共享settlement、后续call重评build/sync；不做result-only dedupe、separate engine、generic mutex、worker/persistent index或atomic snapshot。风险是当前waiters从独立成败改为共享failure，慢首call阻塞其他entry，warm partial reject仍非事务；这些是审批理由。批准后先红测cold/warm/mixed entry/add-update-delete/failure-retry/reset和唯一read/ID，再实现并测same fixture/browser IDB。回滚owner/tests，无schema/cache/migration/user data，但重复竞态恢复。完整原始值见`docs/evidence/f23-knowledge-base/search-index-diagnostics.md`/`search-index-metrics.json`。

### 24.4 实际改动、验证、性能/视觉、规格和退出判断

**实际改动与根因映射**：生产改动只有 (1) `asset-map-store.ts`、`AssetContext.tsx`和三个 Markdown consumer 的 projection status，解决 `F23-MISSING-ASSET-PLACEHOLDER-001`；(2) 删除三个无消费者 service/tracker 文件与两个孤立类型，保留 noteImages 数据协议；(3) 将 asset NodeView 的旧「空 map=加载」注释同步为 status 契约。新增 `markdown-asset-missing-state.test.tsx` 和七项可独立审批/回滚的 OpenSpec change；本次新增search-index diagnostics/metrics与change四文件。没有实施保存、搜索、索引、事务、compact、a11y 或 i18n 运行时；两份临时索引diagnostic均已删除。

**窄测、类型与 lint**：缺失素材红测 1 文件/3 项全失败、退出 1；绿测为 1/1 文件、4/4 项、70ms、退出 0，Markdown 集合 4/4 文件、18/18。最终 F-23 聚合命令在 `packages/drawnix` 的 jsdom config 下退出 0，**9/9 文件、41/41 项、4.88s**；本次search-index提案/证据同步后同9文件再跑exit0、41/41、tests1.24s/Vitest4.44s/process5.70s。第一次从根目录直调 Vitest 未加载包配置，8 个 Node 文件/37 项通过，DOM 1 文件/4 项全因 `document is not defined` 失败；本次首次diagnostic同样因root/filter错位在collection前0 tests/exit1，两者均归命令环境失败而非产品回归。`nx run drawnix:typecheck` 和全仓 typecheck 5/5 均退出 0。store/readonly/new test/types 定向 ESLint 退出 0；AssetContext+两 NodeView 退出 1，仅保留原有 2 个 lazy-library boundary error、4 个 empty-arrow error、6 个 any warning。

**全仓测试对照**：`NX_SKIP_NX_CACHE=true nx run-many -t=test` 真实执行后退出 1；react-board 1/1 文件、8/8 通过，utils 后续独立 JSON reporter 确认 25/25 文件、471/471 通过、退出 0。Drawnix 独立静默 JSON reporter 退出 1，`vitest list` 确认 184 个文件：**179 通过/4 失败/1 跳过；1151 项中 1147 通过/3 失败/1 跳过**，并保留 1 个 benchmark kvStorage mock 未处理异常。失败是 cached-image data URL、Sora web duration、GPT remote Blob `arrayBuffer` 测试环境和 PPT settings mock 收集，与 F-13 基线同簇；F-23 九文件全通过，未出现新 F-23 失败。

**循环、lint、构建、体积和启动**：循环检查首次误调 `node_modules/.bin/node` 在脚本前退出 127；改用桌面 Node 重跑退出 0，无 static runtime import cycle。全仓 lint 两次均退出 1，第二次压缩日志 3,025,729 bytes，六项目汇总分别为 5,401(1,995 errors/3,406 warnings)、59(12/47)、3,143(1,144/1,999)、519(5/514)、1,628(722/906)、2,119(377/1,742)；继续扫描 package `node_modules`/既有源码，不是可用的本功能回归门禁。fresh `nx build web --skip-nx-cache` 退出 0：app 7,930 modules、3m15s，SW 54 modules、2.35s/43.12kB gzip；构建脚本更新 version/HTML/changelog，无 Git 无法对照历史 buildTime。`verify:startup` 退出 0，CSS 14,208B、startup app 3,776B、runtime 1,867B、entry 345B、chunk cycles 空。`size-limit` 退出 1；Startup 1.94、Runtime 1.01、Diagram 934.93/950、Office 269.19/300、Editor 858.24/870、Media Viewer 12.19/20 kB gzip 通过，AI Chat 844.32/140 超 704.32 kB，与既有基线一致，未提高预算。

**Playwright、性能与视觉**：Playwright `--list` 退出 0，132 项/13 文件，没有知识库/Markdown asset 专属 smoke/feature/visual/responsive flow。第一次 smoke 因 config webServer 的 `npx` 不在 PATH，产品未启动即退出 1/127；手动用 Nx 启动 Vite 后复跑，2/2 在 4ms browser launch 失败，要求的 `/ms-playwright/chromium_headless_shell-1200/...` 不存在，机器只有1228。未安装浏览器、未改配置，server已停止。search-index固定Node24.14/Vitest3.2.4/jsdom/in-memory cold baseline各5次：0篇median0.026849/range0.017370–0.062040ms，100篇9.648805/6.826579–10.985242，1000篇108.902224/85.909839–122.866666；每次meta/dir各1、content为0/100/1000。这不是real IDB/browser或before-after，故不宣称性能瓶颈/改善；当前KB chunk仍只记现状85.80kB raw/26.36gzip。无新增CSS/runtime UI，索引子循环无视觉前后证据且不宣称更美。

**回滚、剩余风险与退出判断**：asset status 修复可按 `F23-MISSING-ASSET-PLACEHOLDER-001` 所列文件独立回滚；死代码因无Git只能从外部备份恢复；七项proposal可各自删除，未改用户数据。search-index调查回滚为删除新增change/evidence并反向本段/矩阵；无runtime/data。目录没有Git元数据，仍无法核对工作树/历史/可信diff，不声称工作树干净。F-23 当前为**事实调查完成、规格恢复bug与无消费者清理已验证，其余实施等待审批，未达到功能退出标准**。保存丢失/失败、搜索乱序、索引并发、多store/导入同步partial、compact不可达、键盘/读屏和English UI均有高信证据但不能在审批前实施；正式Playwright、修后视觉、real IDB/browser前后性能和部分存储样本仍阻塞。获批任一change后应回到本功能，按tasks先红测、再最小实施、宽验证和全链复审。

## 25. F-17 爆款视频生成/视频分析器功能循环

### 25.1 功能名称、用户场景、范围、规格与验收门禁

**功能与用户场景**：用户从工具箱打开“爆款视频生成”，以提示词（可附 PDF/知识上下文）、本地视频或 YouTube URL 提交分析；看到入队、进度、失败和结构化结果；编辑创意简报、角色和镜头，提交脚本改编；为镜头生成首尾帧及视频、停止或重试批量任务、插入画布；从历史/收藏恢复输入、分析、脚本和生成结果。工具明确支持多窗口（`built-in-manifests.tsx:42-55`），因此两个窗口同时接受不同记录/任务写入属于正式可达场景。

**范围与非范围**：范围覆盖 tool registry/lazy window、Analyze/Script/Generate/History 四页、共享 video workflow 表单、`AnalysisRecord`、本地视频/PDF/生成媒体缓存、统一任务队列、供应商执行、任务事件、记录历史、刷新补同步、批量停止/重试和画布插入。供应商目录/协议本体属于 F-09，任务队列全局调度属于 F-10，通用工作流恢复 owner 属于 F-11，素材选择与 cache 多 store 一致性属于 F-13，外层 WinBox 通用实现属于 F-15/F-28；本轮只追踪这些边界的 F-17 consumer，不越权改变它们的全局语义。

**正式规格与活动 change**：正式 `video-analyzer` 规格要求分析/改编统一入队、输入源可恢复、上传缓存失效时保留分析并显示安全反馈；本轮两个直接修复恢复该契约。正式 `video-batch-generation` 要求严格串行、前段尾帧驱动后段首帧、失败无限重试至成功或用户停止；活动 `update-video-batch-parallel-generation` 则要求镜头独立并行、本镜头首帧、禁止尾帧链、单镜头失败不阻塞。当前运行时是第三种混合语义，见 `F17-BATCH-SPEC-CONFLICT-001`，审批前不得修改。新增 `fix-video-analyzer-record-consistency`（4/16，3 requirements/4 scenarios）和 `improve-video-workflow-form-accessibility`（4/15，2/4）均待批准；外层响应式与焦点分别由既有 `fix-tool-window-viewport-transition`、`improve-tool-window-accessibility` 所有，不建立重复 change。

**已知基线与本轮验收**：24 个 F-17/shared workflow 定向文件修后为 23 通过、1 失败；109 项中108通过、1失败，唯一失败是既有 Sora web duration 契约。F-17 退出要求包括输入三路径、分析/改编、任务终态、批量生成/停止/重试、历史/收藏、刷新/离线、多个窗口、记录持久化、表单键盘语义及桌面/compact 视觉均与批准后的规格一致；定向、全仓 typecheck/test/cycles/build/size/startup 和 Playwright 不新增失败；性能和视觉结论有同条件前后证据。当前审批、规格冲突和正式 Playwright 均未解除，因此本轮只能标记“调查完成、部分验证”，不能达到退出标准。

### 25.2 正向、反向调用链、状态与不变量

**入口与 UI owner**：`built-in-manifests.tsx:42-55` 注册 680×700、可多实例工具 → `registry.tsx:54-58,101-120` 懒解析 → `tools/video-analyzer/index.tsx:36-40` Suspense → `VideoAnalyzer.tsx:40-84` 的 `useWorkflowRecords`、页面导航和共享任务同步 → Analyze/Script/Generate/History 页面。`records/currentRecord` 是 React projection，`AnalysisRecord[]` 是持久化事实；页面 state 拥有当前输入、进度、编辑 draft 和批量运行状态。正常、空态、加载、失败、停止/取消、重试、恢复和离线边界均经过这些 owner。

**分析正向链**：Analyze 的 prompt/PDF、upload、YouTube 分支在 `AnalyzePage.tsx:534-655` 校验和转换参数；prompt 分支保留原始 prompt、creative brief、目标/分段时长、模型引用、知识引用及 PDF cache metadata，upload 先由 `video-source-cache.ts:19-46` 写统一缓存，YouTube 保存 URL snapshot。随后 `AnalyzePage.tsx:657-687` 记录不含正文/媒体的布尔和尺寸 analytics，并调用 `videoAnalyzeTool.execute(..., {mode:'queue'})`；`video-analyze.ts:28-78` 创建 `TaskType.CHAT`；`task-queue-service.ts:1017-1042` 按 `videoAnalyzerAction` 路由到 analyze/rewrite/prompt-generate；upload 从统一缓存恢复 Blob（`:1239-1277`），prompt/PDF 构造 inline parts 后调用 Gemini（`:1422-1498`），完成后落盘 task 并发 RxJS 事件（`:1225-1236`）。

**任务结果到 UI/记录**：Analyze 局部订阅 `AnalyzePage.tsx:709-766` 更新进度、错误、当前结果和上传视频帧；工具级 `useWorkflowTaskSync` 同时在 `VideoAnalyzer.tsx:73-84` 使用共享 `useWorkflowTaskSync.ts:34-71` 扫描内存任务并订阅后续事件。两路最终进入 `task-sync.ts:143-200,276-294`，按 action 解析 `VideoAnalysisData`/source/product info、以 `analyzeTaskId` 去重并创建记录；rewrite 按 `pendingRewriteTaskId` 回填 version/characters/product info（`:203-273`）。完成结果反映到当前页、历史/收藏和后续 Script/Generate；插入画布由 `VideoAnalyzer.tsx:113-133` 调图片/视频 helper并把错误反馈给用户。

**脚本与生成链**：Script 从 record 派生 product info、shots、characters，500ms 自动保存表单（`ScriptPage.tsx:219-233`），镜头/角色/版本写入走 `updateRecord`（`:235-257,445-453`）；改编创建 task，task-sync 生成新 script version。Generate 以 refs/model/size/shot state 调 MCP media tools，task queue/provider/统一缓存产生结果；`GeneratePage.tsx:647-769` 从 restored/live `allTasks` 反投影角色、首尾帧与视频 URL并写 record，素材选择和手工编辑也写同一 record。批量路径 `GeneratePage.tsx:1425-1805` 生成角色参考图、首尾帧和视频，`activeBatchTaskIdsRef`/AbortController 所有停止状态，失败重试位于 `:1703-1777`，用户停止取消全部 active tasks 位于 `:1390-1400`。

**持久化、缓存、恢复与反向链**：`storage.ts:17-40` 固定 key `video-analyzer:records`、最多50条并保留收藏；共享 `record-storage.ts:32-106` 对 kvStorage 做 load-modify-set 和 delete。upload/PDF source snapshot保存 cache URL/名称/MIME/尺寸，生成结果保存在 task/unified cache并在 record中引用 URL，不存 Blob；无 schema/version/migration 改动。刷新时 `useTaskStorage.ts:55-80,242-253` 在 idle 后迁移/读取 IndexedDB、调用 `restoreTasks`并发布 ready；当前共享 F-17 hook不消费 ready。反向从分析结果、历史记录、生成 URL、任务卡或外部请求查 writer，分别回到 task-sync、Script/Generate更新、task queue finalize/provider adapter；收藏/删除只回到 History→storage。错误经页面 `.va-error`、TDesign Message、task error和 console传播；analytics只登记 input mode、布尔状态、文件大小、模型引用存在性和任务/镜头计数，不登记 prompt正文、PDF内容、缓存媒体或凭据。

**保持不变的不变量**：一个完成 task ID最多产生一条分析记录；同一运行时已接受的非冲突 mutation不能互相覆盖；恢复任务不得任意替换用户当前 record；保留 key/schema/50条 retention、模型/provider/cache/素材/画布协议；停止只影响当前批次；用户数据和错误日志不得包含 prompt、缓存媒体或凭据。批量串行/并行、尾帧和失败作用域在规格冲突解决前不声明新的不变量。

### 25.3 问题证据、方案、风险、验证与回滚

#### [F17-TASK-SYNC-DUPLICATE-001]

**状态**：已证实并红绿修复；证据强度高（同一事件的双 consumer 静态链 + 确定性并发测试）。**用户影响/复现/当前与预期**：分析完成时，Analyze局部订阅和VideoAnalyzer共享订阅同时调用同一 task sync；修复前 `Promise.all([sync(task), sync(task)])` 在空历史上产生2条记录，预期同一 task ID只产生1条。影响当前历史、收藏计数、50条淘汰和后续脚本选择，多窗口不会因此被禁用。

**调用链与根因**：task完成事件 → `AnalyzePage.tsx:709-766` 与 `VideoAnalyzer.tsx:73-84`/`useWorkflowTaskSync.ts:61-65` → `task-sync.ts:155-200`。旧去重是“load历史→查 `analyzeTaskId`→add”的非原子序列，两路都可在任一路 set前读到空。最小修复在 `task-sync.ts:33-36,276-290` 按 task ID维护同进程 singleflight；删除局部订阅会同时删除页面进度、pending cleanup和上传帧提取，超出根因；全局任务锁会扩大到无关功能，未选。

**风险/验证/回滚**：风险是 rejected promise残留或不同 task误合并；`finally`只删除仍等于当前 promise的同 ID entry，不合并不同 ID。新测试 `task-sync.test.ts:152-163` 修复前失败（记录2条），修复后同一完成 task两个 caller共享结果且仅1条；两项修复红测合计2文件7项中2失败，绿测7/7。回滚删除 `inFlightTaskSyncs`、wrapper和并发测试即可，不改已存数据；回滚会恢复重复记录风险。

#### [F17-SOURCE-RESTORE-FEEDBACK-001]

**状态**：已证实并修复；证据强度高（正式 `video-analyzer` spec + component红绿测试）。**用户影响/复现/当前与预期**：历史 upload record仍有分析结果但 Cache API已无原视频时，`restoreVideoFileFromSnapshot`返回 null，state正确设置“原上传视频缓存已失效”，但旧 `.va-error`位于无 analysis分支，结果态看不到；预期保留分析并明确告知原视频不能回填。影响历史恢复和用户决定重新上传，不删除结果。

**调用链/根因/方案**：历史选择 → `AnalyzePage.tsx:299-310` cache restore失败 → error state → UI；将同一个错误渲染点移到输入态/结果态共用位置 `AnalyzePage.tsx:1023`，没有改变 cache、record或恢复算法。仅用 toast会丢失持续状态，删除 analysis会违反正式规格，均未选。新增 `AnalyzePage.test.tsx:106-156` 以 ready analysis + null cache验证结果和错误同时可见。

**风险/验证/回滚**：风险仅是结果态多一行既有 `.va-error`造成内容高度变化；没有 CSS/token/z-index改动。定向绿测7/7、F-17宽测中该测试通过。回滚把渲染点放回原分支并删除测试，无数据迁移；会重新违反正式恢复反馈场景。

#### [F17-BATCH-SPEC-CONFLICT-001]

**状态**：未知/阻塞，证据强度高但缺少产品语义决策；禁止实施。**用户影响/当前与预期**：正式 spec要求串行、上一段尾帧→下一段首帧、失败持续重试；活动 parallel change要求独立并行、本段首帧、无尾帧链、单镜头失败不阻塞。当前 `GeneratePage.tsx:1791` 使用 `Promise.all`并行，`:1670-1696` 使用本镜头首帧且无自身尾帧 prompt时把下一镜头首帧当本镜头尾帧，`:1752-1768` 遇不可重试失败会全局 stop/cancel。因此不存在一个可据以判定“预期”的一致规格。

**调用链/影响/候选**：生成全部视频 → frame prewarm `:1550-1649` →每镜头 pipeline `:1651-1788` → task queue/provider → record/画布。影响费用、并发、镜头连续性、停止、失败隔离、刷新恢复以及 F-10/F-18。候选 A 是以正式 spec为准恢复严格串行/尾帧链/无限重试；候选 B 是批准并合并 parallel change、同步正式 spec后实现独立失败。保留当前第三种混合语义没有规格依据。需要用户选择 A 或 B；选择后先更新独立 OpenSpec，再写确定性 scheduling/frame/failure/stop/recovery红测。

**验证与回滚**：同一 fixture至少覆盖3镜头、已有首/尾帧、可/不可重试失败、停止、刷新和插入画布；记录 task创建顺序/最大并发/传入首尾帧/取消集合，五次网络 stub时延并确认无额外费用。回滚必须整体恢复该 change前的 scheduling、frame和failure策略及测试；当前未改代码，无需回滚。

#### [F17-RECORD-WRITE-RACE-001]

**状态**：实测缺陷，等待 `fix-video-analyzer-record-consistency` 审批；证据强度高（真实 helper、受控并发完成顺序、多窗口可达性）。**用户影响/复现原始值**：(1) 初始 `{label:'Old',starred:false}`，并发 patch `{label:'New'}` 与 `{starred:true}`，预期 `{New,true}`，实际 `{Old,true}`；临时诊断1文件7项中6通过/1失败，退出1。(2) 初始空数组，并发 add a/b，预期`['a','b']`，实际`['b']`；同为6/1、退出1。临时断言在记录结果后撤回，不把错误行为固化为长期通过测试。多窗口 manifest为 true，且单页 task结果/自动保存也可并发，因此是可达链。

**调用链/根因/候选**：Analyze task sync、Script autosave/shot edit、Generate task projection、History favorite/delete → `storage.ts:20-40` → `record-storage.ts:48-102`独立 load-modify-set → kvStorage/IndexedDB。两个调用都基于同一旧快照，后完成的整数组 set覆盖先完成的非冲突 mutation。change提出只对 F-17 key按接受顺序串行 mutation并保留现有表示/50条规则；用 React state当 durable owner无法覆盖多窗口/刷新，Web Locks/通用Repository扩大架构边界，未选。

**风险/验证/回滚**：串行会增加高并发完成延迟，且task sync与用户编辑需要定义接受顺序；批准后补 add/add、patch/patch、add/delete、task/edit、reject/retry正式红测，并对0/10/50条历史×1/10/50个并发mutation各跑5次，正确性阈值为0丢失，报告中位数/min/max，不宣称更快。回滚队列和测试即可，key/schema不变且不清缓存；无法自动恢复修复前已丢的历史字段。

#### [F17-TASK-REHYDRATION-GAP-001]

**状态**：已证实的静态恢复缺口，等待同一 record-consistency change审批；真实用户发生频率未知。**用户影响/复现静态证明**：工具若在 task storage恢复前挂载，`useWorkflowTaskSync.ts:57-59`只扫描当时内存一次；后续只处理事件携带的单 task（`:61-65`）。`useTaskStorage.ts:55-80`之后恢复全部持久任务，而 `restoreTasks`只以当前 map第一条发一个generic event（`task-queue-service.ts:2425-2434`）。当第一条不是F-17、后续存在已完成F-17 task时，该task不会补同步为历史记录；预期storage ready后每个相关终态task都被幂等检查，且不替换用户当前记录。

**调用链/根因/候选**：IndexedDB task → `useTaskStorage` → `restoreTasks` memory map →代表事件 → shared hook → task-sync → AnalysisRecord。`isTaskStorageReady`虽在 `useTaskStorage.ts:49-50,250-253`存在，只在DeferredRuntime的resume path消费，未到workflow consumer。候选是在唯一task-storage ready边界做一次全量F-17 reconcile并依赖task-ID singleflight；为每个恢复task伪造event会改变全局事件量，F-17独立轮询会重复读取，均未选。与 `fix-main-thread-workflow-recovery-sync` 共享 readiness，实施前必须确定一个全局 coordinator，禁止两个并行 owner。

**风险/验证/回滚**：补扫可能与live completion重叠或错误选择历史；要求空内存→多终态task（第一条非video）→同时live event测试，断言每task一次、当前record不变、失败只显示安全摘要。回滚ready consumer/补扫/tests，不删除task或record；当前未实施。

#### [F17-SCRIPT-SAVE-FEEDBACK-001]

**状态**：已证实的 Promise/error contract缺陷，等待 record-consistency change审批；真实IndexedDB reject频率未知。**用户影响/当前与预期**：Script 500ms autosave直接await `updateRecord`且没有catch（`ScriptPage.tsx:219-233`），shot/character field handler调用async save不await（`:235-262`）；Generate task projection多处 `void updateRecord(...).then(...)`无catch（`GeneratePage.tsx:638-644,759-764`）。写入reject时当前编辑或结果可能仍显示在内存，但用户没有“未保存”反馈，并可产生unhandled rejection；预期保留当前工作、显示不含prompt/media/credential的持久化失败，并在后续成功时只清保存警告。

**根因/候选/风险/验证/回滚**：页面把 durable write当成不会失败，已有 `error` state主要服务改编task，并未覆盖所有writer。候选把记录mutation返回结果与安全save status贯穿Script/Generate，sequence守卫防止旧失败覆盖新成功；只加console catch仍会对用户谎报，失败时回滚全部当前输入会丢工作，未选。风险是保存警告和task错误互相覆盖、旧promise迟到；批准后注入failure→success、快速连续编辑、task结果与编辑并发、unmount测试。回滚反馈/sequence/tests而不改schema；当前未实施。

#### [F17-TOOL-WINDOW-RESPONSIVE-001]

**状态**：实测缺陷，由 `fix-tool-window-viewport-transition` 所有并等待审批；证据强度高（真实应用内Chromium几何和三张截图）。**环境/复现/原始值**：Vite当前源码、浅色、DPR1、无网络/CPU限速；1280×720冷开为x300/y10/680×700。保持窗口打开切390×844后为x300/400×700/right700，仅90px可见；body client/scroll width均390，无横向恢复通道；历史/收藏可见宽度0，prompt仅约74×15px可见。恢复1280×720后窗口仍为400px，不回到680px。原始JSON与截图见 `docs/evidence/f17-video-analyzer/`。

**调用链/根因/候选/风险/验证/回滚**：tool manifest 680×700 → `ToolWinBoxManager.tsx:110-127`计算compact 374px → `WinBoxWindow.tsx:148-157`默认minWidth400 →动态约束只resize不move（`:1210-1235`），旧x300保留。既有change规定compact clamp、非持久化自动布局和往返恢复；只改F-17 CSS无法移动外层window，永久写回400会破坏桌面偏好，未选。批准后验证冷开/desktop→compact→desktop、dragged rect、320/390/768/1280、portrait/landscape、中英深浅和至少5次event-to-stable geometry。回滚通用opt-in/测试，无数据迁移；当前未实施。

#### [F17-TOOL-WINDOW-A11Y-001]

**状态**：实测缺陷，由 `improve-tool-window-accessibility` 所有并等待审批；证据强度高（DOM属性/焦点样本），真实读屏器矩阵未运行。**用户影响/复现**：1280×720从工具箱打开F-17后activeElement仍为BODY；WinBox的role、aria-label/labelledby、tabindex均null。`WinBoxWindow.tsx:607-624,873-905`创建/注册DOM和portal但未建立dialog名称/焦点生命周期。键盘/屏幕阅读器用户不能可靠进入、识别和关闭这个工具窗口；pointer路径仍可用。

**候选/风险/验证/回滚**：复用既有change为外层window/title controls建立dialog/name、打开聚焦、Tab/Escape/关闭还焦，并与内层Combo Escape规定优先级；只给root加role不解决焦点，F-17自行补一套会与F-15所有窗口分叉，未选。风险是Escape关闭嵌套菜单后继续关闭窗口、多个窗口焦点错位。批准后做RTL和Chromium accessibility snapshot，覆盖一/两窗口、最小化/恢复、launcher和inner popover。回滚外层语义/focus handler/tests，无存储影响；当前未实施。

#### [F17-FORM-A11Y-001]

**状态**：实测缺陷，等待 `improve-video-workflow-form-accessibility` 审批；证据强度高（10个控件属性清单和键盘原始结果）。**用户影响/复现**：初始Analyze页10/10 input/textarea/select没有id、name、aria-label、aria-labelledby或关联label。共享 `CreativeBriefEditor.tsx:61-145` 与 `VideoParametersRow.tsx:61-105`把视觉label作为无关联 sibling；`ComboInput.tsx:170-220`仅pointer选择。聚焦空“导演风格”按ArrowDown→Enter后值仍空，Escape后30项仍开；input无combobox/expanded/controls，option无role/tabindex。预期所有字段有唯一localized name，preset键盘行为与pointer等价且保留free text。

**调用链/候选/风险/验证/回滚**：visible label → shared field/ModelDropdown → input/list portal → value→creative brief→prompt/task/record。change限定稳定ID/label或等价ARIA，以及editable combobox/listbox/option、Arrow/Home/End/Enter/Escape；不改可见布局、preset、prompt或stored value。只加aria-label不解决键盘，给option逐个tabIndex会造成长tab序列，未选。风险是portal ID冲突、Arrow提前commit、Escape冒泡关闭WinBox；批准后覆盖两实例、filter/free text/no-option/disabled/pointer parity和F-17/F-18 integration，并做1280/390/320、中英深浅DOM与无布局偏移截图。回滚optional naming props/keyboard state/tests，无schema/cache影响。

#### [F17-SORA-WEB-DURATION-BASELINE-001]

**状态**：未知/阻塞，未修改；证据强度为稳定测试失败但产品期望归属尚未核清。**复现/当前与预期**：F-17宽测中 `video-binding-utils.test.ts:198-207` 对`sora-2 + sora_mode:web`预期duration `['10','15']`，实际`['10']`；24文件仅此1项失败。`video-binding-utils.ts:170-202`的web metadata继承当前static config，`:271-297`据allowedDurations生成UI选项。测试、运行时模型配置与provider binding谁是权威尚需F-09模型路由循环确认，不能仅按断言改代码或放宽测试。

**影响/验证/回滚**：潜在影响F-17/F-18/F-08的Sora时长选择和请求参数，但尚未用真实provider catalog/凭据确认。验证需要记录当前runtime model/binding、两种sora mode的UI选项和最终request字段，并与正式provider/version规格对齐；缺外部凭据时保留阻塞。当前无改动，无需回滚。

### 25.4 实际改动、验证、性能/视觉、规格和退出判断

**实际改动与根因映射**：生产改动只有 (1) `task-sync.ts` 的task-ID同进程singleflight，修复同完成事件重复记录；(2) `AnalyzePage.tsx`把既有error渲染移动到输入态/结果态共用位置，恢复上传缓存失效反馈。新增 `task-sync.test.ts` 并发断言、`AnalyzePage.test.tsx`恢复断言、三张运行截图/metrics/diagnostics，以及两项待审批OpenSpec change。三张截图最初由浏览器输出为JPEG编码但使用`.png`扩展，本轮已用系统图像转换为真实PNG并经`file`确认；视觉内容和尺寸未改变。未实施record queue、storage-ready reconcile、save feedback、表单/窗口a11y、responsive或batch语义。

**定向测试与静态门禁**：两个缺陷红测为2文件7项、2失败、退出1；绿测2/2文件、7/7项、退出0；加入共享record-storage后3/3文件、13/13项、退出0。从仓库根直调AnalyzePage因未加载Drawnix jsdom config而`document is not defined`，归类命令环境错误；在`packages/drawnix`运行正确。F-17宽测24文件：23通过、1失败；109项：108通过、1失败，唯一为上述Sora baseline。修改文件定向ESLint退出0，AnalyzePage保留4条既有warning、无error；Drawnix typecheck退出0，全仓typecheck 5/5退出0；`pnpm check:cycles`退出0、无static runtime cycle。

**全仓测试对照**：首次`pnpm test`被Nx“cache artifact not generated on this machine”拦截，未进入产品测试且没有执行`nx reset`。以`NX_SKIP_NX_CACHE=true`和`--skip-nx-cache`真实执行后退出1：react-board 1/1文件、8/8项通过；Drawnix 185文件中178通过、6失败、1跳过，1153项中1147通过、5失败、1跳过，并有1个既有model benchmark kvStorage mock未处理异常。失败簇为cached image data URL、Sora web duration、GPT remote Blob `arrayBuffer`、PPT settings mock缺export及两个全并发5s timeout；六失败文件窄复跑时两个timeout文件通过，剩余3项与既有基线同簇。F-17新增/修改测试没有失败。

**lint、构建、体积和启动**：`pnpm lint`退出1；六项目继续扫描包内`node_modules`、vendored/minified JS和既有源码，输出包含数千条第三方错误，归类工具配置噪声，不能作为F-17业务回归门禁。fresh `pnpm build:web`退出0：app转换7,930 modules、1m47s，SW 54 modules、1.60s；F-17主chunk 75.47kB raw/23.48kB gzip、CSS 27.47/4.92kB gzip，另有0.58/0.42kB loader。`pnpm size`退出1，仅AI Chat 844.32/140kB gzip超704.32kB；Diagram 934.93/950、Office 269.19/300、Editor 858.24/870、Media Viewer12.19/20通过，未提高预算。`pnpm verify:startup`退出0：CSS14,208B、startup app3,776B、runtime1,867B、entry345B，chunk cycles空。

**OpenSpec、Playwright、性能与视觉**：两项新change均有proposal/design/tasks/delta；人工确认record change为3 requirements/4 scenarios、form a11y为2/4，且全量spec/change搜索无同名requirement。OpenSpec CLI不可用，strict validation保持工具阻塞，未安装且不声称通过。Playwright `--list`退出0，共132项/13文件，没有F-17专属用户流，登记为测试覆盖缺口；实际执行仍要求本机缺失的`chromium_headless_shell-1200`，机器只有1228，登记为测试环境阻塞，不安装浏览器、不改配置。应用内Chromium证据环境/步骤/原始值在`docs/evidence/f17-video-analyzer/metrics.json`。本轮没有修复前后五次性能样本，不宣称更快/更省内存/更小；chunk仅记当前值。没有CSS改动，不宣称视觉改善；source error修复以正式DOM断言证明，responsive只有修复前截图/几何，审批实施后才可产出同视口修后证据。

**回滚、剩余风险与退出判断**：singleflight和error位置可按各问题所列文件/测试独立回滚；两项proposal可整目录删除且没有运行时/数据副作用；证据格式修正只改变文件编码。构建再次更新version/HTML/changelog，目录无Git元数据，无法核对历史、可信diff或自动恢复旧buildTime，不声称工作树干净。F-17为**调查完成、两项规格恢复缺陷已验证、其余实施阻塞，未达到退出标准**：batch三方语义等待用户选择；record consistency与form a11y两项新change、外层window responsive/a11y两项既有change等待批准；Sora契约、正式Playwright、修后视觉及record性能样本未闭合。审批后必须按各tasks先红测再实施，并重新从入口复审失败、停止/重试、刷新、离线、多窗口和隐私路径。

## 26. F-16 多图生成功能循环

### 26.1 用户场景、边界、规格与验收门禁

**用户场景**：用户从工具箱打开“多图生成”，输入故事或 PDF，选择场景、页数、文本模型和图片模型；获得可编辑的分页规划后，可锁定、插入、删除或重排页面，以串行或受限并行方式生成、取消、重试或单页重生；随后从当前项目或历史记录继续编辑，并把所有已经生成的页面按顺序导出为 ZIP、PPTX 或 PDF。

**范围**：工具注册与多窗口入口；planning/generate/history/starred 四个页面；`ComicRecord`/`ComicPage`/`ComicGenerationState`；故事/PDF 解析与 outline task；页面编辑和局部持久化；图片 task 创建、等待、取消、重试、串/并行调度；共享 task 终态同步；记录历史、收藏、删除和恢复；统一缓存引用；ZIP/PPTX/PDF 导出；分析事件和用户可见错误；窄工具窗、移动边界和表单/导航可访问名称。

**非范围**：供应商目录、协议路由和模型正确性由 F-09 所有；任务队列的通用并发/外部取消/持久化由 F-10 所有；AI 输入工作流恢复由 F-11 所有；素材库配额与写入由 F-13 所有；外层 WinBox 的 viewport transition、dialog/focus/Escape 分别由 `fix-tool-window-viewport-transition` 和 `improve-tool-window-accessibility` 所有；视频/MV 自身的表单与记录由 F-17/F-18 所有。本轮不增加生成模式、导出格式、存储字段或产品入口。

**规格与活动 change**：当前没有已归档的 `comic-generation-workflow` 正式 spec；活动 `add-comic-strip-generator/specs/comic-generation-workflow/spec.md:3-131` 是现有能力的唯一完整产品契约，25/25 tasks 全勾选但 change 仍未归档，不能把勾选状态当作现实现状已验证。其 `Export Comic Projects` requirement 明确要求 PPTX/PDF 按页面顺序包含已有图片，并在失败时保留项目和已有引用。本轮恢复该既有导出行为，不需新审批。记录 mutation 顺序、task-storage-ready 后补同步、保存失败反馈、容器响应式和本地化可访问名称会改变存储/恢复或用户可观察行为，已拆为 `fix-comic-creator-record-consistency`（4/17）和 `improve-comic-creator-responsive-accessibility`（3/16），实施等待用户批准。

**本轮验收门禁**：部分完成项目的 PPTX/PDF 只导出有图页面且保持页序；零图片仍明确拒绝；不改变 ZIP、图片 fetch 串行边界、导出尺寸、文件名、record/task/cache schema 或 provider 请求。所有待审批行为只建立复现、调用链、proposal/design/tasks/delta 和验证阈值，不修改运行时。定向测试不得新增失败；全仓失败必须逐项对照基线；性能/视觉只能报告实测值，不从代码形态推断。

### 26.2 正向、反向调用链与不变量

**正向链**：

1. 用户入口：工具箱 registry → `tools/tools/comic-creator/index.tsx:46-60` 的懒加载 internal tool（`supportsMultipleWindows: true`）→ `ComicCreator.tsx:578-725` 初始化页面、当前记录、模型和生成状态。
2. 规划输入：故事 textarea/PDF attachment、场景/页数和 `ModelDropdown` → 输入清理、页数默认/上下限、creative brief 与 prompt 组装 → `ComicCreator.tsx:1227-1347` 创建 outline task → `taskQueueService.createTask`/媒体执行与 provider route → RxJS task update → 解析为 `ComicPage[]` → `addRecord`/`updateRecord` → planning/generate UI。
3. 页面编辑：锁定、prompt 编辑、插入/删除/重排 → component state/ref owner → `ComicCreator.tsx:1127-1161` 的实例局部 `persistQueueRef` → `comic-creator/storage.ts:11-72` → shared whole-array `record-storage.ts` → kvStorage/IndexedDB → 当前页和 history 投影。
4. 图片生成：选中页或全部页 → `ComicCreator.tsx:1689-1802` 拼接 shared/per-page prompt、模型与参数 → create task + wait terminal → task queue → media executor → image adapter/provider/network → cache/reference → 页状态、result URL/mime/尺寸和 record；`ComicCreator.tsx:1843-2045` 决定串行、并发上限、stop/cancel 和 retry；`useWorkflowTaskSync.ts:34-71` 还订阅共享终态事件并调用 `comic-creator/task-sync.ts` 做幂等回写。
5. 历史与恢复：`ComicCreator.tsx:2113-2156` 选择、收藏或删除 → storage whole-array mutation → records/current record state → history/starred/generate 页面；刷新时 comic record 直接从 IndexedDB 读取，task snapshots 由 `useTaskStorage.ts:55-80,242-254` 延后恢复进 task queue。
6. 导出：生成页引用 → `ComicCreator.tsx:2047-2097` 收集 ZIP 或普通 image sources 并记录 start/success/failure 分析事件 → `export-service.ts` 构建 manifest/files → 对每个图片引用串行 fetch、Blob/Data URL 转换 → ZIP/PptxGenJS/jsPDF → 浏览器下载；错误经 MessagePlugin 返回用户，finally 清理 exporting 状态。

**反向链**：PPTX/PDF 下载文件唯一写入者为 `export-service.ts:482-568`，调用者是 `handleExport`；页面图片写入者为本地生成 wait 与共享 task sync 两类，二者都可到 `updateRecord`；`comic-creator:records` 的写入者包括 component patch queue、outline/image task、共享 task subscriber、history 收藏/删除和每个并行工具窗口，全部汇入 `storage.ts:42-72`；终态 task 来自 live RxJS event 或 task storage restore，但恢复事件只代表 map 第一项。由结果反查能够到达当前项目、历史恢复、失败/重试/取消/刷新和多窗口入口；离线 provider 失败沿 task error 与生成状态返回，已经缓存的历史引用仍取决于统一缓存可用性。

**类型、转换与状态所有权**：`ComicRecord` 持有轻量项目元数据、页数组、生成设置、状态和 image reference，不持久化大图 binary/data URL；`ComicPage` 的稳定 ID 用于页序、task pending relation 和 image source 匹配；页面规划结果经解析/归一化后合并锁定或人工编辑页；页数输入以字符串留在表单，提交时转为受限整数；generation mode 决定顺序调度或有上限的 worker 批次。React state 和 latest refs 是当前窗口 owner，IndexedDB 是 durable owner，task queue map/RxJS 是执行状态 owner，Cache API/统一缓存是媒体引用 owner。

**副作用、并发、恢复和隐私不变量**：同一 task ID 的 live/local 同步必须幂等；串行模式保持页序，并行模式不得超过现有上限；停止只取消未终态任务并保留完成页；50 条历史上限、record/task/cache keys 和 schema 不变；导出按页序串行 fetch，不能一次把全部远端图预取入内存；刷新后不得让 task 结果覆盖用户当前选择的无关记录；错误和分析事件只带安全类别、计数、耗时和聚合 record 元数据，不记录 prompt、凭据、大图或完整 record。未发现本轮修改改变迁移、失效 key、provider route 或外部 API。

**测试位置**：`storage.test.ts` 覆盖轻量记录与历史；`task-sync.test.ts` 覆盖 terminal task 幂等/映射；`utils.test.ts` 覆盖规划、页状态与参数工具；`export-service.test.ts` 覆盖三种导出、页序、尺寸、串行 fetch、object URL 清理和错误；全仓 task queue/media/provider 测试覆盖相邻边界。Playwright 列表没有 F-16 专属用户流，浏览器证据只能补充布局/DOM，不能替代生成成功、取消、离线和刷新恢复 E2E。

### 26.3 问题证据、决策与回滚

#### [F16-PARTIAL-EXPORT-003]

**状态**：已证实并修复；证据强度高（活动 delta + 红绿单测 + 当前实现）。**用户影响/复现/当前与预期**：构造两页项目，仅第 1 页有图片，调用 PPTX 或 PDF export；修复前两项红测均以“第 2 页缺少图片，无法导出”失败，导致用户无法备份已经付费/耗时生成的可用页。`add-comic-strip-generator/specs/comic-generation-workflow/spec.md:99-118` 要求按页序导出已有图片；预期一页 slide/PDF page 成功，只有零可用图片时才拒绝。

**调用链与根因**：Export button → `ComicCreator.tsx:2047-2097` → `exportComicAsPptx`/`exportComicAsPdf` → 旧的逐页全量校验。UI 已以 `imageSources.length > 0` 允许部分结果导出，但 service 要求每个计划页都有图，形成同一功能内契约分叉。最小修复在 `export-service.ts:305-316,482-568` 过滤并保持所有有图页面的原始页序，零项抛出 `没有可导出的页面图片`；没有修改 ZIP 或 manifest。用占位空白页会改变导出内容，禁用按钮直到全部成功会违反“保留并导出已有结果”，均未选。

**风险、验证与回滚**：风险是过滤时错序或零图静默生成空文件；`export-service.test.ts:394-446` 分别断言 fetch 顺序、slide/page 数、文件名和零 download。回滚删除 `getAvailableImageExportItems` 并恢复两个 exporter 的全页映射，同时删除两项测试；无 schema、缓存或用户数据迁移，但会恢复部分项目不可导出缺陷。

#### [F16-RECORD-LOST-UPDATE-001]

**状态**：实测缺陷，等待 `fix-comic-creator-record-consistency` 审批；证据强度高（真实 storage helper + 受控并发顺序 + 多窗口可达性）。**用户影响/复现原始值**：初始 record 为 `{starred:false,title:'旧标题'}`，并发接受收藏 patch 和标题 patch，期望两个非冲突 mutation 都保留为 `{starred:true,title:'新标题'}`，实际 durable result 为 `{starred:false,title:'新标题'}`；诊断 1 文件/1 项，0 通过/1 失败、退出 1，记录原始值后撤回临时断言。多窗口 manifest、task result、页面编辑与历史收藏都是可达 writer，因此不是只由测试构造的不可达状态。

**调用链与根因**：页面编辑/任务回写/收藏/删除/其他窗口 → `ComicCreator.tsx:1127-1161,1362-1422,2124-2156` → `storage.ts:42-72` → `record-storage.ts:48-106` 的 load-modify-set → IndexedDB。component queue 只串行一个实例内的 patch，实例外 writer 可同时读取旧数组，后完成的整数组 set 覆盖先完成的非冲突字段。候选方案是在 comic key 接受边界串行 mutation，保留 schema/50条规则；React state 无法覆盖多窗口与刷新，通用 Repository/Web Locks 会扩大未经证明的架构边界，未选。

**风险、验证与回滚**：批准后先加 update/update、task/edit、add/delete、reject/retry 红测；0/10/50 条记录 × 1/10/50 mutation 各跑 5 次，正确性阈值为 0 丢失并报告 latency median/min/max。队列可能增加突发完成延迟，必须验证接受顺序与失败隔离。回滚 comic-owned queue 与测试即可，key/schema 不变；无法自动恢复修复前已丢字段。

#### [F16-TASK-RESTORE-GAP-002]

**状态**：已证实的静态恢复缺口，真实用户发生频率未知；等待 record-consistency change 审批。**用户影响/当前与预期**：工具在 task storage 恢复前挂载时，`useWorkflowTaskSync.ts:57-65` 只扫描当时的内存 map 一次；`useTaskStorage.ts:55-80,242-254` 稍后恢复全部 snapshots，而 `task-queue-service.ts:2425-2434` 只为当前 map 第一项发一个 generic event。若第一项不是 comic、后续有已完成 comic task，对应项目可停在 generating/pending，刷新后也不会补回结果。预期 storage ready 后每个相关终态 task 被幂等检查，且不替换当前无关记录。

**调用链/根因/方案**：IndexedDB task snapshots → deferred `useTaskStorage` → `restoreTasks` map → 单一代表事件 → shared hook → `comic/task-sync.ts:57-213` → comic record。现有 `isTaskStorageReady` 没有到达 workflow consumer。方案是在唯一、已批准的 task-storage readiness owner 后做一次 filtered reconcile，并复用 task-ID singleflight；为每项伪造全局事件会改变所有消费者事件量，comic 自行轮询会制造第二 readiness owner，均未选。该边界同时影响 F-17 和 `fix-main-thread-workflow-recovery-sync`，三者必须共用一个 coordinator。

**风险、验证与回滚**：批准后用空内存→多终态 tasks（第一项非 comic）→同时 live completion 的确定性测试，断言每 task 一次、当前 record 不变、失败只显示安全摘要。补扫可能与 live event 重叠或选错记录；回滚 ready consumer/reconcile/tests 即可，不删除 task 或 record。

#### [F16-NARROW-CONTROL-004]

**状态**：实测 UX/视觉缺陷，等待 `improve-comic-creator-responsive-accessibility` 审批；证据强度高（应用内 Chromium rectangle + 截图 + SCSS 条件）。**环境/复现/原始值**：当前 Vite 源码、应用内 Chromium、浅色、DPR 1、无网络/CPU限速；viewport `1280×844`，把工具窗口缩为 `400×760` 并停在 planning。comic root 为 `x=280..680`，text-model input 为 `x=673..833`，超出内容右边界 153 CSS px；document/root horizontal overflow 均为 0，用户没有横向滚动恢复通道。证据为 `docs/evidence/f16-comic-creator/narrow-window-plan-400.png` 与 `metrics.json`。

**调用链/根因/方案**：WinBox resize → comic content inline size → `ComicCreator.scss:310-336` 两列 plan/model 约束 → `ComicCreator.scss:989-1055` 仅 `@media (max-width:640px)` 的 compact rules；浏览器 viewport 未变，故工具自身缩窄不会触发。方案增加 comic-owned inline-size/container boundary 并复用既有 compact layout，约束 composite dropdown；只改外层 WinBox 不能处理用户手动缩窄，强制更大 min width 会减少现有可调整能力，未选。

**风险、验证与回滚**：风险是默认 680/720px 布局漂移、长模型名截断或 portal 错位。批准后同 viewport/data/theme 在 400/640/720px 前后各取控件矩形与截图，阈值为 primary controls 完全落在 content boundary、默认宽度无布局变化；另测中英长值、history empty、大量记录、深浅主题、320/390 viewport 和 DPR。回滚 container boundary/compact selector/tests，无存储或任务影响。

#### [F16-FORM-A11Y-005]

**状态**：实测无障碍缺陷，等待同一 responsive/accessibility change 审批；证据强度高（真实 DOM 属性和 accessible name），真实屏幕阅读器矩阵未运行。**用户影响/复现**：story textarea、文本模型 composite input、history query 和 status 无 `id`/`name`/有效 `aria-label`/`aria-labelledby` 或关联 label；共享导航把 literal `history`、`starred` 和仅 `←` 暴露为名称。场景 select 和页数 input 已有名称，登记为非问题。键盘/读屏用户不能可靠识别上述控件；pointer 路径可达。外层 WinBox 打开后 focus 仍在 BODY 是 F-15 change 所有，不在本 change 重复修复。

**调用链/根因/方案**：visible form/history label → native field 或 `ModelDropdown`/`WorkflowNavBar.tsx:32-79` → value/filter/navigation callback → record/task UI。方案关联本地化 label/ID，给共享导航增加 caller-supplied localized name，保留视觉 icon/count/callback；模型命名 optional prop 与 `improve-video-workflow-form-accessibility` 共用兼容契约。只加 title/placeholder 不是稳定程序化名称，为 F-16 复制 shared component 会分叉，均未选。

**风险、验证与回滚**：风险是多个 tool instance ID 冲突、名称包含私密 prompt、Escape 与外层窗口冲突。批准后用 component test 和 Chromium accessibility snapshot 覆盖两实例、planning/history/starred、Tab/Enter/Escape、中英、disabled/loading/empty，名称不得包含 prompt/task ID/credential/media URL；回滚 optional props/labels/tests，不改布局和 schema。

#### [F16-PERSISTENCE-FEEDBACK-006]

**状态**：已证实的 Promise/error contract 缺口，真实 IndexedDB reject 频率未知；等待 record-consistency change 审批。**用户影响/静态证明**：`ComicCreator.tsx:1362-1422` 对已接受编辑以 `void persistPatch(...)` 启动 durable write，history handlers `:2124-2156` 直接 await storage 但没有本地可见 rejection 状态。write reject 时当前窗口可继续显示 optimistic edit，用户无法知道刷新后可能丢失，且部分路径可形成 unhandled rejection。预期保留当前编辑，显示不含 prompt/media/credential 的安全“未保存”状态，并只在后来成功写入后清除。

**根因/方案/风险/验证/回滚**：页面把 durable write 视为不会失败，现有 task/generation error state 不能表达 record persistence。批准方案贯穿 mutation result 与独立 save status，用 sequence/accepted-order 防止旧失败覆盖新成功；只 catch+console 会继续向用户谎报，reject 后回滚全部当前输入会丢失工作。验证 failure→success、快速连续编辑、task result 与编辑并发、unmount 和隐私断言；风险是保存警告与生成错误混淆或 stale promise 覆盖。回滚 save state/feedback/tests，无 schema 影响。

### 26.4 实际改动、验证、性能/视觉、规格和退出判断

**实际改动与根因映射**：生产代码只修改 `export-service.ts:284-316,482-568`，PPTX/PDF 现在选择所有有图页面并保持 record 页序，零图仍明确抛错；`export-service.test.ts:394-446` 新增部分完成项目和零图片回归。另新增两项待审批 OpenSpec change、四张浏览器截图、原始 `metrics.json` 与 `diagnostics.md`。四张截图原先是 JPEG bytes/`.png` 扩展，已转换为真实 PNG；尺寸和画面未改变。没有实施 record queue、storage-ready reconcile、save feedback、container layout、form/nav a11y 或外层窗口改动。

**定向测试**：修复前新增两项测试为 2 失败，错误均是 `第 2 页缺少图片，无法导出`。使用 Drawnix 自身 jsdom 配置运行 `storage.test.ts`、`task-sync.test.ts`、`utils.test.ts`、`export-service.test.ts` 后，4/4 文件、33/33 项通过，退出码 0。一次从仓库根直接调用 Vitest 绕过 Drawnix config，结果 4 文件、30 通过/3 失败，三项均为 `FileReader is not defined`；归类为错误测试命令/环境，不是产品失败。修改文件定向 ESLint 退出 0，仅 `export-service.ts:202` 一条既有 non-null warning。

**静态与全仓验证**：Drawnix typecheck 退出 0；`pnpm typecheck` 5/5 项目、退出 0；`pnpm check:cycles` 退出 0、无静态 runtime cycle。`pnpm test` 退出 1：Drawnix 185 文件中 180 通过、4 失败、1 跳过，1155 项中 1151 通过、3 失败、1 跳过，另有 1 个未处理异常；失败仍是 cached image data URL、GPT Blob mock、Sora web duration 和 PPT settings mock，异常仍是 `kvStorageService.isAvailable` mock 漂移，与本轮前基线同簇，新增 F-16 测试全部通过。`pnpm lint` 退出 1，继续扫描 package `node_modules` 与 vendored/minified 文件；其中 `react-text` 单项 5,401 个问题（1,995 errors/3,406 warnings），归类工具配置噪声和既有债务，不能计作 F-16 源码回归。

**构建、体积和启动**：fresh `pnpm build:web` 退出 0，app 7,930 modules、约 1m56s，SW 54 modules、1.74s；ComicCreator JS 80.31kB raw/28.02kB gzip，CSS 17.92/3.36kB gzip。`pnpm size` 退出 1：AI Chat 844.32/140kB gzip 超预算；Diagram 934.93/950、Office 269.19/300、Editor 858.24/870、Media Viewer 12.19/20 均通过。`pnpm verify:startup` 退出 0：CSS 14,208B、startup app 3,776B、runtime 1,867B、entry 345B，chunk cycles 为空。没有修改预算，也没有把 AI Chat 既有超限归因于 F-16。

**浏览器、E2E、性能和视觉**：应用内 Chromium 环境、步骤、DOM 和 rectangle 原始值在 `docs/evidence/f16-comic-creator/`。`desktop-plan.png`、`narrow-window-plan-400.png`、`mobile-plan-390x844.png`、`narrow-window-history-empty-400.png` 分别记录默认、窄工具窗、移动外层边界和历史空态。没有 CSS 改动，不宣称视觉改善；153px 越界只有修复前证据，审批实施后才可提供同视口修后对照。本轮没有优化前后至少五次性能样本，不宣称更快、内存更小或 chunk 更小；只登记当前构建值。Playwright `--list` 退出 0，共 89 项/7 文件且没有 F-16 专属流程；smoke 2/2 在页面启动前因配置需要 `chromium_headless_shell-1200`、机器只有 1228 而失败，退出 1，归类测试环境失败，不安装浏览器、不改 timeout/config。

**OpenSpec、文档和工具限制**：两个新 change 均有 proposal/design/tasks/delta；人工检查 record change 为 3 requirements/3 scenarios，responsive/a11y 为 2/3，全仓正式和活动 specs 无同名 requirement。两次 strict validate 均因 OpenSpec CLI 不可用退出 127，不能声称验证通过，也未擅自安装。`add-comic-strip-generator` 仍活动，应先归档或和后续 delta 共同批准。F-16 恢复了其部分导出 requirement；现有源码/测试/账本已经同步。目录无 Git 元数据，无法核对历史、可信 diff、工作树是否干净或自动恢复 build version updater 的旧 buildTime。

**回滚、剩余风险与退出判断**：导出修复和两项测试可独立回滚，不触及数据；两个 proposal 可整目录删除且没有运行时副作用；证据文件可独立删除。F-16 为**调查完成、部分导出修复已验证、其余实施阻塞，未达到退出标准**：record lost update、task restore gap、persistence feedback 等待 record consistency 审批；窄窗响应式与表单/共享导航 a11y 等待 responsive/accessibility 审批；外层窗口仍依赖 F-15 两项 change；正式 Playwright、修后视觉和 record mutation 性能样本尚未闭合。批准后须严格按各 tasks 先红测再实现，并重新从入口复审部分失败、取消、重试、刷新、离线、多窗口、隐私和导出。

## 27. F-18 爆款 MV 生成功能循环

### 27.1 功能名称、用户场景、范围、规格与验收门禁

**用户场景**：用户从工具箱打开“爆款MV生成”，复用或创建配乐，填写创作 brief、模型、尺寸和知识上下文，生成并编辑分镜；为角色复用主体素材，逐镜头或批量生成首帧、尾帧和视频，可停止/重试、插入画布、导出 ZIP，并在刷新或重新打开窗口后从历史和任务记录继续。

**范围**：可达工具注册与多窗口壳、Analyze/Script/Generate/History 四页、音乐发现与选择、创作 brief、分镜/改编 task、角色和主体素材、版本、图片/视频生成、批量停止/重试、任务恢复、record/模型偏好/媒体引用持久化、历史收藏/删除、画布插入、ZIP 导出、错误/分析事件，以及桌面/移动/键盘/焦点/深浅主题的现有状态。非范围为供应商目录与协议正确性（F-09）、任务队列通用并发和外部取消（F-10）、素材库自身筛选/多 store 一致性（F-13）、音乐工具内部生成（F-20）、外层 WinBox 通用窗口行为（F-15/F-28）。本轮不增加 MV 模板、格式、生成方式或模型。

**正式规格与活动 change**：正式 video-mv-workflow-parity/spec.md:6-39 约束角色描述、生成重置和共享 ZIP；正式 video-batch-generation/spec.md:6-51 约束严格串行、前段尾帧驱动后段首帧和失败持续重试。活动 update-video-character-asset-reuse 的 MV delta :23-43 已要求 Script 页可选择主体素材、普通图片兜底并持久化轻量角色字段；本轮恢复这一已批准活动规格。活动 update-video-batch-parallel-generation/spec.md:3-61 与正式批量规格直接冲突，且当前实现是第三种混合语义，见 F18-BATCH-SPEC-CONFLICT-007，审批和产品选择前禁止改动。refactor-workflow-shell、add-creative-brief-workflow 和共享表单 change 与本功能相邻。

新增两个独立行为 change 均等待批准：fix-mv-creator-record-consistency（4/17 tasks，3 requirements/3 scenarios）约束 MV record mutation、task-storage-ready 补同步和安全保存失败反馈；improve-mv-creator-navigation-accessibility（3/16，2/3）约束本地化导航名称与音乐/历史行键盘操作。MV 表单仍由 improve-video-workflow-form-accessibility 所有；外层窗口响应式/焦点分别由 fix-tool-window-viewport-transition 和 improve-tool-window-accessibility 所有，不建立重复 change。OpenSpec CLI 不可用，严格校验退出 127；以上只完成人工结构、同名 requirement 和活动冲突核查。

**已知基线与验收门禁**：进入本轮前，F-16 宽基线为 Drawnix 185 文件 180 通过/4 失败/1 跳过、1155 项 1151 通过/3 失败/1 跳过及 1 个未处理异常；全仓 typecheck 5/5、cycles 通过，lint 扫描包内 node_modules，AI Chat size 超限，Playwright 缺 chromium_headless_shell-1200。本轮验收要求主体选择从命名按钮到素材筛选、轻量映射、durable write 和 Script UI 投影闭合；普通图片不得抹掉用户描述；不修改 record shape、50 条上限、任务/缓存 key、provider route、batch/export/reset 语义；新增测试全部通过且宽基线失败簇不增长。batch、record/recovery/feedback、a11y 和窗口几何均改变用户可观察或恢复语义，只调查和写 change，不在批准前实施。视觉/性能只有同条件至少五次前后数据或同视口前后截图才能宣布改善。

### 27.2 正向、反向调用链、数据与不变量

**正向调用链**：

1. 工具箱入口：built-in-manifests.tsx:57-68 注册 680×700、支持多窗口的 mv-creator → tools/tools/mv-creator/index.tsx:6-58 懒加载 → ToolWinBoxManager/WinBox → MVCreator.tsx:41-89 建立 record、导航和 task sync → :125-172 渲染 Analyze/Script/Generate/History。
2. 配乐和分镜：AnalyzePage.tsx:180-210 从 taskStorageReader 读取全部已完成 AUDIO（含 archived）并提取 clip → :212-277 可打开音乐工具或把已有 clip add/update 到 MVRecord → creative brief、视频/文本模型、知识 refs 和默认 duration 收集/转换 → :293-373 组装 storyboard prompt，taskQueueService.createTask(TaskType.CHAT) → 主线程 task queue/media executor/provider/network → task snapshot/事件 → task-sync.ts:112-147 解析 JSON、建立版本、写 editedShots/characters/pending terminal → MVCreator records/current UI。
3. Script 编辑与主体素材：MVCreator.tsx:149-156 → ScriptPage.tsx:99-159 持有窗口局部表单、模型与 record 投影；角色描述和镜头编辑分别经 :161-177、:232-245 写 record。CharacterDescriptionList.tsx:30-69 的命名按钮 → ScriptPage.tsx:511-553 打开现有 MediaLibraryModal，初始 IMAGE + CHARACTER 筛选；MediaLibraryGrid.tsx:1560-1593 允许用户关闭主体标签以选择普通图片 → subject-asset.ts:9-24 只映射 name/description/referenceImageUrl → ScriptPage.tsx:168-177 await updateRecord 成功后更新 records/current；失败时 modal 不会因成功回调完成而关闭。AI 改编从 :247-312 创建 CHAT task，:314-360 与共享 task hook消费终态，task-sync.ts:151-213 保留 referenceImageUrl、写新版本和 UI。
4. Generate：GeneratePage.tsx:181-315 收集 record、shots、image/video model refs、兼容 duration/size、knowledge refs、插入偏好和 task state；:316-438 通过 applyRecordPatch 把模型和参数写 MV record；:441-535 计算可导出资产、插入脚本/视频到画布、调用 shared ZIP exporter并显示 Message。单角色/镜头入口在 :535-1368 通过 generation dialog 或 mcpRegistry queue 创建 image/video task，task queue → media executor → model adapter/provider → task storage/unified cache/URL → :606-736 与 :1146-1172 投影角色/首尾帧/视频引用。批量入口 :1387-1769 预热角色图和关键帧、建立各 shot pipeline、等待/重试/取消、选择性插入画布，最后写 shot/record 并更新进度 UI；:1807-1816 重置生成资产但保留脚本/模型/版本；:2080-2090 触发 ZIP。
5. 历史、恢复和反向 UI：HistoryPage.tsx:71-126 把 record 与共享 task map按 record/batch ID 分组，:128-260 负责收藏、删除、展开和选择；storage.ts:17-41 汇入 mv-creator:records，shared record-storage.ts:32-106 以 kvStorageService/IndexedDB 保存最多 50 条非收藏淘汰记录。MVCreator.tsx:72-89 的 useWorkflowTaskSync 在挂载时扫内存、之后订阅 RxJS；task-sync.ts:112-235 是 storyboard/rewrite/music 的 record writer。刷新时 task snapshots 由 useTaskStorage.ts:55-80 延迟恢复，record 则由 useWorkflowRecords.ts:48-67 独立加载。

**反向追踪**：最终 MV 页面 records/current 的写入者为 Analyze 本地选择/分镜、Script autosave/角色/镜头/改编、Generate 参数/媒体/重置、History 收藏/删除、共享 live task sync 和其他工具窗口；全部反查到 storage.ts 的同一 key。最终角色 referenceImageUrl 的可达 writer包括 Script 素材选择、Generate 角色图 task、改编合并和 reset；生成请求的读者在 Generate frame/video prompt 参数，步骤三角色预览与请求共用该引用。最终图片/视频/audio URL 来自 task result/cache/selected clip，写入轻量 record 后由 UI、ZIP exporter、画布 insertion 消费；大 binary 不进入 MV record。外部 provider 请求的用户入口均反查到显式 generate/rewrite/storyboard 控件或批量入口。失败经 task error/Message/页面 message 返回；持久化 reject 目前不是独立 UI 状态，见 F18-PERSISTENCE-FEEDBACK-006。

**输入、默认值、状态和转换**：MVRecord 定义在 types.ts:27-81，稳定 id/createdAt/sourceLabel/starred 加 music、model ref、duration/size、creative brief、pending task、shots/version、batch/character URL；旧 creationPrompt 和 characterReferenceUrls 保留兼容。视频默认模型由本地 model-selection storage 和 getVideoModelConfig 选择，duration/size切换时回落到当前模型合法值；文本模型默认 gemini-2.5-pro。React state/latest refs 是当前窗口投影，task queue/RxJS 是执行 owner，IndexedDB 是 record/task durable owner，统一缓存/Cache API 是媒体 owner，board/workspace 是插入结果 owner。knowledge refs 和 model refs保持轻量；analytics 只记录动作、数量、时长、布尔和安全标识，不应包含 prompt、歌词、知识正文、凭据、完整 record 或媒体 payload。

**并发、取消、重试、恢复、离线与缓存不变量**：同 task ID 的 local/shared/restored投影必须幂等；多窗口和同 record 的非冲突 mutation 不得互相覆盖；50 条上限、收藏保留、active version、record/task/cache keys 与 schema 不变。用户停止批量时必须停止新任务并取消活动 task，完成结果保留；batch 的串行/并行、尾帧和失败隔离预期当前未知，不能选边实现。provider 离线沿 task失败返回，已有历史 record仍可加载，但媒体预览取决于 URL/cache 可用；本轮没有离线成功承诺或缓存失效改动。刷新补同步必须等唯一 task-storage-ready owner，不能为 F-16/F-17/F-18 各建一个全局 coordinator。

**测试位置与覆盖边界**：ScriptPage.test.tsx、CharacterDescriptionList.test.tsx、subject-asset.test.ts覆盖主体按钮、映射和 durable call；mv-creator generate-page-helpers/task-sync/utils及 shared workflow record/version/model/brief/nav/task-sync tests覆盖纯函数和任务映射。task queue/media/provider/cache测试覆盖相邻边界。当前 Playwright 132 tests/13 files中没有可完成真实 provider 的 MV 成功流；应用内 Chromium只证明入口、Analyze、history empty、DOM名称和窗口几何，不能替代 Script/Generate、取消/重试、离线和刷新 E2E。

### 27.3 问题证据、决策、风险、验证与回滚

#### [F18-SUBJECT-PICKER-SPEC-001]

**状态**：已证实并修复；证据强度高（活动 delta、修复前红测、修复后 DOM/integration/映射测试、typecheck与当前源码）。**用户影响、复现、当前与预期**：修复前以含一个角色的 MVRecord 渲染 ScriptPage，在角色区域按 role/name 查询“选择主体素材”；1 文件3项中2通过、1失败，找不到按钮，用户只能手写描述，无法完成 update-video-character-asset-reuse/spec.md:23-43 已规定的 Script 主体复用。预期选择主体后持久化 name/description/referenceImageUrl；普通图片可用，且无显式 prompt 时保留用户描述；不得保存 Asset 或 binary。

**调用链、根因与改动**：Script → CharacterDescriptionList 旧接口只有 onChange，现有 picker仅在 Generate，导致已批准活动 spec 与可达 Script UI漂移。最小修复为 CharacterDescriptionList.tsx:4-8,30-65 增加可选 callback和原生命名按钮；ScriptPage.tsx:111-177,511-553 复用 MediaLibraryModal、IMAGE/CHARACTER 初始筛选并在 durable write 完成后关闭；subject-asset.ts:4-24 统一轻量映射。新建另一个素材弹窗会重复 F-13 状态，直接保存完整 Asset会破坏 record轻量不变量，普通图总是覆盖 description会破坏用户编辑，均未采用。

**风险、验证和回滚**：风险为多角色选错 ID、普通图清空描述、modal过早关闭、资产对象进入 record。ScriptPage.test.tsx:131-173 断言选择目标与 updateRecord patch；subject-asset.test.ts:24-57 断言主体优先级和普通图保留描述；CharacterDescriptionList.test.tsx:13-50 断言空态、编辑和命名按钮。红后3文件6项、扩大17文件59项、最终清理后7文件18项均退出0。真实 Script页需要已有 record/provider fixture，浏览器没有伪造数据，因此修后同视口截图和完整素材选择 E2E仍是明确缺口，F-18不能据此退出。回滚删除 optional prop、picker state/modal、mapping helper及三组测试；record/schema/cache无需迁移，旧 referenceImageUrl仍可读。

#### [F18-RECORD-LOST-UPDATE-002]

**状态**：实测缺陷，等待 fix-mv-creator-record-consistency 审批；证据强度高（真实 storage模块、受控 completion顺序、多窗口可达 writer）。**用户影响、复现、当前与预期**：初始 durable record为 {starred:false, sourceLabel:'旧标题'}；并发接受 favorite patch和title patch，预期 {starred:true, sourceLabel:'新标题'}，实际 {starred:false, sourceLabel:'新标题'}。临时诊断1文件/1项、0通过/1失败、退出1，记录原始值后删除。用户在两个允许并存的MV窗口，或task结果与编辑/收藏重叠时，可无提示丢失非冲突字段。

**调用链与根因**：工具 manifest supportsMultipleWindows → Analyze/Script/Generate/History/task sync writer → storage.ts:17-41 → record-storage.ts:48-106 各自 load-modify-set whole array → kvStorage/IndexedDB。两个调用读取同一旧快照，后完成的整数组set覆盖先完成patch。候选 change只在MV key接受边界串行 mutation，每次读取最新 durable值、保留schema/50条规则并让reject释放队列；用React state当 durable owner不能覆盖其他窗口/task writer，Web Locks、通用Repository或新事件总线扩大未经证实的边界，未选。

**风险、验证与回滚**：串行可能增加批量完成写延迟；批准后先加 update/update、task/edit、subject/edit、add/delete、reject/success红测，再对0/10/50 records × 1/10/50 accepted mutations各5次，阈值0丢失并报告median/min/max。还需复验两个窗口、收藏/删除、reset、刷新和隐私。回滚MV-key queue与测试，不迁移或清理数据；无法恢复修复前已丢字段。

#### [F18-TASK-RESTORE-GAP-003]

**状态**：已证实的静态恢复缺口，真实发生频率未知；等待同一 record-consistency change审批。**用户影响、复现与预期**：MV在task storage前挂载时，useWorkflowTaskSync.ts:57-65只扫描当时内存一次，之后仅处理事件携带的task；useTaskStorage.ts:55-80稍后恢复全部持久任务，而 task-queue-service.ts:2425-2434只以map第一项发generic event。如果第一项不是MV，后续完成的storyboard/rewrite/music task不会补回record，刷新后页面可停在pending或缺结果。预期storage ready后逐个过滤相关终态task并幂等检查，且不切换用户当前无关record。

**调用链、根因、候选、风险与回滚**：IndexedDB task snapshots → deferred restoreTasks → all in-memory tasks + single representative event → MV shared hook → task-sync.ts:112-235 → record/UI。isReady只停在useTaskStorage直接caller，没有到workflow consumer。方案与 comic/video analyzer/main-thread recovery 共用唯一ready signal，MV做filtered reconcile并以task-ID singleflight合并live/local/restored；逐task伪造全局event会改变所有消费者事件量，MV轮询会制造第二readiness owner，均未选。批准后用空内存→多终态tasks且首项非MV→同步live completion的确定性测试，断言每task一次、版本/clip不重复、current selection不变；回滚ready consumer/singleflight/tests，不删除task或record。

#### [F18-TOOL-WINDOW-RESPONSIVE-004]

**状态**：实测UX/视觉缺陷，等待既有 fix-tool-window-viewport-transition 审批；证据强度高（同一可达窗口DOMRect、截图和无水平恢复）。**环境、步骤、原始值和预期**：当前Vite源码、应用内Chromium、浅色、DPR1、无网络/CPU限速；1280×720打开MV时WinBox x=300..980、680×700。保持窗口打开切到390×844，WinBox x=300..700、width400，MV root x=300..689；只有90 CSS px可见，右侧299px越界，body clientWidth=scrollWidth=390，用户没有文档横向滚动恢复。预期由通用change在compact时把已打开非最大化工具安全clamp进viewport，返回desktop时恢复用户矩形而不永久写回自动布局。

**调用链、根因、替代、风险、验证与回滚**：680×700 manifest → ToolWinBoxManager compact default约束 → WinBoxWindow default minWidth 400和旧x/y → viewport transition只resize不move → MV不可达。只改MVCreator.scss不能移动外层window；永久保存400px会破坏desktop偏好，因此复用F-15 change而不新建MV实现。风险为多窗口重叠、dragged rect和desktop往返漂移；批准后测冷开/desktop↔compact、320/390/768/1280、横竖屏、中英深浅和至少5次event-to-stable geometry，并提供同视口修后截图。回滚通用opt-in/几何测试，无record/task/cache迁移。

#### [F18-FORM-NAV-A11Y-005]

**状态**：实测的可达性与键盘契约缺陷，分属两个待审批change；证据强度高（真实DOM属性/accessible name和静态事件链），未运行真实屏幕阅读器矩阵。**用户影响、复现、当前与预期**：1280×720中文Analyze页检查4个creative brief字段，4/4均没有id/name/aria-label/aria-labelledby/associated label；storyboard model input也只有placeholder。WorkflowNavBar.tsx:32-87实际暴露history、starred和←。AnalyzePage.tsx:417-440的music clip与HistoryPage.tsx:162-260的record是pointer-only div，不能以Tab+Enter/Space等价选择；nested audio/favorite/expand/delete需要独立事件所有权。预期表单有稳定本地化名称与共享combo键盘契约；MV导航有本地化名称，两个selectable row有button-equivalent键盘操作且nested control不触发parent。

**调用链、方案、替代、风险、验证与回滚**：visible label/nav/row → CreativeBriefEditor/ModelDropdown/WorkflowNavBar/native div → value/filter/selection callback → prompt/task/record页面。表单复用 improve-video-workflow-form-accessibility，不接管外层WinBox；导航/row使用 improve-mv-creator-navigation-accessibility，并与F-16复用一个optional shared nav naming contract。只加title/placeholder不能建立稳定程序化名称；把nested整行改原生button会产生button内interactive无效结构；复制shared component会分叉，均未选。风险为两窗口DOM ID、Space滚动/双触发、Escape冒泡、名称泄露prompt/lyrics/URL。批准后组件+Chromium accessibility snapshot覆盖Analyze/History empty/populated、两窗口、Tab/Enter/Space/Escape、nested controls、中英、深浅、disabled/loading/error，名称不得含prompt、歌词、task ID、凭据或URL。分别回滚optional props/ARIA/keyboard adapter/tests，不改布局、schema、存储和请求。

#### [F18-PERSISTENCE-FEEDBACK-006]

**状态**：已证实的Promise/error contract缺口，真实IndexedDB reject频率未知；等待 fix-mv-creator-record-consistency 审批。**用户影响、静态复现、当前与预期**：ScriptPage.tsx:193-218 的500ms autosave直接await updateRecord且没有catch，角色/镜头handler在 :161-177,232-245 以void启动async save；GeneratePage.tsx:606-736、1146-1172多处void updateRecord(...).then(...)无catch；AnalyzePage.tsx:135-163和HistoryPage.tsx:128-147也没有独立持久化失败状态。注入kvStorage reject时，当前optimistic UI可继续显示但用户不知道刷新后会丢失，并可产生unhandled rejection。预期保留当前工作，显示不含敏感内容的“未保存”状态；后来accepted write成功时只清保存警告，不清task/generation error。

**根因、方案、替代、风险、验证与回滚**：页面把durable write当作不会失败，现有task/message state不能准确表达record durability。批准方案把mutation result和sequence-owned save status贯穿各writer；catch+console仍向用户呈现虚假已保存，reject后回滚整页会丢输入，均未选。风险为旧failure覆盖新success、保存警告与生成error混淆、unmount后state write；批准后覆盖failure→success、快速编辑、task/edit并发、subject/history/reset/batch、unmount和隐私断言。回滚save status/feedback/tests，无schema/cache变化。

#### [F18-BATCH-SPEC-CONFLICT-007]

**状态**：未知/阻塞，证据强度高但缺少唯一产品语义；禁止实施。**用户影响、复现、当前与预期**：正式 video-batch-generation/spec.md:6-51要求严格串行、前段尾帧驱动下一段首帧、当前失败持续重试到成功或用户停止；活动 parallel delta :3-61要求独立并行、每镜头自身首帧、禁止尾帧链和单镜头失败不阻塞。当前 GeneratePage.tsx:1387-1769 是第三种行为：:1756-1769 Promise.allSettled并行，:1648-1657在本镜头无尾帧时使用下一镜头首帧作为当前尾帧，:1723-1738不可重试失败会全局stop/cancel。因此当前、正式和活动三者没有一致“预期”，不能把任一差异直接修成另一语义。

**完整链、影响、候选、验证与回滚**：全部生成按钮 → frame预热 :1508-1615 → shot pipeline :1617-1754 → task queue/provider → cache/task/record/画布 → batch进度/停止。影响并发费用、镜头连续性、失败隔离、取消、刷新恢复和F-10/F-17。候选A是撤回parallel change并按正式spec恢复串行/尾帧链/持续重试；候选B是批准parallel delta、同步正式spec并实现独立首帧/失败。保留第三种混合语义没有规格依据。用户选择后必须先更新独立OpenSpec，再以3镜头fixture覆盖已有首/尾帧、可/不可重试失败、停止、刷新和插画布，记录task创建顺序、最大并发、传入首尾帧、取消集合和5次stub时延/费用计数。回滚必须整体恢复该change前的scheduling/frame/failure策略及测试；当前未改，无回滚动作。

#### [F18-UNCONSUMED-SURFACE-008]

**状态**：已证实并清理的无行为实现漂移；证据强度为清理前后全仓反向搜索和当前组件契约。**证据、调用链与影响**：清理前 AnalyzePage 的 onCreateNew 只有props声明与MVCreator唯一传值，组件解构、事件、DOM和service均无消费，无法从最终UI反查到任何writer；三条 PLACEHOLDER_ANALYZE_PAGE_* 注释只命中自身且不对应正式spec、test或运行分支。已删除该prop/传值和三条漂移注释。当前 AnalyzePage.tsx:52-64 只保留existingRecord/onComplete/onRecordsChange/onNext，MVCreator.tsx:141-147调用一致；对mv-creator源码、docs和openspec反查onCreateNew/placeholder标记为0命中。

**方案、替代、风险、验证和回滚**：不为未消费prop虚构“新建”功能，也不保留宣称不存在状态的placeholder注释；新增按钮会是未经批准的新能力，未选。风险仅为遗漏动态字符串/外部类型consumer；工具是内部lazy component且全仓静态反查无调用，定向typecheck/test/build均通过。无Git元数据，若需回滚只能从外部备份恢复prop/comment；没有用户数据、schema或运行时副作用。

### 27.4 实际改动、验证、性能/视觉、规格与退出判断

**实际改动与根因映射**：运行时代码只做两类改动：(1) CharacterDescriptionList optional subject action、ScriptPage复用MediaLibraryModal、shared subject-asset轻量映射，恢复F18-SUBJECT-PICKER-SPEC-001；(2) 删除无消费onCreateNew和三条自命中placeholder注释。新增ScriptPage、subject mapping、CharacterDescriptionList测试。行为change仅新增 fix-mv-creator-record-consistency 和 improve-mv-creator-navigation-accessibility 的proposal/design/tasks/delta；没有实施batch、record queue、task-ready reconcile、save feedback、form/nav row a11y、外层窗口或CSS。

**窄测试与静态验证**：修复前 CharacterDescriptionList 红测为1文件3项、2通过/1失败、退出1，唯一失败是找不到“选择主体素材”button。修复后主体相关3文件6/6通过；扩大MV/shared workflow为17/17文件、59/59项通过；清理后最终7/7文件、18/18项通过，均退出0。既有stderr为indexedDB is not defined、Browserslist数据库过期和第三方sourcemap，不是新增业务断言失败。修改文件定向ESLint退出0；ScriptPage仍4条既有warning、0 error。Drawnix typecheck退出0；最终全仓 pnpm typecheck 为5/5、退出0；pnpm check:cycles退出0、无static runtime cycle。

**全量单测基线对照**：根Nx test首次因新shell默认PATH没有Node而未启动Drawnix，归类环境失败；随后使用Codex随附Node绝对路径逐包运行。Drawnix退出1：187文件中182通过、4失败、1跳过；1159项中1155通过、3失败、1跳过，另1个未处理异常。相较F-16新增2文件、4项且全部通过；失败仍为cached image data URL、GPT Blob mock、Sora duration和PPT settings mock，未处理异常仍是benchmark kvStorageService.isAvailable mock，失败簇未增加。utils 25/25文件、471/471项通过；react-board 1/1文件、8/8项通过。全仓pnpm lint退出1，继续扫描包内node_modules/vendored文件；react-text单项5401 problems，归类既有工具配置噪声，不能计作F-18回归。

**构建、体积和启动**：清理后第二次fresh pnpm build:web退出0；app转换7931 modules、1m48s，SW 54 modules、1.64s。MVCreator JS 79.91kB raw/26.25kB gzip，CSS 4.81/1.35kB gzip；首次fresh构建相应为79.92/26.26和4.81/1.35，只证明无可见包体回归，不构成性能改善。pnpm size退出1：Startup App 1.94/820、Runtime 1.01/5、Diagram 934.93/950、Office 269.19/300、Editor 858.24/870、Media Viewer 12.19/20 kB gzip通过；唯一超限仍为AI Chat 844.37/140，未提高预算且不归因于F-18。pnpm verify:startup退出0：CSS 14208B、startup app 3776B、runtime 1867B、entry345B，chunk cycles为空。构建会更新version/HTML/changelog；因无Git元数据无法对比历史buildTime或生成可信diff。

**浏览器、E2E、性能与视觉**：docs/evidence/f18-mv-creator/包含desktop Analyze、390×844 mobile Analyze、desktop history empty三张真实PNG，metrics.json记录环境、DOM names和rectangle，diagnostics.md记录步骤与限制。截图最初为JPEG bytes/.png扩展，已转换为真实PNG且file确认1280×720、1280×720、390×844，尺寸和画面未变。没有CSS改动，不宣称视觉改善；窗口问题只有修前截图，主体按钮因无MV record/provider fixture没有真实Script修后截图，均需审批/fixture后补同视口证据。本轮性能样本为0，不能宣称更快、省内存或更小；chunk值仅为当前构建观察。

Playwright --list退出0，共132 tests/13 files。smoke 2/2均在应用启动前失败；feature、visual、responsive使用max-failures=1复验同一launch阻塞：配置需要本机缺失的chromium_headless_shell-1200。没有安装浏览器、增加timeout或放宽断言，因此归类测试环境失败，不冒充产品失败或E2E通过。Vite 7200取证服务器已停止，lsof无监听。没有provider凭据，也没有声称真实生成成功。

**OpenSpec、文档和回滚**：两个新change均含proposal/design/tasks/delta；人工核查record change为3 requirements/3 scenarios、navigation change为2/3，同名requirement在全仓各唯一。OpenSpec strict validation因CLI不可用退出127，不能声称通过，也未安装工具。活动update-video-character-asset-reuse与当前主体实现/测试已同步；batch正式/活动冲突已登记而未擅改。账本、metrics和diagnostics是本轮文档证据。主体修复可按F18-SUBJECT-PICKER-SPEC-001独立回滚；两个proposal可整目录删除且无运行时/数据副作用；死代码因无Git只能从外部备份恢复。

**复审与退出判断**：从工具入口重新反查后，主体选择已闭合到轻量record并被步骤三生成链消费，没有新增schema、cache、provider或version分叉；普通图保留描述、modal等待durable callback、相关测试和宽验证均无新增失败。F-18当前为**调查完成、主体素材规格恢复和无消费者清理已验证，其余实施阻塞，未达到功能退出标准**：batch三方语义等待用户在串行正式spec与并行delta间决策；record lost update、task restore gap和persistence feedback等待record consistency审批；表单、MV导航/row和外层窗口等待三个既有/新增change审批；正式Playwright、Script/Generate真实浏览器流、修后视觉、五次record性能样本和provider成功/离线流程未闭合。获批任一change后必须按tasks先红测再最小实施，并重新从入口复审失败、停止/重试、刷新、离线、多窗口、隐私、导出和画布插入。

## 28. F-19 批量出图功能循环

### 28.1 用户场景、边界、规格与验收门禁

**用户场景**：用户从工具箱或 AI 图片生成窗口进入“批量出图”，在表格中编辑多行提示词、模型参数、数量和参考图片；通过 Excel 或图片批量导入提高录入效率，选择若干行提交多个图片任务；随后在行预览、任务面板、素材库和画布中观察生成、失败、取消、重试、刷新恢复和最终结果，并导出 Excel 或已完成图片。

**范围**：内置工具注册、ToolWinBox 入口和 generation dialog 的 single/batch 入口；五行默认草稿、异步草稿 cache、行/单元格选择和 undo/redo；模型与参数选择、知识上下文、参考图上传/素材选择/拖放；Excel 导入/导出；任务创建、行 taskIds、任务状态投影、失败行选择、任务面板取消/重试；自动插画布、结果预览和选中下载；桌面/平板/移动端布局、键盘和辅助技术语义；kvStorage、task storage、asset store、统一缓存和画布边界。

**非范围**：模型目录、provider 协议和健康检查由 F-09 所有；任务队列通用调度、恢复 readiness、取消和历史保留由 F-10 所有；素材去重、配额和多存储事务由 F-13 所有；通用自动插入布局由 `update-canvas-batch-flow-layout`/F-06 所有；外层 WinBox viewport/dialog/focus/Escape 分别由 `fix-tool-window-viewport-transition` 和 `improve-tool-window-accessibility` 所有。本轮不新增生成模式、文件格式、并发策略、缓存 key、task/asset/board schema 或产品入口。

**规格与活动 change**：正式 `openspec/specs/image-generation/spec.md` 只规定 GPT Image edit/generate 路由，不包含批量草稿、行状态、提交反馈或表格交互；正式 `toolbox`/`toolbox-plugin-runtime` 只覆盖 internal tool 打开与窗口运行时。当前没有独立已归档的 `batch-image-generation` capability。已建立 `fix-batch-image-cache-initialization`（3/15 tasks，1 requirement/4 scenarios）和 `improve-batch-image-accessibility`（3/17，2/5）；同时把 F-19 全拒绝/部分拒绝场景纳入既有 `improve-generation-dialog-task-creation-feedback`，该 change 后来又由 F-20 追加场景，当前为 6/18 tasks、2 requirements/10 scenarios。三项都改变用户可观察的加载、恢复、反馈或键盘语义，等待审批，审批前只保存证据和 proposal/design/tasks/delta。

**本轮验收门禁**：批准前不得实现三项行为 change；不得用旧失败 taskIds 是否应保留来猜测“重试”语义；不得因代码中存在 Data URL/whole-table write 就宣称性能问题。批准后，草稿读取不得覆盖任何已接受 mutation；任务创建全拒绝/部分拒绝必须显示安全、准确的计数和可操作原因而不回滚已接受任务；键盘可独立进入/离开表格并保持 nested control 优先级。缓存 key/shape、taskIds、自动插入、provider 请求和 Excel 格式保持不变；所有前后性能/视觉结论必须有同环境五次样本或同视口截图。

### 28.2 正向、反向调用链与不变量

**正向链**：

1. 工具入口：`tools/built-in-manifests.tsx:71-81` 注册“批量出图工具”1200×800窗口 → `tools/registry.tsx:12-16` 懒解析 → `tools/tools/batch-image/index.tsx:8-64` 适配内部 React component → `ToolWinBoxManager`/`WinBoxWindow` → `batch-image-generation.tsx:3146-3650`。图片生成 WinBox 另由 `ttd-dialog.tsx:43-44,72,731-769` 在非移动/平板的 single/batch tab 中复用同一组件。
2. 草稿恢复：组件先以 `getDefaultTasks()` 建立五行 state → `batch-image-generation.tsx:376-403` 异步读取 `batch-image-generation-cache` → 有效非空值整表恢复 tasks/counter → `:675-688` 在 `cacheLoaded` 后按 tasks/counter 每次变化 fire-and-forget whole-value set → kvStorage/IndexedDB；该 key 已进入现有 storage migration 和 environment backup，未改变 shape。
3. 表格编辑：cell/checkbox/column action/paste/import/upload/library/drag-drop → active/selected/editing/openParams React owner → `updateCellValue`/`setTasks`/history snapshot → UI表格与保存 effect。行本地图片同时 `addAsset(File)` 到 asset store，并以 FileReader Data URL 写入 `TaskRow.images`；素材选择只写 asset URL。
4. 提交：勾选行 → `submitToQueue` 做空选择/空prompt/生成中/≥100警告 → credential route check → 对每行 `count` 次构建 model/modelRef、knowledge refs、uploadedImages、batchId/index/total 和 `autoInsertToCanvas:true` → `useTaskQueue.createTask` → `TaskQueueService.createTask` → 主线程 media executor/provider/network → task storage/cache/RxJS。
5. 行状态与结果：每个 non-null create result 的 ID 追加到行 `taskIds` 并回写草稿；`getRowTasksInfo()` 以 taskIds 与共享 `queueTasks` 交集投影 idle/generating/completed/failed/partial → 行 loading/error/thumb/gallery/download/失败行选择。通用任务面板是取消、重试和详情入口，批量表本身没有独立 cancel/retry action。
6. 自动插入：终态 image task → `useAutoInsertToCanvas.ts:1340-1471` 读取 `autoInsertToCanvas`、batch/group 信息 → insertion group/board operation → `markAsInserted`、post-processing和画布 UI；刷新恢复的 completed task也走相同扫描/幂等保护。素材保存与行预览继续消费 task result/cache URL。
7. 导出：Excel export读取当前 tasks、行 task state 与结果 URL，Data URL reference只输出本地图片标记；选中图片下载只收集已完成 task result URL并调用 `smartDownload`。错误由 MessagePlugin返回，导出不修改 task/cache/board。

**反向链**：画布中的批量生成图片可反查到 `useAutoInsertToCanvas` 唯一通用消费路径，再到带 `autoInsertToCanvas:true` 的 F-19 create params、选中行和工具入口；行预览/Excel结果的 writer 只有 taskIds∩queueTasks 投影，taskIds 的生产 writer 只有 `executeSubmit`、恢复 writer 是草稿 cache；草稿 durable value 的 writer 是当前 component save effect和备份/迁移导入，读者是初始 hydration和environment backup；asset library中的本地参考图 writer 是三类 upload/drop/import `addAsset()`，消费者是 library/row URL/provider uploadedImages。失败来自 create rejection或terminal task error；取消/重试来自共享任务面板；刷新先后依赖独立的草稿与task storage初始化；离线provider失败沿task error进入行状态，但已有草稿仍应可编辑。

**类型、转换和状态所有权**：`TaskRow` 持有 numeric row id、prompt、模型参数字符串record、reference URL数组、count和taskIds；React是当前窗口交互owner，kvStorage value是草稿durable owner，TaskQueueService/RxJS/Jotai是执行状态owner，task storage是task durable owner，asset store/统一缓存是媒体owner，Plait board是插入结果owner。count默认为1，UI number editor约束1..10，但Excel/缓存输入可产生更大值并走现有≥100确认；MJ prompt附加参数后缀，非MJ用adapter params；reference Data URL/asset URL都转换成 `uploadedImages[{type:'url'}]`。

**并发、恢复、错误和隐私不变量**：submit lock必须防止同窗口重复点击；同一次提交中一个 create reject不得回滚已创建task；每个accepted task ID只追加一次并在自动插入后只插一次；刷新时草稿和task状态未就绪不能伪装为确定idle；用户取消不得被渲染成从未提交，具体重试历史聚合语义尚待产品确认；cache/task/asset/board schema和existing backup format不变。安全反馈不能暴露stack、凭据、原始provider payload、完整prompt、Data URL或task ID；分析event只保留已有聚合字段。本轮没有新增日志或analytics写入。

**测试位置与覆盖缺口**：`useTaskQueue.test.ts` 已证明具体 create error被压成null；`useAutoInsertToCanvas.test.ts`覆盖board未就绪重试和completed insert；image anchor/progress/prefill、image retry、generation preference/model-selection测试覆盖相邻参数、恢复和插入。当前没有 `batch-image-generation` 专属component/unit test，也没有正式 Playwright F-19流程；因此缓存延迟、full/partial create reject、cancelled row、task restore readiness、Excel/图片导入和表格键盘必须新增覆盖。真实provider成功/离线、正式E2E和性能五次样本仍受凭据/浏览器环境或审批门禁阻塞。

### 28.3 问题证据、决策、风险、验证与回滚

#### [F19-CACHE-HYDRATION-001]

**状态**：已证实的静态时序缺陷，等待 `fix-batch-image-cache-initialization` 审批；证据强度高（当前state/happens-before链、可达交互、无merge/dirty/gate反证）。**用户影响、复现、当前与预期**：令 `kvStorageService.get()`保持pending，组件显示默认5行并接受一次prompt/导入/删除；随后以旧非空draft resolve。当前 `:381-394` 无条件 `setTasks(cached.tasks)`，刚接受的mutation消失。预期初始durable draft选择完成前不宣称接受mutation；选择cache或默认一次后，后续编辑不得再被initial read替换。

**调用链与根因**：tool open → default tasks `:366-369` → independent get `:376-403`；同时cell/import/upload/delete handler → setTasks；read completion → whole-table replacement。`:675-688`的`cacheLoaded`只阻止早写，不能保护早edit。候选change在现有读取边界显示命名loading并暂不暴露mutation/submit，settle后一次选择cache/default；按row ID merge缺少删除/重排/task history冲突规则，skip cache会让临时defaults覆盖旧draft，复制prompt-storage mutation log对一次本地读过度复杂，均未选。

**风险、验证、回滚**：慢IndexedDB会把当前“立即可编辑”变为短暂loading；批准后先用deferred resolve/reject/unmount红测，再验证有效、空、畸形、reject、close/reopen和post-hydration save。冷/热各5次记录mount-to-editable median/min/max，不能无数据声称更快。回滚loading gate和测试即可，key/value/backup不变，无迁移或清理。

#### [F19-TASK-CREATE-FEEDBACK-002]

**状态**：已证实，等待更新后的 `improve-generation-dialog-task-creation-feedback` 审批；证据强度高（现有hook诊断测试+batch downstream静态链）。**用户影响、复现、当前与预期**：让选中有效行的create全部throw，Hook全部返回null；`submittedCount=0`且`:2196-2202`不进入消息分支，用户点击后表格无task、无原因。让一项成功一项throw，只显示“已提交1个任务”，不说明另1项拒绝。预期零接受显示安全原因/通用指导；部分接受保留成功task并同时报告accepted/rejected计数，表格可修正重提。

**调用链/根因/方案**：generate button → `submitToQueue` → `executeSubmit:2089-2206` → `useTaskQueue.createTask` → `createTaskAtom:82-93` catch-all null → success-only count/taskIds/message。shared hook把failure reason和result kind压平。更新既有change而不新建冲突的typed-hook proposal；备选让batch直接调用service会绕过atom同步，原样显示Error可能泄露provider/request，均未选。批准后先扩hook test和batch full/partial/generic red tests，再最小透传safe result；不得改变validation、queue、provider、并发、自动插入或accepted task。

**风险、验证、回滚**：typed contract会影响图片/视频/batch三个consumer，必须一次核对success/recognized/unknown；部分失败消息不能让成功task重复创建或从行移除。验证3个surface中英、纠正/重提、refresh/cancel/recovery和隐私。回滚hook result adapter与三处render/tests，无schema或任务清理。

#### [F19-TASK-RESTORE-READINESS-003]

**状态**：已证实的静态恢复缺口，真实用户频率未知；实现阻塞于F-10共享task readiness owner，当前不另建全局coordinator。**用户影响、当前与预期**：草稿cache可先恢复非空taskIds，而`queueTasks`仍为空；`getRowTasksInfo:1778-1808`此时返回idle。组件只解构tasks/createTask，不消费`useTaskQueue.isLoading`。`useTaskStorage`又在idle后异步恢复，`restoreTasks`只用第一项发generic event，Hook fallback约500ms后才全map sync。窗口内可暂时显示“-”并绕过`:2260-2264`“正在生成”警告，用户可为仍在恢复的行创建重复任务。预期在关联task状态未知时不得把它当确定idle或据此允许重复提交。

**链、候选、风险与回滚**：IndexedDB tasks → deferred `useTaskStorage` → TaskQueueService map + representative event/fallback sync → Jotai queueTasks → row projection/submit warning。候选是让F-10提供唯一可信ready/full snapshot signal，F-19在ready前显示恢复中并禁用status-dependent submit；F-19自行轮询/直接读DB会制造第二owner，靠固定timeout会掩盖慢存储，均未选。批准共享语义后用cache含taskIds、空内存、多persisted tasks且first非batch的确定性测试，断言不重复create并在ready后正确投影；回滚consumer gate/ready adapter，不删除任务。

#### [F19-CANCELLED-ROW-STATE-004]

**状态**：当前行为已证实，但预期聚合语义未知/阻塞，未修改也未建change。**用户影响/复现**：批量task可从任务面板取消，service终态是`TaskStatus.CANCELLED`；`getRowTasksInfo:1785-1805`只计completed、failed、pending/processing，全部cancelled的relatedTasks最终status仍idle，预览显示“-”，而taskIds继续持久化。用户无法从行区分“从未提交”和“已取消”。任务面板已有“已取消”表达，证明cancelled是有效终态，但F-19没有规定多task行中cancelled+completed/failed、取消后重提和失败行选择如何聚合。

**候选、风险、验证和回滚**：候选A新增cancelled并让completed+cancelled显示partial计数；候选B按“最新提交attempt”分组、旧cancelled只留历史；候选C保持累积历史但在preview列显式分项计数。A最小但可能让成功重提永远partial，B需要attempt/schema或由batchId推导，C增加视觉密度。缺少产品选择前不得实现。决策后用1/多task的cancel-only、complete+cancel、failed+cancel、cancel→resubmit、refresh和任务删除覆盖；当前无改动，无回滚。

#### [F19-SPREADSHEET-A11Y-005]

**状态**：实测缺陷，等待 `improve-batch-image-accessibility` 审批；证据强度高（live DOM属性/accessible snapshot、pointer→Enter/Escape实测和源码事件链）。**用户影响、复现、当前与预期**：1280×720中文窗口中5个`.cell-prompt`全部无role/tab stop，root为tabIndex -1；5个visible toolbar icon button accessible name为空，row/select-all checkbox也没有row/scope名称。点击首个prompt cell后activeElement变为root，Enter能打开“输入提示词...”textarea，Escape后editor count回0，证明shortcut只缺keyboard-only entry。预期一个命名grid/roving active cell使用户可Tab进入、用现有键移动/编辑并在边界退出；icon/checkbox有中英scope名称，nested input/dropdown/dialog/viewer仍优先。

**链、方案、风险和回滚**：table/cell DOM → `selectCell:838-847` → programmatic root focus → document key handler `:2358-2534` → edit/history state。方案以现有activeCell为唯一roving focus owner，并显式命名toolbar/column/row/library actions；给root tabIndex0但无grid/cell语义会把用户送入匿名容器，每cell永久tab stop会随行数爆炸，把复合cell改button会产生nested interactive冲突，均未选。风险是删行/导入后focus漂移、Tab形成trap、nested key双触发和名称泄露prompt/URL/task ID。批准后组件+Chromium覆盖中英、5/大量行、动态删导入、horizontal scroll、light/dark、desktop/tablet/mobile、Enter/Space/Escape/Tab/arrows/copy/paste/undo/redo和pointer parity；回滚ARIA/roving adapter/tests/必要focus style，无数据副作用。

#### [F19-TOOL-WINDOW-RESPONSIVE-006]

**状态**：实测UX/视觉缺陷，由既有 `fix-tool-window-viewport-transition` 所有并等待审批；证据强度高（同一窗口viewport transition DOMRect、截图和无document scroll恢复）。**环境/步骤/原始值**：当前Vite源码、应用内Chromium、DPR1、中文浅色、无network/CPU throttling；1280×720窗口为x40..1240、1200×800，bottom超viewport 80px且document clientHeight=scrollHeight=720。保持窗口切390×844后为x40..440、400×784，right超viewport50px且document clientWidth=scrollWidth=390；截图中close control不可见。内部table有372→506px水平scroll recovery，因此不把列截断单独定为缺陷。

**链、方案、风险、验证与回滚**：manifest 1200×800 → responsive ToolWinBoxManager numeric size → WinBoxWindow 400px min和旧position → title/content geometry。F-19 CSS无法移动外层window，故复用通用change；平板768时400px内容窗是否应扩宽没有规格/对照，只记观察。批准后同一工具测1280×720↔768×1024↔390×844/320×568、冷开/transition/orientation、title controls和pre-transition rect恢复，至少5次event-to-stable geometry；回滚通用opt-in和tests，不改F-19缓存/任务。

#### [F19-RETRY-HISTORY-007]

**状态**：待验证假设，禁止修改。**怀疑依据**：`:2181-2189`把新taskIds追加到旧数组，`:1796-1805`以全部关联task累计状态；旧failed+新completed会继续显示partial，`selectFailedRows`仍会选中。该行为可能是需要保留的累计历史，也可能违反用户“重试失败行后成功”的当前状态意图；没有正式batch spec、attempt字段或UI文案能确定。

**验证/决策/回滚**：先用真实可达失败→选择失败行→成功重提记录taskIds、preview/count、download/export和refresh；再由用户在“累计历史”“最新attempt”“完成优先但保留历史详情”中选择。任何方案会影响恢复/导出/失败选择，须独立OpenSpec；当前无改动，无回滚。

#### [F19-DATAURL-WRITE-PERF-008]

**状态**：待验证性能假设，禁止修改或宣称瓶颈。**怀疑依据**：row upload/drop/batch import会并行`addAsset(File)`并把FileReader Data URL写进TaskRow，`:675-688`又在每次tasks变化whole-value set；大参考图可能同时占asset store、React/history JSON和batch cache。但源码形态不能证明真实storage/heap/interaction超阈值，也没有五次样本。

**测量方法/候选/回滚**：固定PNG/JPEG内容和尺寸，1/5/20张、1/5/20行，分别5次测FileReader、React commit、kvStorage set、close/reopen hydration、IndexedDB usage、heap peak/release和每键写次数；冷/热、desktop/compact分开记录median/range。只有超阈值后才比较asset URL复用、debounce或拆分轻量draft，且必须保留离线/备份/迁移兼容。当前无性能改动，无回滚。

### 28.4 实际改动、验证、性能/视觉、规格和退出判断

**实际改动与根因映射**：本轮没有修改F-19运行时代码、样式、测试或数据。只新增3张当前状态截图、`metrics.json`、`diagnostics.md`、两个独立待审批change，并把batch full/partial rejection纳入现有generation feedback change；账本/矩阵同步当前调用链。浏览器技能的真实几何证据使外层越界复用F-15通用change，避免在batch组件重复实现WinBox策略。

**定向测试**：使用Codex随附Node绝对路径运行8个相邻文件，退出0：8/8 files、52/52 tests通过，5.33s。文件为`useTaskQueue`、`useAutoInsertToCanvas`、generation preferences、image retry、model selection storage、anchor task、prefill和progress。`ai-generation-preferences-service`打印既有`indexedDB is not defined` ConfigWriter stderr，但11项断言全部通过，归类测试环境噪声；image retry仅打印既有restore日志。没有batch component测试，不能把相邻通过冒充F-19完整验证。

**OpenSpec与工具阻塞**：`fix-batch-image-cache-initialization`人工计数1 requirement/4 scenarios，`improve-batch-image-accessibility`为2/5，更新后的generation feedback为2/8；全仓同名requirement只命中各自delta。三条`openspec validate ... --strict`均退出127、`command not found`；未安装工具且不声称strict通过。三个change都等待用户批准，审批前没有红绿实施测试。

**浏览器、性能与视觉**：`docs/evidence/f19-batch-image/`包含desktop 1280×720、mobile 390×844、tablet 768×1024 PNG以及原始几何/DOM计数。未提交provider请求；检查默认/空态、表格pointer→keyboard编辑和三视口，未覆盖真实success/failure/cancel/retry/offline。没有CSS改动，不宣称视觉改善；只有修前截图，批准后才可做同视口修后对照。没有五次性能样本，不宣称更快/更省内存/更小；Data URL/whole-write仅为待验证假设。

**规格、文档、回滚和退出判断**：正式image-generation仍只约束GPT routing，本轮用独立delta补待批准的batch draft/a11y/feedback行为，没有伪装成已实现正式规格。proposal可整目录删除，generation feedback可回滚本轮新增batch段落，证据/账本可独立删除；没有runtime/schema/cache迁移或用户数据副作用。F-19当前为**调查完成、实施与完整验证阻塞，未达到退出标准**：缓存hydration、task create feedback和spreadsheet a11y等待审批；task restore readiness依赖F-10唯一owner；cancelled与retry聚合缺产品语义；provider成功/离线、正式Playwright、component tests、修后视觉和五次性能测量均未闭合。获得任一审批或语义选择后必须先加确定性红测，再做最小改动并重新从入口复审导入、提交、取消/重试、刷新、离线、taskIds、auto insert、download/export、隐私和多视口。

## 29. F-20 爆款音乐生成 / Music Analyzer 功能循环

### 29.1 功能名称、用户场景、范围、规格与验收门禁

**用户场景**：用户从工具箱打开“爆款音乐生成”，选择从零创作或上传本地音频；分析音频或生成/改写歌词；编辑标题、风格标签和歌词；提交 1–4 个 Suno generate/continue/infill 任务；查看进度、失败、取消、重试、历史和生成片段；刷新或重开后恢复记录；把现有歌词或音频结果插入画布。

**范围**：可达工具注册与多窗口壳、Create/Lyrics/Generate/History、分析与歌词模型选择、Music Brief、上传缓存、三条 dedicated CHAT executor、Suno AUDIO adapter/submit/fetch/poll、任务存储/事件/恢复/取消/重试、Music Analyzer record/version/generated clip 投影、50 条保留、历史收藏/删除、自动/手动画布插入、错误/分析事件、桌面/平板/移动与键盘/辅助技术现状。**非范围**：供应商目录和通用协议正确性（F-09）、任务队列通用调度（F-10）、素材库自身合并/筛选（F-13）、外层 WinBox 通用实现（F-15）、音乐播放器/播放列表（F-24）、跨功能视觉门（F-28）。未调用付费 provider，不评价生成质量。

**正式规格与活动 change**：正式 `openspec/specs/audio-generation/spec.md:6-59` 约束统一 music edit action、`clip_id` source of truth 和 action 参数；`add-music-brief-controls` 已 8/8 但未归档；`add-audio-generation-suno-routing`、`add-suno-lyrics-task-and-canvas-flow` 仍在活动区。F-20 新建待审批 `fix-music-analyzer-record-consistency`、`fix-music-analyzer-upload-cache-lifecycle`、`sanitize-suno-provider-error-feedback`、`improve-music-analyzer-accessibility`；取消、部分任务创建、外窗 viewport/title controls 分别复用 `fix-task-queue-external-cancellation`、`improve-generation-dialog-task-creation-feedback`、`fix-tool-window-viewport-transition`、`improve-tool-window-accessibility`，共享 ComboInput 复用 `improve-video-workflow-form-accessibility`。除恢复正式 `clip_id` 行为、测试 mock 和文档/提案外，所有用户可观察、缓存、恢复、并发、安全和可访问性语义都等待审批。

**本轮验收**：重新证明工具可达和正反向链；对 `clip_id` 规格偏离先红后绿；记录相同 key 竞态必须有受控实测；错误、取消、刷新、缓存 owner、部分提交和三视口/a11y 必须各有源码或 DOM/几何证据；不调用真实 provider；窄测、定向 lint、Drawnix/全仓 typecheck、全仓 test/cycles/build/size/startup 与基线逐项比较；视觉只报告当前证据，无修后截图不得称改善；性能无五次前后样本不得称提升。

### 29.2 正向、反向调用链、类型、状态与不变量

1. **入口与壳**：`tools/built-in-manifests.tsx:81-92` 注册 `music-analyzer`、允许多窗口并声明 520×700 → toolbox registry/window service → WinBox → `tools/tools/music-analyzer/index.tsx:6-58` 懒加载 → `MusicAnalyzer.tsx:33-168` 持有当前 page/record 投影 → shared `WorkflowNavBar` 与 Create/Lyrics/Generate/History。
2. **上传分析**：Create file input/drop `CreatePage.tsx:365-374,692-732` → `handleAnalyze:377-430` → `cacheAudioSource()` 把 `File` 写统一缓存并返回 `MusicAnalysisSourceSnapshot` → 创建 `TaskType.CHAT`，params 含 cache URL、mime、source snapshot、model ref 和 music brief → `TaskQueueService.executeTask:609-1189` → `executeMusicAnalyzerAnalyzeTask:1501-1587` 读缓存 blob、转换 inline data、调用 Gemini analysis → `finalizeChatTask` → task map/IndexedDB/RxJS → page subscription 与 `useWorkflowTaskSync` → `syncMusicAnalyzerTask:89-148` → record storage → current page/history。
3. **歌词**：Create/Lyrics 表单 → `collectLyricsDraftModels:176-198` 和保存的 model preference → Suno 模型创建 AUDIO `sunoAction:'lyrics'`，文本模型创建 dedicated CHAT `lyrics-gen`/rewrite → AUDIO 经 `sunoAudioAdapter:293-333`，CHAT 经 `executeMusicAnalyzerRewriteTask:1589-1684` 或 `executeMusicAnalyzerLyricsGenTask:1686-1780` → task result/event → `syncMusicAnalyzerTask:150-247` 生成 lyrics version 并清 pending task ID → Lyrics/Create/History。输入为 prompt、title、tags、MusicBrief、knowledge refs、model/modelRef；输出为 `lyricsText/title/tags` 或结构化 Chat result，record 是用户可编辑投影。
4. **音乐生成与续写**：Generate 校验 action、`continueClipId`、continue/infill 时间和 batchCount → `GeneratePage.tsx:297-347` 顺序创建 1–4 个 `TaskType.AUDIO`，`batchId=ma_<record>_<action>_<index>` 且 `autoInsertToCanvas:true` → queue AUDIO branch `task-queue-service.ts:654-865` → adapter → `audio-api-service.ts:875-1118` submit/fetch/poll → provider transport/network → audio/cover Cache API → completed task durable write/RxJS → `MusicAnalyzer.tsx:64-82` → `syncMusicGenerationTask:293-303` → `audio-task-sync.ts:24-100` → `music-analyzer:records` generatedClips → Generate/history；同时 `useAutoInsertToCanvas` 将音频卡插入 Plait board。
5. **记录、恢复与删除**：React `useWorkflowRecords` 是当前窗口 projection owner；`music-analyzer:records` localForage/IndexedDB value 是 durable owner，`storage.ts:14-80` 通过 shared whole-array helper，最多 50 条并优先保留 starred；task map/RxJS 是运行投影，task IndexedDB 是 task durable owner；unified cache 是上传/生成媒体 owner，board serialization 是插入结果 owner。刷新时 task storage 延后 restore，`useWorkflowTaskSync.ts:57-65` 只在 effect mount 扫一次并消费后续事件；`restoreTasks:2370-2439` 当前只用 map 首项发一个代表事件。record prune/delete `storage.ts:38-54` 当前会 fire-and-forget 删除 source cache。
6. **错误、取消、重试、离线、日志与隐私**：表单校验直接写本页 error/message；task create/execute error 写 `Task.error`，page subscriptions再显示；网络离线沿 provider/task error；task panel `cancelTask:2172-2189` 标记 cancelled 并 abort service controller，retry 复用 retained params；Suno submit/fetch、poll sleep和专用 Chat 是否真正消费 signal 见问题 002。analytics 只记录 action、batch count、prompt length、文件大小和 modelRef presence；Suno LLM log 当前会接收 response/error 摘要，但原始失败 body 的边界见问题 008。不得让 prompt、lyrics、文件名、URL、task ID、credential 或 provider body进入新增可访问名称/保存错误。

**反向追踪与不变量**：Generate/history 中 `generatedClips` 的写入者只有 AUDIO task sync，任务中的 `primaryClipId/clipIds/clips[].clipId` 来自 audio API normalization；正式续写提交的唯一当前入口是 Generate 的 `continueClipId`。record 的 add/update/delete writer 包括 autosave、task sync、favorite/history delete 和多窗口；source cache writer 是 upload Create，现有 cleanup 只有 record prune/delete。completed/failed/cancelled task 的唯一 durable terminal writer 应保持与内存/event一致；live + restore 不得重复投影；取消不得被迟到 completed 覆盖；刷新不得创建 provider 请求；failed/cancelled task 的 source 必须保留到现有 retry owner 删除；用户正在编辑的无关 record 不得被后台同步切换。record/task/cache/board schema、cache URL、50 条规则、provider request 成功路径和已有 analytics 字段保持兼容。

### 29.3 问题证据、方案、风险、验证与回滚

#### [F20-CLIP-ID-SOURCE-001]

**状态**：已证实并修复；证据强度高（正式规格、确定性红绿测试、当前正反向链）。**用户影响与复现**：构造 provider 完成项只有列表行 `id`、没有 `clip_id`，再把 task 投影到 record。修前两项断言分别收到 `provider-row-id` 与 `provider_row_id`，使 Generate 把非 continuation identifier 当可续写 target。正式规格 `audio-generation/spec.md:25-41` 要求使用 polling `clip_id` 并禁止替代 row `id`；预期无真实/记忆 `clip_id` 时音频仍可播放，但续写/Infill按钮禁用。

**调用链、根因与改动**：provider fetch payload → `normalizeAudioTaskResponse` → `extractAudioGenerationResult` → task result → `extractGeneratedClipsFromAudioTask` → record.generatedClips → `GeneratePage.tsx:572-590,618-652`。根因是四处独立 `clip_id || id` fallback，使 provider row identity 穿过本应是 continuation ID 的同名字段。`audio-api-service.ts:476-477,487-535,842-856` 现在只读取或记忆真实 `clip_id`；`audio-task-sync.ts:32-55` 只投影 task 的真实 `clipId/primaryClipId`。新增 `audio-api-service.test.ts:95-124` 和 `audio-task-sync.test.ts:60-84` 回归断言。

**候选、风险、验证与回滚**：选择移除 fallback；备选把 row `id` 与 `clip_id` 混合保留被正式规格否决，丢弃无 ID 音频会破坏播放且无必要。风险是无真实 clip_id 的片段不能续写，但这是规格要求且音频 URL 保留。红测 2 文件/15 项为 13 通过、2 失败、退出 1；修后 15/15、退出 0；F-20 九文件 48/48、退出 0。回滚四处 fallback 移除和两项测试即可，无 task/record/cache migration。

#### [F20-CANCEL-PROPAGATION-002]

**状态**：已证实，等待 `fix-task-queue-external-cancellation` 审批。**用户影响、当前与预期**：在 task panel 取消正在 submit/poll/cache 的 Suno AUDIO，或 analysis/rewrite/lyrics-gen CHAT。当前 `task-queue-service.ts:2172-2189` abort controller并写 cancelled，AUDIO branch只把 signal放到 nested adapter params `:667-707`；`services/model-adapters/default-adapters.ts:304-330` 没有把 signal作为 polling option传给 `audio-api-service.ts:875-1118`，submit/fetch/sleep均不消费；三个专用 Chat executor的 options也无 signal。音频缓存之后 `task-queue-service.ts:834-865` 无第二个 cancellation guard，可写回 completed。预期本地取消稳定、transport/wait能停则停、不能远端取消时丢弃迟到结果，page/history停止pending且保留retry关联。

**根因、方案、替代、风险、验证和回滚**：执行 owner 与 queue controller 没有统一 cancellation contract，且 provider success→cache→commit之间缺终态 guard。批准后把同一 signal传入 adapter/API submit/fetch/abortable sleep和三条 Chat owner，并在每个不可取消 await 后及 completed commit前检查；无法远端 revoke 时只声明停止本地跟踪。仅忽略 UI progress不能阻止网络/cache/record写回，故不选。风险是 retry controller复用、AbortError分类和已成功缓存后的残留；先补 submit/fetch/sleep、Chat late result、cache late completion、cancel→retry、refresh tests，再跑 mocked browser，不调用付费 provider。回滚 signal plumbing/guards/tests，不删除远端任务或缓存。

#### [F20-RECORD-MUTATION-003]

**状态**：实测缺陷，等待 `fix-music-analyzer-record-consistency` 审批。**用户影响与复现**：让两个真实 `updateRecord()` 在都读到 `{title:'Old',starred:false}` 后依次提交 `{title:'New'}` 与 `{starred:true}`。预期 durable `{title:'New',starred:true}`，实际 `{title:'Old',starred:true}`；1 文件/3 项中 2 通过、诊断项失败、退出 1，诊断测试已撤回。多窗口、400 ms autosave、task sync、favorite/delete都可接受同 key mutation，发生频率未知。

**调用链、根因、方案、风险与验证**：writer → `music-analyzer/storage.ts:56-80` → `record-storage.ts:48-106` 各自 load-modify-whole-array-set；没有 per-key accepted-order boundary。批准后在 Music Analyzer key 的 write boundary串行 accepted mutation，reject不毒化后续 queue，并把 prune/delete cleanup纳入同一顺序；跨 tab transaction不在范围。按字段 merge缺少 delete/prune冲突规则，全局 event bus/Repository无证据，均不选。测试 update/update、add/add、task/edit、favorite/delete、reject→success、prune cleanup和两窗口；1/10/50 mutation 各五次必须零丢失并报告 latency median/range。回滚 key queue/feedback/tests，无 schema migration，历史已丢字段无法自动恢复。

#### [F20-TASK-RESTORE-READINESS-004]

**状态**：已证实的静态恢复缺口，等待同一 record-consistency change和全局 readiness owner 审批。**用户影响、当前与预期**：持久任务 map 含多个完成项且第一个与 Music Analyzer无关时，刷新后 `useWorkflowTaskSync.ts:57-65` 先扫空内存；`restoreTasks:2425-2434` 只为全部 map 发首项事件，非首项 Music task没有 domain event，record可缺少已完成歌词/音频。预期 storage ready 后过滤补扫每个相关终态一次，且不切换用户正在编辑的其他 record、不新建任务或 provider请求。

**根因、方案、风险、验证与回滚**：mount-time scan与 deferred restore缺少可消费 readiness/full snapshot，代表事件不能表示集合。批准后只消费 `fix-main-thread-workflow-recovery-sync` 等 change共用的唯一 application readiness owner，复用 task-ID singleflight；Music-specific poller、固定 timeout和逐 task global event都会制造重复 owner或竞态，故不选。测试 unrelated-first map、live/restore overlap、current selection、failed/cancelled、不重复 provider/create；回滚 domain consumer/idempotency tests，不改 task schema。

#### [F20-LYRICS-MODEL-ACTION-005]

**状态**：已证实的静态可执行路由缺口，等待更新后的 `add-suno-lyrics-task-and-canvas-flow` 审批。**用户影响与复现**：`music-analyzer/utils.ts:176-197` 把所有 ID 含 Suno 的 audio model列为歌词模型；选择 `suno-continue` 等 alias后，`utils/suno-model-aliases.ts:40-64` 强制 `sunoAction:'music'`，而 `audio-api-service.ts:221-238` 让 forced action优先于 caller的 lyrics。当前歌词入口可显示并选择 music-only alias，随后走 music submit；预期 selector只提供 text draft model或真实可执行 lyrics binding，失效 preference安全 fallback。未调用真实 provider，结论来自确定性参数/路由链。

**方案、风险、验证与回滚**：在 lyrics selector按 resolved executable action capability过滤，并在 stored selection失效时只重选当前 selector，不删除 provider profile/无关偏好。仅靠 `/suno/i` 标签或让 explicit action覆盖所有 forced alias都会破坏 alias contract，故不选。风险是错误 capability metadata使列表变空；需覆盖 lyrics-capable、music/continue/upload/advanced、stored stale、text fallback和最终 submit path。回滚 selector predicate/preference fallback/tests，不迁移模型数据。

#### [F20-BATCH-CREATION-FEEDBACK-006]

**状态**：已证实的静态部分提交缺口，等待 `improve-generation-dialog-task-creation-feedback` 审批。**用户影响、复现和调用链**：令 `GeneratePage.tsx:300-326` 的第 2 个 `createTask()` 抛错。第 1 个 accepted task继续执行，但 `:328-345` 整批 taskIds/record association/message都不提交，catch `:346-347` 只显示一个失败；迟到 task仍可凭 batchId投影结果。预期保留和关联 accepted tasks，显示 accepted/rejected计数与安全原因，不回滚或重复创建成功项。

**根因、方案、风险、验证与回滚**：顺序 loop把 commit boundary放在全部 create完成之后。批准后逐项收集 typed result，在结束时一次写 accepted IDs并报告部分失败；并行 create会改变队列压力，失败即取消成功项会破坏已接受任务，均不选。覆盖1/4全成功、首项失败、2/4中途失败、record write reject、纠正重提、refresh/cancel/retry与隐私。回滚 result collection/feedback/tests，不删除已创建任务或改并发。

#### [F20-UPLOAD-CACHE-OWNERSHIP-007]

**状态**：已证实的顺序/所有权缺口，等待 `fix-music-analyzer-upload-cache-lifecycle` 审批；没有测量频率或总 quota，故不声称容量瓶颈。**用户影响与复现**：选择 >20 MB 音频后分析，`CreatePage.tsx:399-423` 先调用 `cacheAudioSource`，`audio-source-cache.ts:18-45` 写完整 File，再由 executor `task-queue-service.ts:1518-1530` 读 blob后拒绝。cache成功而 createTask抛错时 catch没有清理；failed/cancelled pre-record task也没有 record owner，而 `storage.ts:38-54` 只有 record prune/delete cleanup。当前会先写已知超限输入且部分 cache无释放边界；预期超限在 cache前拒绝，未产生 task时补偿；accepted failed/cancelled task保留 source供现有 retry，最后 task/record owner删除后才清理。

**方案、替代、风险、验证和回滚**：复用一个 Music analysis 20 MB constant；cache→create作为页面所有权 transaction；task/record共享引用以 last-owner、namespace检查和幂等 delete清理。任务一失败就删会破坏 retry，按年龄全局 sweep可能删活引用，均不选。测试边界值、cache success/create failure、failed/cancelled retry、两种删除顺序、共享引用、missing cache、cleanup reject；固定文件各五次记录写/删时间与 retained bytes后才能宣称性能/容量变化。回滚 preflight/owner cleanup/tests；已明确删除的 cache不能在无原文件时重建。

#### [F20-PROVIDER-ERROR-BOUNDARY-008]

**状态**：已证实的安全/可观测性边界缺口，等待 `sanitize-suno-provider-error-feedback` 审批。**用户影响、复现与证据**：mock Suno submit/fetch 返回任意 HTML/JSON/URL/长文本；`audio-api-service.ts:917-930,977-984` 把完整 body写入 Error.message和 `apiErrorBody`，submit log还接收前500字符；`task-queue-service.ts:1158-1181` 把 message持久化，Create `:541-545,583-591`、Lyrics `:305-310` 和 Generate `:346-347,596` 可渲染。已确认任意 provider body传播；没有真实样本，不声称现有 provider body含 credential。

**根因、方案、风险、验证与回滚**：同一个 Error同时承担 untrusted transport、durable task、UI和diagnostic语义，无安全边界。批准后 normalizer按 stage/status/content-type/body生成分离的 bounded localized user message与privacy-safe diagnostic summary；只 allowlist短已知 code/message并去 markup/control/URL/query/credential pattern，其他 generic fallback。仅截断仍可泄露前缀，完全丢原因会降低纠错，均不选。table tests覆盖HTML、oversize、known JSON、URL/token/bearer/key、invalid text、empty、submit/fetch/logger/task/UI，且 request/status/retry/success不变。回滚 normalizer/callsite/tests；历史 task/log不改写。

#### [F20-RESPONSIVE-009]

**状态**：实测 UX/视觉缺陷，由既有 `fix-tool-window-viewport-transition` 所有并等待审批；证据强度高（同源三视口 DOMRect与截图，每状态1次，非性能样本）。**环境、步骤和原始值**：当前 Vite workspace、Codex in-app Chromium、zh-CN浅色、DPR1、无network/CPU throttling。1280×720窗口 x124..644、y162..862，bottom越界142；768×1024为520×700且完整；同一窗口缩到390×844只266px水平可见，close x488.90625..518.90625；同 viewport关闭重开为x124..524，close x482..512，仍完全不可达。证据在 `docs/evidence/f20-music-analyzer/metrics.json` 和三张 PNG。

**链、方案、风险、验证和回滚**：manifest 520×700 → ToolWinBoxManager responsive size → WinBox 400px minimum/旧position → title controls。F-20 CSS不能修外层window，故复用通用 compact clamp/非持久化 auto-layout/change-owned往返恢复；F-20专用hack会分叉多个工具。批准后测1280↔768↔390/320、open/transition/orientation、close可达、用户移动后不覆盖与扩宽恢复，至少五次 event-to-stable geometry；回滚通用 opt-in/tests，不改Music数据/任务。

#### [F20-CONTENT-A11Y-010]

**状态**：实测可访问性缺陷，等待 `improve-music-analyzer-accessibility` 审批。**用户影响、复现和证据**：live DOM中 `WorkflowNavBar.tsx:36-38,57-87` 的名称是 `←`、`history`、`starred`，scratch/reference状态只有CSS；Create upload `:692-732` 是无role/tabIndex的 div加无label、0×0 hidden input；History rows `HistoryPage.tsx:203-256` 为 pointer-only div；Create/Lyrics/Generate changing feedback `CreatePage.tsx:843-850`、`LyricsPage.tsx:455-497`、`GeneratePage.tsx:596` 无 alert/status/live region。desktop nav controls实测40×32 CSS px；outer WinBox insert/split/min/max/full/close spans均无role/name/tab stop，但由通用 tool-window change所有。

**当前与预期、方案、风险、验证和回滚**：预期现有动作有本地化 name/state、upload/history Enter/Space等价且nested controls不触发parent、error用alert、非紧急进度/成功用polite status并抑制相同消息重复、compact coarse-primary hit area≥44×44。shared WorkflowNavBar用optional caller labels/state；upload和history采用单一 activation handler并过滤interactive descendant；shared ComboInput只消费既有 owner的combobox contract。给所有nested div统一key handler会双触发，复制ComboInput或接管outer WinBox会形成冲突，均不选。风险是Space滚动/双触发、progress噪声、多窗口ID冲突；component/browser覆盖中英、100/200%、light/dark、reduced motion、一/两窗口和所有任务状态。回滚 Music caller props/ARIA/styles/tests，无数据副作用。

**相邻命中复审**：`task-queue-service.ts:762`、`AssetContext.tsx:536-560`、`media-result-handler.ts:215-220,396-400`、TaskQueuePanel和auto-insert中仍有 `clip.clipId || clip.id`，但反向搜索证明当前 continuation/infill request只有 `GeneratePage.tsx:312-316` 从 Music record的 `generatedClips[].clipId` 写入，画布/素材/播放器 `clipId` 没有回到 submit的调用者。因此它们不能证明 F-20 现有续写请求仍使用 row ID，本轮不改；F-24需验证这些元数据是否只用于播放/cache key或是否存在可达后续 action。把静态命中直接认定为 F-20 缺陷会违反证据门槛。

### 29.4 实际改动、验证、性能/视觉、规格、回滚与退出判断

**实际改动与根因映射**：运行时代码只在 `audio-api-service.ts` 和 shared `audio-task-sync.ts` 移除四处 row-id→continuation-id fallback；两文件新增回归测试。`music-analyzer/storage.test.ts:24-30` 的 mock补上真实 interface已有的 `isAvailable:()=>false`，消除本轮测试的未处理异常，不改变产品。新增/更新9个独立OpenSpec边界、`docs/evidence/f20-music-analyzer/`和本账本；三张截图只把实际JPEG编码校正为同名真实PNG，分辨率/内容不变。没有修改样式、provider请求、record/task/cache schema或用户数据。

**验证命令与原始结果**：

- `pnpm vitest run` 的两项 clip 定向文件：修前退出1，2/2 files、15 tests中13通过2失败；修后退出0，15/15通过。F-20九文件窄测退出0，9/9 files、48/48 tests；存在既有 `indexedDB is not defined` logger/config-writer stderr。
- `pnpm nx run drawnix:typecheck` 退出0；修改文件定向 ESLint退出0、0 errors/14个既有 `no-explicit-any` warnings；未机械清理无关warning。
- `pnpm typecheck` 退出0，5/5项目；`pnpm check:cycles` 退出0，无静态 runtime cycle。
- `pnpm test` 退出1：187 files中182通过、4失败、1跳过；1161 tests中1157通过、3失败、1跳过，125.48s。失败是 GPT image Blob mock、Sora duration、Gemini cached image转换和PPT mock missing export；F-20修改/相邻测试通过。与初始170文件基线的总量不同，不能仅靠绝对数归因。
- `pnpm build:web` 退出0：主应用7931 modules、1m57s；SW 54 modules、1.75s。MusicAnalyzer JS 40.44 kB raw/12.21 kB gzip，CSS 10.54/2.20 kB；这是单次产物观察，不是优化前后性能结论。
- `pnpm size` 退出1：AI Chat 844.36/140 kB gzip仍超限；Diagram 934.93/950、Office 269.19/300、Editor 858.24/870、Media Viewer 12.19/20均在限内。F-20无独立预算超限，也没有因本轮提升预算。
- `pnpm verify:startup` 退出0：四个entry budget均通过、chunkCycles空。正式Playwright所需 `chromium_headless_shell` revision 1200缺失，缓存只有1228，既有 `results.json`记录同一路径launch失败；未安装浏览器，smoke/feature/visual/responsive仍为测试环境阻塞。

**OpenSpec验证**：4个F-20新change合计10 requirements/15 scenarios；连同5个更新的相邻change，人工脚本核查共23 requirements/61 scenarios，全部有规范delta operation和四级 Scenario，proposal/design/tasks齐全，相关正式/活动规格无同名 requirement。任务计数为 6/18、5/15、4/14、4/14、5/17、4/13、6/18、6/19、0/22，与冲突矩阵一致。9条 `openspec validate <id> --strict` 均退出127、`command not found`；未安装CLI，不声称strict通过。记录一致性与上传缓存change共享cleanup顺序但不重复所有权；取消与cache ownership分别处理执行终态/输入生命周期；内容a11y、outer WinBox和shared ComboInput边界分开；lyrics selector requirement放回已有lyrics change。

**性能和视觉**：没有运行时代码路径缩短、缓存策略或样式改动，因此不宣称更快、更省内存、更小或更美观。浏览器证据为每状态1个geometry/DOM样本，只证明可达性、越界和语义现状；未做五次前后性能采样。三张当前状态PNG为1280×720、768×1024、390×844；无修后图，故视觉改善为0。未执行真实provider成功/失败、离线、取消/重试和刷新任务恢复；这些分别受凭据、审批或正式浏览器环境阻塞。

**回滚与退出判断**：runtime回滚只需恢复两文件四处fallback并删除两项测试；会重新违反正式 `clip_id` 规格但不需迁移。test mock可独立撤回；四个新proposal可整目录删除，五个既有proposal只撤回F-20追加段落；证据/账本可独立删除。F-20当前为**调查完成、部分修复已验证，其余审批/环境明确阻塞，未达到功能退出标准**：001已闭合；002–010分别等待7个已有/新增审批边界（部分change共同覆盖），正式Playwright缺revision 1200，真实provider/离线无凭据且不应付费调用，性能无五次前后样本，视觉无修后对照。获得审批后必须先补对应红测，再按change逐项最小实施并从入口复审创建/上传、歌词、music/continue/infill、部分提交、取消/重试、刷新恢复、record/cache owner、error privacy、history/canvas和多视口/键盘，不得把多个审批项合并成一次大扫除。

## 30. F-21 Chat-MJ、香蕉提示词与动作场景库外部 iframe 工具循环

### 30.1 功能名称、用户场景、范围、规格与验收门禁

**用户场景**：用户从工具箱打开 Chat-MJ、香蕉提示词或动作场景库，在现有 WinBox 或画布 iframe 中等待外部页面、交互、最小化/恢复/固定/重开/新开窗口，或把画布工具弹出为窗口；配置缺失、网络慢、外部加载失败和页面恢复时应得到安全且真实的反馈，不泄露未授权凭据。

**范围**：三项真实 built-in manifest；ToolboxDrawer/ToolList/ToolItem 的 window/insert；pinned launcher和右键new-window；tool-window service状态、多实例、pin/analytics；URL template替换与settings refresh；ToolWinBoxManager external branch；canvas ToolGenerator iframe/loader/overlay/popout；sandbox与Feature Policy；external network边界；加载、已知错误、slow、retry、close/unmount；模板持久化、日志/analytics隐私和相关测试。**非范围**：外部站点的账号、表单、生成、复制/下载与内容质量；新credential vault/proxy/provider；registry/catalog architecture；F-15已拥有的外层窗口viewport/dialog/focus/title controls；F-28跨功能视觉门。

**正式规格与活动 change**：正式 `toolbox` 和 `toolbox-plugin-runtime` 只规定统一打开/最小化/画布嵌入与manifest-driven iframe；没有 built-in credential destination、全入口preflight、external lifecycle feedback或Feature Policy最小权限契约。`refactor-toolbox-plugin-runtime`为8/9但proposal前提现已部分过时，不能重复架构；初始化/删除changes拥有custom catalog lifecycle，不拥有三个built-in；外窗响应式/a11y继续复用既有changes。F-21新增 `secure-external-tool-credential-launch`（4/18 tasks、2 requirements/5 scenarios）、`improve-external-iframe-load-recovery`（4/17、1/5）与`allow-banana-prompt-clipboard-write`（4/19、1/4）；三者分别拥有凭据/启动、加载/恢复和Banana WinBox write-only Feature Policy，等待审批前不得改runtime。

**验收门禁**：不得读取或发送真实key；不得把fragment送达等同于HTTP server接收或恶意使用；不得把单次3–13秒观察宣称性能瓶颈；clipboard只依据公开bundle hash/control flow和不调用Clipboard API的本地policy probe定性。批准后必须先用sentinel/合成iframe红测，再实施最小行为。成功路径保持manifest identity、窗口/画布能力、sandbox、multi-instance、pin、analytics schema、未解析模板存储；除Banana WinBox明确write-only外，既有allow边界不扩张；拒绝路径不得创建request/state/pin/analytics或删canvas元素；slow反馈不能误报failure；retry只有显式用户动作才增加request。

### 30.2 正向/反向调用链、类型、状态与边界

1. **注册与入口**：`built-in-manifests.tsx:95-145` 注册Chat-MJ 1000×700、Banana 800×600、Pose 900×700和同一5-token sandbox；Chat-MJ URL在fragment含`${apiKey}`。registry → `ToolboxDrawer` → `ToolList.tsx:29-73` → `ToolItem.tsx:114-134,137-193`把card/window/insert事件交回drawer。
2. **drawer gate**：`ToolboxDrawer.tsx:190-217,269-296`只在drawer insert/window检查`needsApiKeyConfiguration()`；missing时pending `{tool,action}`进ref、打开settings，`:79-99`关闭settings后重读key并延迟100ms继续。成功window `:225-263`进service；成功insert `:104-184`计算board center并以原始模板调用`ToolTransforms.insertTool()`。
3. **旁路入口与状态**：`MinimizedToolsBar.tsx:95-115` launcher直接`openTool()`，`:121-138` new-window直接`openNewToolInstance()`；`tool.generator.ts:662-674`先删canvas element再`openTool()`。`tool-window-service.ts:318-441`按URL默认允许multi-instance、处理reuse/new/pin/position/activation、发布RxJS并记window action，但不检查模板变量。
4. **URL与iframe**：`url-template.ts:18-20,53-108`从`geminiSettings`读取key/baseUrl，missing value保留placeholder。WinBox `ToolWinBoxManager.tsx:395-438`只给internal component Suspense fallback；external直接处理URL并渲染iframe。Canvas `tool.generator.ts:255-276,540-589`创建loader、iframe、保护overlay，追加`toolId` query，设置sandbox及`allow=clipboard-read; clipboard-write`并缓存；`:52-76`在settings change重写template iframe URL。
5. **反向sink与owner**：最终WinBox `src`唯一writer为manager external branch，所有source来自service state；最终canvas `src`writer为initial create和settings refresh，source来自serialized `PlaitTool`。service map/RxJS是window session owner，localStorage是pin owner，board/workspace是未解析canvas模板durable owner，外部文档是内容/session owner。Analytics只记录tool ID/name/category/type，未找到URL/key字段。
6. **失败、取消、恢复与并发**：WinBox external没有load/error/timeout/retry state；关闭靠unmount。Canvas只有onload移除loader/onerror改文本，无timeout/retry；多iframe各有DOM closure但没有attempt identity。离线/blocked跨域原因不能通过SOP可靠诊断；本轮只建立honest local lifecycle proposal。custom URL模板保存未解析值，无migration；第三方内容没有Opentu offline cache保证。

### 30.3 证据问题表

#### [F21-CREDENTIAL-BOUNDARY-001]

**状态**：已证实，等待 `secure-external-tool-credential-launch` 审批；证据强度为sentinel确定性执行+正反向源码链。**用户影响与复现**：mock设置为`F21_SENTINEL_KEY_DO_NOT_USE`，从真实manifest取Chat-MJ URL并运行`processToolUrl()`；destination origin为`https://vercel.ddaiai.com`且hash含sentinel，path/search不含。fragment不随HTTP request发送，但该第三方document script可读自身`location.hash`。custom dialog `CustomToolDialog.tsx:194-202`会警告用户自行信任目标，而built-in没有等价披露。未读/未发真实key，也不声称第三方恶意或已有滥用。

**当前/预期、链、根因、方案、风险、验证与回滚**：当前manifest `:95-103` → getters/substitution `url-template.ts:18-20,78-108` → WinBox/canvas iframe，把app provider key交给built-in external origin；预期built-in不接收app credential，同时Chat-MJ credential-free shell仍打开。根因是“仅render时替换”的storage安全规则被当成destination授权。preferred方案去掉built-in fragment，不加vault/proxy/新字段；风险是失去自动配置。无key导航`https://vercel.ddaiai.com/#/`已显示既有shell。批准后断言built-in URL/DOM/log/analytics/storage无sentinel且三项lifecycle不变；回滚manifest/preflight/tests，无migration。

#### [F21-LAUNCH-GATE-002]

**状态**：已证实，等待同一change审批；证据强度为empty-sentinel service test+全部caller静态反查。**用户影响与复现**：empty mocked key时`needsApiKeyConfiguration()`为true、processed URL保留`${apiKey}`，但`openTool()`仍返回status=open实例；launcher/new-window/popup三入口不进drawer gate，popup还在open前删除canvas element。预期单一preflight在state/request/pin/analytics/canvas mutation前拒绝并显示不含URL/key的恢复信息。

**链、根因、方案、风险、验证与回滚**：alternate entry → service state → inline process/render；验证只存在UI-local gate。批准后state creation与canvas render共享pure sensitive preflight，callers负责本地化message；popup只在非undefined success后删除element。给每caller复制check会继续遗漏未来入口，故不选。风险是service rejection静默；用drawer/launcher/context/canvas initial-refresh-popup component测试及no-mutation断言。回滚guard/popup order/tests，模板数据兼容。

#### [F21-WINDOW-LOAD-FEEDBACK-003]

**状态**：实测UX缺陷，等待 `improve-external-iframe-load-recovery` 审批；不是性能benchmark。**环境、步骤、原始值与预期**：2026-07-29当前Vite、应用内Chromium、1280×720、light/zh、正常network/CPU、每状态1次。从唯一entry打开Banana，3s检查已有可用body；Pose在3s为900×652纯白且无Opentu status，追加10s后出现可用body/pose grid，所以只记录load completion落在(3000,13000]ms。2026-07-30又以explicit cached Chromium149、fresh context/tool/viewport、390×844与768×1024、light/zh-CN/DPR1、正常未节流network/CPU各跑1次；Banana/Pose四个3s截图均为白色iframe且无Opentu状态，不能从body text非空外推视觉可用。WinBox external `ToolWinBoxManager.tsx:418-427`无onLoad/onError/timer/status/retry。预期initial visible status、10s honest slow而非failure、known error alert、显式retry和late success。

**根因、方案、风险、验证与回滚**：internal Suspense与external iframe生命周期分叉。批准后每instance local loading/slow/loaded/error + attempt token/timer，overlay在iframe上方；只user retry重算safe URL并增加request。硬timeout failure会误判late success，未选。风险是overlay短暂遮住已绘制页面；测synthetic delayed/success/error、fake timers、多实例/unmount、same request/sandbox，三视口同状态截图。回滚state/timer/style/tests，不改data/cache。

#### [F21-CANVAS-LOAD-LAYER-004]

**状态**：已证实静态UX缺陷，等待同一loading change审批。**用户影响与证明**：`tool.generator.ts:255-276`先append loader再iframe；loader `:520-534` absolute z-index1，white iframe `:558-570` absolute z-index10，故loading及onerror改写文本确定性被覆盖；另有interaction overlay z-index100，无retry。预期反馈位于iframe上方且不破坏selection/interaction overlay。

**方案、风险、验证与回滚**：和window共享lifecycle语义但presentation留在现renderer，明确status/retry/interaction stacking；仅改z-index不能补slow/retry/keyboard/stale attempt。风险是feedback与“点击以交互”overlay争夺pointer；批准后DOM stacking、Tab/Enter、select/drag、late load、remove cleanup测试。回滚局部DOM/style/tests。

#### [F21-IFRAME-PERMISSION-005]

**状态**：已证实，等待`allow-banana-prompt-clipboard-write`审批；证据强度为公开bundle当前hash/control flow、5/5本地跨源policy三组对照和正反向源码链。**用户影响与复现**：Banana manifest `built-in-manifests.tsx:126-134`明确“查看和复制”，WinBox `ToolWinBoxManager.tsx:418-427`无allow。2026-07-30匿名读取`https://www.aiwind.org/`得HTTP200、453805 bytes、HTML SHA-256 `f8ac33b15e2fbdc3b4837be393944149df98cbea70ea98e8d4088ed53faec1d2`、20 scripts；copy bundle `/_next/static/chunks/f03595ad43de9b1b.js` SHA-256 `8a38595cdff445d292a42526bbd4463dd0b63c30d29e85c6e99958453cbf5b73`在secure context调用`navigator.clipboard.writeText`，只有API缺失/非secure才进textarea fallback，write rejection catch只log后退出。未操作外站copy/form、未读写系统clipboard。

**实测、当前/预期、链与根因**：fixed Node+cached Chromium `149.0.7827.55`、两个随机loopback origins、child origin browser permission grant、5个fresh pages；无allow写false/denied 5/5，`allow=clipboard-write`写true/prompt且读false/denied 5/5，canvas-style read/write control两者true/prompt 5/5，top-level两者true/granted；probe标记`clipboardApiCalled=false`、`systemClipboardReadOrWritten=false`。完整链为manifest→registry/card→drawer/launcher→tool-window service/RxJS→WinBox iframe无allow→parent Permissions Policy deny→Banana writeText rejection→catch终止；反向未找到WinBox policy writer，canvas `tool.generator.ts:580-581`是独立广权限writer。根因是ToolDefinition只建模sandbox token，WinBox没有显式Feature Policy投影。

**方案、替代、风险、验证与回滚**：preferred给ToolDefinition增加仅runtime的optional WinBox feature declaration，Banana唯一声明`clipboard-write`，undeclared工具继续无allow；不持久化、不改canvas/sandbox/其他built-in/custom。全局read/write因无证据否决；renderer按ID hardcode会隐藏安全grant；依赖fallback与当前rejection分支矛盾；canvas收窄需独立证据。风险是Banana origin获得写请求能力且browser/OS/user activation仍可拒绝，规格不承诺copy必成。批准后先测manifest/renderer positive+negative、重复5次write-only probe、隔离非敏感copy/lifecycle和canvas不变；回滚type/manifest/renderer/tests，无migration/cache/data恢复。

#### [F21-RESPONSIVE-006]

**状态**：实测结果、覆盖仍不完整；没有新增F-21外窗几何缺陷。explicit cached Chromium149+current Vite、fresh isolated context/tool/viewport、light/zh-CN/DPR1、正常未节流network/CPU，每组合1次。390×844：Banana WinBox `(8,122,374,600)`、Pose `(8,72,374,700)`；768×1024：Banana `(8,212,752,600)`、Pose `(8,162,752,700)`。四项visible area=total area，close均在视口，document scrollWidth=clientWidth；所以本样本不支持F-21-specific outer overflow。四张3s白屏则归003 owner。dark/English/high-DPI/zoom/keyboard/reduced-motion/synthetic slow-error-retry/修后对照未验证；正式Playwright仍缺revision1200，direct revision1228证据不冒充suite通过。

### 30.4 实际改动、验证、性能/视觉、规格、回滚与退出判断

**实际改动**：没有修改运行时代码、样式、测试契约、manifest、sandbox/allow、存储、缓存或用户数据。只新增三个独立待审批OpenSpec change、`docs/evidence/f21-external-iframe-tools/diagnostics.md`、`metrics.json`、三张desktop与四张responsive PNG和本账本/矩阵更新。sentinel测试及clipboard/responsive探针均为临时诊断，记录后已删除并验证不存在；不把当前失败固化成回归期望。

**测试与工具结果**：fixed Node+Vitest sentinel诊断退出0，1/1 files、2/2 tests、3.64s；`tool-window-service.test.ts`退出0，1/1、4/4、3.57s。公开Banana bundle inspection退出0（HTTP200/453805 bytes/20 scripts/4 clipboard pattern hits）；三组cross-origin policy probe退出0（5 fresh pages，未调用Clipboard API）；direct responsive probe退出0（4 isolated samples/2视口）。`nx run drawnix:typecheck`退出0。10个F-21链文件targeted ESLint退出0、0 errors/19 warnings；warnings只作信号。`nx run drawnix:lint`退出1，2119 problems（377 errors、1742 warnings）及4个无关hover findings，归类既有first-party lint baseline，不是F-21新增。Vite服务取证后以Ctrl-C停止，退出128只表示交互终止；Git命令退出128，目录无Git metadata，不能核对worktree/history。

**OpenSpec与冲突**：credential change含2 requirements/5 scenarios、4/18 tasks；loading change含1/5、4/17；clipboard change含1/4、4/19。三者proposal/design/tasks/delta齐全，每requirement至少一条四级Scenario；全正式/活动spec无其他同名requirement，`external-tool-clipboard-permission`为single owner。三次`openspec validate <id> --strict`均退出127、CLI不可用；不声称strict通过。credential与custom catalog changes分别拥有destination/preflight和catalog readiness/delete；loading与F-15分别拥有iframe content lifecycle和outer window geometry/focus；clipboard只拥有Banana WinBox write-only，不接管sandbox/canvas/其他工具。fresh global snapshot为113 active changes、10 complete/91 partial/12 zero、84项含`approval`文本、19个multi-owner capability groups；新change未增加capability overlap。

**性能与视觉**：没有runtime优化，不宣称更快、省内存、更小或更美观；每状态/工具/视口仅1次UX观测。desktop三图外新增`banana-mobile-390x844-before.png`、`pose-mobile-390x844-before.png`、`banana-tablet-768x1024-before.png`、`pose-tablet-768x1024-before.png`，尺寸/bytes/SHA-256见metrics；无修后对照。desktop Banana/Pose iframe为800×552/900×652；responsive宽374/752、高仍552/652；sandbox一致、WinBox allow均null。outer controls由existing a11y/geometry changes所有。

**回滚和退出判断**：三项proposal、证据目录和账本段可独立删除，无runtime/data/cache恢复。F-21当前为**事实建模完成、实施/完整验证明确阻塞，未达到功能退出标准**：001–004等待两项OpenSpec批准；005已证实并等待独立最小权限审批；006已有mobile/tablet当前态但其余矩阵未闭合；synthetic offline/error/retry、正式Playwright、dark/English/100–200%/keyboard/reduced motion、五次性能与修后视觉仍缺。批准后必须先加入safe sentinel与synthetic iframe红测，分别实施并从drawer/launcher/context/canvas initial-refresh-popup重新复审；clipboard change额外验证Banana-only write、其他WinBox无allow与canvas不变，不得与registry、外窗或通用permission大扫除合并。

## 31. F-22 模型测试 / Model Benchmark Workbench 循环

### 31.1 功能名称、用户场景、范围、规格与验收门禁

**用户场景**：用户从工具箱或设置中的供应商/模型快捷入口打开“模型测试”，选择文本/图片/视频/音频、跨供应商/多模型/自定义组合、提示词/知识库上下文/并发，开始并监控多个目标；随后按速度/成本/评价查看预览和错误、收藏/淘汰/导出、停止/删除/复测，并在刷新后恢复独立历史而不污染任务队列或自动插入画布。

**范围**：built-in manifest/lazy tool；toolbox/settings入口和launch handoff；provider profile/runtime discovery/model picker；builder defaults与转换；benchmark session/entry/RxJS/KV；knowledge prompt；text client与三类media adapter；worker并发、timing/cost/status/stop/delete/refresh；preview/error/export/analytics/badge；desktop empty state、内容selection/label/i18n与outer window caller。**非范围**：真实模型质量和未授权付费调用；task queue/media library/canvas insertion（原change明确non-goal）；F-09 provider routing正确性；F-15拥有的outer window primitive；shared TDesign默认、无契约/实测的compact target与global dark theme；新增AI评分、远端benchmark服务或计费系统。

**规格与change**：原 `add-model-benchmark-workbench` 的delta明确四模态、三builder、start/monitor/stop、独立store、cost/timing/preview/manual feedback和settings shortcut。事实审计后把错误的cost/ranking完成声明校正为10/19 tasks：tool shell、routing、manual feedback和pure ranking存在；cost capture、ranking UI、stop与多项verification未完成。新增5个独立审批边界：`ensure-model-benchmark-storage-consistency` 4/15、`control-model-benchmark-run-lifecycle` 5/17、`sanitize-model-benchmark-diagnostics` 4/14、`scope-model-benchmark-launch-handoff` 4/13、`improve-model-benchmark-content-accessibility` 6/24。最后一项只拥有Workbench内容selected-state、label/region与zh/en，不接管前四项或ranking。F-22的auto-max 1280×860 caller追加到已有 `fix-tool-window-viewport-transition`，现7/21、1 requirement/5 scenarios；不建立重复窗口change。

**验收门禁**：不得使用真实key或发起provider/付费请求；cost无兼容价格源时必须明确unknown，禁止写0或伪估算；stop对non-abortable provider必须truthful，不得先宣称远端取消；raw/Error只用credential-shaped sentinel证明boundary，不声称真实泄漏；存储key/schema/12-session retention保持兼容，additive interrupted/cancelled状态须审批；outer geometry与内容responsive分离。批准前只调查/mock/proposal，不改runtime。

### 31.2 正向/反向调用链、数据、状态和边界

1. `built-in-manifests.tsx:106-114`及`tools/tools/model-benchmark/index.tsx:6-54`注册1280×860 internal tool；toolbox调用window service；settings `:2479-2509`调用launcher。launcher `:16-61`把可选request+`launchedAt`写global atom、open auto-max window并记selection metadata。
2. Workbench `:399-680`订阅service RxJS/provider profiles/runtime discovery；本地状态拥有modality/compare/selection/preset/prompt/knowledge/concurrency/ranking和UI locks。launch effect `:844-1052`等待store/discovery、应用fallback、可选autoRun；manual `:1054-1078`用component-local lock创建并运行session。
3. service singleton `:487-547`构造时`void load()`并在每次mutation后`void kvStorageService.set()`完整state；`:603-641`同步创建draft session/pending entries并发布/持久化/analytics。
4. `runSession :774-893`解析preset/knowledge prompt、reset entries、以shared cursor和1..concurrency workers执行；`:241-484`把text送`defaultGeminiClient.sendChat`，media经`resolveAdapterForInvocation`和settings context送adapter；`:895-1026`写timing/preview/error和最终session terminal。
5. RxJS返回Workbench history/result，`:659-667`按stored ranking mode排序；`:1081-1365`导出；`:1489-1555`展示raw JSON；`:2160-2180`展示cost/error；feedback写service；Badge只在parent render时同步summary。
6. 反向sink：KV只有`persist()`写；provider request只有4个executor写；cost所有consumer回溯到唯一null initializer；ranking回溯到session create/default，service setter无UI caller；stop/cancel无writer；raw/error回溯到provider response/Error.message；settings prefill回溯到无ack global atom；refresh running回溯到load原样trim/sanitize。
7. types/defaults：`CreateBenchmarkSessionInput`→`ModelBenchmarkSession`→`ModelBenchmarkEntry`；默认text/cross-provider/text-fast-json/concurrency2/speed；UI clamp concurrency；max12 sessions按updatedAt；key `aitu:model-benchmark:sessions`；无Cache API/task store/canvas owner。offline/remote timeout/abort目前不属于service state。

### 31.3 证据问题表

#### [F22-COST-001]

**状态**：已证实，原change等待审批。**用户影响/复现/证据**：所有四模态结果、UI、Excel和value ranking承诺cost，但`createEntryFromTarget :241-262`唯一写`estimatedCost:null`，全仓无后续assignment；mock成功run仍为null。**当前/预期、链、根因**：target→null entry→completion未写cost→KV/RxJS→`:1128,1208-1209,2160-2162`和pure ranking。字段/consumer已建但无price/unit/quantity owner；预期有兼容price source才估算，否则显式unknown且不作0。**方案/替代/风险/验证/回滚**：完成原change的unit-safe estimator和UI/export声明；不选隐藏cost或null=0。测试四模态price present/absent、currency/unit、no-extra-request；回滚estimator/control/tests，null兼容。

#### [F22-RANKING-002]

**状态**：已证实，原change等待审批。**用户影响/证据**：service `setRankingMode :676-705`和pure四模式存在，但无production caller；Workbench `setRankingMode`仅`:647-652`复制active session。1280×720 DOM有四模态/三compare，无ranking control。**预期/方案/风险**：结果区提供可达control并调用既有service；unknown cost deterministic。保持focus/stable IDs，测keyboard/session reopen/null-cost/export；回滚UI/caller/tests，无migration。

#### [F22-LIFECYCLE-003]

**状态**：已证实，等待 `control-model-benchmark-run-lifecycle`。**用户影响/复现**：无stop；同session两个`runSession`在deferred mock产生2个provider calls；running时`removeSession`立即清空state但mock call继续；persisted running session/entry load后仍running且不resume。**调用链/根因**：manual/shortcut→独立run stack→workers/provider；durable status没有runtime owner/cancel identity。**方案/替代/风险/验证/回滚**：per-session singleflight、pending cancel、existing abort support、non-abortable stopping、active delete guard、refresh interrupted/no-auto-resume；不选只disable button或false cancelled。测四模态/late settle/partial/delete/refresh/rerun；rollback先tolerant map additive state再移除owner/UI/tests。

#### [F22-STORAGE-004]

**状态**：已证实，等待 `ensure-model-benchmark-storage-consistency`。**复现/证据**：hold constructor get→create session→resolve older empty，accepted session消失；ready后hold两次set并2→1反向resolve，memory2而durable1。**根因/链**：constructor load与所有mutation是同key独立whole-state replacer，RxJS publish先于unobserved durability。**方案/风险/验证/回滚**：one readiness result+accepted-write chain+safe sequence failure feedback；不改key/schema/retention，不引入per-session DB/journal。测read failure/all pre-ready callers/reject recovery/1-10-50×5 zero loss；rollback boundary/UI/tests，无migration。

#### [F22-DIAGNOSTICS-005]

**状态**：已证实boundary缺失，等待 `sanitize-model-benchmark-diagnostics`；不声称真实secret。**复现/证据**：success sentinel raw response进入entry及last KV snapshot；Error sentinel进入errorSummary/KV/analytics。源码`:129-179`只bound text/URL而原样copy raw，`:241-478`写raw，`:982-1024`复制Error.message；Workbench raw details/Excel/user error消费。**方案/风险/验证/回滚**：bounded modality DTO、safe allowlist/redaction/generic error、analytics safe category、legacy raw read-ignore/next ordinary write omit；不background delete。风险是debug detail减少；table测recursive/oversized/HTML/URL/bearer/control与4 success；rollback normalizer/read filter/tests，已omit数据不可恢复。

#### [F22-HANDOFF-006]

**状态**：persistent request已证实，settings real-click环境阻塞；等待 `scope-model-benchmark-launch-handoff`。**证据/链**：launcher atom写后无clear/ack；重复read同一non-null request；Workbench只用remount会重置的local signature。internal manifest默认reuse。settings两个provider group均0 models，shortcut不render；未增model/key。**方案/风险/验证/回滚**：request identity+apply/terminal后的identity-checked ack；loading discovery保留，older ack不得删new request；保持no-autoRun。测sequential/remount/StrictMode/discovery/generic open/failure；rollback identity/ack/effect/tests，无storage。

#### [F22-WINDOW-GEOMETRY-007]

**状态**：实测，追加到已有 `fix-tool-window-viewport-transition`。**环境/原始值**：in-app Chromium，1280×720/DPR1/light/zh/normal network+CPU。auto-max WinBox 1280×860、root y48..860；body/document 720；main client/scroll812、history650，底部140无page/internal recovery。**根因/方案**：manifest/fallback 860+autoMax path未fit current viewport；existing change新增独立tool-max branch，保持max state、content identity和generation/non-tool边界。修后同data/theme测1280×720/768×1024/390×844和restore；rollback共享window branch/tests，无data。

#### [F22-BADGE-008]

**状态**：待验证假设，不改代码。Badge只同步`getModelBenchmarkSummary`且parent无benchmark subscription；mutation本身不schedule parent render。但dropdown reopen可能已满足intent，未建立visible stale。后续用synthetic session在保持selector open时外部emit favorite/reject，再决定是否订阅；验证前不实施。

#### [F22-RESPONSIVE-009]

**状态**：未知/环境阻塞。in-app Browser固定1280×720；正式Playwright缺`chromium_headless_shell` revision1200。缺390×844/768×1024、dark/English、zoom/high-DPI、large history/results、keyboard/live stop/slow/offline证据。恢复viewport-capable surface后以synthetic data重跑；不把测试阻塞报产品缺陷。

#### [F22-CONTENT-STATE-A11Y-010]

**状态**：已证实，等待 `improve-model-benchmark-content-accessibility` 审批。**用户影响/复现/证据**：当前四模态、三comparison、五history filter与后续active session/score/favorite/reject都有视觉状态，但辅助技术无法读出current selection。生产1280×720单样本中，所有selector的`aria-pressed/selected/current`均为null；点击图片后class变`active`、focus为图片、prompt切到当前图片preset，程序化状态仍null，随后已恢复文本。结果feedback的反向源码链只按active class渲染。证据强度为真实state transition+DOM+静态反查。

**调用链/根因/方案/风险/验证/回滚**：Workbench local modality/compare/filter或service active/feedback state→`ModelBenchmarkWorkbench.tsx:1603-1756,2184-2247` conditional class→visible UI；状态owner存在但输出止于CSS。候选用一致radio/tab/pressed contract，保留native button Enter/Space和当前callback；风险是双tab stop、arrow预期或重复调用。用pointer/Tab/Enter/Space/选定arrow模式精确计数和焦点验证；回滚只移除state/group semantics/tests，无数据变化。

#### [F22-FORM-A11Y-011]

**状态**：已证实，等待同一content change审批。**用户影响/复现/证据**：生产DOM中history search、model input、provider input和prompt textarea均`labels=0`、无`aria-label/labelledby`，名称只来自placeholder；可见`对比模型:`/`参测供应商:`是独立generic节点且不进入textbox name。prompt一旦输入后placeholder消失，没有persistent label。`最大并发`已有显式name，是非问题。当前vs预期为visual adjacency/placeholder fallback对比stable localized labels/regions。

**调用链/根因/方案/风险/验证/回滚**：builder/local state→`ModelBenchmarkWorkbench.tsx:1603-2058` TDesign/native controls→accessibility tree；sibling visible text与input无ID关系。组件scoped wrapper label与history/builder/result headings是最小方案；全局改TDesign无caller证据，未选。验证empty/synthetic、编辑后、长数据、callback bytes及names无prompt/credential/error；风险是generated ID漂移或raw data进入name。回滚relationship/headings/tests，无storage/network副作用。

#### [F22-CONTENT-I18N-012]

**状态**：已证实静态语言owner缺陷，等待同一content change审批。**用户影响/证明**：现有`I18nProvider`在`i18n.tsx:589-631`拥有zh/en，outer `ToolWinBoxManager.tsx:24,38`已消费；Workbench完全不import/use `useI18n`，`:53-109,399-479,1081-1365,1489-1555,1603-2265`直接写application copy，因此language state没有到content的输入边，English下内容确定性仍中文。预期只翻译application-authored framing，不改provider/model/session/prompt/result/error/export数据。

**方案/风险/验证/回滚**：增加typed F-22 keys和empty/synthetic初始/live zh/en测试；浏览器locale推断或翻译raw数据会绕过owner/改数据，未选。风险为部分翻译、export列或callback漂移；用non-secret sentinel逐字节断言。回滚keys/consumer/tests，无迁移。

**内容界面非问题与未知**：native content buttons已有Enter/Space；aside/main、empty result h3、session delete、knowledge context和concurrency名称存在。stop/live、storage loading/error、diagnostic body、ranking、handoff、outer WinBox各留在既有owner。desktop高度28–40px且SCSS compact rules不改32/34px selectors，但仓库没有F-22正式touch阈值且无compact runtime样本，触控尺寸仍未知；stylesheet硬编码light surface也不能在未确认global dark owner时直接判缺陷。

### 31.4 实际改动、验证、性能/视觉、规格、回滚与退出判断

**实际改动**：没有修改runtime、样式、permanent tests、provider request、KV、cache或用户数据。校正原change的错误完成声明；新增5个待审批change；更新existing tool-window change的auto-max tool场景；新增/更新 `docs/evidence/f22-model-benchmark/diagnostics.md`、valid `metrics.json`、真实1280×720 PNG和本账本。8项临时service diagnostic通过后用patch删除，absence exit0；2026-07-30内容界面复查只操作本地选择状态并恢复，不创建永久test。

**测试/工具**：隔离mock/sentinel诊断exit0，1/1 files、8/8 tests、2.10s；permanent pure test初次exit0、1/1、6/6、1.31s，2026-07-30内容文档复查再次exit0、1/1、6/6、1.12s；Drawnix typecheck exit0、33s。7链文件targeted ESLint exit1：25 problems=3个existing Workbench errors+22 warnings；无runtime edit，未新增lint regression。full Drawnix lint不重复跑，F-21已记录377 errors/1742 warnings基线。正式Playwright仍缺revision1200。Git metadata absent，无法核对worktree/history。

**OpenSpec**：F-22原change3 requirements/4 scenarios、10/19；前4项behavior change合计4 requirements/13 scenarios，tasks 4/15、5/17、4/14、4/13；新增content change为3/9、6/24；updated window change1/5、7/21。11个相关requirement名称各唯一且每requirement至少1 Scenario；proposal/design/tasks/delta完整。原+5新change strict命令各exit127；window change更新后同样exit127，CLI不可用，不声称strict通过；人工format/name/conflict audit完成，content capability只有一个active owner。

**性能/视觉**：无优化不宣称更快/小/美。current warm open 5次 `[362,346,430,363,350]`ms，median362、range346–430；测量从Browser card click到root visible，含driver overhead、非cold、无before/after。截图 `workbench-empty-desktop-1280x720.png`证明empty builder/result、4模态/3compare、start(0) disabled、无ranking/stop和visible crop；无修后图。2026-07-30内容复查为同构建1280×720/DPR1单样本，记录12个selection control、5个输入关系和desktop控件几何；不构成compact/theme或after视觉证据。

**回滚/退出**：删除5个新change目录、撤回原/window change的F-22追加、删除evidence/账本即可；无runtime/data/cache恢复。F-22为**事实建模完成、实施/完整验证明确阻塞，未达到退出标准**：001–007及010–012等待7个F-22/相邻OpenSpec审批；008需visible stale验证；009及compact/theme需浏览器/契约证据。批准后先补red tests，再按storage→safe diagnostics→lifecycle/cost/ranking→handoff→content→window顺序最小实施；用mock/synthetic完成error/cancel/refresh/offline/large history/多视口/keyboard/zh-en，并在获得明确授权前不调用真实provider。

## 32. F-24 音乐播放器、全局/画布音频播放、播放列表与朗读队列循环

### 32.1 功能名称、用户场景、范围、规格与验收门禁

**用户场景**：用户从画布音频节点、素材库、音乐播放器、知识库笔记或画布文本/Card发起音频/朗读；查看当前项、队列、进度、字幕和错误，切歌、暂停/继续/停止、调速/模式/音量，最小化后通过全局浮层继续并恢复工具；创建/重命名/删除播放列表，收藏或增删音频/朗读引用，并在刷新与环境备份恢复后取得一致数据。

**范围与非范围**：范围为canvas/audio/media/KB/popup/tool入口、shared playback service和HTMLAudio/Web Speech/cache边界、外部store投影、global overlay/music-player、playlist Context及两个localForage store、player localStorage/settings、backup/restore、错误/取消/重试/刷新/离线现状、桌面可达性与几何。provider生成/质量和任务执行归F-08/F-10/F-20；asset committed delete cleanup归`ensure-media-library-write-consistency`；outer WinBox geometry/dialog/focus/title controls归两个F-15 changes；不新增播放列表产品能力、跨tab distributed lock、cloud sync或provider cancel保证。

**正式规格与活动change**：`canvas-audio-playback`覆盖shared speed/modes、persistent playlists/favorites、canvas/playlist queues、in-place node、global overlay和close/stop；`backup-restore`包含playlist。`refactor-toolbox-plugin-runtime`当前8/9，registry/player/minimize均存在，剩3.3关键测试未完成且`CanvasAudioPlayer.test.tsx`仍仅1个skip。新增3个独立审批边界：`control-audio-playback-request-lifecycle` 5/14、1 requirement/3 scenarios；`ensure-audio-playlist-write-consistency` 6/19、2/6；`improve-music-player-control-accessibility` 4/13、1/3。三项strict validate均exit127，CLI不可用；proposal/design/tasks/delta、ADDED operation、四级Scenario和四个唯一requirement名称已人工校验。

**门禁/验收**：批准前不改runtime、store、permanent tests或a11y行为；不读真实key、不发provider/付费请求、不改真实playlist/note。播放修复必须latest intent且stop/reading不虚构物理abort；playlist失败必须durable与feedback一致，journal先恢复再rollback；accessibility只命名现有动作，不接管outer shell。无前后实测不得宣称性能/视觉改善。

### 32.2 正向/反向调用链、数据、状态和边界

1. Canvas节点`AudioNodeContent.tsx:458-488`/generic click `drawnix.tsx:1499-1522`、media context `MediaLibraryGrid.tsx:504-547`、KB `KBNoteEditor.tsx:210-238`、canvas text/card `popup-toolbar.tsx:1240-1281`、selected audio `:2277-2319`和tool list `MusicPlayerTool.tsx:355-364,545-603`构造audio/reading source及queue。
2. `tool-launch-service.ts:42-72`打开/reuse player并写canvas/playlist/reading queue；direct canvas路径经`useCanvasAudioPlayback.ts:23-83`调用singleton。service normalize/dedupe，唯一拥有mediaType/active metadata/index/queue/mode/rates/volume/timing/error/analysis；hook `:13-21,86-97`把snapshot同步到全部UI。
3. Audio `startPlayback :869-930`在写owner前await `cacheRemoteUrl :932-965`，然后赋single HTMLAudioElement和shared state并await play；固定listeners `:494-599`写playing/time/duration/error。Reading `reading-playback-source.ts:43-181`构造plain text/language/segments，service `:795-1100`以readingVersion/Web Speech/250ms estimated progress管理pause/resume/cancel。
4. Drawnix board变化写canvas queue、unmount stop/clear `:1124-1134`；`CanvasAudioPlayer.tsx:333-558`和`MusicPlayerTool.tsx:660-887`消费同state，Drawnix `:1049-1116`把新error交MessagePlugin。mode/audio rate/layout/position进入localStorage，reading rate进入tts settings；active queue/session仅内存，refresh不resume。
5. Playlist UI→`AudioPlaylistContext.tsx:30-147`→`audio-playlist-service.ts:21-269`→`aitu-audio-playlists`的`audio_playlists`/`audio_playlist_items`。create/delete/add/remove都是两个store分步写，membership为whole-array replace；Context mutation后重新并行读取两投影。backup export `environment-backup-service.ts:168-207`、replace clear `:391-420`、restore `:524-551`。
6. 反向sink：active audio只有startPlayback写，reading只有beginReadingSegment写，clear只有stopAndClear；remote cache只有resolvePlaybackAudioUrl；playlist durable records只有service mutations和backup restore；UI playlist snapshot只有Context load写。错误来自play/media/Web Speech并仅进memory/UI，本功能未持久化error。retry为再次激活；offline remote成功依赖cache/original URL，未实测；multi-tab playlist/preference live sync未知。

### 32.3 证据问题表

#### [F24-PLAY-001]

**状态**：已证实，等待`control-audio-playback-request-lifecycle`；证据强度为源码happens-before+deferred cache。**用户影响/复现**：A remote cache pending→点击B→B先完成→A后完成；A覆盖并播放，预期最新B保持owner。**根因/链**：entry→toggle→startPlayback在`:875` await后才`:882-919`写source/state，无intent。**方案/替代/风险/验证/回滚**：pre-await monotonic identity并在每个async shared mutation前check；重排cache或memo不能建立ownership。obsolete cache可能继续耗资源，不宣称cancel/加速。双顺序、queue、error测试；回滚counter/tests，无data。

#### [F24-PLAY-002]

**状态**：已证实，同change；deferred two-play mock。**影响/复现**：A的play promise pending，B完成后reject A sentinel，B仍名义active却被置`playing=false/error=A`。**根因**：`:921-929`任意catch写current shared state。**方案**：stale settlement不改state/不发global error，current owner保留现反馈；不更换single audio element。测stale/current reject、events、pause/analysis；code/test回滚。

#### [F24-PLAY-003]

**状态**：已证实，同change；deferred cache+teardown chain。**影响/复现**：pending A期间stopAndClear，resolve后A重新激活；close或Drawnix unmount不能可靠保持clear。**根因**：`:1487-1514`只reset，不失效pending stack。**方案**：stop/clear/reading activation advance intent；底层cache无abort时只忽略settlement。测close/unmount/reading switch/late settle；无migration。

#### [F24-PLAYLIST-001]

**状态**：已证实，等待`ensure-audio-playlist-write-consistency`；concurrent localForage mock。**影响/复现**：同playlist两项distinct add并发，最终只1/2。**根因**：`:187-205`各自读旧whole array并replace。**方案**：service accepted-order mutation owner，所有read/check在owner内；仅UI disable会漏其他caller。风险burst latency，五次量测；journal drain后rollback。

#### [F24-PLAYLIST-002]

**状态**：已证实，同change。**影响/复现**：两个同名create并发均在write前通过`:111-114`，落两条同名记录。**方案**：全service queue内重查create/rename uniqueness；DB index/migration超出single-runtime证据。测same/different name；跨tab仍unknown。

#### [F24-PLAYLIST-003]

**状态**：已证实，同change；4项second-store failure injection。**影响/复现**：create items写失败留meta；delete items remove失败留orphan；add/remove meta时间戳写失败但membership已变，API/UI均报failure。**根因**：两个localForage store无transaction/recovery owner；调换顺序只移动partial window。**方案**：保留旧schema，private prepared/committed journal，commit后才success，init对prepared回before、committed回after，backup不export且replace clear。风险snapshot write volume/recovery correctness；逐phase/rollback failure/idempotence/large list验证；rollback前drain journal。

#### [F24-PLAYLIST-004]

**状态**：已证实，同change；jsdom reverse completion 1/1。**影响/复现**：reload A后B，B newer先显示，A older后完成又覆盖。**根因**：Context`:30-43`对所有completion无条件set两个collection。**方案**：latest load identity；不引入event bus/state library。测overlap success/failure/unmount/message；移除owner/tests即可回滚。

#### [F24-A11Y-001]

**状态**：已证实，等待`improve-music-player-control-accessibility`；source+live Chromium tree。**影响/复现**：本地朗读后minimize，global overlay的prev/play-next/layout/close为5个empty button，DOM aria/title/text均空；screen reader不能识别。MusicPlayer tool对应按钮已有names。**根因**：`CanvasAudioPlayer.tsx:400-429,511-538`只依赖visual HoverTip。**方案**：localized/state-aware explicit names，不含title/note/url/provider/error/credential，不改icon/geometry/callback；outer WinBox留existing change。测tree/Tab/Enter/Space/state/privacy/same-state截图；labels/tests回滚。

#### [F24-HYPOTHESES-002]

**状态**：待验证假设，不改代码。Remote cache-before-play会等待但无真实asset hit/miss 5次数据；`crossOrigin=anonymous`+original URL fallback没有provider/CORS failure；play `Error.message`虽可进UI但未观察真实敏感内容且不持久化。分别用local delayed fixture/授权asset五次、synthetic CORS、credential-shaped error boundary验证，之前不做loading/cache/origin/sanitization修改。

#### [F24-RESPONSIVE-003]

**状态**：未知/环境阻塞。Browser固定1280×720，formal Playwright缺`chromium_headless_shell`revision1200；缺768×1024/390×844、dark/English/zoom/high-DPI/touch/offline/reduced-motion证据，不报产品缺陷。outer WinBox unnamed spans已经由`improve-tool-window-accessibility`确认并拥有。

### 32.4 实际改动、验证、性能/视觉、规格、回滚与退出判断

**实际改动**：没有修改runtime、样式、permanent tests、playlist/note/store/cache/task/board或用户数据；没有provider请求。只新增3个待审批OpenSpec changes、`docs/evidence/f24-music-player/diagnostics.md`、valid `metrics.json`、2张desktop PNG及本账本/矩阵。临时3文件10项diagnostics全部通过后用patch删除，absence exit0。浏览器仅调用一次local SpeechSynthesis；speed/mode临时1→1.25→1和sequential→list-loop→sequential已恢复。

**测试/工具**：隔离playback+playlist 2 files/9 tests exit0、2.01s；Context 1/1 exit0、5.03s。永久默认node环境exit1：3 files=1 fail/1 pass/1 skip，21 pass/2 fail/1 skip；2失败均因`localStorage is not defined`，归测试环境。加jsdom后exit0，20 pass/1 skip、2.67s，但missing indexedDB产生ConfigWriter stderr噪声；playlist 3/3通过。Drawnix等价tsc exit0、约36s。13链文件targeted ESLint exit1，22 problems=1个existing module-boundary error+21 warnings；无runtime edit。最初pnpm诊断因child找不到node exit127，改Codex bundled Node后成功。OpenSpec三次exit127，CLI阻塞。

**性能/视觉**：无runtime优化，不宣称更快/小/美。warm existing-window restore 5次`[408,552,582,539,514]`ms，median539、range408–582；1280×720/DPR1/light/zh/normal network+CPU，从overlay open-tool click到WinBox离开min class，含Browser driver/poll/render overhead，非cold/无before-after。empty player WinBox 520×640完全在viewport；overlay 760×50，controls 28×28、primary32×32，仅记录desktop raw geometry不判touch缺陷。截图`empty-desktop-1280x720.png`和`paused-reading-overlay-desktop-1280x720.png`为current before evidence，无修后图；背景已有执行失败卡不属于F-24结论。

**正向样本**：全部语音显示10篇named note rows；本地朗读形成20 segments和queue1/10；minimize后overlay保留title/progress/volume/rate/mode，restore保留shared state；overlay改1.25x/list-loop后tool同步，随后恢复。playlist asset为0，未创建/修改/删除真实playlist或note。

**回滚/退出**：删除3个新change目录、F-24 evidence和账本/矩阵即可；无runtime/data/cache/provider恢复。F-24为**事实建模完成、实施/完整验证明确阻塞，未达到退出标准**：PLAY-001—003、PLAYLIST-001—004和A11Y-001等待3项审批；outer shell等待既有F-15审批；performance/CORS/error假设和responsive/full E2E仍需环境/证据。批准后先补red tests，按playback ownership→playlist journal/Context→overlay names分别最小实施并从全部入口复审，不跨功能清理。

## 33. F-25 Frame/PPT 创建、编辑、重排、播放与导出循环

### 33.1 用户场景、范围、规格与验收门禁

**用户场景**：用户用快捷键/指针或添加弹窗创建PPT页，或由`generate_ppt`/思维导图取得outline-first占位页；在项目抽屉按deck order搜索、选择、重命名、复制、插页、删除、拖拽和排列，编辑公共/单页prompt并串行或最多5并行生图，切换历史/素材图片；随后全屏播放、标注、切页/转场并导出完整PPTX，刷新后从board恢复。

**范围与非范围**：范围为Frame创建与`pptMeta`、FramePanel slide/outline、task提交/自动回填边界、FrameSlideshow viewport/fullscreen/工具、完整PPTX exporter/transition/media fallback、board save、测试/渲染/a11y/i18n/响应式证据。provider质量/付费执行归F-08/F-09/F-10；generic canvas编辑归F-05/F-06；project/backup/GitHub归F-02/F-03；comic独立导出归F-16；outer drawer/window归F-15/F-28；不新增PDF等产品能力。

**规格/change**：正式`ppt-editing`要求image-first、deck order panel、regeneration和slideshow/PPTX transitions；`ppt-outline-generation`要求outline-first、串行previous-success reference及并行最多5。archive `refactor-ppt-image-first-editing/tasks.md:1.10`明确完整PPT按Frame顺序导出。新建3个独立审批边界：`report-ppt-export-content-loss` 4/14、1 requirement/3 scenarios；`improve-ppt-editor-accessibility` 4/14、2/5；`localize-ppt-editor-workflow` 3/14、2/4。strict各exit127，CLI不可用；proposal/design/tasks/delta、ADDED、四级Scenario和5个唯一requirement人工校验。

**验收门禁**：现有deck-order规格恢复可直接修；导出结果/辅助技术/可见语言变化审批前不实施。不读真实key、不发provider/付费请求。页序修复必须保持bound elements/custom names/generic Frame/Undo/save兼容；性能/视觉无前后数据不宣称改善；PPTX必须用Presentation render/overflow并逐页检查。

### 33.2 正向/反向调用链与数据边界

1. `with-hotkey.ts:390-394`→`with-frame.ts:844-959`或`AddFrameDialog.tsx:145-229`→`FrameTransforms.insertFrame`；`FramePanel.handleFrameAdded :2210-2247`补pageIndex/style/common+slide prompt/placeholder。MCP `ppt-generation.ts`创建outline Frame并打开outline mode，不自动提交图片。
2. `drawnix.tsx:456-490,817-844`打开/自动切PPT editor，`ProjectDrawer.tsx:1633-1667,1763-1790`挂FramePanel。FrameInfo递归收集board；root优先形成`orderedPPTFrames :1287-1384`。rename/duplicate/insert/delete/layout及search/selection在同一panel编排。
3. drag→`useDragSort`→`FramePanel.reorderFrames :1823-1852`→`FrameTransforms.reorderPPTFrames :580-597`，同步root node order及完整PPT deck的pageIndex/default name；board operation→`drawnix :1588-1600`→App→WorkspaceService→workspace storage queue→localForage/IndexedDB。
4. outline `FramePanel :3087-3138`→`createImageTask`→task queue/media executor/provider；serial await previous successful image，parallel最多5且无reference；`useAutoInsertToCanvas`按`pptSlideImage/targetFrameId/pptReplaceElementId`插入/替换并写current/history meta。失败/取消保留旧图。
5. slideshow按board traversal order `FrameSlideshow :89-97`；进入保存viewport/pointer、fit/request fullscreen，keyboard/pointer/tool/transition更新current；退出/fullscreen loss恢复viewport/pointer。session状态不持久化。
6. export `FramePanel :3494-3547`→`exportAllPPTFrames :1900-1907`→sort `:1305-1328`→partition→`addFrameSlide :1461-1849`→pptxgenjs→可选JSZip transition→download；promise resolve/reject决定analytics/message。反向sink只有export service写下载；它不改board/task/cache。

### 33.3 证据问题表

#### [F25-ORDER-001]

**状态**：已证实并修复；高强度spec/archive task+红绿测试+当前链。**用户影响/复现**：3页1/2/3，拖3到1前；修前board/slideshow新序而outline/export仍按旧pageIndex，红测received `[3,1,2]` expected `[1,2,3]`。**根因**：drag只写root node，outline/export优先另一持久order representation。**修复/替代/风险**：统一transform同步两者；保持bound image/custom title，generic collection不增pptMeta。只改export会漏outline；移除pageIndex是更大schema/架构变化。新增`withHistory`一次Undo测试反证额外history疑虑，无需batch抽象。**验证/回滚**：最终3/3；11文件10 pass、84/84 executed，唯一settings mock收集失败；回滚transform/caller/test，无migration但缺陷返回。

#### [F25-EXPORT-001]

**状态**：已证实，等待`report-ppt-export-content-loss`。**影响/复现**：image-first primary URL 404；diagnostic确认addImage 0、writeFile 1、public promise resolve，UI仍报原页数成功。**链/根因**：`:1516-1519` image catch和`:1843-1845` element catch吞错，slide永远true，void public contract不能表达content fidelity。**方案/风险/验证/回滚**：required image失败阻断write/download；legacy omission结构化partial warning，反馈不含URL/prompt/provider/key/task id。风险是transient remote严格失败，测cache/data/retry/board unchanged/render；回滚result/caller，无data。

#### [F25-A11Y-001]

**状态**：已证实，等待`improve-ppt-editor-accessibility`。**证据/影响**：Chromium tree中PPT view/add icon buttons empty；W/H无label association；slideshow tool/color/style/width/nav无name/selected state，opacity可与focus分叉。**链/根因**：`FramePanel :3583-3680`、`AddFrameDialog :185-229`、`FrameSlideshow :788-939`只依赖HoverTip/icon/adjacent text。**方案**：localized actual-control names、pressed/groups、dimension labels和focused overlay visible；不接管outer shell/geometry/data。测zh/en/Tab/Enter/Space/Escape/timer/fullscreen/privacy；semantic-only rollback。

#### [F25-I18N-001]

**状态**：已证实静态控制流，等待`localize-ppt-editor-workflow`；English runtime图阻塞。`FramePanel :1081`有language但`:1760-1800,1883-1942,3498-4170`硬编码中文；AddFrame/Slideshow无language owner。**方案**：reuse现i18n，ephemeral UI render-time；新default name按active language、旧stored/custom byte-preserved且recognizer兼容双语；不翻译prompt/provider/file。风险为窄drawer英文overflow，须多视口量测；删除keys/wiring可回滚，无migration。

#### [F25-HISTORY-002]

**状态**：非问题。多operation引发Undo分裂假设后，新永久`withHistory`测试一次`board.undo()`同时恢复node和pageIndex，未加`withNewBatch`生产修改。

#### [F25-PERF-003]

**状态**：只有baseline，无瓶颈/改善结论。in-app Chromium 1280×720/DPR1/light/zh/normal network+CPU、warm app/board，从画布管理切PPT editor到search visible五次`[316,317,313,319,314]`ms，median316、range313–319；含driver/poll/render，非cold无before/after。

#### [F25-RESPONSIVE-004 / PROVIDER-005]

**状态**：环境/外部凭据阻塞。请求390×844实际只得390×219，证据明确改名；formal smoke/feature/visual/responsive均缺`chromium_headless_shell-1200`，未安装。无授权provider/key，串并行真实成功、latency/quality未实测。dark/English/tablet/mobile/zoom/high-DPI/touch/offline/reduced-motion仍未知，不报产品缺陷。

### 33.4 实际改动、验证、性能/视觉、回滚与退出

**实际改动**：`with-frame.ts:580-597`增加统一页序transform；`FramePanel.tsx:1823-1852`拖拽改用它；新增`with-frame-order.test.ts`3项。另新增3个approval-only changes、`docs/evidence/f25-ppt-frame`下diagnostics/valid metrics/2页PPTX/4 PNG及本账本。没有改CSS、schema/cache/task/provider route；没有provider/network/credential请求。

**测试/构建**：页序3/3 exit0；PPT set exit1但10 files pass、84/84 executed，1 existing mock collection fail；targeted ESLint exit0，0 error/27 warning。Drawnix/full typecheck exit0，full 5/5；cycles exit0。final Drawnix exit1：188 files 183/4/1，1164 tests 1160/3/1，4簇仍cached image/GPT Blob/Sora duration/PPT mock；utils25/25、471/471，react-board1/1、8/8。build:web exit0，app7931 modules 1m51s、SW54 modules1.89s；startup exit0。size exit1：AI Chat844.43/140 kB gzip，Diagram934.93/950、Editor858.24/870等既有债务。full lint exit1；F-25 scoped lint无error。

**PPTX/视觉**：真实export path synthetic文件54,775 bytes、2页；Presentation render exit0为2张1600×900，slides_test exit0无overflow，逐页无裁切/缺图/倒序；slide1 fade、slide2 push-left OOXML和4个SVG/PNG media存在。current desktop empty截图受既有music-player overlay遮挡；390×219只证明viewport blocker。无CSS/同条件before-after，不宣称更美/快/小。

**工具阻塞**：OpenSpec三次exit127；formal Playwright四project类均before page execution缺revision1200；Git metadata absent，不能核对worktree/history。此前feature/visual多余`--`各一次“No tests found”已用正确命令复跑，分类命令噪声。

**回滚/退出**：实现回滚为还原FramePanel旧重排、删除统一transform/test；无data/cache/task恢复。调查回滚删除3 change/evidence/ledger，无runtime影响。F-25为**调查完成、部分验证、未达到退出标准**：ORDER已闭合；EXPORT/A11Y/I18N等待3项审批；responsive/dark/English/provider/full E2E阻塞。批准后按export integrity→visible i18n catalog→a11y reuse keys分别先红后绿，再从create/drag/outline/generate/cancel/retry/refresh/slideshow/export入口复审。

## 34. F-26 设置、语言、工具栏配置、同步状态与错误反馈循环

### 34.1 用户场景、范围、规格与验收门禁

**用户场景**：用户从应用菜单或现有快捷入口打开设置，配置供应商/预设、画布任务卡片和语音播放；在应用菜单切换中英文或选择 PNG/JPG 导出；从主工具栏移除、恢复、重排或重置按钮并在刷新后继续使用；从云同步入口查看连接、同步/冲突/失败状态并采取已有恢复动作。每个保存动作必须区分已保存、失败和待重试，键盘/触控/辅助技术能够到达已有操作。

**范围与非范围**：范围为 app menu/Menu/Popover、I18nProvider、SettingsDialog 壳与 canvas/speech 视图、shared SettingsManager 的 primary localStorage boundary、ToolbarConfigProvider/service/IndexedDB/callers、可达 `SyncSettings` 入口、board theme 与全局 token 的真实 owner、错误反馈及桌面可访问性。provider discovery/routing/health 结果正确性归 F-09；GitHub 数据上传下载/冲突/恢复正确性归 F-03；画布颜色/样式编辑归 F-05；工具窗口壳归 F-15/F-28；性能/日志面板归 F-27。审批前不新增全局主题、语言持久化、跨标签页配置锁、toolbar mutation queue 或 TTS 虚拟列表；已确认的toolbar ordering只进入独立提案。

**规格与 change**：正式 `openspec/specs` 没有通用设置、语言或 toolbar-configuration capability；`update-ui-color-system` 只提供现有视觉 token 验收依据，provider changes 由 F-09 所有，`refactor-hover-tip-unification` 不建立 submenu 键盘契约。当前六个F-26独立审批边界：`improve-settings-toolbar-accessibility` 5/17、3 requirements/8 scenarios；`ensure-settings-write-consistency` 4/13、1/3；`ensure-toolbar-config-write-consistency` 5/13、1/3；`improve-settings-surface-accessibility` 7/28、3/11；`preserve-toolbar-config-mutation-order` 4/15、1/4；`fix-application-menu-window-stacking` 6/20、2/6。另有跨F-08/F-26的 `fix-winbox-minimum-size-consistency` 7/25、2/8。七者分别拥有菜单/开关输入及compact menu geometry、shared primary settings record、toolbar单次durable outcome、Settings-only WinBox/导航/共享shell语义、toolbar overlapping accepted order、application-menu/WinBox stacking、shared current-viewport normal geometry；不合成全局设置重构。两个toolbar-configuration change的requirement唯一，ordering实现依赖先批准/应用sequential outcome。OpenSpec CLI 不可用，七次 strict 结果只能记exit127，不能声称通过。

**当前基线与验收门禁**：浏览器为当前 production build、loopback `?sw=0`、in-app Chromium exact version unknown、1280×720/DPR1/zh、无 CPU/network throttle。定向 5 files/36 tests exit0。不得读取真实 provider token 或发付费请求；storage failure 使用受控 mock/synthetic failure。审批前不改变菜单/保存/焦点/状态语义。TTS 157 voices 已用7次driver空操作、7次DOM提交和7×200次pure sort隔离；原380ms不是application render latency，未实施优化且不宣称“更快”。未来任何 TTS 性能结论仍须同一数据至少5次真实browser before/after；无修后截图不宣称视觉改善。

### 34.2 正向/反向调用链、状态、数据与边界

1. **应用菜单与语言/导出**：`UnifiedToolbar`→`AppToolbar :54-112`→shared `Menu`/`MenuItem`。语言父项 `language-switcher-menu.tsx:9-51`→`I18nProvider :599-630` 的 component/global in-memory `zh|en` owner→所有 `useI18n` consumers rerender；无 storage/cache/network writer。导出父项 `app-menu-items.tsx:98-140`→`saveAsImage(board,true|false)`。submenu leaf selection经 `MenuContentPropsContext` 反向通知 outer menu关闭。
2. **设置入口、外壳与状态**：app menu `Settings :225-244`、command palette、model dropdown、Chat/toolbox/video analyzer和 API auth event设置 `appState.openSettings`；`drawnix.tsx:1667-1670` lazy挂 `SettingsDialog`。dialog以 `activeView/providers/presets/canvas/speech` 和 provider/preset/model drafts 为 UI owner；nav button→`handleViewChange :766-787`→analytics→`renderActiveView :3124-3172`→shared main panel。`WinBoxWindow :607-624,823-905`创建outer root/title/control DOM；pointer/focus activation在`:1127-1208`。反向close为WinBox `onclose`→wrapper `handleClose :537-541`→Settings `handleWindowClose :1854-1859`→`handleCancel`/`persistDrafts`→`openSettings=false`→unmount；discovery/persisting/pending-save guard必须保持。F-09拥有content/discovery/route，F-15仅拥有tool WinBox；本轮shared-surface change只接管Settings opt-in shell/nav/focus/i18n。
3. **通用设置 persistence**：provider draft或 TTS row/control→`settingsManager.updateSettings` wrapper→normalize candidate→`saveToStorage :1110-1128`→单一 `DRAWNIX_SETTINGS_KEY` localStorage record→best-effort `configIndexedDBWriter` mirror→`notifySettingsChange`→Settings/TTS/route consumers。当前 manager 先替换 memory，primary failure在内部catch后fulfilled；TTS还在 await 前写local component state。刷新由manager初始化读取primary record，故失败candidate不恢复。
4. **画布显示配置**：settings canvas switch→`handleCanvasVisibilityChange :1126-1144`→optimistic component state→`LS_KEYS.WORKZONE_CARD_VISIBLE`→custom event→WorkZone/task-card consumer；失败会回滚并Message。该正常对照不经过 shared manager。switch当前无programmatic label。
5. **工具栏配置**：root `drawnix.tsx:869-935`挂 `ToolbarConfigProvider`→`initializeAsync`从 `LS_KEYS_TO_MIGRATE.TOOLBAR_CONFIG`/kvStorage加载、迁移或default→context投影 visible/hidden。toolbar context menu、More panel、creation drag→hook void methods→service whole-config transform→先替换singleton memory并 fire-and-forget IndexedDB set→React `setConfig`→toolbar rerender。反向sink唯一 production writer为service；刷新重新读取 durable record。写reject只console，caller/UI无失败状态。
6. **同步入口与状态**：app menu Cloud Sync→`Drawnix.handleOpenCloudSync`→deferred `SyncSettings :85-410`→`GitHubSyncContext` 的 configured/connected/syncStatus/isSyncing/error/config owner→sync/pull/push/config methods→Message/confirm/status UI。`components/sync-status/SyncStatusIndicator`只有目录barrel导出，无 repo import、无 package root export且 package exports map禁止该deep path；当前可达界面不包含这个“toolbar indicator”。F-03后续继续审真实GitHub数据/恢复，F-26不把不可达组件当现有入口。
7. **主题/颜色边界**：web root `styles.scss:102`声明light color-scheme；TDesign暗色变量主要由 `prefers-color-scheme` media控制。画布主题来自App board `value.theme`→Drawnix Wrapper→React Board `board.tsx:105-112`的 `theme-${themeColorMode}`并随board persistence归F-03。仓库没有全局 `data-theme` writer；所以“画布暗色背景”和“应用全局深色设置”不是同一现有能力，旧主题文档不构成后者的产品契约。
8. **错误、恢复、隐私与测试**：settings dialog已有catch/message/analytics，但manager吞错使其catch不可达；analytics provider endpoint只记录拆解的origin/host/protocol和hasApiKey，不应通过新error/accessible name带入payload。toolbar没有analytics failure。offline对local storage只等价availability/failure injection；语言/toolbar/TTS session无server recovery。现有focused tests覆盖settings/model/color/toolbar hook/sync external links，但无shared Menu submenu、More keyboard、Settings root/title controls/nav/focus/Escape/i18n、storage reject、TTS full-list performance或mobile matrix。

### 34.3 证据问题表

#### [F26-MENU-001]

**状态**：已证实，等待 `improve-settings-toolbar-accessibility` 审批；证据强度为 current Chromium keyboard result + 正反向源码链。**用户影响与复现**：应用菜单聚焦“语言”，按Right后English menuitem数仍0；按Enter后全部menu数0。More按钮按Enter后panel/menu count仍0。`MenuItem :39-77`只在mouseenter开submenu，click仍走`useHandleMenuItemClick`；`Menu :77-83`把Enter/Space变click，outer `AppToolbar :81-87`收到select关闭。两个submenu caller只有语言和图片导出，故键盘/无hover触控无法选择English或JPG；More `:130-173`的desktop click分支不toggle。

**当前/预期、根因、方案、风险、验证与回滚**：当前hover是唯一submenu opener且submenu parent误复用leaf selection；预期parent click/tap/Enter/Space/Right打开并focus child，Left/Escape返回parent，leaf一次执行/一次关闭，More原生键盘activation与pointer/touch等价。preferred方案在shared menu ownership层区分parent/leaf并让native More trigger拥有activation；为两个caller复制handler会继续漂移，未选。风险为portal focus timing、hover timer关闭keyboard submenu、touch click double toggle。批准后component+browser测两submenu/leaf/disabled/focus/dismiss/callback count及More hover/tap/keyboard；回滚event/focus wiring/tests，无data。

#### [F26-MENU-COMPACT-016]

**状态**：实测并按仓库现有compact约定确认为交互几何缺陷，等待同一 `improve-settings-toolbar-accessibility` 审批。**用户影响、复现、当前与预期**：current production、in-app Chromium、zh/DPR1/no throttle；390×844打开应用菜单，13项全部高32 CSS px，比`styles/_responsive.scss:33`的44px约定少12px。预期compact/coarse-pointer parent/leaf activation box至少44×44，保留glyph/text、order/callback和desktop 32px density。before JPEG为390×844、37,913 bytes、SHA-256 `5f71ee68…0e1`。

**调用链、对照、方案、风险、验证与回滚**：app toolbar trigger→Popover→13项composition→shared Menu/MenuItem fixed desktop row styling→DOM rect。320×568 menu `client/scroll=416/510`、End后`版本`完整可见；640×360为`208/510`且仍内部滚动，证明现有menu-owned overflow/reveal可用，无需解锁page/canvas或替换高度。390×844聚焦`导出图片`按Right后`aria-expanded=false`、menu1、PNG/JPG 0/0仍归MENU-001。preferred只在application-menu compact/coarse条件提高hit box；全局放大Menu primitive或缩字未选。风险为同时可见项减少和submenu placement；批准后测320/375/390/640×360/tablet/desktop、scroll/reveal、两submenu、pointer/touch/keyboard、zh/en/light/dark与matched after。回滚scoped rule/tests，无data/cache。

#### [F26-A11Y-002]

**状态**：已证实，等待同一 accessibility change；证据强度为 live accessibility tree + source。**用户影响与复现**：设置→画布显示中可见“任务进度卡片”标题/说明，但tree随后是空名称`switch`；`settings-dialog.tsx:3075-3090`无label relationship/aria-label。屏幕阅读器无法识别开关控制什么。preferred方案把既有中英设置名称程序化关联到actual Switch，不以HoverTip/title替代，不含task/provider/error/private data；不改checked/callback/geometry。批准后按role+name、checked transition、keyboard/pointer和同状态截图验证；回滚semantic prop/key/test即可。

#### [F26-SETTINGS-SHELL-A11Y-010]

**状态**：已证实，等待 `improve-settings-surface-accessibility` 审批；证据强度为 current production Chromium DOM/focus/key result + 正反向源码链。**用户影响与复现/当前与预期**：从应用菜单点击设置后window count=1而active element为`BODY`；`.winbox-settings-window`的role/name/labelledby/modal/tabindex全为null，visible title没有ID关系，visible split/max/close均为`SPAN`且role/name/tabindex全null。点供应商nav取得focus后按Escape，window count仍1；pointer close后window count=0但focus回BODY。当前键盘/辅助技术无法识别outer surface或使用标题栏动作且失去返回位置；预期Settings-only root为localized non-modal dialog，visible controls有button/name/state/Enter/Space parity，unhandled Escape进入既有guarded close且actual close后安全返焦，不做focus trap。

**完整调用链、根因、方案、风险、验证与回滚**：app menu/command palette/model/Chat/toolbox/video/auth writers→`appState.openSettings`→`drawnix.tsx:1667-1670`→`SettingsDialog :3174-3216`→`WinBoxWindow :607-624,823-905`→third-party root/control DOM；反向pointer close→wrapper `handleClose :537-541`→Settings `handleWindowClose :1854-1859`→discovery/persist guard→`handleCancel :1839-1852`→pending `persistDrafts`或`openSettings=false`→unmount/pending caller continuation。根因是wrapper只创建/激活pointer DOM，没有caller opt-in accessibility/focus/Escape contract。preferred方案复用窄WinBox decorator但仅Settings caller independently opt-in；不全局修改WinBox、不在body嵌第二dialog、不synthetic click绕guard。风险为F-15同文件rebase、nested Escape、intentional autofocus、disconnected invoker、callback duplicate；批准后用mock WinBox+real Settings测explicit/gated open、split/max/restore/close exact once、nested/discovery/persist/save failure、reopen cleanup和focus return，browser复走全部入口类。回滚删除Settings opt-in/listener/i18n/test，无schema/data/cache恢复。

#### [F26-SETTINGS-NAV-A11Y-011]

**状态**：已证实，等待同一 change；证据强度为 production pointer state transition + DOM attribute inspection + unique render/writer source chain。**用户影响与复现/当前与预期**：打开Settings，pointer从供应商切到模型预设再切画布显示，visible active class确实移动；但四按钮的`aria-current/pressed/selected/controls`始终全null，native `ASIDE`无name，`.settings-dialog__main`无role/name/id/labelledby。当前视图只由视觉class表达，辅助技术无法得知current或按钮与更新panel关系；预期一个localized nav、exactly one current button和stable controlled named region，保留四个native button的pointer/Enter/Space与Tab，不擅自新增tablist Arrow语义。

**调用链、根因、候选、风险、验证与回滚**：`VIEW_SECTIONS :112-117`四个唯一writer→button `onClick :3102-3116`→`handleViewChange :766-787` one analytics/state transition→`renderActiveView :3124-3172`→shared main root；reverse从四类visible content均回到same `activeView` owner，没有第二selected writer。根因是React state只投影CSS class，未投影semantic state/relationship。preferred方案为named nav + `aria-current` + stable `aria-controls`/region/label relationship；tablist/roving focus未选，因会新增Arrow contract。风险为duplicate IDs、语言重建metadata、compact catalog/detail焦点、analytics duplicate；批准后component测4 views pointer/Enter/Space exact once、current uniqueness、panel relationship、Tab/Arrow non-change、normal/empty/loading/failure/discovery/compact fixture。回滚attributes/ids/keys/tests，无data或side effect。

#### [F26-SETTINGS-SHELL-I18N-012]

**状态**：已证实静态owner漂移，等待同一 change；证据强度为 current mounted provider/source control flow，English runtime screenshot未取得且不伪造。**用户影响与证明/当前与预期**：Drawnix在`I18nProvider`内，`i18n.tsx:124-130,317,506,599-638`已有zh/en `settings.title`与live state；但SettingsDialog不消费`useI18n`，`VIEW_SECTIONS :112-117`和WinBox `title="设置" :3179`固定中文，titlebar又无可翻译action name。当前English state不能驱动shared title/nav/panel/action copy；预期只把F-26 shared shell随existing language live更新，不翻译或改写provider/model/preset/TTS/canvas/user/private data。

**调用链、根因、方案、风险、验证与回滚**：application language menu→`I18nProvider.setLanguage`→context rerender；当前Settings shared strings无context input所以链终止。preferred方案复用`settings.title`并加typed shared nav/panel/title-action keys，stable view values/IDs不变，`WinBoxWindow.setTitle :996-1001`和decorator更新可见/accessible copy。F-09仍独占provider/model content；TTS/preset/canvas内容不被本change接管。风险为English overflow、live language change重置active/draft/focus、private value进入name；批准后初始/live zh-en测root/title/control/nav/panel且assert activeView/draft/discovery/scroll/focus/callback/analytics及arbitrary sentinel byte-for-byte。回滚keys/consumer/tests，无migration。

#### [F26-WINBOX-GEOMETRY-013]

**状态**：已证实，等待跨F-08/F-26的 `fix-winbox-minimum-size-consistency` 审批；证据强度为current production Chromium多caller raw DOMRect + shared wrapper/third-party只读确定性control flow + above-min negative control。**用户场景、复现、当前与预期**：1280×720/DPR1/zh/no throttle，Settings `88%=634,min680`三轮close/reopen+max/restore为`634→634`,`680→634`,`680→634`；AI image `60%=432,min500`为`500→432`；AI video `60%=432,min600`为`600→432`且initial `(192,144)` bottom744超viewport24；Media Library `85%=612,min500`为`612→612`负对照。当前cold/warm normal size分叉、max restore丢declared minimum且clamp后仍按raw size居中；预期stored/rendered normal rect同一、落在existing parsed effective constraints内、final size重新按caller center/numeric intent定位，already-valid geometry不变。

**完整调用链、根因、方案、替代、风险、验证与回滚**：Settings/TTD/Media props→`WinBoxWindow` lazy state `:212-213,520-525`→create effect `:548-624`→third-party non-autosize constructor `winbox.js:229-257`存raw percentage→wrapper先存raw normal `:933-940`；cached mount constraint effect `:1210-1235`令explicit resize存raw member但只clamp local DOM（third-party`:1265-1284`）→pointer max skip-update full rect→restore no-arg resize复用raw member（`:1071-1129`）→UI rect。cold首次constraint effect在instance不存在时return，dependencies又不含loaded/readiness，形成另一分支。preferred在wrapper construction后用WinBox已解析numeric min/max clamp effective target，传already-clamped numeric resize使member/DOM一致，再按existing x/y intent move，最后才存normal；prop constraint path同样同步且split时仍skip。不在三个caller分别算numeric、不只加effect dependency、不读transformed DOM、不降minimum、不改node_modules。风险为shared callback/persisted tool size、split/keepAlive/autoMax、orientation owner rebase和已有under-min视觉依赖。批准后fake WinBox先红后绿，测cold/cached/max/restore/center/impossible min/valid negative、Settings/image/video state、Media/Prompt/tool control、callback exactly once；browser同viewportafter矩形/截图。回滚normalizer/helper/tests，无data/cache/task恢复。

#### [F26-STORE-003]

**状态**：已证实，等待 `ensure-settings-write-consistency`；证据强度为确定性 happens-before/exception control flow和全部关键caller反查。**用户影响与复现**：令 primary `localStorage.setItem(DRAWNIX_SETTINGS_KEY, …)`抛错；manager `updateSettings :1282-1288`已把memory换成candidate，`saveToStorage :1110-1128`catch不throw，随后listener被通知且Promise fulfilled。Settings `persistDrafts :1732-1819`会标记baseline/analytics success甚至关闭；TTS `:232-235`也保留新UI。刷新只读旧record，因此值回退且此前无失败反馈。

**根因、方案、替代、风险、验证与回滚**：shared manager没有durable result，publish早于primary commit。preferred方案分离candidate/committed snapshot，primary write成功后才publish/notify，失败保持committed并safe reject；现有caller显示localized retry或明确unsaved draft。只在TTS加catch无法让manager识别失败，未选。保持key/schema/normalization/encryption和best-effort SW IndexedDB mirror；不承诺未测overlapping write ordering。风险是依赖即时memory的caller和blind rollback覆盖相邻write，实施前必须inventory全部caller并用operation ownership避免错误回滚。测serialization/setItem reject、listener、Settings/TTS/provider caller、retry/refresh/privacy/backup；回滚manager/caller/tests，无migration。

#### [F26-TOOLBAR-004]

**状态**：已证实 failure-contract 缺陷，等待 `ensure-toolbar-config-write-consistency`；正常成功路径为非问题正对照。**用户影响与复现**：成功样本中Pen 1→remove后0→refresh仍0，Shape reset后Pen 1→再次refresh仍1。失败链为context/More/drag→hook `:110-150`同步setConfig→service `:135-220`先改memory且void set，reject只console；页面显示candidate但刷新读旧config，用户无反馈。

**根因、方案、替代、风险、验证与回滚**：void optimistic API隐藏whole-record durable outcome。preferred方案interactive mutation返回awaitable result，candidate IndexedDB commit后再发布；reject保持last durable并safe retry feedback。不使用任意timeout或只加console/toast；confirmed overlap queue由`preserve-toolbar-config-mutation-order`独立拥有。风险是persist-before-publish延迟和drag调用频率，需五次交互latency与caller inventory。批准后对remove/show/reorder/reset逐项失败注入、retry/refresh、安全error和真实DOM验证。回滚service/hook/caller/tests，无schema/data cleanup。

#### [F26-TOOLBAR-ORDER-014]

**状态**：已证实service-level ordering race，等待 `preserve-toolbar-config-mutation-order` 审批；真实 Chromium IndexedDB 发生频率未知。**用户场景、复现、当前与预期**：用户在前一次toolbar visibility/reorder/reset写未决时接受第二次操作。固定Node24.14.0、Vitest3.2.4/jsdom，把唯一`kvStorageService.set`边界替换为两个deferred；default上依次`hideButton('freehand')`、`showButton('freehand')`，按newer→older完成。1/1 test exit0/test6ms/Vitest1.20s/process1.69s；current service `visible=true`，controlled durable `false`，fresh `initializeAsync()`仍`false`。当前旧whole-record可最后覆盖新意图；预期successful accepted operations按序组合，settled shared/durable/refresh一致。browser storage未读写，不能声称线上频率。

**完整调用链、根因与影响**：context menu `toolbar-context-menu.tsx:87-132`、More `more-tools-button.tsx:451-457`、drag drop `creation-toolbar.tsx:255-263`/`use-drag-sort.ts:159-188`→provider `use-toolbar-config.tsx:110-150`→service whole-record mutations `toolbar-config-service.ts:135-211`→untracked fire-and-forget `:217-220`→`kv-storage-service.ts:86-115`每次独立open/transaction→refresh `toolbar-config-service.ts:64-95`→provider projection`:75-85`。service还由package root/runtime导出。根因是无accepted-operation/pending sequence owner且caller拿不到Promise；影响visibility/order/reset whole record，跨标签/unload/真实发生率未测，不扩称数据丢失频发。

**候选方案、替代、风险、验证与回滚**：preferred为domain-local semantic-operation queue：每项到队首才从last durable派生candidate，按accepted order串行commit；失败只settle自身并让下一项从last durable继续。依赖`ensure-toolbar-config-write-consistency`的awaitable outcome，不建global queue/event bus，不排队stale snapshots，不静默coalesce，不改key/schema/version/default/cross-tab/unload。风险为burst latency、queued index reorder失效、pending feedback identity；批准后先加2/3操作、earlier/middle/latest failure、reset+reorder+visibility红测，再实现并测5次single/burst browser latency与refresh。回滚queue/caller/tests，无migration/cache cleanup；ordering race返回。

#### [F26-PERF-005]

**状态**：非问题，性能候选已关闭；未改代码/未建change。**用户场景、环境、步骤与原始值**：用户从Canvas Display进入157 system voices的Speech Playback。当前production artifact、in-app Chromium exact version unknown、1280×720/DPR1/zh、normal CPU/network。初始locator端到端五次 `[381,369,380,380,357]`ms，median380、range357–381；TTS view有193 buttons、1799 descendants，最后row top约12245.5px。补充7次warm对照：Canvas locator median319/range315–326，Speech median302/range292–308，已激活Speech空操作median306/range301–323；driver/action等待占主导，因此380ms不能作为application render latency。

**调用链、隔离证据、当前与预期**：nav `onClick`→`handleViewChange`→`activeView`→`TtsSettingsPanel`→effect `loadVoices :136-203`→map/sort→`voices`→language/filter→157 rows `:451-500`。现有search在no-match与single-space（trim后全量）间切换，remove median25/range24–40ms，restore157 median36/range34–41ms，同值no-op fill median23/range20–25ms，隔离出的全量DOM提交增量median13ms；七次forced last-row layout read均0ms（毫秒分辨率）。浏览器sandbox不暴露`speechSynthesis/performance`，故用页面提取的同157条非敏感voice metadata在固定Node24.14.0、deterministic shuffle上做7 samples×200 sorts：current comparator median3.543/range3.517–3.562ms/sort；单次937 comparisons/1874 finds/144724 probes；诊断性precomputed-score comparator median0.171/range0.168–0.175ms/sort。

**结论、方案、风险、验证与回滚**：`:151-165` comparator内线性find是已证实但有界的算法低效，不是已证实用户瓶颈；当前证据也没有long task、掉帧、内存峰值或输入阻塞。预计算score可在该Node诊断减少约3.37ms/sort，但无Chromium before/after且用户影响未过优先级门槛，所以不实施。全量157-row DOM也只记录规模，不凭形态引入virtualization；后者会改变scroll/focus/a11y并须新proposal。若未来更大voice集或browser profiler证明影响，再用同数据≥5次before/after、React commit/long-task/memory和键盘滚动矩阵验证。当前无需runtime回滚；证据回滚只删除metrics/diagnostics/ledger本段。

#### [F26-DEAD-006]

**状态**：已证实并完成无行为清理。**证明与影响**：清理前全仓唯一`SyncStatusIndicator`符号和`sync-status`路径命中均位于其自身3文件；local barrel无consumer；`packages/drawnix/src/index.ts`未export；package.json `exports`只有`.`和`./runtime`，禁止公开deep import。真实同步入口是App menu→deferred `SyncSettings`。因此这133行component、99行SCSS和5行barrel不会进入当前可达运行时或public package API，只增加维护/搜索漂移。

**方案、风险、验证与回滚**：已删除完整`components/sync-status`目录；没有把它替换/注册到toolbar，因为那是新增行为。风险为未被源码捕获的外部未声明deep import，但exports map排除且package workspace consumers反查为0。删除后源码+production dist `rg` absence exit0；focused 3 files/12 tests、Drawnix/full typecheck、cycles、startup和production build均exit0；app/SW仍transform 7931/54 modules。回滚需从本轮原始源或上游副本恢复同路径3文件；无Git metadata，当前目录内没有自动本地历史，故不能声称可用Git恢复；无data/cache恢复。

#### [F26-LANGUAGE-007]

**状态**：待验证假设，不改代码。Language `I18nProvider :599-624`每次default zh且无storage/restore writer，刷新重置可由源码确定；但当前正式spec没有“记住语言偏好”requirement，故只能作为候选产品提案，不能叫缺陷。后续必须先取得语言偏好是否持久化及跨标签同步的产品语义，再决定是否建立独立change；当前没有运行时回滚项。

#### [F26-ZINDEX-008]

**状态**：非问题，通用z-index统一候选已关闭，不改代码/不建全局change。`constants/z-index.ts`、`styles/z-index.scss`、`docs/Z_INDEX_GUIDE.md`同名值部分漂移，且共享`popover.tsx:211`有局部5000，但静态数值不一致本身不能证明用户缺陷，也不能授权改变所有overlay。F-26已用同viewport实际重叠、computed layer、intersection和topmost hit测试找到一个具体应用菜单缺陷，独立登记为015；其他overlay仍须逐surface复现后归因。文档只增加current-source提示，不统一运行时数值。证据回滚为删除文档登记，无runtime/data/cache影响。

#### [F26-APP-MENU-STACK-015]

**状态**：已证实视觉/指针交互缺陷，等待 `fix-application-menu-window-stacking` 审批；证据强度为current production Chromium DOMRect/computed style/hit test + 正反向源码链 + 两个对照。**用户影响、复现、当前与预期**：current production `http://127.0.0.1:7399/?sw=0`、in-app Chromium exact version unknown、1280×720/DPR1/zh/no throttle。先开non-modal Settings，再点仍可用的应用菜单；menu `(61,39)-(302.1875,551)`、Settings `(77,43)-(1203,677)`，交叠`225.1875×508=114,395.25 CSS px²`，两者computed z均5000。交叠top-left/center/bottom-right的`elementFromPoint`依次为`.wb-nw`、`.settings-dialog__nav-shell`、`.settings-dialog__sidebar-list`，0/3属于菜单；截图只剩约16px左缘。当前绝大部分可见菜单被窗口覆盖且pointer落到Settings；预期既然global menu仍可打开，其可见交叠面及submenu应在non-modal window之上可点击，且不改变窗口状态。

**完整调用链、反向证明、根因与影响**：trigger/open state→`components/toolbar/app-toolbar/app-toolbar.tsx:54-111`，line80把`Z_INDEX.POPOVER_APP=4500`作为style传给portal→`components/popover/popover.tsx:197-220`，line211先spread caller style再尾写`zIndex:5000`→WinBox register→`services/winbox-manager-service.ts:17,115-130`从`DIALOG_AI_IMAGE=5000`紧凑分配→`components/winbox/winbox-custom.scss:6-10`以`!important`应用variable→browser stacking/hit test→Settings接收交叠pointer。反向从三处topmost节点均回到同一Settings WinBox；关闭Settings后同menu中心正确命中menu且WinBox count0，Settings内20000 provider context menu在相同window上方正确命中，排除menu content缺失与所有portal均失效。生产源码另有6个static `WinBoxWindow` sites/5 files；`tool-window-service.ts:318-323,325-428,616-624`让multi/URL tool默认每次new且`openNewToolInstance`无guard，toolbox与minimized context都有new writer，`ToolWinBoxManager.tsx:296-380`渲染全部active instance。故current formula的第501窗=5500是确定性上界缺失，不声称用户会常开501窗。影响当前application-menu/WinBox交叠；compact/theme/high-DPI仍未测，不能扩称所有overlay或所有viewport。

**根因、方案、替代、风险、验证与回滚**：根因是shared Popover有效层覆盖caller，且unbounded内部WinBox index与application overlay竞争同一外部stacking context。fixed5500-only已被501窗静态证明否决，任意抬高数字或新增window cap也未选。preferred为每个Drawnix实例建立一个WinBox outer stacking host/context，把内部`5000+index`封装在WinBox band；无host时保留`container||body`fallback；再给`PopoverContent`加向后兼容`overlayZIndex`，未opt-in仍5000，只让AppToolbar在同Drawnix sibling band5500 opt-in。`WinBoxWindow.tsx:608-624`和upstream `winbox.js:114,315`已有root seam，但不能据此声称无行为风险。风险为re-root后containing block、pointer、portal context、fullscreen/max/restore、keepAlive/cleanup、多Drawnix isolation及与a11y/geometry changes共文件；批准后先做1/2/501+ internal layer、多root/fallback/cleanup/geometry红测，再实现并实测Settings/direct generation/media/≥2 tool/nested windows、activation/min/max/restore/close、≥3 hit points、submenu/dismiss/no-window/non-opted/higher-overlay、matched after截图及responsive/theme/zoom；最后跑typecheck/lint/full tests/cycles/build/size/startup/E2E对基线。回滚host/context/root resolution、prop/caller opt-in/named layer/tests/after artifact，缺陷恢复；无migration、storage、cache、task或user-data清理。

#### [F26-RESPONSIVE-009]

**状态**：部分实测、其余未知/环境阻塞，不把未测状态定为缺陷。现已取得应用菜单390×844、320×568、640×360的row/scroll/reveal证据和一张compact截图，并把32px目标登记为016；尚未取得同数据768×1024、dark/English/zoom/high-DPI/真实touch/reduced-motion以及完整Settings表单状态截图，formal Playwright仍缺configured `chromium_headless_shell` revision1200。恢复指定revision或可用环境后继续设置initial/empty/loading/failure/retry、长provider/voice名、menu/submenu/More、focus/touch与overlay矩阵。

### 34.4 实际改动、验证、性能/视觉、规格、回滚与退出判断

**实际改动**：删除了唯一无调用且未公开export的 `components/sync-status/SyncStatusIndicator.tsx`、`index.ts`、`sync-status.scss`，共237行；没有注册替代入口，真实App menu→`SyncSettings`链保持。另新增6个F-26 approval-only changes和1个跨F-08/F-26 shared WinBox geometry change、`docs/evidence/f26-settings-toolbar/diagnostics.md`/`metrics.json`、三张before截图及本账本/矩阵；`improve-settings-surface-accessibility`只记录Settings outer WinBox/nav/shared shell，`preserve-toolbar-config-mutation-order`只记录toolbar overlapping accepted order，`fix-winbox-minimum-size-consistency`只记录shared normal geometry，`fix-application-menu-window-stacking`只记录application menu-over-WinBox层。本次补充调查扩展了既有`improve-settings-toolbar-accessibility`的compact menu requirement，但没有修改产品runtime、CSS或永久test；toolbar overlap临时diagnostic已删除，此前之外也未改storage、settings、toolbar、language、theme或用户数据。工具栏手工状态已经reset default；设置/图片/视频/素材库窗口及application/context menu均以无pending draft/task状态关闭；TTS只切换临时nav/search filter，未改voice/rate/pitch/volume或持久化设置，未读browser storage/credential、未发provider或task请求。浏览器tabs已finalize，本地7333/7396/7397/7398/7399/7400 server均已停止且7400无listener。

**测试与工具结果**：调查定向命令 exit0，5/5 files、36/36 tests、3.68s；删除后 settings-manager/toolbar/sync 复跑 exit0，3/3 files、12/12 tests、2.18s；本次Settings shell补充窄测 exit0，6/6 files、17/17 tests、Vitest 2.65s/process 3.15s；F-08/media content负对照 exit0，5/5 files、26/26 tests、Vitest4.19s/process4.71s。TTS补充首条Vitest因workspace-root filter与package-root include不匹配，在collection前“No test files found” exit1，归调用配置错误；修正`--root packages/drawnix`后2/2 files、5/5 tests、exit0、Vitest1.91s/process2.41s。toolbar overlap受控diagnostic 1/1 files、1/1 tests、exit0、test6ms/Vitest1.20s/process1.69s，临时文件随后删除；既有toolbar provider基线复跑1/1 file、1/1 test、exit0、test37ms/Vitest1.39s/process1.88s，只覆盖初始化projection。jsdom无Crypto、Browserslist age、third-party sourcemap及TTS queue mock缺`getRectangle` stderr归环境/工具噪声，且没有shell/geometry/full-list performance/toolbar overlap或host/WinBox/AppToolbar/Popover stacking永久test。Drawnix typecheck exit0；full typecheck exit0、5/5 projects；cycles exit0；build:web exit0，app7931 modules/1m53s、SW54/1.99s；startup exit0。首次`pnpm test`未执行测试体即因foreign Nx cache artifact exit1；未清缓存，改`nx run-many -t=test --skip-nx-cache`后真实结果exit1：Drawnix 189 files=184 pass/4 fail/1 skip，1165 tests=1161 pass/3 fail/1 skip，四簇仍是cached image、GPT Blob、Sora duration、PPT mock，与F-25失败集合相同且无新增；react-board 1/1、8/8，utils target exit0。size exit1：AI Chat844.43/140kB，Diagram934.93/950、Editor858.24/870等与F-25 baseline一致。OpenSpec七个strict命令各exit127；new ordering change人工确认4/4文件、1 requirement/4 scenarios/4 WHEN/4 THEN、4/15 tasks、requirement全仓唯一；`toolbar-configuration`两owner分别为single-operation durable outcome与overlapping accepted order且有依赖。Application-menu stacking correction为4/4、2 requirements/6 scenarios/6 WHEN/6 THEN、6/20，requirement与capability均单owner；Settings surface为4/4、3/11/11/11、7/28；WinBox geometry为4/4、2/8/8/8、7/25；settings-toolbar扩展后为4/4、3/8/8/8、5/17，三个requirement与capability均单owner；两项write consistency保持4/13、5/13。pnpm的项目级credential警告只作为配置噪声记录，未读取`.npmrc`。Git metadata缺失，不能核对worktree/history。

**性能与视觉**：TTS原5次380ms候选已用7次导航空操作、7次full-row commit和7×200次pure-sort诊断关闭为非问题；确认的是current comparator median3.543ms的有界算法低效与full-list DOM增量median13ms，不是用户可感知瓶颈。未优化，故不宣称更快/省内存。未改CSS/视觉；Settings shell与application-menu stacking两张before均为1280×720，compact app-menu before为390×844、37,913 bytes/SHA-256 `5f71ee68c…0e1`；均无after，不宣称更美。stacking以114,395.25 CSS px²交叠及0/3 menu topmost hits确认，compact以13/13 rows=32px对照44px contract确认。geometry另由三Settings轮次、image/video caller与Media负对照闭合：Settings `634→634/680→634/680→634`、image`500→432`、video`600→432`且initial overflow24、Media`612→612`；这些不是性能或审美结论，修后须用exact after rect与matched screenshot验收。当前keyboard/a11y/persistence/geometry/stacking数据保存在F-26 evidence JSON/diagnostics。

**文档漂移**：`HOVER_TIP_UNIFICATION_LESSONS`可作为tooltip非accessible-name经验，不能代替控制语义；`TDESIGN_THEME_INTEGRATION`/旧theme说明与当前web forced light/board theme/media-query边界不完全一致。`docs/Z_INDEX_GUIDE.md`大部分表格/Phase已标明为历史迁移草案，当前TS/Sass owner与部分漂移已记录；通用数值统一没有缺陷证据，只有application-menu/WinBox具体层叠独立进入审批change。未在无surface证据时统一运行时数值。

**回滚与退出判断**：DEAD cleanup回滚为从原始源/上游副本恢复同路径3文件；由于目录无Git metadata且本地没有另一副本，不能声称可通过Git自动恢复。调查回滚为删除7个change、F-26 evidence和本节/矩阵行，无runtime/data影响。F-26当前为**事实建模完成、部分验证、实施与完整验证明确阻塞，未达到退出标准**：DEAD已闭合，PERF与generic ZINDEX候选已证伪并关闭为非问题；MENU keyboard/compact/A11Y、SETTINGS-SHELL/NAV/I18N、shared WINBOX-GEOMETRY、STORE、TOOLBAR sequential/order与APP-MENU STACKING等待七项审批；LANGUAGE persistence缺产品语义；完整responsive/formal E2E仍阻塞。批准后各change分别先红后绿；toolbar ordering依赖sequential durable outcome且不扩成global queue；shared geometry必须先与generation/tool/media viewport changes rebase但不能吸收orientation/compact/saved-size；application-menu stacking的fixed5500方案已被501窗边界否决，必须用per-Drawnix host包含内部层且不能新增window cap或扩成global normalization；Settings shell与F-15只复用narrow a11y primitive、不能扩大caller opt-in；F-09与F-26共享i18n文件但owner仍分离。无审批时继续不依赖这些行为的独立功能调查。

## 35. F-27 Web Vitals、性能面板、崩溃诊断与隐私安全导出循环

### 35.1 用户场景、范围、规格与验收门禁

**用户场景**：分析旁路在用户正常启动、导航、切换标签页和发生 Web Vitals 时记录不包含 URL 查询/片段敏感值的指标；页面发生启动/渲染/未处理错误、网络失败、卡死或内存压力时，崩溃恢复和调试数据仍足够定位类别与时序；用户从错误页或 SW Debug 主动显示、复制、下载诊断时，不把凭据形状的字段/值、Bearer/Authorization 或 URL query/fragment 带入输出；高内存性能面板的已有创建项目、刷新、固定、关闭和移动操作能被键盘/辅助技术使用，存储失败不假报已保存。

**范围与非范围**：范围为 bootstrap 的 page report/Web Vitals 初始化调用者、`page-report-service`、`web-vitals-service`、PostHog 最终 capture 边界、`crash-logger`、SW crash RPC/IndexedDB/read/display/copy/export、`unified-log-service` memory/IndexedDB、application error-log export、PerformancePanel delayed mount/DOM/pointer/localStorage。PostHog consent/开关、事件产品命名和启动拆包归 F-01；provider/task/benchmark/Suno 原始响应源头分别归 F-09/F-10/F-20/F-22 及既有 domain change；通用工具初始化/写入的日志副作用归其自身 change；全局视觉 token 与跨功能最终无障碍矩阵归 F-28。本轮不读取真实 telemetry/log database/credential，不发 provider 请求，不新增性能 dashboard、设置项、诊断上传或用户数据迁移。

**规格与 change**：正式 `openspec/specs` 没有 analytics-privacy、diagnostic-privacy 或 PerformancePanel capability。`refactor-startup-shell-loading`只拥有 bootstrap import/时机；`refactor-sw-duplex-comm`只拥有 transport 且其任务执行前提已漂移；`sanitize-model-benchmark-diagnostics`与`sanitize-suno-provider-error-feedback`拥有域内源头，不能由通用 final boundary 取代；`refactor-hover-tip-unification`只保证视觉提示复用。新增四个审批边界：`sanitize-page-analytics-context` 4/12、1 requirement/4 scenarios；`sanitize-diagnostic-capture-and-export` 4/15、1/5；`improve-performance-panel-accessibility` 4/13、1/4；`ensure-performance-panel-write-consistency` 4/13、1/5。四次 OpenSpec strict 均因 CLI 不存在 exit127；文件、headings、scenario、唯一 requirement 与 active change ownership 已人工校验，不能声称 strict 通过。

**当前基线与验收门禁**：当前 workspace 无 Git metadata；Node 24.14.0、Vitest 3.2.4、jsdom、Darwin 22.6.0 x86_64。成功隔离诊断共四个独立进程、4/4 files、10/10 tests、0 external request，临时 tests 全部删除。第一次两条 `pnpm exec vitest` 在 test collection 前因新 shell PATH 无 node exit127，归环境失败；改用 workspace Node 绝对路径后运行。批准前不改变远程 analytics payload、diagnostic retention/export、键盘或 durable commit。修后必须以 real analytics wrapper final capture、SW/application final download、组件 accessible tree 与 storage failure injection 先红后绿；任何“更快/更小/更省内存”需另做至少五次同环境前后测量，本轮无此结论。

### 35.2 正向/反向调用链、状态、数据与边界

1. **Page Report**：`bootstrap.tsx:277-290`在 PostHog ready 后调用`initPageReport`→initial view；load→performance；beforeunload→unload；visibility→hidden/visible；popstate/pushState→SPA view（`page-report-service.ts:257-324`）。`collectPageViewData :81-96`写 raw href/referrer；unload `:237-251`和visibility `:286-301`再写 raw href。所有事件→`analytics.track`→common release merge→`sanitizeObject`→idle/setTimeout→`window.posthog.capture :266-305`。反向 final capture 的项目唯一 wrapper 为该 class；page lifecycle 的这些字段 writer 已全部列出。
2. **Web Vitals**：`bootstrap :327-339`延迟`initWebVitals`→dynamic `onCLS/FCP/LCP/TTFB/INP :90-102`→callback `reportWebVitals :23-49`持有 metric value/delta/rating/navigationType、pathname与只按200字符截断的 referrer→同一 final capture。metric owner为 web-vitals library callback；service无storage/retry/cancel，analytics disabled 时no-op，失败只console。
3. **通用 analytics sanitizer边界**：`posthog-analytics.ts:266-280`声明所有event脱敏并调用`sanitizeObject`；后者只按object key敏感词、string开头Bearer或长纯token处理（`security/index.ts:42-75`），不会把`page_url/referrer`普通string解析为URL。最终sink sentinel测试必须经过real wrapper，不能只停在mocked `analytics.track`。
4. **Crash capture/persistence**：`bootstrap :50-52`立即`initCrashLogger`→startup、error/rejection、beforeunload、freeze/longtask/resource、user action、fetch、console handlers。snapshot顶层raw href及error/custom data见`crash-logger.ts:708-785,823-841,890-909,1281-1298`；console `:1314-1373`保留string/Error.message/stack/object string preview；fetch URL在`:1201-1255`经`sanitizeUrl`但rejected Error.message raw。所有snapshot→`sendSnapshotToSW :543-569`/beforeunload localStorage→`swChannelClient.reportCrashSnapshot :493-505`→channel manager `:357-361,501-510`→`MemorySnapshotDB/snapshots`最多50条 `sw/index.ts:3587-3708`→direct read→SW Debug live display/copy/export。SW仅cap count，无sanitizer/TTL；local pending queue最多20、2秒轮询，失败静默。
5. **Application/SW Debug export**：React ErrorBoundary `:65-82`与App initialization failure `:945-956`→`collectAndDownloadErrorLog`→`error-log-exporter.ts:62-90`直接组合userAgent/raw href/current message+stack+componentStack/crashRecovery/`getDiagnosticData`/all memory unified logs→JSON Blob/download。SW Debug `debug-storage-reader.js:527-565`读snapshot；`memory-logs.js:360-410`显示/复制/下载；`export-modal.js:210-263`过滤选项后把raw state与location href传`downloadJson`。这些是独立导出writer，故只修application exporter不能保护at-rest/debug paths。
6. **Unified Log**：sync/GitHub/LLM/crash等caller→`UnifiedLogService.log :169-211`→raw top-level message、Error message/stack和`sanitizeData`后的data→memory cache `:284-312`；配置需持久化的类别进500ms batch→`aitu-unified-logs/logs`。`sanitizeData :683-700`只按token/password/secret/Gist key递归普通object，不匹配apiKey/authorization、数组/string URL/Bearer，也不处理message/Error；application export经`getMemoryLogs`反向汇总所有类别。IDB query/retention独立于current error export，本轮保持store/key/cap兼容。
7. **PerformancePanel可达与状态**：Drawnix `:677-701`五秒后/idle enable→`DrawnixDeferredFeatures :206-213`lazy mount→每5秒`memoryMonitorService.getMemoryStats`→80%或100 images+60%阈值与pinned/dismissed owner决定render。四个icon button和pointer drag handle见`PerformancePanel :352-452`；drag以pointer capture计算window clamp，pin/position共用`savePersistedSettings :116-130`；初始化唯一reader在`:84-104`。存储key/shape为`drawnix_performance_panel_settings`及`{position,pinned}`；catch写错后仍React commit，无return/error/UI。
8. **错误、隐私、恢复与测试边界**：没有server retry/offline queue用于analytics；PostHog unavailable为no-op。Crash pending queue只解决SW未ready，不提供durable确认；beforeunload localStorage是备份。Legacy raw crash records可由现有clear/cap移除，但审批proposal只要求read/export final filtering与forward safe writes，不后台wipe。PerformancePanel localStorage synchronous，故无需global mutation queue；drag movement与durable commit点须分离以避免per-move failure feedback。现有 permanent tests缺这些final sink/a11y/storage branches，临时diagnostic已删除。

### 35.3 证据问题表

#### [F27-ANALYTICS-001]

**状态**：已证实，等待`sanitize-page-analytics-context`审批；证据强度为real `posthog-analytics` wrapper→synthetic `window.posthog.capture` final sink的2/2测试加完整writer反查。**用户影响与复现**：令page URL含`?apiKey=F27_FINAL_PAGE_QUERY_SENTINEL`、referrer含`?token=F27_FINAL_REFERRER_SENTINEL`，启用synthetic PostHog并触发view/unload与LCP callback；两个page sentinel和Web Vitals referrer sentinel均到final capture。没有读取真实telemetry/credential，因此不声称生产已泄漏。

**当前/预期、根因、方案、风险、验证与回滚**：当前page/referrer是ordinary strings，generic object sanitizer不解析其URL内部；预期page仅origin+pathname、referrer最多HTTP(S) origin，query/fragment不发送，同时event names/metric/timing/release/path保持。preferred为producer-aware nonthrowing context helper并覆盖view/performance/unload/visibility/SPA/vitals；只对known query key调用`sanitizeUrl`会保留未知one-time code且无本轮metric需要query，未选。风险是referrer/path attribution粒度下降和malformed URL omission。批准后final capture测全部writer、analytics disabled、malformed/opaque/relative referrer与safe field positive controls；回滚helper/callers/tests，无local data，已省略remote字段不可重建。

#### [F27-DIAG-002]

**状态**：已证实missing boundary，等待`sanitize-diagnostic-capture-and-export`；只确认synthetic arbitrary/credential-shaped values传播，不声称真实provider/user log含secret。**用户影响与复现**：startup/custom/error snapshot的raw href、apiKey customData、Error sentinel到mocked SW sink；console/Error与rejected-fetch Error到`getDiagnosticData`；unified message/apiKey/Authorization/Bearer/nested query URL/Error到memory logs；application Blob又包含environment URL/current error/component stack/diagnostics/unified sentinel。network request URL sentinel未进入diagnostics，证明已有`sanitizeUrl`正对照有效。

**当前/预期、根因、方案、风险、验证与回滚**：当前各sink使用不同partial/no sanitizer，final exports直接组合current/legacy state。预期capture前和final display/copy/export均经dedicated bounded/cycle-safe projection，保留type/category/status/timing/memory/count/bounded safe location，不保留declared credential/key/bearer/query/fragment/oversized/unsafe raw class。只修application exporter无法保护localStorage/SW IDB/SW Debug；全量后台wipe会扩张破坏性migration，均未选。风险是debug detail下降、legacy raw仍物理存在至cap/clear、key matching过宽；proposal明确domain source normalizer仍由benchmark/Suno changes拥有。批准后table测nested/array/cycle/oversize/key/value/URL/stack/malformed/safe data，再测SW storage/live、unified memory/IDB、current+legacy两类export/copy；回滚projection/callers/tests，不清store，未来safe write已省略数据不可恢复。

#### [F27-A11Y-003]

**状态**：已证实，等待`improve-performance-panel-accessibility`；证据强度为current source真实component DOM。**用户影响与复现**：在90% synthetic memory使panel可见并提供onCreateProject；DOM有4个button，但按`新建项目/刷新页面/常驻/关闭`role+name查询全为null；drag handle `tabIndex=-1`且无role。HoverTip visual content未成为button accessible name，键盘不能移动panel。

**根因、方案、替代、风险、验证与回滚**：icon button本身无aria-label，move是pointer-only div。preferred为existing button本地化name、pin pressed/create busy state，并把handle变semantic button，Arrow每次10 CSS px复用同clamp、保持focus；依赖HoverTip或给whole panel模糊draggable role均未选。风险是native button style、Arrow page scroll和screen-reader wording冗余。批准后测zh/en name/state、Tab/Enter/Space/Arrow、pointer parity、clamp/focus、visible/hidden和同状态截图；回滚markup/handler/scoped style/tests，无data。

#### [F27-STORE-004]

**状态**：已证实，等待`ensure-performance-panel-write-consistency`；证据强度为forced synchronous QuotaExceededError加唯一reader/writer反查。**用户影响与复现**：预存`pinned:true`，mock `Storage.setItem`抛错，点击pin；UI active class消失而localStorage仍true，refresh会恢复相反值且无错误反馈。同writer也被每个pointer move调用，因此position failure contract同样无outcome，但未把写频率直接宣称为性能瓶颈。

**根因、方案、替代、风险、验证与回滚**：writer在React updater中吞错并总return candidate，transient geometry和durability没有分层。preferred为last-durable snapshot；pin write成功后publish，失败保持旧state并safe retry guidance；drag中只更新transient、release最多一次commit，失败snap back并一次feedback。只toast仍假报saved，把key迁入global SettingsManager无reuse证据，均未选。风险是失败drag release回弹和active drag页面终止丢未提交位置；这是明确tradeoff而非性能宣称。批准后测missing/malformed、success/quota/security、pin/unpin、drag move/release/cancel、retry/refresh、write count/privacy；回滚state split/feedback/tests，key/schema无需migration。

#### [F27-PERF/VISUAL-005]

**状态**：无性能/视觉问题结论。四个diagnostic process的test time只用于复现可审计性，不是浏览器产品性能；没有同环境before/after 5次Web Vitals、render commit、main-thread、memory、bundle或panel interaction latency。PerformancePanel CSS和runtime均未改，没有before/after截图，故不宣称更快、更省内存、更小或更美。批准后如diagnostic sanitizer或drag-end write需要性能验收，至少记录5次safe/unsafe payload projection和同规模export latency/size、panel pointer latency；不能以代码形态替代测量。

#### [F27-REALDATA/E2E-006]

**状态**：未知/后续验证边界，不是产品缺陷。没有访问真实PostHog history、MemorySnapshotDB、aitu-unified-logs、用户download或provider failure sample，因此未知是否历史上存在真实credential；证明missing boundary不需要扩大到private data inspection。formal browser screen reader、responsive、dark/light、slow/error/recovery/export download矩阵尚未在实施前运行；此前Playwright环境有revision差异/定位器漂移。批准实施后使用synthetic local fixture重跑，不制造provider key或外部请求。

### 35.4 实际改动、验证、性能/视觉、规格、回滚与退出判断

**实际改动**：新增4个approval-only OpenSpec change，各含proposal/design/tasks/delta；新增`docs/evidence/f27-diagnostics-observability/diagnostics.md`和valid `metrics.json`；更新功能账本/矩阵。本轮没有修改runtime、test、CSS、analytics payload、diagnostic storage/export、PerformancePanel behavior、schema、cache、SW transport或用户数据。3个临时diagnostic test文件批次共使用后全部删除，当前保留0个。

**诊断与工具结果**：首次2条`pnpm exec vitest`均test collection前exit127（PATH无node），归环境失败。显式Node成功结果：Drawnix page/vitals wrapper+unified 1/1 file、3/3 tests、exit0、tests82ms/process2.09s；Web crash/export 1/1、3/3、exit0、37ms/1.92s；real analytics final capture 1/1、2/2、exit0、354ms/1.73s；PerformancePanel 1/1、2/2、exit0、170ms/12.57s。panel run stderr的ConfigWriter `indexedDB is not defined`、source map与Browserslist均不参与断言，归environment/tool noise。四个OpenSpec strict各exit127；人工检查4个change均有4个required files、delta headings、1个全仓唯一requirement，scenarios 4/5/4/5，tasks 4/12、4/15、4/13、4/13；metrics JSON parse exit0。没有runtime code change，故不重复F-26刚完成的full typecheck/test/cycles/build/size；它们不能替代审批后实现验证。

**性能与视觉**：未改产品且无before/after，performance/visual结论为none。测试process时间不能外推页面；没有截图变化。后续验收阈值和安全字段保留/剔除写在各design/spec中。

**规格/文档漂移与冲突**：`posthog-analytics.ts`注释声称all event data sanitized，但final sink测试证明URL-valued ordinary strings可保留query；这是一项implementation/security-contract漂移，审批后应同步注释/测试。Crash logger注释称用于SW debug export但没有final privacy boundary；SW Debug有两套直接export writer，旧`error-log-exporter.ts`头注释称聚合“崩溃历史”但实际只含crashRecovery state、current in-memory diagnostics/unified logs，不读取`MemorySnapshotDB`历史。通用 change不重复benchmark/Suno source normalization，startup change不接管payload，SW duplex不接管snapshot content，HoverTip change不替代button names。

**回滚与退出判断**：调查回滚为删除4个change、F-27 evidence与本节/矩阵行，无runtime/data影响。无Git metadata，不能声称可由Git自动恢复，但新增文件均有明确路径且无用户数据。F-27当前为**事实建模完成、实施与完整验证明确阻塞，未达到退出标准**：ANALYTICS/DIAG/A11Y/STORE四项等待用户审批；REALDATA无需读取而保持unknown边界；PERF/VISUAL无结论。批准后建议按page analytics（最小独立remote sink）→diagnostic shared utility/capture/final sinks→panel a11y→panel write semantics逐项先红后绿并各自复审；没有审批时继续下一个不依赖这些语义的功能调查。

## 36. F-28 响应式、无障碍与视觉一致性循环（移动画布壳子循环）

### 36.1 用户场景、边界、规格与验收门禁

**用户场景**：用户在桌面、平板或移动视口打开空画布，看到统一工具栏和底部主 AI 输入栏；移动端可展开/收起工具栏并以触控操作工具和输入控件，两个固定表面不会互相遮挡。responsive Playwright 是该路径当前截图、几何和触控回归门。

**范围与非范围**：本子循环范围为 `responsive-visual.spec.ts` 的主输入身份、7个现有视口、unified toolbar collapsed/expanded responsive rule、primary `AIInputBar` compact geometry、safe-area、stacking、overlap与touch sampling。AI提交/模型/附件语义归F-07；toolbar action/keyboard归F-26及各自a11y change；Chat composer仅作为locator反向负例；全局z-index重构、主题重设、新移动导航、其他工具窗口/Drawer响应式均不在本change。F-28仍是所有功能的横向验收门，本节不把尚未审计的全局键盘/屏幕阅读器/深浅主题矩阵标记完成。

**规格与活动 change**：正式spec没有 unified toolbar 与 primary AI input 的mobile clearance contract。`update-ui-color-system`只拥有色彩；`improve-ai-input-control-accessibility`只拥有input/attachment button名称和preview-local focus/coarse-pointer target，不移动两个fixed surfaces；`improve-settings-toolbar-accessibility`拥有app menu/More/switch键盘语义及menu-local compact目标，不移动本节两个fixed surfaces；canvas/tool-window responsive changes拥有其他组件。新增 `fix-mobile-toolbar-input-overlap` 5/17、1 requirement/5 scenarios，独占 `responsive-canvas-shell` capability。`openspec validate ... --strict` exit127（CLI不存在）；人工检查4个required files、scenario WHEN/THEN、全仓唯一requirement和active owner通过，不能声称strict成功。

**本轮验收**：无行为测试定位器修复必须通过E2E TypeScript/lint并令responsive test达到真实断言；不得更改产品DOM、截图、阈值、timeout或CSS。mobile layout为用户可观察变化，审批前只允许证据/提案。批准后至少三种mobile视口、collapsed/expanded、input各现有高度状态、orientation/non-zero safe-area、hit target、light/dark、zh/en、100%/high-DPI及7视口同状态截图；full gates对照基线。任何性能结论至少5次前后样本；当前无性能改动/结论。

### 36.2 正向/反向调用链与不变量

1. **测试入口**：`responsive-visual.spec.ts:61-177`逐个set viewport→`goto('/')`→`waitForPageReady :31-38`等待`.drawnix`/`.unified-toolbar`→visible与7张snapshot；`:184-207`验证mobile collapsed→expand；`:212-235`读取toolbar/input bounding boxes并求交集；`:264-282`抽样前10个toolbar/primary-input buttons。
2. **主输入身份反查**：`AIInputBar.tsx:4802-4809`同时写视觉class和唯一`data-testid=ai-input-bar`；`EnhancedChatInput.tsx:43,490`导入同scss并只复用`.ai-input-bar`视觉class。故`.ai-input-bar`有至少2 writers，test id只有primary writer；页面对象/其他smoke已经使用同一id。
3. **几何writer**：toolbar `index.scss:181-201` fixed、`z=$z-side-drawer+1=4031`；tablet/mobile `:336-377` bottom依次safe-area+70/+80、宽38/max-height。input `ai-input-bar.scss:50-64` fixed、`z=$z-canvas-internal=100`；`:1611-1650` tablet/mobile bottom、width/left，`:1777-1787`小屏bottom 6与padding。浏览器media-query/viewport owns responsive state；component owns collapse，但本轮未持久新layout。
4. **375×667反向几何**：toolbar `x8,y457,w38,h130,bottom587,bottomCSS80,z4031`；input `x8,y579,w359,h82,bottom661,bottomCSS6,z100`；intersection `x8..46,y579..587=38×8=304`。最终可见遮挡只有上述两个fixed writers；desktop/tablet四个负对照均0。
5. **边界/恢复/隐私**：CSS layout路径无network/IDB/Cache/local/session/SW/analytics/migration副作用，也无task retry/cancel/offline queue。page load失败归startup；safe-area physical iOS/Android、高度扩展、orientation是批准后验证状态。保持AI input full-width、toolbar action/order/scroll/collapse/z-index、desktop/tablet geometry、storage/API和user data不变。

### 36.3 证据问题表

#### [F28-TEST-001]

**状态**：已证实工具测试缺陷，已作无产品行为修复。**用户场景/复现/证据**：运行responsive file；修前`.ai-input-bar`同时匹配primary与Chat composer，8/11在strict locator precondition失败、只3/11进入断言。source反查证明primary已有唯一test id；替换后首轮10/11，所有7截图、toolbar、view-navigation、touch通过，唯一失败成为真实304几何断言。

**当前/预期、根因、方案、风险、验证/回滚**：当前test把共享视觉class误当component identity；预期稳定命中primary并执行原断言。根因为Chat composer合法复用了class后测试契约漂移。已只把8处primary locator及touch selector改为existing `data-testid`，未新增production marker；新增生产id的替代方案没有必要。风险是未来删除id会显式失败。E2E TS exit0；focused ESLint exit0/0 errors/8 existing warnings；responsive证据见36.4。回滚只恢复`responsive-visual.spec.ts` selector，无runtime/data。

#### [F28-LAYOUT-002]

**状态**：已证实视觉/交互缺陷，等待 `fix-mobile-toolbar-input-overlap` 审批。**用户影响/复现**：在640×360、375×667、360×640加载canvas并比较rect，交叠分别38×12=456、38×8=304、38×8=304 CSS px²；toolbar因4031在input100上方。截图直接显示左下media toolbar压住input上缘，existing assertion expected `<100` received304；1920×1080/1280×720/1024×768/768×1024均0。

**附件状态补充**：后续F-07应用内Chromium在390×844粘贴两张1×1合成图，primary input为`x8,y416.4375,w374,h421.5625`，first preview为`x26,y652,w36,h36`；before截图显示同一collapsed toolbar盖住第一张preview左侧/控制区。该run未单独记录toolbar rect，因此不声称新的精确intersection area；它确认proposal/design原已列出的attachment-preview状态和同一fixed-surface root，不新增owner或附件语义。

**根因/方案/替代/风险/验证/回滚**：mobile toolbar固定只留80px，而375 input从bottom6起高82，二者在同一x=8范围；不是仅shadow/z-index。preferred为safe-area-aware shared mobile clearance并在short landscape收缩toolbar available height、保留inner scroll；lower z-index只交换被遮挡面，横移/缩窄full-width input改变现布局，放宽threshold/更新snapshot掩盖缺陷，均未选。风险是640×360 toolbar vertical availability与dynamic input height；批准后先加3视口geometry/hit-target红测，再覆盖collapse/expand/focus/long text/attachment/orientation/safe-area/themes/locales。回滚scoped CSS/tests/snapshots，无schema/cache/task/user data。

#### [F28-VISUAL-003]

**状态**：待验证测试稳定性假设，未修改。**证据**：新鲜full responsive run中640×360 screenshot一次为25,891 pixels/12% diff（per-test limit10%），收到的inspiration card内容/资产与expected不同；同server/browser/source立即对该test repeat 2次，2/2通过。当前只能确认0/1后2/2的非确定结果，不能确定是fixture、asset load、SW/cache或其他writer。

**候选验证/风险/回滚**：至少5次隔离run记录card data writer、image response/cache source与ready时序，再决定是否固定fixture；在证据前不隐藏board、不提高ratio、不更新snapshot。误修会删除真实视觉覆盖。当前无改动，故无回滚。

### 36.4 实际改动、命令、性能/视觉、文档、回滚与退出判断

**实际改动**：production/runtime/CSS为0。`responsive-visual.spec.ts:70,88,107,122,141,156,171,217`改用existing `getByTestId('ai-input-bar')`，`:270-272`限制touch sample到primary id；新增F-28 evidence的`diagnostics.md`、valid `metrics.json`、375×667 before PNG；新增approval-only `fix-mobile-toolbar-input-overlap` proposal/design/tasks/delta；更新账本/矩阵。没有改snapshot、threshold、timeout、DOM、storage、cache、SW或用户数据。

**命令与分类**：`pnpm exec tsc -p apps/web-e2e/tsconfig.json --noEmit` exit0；`pnpm exec eslint apps/web-e2e/src/visual/responsive-visual.spec.ts` exit0、0 errors/8 existing warnings。第一次精确Playwright命令在config webServer启动前因controlled PATH无`npx` exit1/inner127，0 tests，归environment。显式`pnpm exec nx serve web`后执行`pnpm exec playwright test --config ... responsive-visual.spec.ts --project=responsive --workers=1 --reporter=line` exit1，9/11、约1m：稳定304 geometry失败；640 screenshot单次12% diff。紧接`--grep='移动端横屏布局' --repeat-each=2` exit0、2/2、11.0s。更早同revision单worker首轮10/11，唯一304 failure。临时Chromium 1200→1228 symlink已删除、Vite session exit130/Ctrl-C；Browserslist/Sass/public path与pnpm credential-setting-name warning归tool/config noise，未读取`.npmrc`或secret。

**仓库宽门禁**：full `pnpm typecheck` exit0、5/5 projects；`pnpm check:cycles` exit0、0 runtime cycles。`nx run-many -t=test --skip-nx-cache` exit1：react-board 1/1 files、8/8 tests；Drawnix 189 files=184 pass/4 fail/1 skip，1165 tests=1161 pass/3 fail/1 skip，四簇仍为cached image、GPT Blob、Sora duration、PPT mock，与F-25/F-26基线相同且无F-28新增。`pnpm build:web` exit0，7931 modules、app1m31s、SW1.48s；构建后version/index/sw恢复到build前hash。`pnpm size` exit1，AI Chat844.43/140kB为唯一failure，其余预算同baseline；`pnpm verify:startup` exit0。full `pnpm lint` exit1并确认继续扫描package `node_modules`，输出约474k tokens被截断，归已知配置失真；不把third-party命中计业务问题，edited-file lint才是本改动有效门。

**性能与视觉**：selector repair不改变runtime，未做/不需要性能before-after；geometry每viewport仅1样本，不是performance sample。产品视觉未改，故只有before screenshot，无after，不宣称更快/更美。F-07又补一张390×844 attachment-preview before screenshot和input/preview rect，仍无after或toolbar exact rect。批准后必须补same viewport/data/theme before-after和3种mobile交叠面积/可点击边界；性能若无runtime cost claim仍不虚构指标。

**规格/文档与回滚**：source comments称mobile toolbar bottom留“更多空间给AI输入栏”、input称toolbar不会遮挡；实际三mobile rect与注释冲突，以browser geometry为准，proposal要求实施时同步注释。OpenSpec strict exit127，manual structure/scenario/unique requirement/ownership通过。调查回滚为删除F-28 evidence/change/本节矩阵行；test fix回滚为恢复上述selectors；PNG与新增文本路径明确，但无Git metadata，不能声称Git自动恢复或worktree clean。

**退出判断**：本移动画布壳子循环为**事实建模完成、测试定位器修复已验证、runtime实施明确阻塞，未达到退出标准**。P2 layout已确认且尚未修；expanded/input-state/safe-area/physical touch/light-dark/zh-en尚未完成；VISUAL-003根因待验证；全F-28还包含各功能未批准a11y/响应式change。若用户批准，仅实施 `fix-mobile-toolbar-input-overlap` 的scoped geometry；未批准时可继续F-28其他只读矩阵或转下一个不依赖行为变更的功能。

## 37. F-11 工作流 Chat/WorkZone 状态界面子循环

### 37.1 用户场景、范围、规格与验收门禁

**用户场景**：用户提交既有工作流后，在 Chat workflow bubble 与画布 WorkZone 读取pending/running/completed/failed步骤、进度、Agent tool-call/result详情、失败与重试；用键盘/屏幕阅读器/触控操作既有详情和动作，并在现有中英文切换后看到同一应用语言。

**范围与非范围**：范围仅为`WorkflowMessageBubble`的step/Agent disclosure、status/progress/summary/retry/result copy与compact header，以及注册路径`withWorkZone→WorkZoneComponent→ToolProviderWrapper→WorkZoneContent`的progress/action/failure/copy/target/contrast。工作流解析/执行/dynamic steps、task event projection、cancel/retry outcome、refresh recovery、Chat session/composer/drawer shell、task drawer、storage/cache/provider/board schema、global palette与新增dark mode不在本UI change。`fix-main-thread-workflow-recovery-sync`继续独占恢复/同步语义。

**规格与审批**：正式spec没有该interface contract。新增`improve-workflow-status-interface-accessibility`，5 requirements/11 scenarios、tasks 7/28，独占`workflow-status-interface-accessibility` capability；proposal/design明确不翻译workflow/user/provider数据、不把raw error/prompt/tool payload放入name/live region、不新增storage owner。OpenSpec CLI exit127；人工确认4个required files、四级Scenario、11组WHEN/THEN、5个全仓唯一requirement、1个active owner。所有可观察实现等待用户审批。

**本轮验收**：审批前允许事实/提案/文档和无行为dead cleanup；不允许补ARIA/live/i18n/CSS/contrast。不可达删除必须通过正反向import/export/registry/public export证明、现有Chat/WorkZone测试、Drawnix/full typecheck、cycles、production build，并与full-test/size baseline逐项对照。性能和视觉没有实现前不允许宣称改善。

### 37.2 正向/反向调用链与不变量

1. **Chat**：`drawnix.tsx:870-938`外层I18n/Chat provider→`ChatDrawer`的`workflowMessages Map/ref`→`ChatMessagesArea:93-117`按marker取record→`WorkflowMessageBubble:371-559`normalize/derive→`:572-805`header/progress/step/log/result/retry DOM。反向为用户action→bubble callback→ChatDrawer handler→chat storage/localForage`aitu-chat/messages`或retry/reply链→task/workflow event→Map更新→同bubble。UI proposal不改变任何writer/schema/status rule。
2. **WorkZone**：AIInputBar非图片提交→`WorkZoneTransforms.insertWorkZone`→board child→`drawnix.tsx:761`注册`withWorkZone`→`WorkZoneComponent.renderContent :216-235`的separate `createRoot`→`ToolProviderWrapper`→`WorkZoneContent`。反向hide/delete/retry/state callbacks由`with-workzone.ts:225-232,251-258`提供，再写visibility/board/workflow并rerender。独立root的`ToolProviderWrapper:38-51`新建default-zh I18nProvider，不能继承外root context。
3. **状态/副作用/隐私**：Chat normalized steps拥有display status/count；step/Agent只拥有local expanded。WorkZone从steps derive status/count并拥有retrying/confirm；task/store/board owner不迁入UI。当前visual bars只写CSS width；所有实测使用synthetic data、0 provider/network/telemetry/user-storage read。proposal的announcement只允许generic localized status+numeric count。
4. **恢复/离线/竞态边界**：刷新后的Chat/board record与task snapshot收敛由recovery change处理；本UI只render input。offline不新增行为。重复task event若导致相同render，UI proposal要求不重复announce但不负责upstream dedupe。retry callback调用/错误/取消保持原样。
5. **主题/motion边界**：`apps/web/src/styles.scss:100-109`明确forced light，故dark缺失是候选新能力而非defect；`:267-272`全局reduced-motion将animation缩到0.01ms/1次，spinner/pulse缺component media query为非问题。

### 37.3 证据问题表

#### [WORKFLOW-UI-KEYBOARD-001]

**状态**：已证实，等待UI change审批。真实组件中step disclosure与两个Agent disclosure均为`DIV`、无role、`tabIndex=-1`，共0个focusable；Enter不展开而pointer click展开。源码`WorkflowMessageBubble:129-163,255-329`只有`onClick`。用户无法用键盘查看参数/result/error/duration或tool payload。根因是视觉row被当button；preferred为existing `expanded`唯一owner的native/equivalent disclosure，拒绝document key listener。风险为nested interaction/double activation/default style；测role/name/expanded/focus、Enter/Space/pointer exactly once与non-detail negative；回滚markup/tests，无data。

#### [WORKFLOW-UI-PROGRESS-002]

**状态**：已证实，等待审批。Chat `:592-610`与WorkZone `:384-401`只有width/text，真实component均progressbar 0/live 0。用户的assistive surface不知道determinate progress或终态。preferred为同normalized count的0/partial/100 progressbar和bounded polite generic lifecycle，不能给whole bubble/card加live以免raw result/error/prompt泄露或噪声。风险为两surface/重复event重复announce；测unchanged rerender=0 new announcement与privacy sentinel；回滚semantics node/tests。

#### [WORKFLOW-UI-I18N-003]

**状态**：已证实，等待审批。English Provider下Chat仍有`执行中`2次、`待执行`1次，WorkZone仍有中文failure/retry；两component大量application literal，且separate root默认zh。preferred为focused workflow label map与existing i18n owner的cleanup-safe independent-root subscription，不新建WorkZone preference/board field；workflow name/prompt/step/tool/result/error不翻译。风险为listener leak与string inventory；测zh/en initial/switch/create-destroy/byte-preserving sentinel；回滚label/subscription，无migration。

#### [WORKFLOW-UI-TOUCH-004 / COMPACT-005]

**状态**：已证实geometry/visual defects，等待审批。390×844时Chat 348px且自身overflow0，WorkZone 360×280；hide/delete/retry为24×24、24×24、115×26.5，低于既有compact 44×44 convention。320×568时Chat 270px/overflow0，但long title 130×84约4行，`执行中`28×58三字逐行，status-info 66×58。root cause分别为fixed action size与compact breakpoint只改bubble width/gap，header没有title clamp/status non-shrink。preferred为compact/pointer-coarse hit box和two-line title/one-line status/count；不hide status/action、不放大glyph。风险为fixed card/English crowding；测320/390/desktop、zh/en、failed/retry/confirm、overflow/hit/one callback；回滚scoped CSS。

#### [WORKFLOW-UI-CONTRAST-006]

**状态**：已证实forced-light两项small-normal-text缺陷，等待审批。computed ratio：Chat title12.63、step title5.74、Agent title5.74、WorkZone title14.68通过；Chat step status1.90与11px WorkZone failed step4.41低于4.5。只对这两项使用existing safe token/scoped value；不接管global palette/dark。风险为state差异减弱；测所有state actual background、text/icon redundant cue与同状态截图；回滚两处color。

#### [WORKFLOW-ELEMENT-DEAD-007]

**状态**：已证实并完成无行为清理。清理前`WorkZoneElement.tsx:1-88`及directory barrel是`WorkZoneElement/create/updateForeignObject`全仓唯一命中；0 importer/JSX/registry/root/runtime export。`package.json:30-41`只export`.`/`./runtime`，`src/index.ts`不export目录；真实renderer是上述plugin path且传入完整callbacks。已删除88行file和1行孤立export，保留`WorkZoneContent`。不宣称bundle/performance gain。风险仅未声明external deep-source consumer，但package exports排除；删除后exact source symbols 0、build/typecheck/tests通过。回滚需以patch重加89行；无Git metadata，不能声称`git revert`，无data/cache恢复。

### 37.4 实际改动、命令、性能/视觉、文档、回滚与退出判断

**实际改动**：runtime仅删除不可达`components/workzone-element/WorkZoneElement.tsx`与barrel export；没有改registered renderer、DOM、ARIA、i18n、CSS、status/retry/storage/cache/board/provider。新增approval-only change四文件、F-11 diagnostics/valid metrics/two before screenshots，更新F-11/F-28 ledger与cross-feature matrix。临时test/harness 4路径已删、Browser viewport reset/tab finalize、Vite stop、7200无listen。

**定向/静态验证**：ambient shell首次Vitest/Nx/eslint/JSON均因PATH无node在启动前exit127，归environment；显式workspace Node后focused Chat/WorkZone exit0，3/3 files、11/11 tests、4.40s；edited index ESLint exit0；Drawnix typecheck exit0；metrics JSON parse exit0；deleted exact symbols 0，temp paths 0。真实组件diagnostic本身exit0，1/1 file、2/2 current-behavior tests；用后已删。

**宽门禁**：full no-cache typecheck exit0、5/5；cycles exit0。full Drawnix Vitest exit1：189 files=184 pass/4 fail/1 skip，1165 tests=1161 pass/3 fail/1 skip；四簇cached-image/GPT Blob/Sora duration/PPT mock与F-28前基线完全相同，F-11无新增。preceding Nx full-test因child PATH无node导致Drawnix 0 tests/environment exit127，但React Board 1/1、8/8；不把该run混入产品统计。`nx build web --skip-nx-cache` exit0，app7931 modules/2m57s、SW54/1.30s；为避免timestamp source mutation未调用`update-version.js`。size exit1：AI Chat844.43/140kB唯一failure，Diagram934.93/950、Editor858.24/870等同baseline；startup verify exit0。full lint未重复已知node_modules扫描，changed-file lint是有效门。formal E2E未为unreachable file重跑，approval后UI实现必须跑。

**性能/视觉**：删除文件未进入bundle，不能声称更小/更快；无性能before-after。用户可见UI未改，故只有forced-light English before screenshots，无after、不宣称更美。geometry每viewport一次，不是performance sample。proposal已写明批准后同数据/viewport/theme/DPR before-after、contrast/overflow/44px验收。

**规格/文档与冲突**：该 F-11 UI capability仍为single owner；当前全局文件快照为104 active changes、10 complete/82 partial/12 zero、75含approval gate、18组capability overlap。与recovery change按input state versus render contract分界，与task drawer按surface分界，与global color按scoped measured text分界。CLI strict exit127，manual validation不能冒充strict success。

**回滚与退出判断**：dead cleanup回滚为patch恢复prior 88-line file+1 export；调查回滚为删除UI change、F-11 evidence/本节/matrix行；两者无migration/user data。F-11当前为**状态界面事实建模完成、一个dead cleanup验证完成、两项runtime实施明确阻塞，未达到功能退出标准**：recovery/sync六项与UI六项分别等待`fix-main-thread-workflow-recovery-sync`和`improve-workflow-status-interface-accessibility`审批；批准前不实施。F-28下一只读子循环转F-12 Chat Drawer shell/普通消息，因为F-11只覆盖workflow bubble而未覆盖session/composer/stream/error drawer interaction。

## 38. F-01 启动恢复与版本升级界面子循环

### 38.1 功能、用户场景、范围、规格、基线与门禁

**用户场景**：用户在首次/刷新启动、React 初始化或渲染失败、预 React 资源失败，以及 staged Service Worker 版本就绪时，能够理解当前状态，使用既有恢复入口，或在无活动任务时显式确认升级。

**范围**：`apps/web/index.html` boot shell/terminal error；`App → ErrorFallbackUI`；`bootstrap.tsx` staged-version readiness/confirmation；Drawnix 延迟挂载的 `VersionUpdatePrompt`；焦点、语义、zh/en application copy、任务隐藏门和无持久化的一页生命周期。**非范围**：启动 chunk/挂载性能语义（`refactor-startup-shell-loading`）、诊断内容清洗/导出（`sanitize-diagnostic-capture-and-export`）、SW cache/version storage/worker routing、`COMMIT_UPGRADE` 与 reload 语义、F-26 语言持久化、暗色新能力及未经浏览器证明的 compact overflow。

**规格与活动 change**：正式 startup specs 描述安全静态加载和 CDN fallback，但没有 deferred-consumer replay、HTML/React recovery accessibility 或 version-update interface contract。新增三个独立 approval-only owner：`fix-version-update-notification-delivery`（2 requirements/6 scenarios）、`improve-startup-recovery-interface-accessibility`（5/11）和`improve-version-update-interface-accessibility`（4/8）。OpenSpec CLI 缺失，三次 strict 均 exit127；只完成人工四文件、四级 Scenario、WHEN/THEN、11 个全仓唯一 requirement 和单 owner 核查，不能声称 strict 通过。

**已知基线与验收**：现有 App recovery/persistence 2/2、app-shell/CDN 20/20 通过；三个受控 component diagnostics 共4/4 assertions通过。审批后才允许补红测试并实现；验收必须覆盖 early/late/replace/clear/dedupe、active-task guard、显式确认一次、HTML与React错误、focus/disclosure/progress、zh/en live switch、modal/Escape/return focus、320/390/768/1280、reduced motion、refresh/offline/multi-tab，以及 typecheck/cycles/build/size/startup/E2E。任何性能或视觉改善均须有同环境至少5次前后样本或同状态截图。本子循环审批前不改用户可观察行为。

### 38.2 完整正向/反向调用链、状态、边界与不变量

1. **HTML terminal recovery**：导航→`index.html:1427-1463` 的 resource/error/rejection handler→`markError :1167-1182`→boot title/tip/progress DOM。反向从唯一 boot error surface 找回上述 handler；当前 surface 只有官网 link，`index.html:515-555`没有 reload/safe/debug action。输入为浏览器 ErrorEvent/PromiseRejection/resource target；输出为 DOM state。owner 是`window.__OPENTU_BOOT__`，不写应用数据；正常`markReady`仍移除 shell。
2. **React recovery**：`main.tsx`动态 bootstrap→`bootstrap.tsx` root→`App` workspace initialize/render→`app.tsx:931-958`或`ErrorBoundary.tsx:56-85`→`ErrorFallbackUI :170-365`→reload/safe/debug/log action→`crashRecoveryService`/当前 URL/download。状态 owner 是 App/ErrorBoundary 与组件本地`showDetail`；memory、stack、error 为显示输入。恢复动作可导航/下载，但诊断 payload 边界归F-27。
3. **版本就绪与提示**：SW install/prewarm/version state→`bootstrap.tsx:525-542 requestSWVersionState`→native `SW_VERSION_STATE :689-693`或duplex callback`:591-600`→`notifyUpdateReady :363-373`→一次`sw-update-available`→`version-update-prompt.tsx:15-73` listener→同源`version.json`验证/回退→local `updateAvailable/showChangelog`→notice/dialog。用户确认→`user-confirmed-upgrade :75-81`→`bootstrap.tsx:703-725`查waiting worker并发`COMMIT_UPGRADE`→activate/controllerchange→safe reload。
4. **反向与生命周期**：visible prompt←local state←唯一`handleUpdateAvailable`←唯一 production producer。bootstrap 用`lastPendingVersionNotified :358-388`对同版本去重；Drawnix 在`drawnix.tsx:677-701`至少延迟5秒并等idle/fallback后才挂`DrawnixDeferredFeatures.tsx:167-170`消费者。当前没有snapshot/replay/storage/ready handshake。active tasks 只控制提示可见性；版本提示状态不持久化。副作用仅同源`version.json` fetch、CustomEvent、用户确认后的worker message/reload。保持任务保护、release data字节、cache key、SW协议、取消/重试/离线与多标签页现有语义不变。

完整详细证据、原始诊断值、替代方案和回滚见`docs/evidence/f01-startup-recovery-ui/diagnostics.md`与`metrics.json`。

### 38.3 问题证据、方案、风险、验证与回滚

#### [STARTUP-UPDATE-003]

**状态**：已证实 correctness defect，等待`fix-version-update-notification-delivery`审批。**用户影响/复现/当前与预期**：在唯一消费者挂载前派发版本2.0.0，受控结果`promptVisible=false/fetchCalls=0`；挂载后同事件为`true/1`。当前一次性事件丢失且producer同版本去重；既有流程预期 readiness 最终到达提示，而不依赖 deferred mount 竞态。**证据/调用链/根因**：`bootstrap.tsx:358-388,363-373,525-542`→CustomEvent→`drawnix.tsx:677-701`延迟→`DrawnixDeferredFeatures.tsx:167-170`→`version-update-prompt.tsx:15-73`；正反向搜索只有一个production producer/consumer且无replay owner。影响 staged update 的 early-ready 路径，证据为源码生命周期证明+受控早/晚对照。根因是 ephemeral event 跨 deferred boundary。

**方案/替代/风险/验证/回滚**：preferred 为 bootstrap page-local typed pending-version snapshot/handshake，publish-before-dispatch、mount对账、runtime state负责replace/clear，不跨reload持久化；替代“提前挂载prompt”会破坏启动延迟边界且仍不形成正式交付契约。风险为stale/duplicate/wrong worker；验证early/late parity、same-version dedupe、replace/clear、task guard、missing worker、one confirm/commit、natural activation、refresh/multi-tab。回滚删除snapshot/handshake及测试，恢复event-only；无storage/cache/data清理。

#### [STARTUP-RECOVERY-A11Y-004]

**状态**：已证实 accessibility/interaction defect，等待`improve-startup-recovery-interface-accessibility`审批。**用户影响/复现/当前与预期**：初始化错误 fixture 下 dialog/alertdialog/alert/progressbar均0，初始焦点为body；detail 展开前后`aria-expanded/aria-controls`均null，但视觉detail出现。当前阻塞恢复面是generic DOM；预期一个命名阻塞恢复region、确定初始焦点、显式disclosure与bounded memory value，同时保留全部callback。**证据/调用链/根因**：`app.tsx:931-958`/`ErrorBoundary.tsx:56-85`→`ErrorFallbackUI :170-365`，其中`:233-249`只切可见性，`:321-365`只改bar width。影响React初始化/渲染/crash恢复；证据为完整caller/sink trace+真实组件受控渲染。根因是视觉modal/control/state没有程序化契约。

**方案/替代/风险/验证/回滚**：preferred 为named alertdialog、安全action初始focus、disclosure关系和bounded progress semantics，并覆盖compact/reduced-motion/inline-style fallback；仅加`role=alert`不能解决region name/focus/disclosure。风险为focus steal或误触，测试只聚焦不自动执行；覆盖crash/init/render/chunk、callbacks exactly once、long stack、320/390/768/1280、keyboard/zoom/motion。回滚局部semantic/focus/style/tests；无数据迁移。

#### [STARTUP-UPDATE-UI-005]

**状态**：已证实 localization/status/modal defect，等待`improve-version-update-interface-accessibility`审批。**用户影响/复现/当前与预期**：English `I18nProvider` 下仍为“新版本 v2.0.0 已就绪/查看更新内容/立即更新”；status/alert 0，打开changelog后dialog与`aria-modal`均0。预期application copy跟随当前语言、一次bounded status、named modal/focus/Escape/return-focus，release version/changelog不翻译。**证据/调用链/根因**：`version-update-prompt.tsx:6,13,90-134`导入但未使用i18n并硬编码文案/无status/modal contract；组件位于`drawnix.tsx:869-938`的provider内。影响所有English update session及assistive users；证据为source owner+English controlled render。根因是现有i18n owner被绕过且第三方visual dialog props未产生项目所需语义。

**方案/替代/风险/验证/回滚**：preferred 为existing typed zh/en keys、仅短ready句polite status、project-owned accessible modal contract；不用`navigator.language`且不翻译release data。风险为重复announcement、focus trap regression、误改release内容；验证zh/en live switch、status count、dialog name/modal/focus/Escape/return、sentinel byte preservation、confirmation once、task hiding、compact/long text。回滚scoped keys/semantics/adapter/style/tests；不改event/commit/storage。

#### [STARTUP-BOOT-RECOVERY-006]

**状态**：已证实 UX/recovery gap，等待`improve-startup-recovery-interface-accessibility`审批。**用户影响/复现/当前与预期**：pre-React resource/script/rejection失败调用`markError`后进度被设100%，polite status仍表现为加载完成；文案要求刷新重试，但应用surface只有官网link，没有对应retry/safe/debug action。预期terminal error announcement、隐藏/移除完成进度语义，并直接提供现有retry/safe/debug routes。**证据/调用链/根因**：`index.html:1427-1463`→`markError :1167-1182`→markup`:515-555`；静态链唯一且不需要产品数据。影响React前启动失败，浏览器chrome reload仍可用，故不记total lockout。根因是boot controller复用progress terminal state而恢复动作只存在React fallback。

**方案/替代/风险/验证/回滚**：preferred 为assertive error、去除progress语义、保留当前URL的显式retry、独立safe/debug action并focus不激活；依赖browser chrome不能兑现现有界面恢复承诺。风险为reload loop/query丢失/隐式safe mode；synthetic DOM覆盖resource/error/rejection、one alert、URLs/actions、正常markReady。视觉主张仍需浏览器before/after。回滚HTML controller/markup/tests；除既有safe action key外无清理。

### 38.4 实际改动、验证、性能/视觉、规格、回滚与退出判断

**实际改动**：无生产TSX/SCSS/storage/cache/request/SW行为改动。只把`version-update-prompt.tsx:16,79`的owner注释从`main.tsx`同步为Web bootstrap；`docs/FEATURE_FLOWS.md:768-776`把升级owner与deferred event丢失边界同步到当前代码；`docs/CODING_RULES.md:1942-1946`把开发`FORCE_UPGRADE`和生产`requestSWVersionState → handleRuntimeVersionState/notifyUpdateReady`路径同步到当前实现。新增三项approval-only OpenSpec change与F-01 evidence，本节/账本/F-28 matrix登记事实。临时diagnostic tests均已删除。

**测试命令与结果**：existing App recovery/persistence exit0，2/2 files、2/2 tests、2.58s；existing app-shell/CDN exit0，2/2 files、20/20 tests、1.40s；账本更新后四文件合并复跑exit0、4/4 files、22/22 tests、2.20s。ErrorFallback diagnostic exit0，1/1、8.22s；update early/late diagnostic exit0，2/2、9.78s；update English/status/modal corrected evidence exit0，1/1、8.89s。首次探索预期dialog=1实际0而exit1，属于诊断断言校正，不是产品回归。focused ESLint exit0、0 errors/2 existing warnings；首次pnpm wrapper因child PATH无node在测试前exit127，归环境失败，随后用configured Node绝对路径复跑。stderr中的IndexedDB/ConfigWriter、Browserslist、第三方sourcemap与pnpm配置警告均未导致上述断言失败，分类为环境/工具噪声。没有读取`.npmrc`、凭据、browser storage或用户数据。

**性能与视觉**：无运行时实现，因此无before/after性能样本、无after screenshot，不宣称更快、更小或更美。320/390更新提示overflow仅为CSS假设；远程QR只证明第三方请求边界；二者均未升级为缺陷。App transient loading已有HTML boot semantic覆盖、ErrorFallback z-index高于boot shell、active-task隐藏prompt均登记为非问题/现有语义。

**规格/文档与冲突**：当前全局文件快照104 active、10 complete/82 partial/12 zero、75含approval gate、18组capability overlap；三个 F-01 capability均single owner。replay、recovery UI、update UI分别与startup loading、diagnostic privacy、F-26 language storage、SW commit/task guard分界。CLI strict exit127是工具阻塞。

**回滚**：由于无Git metadata，不能承诺`git revert`；以patch反向恢复两处注释、两份文档、本节/矩阵/evidence和三个change目录。没有数据、缓存、迁移或用户设置需要恢复。

**退出判断与下一功能**：F-01 的恢复/升级界面**事实建模完成但功能未达到退出标准**。`STARTUP-001`等待`refactor-startup-shell-loading`审批；本节四个问题等待三个独立change审批；批准前禁止实现。无审批依赖的下一只读循环为F-02项目树/菜单/创建重命名删除dialog的keyboard/name/focus/status/compact/theme事实建模；不得实施现有两个workspace data-transition changes。

## 39. F-02 项目树、菜单与工作区管理界面子循环

### 39.1 功能、用户场景、范围、规格、基线与门禁

**用户场景**：用户从命名的工具栏“项目”入口打开抽屉，搜索并识别当前画板和文件夹层级，通过 pointer 或键盘展开、切换、选择、重命名、复制、移动或删除，然后关闭并返回原入口；English session 使用当前应用语言。

**范围**：ProjectDrawer shell、boards tab、search/loading/empty/no-match、folder/board tree、More/右键菜单、inline rename、delete-confirm adjacency、focus/keyboard/state/name、F-02 safe application copy 和现有 resize 入口。**非范围**：WORKSPACE-002 删除后活动画板语义、WORKSPACE-003 持久化失败/部分成功、Board/Folder schema、URL/sessionStorage、GitHub sync、F-03 import/export、F-04 Layer content、F-25 Frame/PPT content、其他 SideDrawer/ContextMenu 默认行为、shared ConfirmDialog 22-caller modal audit、无证据的 compact CSS 或新增 dark mode。

**规格/change**：正式spec没有workspace manager interface contract；已有两个F-02 change只拥有数据转场/失败一致性。新增`improve-workspace-manager-interface-accessibility`，6 requirements/20 scenarios、tasks 5/31，独占`workspace-manager-interface-accessibility` capability。CLI strict exit127；人工确认proposal/design/tasks/单一delta、20组WHEN/THEN和6个全仓唯一requirement。所有用户可观察实现等待审批。

**基线/验收**：WORKSPACE-001既有3/3 files、27/27 tests复跑exit0；受控ProjectDrawer current-interface diagnostic最终1/1 exit0；1280×720 production DOM/focus/2张before截图。批准后验收必须保持pointer callback exactly once、workspace API/schema/storage不变，并覆盖named nonmodal region、trigger relationship、focus entry/return、nested Escape、tree states/roving/modifiers、menu/submenu、rename、loading/true-empty/no-match、zh/en/sentinel、keyboard resize、删除/刷新相邻路径。320/390必须取得新鲜同状态证据后才允许任何compact结论。

### 39.2 正向/反向调用链、状态和不变量

1. **入口/壳**：`bottom-actions-section.tsx:108-123` named ToolButton→`drawnix.tsx:457-472` `projectDrawerOpen`→`DrawnixDeferredFeatures.tsx:215-224`条件mount→`ProjectDrawer.tsx:1763-1821` BaseDrawer/tree state。反向visible drawer/trigger label分别来自open state；当前trigger open后仍focus、无expanded/controls，drawer root/close无name。
2. **树/动作**：`ProjectDrawerContent :547-856` folder/board row→delayed pointer click/drag/context/Dropdown/inline Input→handlers`:863-1011,1119-1392,1571-1589`→`useWorkspace.ts:136-378`→WorkspaceService/storage/App。反向current/expanded/selected来自`currentBoard/folder.isExpanded/selectedBoardIds`，当前只投影为CSS classes，不投影programmatic state。
3. **搜索/状态**：Input`:1674-1680`→`searchQuery`→recursive filter`:1592-1631`→`filteredTree.length===0 :1790-1798`。该sink没有检查unfiltered tree或non-empty query，故true-empty与no-match共用同一message/action。
4. **菜单/dialog**：row right-click→`useContextMenuState`→portal `ContextMenu.tsx:140-207`；Escape listener`:350-390`仅关闭，不负责focus entry/arrows/return。delete action→ProjectDrawer state→`ConfirmDialog.tsx:149-188`；受控正对照已有named dialog、Cancel initial focus和native actions，不改service callbacks。
5. **语言/副作用**：Drawnix I18nProvider→deferred ProjectDrawer，但ProjectDrawer无`useI18n`且shell/F-02 literals位于`:657-1008,1127-1181,1635-1890`。用户名称/ID、raw error、analytics、storage仍必须byte-preserved。本子循环没有调用workspace writer、import/export、provider或network。

详细原始值、截图、环境、完整问题方案与假设边界见`docs/evidence/f02-workspace/project-drawer-ui-diagnostics.md`及`project-drawer-ui-metrics.json`。

### 39.3 问题证据、决策、风险、验证与回滚

#### [WORKSPACE-UI-KEYBOARD-004]

**状态**：已证实，等待`improve-workspace-manager-interface-accessibility`审批。**用户影响/复现/当前与预期**：controlled current render中folder/board均DIV、role null、tabIndex -1、无expanded/current/selected；Enter toggle/switch=0/0，pointer=1/1。三个More为空名称；right-click menu五项但focus留body、ArrowDown不移动。Production drawer 380×720无role/name，trigger open后仍active，到首drawer control隔17 tab stops；current row37.765625px generic，More tabIndex0但opacity0，close无name，resize 8px generic/tabIndex-1。预期是named nonmodal region、确定entry/return、层级state与bounded roving keyboard、named focus-visible actions/menu和keyboard resize，全部调用现有handler exactly once。

**根因/方案/替代/风险/验证/回滚**：视觉class/pointer handlers承担全部state/activation，共享shell/menu没有ProjectDrawer opt-in focus contract。preferred为backward-compatible task-specific SideDrawer/ContextMenu props+roving tree+native separate action buttons；给每row加tabIndex0会制造unbounded tab chain且不补state/menu，拒绝。风险为nested double activation、Escape级联、async refresh focus loss、modifier drift、共享default回归；验证矩阵见39.1。回滚ProjectDrawer opt-in/semantics/handlers/styles/tests，不改data/storage。

#### [WORKSPACE-UI-SEARCH-005]

**状态**：已证实，等待同change审批。**用户影响/复现/当前与预期**：fixture有2个root item、production有默认画板时输入`no-such-workspace-item`，两者均显示“暂无画板/创建第一个画板”，无“未找到/无匹配”；截图已保存。预期no-match不宣称真实empty且不展示first-board action，真正空态保持现有创建入口。**调用链/根因**：`:1674-1680`→`:1592-1631`→`:1790-1798`只看filtered length。preferred以isLoading/tree.length/trimmed query/filtered length区分状态；只隐藏按钮仍保留false statement，拒绝。风险为blank/folder/nested match误分；测loading/blank/true empty/board/folder/nested/no-match。回滚branch/copy/tests，无data。

#### [WORKSPACE-UI-I18N-006]

**状态**：已证实，等待同change审批。**用户影响/复现/当前与预期**：English Provider下`项目/画布管理/新建画板`仍中文；当前文件无i18n consumer且F-02 action/message literals贯穿上述源码。预期safe application copy跟随existing language，用户board/folder/file/raw value byte-preserved。preferred新增typed zh/en keys并消费现owner；不用navigator language、不翻译数据。风险为F-03/F-04/F-25边界partial、raw errors/user data被翻译；测initial/live switch与sentinel。回滚keys/consumer/tests，无migration。

**假设/非问题**：ConfirmDialog已有named dialog/Cancel focus/native actions，`aria-modal=null`只登记shared 22-caller待审观察，不在F-02 opportunistic修改；desktop row/tab<44和16×16 disclosure缺compact/pointer-coarse实测，仍是假设；Browser binding无viewport resize，不能把desktop geometry冒充mobile；forced-light下没有dark结论。

### 39.4 实际改动、命令、性能/视觉、规格、回滚与退出判断

**实际改动**：无生产TSX/SCSS/service/storage行为改动。新增一个approval-only change、F-02 interface diagnostics/metrics和两张1280×720 before截图；更新账本/F-28 matrix。一次性component diagnostic经记录后删除；本地7392 server停止，Browser tab关闭。

**测试/校验**：diagnostic首次探索因3 actions与`aria-modal=null`校正exit1，最终exit0、1/1 file/test、12.21s；不是产品回归。workspace existing test command exit0、3/3 files、27/27 tests、1.55s。evidence JSON parse exit0；temp diagnostic paths 0；change人工validation为6 requirements/20 scenarios/20 WHEN/THEN/31 tasks/5 evidence done/6 names各1；CLI strict exit127。ConfigWriter indexedDB、Browserslist、sourcemap、Browser infrastructure telemetry timeout均是未使产品断言失败的环境/工具噪声。

**性能/视觉**：无runtime实现、无五次before/after，不宣称性能改善。两张before只证明正常与false-empty visual state；无after、不宣称更美。Browser精确版本unknown，1280×720/DPR1/loopback/无throttle/sample1；compact viewport因工具能力阻塞。

**冲突/回滚**：当前global snapshot104 active、10 complete/82 partial/12 zero、75 approval gates、18 overlap groups；新capability single owner。通过ProjectDrawer opt-in明确不改其他drawer/menu default。无Git metadata，回滚以patch删除change/evidence/本节/matrix；截图可删除，无数据/cache/migration恢复。

**退出判断/下一项**：F-02 **事实建模完成、WORKSPACE-001已验证、三项runtime实施阻塞，未达到功能退出标准**。`fix-workspace-current-deletion-transition`、`improve-workspace-operation-failure-consistency`与`improve-workspace-manager-interface-accessibility`分别等待审批。本段当时建议的F-03只读调查已执行，随后F-22内容也已建模；最新矩阵显示下一项为F-09 provider/model settings，仍不得越过任何pending data/runtime change。

## 40. 独立工具链循环：全仓 lint 扫描所有权

### 40.1 场景、范围、基线与审批判断

**场景**：维护者运行`pnpm lint`验证现有用户功能的代码改动，结果必须覆盖项目维护的源码/静态源码，同时不把安装依赖、构建产物或复制的压缩vendor bundle混入业务缺陷统计。

**范围与非范围**：范围为根lint脚本、Nx六项目target解析、ESLint ignore precedence、两个包内`node_modules`树和三个有生成/vendor证明的Web文件。非范围为修复剩余448个一方error、调整规则/severity、格式化源码、修改产品运行时、把`any`/console/规则命中直接定性为产品问题，或把所有`public/**`一刀切排除。

**进入基线**：六项目共3422 files、4255 errors、8614 warnings。React Board的1837文件中1824个来自`node_modules`，dependency贡献1144 errors/1965 warnings；React Text的284文件中275个来自`node_modules`，贡献1995/3380。Web三个已证明bundle贡献668/744。详细命令、路径样本、hash、边界表和原始统计见`docs/evidence/lint-toolchain/diagnostics.md`与`metrics.json`。

**OpenSpec**：不需要。只改变现有静态分析器读取的文件集合，不改变用户可观察行为、运行时、API、数据、存储、缓存、恢复、安全策略或架构。剩余命中若要触发产品修改，仍必须回到所属完整用户功能建立证据并重新过门禁。

### 40.2 [TOOL-LINT-SCOPE-001]

**状态**：已证实并已修复的工具链缺陷。**维护者/用户影响**：第三方和输出噪声占据全仓结果，使功能回归门无法可靠归因，间接降低保护用户功能的验证效率；没有把它记为直接产品运行时故障。

**复现、当前/预期、调用链与根因**：`package.json:27-30`的lint script→`nx.json:31-35` ESLint plugin/显式Web target→React Board、React Text与Web的`eslint .`→root `.eslintrc.json:3` ignore-all→child原先单独`!**/*`宽泛反向包含→ESLint处理依赖/生成/vendor并令Nx失败。预期同一规则覆盖全部原一方文件，只排除非项目所有权文件。根因是ignore-all/child opt-in约定与`eslint .`target组合后，child negation越过项目所有权边界；Web另缺少三个已证实输出/vendor的精确排除。

**证据闭环**：修复前后差值为2102 files、3807 errors、6089 warnings；它恰好等于React Board依赖1824 files/1144/1965 + React Text依赖275/1995/3380 + Web三个bundle 3/668/744。一方/项目文件数与命中不变。Web仍检查30个其他`public`文件，证明没有用宽泛排除隐藏维护源码。证据强度为配置调用链、文件owner静态证明、精确path复现、六项目before/after和全命令复跑。

**方案、替代、风险、验证与回滚**：最小修复是在`packages/react-board/.eslintrc.json:3`和`packages/react-text/.eslintrc.json:3`把`node_modules/**`置于反向包含之后；在`apps/web/.eslintrc.json:3-8`只排除`public/sw.js`、JSZip bundle和postmessage-duplex bundle。未选`eslint src`是因为会丢失维护的project/static source；未选`public/**`因为会隐藏30个仍受检文件；未选规则放宽或CLI-only flag因为不能修复owner。风险是未来某个精确Web路径转成手写source却仍被排除，靠精确列表和owner复审约束。回滚只反向删除五个ignore项；没有数据/cache/migration恢复，无Git metadata所以不能承诺`git revert`。

### 40.3 实际改动、命令、性能/视觉与退出复审

**实际改动**：只修改上述三份`.eslintrc.json`；新增两份永久证据并更新本账本。没有修改产品TS/TSX/JS/SCSS、测试断言、lint规则、构建脚本、依赖或OpenSpec。用于分类的临时formatter已经删除，目录中没有残留隐藏分析脚本。

**定向验证**：三份JSON parse exit0、`parsed=3`。`nx run react-board:lint --skip-nx-cache` exit0、13 files、0 errors/34 warnings；React Text exit0、9 files、0/26；Web exit1、63 files、54/162。直接六项目汇总为1320 files、448/2525，所有post-fix边界都没有`node_modules`；Web三个exact path用`--no-ignore`对照仍精确复现3 files、668/744。

**全仓门禁**：`pnpm lint --skip-nx-cache --output-style=static` exit1、输出3763行；失败保持448个项目/静态源码error，不报告通过，也不逐命中定性。`pnpm typecheck --skip-nx-cache --output-style=static` exit0、5/5 projects；`pnpm check:cycles` exit0、0 static runtime cycles。仅ESLint配置变化，不需要为证明产品行为重复build/test/E2E；本轮没有产品文件或用户调用链可由这些套件覆盖。

**性能与视觉**：运行时和UI均未改变；没有同条件五次lint计时或产品性能样本，所以只报告处理文件边界减少，不宣称更快、更省CPU/内存、更小或更美。截图/响应式/主题/无障碍均不适用。

**退出判断与下一项**：本工具链循环的窄退出标准已达到：扫描owner缺陷消失、原一方范围保留、全命令与比例性宽门禁已复验、可独立回滚。全仓lint仍是**红色的一方债务基线**，不是“全部lint已修复”。下一用户功能仍按矩阵选择F-09供应商/模型设置的独立未完成边界；若任何修复改变发现、缓存、路由、存储或UI语义，必须先取得对应OpenSpec批准。

## 41. F-29 画布文件导入/导出与维护循环

### 41.1 功能、范围、规格、基线与门禁

**用户场景**：用户从应用菜单、快捷键或命令面板打开/保存`.drawnix`，导出PNG/JPG，确认后清空画板，或清理已确认失效的媒体；操作完成、取消、失败或部分完成时获得真实反馈，并保持现有撤销/自动保存/刷新恢复链。

**范围**：文件/UI入口、JSON版本1、embedded media cache、image raster/download、clear confirm、invalid-media scan、Plait history与App workspace persistence。**非范围**：F-03 backup/GitHub、F-06/F-13媒体生产/预览/asset事务、F-31命令面板壳、新增repair/retry/file-preview产品、真实用户文件/存储/网络。

**规格/change**：正式spec无owner；新增`prevent-network-failure-media-cleanup`（3 requirements/11 scenarios/18 tasks/3 done）、`stabilize-drawnix-file-export-snapshot`（3/9/17/3）、`improve-drawnix-file-transfer-feedback`（4/12/18/3）和`improve-canvas-clear-confirmation-interface`（3/10/18/4）。四capability单owner，13个requirement逐项唯一；CLI strict exit127，只完成文件结构/WHEN/THEN/任务机械核查。四项均等待各自approval task，批准前禁止runtime/permanent test/i18n/CSS实现。

**基线/验收**：现有hotkey 1/1 file、21/21 tests但F-29断言0；四批临时diagnostic最终4/4 files、5/5 tests；1280×720及390×844/320×568/640×360生产DOM/焦点/几何和5张before截图。批准后验收必须覆盖complete/partial/cancel/fail、valid/invalid/unknown、scan-index race、snapshot race、clear三入口返焦/connected fallback/exact-one delete、compact 44×44、undo/autosave/reload、zh/en/light-dark且不改version1/schema/cache key/migration。

### 41.2 完整调用链与当前不变量

1. save：menu/mod+S/command→`saveAsJSON`→async snapshot/media cache→version1 JSON→browser-fs；cancel被规范化，其他reject当前无人消费。
2. open：menu→fileOpen/normalize→parse/validate→逐项media restore→direct board replace/history+selection reset→list render→fitViewport operation→React Board afterChange→App save→IndexedDB/tab sync/close snapshot。
3. image：menu/hotkey/command→selected-or-board→scoped fetch fallback→Plait toImage ratio4/padding20→PNG/JPG download；catch固定中文。
4. clear：menu/hotkey/command只写`openCleanConfirm`→always-mounted `CleanConfirm`无invocation/reference owner→shared focus manager/Cancel/Confirm；cancel不变更但当前desktop Escape与compact pointer Cancel均返`BODY`；Confirm→`board.deleteFragment`→Frame related delete→Plait history/apply→App persistence。
5. cleanup：entry→root image/video URL scan→boolean HEAD/GET `Promise.all`→scan-time reverse indices→remove operations→history/persistence→message。

输入/输出、owner、副作用、恢复、隐私、测试空白与精确行号见`docs/evidence/f29-canvas-file-maintenance/diagnostics.md`；原始值见`metrics.json`。

### 41.3 已确认问题与决策

- **[CANVAS-FILE-CLEANUP-001] 已证实/等待审批**：两次synthetic network rejection→`HEAD,GET`、remove1、children0、success“Cleaned 1 invalid media”。未知网络不证明invalid；tri-state/preserve unknown由cleanup change拥有。
- **[CANVAS-FILE-CLEANUP-002] 已证实/等待同审批**：404 pending期间index0插入新元素，完成后仍remove `[0]`，新元素被删而target保留。按current identity/path重解，不依赖旧index。
- **[DRAWNIX-EXPORT-SNAPSHOT-003] 已证实/等待审批**：cache pending期间新增B，file elements为A+B但embedded只A、cache read1。export-start JSON-compatible snapshot由snapshot change拥有。
- **[DRAWNIX-FILE-OUTCOME-004] 已证实/等待审批**：save Promise不观察、open无reject consumer、feedback0；image error固定中文；生产command搜索仅“保存为 JSON”。typed/localized exactly-once outcome与truthful copy由transfer change拥有。
- **[DRAWNIX-MEDIA-PARTIAL-005] 已证实/等待同审批**：cache miss export正常resolve且无embedded；cache-write reject import仍resolve。保留best-effort structure但报告aggregate-safe partial count。
- **[CANVAS-CLEAR-FOCUS-010] 已证实/等待审批**：1280×720 menu→Clear→Escape与390×844 expanded-toolbar/menu→Clear→pointer Cancel均由initial Cancel关闭到`BODY`；三入口只有boolean，无可恢复stable workflow owner。非持久same-root owner/fallback和F-31 handoff由clear-interface change拥有。
- **[CANVAS-CLEAR-COMPACT-011] 实测/等待同审批**：320×568、390×844、640×360 dialog均完整入视口并锁body scroll，但Cancel/Confirm均62×36，低于repository 44px compact convention。只做F-29 caller-scoped compact/coarse hit box，不全局修改30个其他ConfirmDialog consumers。

完整的用户影响、复现、证据强度、根因、替代、风险、验证和回滚均在F-29 diagnostics逐ID列出，不以本摘要替代。

### 41.4 假设/阻塞、实际改动、验证、回滚与退出

**待验证/产品语义**：import保存viewport但随后fit并reset default theme；validator未使用version/source/element shape；cleanup无timeout/cancel且unbounded Promise.all；image export失败媒体透明占位。分别需要产品意图、synthetic incompatibility、1/10/100 media五次测量或像素对照，验证前不改。

**实际改动**：新增F-29四项approval-only change、registry/F28/F29 evidence、F-29五张before截图和F-31覆盖行；更新账本。无runtime/permanent test/CSS/i18n/schema/cache/storage/migration/用户数据改动。四个临时diagnostic test用后全部删除；clear-confirm浏览器路径未按Confirm、未删除画布。

**命令/视觉/性能**：direct Vitest错误config exit1、0 tests（alias scope failure）；workspace-aware diagnostics 5/5 exit0；with-hotkey 21/21 exit0。OpenSpec strict exit127；机械总计13 requirements/42 scenarios/71 tasks/13 done，四capability和13 names均single/unique。Browser menu 13 items；390×844 rows全32px，320×568与640×360内部scroll正常；clear-confirm desktop/compact返焦BODY且三视口actions 62×36；command保存copy已截图。五张before、无after/English/五次性能样本，不宣称视觉或性能改善。Browser tab/server关闭，7400无listener。

**回滚/退出/下一项**：无Git metadata，按patch删除四change、F-29 evidence/截图并反向本节/表格/matrix即可；无数据/cache恢复。F-29**事实建模完成但实施审批阻塞，未达到功能退出标准**：七项确认/实测问题等待四项独立审批，四项假设仍需产品语义或测量。下一项选择账本中尚未达到同等事实建模深度且不依赖这些审批的可达用户意图；若用户批准任一change，只实施被明确批准的边界。

## 42. F-30 Mermaid/Markdown 转换与画布插入循环

### 42.1 功能、范围、规格、基线与门禁

**用户场景**：用户从创建工具栏、更多工具或快捷命令打开 Mermaid/Markdown 转换，编辑文本，看到加载/预览/失败状态，以按钮或 Ctrl/Cmd+Enter 把**当前输入**的流程图/思维导图插入当前画布，并沿现有 history/autosave/reload 链保存；关闭时不误改画布并回到稳定操作位置。

**范围**：两个 DialogType 的三个入口、controlled/lazy dialog、输入/deferred parse、lazy converter、preview/error、pointer/keyboard Insert、smart/default placement、Plait paste/history、viewport reveal、App workspace save adjacency、desktop/compact dialog语义与布局。**非范围**：F-05普通图形/文本创建、F-31命令面板搜索导航壳、F-08生成弹窗、F-03备份恢复、新diagram type、worker/SW执行、持久draft或自动retry。

**规格/change**：正式spec和既有active change均无F-30 owner。新增`stabilize-text-conversion-preview-state`（3 requirements/11 scenarios/18 tasks/4 done）、`preserve-markdown-conversion-draft-feedback`（2/7/16/3）、`improve-text-conversion-dialog-interface`（4/11/18/4）；三capability各single owner，9个requirement逐项全仓唯一。OpenSpec CLI仍不可用，只完成人工proposal/design/tasks/delta/WHEN-THEN/ownership核查；三项均等待显式审批，批准前禁止runtime/permanent test/i18n/CSS实现。

**基线/验收**：无永久专属转换测试。三份临时diagnostic最终3/3 files、4/4 tests后删除；1280×720 zh-CN生产Mermaid/Markdown success、Mermaid error与390×844 success/error检查，4张before截图。批准后验收必须覆盖loading/pending/out-of-order/success/empty/error/recovery/unmount、button+shortcut exact current result、history/autosave/reload、三入口focus、zh/en、light/dark、320/375/390/landscape/tablet/desktop；不改parser syntax/package、element/schema/cache/storage/migration。

### 42.2 正向/反向调用链、状态与不变量

1. **入口/open owner**：creation `creation-toolbar.tsx:211-221,557-560`、more-tools `more-tools-button.tsx:83-103,424-428`、command `command-registry.ts:393-406`→`useDrawnix.openDialog :99-115`→`openDialogTypes Set`→`ttd-dialog.tsx:689-721` controlled Floating UI Dialog+lazy component。
2. **输入/转换**：controlled textarea `ttd-dialog-input.tsx:44-52`→`setText`→trimmed `useDeferredValue`→dynamic import→Mermaid async `string→Promise<elements[]>`或Markdown module Promise后`string→MindElement`→local `value/error`→readonly Plait preview。失败时`ttd-dialog-output.tsx:38-49`保留旧value并opacity 0.15。
3. **插入/持久化**：panel button或textarea shortcut`:24-42`→type-specific `insertToBoard`→length-only guard→deep clone→smart/default point→`board.insertFragment(...paste)`→viewport reveal→close；React Board`:87-97,191-193` after-change→App`:721-769`→WorkspaceService`:951-989`→storage+`boardUpdated`。反向canvas转换元素writer是两个insert函数；preview writers是各自conversion effect。
4. **状态/默认/副作用**：component拥有module/text/deferred/value/error，Context只拥有open；Mermaid固定example、Markdown locale example；首parse失败会把所有`"`改`'`再试一次，Markdown root point归零。副作用仅dynamic import、load catch console、board/history/save、scroll和close；无task/network/cache/analytics/draft store。
5. **不变量**：保留supported syntax/package、未独立批准的quote fallback、placement、clone、Plait paste/history、reveal、success close、serialization/autosave；blocked insertion不应产生board/save/close。

完整输入输出、正反链、并发/错误/隐私/测试边界与原始值见`docs/evidence/f30-text-conversion/diagnostics.md`和`metrics.json`。

### 42.3 已确认问题、方案、风险与验证

- **[CONVERSION-FRESHNESS-001] 已证实/等待审批**：受控older→newer启动、newer→older完成，preview最终退回`older-result`。根因是`:70-90`无request/input/generation guard；current identity+ignore obsolete由preview-state change拥有。
- **[CONVERSION-INSERT-002] 已证实/等待同审批**：新input pending时点击Insert，旧preview被insert1次且dialog关闭；production invalid Mermaid仍enabled、旧preview opacity0.15。length-only guard与button/shortcut未共享current-result predicate；blocked path必须0 board op/0 close/0 save。
- **[MARKDOWN-DRAFT-003] 已证实/等待审批**：zh mounted draft`# User-authored draft`在language=en rerender后变成English builtin example。last injected example+explicit edit owner由draft-feedback change拥有，不新增持久draft。
- **[MARKDOWN-LOAD-FEEDBACK-004] 已证实/等待同审批**：controlled Markdown import rejection显示`dialog.error.loadMermaid`并console`Failed to load mermaid library:`。新增typed zh/en Markdown key与aggregate label，不记录input/output。
- **[CONVERSION-DIALOG-A11Y-005] 实测/等待审批**：两个production dialog有role但`aria-label/labelledby=null`；textarea无显式name relation、只靠placeholder；error role/live均null；initial focus正确进入textarea，Escape后无named active control。visible heading/native label/narrow live error/entry-owner focus return由interface change拥有。
- **[CONVERSION-DIALOG-COMPACT-006] 实测/等待同审批**：390×844 success/error均dialog client/scroll `675/779`、overflow visible，body `844/844`且overflow hidden，40px Insert top/bottom `828.90625/868.90625`，完整action超viewport 24.90625px。modal-owned scroll/bounded sizing由interface change拥有，不能用unlock body或无证据全局缩放替代。

逐ID的用户影响、复现、当前/预期、证据强度、完整调用链、影响范围、候选/替代、风险、验证和回滚见F-30 diagnostics，不以本摘要替代。

### 42.4 假设、实际改动、命令、性能/视觉、回滚与退出

**待验证/未知**：Markdown null placeholder在`mind.points`前可能造成transient caught error，但production未见flash；`loaded` prop未消费但slow-chunk空态未测；quote fallback可能改变语义但无fixture；dark/English、320/375/landscape/tablet/high-DPI/offline cache、successful insert/history/reload未完成。均不得据此改runtime。

**实际改动**：只新增3项approval-only change、F-30 diagnostics/metrics/4张before JPEG，并同步账本、F-28与registry evidence。无生产TSX/SCSS/i18n/parser/test/storage/cache/schema/migration/用户数据改动。截图仅read-only dialog状态；未触发Insert/clipboard/file/provider/real storage/network mutation。

**测试/工具**：首次diagnostic exit1，3/3 files、4/4 tests在产品路径前因full module mock缺`IS_IOS/IS_APPLE`失败，归fixture；修正后exit0、3/3 files、4/4 tests，durations 440/491/656/140ms、report 2.19s。OpenSpec人工为9 requirements/29 scenarios/52 tasks/11 done，names/capability owner均唯一；CLI unavailable，不声称CLI validate。临时diagnostic path 0；Browser viewport reset、tabs closed、server stopped。

**性能/视觉**：无runtime实现且未做5次parse/render样本，不宣称更快/更省/更小。4张before与几何只证明当前success/error和compact clipping；无after、不宣称更美。候选性能指标仍为固定example input-to-preview、parser CPU/long task、React commits与preview memory。

**回滚/退出/下一项**：无Git metadata，按patch删除3 change、F-30 evidence/截图并反向表格/本节/F-28/registry即可；无data/cache/migration恢复。F-30**事实建模完成、实施审批阻塞，未达到功能退出标准**。无依赖审批的下一只读循环为F-31 command palette shell；若用户先批准任一F-29/F-30 change，只实施被批准的独立边界。

## 43. F-31 快捷命令面板搜索、执行与返回循环

### 43.1 功能、范围、规格、基线与门禁

**用户场景**：用户从应用菜单或非文本输入状态的 `mod+K` 打开已有快捷命令面板；搜索当前 board predicate 允许的命令；用方向键、Enter、Escape或指针完成选择/取消；面板关闭后，非surface命令或取消回到原工作流，打开Settings/Search/转换对话框等命令则把最终焦点交给目标功能。

**范围**：menu/hotkey entry、deferred lazy mount、session query/active index、label/keyword/shortcut fuzzy score、predicate/filter/category order、pointer/keyboard activation、close-before-rAF dispatch、palette shell semantics/result status/focus、compact/short-landscape geometry与palette-local motion。**非范围**：新增/定制/历史/最近命令；命令目标的board/storage/file/provider/task/cache/恢复/反馈；F-29文件与清理动作、F-30转换结果、F-26 Settings、F-04/F-05/F-25画布动作；持久搜索或analytics schema。

**规格/change**：正式spec和既有active change都没有完整F-31 shell owner。新增`stabilize-command-palette-input-handling`（3 requirements/9 scenarios/16 tasks/4 done）和`improve-command-palette-interface-accessibility`（5/15/23/6）；两个capability各single active owner，8个requirement名称在正式+active specs中各出现一次。F-31完成时机械快照为121个active/delta、10 fully/99 partial/12 zero、92个tasks文件含审批措辞；随后F-29、F-23与F-13补充后的当前快照为124/124、10/102/12、95。OpenSpec CLI仍不可用；以上是文件/四级Scenario/WHEN-THEN/owner机械复核，不是CLI validate。

**基线与本轮验收**：永久`CommandPalette`/registry专属测试为0。临时component diagnostic首次因`toHaveFocus` matcher未加载exit1，改原生identity assertion后exit0、1/1 file、2/2 tests，406/48ms、report 1.75s，随后删除。production build在1280×720显示27个当前可用命令，另测390×844和640×360并留4张before。审批后才可实施；验收需覆盖query等价、IME、predicate/filter/index、keyboard/pointer exact-once、cancel/target focus、zh/en、light/dark、320/375/390/640×360/tablet/desktop、zoom/high-DPI/touch/screen reader/reduced motion与同状态after，不改变registry/target/storage/schema。

### 43.2 正向/反向调用链、状态与不变量

1. `app-menu-items.tsx:246-266`或`with-hotkey.ts:138-153`→`appState.openCommandPalette=true`→`drawnix.tsx:857-867`→`DrawnixDeferredFeatures.tsx:115-117,177-190` lazy mount；close写false。当前只传boolean，没有invoker identity。
2. `command-palette.tsx:51-82`拥有query/active index并按language建registry；`command-palette.types.ts:3-38`定义ID/label/keywords/category/shortcut/predicate/`perform(board)`；`command-registry.ts:27-418`静态37项，空selection生产predicate投影后27项。
3. raw input `:204-216`→`matchCommand/fuzzyScore :17-49`→score/predicate/sort `:84-103`→group/flat `:105-124`→visual rows `:220-263`；open/query/Arrow/hover/clamp是active index全部writer，`:143-149`尝试将当前ref滚入panel。
4. pointer click或Enter→`executeCommand :151-159`→close→next-frame `cmd.perform(board)`；从此向后的board transform、dialog/drawer、file/storage/cache/task/provider、feedback/recovery均回到目标功能owner。Escape/overlay只close。反向从visible active/empty/target回溯分别只到上述projection、close和唯一registry perform边界。
5. query/active无storage/cache/migration/network/log；menu有`data-track=toolbar_click_menu_commands`，shell不记录query。必须保持registry IDs/order/predicates、raw displayed query、目标exact-once/close-before-rAF、theme/z-index/desktop density与目标持久化契约。

完整输入输出、默认值、状态owner、副作用、反向writer、错误/取消/恢复边界和原始值见`docs/evidence/f31-command-palette/diagnostics.md`与`metrics.json`。

### 43.3 已确认问题、方案、风险与验证

- **[PALETTE-SEARCH-001] 已证实/等待审批**：production ` Mermaid `为0项/no-match，`Mermaid`为1项“Mermaid 转流程图”。raw query直接进入score；matching-only Unicode boundary trim由input change拥有，不能改caret或collapse internal spaces。
- **[PALETTE-IME-002] 已证实/等待同审批**：组成态Enter（`isComposing=true,keyCode=229`）确定性close1、next-frame perform1；shared handler无composition guard。批准后四个palette key在组成期全部delegate，结束后恢复普通exact-once行为。
- **[PALETTE-SEMANTICS-003] 实测/等待interface审批**：overlay/panel/list无role/name；input无label/controls/expanded/activedescendant；27行全无role/id/selected/tabIndex；ArrowDown只有CSS active改变；no-match无status/live。候选是localized modal+input-owned combobox/listbox/group/option与narrow count/no-match status，不增加27–37个Tab stop。
- **[PALETTE-FOCUS-004] 已证实/等待同审批**：production menu Escape与connected-opener component都落`BODY`。根因是boolean open无owner/close reason；候选区分cancel/non-surface return和focus-owning target handoff，验证rAF竞态及不抢target focus。
- **[PALETTE-COMPACT-005] 实测/等待同审批**：390×844 panel 358×420；input 22.5px、row 37.390625px、list client/scroll 373/1198，低于`_responsive.scss:33`的44px compact convention。只扩大compact/coarse activation box，不扩大glyph/desktop density。
- **[PALETTE-LANDSCAPE-006] 实测/等待同审批**：640×360 panel y54..474、body 360/360 hidden；ArrowUp wrap后的“清除画布”row y436.3125..473.703125，完整行全在viewport外。候选为available dynamic viewport bound+内部list scroll；不能用unlock body或缩小文本规避。
- **[PALETTE-MOTION-007] 静态证实/等待同审批**：SCSS固定120/150ms overlay/panel animation和80ms row transition，无palette reduced-motion override；候选仅在preference reduce时移除非必要motion，保留即时状态/焦点/action。

逐ID的用户影响、复现、当前/预期、证据强度、完整调用链、影响范围、候选/替代、风险、验证和回滚见F-31 diagnostics，不以本摘要替代。

### 43.4 假设、实际改动、命令、性能/视觉、回滚与退出

**待验证/未知**：37→27的predicate投影在多选/undo实时变化下的active identity未穷尽；target success/failure/async rejection未在production执行；outside click、hotkey return、各focus-owning target、真实IME/屏幕阅读器、320/375/tablet/dark/English/high-DPI/200%/coarse pointer/reduced-motion runtime未测。没有5次input/render/commit/long-task/memory样本，不能判性能瓶颈。

**实际改动**：只新增2项approval-only change、F-31 diagnostics/metrics/4张before JPEG，并同步账本、F-28与registry coverage。无production TSX/SCSS/i18n/registry/test/storage/cache/schema/migration/用户数据改动；浏览器未执行任何命令、文件、剪贴板、provider、真实storage或破坏性board动作。

**测试/工具**：component初次exit1是matcher fixture，修正后exit0、1/1 file、2/2 tests；临时diagnostic 0。人工OpenSpec为8 requirements/24 scenarios/39 tasks/10 done，names和capability owner唯一；CLI unavailable。4张JPEG尺寸/哈希在metrics固化；browser tabs关闭、server停止。此文档checkpoint没有冒充full typecheck/test/lint/build/Playwright重跑。

**性能/视觉**：无runtime实现且0个五次样本，不宣称更快/更省/更小。4张before和DOMRect只证明当前desktop/compact/landscape/no-result状态；无after，不宣称更美。

**回滚/退出/下一项**：无Git metadata，按patch删除两change和F-31 evidence/截图，并反向表格/本节/F-28/registry/matrix；无data/cache/migration恢复。F-31**事实建模完成、实施审批阻塞，未达到功能退出标准**。下一项应选择账本中尚未达到事实建模深度且不依赖这些审批的独立可达用户意图；如果用户先批准任一change，只实施被明确批准的边界。
