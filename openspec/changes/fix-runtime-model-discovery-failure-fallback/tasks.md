## 1. Evidence and Approval

- [x] 1.1 完成设置保存/发现失败 → catalog error → selector fallback 的正反向调用链
- [x] 1.2 用受控 401 证明首次失败后 selector 从 3 个策展文本默认变为 0 个模型
- [x] 1.3 核对 `add-runtime-model-discovery` 与 `add-multi-provider-profiles` 的 fallback/authoritative 语义重叠
- [ ] 1.4 用户批准“只有成功目录才启用 provider-only selector，signature 仍阻止旧模型 pin”的语义

## 2. Implementation (approval required)

- [ ] 2.1 先补首次 loading/HTTP/non-JSON/missing-data/empty-list 失败的永久红测
- [ ] 2.2 补凭据失效不恢复旧 pin、多 profile 成功+失败并存的保护测试
- [ ] 2.3 最小拆分成功目录判定与凭据绑定判定，不修改 catalog schema

## 3. Verification

- [ ] 3.1 运行 runtime discovery 状态、fallback、invalidation 和多 profile 定向测试
- [ ] 3.2 运行 F-09 11 文件窄簇及 settings/selector/provider route 相关集成测试
- [ ] 3.3 运行定向 lint、drawnix typecheck、全仓 test/typecheck/cycles/build:web/size/startup 及可用 E2E
- [ ] 3.4 同视口复验 settings 错误消息和主 selector 的 loading/error/success 状态；无视觉改动则记录截图无布局差异
- [ ] 3.5 OpenSpec CLI 不可用时记录阻塞并完成 delta 结构/同名 requirement/活动 change 冲突人工核对
