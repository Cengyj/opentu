# PSD 工作流测试与验收记录

## 验收目标

PSD 模式复用现有 **AI 图片生成** 窗口，不新增独立向导、移动端标签页、`TaskType.PSD` 或 `AssetType.PSD`。当前工作台流程为：用户上传参考图并输入提示词后，先创建 `TaskType.CHAT` 图层分析任务；用户在 PSD 工作台审阅、重命名、调整图层提示词或排除图层；确认后再为参与的栅格图层创建现有 `TaskType.IMAGE` 图层素材任务。导出结果是 `.psd-ready-workspace.zip` 工作区包，不宣称 OpenAI 兼容图片 API 或上游图片模型直接返回原生 `.psd`。

## GPT Image 2 协议边界

- `gpt-image-2` 图片编辑走 `/v1/images/edits`，请求为 multipart form data，输入图片放在 `image[]`。
- `gpt-image-2` 不支持 `input_fidelity`；图片输入默认按高保真处理，前端和任务参数都不能主动发送 `inputFidelity` / `input_fidelity`。
- GPT Image 2 官方响应不需要 `response_format` 参数；解析层仍兼容网关返回的 URL 或官方 base64 图片数据。
- `gpt-image-2` 不支持 `background=transparent`；PSD 图层素材任务统一使用 `background=auto`，由提示词和后续打包元数据表达同画布透明图层语义。
- 公开 Image API 返回图片数据，不返回可直接下载的原生分层 `.psd`。PSD-ready 工作区必须由前端/本地/服务端 packer 基于图层图片结果和 `psdPlan` 元数据打包。

## 数据模型边界

- PSD 图层计划集中在 `packages/drawnix/src/components/ttd-dialog/ai-psd-plan.ts`，由现有 AI 图片窗口内的 PSD 工作台消费，不扩展全局任务/素材枚举。
- `buildLayerPlan` 生成本地图层建议：`planId`、模板/策略、可编辑图层、图层状态和 `exportSkeleton`。`exportSkeleton.sourceSetting` 必须是 `photoshop`，`exportSkeleton.packaging` 必须是 `app-side-required`，`exportSkeleton.nativePsdReady` 必须保持 `false`。
- 分层流程先创建 `TaskType.CHAT` 分析任务，解析为本地图层计划后进入审阅态；在用户确认前不得创建图层图片任务。
- 用户可在审阅态重命名图层、编辑图层生成提示词、切换是否参与生成/导出；确认后只为参与的栅格图层创建现有 `TaskType.IMAGE` 任务。
- 每个图层图片任务必须携带 `psdPlan.layerId`，工作台用该字段把任务状态、结果 URL 和重试结果映射回对应图层。
- 失败或取消的图层必须支持单层重试和全部失败图层重试；重试不得重新生成已成功图层。
- 导出包名和 UI 文案必须表达 `.psd-ready-workspace.zip`，允许包含部分成功图层，并在 manifest 中记录失败/取消图层；不得写成原生 `.psd` 下载。
- 不新增 `TaskType.PSD`、`AssetType.PSD` 或供应商协议字段；PSD 能力仍建立在现有 `TaskType.CHAT` 与 `TaskType.IMAGE` 任务之上。

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

1. 打开白板，点击工具栏 **AI 图片生成**，切换到 **生成 PSD**，确认仍在现有 AI 图片窗口内。
2. 上传原始海报或参考图，输入设计描述，点击分析/生成入口。
3. 确认系统先进入图层分析态，并创建 `TaskType.CHAT` 分析任务；此时不得立即创建图层 `TaskType.IMAGE` 任务。
4. 分析完成后，确认 PSD 工作台展示画布预览、图层工作区、图层名称、图层提示词、显隐/参与生成开关、状态和导出区域。
5. 修改图层名称、图层提示词或排除某个图层，确认后续生成计划使用修改后的本地图层计划。
6. 点击用户确认后的图层素材生成按钮，确认只为参与的栅格图层创建现有 `TaskType.IMAGE` 任务，且每个任务参数包含 `psdPlan.layerId`。
7. 确认图层面板按 `psdPlan.layerId` 展示排队、生成中、完成、失败或取消状态，并能重试单个失败图层或全部失败图层。
8. 在存在部分失败图层时下载工作区，确认仍可导出 `.psd-ready-workspace.zip`，包内包含成功图层素材、source、manifest 和 README，manifest 记录失败/取消图层。
9. 回到 AI 图片生成与批量出图模式，确认原有模式仍可切换，未出现 `TaskType.PSD`、`AssetType.PSD` 或原生 `.psd` 供应商响应声明。

## 回归风险清单

- PSD 工作台应复用图片模型选择、参考图、知识库上下文、提示词历史和现有任务队列，不创建新的任务/素材类型。
- 分析完成后必须先让用户审阅/编辑图层计划，再创建图层图片任务。
- 图层任务和结果必须通过 `psdPlan.layerId` 稳定映射，避免重试或乱序回调覆盖错误图层。
- 当前输出是 PSD-ready 工作区 zip + manifest；任何真实 PSD 打包都应在本地/服务端导出层完成，不能把 OpenAI 兼容图片 API 响应描述为原生 PSD。
