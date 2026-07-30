## 1. Evidence and Approval

- [x] 1.1 复现删除最后当前画板后保留已删除画布
- [x] 1.2 复现删除包含当前画板的目录及内容后保留已删除画布
- [x] 1.3 完成 WorkspaceService → ProjectDrawer → App → URL/sessionStorage 正反向调用链
- [ ] 1.4 用户批准“无剩余画板时自动创建并激活默认空画板”的行为

## 2. Implementation (approval required)

- [ ] 2.1 先补单画板、批量和目录级联删除转场的失败测试
- [ ] 2.2 统一计算删除 ID 集与剩余画板候选
- [ ] 2.3 成功删除当前画板后切换候选或创建默认空画板
- [ ] 2.4 同步 App、URL 和 sessionStorage，防止旧 ID 与已删除画布残留
- [ ] 2.5 补替代画板创建/切换失败与取消删除测试

## 3. Verification

- [ ] 3.1 运行定向单元与组件测试，记录退出码和统计
- [ ] 3.2 同一生产构建浏览器路径各重复 5 次并保存截图
- [ ] 3.3 运行 typecheck、lint、全仓 test、cycles、build:web、size 与 startup 校验
- [ ] 3.4 复审刷新恢复、关闭快照、多标签页与 GitHub 删除相邻路径
- [ ] 3.5 运行 OpenSpec CLI 校验；CLI 不可用时记录工具阻塞并完成文件核查
