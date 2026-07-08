# Sora-2 角色创建功能开发计划

## 功能概述

为 Sora-2 视频模型添加角色创建和复用功能，用户可以从已完成的视频任务中提取角色，并在后续视频生成中通过 `@username` 方式引用该角色。

## API 接口说明

### 1. 创建角色接口

- **URL**: `POST https://foropencode.com/v1/videos`
- **Content-Type**: `multipart/form-data`

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `character_from_task` | string | 是 | 源视频任务ID，格式: `sora-2:task_xxx` |
| `model` | string | 是 | 固定值: `sora-2-character` |
| `character_timestamps` | string | 否 | 时间范围，格式: `start,end`，差值需在1-3秒内 |

**响应示例**:
```json
{
  "id": "sora-2-character:ch_6944ed3a51888191bd1ac40c763620fb"
}
```

### 2. 查询角色接口

- **URL**: `GET https://foropencode.com/v1/videos/{id}`
- **认证**: Bearer Token

**响应示例**:
```json
{
  "id": "sora-2-character:ch_6944ed3a51888191bd1ac40c763620fb",
  "username": "xscjkajd.lunaradian",
  "permalink": "https://sora.chatgpt.com/profile/xscjkajd.lunaradian",
  "profile_picture_url": "https://filesystem.site/cdn/xxx.jpg"
}
```

## 开发任务清单

### 阶段一：基础架构（预计 2-3 天）

#### Task 1: 创建角色类型定义
- **文件**: `packages/drawnix/src/types/character.types.ts`
- **内容**:
  - `SoraCharacter` 接口（角色完整信息）
  - `CharacterStatus` 枚举（pending/processing/completed/failed）
  - `CreateCharacterParams` 接口（创建参数）
  - `CharacterQueryResponse` 接口（查询响应）

#### Task 2: 实现角色 API 服务
- **文件**: `packages/drawnix/src/services/character-api-service.ts`
- **功能**:
  - `createCharacter()` - 提交角色创建请求
  - `queryCharacter()` - 查询角色状态
  - `createCharacterWithPolling()` - 创建并轮询直到完成
- **依赖**: Task 1

#### Task 3: 实现角色存储服务
- **文件**: `packages/drawnix/src/services/character-storage-service.ts`
- **功能**:
  - IndexedDB 存储（使用 localforage）
  - `saveCharacter()` - 保存角色
  - `getCharacters()` - 获取所有角色
  - `getCharacterById()` - 按ID获取
  - `deleteCharacter()` - 删除角色
  - `updateCharacter()` - 更新角色状态
- **存储键**: `sora-characters`
- **依赖**: Task 1

#### Task 4: 创建角色状态管理 Hook
- **文件**: `packages/drawnix/src/hooks/useCharacters.ts`
- **功能**:
  - 角色列表状态管理（RxJS BehaviorSubject）
  - `characters` - 角色列表
  - `pendingCharacters` - 处理中的角色
  - `createCharacter()` - 创建角色（带状态更新）
  - `deleteCharacter()` - 删除角色
  - `refreshCharacters()` - 刷新列表
- **依赖**: Task 2, Task 3

### 阶段二：UI 组件（预计 2-3 天）

#### Task 5: 实现角色创建对话框
- **文件**: `packages/drawnix/src/components/character/CharacterCreateDialog.tsx`
- **功能**:
  - 显示源视频信息
  - 时间范围选择器（滑块或输入框）
  - 时间约束验证（1-3秒）
  - 提交/取消按钮
  - 创建中状态显示
- **UI**: 使用 TDesign Dialog + Slider/InputNumber
- **依赖**: Task 4

#### Task 6: 在 TaskItem 中添加「提取角色」按钮
- **文件**: `packages/drawnix/src/components/task-queue/TaskItem.tsx`
- **修改**:
  - 添加「提取角色」按钮（仅对 sora-2 已完成任务显示）
  - 添加 `onExtractCharacter` 回调
  - 按钮条件判断逻辑
- **依赖**: Task 5

