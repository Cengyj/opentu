## 1. Evidence and Approval

- [x] 1.1 完成对话框 → 导入服务 → workspace reload → 恢复转场正反向调用链
- [x] 1.2 静态证明 reload 后完整缓存被元数据投影替代，现有非空确认分支被绕过
- [ ] 1.3 用户批准“非空当前画板必须确认后才切换”的恢复转场

## 2. Implementation (approval required)

- [ ] 2.1 先补 reload 后元数据投影误判的组件回归测试
- [ ] 2.2 使用完整持久化内容判断当前画板是否为空
- [ ] 2.3 覆盖空画板自动切换、非空确认、取消、目标缺失与读取失败

## 3. Verification

- [ ] 3.1 运行定向组件与备份恢复测试，记录退出码和统计
- [ ] 3.2 merge/replace 生产构建路径各重复 5 次并保存前后证据
- [ ] 3.3 运行 typecheck、lint、全仓 test、cycles、build:web、size 与 startup 校验
- [ ] 3.4 复审关闭快照、多标签页和 GitHub 同步相邻路径
- [ ] 3.5 运行 OpenSpec CLI 校验；CLI 不可用时记录工具阻塞并完成文件核查
