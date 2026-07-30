## Context

- `settings-dialog.tsx:1445-1506` 以当前 profile/base URL/API key 调用 `runtimeModelDiscovery.discover()`，并在 reject 时调 `setError()` 显示错误。
- `runtime-model-discovery.ts:1531-1623` 在每次发现开始时写 `loading`，网络返回后无条件写 `ready` 和 catalog。
- `runtime-model-discovery.ts:1460-1481` 会在凭据改变时清空旧 catalog，但没有使已发出的旧请求失效。
- `runtime-model-discovery.ts:1234-1259` 的 `setCatalogState()` 会同步 runtime registry、异步持久并通知 selector，因此迟到响应同时影响 UI 和存储。
- 受控单测原始值：新请求先返回 `new-key-model`，旧请求后返回 `old-key-model`；期望 `new-key-model`，实际 `old-key-model`，1/1 失败。

## Goals / Non-Goals

- Goals:
  - 同一 profile 只有最新发现意图能提交 catalog/status/error。
  - 凭据失效和显式清空后，旧响应不得重建已废弃目录。
  - 一个 profile 的请求不影响其他 profile 的并发发现。
- Non-Goals:
  - 不改远端 models API、认证、超时或重试策略。
  - 不改模型类型/vendor 分类、去重、排序或默认选择。
  - 不迁移、删除或改写现有 provider catalog schema。
  - 不新增用户可见的取消按钮。

## Decisions

- Decision: 为每个 profile 维护单调发现 generation/token，每次新发现拿到独立 token，提交前核对仍为当前 token。
  - Alternative: 只用 `AbortController` 终止旧 fetch。
  - Rejected because: abort 可能在响应已返回或转换期间到达，且不能替代提交时的所有权检查。
- Decision: 凭据 invalidation 和 `clear(profileId)` 同样推进/替换该 profile token。
  - Alternative: 只在下一次 `discover()` 开始时让旧请求失效。
  - Rejected because: 用户可在改密钥后暂不发新请求，旧响应仍会违反“立即废弃旧目录”不变量。
- Decision: 过期请求的 success 和 failure 都映射为非错误的 stale outcome，调用端不得为它写 error 或显示失败。具体采用返回当前 catalog 还是 typed stale result，在实现前以最小 API 改动为准，但必须有调用端测试。
  - Alternative: 让过期请求抛普通 Error。
  - Rejected because: 现有 settings catch 会调 `setError()` 并弹错，反而会用旧失败覆盖新成功。

## Invariants

- 同一 profile 的最新发现、失效或清空意图拥有最终 state。
- 过期响应不调用 `setCatalogState()`，不持久化，不发 store event，不显示错误。
- profile A 的 token 不取消、阻塞或覆盖 profile B。
- 最新请求的 HTTP、JSON、data 和空列表错误仍按当前可见错误路径处理。

## Risks / Trade-offs

- 如果 stale outcome 仍被记为 discovery success，分析数据会重复；需要调用端测试约束 success/failure 事件。
- token 若在每个状态同步回调中无条件更换，可能误将自己的成功持久化判为 stale；更换点必须限于新意图和外部失效。
- 忽略过期响应不会撤回已发出的网络请求；本 change 保证状态正确性，不宣称节省网络或更快。

## Migration Plan

1. 先将已证实的两请求失序诊断转成永久红测，再增加 stale failure、credential invalidation、clear 和跨 profile 样例。
2. 在 runtime discovery store 实现每 profile 所有权检查，仅在需要时最小调整 settings catch。
3. 复跑发现、settings、selector、provider routing 和偏好窄测，再执行宽验证。

## Acceptance Thresholds

- 同 profile 新成功 → 旧成功、新成功 → 旧失败、in-flight → 凭据失效、in-flight → clear 四个受控样例中，过期请求的 catalog/status/error/persist/event 写入均为 0。
- 两个 profile 并行发现时，2/2 目录均保留自己的结果。
- 最新请求的 HTTP/non-JSON/missing-data/empty-list 错误仍可见，既有错误测试不放宽。
- F-09 窄簇、drawnix typecheck/lint 和全仓验证不新增失败。

## Rollback

- 独立回退每 profile token/stale outcome、settings 调用端配套处理和回归测试。
- 不删除或重写现有 catalog，不需要 IndexedDB/localStorage 迁移；回滚后恢复旧的响应竞争行为。