#### Task 7: 实现角色卡片组件
- **文件**: `packages/drawnix/src/components/character/CharacterCard.tsx`
- **功能**:
  - 显示头像（profile_picture_url）
  - 显示 @username
  - 复制按钮（复制 @username）
  - 删除按钮
  - 处理中状态（loading）
- **样式**: `character.scss`
- **依赖**: Task 1

#### Task 8: 实现角色列表/选择器组件
- **文件**: `packages/drawnix/src/components/character/CharacterList.tsx`
- **功能**:
  - 显示所有已创建的角色
  - 支持选择角色（用于插入提示词）
  - 空状态提示
  - 可选：搜索过滤
- **依赖**: Task 4, Task 7

### 阶段三：提示词集成（预计 1-2 天）

#### Task 9: 在 PromptInput 中集成 @ 提及功能
- **文件**: `packages/drawnix/src/components/ttd-dialog/shared/PromptInput.tsx`
- **修改**:
  - 监听 `@` 输入
  - 弹出角色选择器（Popup/Dropdown）
  - 选择后插入 `@username`
  - 支持键盘导航（上下选择，回车确认）
- **新文件**: `CharacterMentionPopup.tsx`
- **依赖**: Task 4, Task 8

### 阶段四：状态同步与优化（预计 1 天）

#### Task 10: 页面刷新恢复
- 从 IndexedDB 恢复角色列表
- 恢复处理中的角色创建任务
- 继续轮询未完成的角色

#### Task 11: 错误处理与用户反馈
- API 错误提示（网络错误、超时、服务器错误）
- 角色创建失败处理
- 重试机制

## 文件结构

```
packages/drawnix/src/
├── types/
│   └── character.types.ts          # 角色类型定义
├── services/
│   ├── character-api-service.ts    # 角色 API 服务
│   └── character-storage-service.ts # 角色存储服务
├── hooks/
│   └── useCharacters.ts            # 角色状态管理 Hook
├── components/
│   ├── character/
│   │   ├── index.ts
│   │   ├── CharacterCreateDialog.tsx
│   │   ├── CharacterCard.tsx
│   │   ├── CharacterList.tsx
│   │   ├── CharacterMentionPopup.tsx
│   │   └── character.scss
│   └── task-queue/
│       └── TaskItem.tsx            # 修改：添加提取角色按钮
└── components/ttd-dialog/shared/
    └── PromptInput.tsx             # 修改：添加 @ 提及功能
```

## 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户交互流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 用户点击「提取角色」                                          │
│     │                                                           │
│     ▼                                                           │
│  2. CharacterCreateDialog 弹出                                  │
│     │                                                           │
│     ▼                                                           │
│  3. 用户选择时间范围 → 点击创建                                   │
│     │                                                           │
│     ▼                                                           │
│  4. useCharacters.createCharacter()                             │
│     │                                                           │
│     ├──► characterApiService.createCharacter()                  │
│     │         │                                                 │
│     │         ▼                                                 │
│     │    POST /v1/videos (character_from_task, model)           │
│     │         │                                                 │
│     │         ▼                                                 │
│     │    返回 character_id                                      │
│     │                                                           │
│     ├──► characterStorageService.saveCharacter(pending)         │
│     │                                                           │
│     └──► 开始轮询 queryCharacter()                              │
│              │                                                  │
│              ▼                                                  │
│         GET /v1/videos/{id}                                     │
│              │                                                  │
│              ▼                                                  │
│         返回 username, profile_picture_url                      │
│              │                                                  │
│              ▼                                                  │
│  5. characterStorageService.updateCharacter(completed)          │
│     │                                                           │
│     ▼                                                           │
│  6. UI 更新显示角色卡片                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## UI 设计参考

### 1. 提取角色按钮位置

