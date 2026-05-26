# PSD 工作流测试与验收记录

## 验收目标

PSD 模式仍然基于现有 AI 图片生成窗口与 `TaskType.IMAGE` 工作流，当前阶段提供 GPT-Image2 文章同款的一键式 PSD 准备流程：参考图 + 提示词，自动按“图像生成 → 思考拆层 → Photoshop 源设置 → 导出编辑”准备同画布分层素材和后续导出元数据。不得新增 `TaskType.PSD` / `AssetType.PSD`，也不得宣称 OpenAI 兼容图片 API 会直接返回原生 PSD。

## 数据模型边界

- PSD 图层计划集中在 `packages/drawnix/src/components/ttd-dialog/ai-psd-plan.ts`，由一键 UI 组件消费，不扩展全局任务/素材枚举。
- `buildLayerPlan` 只生成本地图层计划：`planId`、固定模板/策略、可编辑图层、图层状态和 `exportSkeleton`。`exportSkeleton.sourceSetting` 必须是 `photoshop`，`exportSkeleton.packaging` 必须是 `app-side-required`，`exportSkeleton.nativePsdReady` 必须保持 `false`。
- `buildPsdLayerImageTaskPlans` 只为可见的视觉图层（背景、图片、装饰）准备 `TaskType.IMAGE` 任务计划；文字层和调整/说明层保留为可编辑/待导出信息，不应创建 PSD 专属任务。
- 图层任务参数可以携带轻量 `psdPlan` 元数据用于后续关联，但生成结果仍按现有图片素材路径处理，不能新增 `AssetType.PSD`。
- UI 不再暴露模板、策略、图层数量或模型参数调节；这些由系统内部固定处理，避免把文章中的一键 PSD 流程退化成参数面板。

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
3. 确认窗口只显示 **参考图**、**提示词**、一个 **生成 PSD 文件** 主按钮，以及“图像生成 / 思考拆层 / 源设置：Photoshop / 导出与编辑”四段流程说明。
4. 确认窗口内显示 API 限制说明：公开图片 API 当前返回图片数据而不是原生 `.psd`，当前阶段先生成/编辑同画布分层素材，并把 Photoshop/PSD 打包作为后续本地或服务端导出能力。
5. 确认没有模板、策略、图层数量、模型参数、草稿编辑、显隐、删除、复制等调参/编辑控件。
6. 上传原始海报或参考图，输入设计描述，点击 **生成 PSD 文件**。
7. 确认状态显示 **PSD 工作流已启动**，并说明已准备同画布分层素材、保留原坐标和 Photoshop/PSD 导出元数据；不要出现“已下载/已生成原生 PSD”等假成功。
8. 确认只创建现有 `TaskType.IMAGE` 图层素材任务；文字层和说明层不应被伪装为原生 PSD 生成任务。
9. 回到 AI 图片生成与批量出图模式，确认原有模式仍可切换，未出现 `TaskType.PSD` 或 `AssetType.PSD` 的任务/素材类型。

## 回归风险清单

- PSD 一键流应只复用图片模型选择、参考图、知识库上下文和提示词历史，不创建新的任务类型。
- 文字层说明必须强调“可编辑文本层”，避免把重要文字烘焙进单张生成图。
- 图层导出仍是后续骨架，当前 UI 只验证同画布素材队列和 Photoshop/PSD 导出元数据状态。
- 任何后续接入真实 PSD 打包的实现都应在本地/服务端导出层完成，不能把 OpenAI 兼容图片 API 的响应描述为原生 PSD。
