## Context

- `settings-dialog.tsx:1445-1506` 保存草稿后调用 `discover()`；失败时调用 `setError()` 并显示 Message。
- `runtime-model-discovery.ts:1460-1481` 在凭据变化时清空旧目录并保存新 signature。
- `runtime-model-discovery.ts:1531-1560` 在请求开始时写 loading、signature，并在新凭据下清空旧目录。
- `runtime-model-discovery.ts:84-92` 将 signature、成功时间或非空目录任一项视为 authoritative。
- `runtime-model-discovery.ts:1320-1349` 只要任一 enabled profile 被视为 authoritative，就用 provider runtime models 替代静态默认；首次失败时 runtime models 为空。
- 相同 authoritative helper 还用于 `getPinnedSelectableModel()` 拒绝恢复旧凭据 model ref，因此不能简单删除 signature 判定而不复审 pin 路径。

## Goals / Non-Goals

- Goals:
  - 没有任何 enabled profile 成功目录时，首次 loading/error 保留策展静态默认。
  - 已成功目录继续拥有 provider-only 选择语义，即使用户暂未勾选模型。
  - 凭据变化后旧 provider 模型不通过 pin 路径复活。
  - 多 profile 下一个失败目录不遮蔽其他成功目录。
- Non-Goals:
  - 不改变发现请求、错误文案、重试、并发所有权或 stale response 语义。
  - 不改变静态默认清单、model classification、selectionKey 或 route planning。
  - 不增加新状态字段，不迁移 IndexedDB/localStorage。

## Decisions

- Decision: 将“是否有成功 provider catalog”与“是否已有凭据绑定/失效边界”拆成两个判定。
  - selector 模式只消费成功目录证据；兼容旧目录时可接受非空 discovered models，正常新目录以 `discoveredAt` 作为成功标记。
  - profile-aware pin 路径继续消费凭据签名，防止新凭据下恢复旧 model ref。
- Alternative: 从现有 `hasAuthoritativeModelCatalog()` 中直接删除 signature。
  - Rejected because: 会让凭据改变后被清空的旧 provider model ref 重新通过 `createPinnedRuntimeModel()` 出现在 selector，破坏已有失效不变量。
- Alternative: 失败时恢复旧凭据 catalog。
  - Rejected because: 旧目录属于不同凭据，现有测试和 profile ownership 语义要求立即废弃。
- Alternative: 首次失败后保持空 selector。
  - Rejected because: 与 `add-runtime-model-discovery` 的明确 failure fallback scenario 不一致，也让没有成功 catalog 的 profile 被当成 authoritative。

## Invariants

- 成功目录中的未勾选模型不作为静态 fallback；用户选择为空时允许 provider selector 为空。
- 凭据变化后旧目录、旧 selected IDs 和旧 profile-aware pinned model 均不恢复。
- 其他 enabled profile 的成功目录与选择不受失败 profile 影响。
- 失败消息、分析事件和 error state 保持当前路径。

## Risks / Trade-offs

- loading 期间会短暂显示内置默认，成功后切换到 provider 模型；用状态序列测试确认切换只发生一次且不恢复旧 provider 模型。
- 旧持久化目录可能缺少 `discoveredAt`；成功判定需兼容非空 `discoveredModels`，避免升级后误回退。
- 与 stale-response change 都触及 discovery 状态；实现时分别验证 request ownership 与 fallback 判定，避免互相吞掉 error/loading 状态。

## Migration Plan

1. 先将首次 401 诊断转成永久红测，并覆盖 loading、凭据失效和多 profile。
2. 最小拆分 selector-success 与 credential-bound 判定，不改变状态 schema。
3. 复跑 runtime discovery、settings、selector、routing 和 F-09 宽验证。

## Acceptance Thresholds

- 首次 loading 和首次 HTTP/non-JSON/missing-data/empty-list 失败四类状态，在没有成功 enabled catalog 时均返回既有策展默认清单。
- 先前成功目录被新凭据失效后，旧 provider model 的 pinned 解析仍为 `null`。
- 任一 enabled profile 有成功目录时，不新增任何静态 fallback；另一 profile 的失败不移除成功目录。
- 不新增持久化写入、schema、网络请求或性能结论。

## Rollback

- 独立回退 selector-success 判定和对应测试即可恢复旧行为。
- 没有数据迁移、缓存清理或用户数据删除。