```
┌─────────────────────────────────────────────────────────────────┐
│ TaskItem (sora-2 已完成任务)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎬 [prompt text...]                                            │
│                                                                 │
│  sora-2 | 10秒 | 1920x1080 | ✅ 已完成                          │
│                                                                 │
│  [预览图]                                                        │
│                                                                 │
│  [删除] [下载] [插入] [缓存] [编辑] [👤 提取角色]                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 角色创建对话框

```
┌─────────────────────────────────────────────────────────────────┐
│  提取角色                                                   [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  从视频中提取角色，创建后可在后续视频中通过 @username 引用        │
│                                                                 │
│  源视频: 一只白色的猫在花园里玩耍...                             │
│  任务ID: sora-2:task_01kbh21pg...                               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  时间范围 (角色在视频中出现的位置)                               │
│                                                                 │
│  开始时间: [0   ] 秒    结束时间: [3   ] 秒                     │
│                                                                 │
│  ⓘ 时间范围需在 1-3 秒之间                                      │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│                               [取消]  [创建角色]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. 角色卡片

```
┌──────────────────────────────────┐
│  ┌────────┐                      │
│  │  头像  │  @xscjkajd.lunar...  │
│  │  64x64 │                      │
│  └────────┘  [📋 复制] [🗑 删除] │
│                                  │
│  来源: 白猫视频任务              │
│  创建于: 2024-01-15 14:30        │
└──────────────────────────────────┘
```

### 4. @ 提及弹窗

```
提示词输入框:
┌─────────────────────────────────────────────────────────────────┐
│ 一只猫在追逐 @|                                                 │
└─────────────────────────────────────────────────────────────────┘
              ↓
        ┌─────────────────────────────────┐
        │ 📷 @xscjkajd.lunaradian        │ ← 选中
        │ 📷 @abc123.character            │
        │ ─────────────────────────────── │
        │ + 从视频提取新角色...            │
        └─────────────────────────────────┘
```

## 技术要点

### 1. 模型判断逻辑

```typescript
// 判断是否可以提取角色
const canExtractCharacter = (task: Task): boolean => {
  return (
    task.status === TaskStatus.COMPLETED &&
    task.type === TaskType.VIDEO &&
    task.remoteId?.startsWith('sora-2:') &&
    ['sora-2', 'sora-2-pro'].includes(task.params.model || '')
  );
};
```

### 2. 时间范围验证

```typescript
const validateTimestamps = (start: number, end: number, videoDuration: number): boolean => {
  const duration = end - start;
  return (
    start >= 0 &&
    end <= videoDuration &&
    duration >= 1 &&
    duration <= 3
  );
};
```

### 3. IndexedDB 存储结构

```typescript
// 存储键: 'sora-characters'
// 数据结构: SoraCharacter[]
{
  id: 'sora-2-character:ch_xxx',
  username: 'xscjkajd.lunaradian',
  profilePictureUrl: 'https://...',
  permalink: 'https://...',
  sourceTaskId: 'local-task-uuid',
  sourceVideoId: 'sora-2:task_xxx',
  characterTimestamps: '0,3',
  status: 'completed',
  createdAt: 1705312200000,
  completedAt: 1705312260000,
}
```

## 测试要点

1. **API 集成测试**
   - 角色创建请求格式正确
   - 轮询查询正常工作
   - 错误响应处理

2. **UI 交互测试**
   - 提取角色按钮仅对符合条件的任务显示
   - 时间范围选择器约束正确
   - 角色创建状态实时更新
   - @ 提及弹窗正确显示和选择

3. **数据持久化测试**
   - 刷新页面后角色列表恢复
   - 角色删除后正确移除
   - 处理中任务恢复轮询

## 开发顺序建议

```
Week 1:
├── Day 1-2: Task 1-3 (类型定义 + API服务 + 存储服务)
├── Day 3: Task 4 (状态管理 Hook)
└── Day 4-5: Task 5-6 (创建对话框 + TaskItem按钮)

Week 2:
├── Day 1-2: Task 7-8 (角色卡片 + 列表组件)
├── Day 3-4: Task 9 (@ 提及功能)
└── Day 5: Task 10-11 (状态同步 + 错误处理)
```

## 后续扩展

1. **角色库面板** - 独立的角色管理界面
2. **角色分组/标签** - 组织和筛选角色
3. **角色使用统计** - 追踪角色使用频率
4. **批量导出** - 导出角色数据备份
5. **角色分享** - 跨设备同步角色（需后端支持）
