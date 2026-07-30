## 1. Evidence and Approval

- [x] 1.1 完成任务面板 → task service → 普通/外部执行所有者正反向调用链
- [x] 1.2 静态证明外部工作流 signal 未登记且迟到存储写入不受取消 guard 保护
- [x] 1.3 静态证明 Suno AUDIO、Music Analyzer 专用 CHAT 和音频缓存写回窗口未闭合取消传播
- [ ] 1.4 用户批准“任务面板取消后保持本地取消终态并停止可取消等待”的语义

## 2. Implementation (approval required)

- [ ] 2.1 先补外部图片/视频、Suno polling、Music Analyzer CHAT 与缓存中取消的红测试
- [ ] 2.2 实现外部取消句柄登记、幂等注销和统一终态 guard
- [ ] 2.3 让 AUDIO adapter/API transport、sleep 与 Music Analyzer 专用执行器消费 signal
- [ ] 2.4 同步工作流步骤、Music Analyzer pending UI、自动插入、任务 UI 和持久化取消状态

## 3. Verification

- [ ] 3.1 运行普通/外部/恢复取消、重试和写回竞态测试
- [ ] 3.2 运行任务队列、media-generation、workflow 和插入窄测试
- [ ] 3.3 运行 typecheck、lint、全仓 test、cycles、build:web、size、startup 与可用 E2E
- [ ] 3.4 浏览器复验取消前/中/后、慢网络、刷新恢复和不可撤回远端作业提示
- [x] 3.5 OpenSpec CLI 不可用时记录阻塞并完成文件核查
