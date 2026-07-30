## 1. Evidence and Approval

- [x] 1.1 完成 GitHub sync engine → task page → restoreTasks → 启动 reader 正反向调用链
- [x] 1.2 静态证明下载路径没有 IndexedDB writer，批量事件只携带一个代表任务
- [ ] 1.3 用户批准“成功下载的终态任务持久化并跨刷新保留”的存储语义

## 2. Implementation (approval required)

- [ ] 2.1 先补新增/新旧冲突/写失败/刷新读取/批量 UI 红测试
- [ ] 2.2 实现按 id + updatedAt 的批量 merge-if-newer 存储操作
- [ ] 2.3 仅恢复成功写入集合并发出完整批量状态刷新

## 3. Verification

- [ ] 3.1 运行 GitHub paged sync、task storage、task queue UI 窄测试
- [ ] 3.2 生产构建中同步相同一页 5 次，记录写入数、耗时中位数和范围
- [ ] 3.3 运行 typecheck、lint、全仓 test、cycles、build:web、size、startup 与可用 E2E
- [ ] 3.4 复审备份恢复、归档、提示词历史、素材库和多标签页相邻路径
- [ ] 3.5 OpenSpec CLI 不可用时记录阻塞并完成文件核查

