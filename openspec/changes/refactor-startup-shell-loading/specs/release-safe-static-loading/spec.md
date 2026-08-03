## MODIFIED Requirements

### Requirement: 运行时只使用可用的 CDN 源

系统 SHALL 始终保留当前容器同源作为静态资源权威源，并仅在远程静态树已由发布流程证明与当前 `releaseId` 字节一致时，才允许该 CDN 参与运行时加载。当前只发布容器的模式 SHALL 只使用同源，不得根据 display version、域名或历史偏好推测 CDN。

#### Scenario: 容器发行没有远程候选

- **GIVEN** 发布流程只产出 GHCR 或 DockerHub 容器
- **WHEN** 校验和启动当前 release
- **THEN** 同源容器 SHALL 是唯一运行时资源源
- **AND** 不发布的 npm/jsDelivr 资源 MUST NOT 进入候选或启动探测

#### Scenario: CDN 候选由同 release 证据授权

- **GIVEN** 远程静态树已发布
- **WHEN** 发布门禁验证其 `releaseId`、关键 hash、CORS、MIME 和解码字节身份
- **THEN** 只有全部通过的 CDN MAY 进入该 release 的候选集
- **AND** 候选失效 MUST NOT 使同源容器发布或启动失败

### Requirement: 服务器部署必须等待关键 CDN 资产就绪

系统 SHALL 在部署服务器 HTML 前校验当前发行模式的权威静态资产。origin-only 模式 SHALL 校验最终容器静态树而不等待未配置 CDN；只有发布明确开启 CDN 模式时，部署才必须等待该 release 的 CDN 就绪门禁。

#### Scenario: origin-only 部署验证容器

- **GIVEN** 当前发行没有授权 CDN
- **WHEN** 生产容器进入部署门禁
- **THEN** 门禁 SHALL 验证容器的入口、关键 JS/CSS、release identity、MIME、压缩和缓存合同
- **AND** MUST NOT 等待、请求或探测不存在的 CDN 资产

#### Scenario: 已开启 CDN 的部署等待就绪

- **GIVEN** 当前 release 的发布配置明确开启 CDN
- **WHEN** 关键 CDN 资产尚未通过 release/hash/CORS/MIME/字节身份校验
- **THEN** CDN 模式 SHALL 保持禁用且不得部署宣称启用 CDN 的 HTML
- **AND** 发布系统 MAY 继续产出和部署通过容器合同的 origin-only 模式

### Requirement: 启动边界依赖链必须稳定

系统 SHALL 以明确、可执行的 feature entry 作为静态资源边界，为入口、`ComposerCore`、素材库 core、图片生成 core 和其他高频延后能力计算完整依赖闭包，并阻止延后或跨功能运行时重新进入入口及 feature core 依赖链。构建分组、idle manifest 和发布校验 MUST 使用同一组 entry 身份；chunk 文件名、源码目录名或供应商命名不得充当依赖边界权威。

#### Scenario: 构建校验入口依赖链

- **WHEN** 运行启动边界校验脚本
- **THEN** 脚本检查入口 HTML 及其完整静态依赖图
- **AND** 若发现高频延后模块分组重新进入入口依赖链则返回失败
- **AND** 原有单文件 512,000B 与入口静态图 2,000,000B raw 门禁继续执行

#### Scenario: 从明确 feature entry 生成资源闭包

- **WHEN** 生产构建生成 chunk 分组和 `idle-prefetch-manifest.json`
- **THEN** 每个 `*-core` 与 `*-extended` 分组 SHALL 追溯到一个明确的 feature entry
- **AND** 分组 SHALL 记录该 entry 达到对应边界所需的静态传递依赖、伴随 CSS 和静态资产
- **AND** 校验报告 SHALL 分别列出完整闭包、entry 独有资源、共享 foundation、raw 字节、gzip 字节、文件数和最长依赖深度
- **AND** 动态 extended 依赖不得仅因可从 core 源码到达而被并入 core；只有达到 core 可交互状态前真实必需的资源才能归入 core

#### Scenario: 高频 feature core 受独立预算约束

- **WHEN** 校验器分析相对已验收 shell/board foundation 的 feature 增量闭包
- **THEN** `ComposerCore` SHALL 新增不超过 12 个 JavaScript 文件、150 KiB gzip 字节且最长依赖深度不超过 4
- **AND** `media-library-core` SHALL 新增不超过 25 个 JavaScript/CSS 文件、300 KiB gzip 字节且最长依赖深度不超过 4
- **AND** `image-generation-core` SHALL 新增不超过 25 个 JavaScript/CSS 文件、300 KiB gzip 字节且最长依赖深度不超过 4
- **AND** 任一 ordinary/default idle 分组并集 SHALL 不超过 30 个文件和 500 KiB gzip 字节
- **AND** 共享资源 SHALL 在独立 foundation 报告和每个引用 entry 的闭包中可追踪，不得通过改名、重复分组或排除共享依赖绕过预算
- **AND** 任一预算超限 SHALL 使构建或发布门禁失败，不得自动提高阈值

#### Scenario: 宽泛分组不能作为交互前置条件

- **WHEN** Composer、素材库或图片生成的 shell/core 被构建或激活
- **THEN** 其静态依赖和预取前置条件 MUST NOT 使用 `tool-windows`、`ai-chat`、`editor-engines`、`runtime-static-assets` 或等价 catch-all 分组替代明确 feature entry
- **AND** 素材库 core MUST NOT 静态引入图片/视频生成、任务恢复或生成执行器
- **AND** 图片生成 core MUST NOT 通过共享对话框根静态引入视频生成、批量生成、参考图编辑或生成执行器
- **AND** ComposerCore MUST NOT 静态引入 Agent、Workflow、MCP、external skills、素材库、历史优化或生成提交运行时
- **AND** 检测到上述跨功能静态耦合时发布门禁 SHALL 在浏览器请求这些资源之前失败

