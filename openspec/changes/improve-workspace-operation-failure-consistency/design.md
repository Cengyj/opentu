## Context

- `createFolder` 和 `createBoard` 在 `saveFolder/saveBoard` 前写入内存 Map。
- `renameFolder` 直接修改 Map 中同一对象，再等待 `saveFolder`。
- `deleteBoard` 在 `deleteBoard` 存储 Promise 前清空当前 ID、删除三份 Map，并提前启动远程删除同步。
- `deleteFolderWithContents` 对每个画板执行相同的 memory-first 删除。
- `useWorkspace` 对 create/delete/copy 捕获异常并返回 `null/false`；ProjectDrawer 对失败返回没有统一 MessagePlugin 分支，且删除对话框仍关闭。
- metadata patch 路径已经采用 storage-first，可作为本 change 的最小一致性模式。

## Goals / Non-Goals

- Goals:
  - 单记录本地持久化失败后，内存索引、当前画板与 IndexedDB 保持操作前状态。
  - 本地删除成功前不触发远程删除副作用。
  - 所有可达 create/delete/copy 失败向用户显示可重试反馈。
  - 批量或递归部分失败准确报告已提交范围。
- Non-Goals:
  - 不实现跨 LocalForage store 的 ACID 事务。
  - 不新增自动重试、离线队列、回收站或冲突解决器。
  - 不改变成功路径排序、命名或删除确认语义。
  - 不修改 GitHub 同步协议或存储 schema。

## Decisions

- Decision: 单记录操作采用 persist-first，再提交内存 Map 和事件。
  - Alternatives considered: memory-first 后为每个路径编写回滚。
  - Why not chosen: 回滚需要恢复 current ID、三份 Board Map 和对象引用，分支更多且容易遗漏。
- Decision: Folder 更新使用不可变副本持久化，成功后替换 Map。
  - Alternatives considered: 继续原地修改对象并在失败时改回字段。
  - Why not chosen: tree state可能持有同一对象引用，原地修改会在事件前泄漏失败状态。
- Decision: Hook 继续保持现有返回类型，但 ProjectDrawer 必须处理 `null/false` 并显示具体操作失败。
  - Alternatives considered: 把所有 API 改为抛异常或 Result 类型。
  - Why not chosen: 会扩大公开调用者修改面；本轮不需要 API 重构。
- Decision: 批量/递归操作按单记录提交，不承诺跨 store 原子性。
  - Alternatives considered: 新增事务抽象或数据库版本迁移。
  - Why not chosen: LocalForage 当前 API 不提供跨 store 事务，迁移风险超出已证据范围。

## Invariants

- 成功路径的 Board/Folder 字段、顺序、ID 和事件类型保持不变。
- 任一单记录存储拒绝后，不发出该记录的成功事件或远程删除副作用。
- UI 不把 `null/false` 当成功，不显示成功 toast。
- 失败反馈不包含 API key、token、完整媒体内容或 IndexedDB 原始 payload。
- 不增加任意超时或自动重试。

## Risks / Trade-offs

- persist-first 会让 UI 更新等待一次 IndexedDB 写入。
  - Mitigation: 当前 handler 本就 await 同一 Promise；只改变提交顺序，不新增 I/O。
- 批量操作中途失败仍可能有已提交记录。
  - Mitigation: 返回并显示已成功/失败数量，树以实际提交事件更新；不宣称全量回滚。
- 远程删除延后到本地成功后可能稍晚触发。
  - Mitigation: 保持异步不阻塞 UI，只调整因果顺序。

## Migration Plan

1. 为 createFolder/createBoard/renameFolder/deleteBoard 注入单次存储拒绝，先证明当前内存分叉。
2. 把单记录路径改为 persist-first，并断言失败不发事件、不触发远程删除。
3. 为 create/delete/copy 的失败返回补 ProjectDrawer 反馈和对话框状态测试。
4. 为批量/递归部分失败补成功计数与剩余树测试。
5. 由窄到宽复验，不改存储数据。

## Acceptance Thresholds

- 每个目标单记录操作至少 1 项存储拒绝测试；失败后内存快照与持久化快照均等于操作前。
- 删除存储失败测试中远程删除 mock 调用次数为 0。
- create/delete/copy 失败 100% 显示一次对应错误，且不显示成功 toast。
- 相关成功路径测试无新增失败；不新增 typecheck、cycles 或 build 回归。

## Rollback

- 独立回退 persist-first 顺序、ProjectDrawer 错误反馈和对应测试。
- 不清理、迁移或重写现有 IndexedDB 数据。
- 若成功路径延迟、事件顺序或 GitHub 删除回归，整体回滚该 change。
