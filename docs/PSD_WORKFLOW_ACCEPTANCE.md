# PSD 工作流测试与验收记录

## 验收目标

PSD 模式仍然基于现有 AI 图片生成窗口与 `TaskType.IMAGE` 工作流，第一阶段只提供可编辑的 PSD 草稿编辑器：图层计划、预览、显隐状态和后续导出骨架提示。不得新增 `TaskType.PSD` / `AssetType.PSD`，也不得宣称 OpenAI 兼容图片 API 会直接返回原生 PSD。

## 数据模型边界

- PSD 草稿数据集中在 `packages/drawnix/src/components/ttd-dialog/ai-psd-draft.ts`，由 UI 组件消费，不扩展全局任务/素材枚举。
- `buildLayerPlan` 只生成本地草稿：`draftId`、模板、策略、可编辑图层、图层状态和 `exportSkeleton`。`exportSkeleton.nativePsdReady` 必须保持 `false`，表示当前阶段只是后续 PSD 打包的骨架。
- `buildPsdLayerImageTaskDrafts` 只为可见的视觉图层（背景、图片、装饰）准备 `TaskType.IMAGE` 任务草稿；文字层和调整/说明层保留为可编辑/待导出信息，不应创建 PSD 专属任务。
- 图层任务参数可以携带轻量 `psdDraft` 元数据用于后续关联，但生成结果仍按现有图片素材路径处理，不能新增 `AssetType.PSD`。

## 自动化验证

在改动 PSD 工作流、图层草稿或导出骨架时，至少运行：

```bash
pnpm --dir packages/drawnix exec vitest run src/components/ttd-dialog/ai-psd-generation.test.tsx --config vitest.config.ts
pnpm exec nx run drawnix:typecheck
pnpm exec nx run drawnix:lint
```

新增或调整浏览器验收时，运行：

```bash
pnpm exec playwright test apps/web-e2e/src/features/features.spec.ts --project=chromium
```

容器发布前，运行：

```bash
docker build -t opentu-psd-smoke .
docker run --rm -p 8080:80 opentu-psd-smoke
# 浏览器打开 http://localhost:8080 并执行下方手工验收
```

## 浏览器手工验收

1. 打开白板，点击工具栏 **AI 图片生成**。
2. 在 AI 图片窗口切换到 **分层 PSD**。
3. 确认窗口内显示 API 限制说明：OpenAI 兼容图片 API 不直接返回原生 PSD，当前阶段先生成图层计划和预览。
4. 输入设计描述，选择模板、图层策略与图层数量，点击 **生成 PSD 结构**。
5. 确认右侧出现 PSD 图层计划、层数徽标、背景/主体/文字/装饰/调整层，并且图层显隐按钮会同步影响预览画布。
6. 编辑草稿标题、图层名称/类型/描述/生成提示词，使用添加、复制、排序、删除按钮确认草稿状态可编辑。
7. 点击 **建立图层生成骨架** 时，只应看到 IMAGE 图层任务草稿/队列状态提示；文字层和说明层不应被伪装为原生 PSD 生成任务。
8. 点击 **准备导出骨架** 时，确认没有出现下载原生 PSD 的承诺；导出能力只作为后续本地/服务端打包骨架说明。
9. 回到 AI 图片生成与批量出图模式，确认原有模式仍可切换，未出现 `TaskType.PSD` 或 `AssetType.PSD` 的任务/素材类型。

## 回归风险清单

- PSD 草稿应只复用图片模型选择、参考图、知识库上下文和提示词历史，不创建新的任务类型。
- 文字层说明必须强调“可编辑文本层”，避免把重要文字烘焙进单张生成图。
- 图层导出仍是后续骨架，当前 UI 只验证图层计划和可编辑草稿状态。
- 任何后续接入真实 PSD 打包的实现都应在本地/服务端导出层完成，不能把 OpenAI 兼容图片 API 的响应描述为原生 PSD。