## ADDED Requirements

### Requirement: 生产镜像必须独立提供可验证的静态压缩

生产镜像 SHALL 在自身静态服务器边界提供可验证的 gzip 基线，而不是依赖外部反向代理补充压缩。压缩 MUST 保持原始响应的 MIME、release 字节身份和缓存策略；Brotli 仅可作为经过独立验证的额外能力，不能替代 gzip 基线。

#### Scenario: 构建生成预压缩静态产物

- **WHEN** 生产发布产物被创建
- **THEN** 大于 1 KiB 的 content-hashed JavaScript/CSS 以及适合静态压缩的 JSON、manifest 和 SVG SHALL 生成可追溯到同一源文件的 gzip 产物
- **AND** 每个 gzip 产物解压后的字节 SHALL 与对应未压缩 release 文件逐字节一致
- **AND** 已压缩图片、视频、音频和字体不得被无条件再次压缩
- **AND** 缺失、损坏、陈旧或无法映射到源文件的 gzip 产物 SHALL 使发布产物校验失败

#### Scenario: 容器直连协商 gzip

- **WHEN** 客户端绕过任何外部反向代理并以 `Accept-Encoding: gzip` 请求大于 1 KiB 的 HTML、JavaScript、CSS、JSON、manifest 或 SVG
- **THEN** 容器 SHALL 返回正确的 `Content-Encoding: gzip` 和 `Vary: Accept-Encoding`
- **AND** hashed 静态资源 SHALL 优先使用已验证的预压缩文件
- **AND** HTML 与没有预压缩副本的控制文件 MAY 使用容器内有界动态 gzip
- **AND** 解码后的响应字节 SHALL 与发布合同中的源文件一致

#### Scenario: 压缩不改变缓存与内容合同

- **WHEN** 同一 release 资源分别以 gzip 和 identity 表示获取
- **THEN** 两种表示的解码字节、Content-Type 和 release 身份 SHALL 一致
- **AND** content-hashed 资源的 immutable 策略、HTML 的 revalidation 策略及控制文件的 no-store 策略 SHALL 保持不变
- **AND** 容器直连校验 SHALL 在任一编码、MIME、Vary、字节身份或缓存策略不一致时失败

### Requirement: 发布门禁必须验证真实 feature 产物和冷暖升级路径

发布门禁 SHALL 针对实际生产构建和最终容器执行静态资源合同，不得以开发服务器、源码模块数、chunk 名称或单次热缓存结果代替生产产物证据。门禁 MUST 覆盖 cold、warm 和 release upgrade 三种浏览器资源路径。

#### Scenario: 生产产物结构被完整验证

- **WHEN** 候选 `dist` 和最终容器进入发布门禁
- **THEN** entry、manifest 与构建元数据引用的每个资源 SHALL 存在且具有预期 MIME
- **AND** content-hashed 文件的实际字节 SHALL 匹配其内容身份
- **AND** 每个 feature entry 的依赖闭包、预算、压缩副本和共享 foundation 归属 SHALL 可由机器读取并复算
- **AND** 缺失文件、悬空引用、闭包漂移、预算超限或压缩字节不一致 SHALL 阻止发布

#### Scenario: 冷缓存路径只加载所需闭包

- **GIVEN** 浏览器没有 HTTP cache、Cache Storage 或已安装 Service Worker
- **WHEN** 它从最终容器打开候选 release 并分别激活 Composer、素材库和图片生成
- **THEN** 每个阶段实际请求的 JavaScript/CSS/静态资源 SHALL 落在对应入口或 feature entry 的已验证闭包内
- **AND** 未激活 feature 的 extended runtime 和跨功能根不得因冷启动或首次 core 激活被请求
- **AND** 资源数、gzip 传输字节和依赖深度 SHALL 满足各自静态预算

#### Scenario: 暖缓存路径复用同一内容身份

- **GIVEN** 同一 release 已由 Service Worker 控制且对应 feature core 已成功缓存和打开
- **WHEN** 页面刷新或用户再次打开同一 feature
- **THEN** 浏览器 SHALL 复用相同 content-hashed 资源身份
- **AND** 同一激活过程 MUST NOT 为同一 content hash 建立重复下载或并行预取
- **AND** feature 仍 SHALL 在不加载无关 extended runtime 的情况下完成 core 激活
- **AND** warm 验证不得放宽 cold 路径的闭包和预算门禁

#### Scenario: 升级路径不混用 release 产物

- **GIVEN** 浏览器已有上一 release 的 Service Worker 和静态缓存
- **WHEN** 发布门禁将其升级到候选 release 并激活 Composer、素材库和图片生成 core
- **THEN** 候选 HTML、控制文件、entry 和依赖 SHALL 全部解析到候选 release 已验证的字节身份
- **AND** 新旧 hash 不得在同一个 feature 闭包中被错误拼接，候选引用不得产生 404、MIME fallback 或 SPA fallback
- **AND** 保留旧标签页所需缓存的既有升级语义 SHALL 继续成立
- **AND** cold、warm 和 upgrade 三组验证结果 SHALL 分别报告请求文件、gzip 字节、缓存来源和闭包归属，任一组失败 SHALL 阻止发布
