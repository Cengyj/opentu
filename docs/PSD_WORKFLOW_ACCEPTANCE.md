# PSD 工作流测试与验收记录

## 验收目标

PSD 模式仍然基于现有 AI 图片生成窗口与 `TaskType.IMAGE` 工作流，当前阶段提供 GPT 官网风格的一键式 PSD-ready 流程：用户只提供参考图 + 提示词，系统自动提交 1 个 GPT Image 编辑任务，生成 PSD-ready 图片与后续 Photoshop/PSD 打包元数据。不得新增 `TaskType.PSD` / `AssetType.PSD`，也不得宣称 OpenAI 兼容图片 API 会直接返回原生 PSD。

## GPT Image 2 协议边界

- `gpt-image-2` 图片编辑走 `/v1/images/edits`，请求为 multipart form data，输入图片放在 `image[]`。
- `gpt-image-2` 不支持 `input_fidelity`；图片输入默认按高保真处理，前端和任务参数都不能再主动发送 `inputFidelity` / `input_fidelity`。
- GPT Image 2 官方响应不需要 `response_format` 参数；解析层仍兼容网关返回的 URL 或官方 base64 图片数据。
- `gpt-image-2` 不支持 `background=transparent`；PSD 流程统一使用 `background=auto`。
- 公开 Image API 返回图片数据，不返回可直接下载的原生分层 `.psd`。真正 PSD 文件必须由后续本地/服务端 PSD packer 根据图片结果和 `psdPlan` 元数据打包。

## 数据模型边界

- PSD 图层计划集中在 `packages/drawnix/src/components/ttd-dialog/ai-psd-plan.ts`，由一键 UI 组件消费，不扩展全局任务/素材枚举。
- `buildLayerPlan` 只生成本地图层建议：`planId`、固定模板/策略、可编辑图层、图层状态和 `exportSkeleton`。`exportSkeleton.sourceSetting` 必须是 `photoshop`，`exportSkeleton.packaging` 必须是 `app-side-required`，`exportSkeleton.nativePsdReady` 必须保持 `false`。
- `buildPsdReadyImageTaskPlan` 只创建 1 个 `TaskType.IMAGE` 编辑任务：`generationMode=image_edit`、`background=auto`、`outputFormat=png`、`batchTotal=1`，并携带 `psdPlan.suggestedLayers` 作为后续打包参考。
- 旧的逐图层素材计划只能作为内部兼容工具存在；当前一键 UI 不应批量创建多个独立图层生成任务，因为独立生成难以保证坐标和视觉一致。
- UI 不再暴露模板、策略、图层数量或模型参数调节；这些由系统内部固定处理，避免把 GPT 官网的一键 PSD 流程退化成参数面板。

## 自动化验证

在改动 PSD 工作流、GPT Image 2 协议或导出骨架时，至少运行：

```bash
pnpm exec vitest run packages/drawnix/src/services/__tests__/gpt-image-adapter.test.ts packages/drawnix/src/components/ttd-dialog/ai-psd-generation.test.tsx --exclude '.omx/**'
pnpm exec nx run drawnix:typecheck
pnpm exec nx run drawnix:lint
```

新增或调整浏览器验收时，运行：

```bash
pnpm exec playwright test apps/web-e2e/src/features/features.spec.ts --project=chromium
```

容器发布前，运行：

```bash
docker build -t opentu:local .
docker rm -f opentu-web 2>/dev/null || true
docker run -d --name opentu-web --restart unless-stopped -p 7288:80 opentu:local
curl -sS -o /tmp/opentu-index.html -w 'status=%{http_code} bytes=%{size_download}\n' http://127.0.0.1:7288/
```

## 浏览器手工验收

1. 打开白板，点击工具栏 **AI 图片生成**。
2. 在 AI 图片窗口切换到 **生成 PSD**。
3. 确认窗口只显示 **参考图**、**提示词**、一个 **生成 PSD-ready 结果** 主按钮，以及“图像生成 / 思考拆层 / 源设置：Photoshop / 导出编辑”四段流程说明。
4. 确认窗口内显示 API 限制说明：公开 GPT Image API 当前返回图片数据而不是原生 `.psd`，当前阶段先生成 1 张 PSD-ready 图片和拆层元数据，并把 Photoshop/PSD 打包作为后续本地或服务端导出能力。
5. 确认没有模板、策略、图层数量、模型参数、草稿编辑、显隐、删除、复制等调参/编辑控件。
6. 上传原始海报或参考图，输入设计描述，点击 **生成 PSD-ready 结果**。
7. 确认状态显示 **PSD-ready 任务已排队 / 生成中 / 已完成 / 失败** 中的真实任务状态；长时间排队时提示用户去任务队列查看密钥、额度或接口错误。
8. 确认只创建 1 个现有 `TaskType.IMAGE` 编辑任务，且请求不会发送 `input_fidelity`、`response_format` 或 `background=transparent` 给 `gpt-image-2`。
9. 回到 AI 图片生成与批量出图模式，确认原有模式仍可切换，未出现 `TaskType.PSD` 或 `AssetType.PSD` 的任务/素材类型。

## 回归风险清单

- PSD 一键流应只复用图片模型选择、参考图、知识库上下文和提示词历史，不创建新的任务类型。
- 文字层说明必须强调“可编辑文本层”，避免把重要文字烘焙进单张生成图。
- 当前输出仍是 PSD-ready 图片 + 元数据，真正 `.psd` 文件导出是后续 packer 能力。
- 任何后续接入真实 PSD 打包的实现都应在本地/服务端导出层完成，不能把 OpenAI 兼容图片 API 的响应描述为原生 PSD。
