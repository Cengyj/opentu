## 1. Evidence and Approval

- [x] 1.1 完成普通创建与恢复执行入口的正反向调用链
- [x] 1.2 用 21 个受控普通任务测得峰值 21，高于声明上限 20
- [ ] 1.3 用户批准统一调度以及第 21 个任务进入排队状态

## 2. Implementation (approval required)

- [ ] 2.1 先补并发、排队取消、失败释放和恢复交错红测试
- [ ] 2.2 在服务执行边界实现单一并发许可
- [ ] 2.3 收敛 Hook 重复调度并保持角色任务专用执行路径

## 3. Verification

- [ ] 3.1 受控 21 任务场景重复 5 次并记录峰值与顺序
- [ ] 3.2 运行任务队列/恢复/工作流窄测试和相关 lint/typecheck
- [ ] 3.3 运行全仓 typecheck、test、cycles、build:web、size、startup 与可用 E2E
- [ ] 3.4 复审取消、重试、刷新恢复、离线和多标签页相邻路径
- [ ] 3.5 OpenSpec CLI 不可用时记录阻塞并完成文件核查

