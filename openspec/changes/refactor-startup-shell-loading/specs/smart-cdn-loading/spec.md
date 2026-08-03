## MODIFIED Requirements

### Requirement: 智能 CDN 优先静态资源加载
系统 SHALL 仅将已由发布流程证明与当前 `releaseId` 一致的远程静态资源纳入 CDN 候选；存在该候选时对版本化静态资源采用 `Cache First -> 已验证 CDN -> 源站快速兜底`，不存在时采用 `Cache First -> 源站`。导航、主入口和控制文件 SHALL 保持同源优先，且应用启动 MUST NOT 等待可选 CDN 配置。

#### Scenario: 当前容器发行使用纯源站模式
- **GIVEN** 当前发布流程只发布 GHCR 或 DockerHub 容器
- **AND** 没有发布与当前 `releaseId` 完全一致的 CDN 静态树
- **WHEN** 容器中的应用启动或 Service Worker 处理静态资源缓存未命中
- **THEN** 远程 CDN 候选集 SHALL 为空
- **AND** 资源 SHALL 直接从同源获取
- **AND** 客户端 MUST NOT 探测未发布的 `cdn-config.js`、`version.json` 或 CDN chunk

#### Scenario: 同一 release 静态树完成发布和校验
- **GIVEN** 候选 CDN 已发布当前 `releaseId` 的完整静态树
- **AND** 发布门禁已验证 `version.json`、主入口和清单中关键资源的 hash、CORS、MIME 与解码字节身份
- **WHEN** 构建或发布产生该 release 的运行时配置
- **THEN** 系统 MAY 注入固定的 CDN base 作为该 `releaseId` 的候选
- **AND** 任一就绪校验失败 MUST 使 CDN 保持禁用
- **AND** 校验失败 MUST NOT 阻塞同源容器发布或转化为客户端重复探测

#### Scenario: 版本化静态资源使用已验证 CDN
- **GIVEN** 当前 `releaseId` 存在通过发布门禁的 CDN 候选
- **WHEN** Service Worker 处理未命中缓存的脚本、样式、字体、图片、图标或其他版本化静态 JSON 请求
- **THEN** 系统 SHALL 优先尝试匹配当前 `releaseId` 的已验证 CDN
- **AND** CDN 成功返回后 SHALL 将结果写入静态缓存

#### Scenario: 入口链路不等待可选 CDN 配置
- **WHEN** 浏览器请求 `index.html`、导航文档、`version.json`、`manifest.json`、`sw.js` 或 `precache-manifest.json`
- **THEN** 系统 SHALL 立即从当前服务器获取资源
- **AND** 主入口 MUST NOT 在加载、探测或超时等待可选 CDN 配置后才启动

#### Scenario: CDN 在发版窗口不可用时快速回源
- **GIVEN** 当前 release 已授权一个 CDN 候选
- **WHEN** CDN 对当前版本静态资源返回超时、404/5xx、错误 HTML 或字节身份异常
- **THEN** 系统 SHALL 快速回退到当前服务器
- **AND** 失败的 CDN SHALL 在短时间内被降级，避免同一页面重复支付完整失败等待

### Requirement: CDN 偏好同步与持久化
系统 SHALL 只同步和持久化已由发布配置授权的 CDN 偏好。`local`/origin 偏好 SHALL 表示远程候选集为空，且 Service Worker MUST NOT 因历史偏好、display version 或域名推测重建远程候选。

#### Scenario: 主线程同步已授权 CDN 偏好
- **GIVEN** 当前 `releaseId` 已授权一个通过就绪校验的 CDN
- **WHEN** 主线程得到该 CDN 的选择结果
- **THEN** 主线程 SHALL 发送 `SW_CDN_SET_PREFERENCE`
- **AND** 消息体 SHALL 包含 `cdn`、`latency`、`timestamp`、`version` 和 `releaseId`

#### Scenario: local 偏好清空远程候选
- **WHEN** 当前发布为 origin-only 或主线程选择 `local`
- **THEN** 主线程与 Service Worker 的可用 CDN 候选 SHALL 为空
- **AND** 旧的远程偏好 MUST NOT 继续参与静态资源选择

#### Scenario: Service Worker 复用持久化偏好
- **WHEN** 用户刷新页面且主线程尚未重新完成 CDN 选择
- **THEN** Service Worker MAY 读取上次持久化的偏好
- **AND** 仅在偏好的 `releaseId` 与当前 release 一致且 CDN 仍属于该 release 的授权候选时作为排序依据
- **AND** 任一条件不满足时 SHALL 使用空远程候选并从同源获取

### Requirement: 已校验 CDN 缓存可复用
系统 SHALL 允许复用与当前 `releaseId` 和已授权 CDN 一致的静态缓存响应，而不是将所有非源站缓存一律视为异常。

#### Scenario: 合法 CDN 缓存直接命中
- **WHEN** 静态缓存项包含有效的 `x-sw-source`、`x-sw-revision`、`x-sw-app-version` 和 `x-sw-release-id`
- **AND** `x-sw-release-id` 与当前 release 一致
- **AND** `x-sw-source` 仍是该 release 的已授权 CDN 或当前源站
- **THEN** Service Worker SHALL 直接返回该缓存项

#### Scenario: 异常缓存项被清理
- **WHEN** 缓存项缺少必需元数据、`releaseId` 不匹配、资源来源不再获授权，或静态资源缓存实际返回 HTML 错页
- **THEN** Service Worker SHALL 删除该缓存项
- **AND** SHALL 按当前 release 的候选策略重新获取资源

## ADDED Requirements

### Requirement: 空闲预取控制文件按需加载
系统 SHALL 仅在存在明确的非空分组请求或已就绪 release 的显式 full-prewarm 请求时获取 `idle-prefetch-manifest.json`。普通启动的 manifest defaults 为空时 MUST NOT 为了确认“无工作”而发起该控制文件请求。

#### Scenario: 空 defaults 不请求 manifest
- **GIVEN** 当前 release 的 idle prefetch defaults 为空
- **AND** 客户端没有明确请求 feature group 或 full-prewarm
- **WHEN** Service Worker 完成普通启动或进入空闲调度
- **THEN** Service Worker MUST NOT 请求 `idle-prefetch-manifest.json`
- **AND** MUST NOT 自动遍历清单中的全部分组

#### Scenario: 明确 feature group 按需请求 manifest
- **WHEN** 前台客户端明确请求一个非空 feature group
- **THEN** Service Worker SHALL 按 `releaseId + group` 单飞获取和处理 manifest
- **AND** SHALL 只预取该分组及其明确共享基础资源

#### Scenario: 升级 full-prewarm 显式请求 manifest
- **GIVEN** 新 release 已就绪且升级流程显式请求 full-prewarm
- **WHEN** Service Worker 获取和遍历 idle prefetch manifest
- **THEN** 该工作 SHALL 使用最低后台优先级
- **AND** 前台资源请求发生时 SHALL 在资源边界暂停，而不与用户交互竞争
