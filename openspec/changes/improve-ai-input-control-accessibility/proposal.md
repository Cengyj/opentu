# Change: 补齐 AI 输入栏与附件操作的可访问性

## Why

画布底部 `AIInputBar` 的上传图片、打开素材库和发送按钮只渲染图标，没有按钮文本或 `aria-label`。屏幕阅读器无法从按钮自身获得操作名称；同一项目的 Chat Drawer 已为对应操作提供可访问名称，形成了可验证的不一致。

上传内容的共享移除按钮也只有图标和 HoverTip，没有可访问名称；当前命中框为 16×16 CSS px，默认透明且只有 `:hover` 会显示。真实浏览器在桌面、平板和移动视口均无法按“移除”名称找到该按钮，390×844 截图也证明非悬停状态没有可见移除提示。这个既有操作同时出现在主 AI 输入栏和 Chat Drawer，需要在不改变附件状态、提交或布局所有权的前提下恢复可感知、可聚焦和可触控的操作契约。

## What Changes

- 为 `AIInputBar` 的上传图片、打开素材库和发送按钮提供中英文可访问名称
- 为可移除附件提供本地化且可区分的可访问名称
- 让附件移除按钮在键盘焦点和非悬停输入方式下可见，并提供至少 24×24 CSS px 的命中目标
- 将非提交型图标按钮明确声明为 `type="button"`
- 保持附件增删语义、上传/粘贴、提交、模型、任务执行和桌面/平板布局不变；移动工具栏与输入框的外层避让继续由 `fix-mobile-toolbar-input-overlap` 独立拥有

## Impact

- Affected specs: `ai-input-generation`
- Affected code:
  - `packages/drawnix/src/components/ai-input-bar/AIInputBar.tsx`
  - `packages/drawnix/src/components/shared/SelectedContentPreview.tsx`
  - `packages/drawnix/src/components/shared/selected-content-preview.scss`
  - AI 输入栏/Chat Drawer 的可访问性测试或浏览器验证
- Related changes: `fix-mobile-toolbar-input-overlap` owns outer mobile surface clearance; this change does not move either fixed surface or change z-index
- Data/API impact: none; no public component API, persisted state, cache, task, workflow, provider route, migration, or analytics schema change
- Rollback: remove only the added button attributes, scoped focus/coarse-pointer visibility/target rules, and focused tests; stored attachments and assets remain compatible
