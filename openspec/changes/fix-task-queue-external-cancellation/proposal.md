# Change: Fix External Task Cancellation Consistency

## Why

任务面板允许选择 `pending/processing` 任务并执行“取消”。`TaskQueueService.cancelTask()` 只 abort 私有 `executeTask()` 创建的 controller。工作流图片/视频通过 `media-generation` 创建外部任务，实际 signal 归 `MainThreadWorkflowEngine` 所有；`trackExternalTask()` 没有登记取消句柄。

因此任务面板取消外部工作流任务只把内存状态标成 `cancelled`，不会中止仍在运行的 executor。executor 仍可把 IndexedDB 覆盖成 `completed`，`media-generation` 再把结果返回给工作流并完成步骤；刷新后任务也可重新显示为完成。修复会改变任务面板取消的执行语义，必须先审批。

F-20 的队列自有路径存在同一契约缺口。AUDIO 任务虽然创建了 controller，并把 `signal` 放进 `request.params`，Suno adapter 只转发 progress/submitted callback；submit、fetch、轮询 sleep 都没有 signal。Music Analyzer 的分析、歌词改写和文本歌词生成专用 CHAT 执行器也不消费 `executionOptions.signal`。此外 AUDIO 在第一次 cancelled guard 后进入音频/封面缓存，缓存完成到 `completed` 写回之间没有第二次 guard；在这个窗口取消可被迟到成功覆盖。

## What Changes

- 为任务队列拥有、角色专用 Hook 拥有和外部工作流拥有的任务建立统一取消契约。
- 用户从任务面板取消时，中止仍可中止的本地请求/轮询并阻止迟到结果覆盖 `cancelled` 终态。
- 让 Suno AUDIO submit/fetch/backoff sleep 与 Music Analyzer 专用 CHAT 执行路径消费同一 signal，并在音频/封面缓存前后拒绝取消后的成功写回。
- 工作流取消仍通过工作流 controller 传播；任务取消只影响目标任务及其必要的拥有者步骤，不扩展到无关任务。
- 不承诺撤销供应商已经接受且不支持取消的远端作业，但本地状态和自动插入不得改回成功。

## Impact

- Affected specs: `task-cancellation-consistency`
- Affected code: task queue service, media-generation image/video services, workflow engine task binding, Suno audio adapter/API polling, Music Analyzer dedicated CHAT executors, media executor/storage/cache write guards, task panel and Music Analyzer lifecycle tests
- User-visible trade-off: 任务面板“取消”会真正终止本地等待并保持取消终态，而不是后台继续完成

## Additional F-20 Evidence

- `task-queue-service.ts:618-620,654-707` 创建 signal 并只把它嵌入 AUDIO request params。
- `default-adapters.ts:304-330` 只读取 `onProgress` 与 `onSubmitted`，没有把 signal 交给 audio service。
- `audio-api-service.ts:875-1118` 的 transport、polling options 和 sleep 均无 AbortSignal。
- `task-queue-service.ts:1501-1780` 的 Music Analyzer 分析、改写和文本歌词执行路径未接收 signal。
- `task-queue-service.ts:709-865` 只在缓存前检查 cancelled，随后可以缓存多个音频/封面并无条件写 `completed`。
