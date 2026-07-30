## 1. Evidence and Approval

- [x] 1.1 完成设置发现 → profile catalog → selector/preset → planner/transport 正反向调用链
- [x] 1.2 用可控 fetch 证明新凭据响应先完成后，旧响应会覆盖当前 catalog
- [ ] 1.3 用户批准“每 profile 仅最新发现/失效意图可提交状态”的语义

## 2. Implementation (approval required)

- [ ] 2.1 先补迟到成功、迟到失败、凭据失效、clear 和跨 profile 红测
- [ ] 2.2 实现每 profile request ownership，使过期响应不写 catalog/status/error/persistence/event
- [ ] 2.3 如 stale outcome 需要调用端识别，最小调整 settings discovery analytics/错误处理

## 3. Verification

- [ ] 3.1 运行 runtime discovery 失序、失败、空列表、凭据切换和多 profile 测试
- [ ] 3.2 运行 F-09 model sort/discovery/settings/provider routing/adapter/health/preference/selector 窄簇
- [ ] 3.3 运行定向 lint、drawnix typecheck、全仓 test/typecheck/cycles/build:web/size/startup 及可用 E2E
- [ ] 3.4 在可用浏览器中复验慢网络下切换凭据、重新获取、失败和打开模型管理的反馈
- [ ] 3.5 OpenSpec CLI 不可用时记录阻塞并完成 delta 结构/冲突人工核对

