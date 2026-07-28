# Change: 更新默认文本模型展示并保留用户模型选择

## Why

当前文本选择器需要同时处理“尚未管理供应商模型”的新用户和“已经获取并选择供应商模型”的用户。现有实现无条件把默认展示模型追加到运行时选择结果，导致用户更新 API Key 并选择新模型后，默认 GPT 模型仍然出现在列表中，甚至继续保持选中。

本变更只调整新用户的默认推荐和模型显示兼容性，不迁移、删除或重写用户已经添加或选择的模型。

## What Changes

- 增加 `gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna` 的静态文本模型定义
- 将三个 GPT-5.6 模型设为文本默认展示项，并将 Sol 设为新默认文本模型
- 保留旧 GPT-5.5、GPT-5.4、GPT-5.4 Mini 静态定义和显式使用能力
- 允许已明确选择但不再属于默认展示项的旧静态文本模型继续 pin 和反显
- 将供应商发现结果中的静态模型推荐范围收敛到当前默认展示集合
- 引入双模式展示：没有权威供应商目录时展示内置默认；进入供应商模型管理模式后只展示启用供应商中用户已选择的模型
- 在供应商模型管理模式下禁止通过旧选中态重新 pin 未选择的静态模型或发现模型
- 当旧选中态或默认预设不再可见时，切换到同类型有效用户模型；没有替代模型时清空该路由
- 不迁移用户设置、preset、模型缓存、供应商目录、历史任务或自定义供应商路由

## Impact

- Affected specs:
  - `runtime-model-discovery`
  - `ai-input-generation`
  - `provider-routing`
- Affected code:
  - `packages/drawnix/src/constants/model-config.ts`
  - `packages/drawnix/src/utils/runtime-model-discovery.ts`
  - `packages/drawnix/src/utils/settings-manager.ts`
  - `packages/drawnix/src/components/ai-input-bar/AIInputBar.tsx`
  - `packages/drawnix/src/components/ai-input-bar/ModelDropdown.tsx`
  - `packages/drawnix/src/components/chat-drawer/ChatDrawer.tsx`
  - `packages/drawnix/src/components/chat-drawer/ModelSelector.tsx`
  - `packages/drawnix/src/components/chat-drawer/useChatDrawerGenerationControls.ts`
  - `packages/drawnix/src/components/settings-dialog/provider-profile-draft.ts`
  - `packages/drawnix/src/components/settings-dialog/settings-dialog.tsx`
  - `packages/drawnix/src/utils/__tests__/runtime-model-discovery.test.ts`
  - related model selector and settings tests

## Compatibility Boundary

- A model is removed from the default recommendation list, not from the static catalog.
- Existing explicit static model IDs remain valid in built-in fallback mode. In provider-selection mode they remain visible only when the current provider catalog explicitly selects that model ID.
- Runtime provider selections remain controlled by the user's `selectedModelIds` choices.
- Request routing continues to send the selected model ID unchanged.
