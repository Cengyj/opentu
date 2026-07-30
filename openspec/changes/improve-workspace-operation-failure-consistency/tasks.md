## 1. Evidence and Approval

- [x] 1.1 完成创建、重命名、删除的存储调用顺序静态证明
- [x] 1.2 完成 Hook `null/false` 与 ProjectDrawer 反馈丢失的反向追踪
- [ ] 1.3 用户批准失败时 persist-first、明确错误和部分成功反馈语义

## 2. Implementation (approval required)

- [ ] 2.1 先补单记录存储拒绝导致内存分叉的失败测试
- [ ] 2.2 将 createFolder/createBoard/renameFolder/deleteBoard 改为 persist-first
- [ ] 2.3 将远程删除副作用移到本地删除成功之后
- [ ] 2.4 为 create/delete/copy 失败补明确、可重试的项目抽屉反馈
- [ ] 2.5 为批量/递归部分失败补准确计数与树状态测试

## 3. Verification

- [ ] 3.1 运行定向服务、Hook 与 ProjectDrawer 测试，记录退出码和统计
- [ ] 3.2 运行 typecheck、lint、全仓 test、cycles 与 production build
- [ ] 3.3 复审正常、取消、失败、重试、刷新恢复和 GitHub 删除相邻路径
- [ ] 3.4 运行 OpenSpec CLI 校验；CLI 不可用时记录工具阻塞并完成文件核查
