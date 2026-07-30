# Change: Improve model benchmark content accessibility

## Why

The reachable Model Benchmark Workbench visually marks modality, comparison mode, history filter, active session, score, favorite, and rejected selections, but it does not expose those selected states programmatically. Its builder also presents visible field concepts that are not associated with the corresponding textboxes or prompt textarea, and all application-authored workbench copy bypasses the existing Chinese/English provider.

A production Chromium empty-state run confirmed that switching from text to image moved the `active` class and changed the default prompt while every `aria-pressed`/`aria-selected` value remained absent. The same run confirmed that the model, provider, search, and prompt controls have zero label relationships and fall back to placeholder names. Correcting state, label, structure, and localization contracts is user-observable, so implementation requires approval.

## What Changes

- Expose the existing mutually exclusive and toggle selections with native or equivalent programmatic state while preserving their current values and activation behavior.
- Associate persistent localized labels and instructions with the existing history search, model/provider/target selectors, prompt input, concurrency input, builder groups, and result/history regions.
- Localize application-authored workbench copy through the current Chinese/English provider, including empty and confirmation states, without translating or mutating user/provider/model/session/prompt/result data.
- Preserve benchmark creation, routing, cost/ranking, execution, cancellation, storage, diagnostics, export, analytics, launch handoff, and outer tool-window behavior.

## Impact

- Affected specs: `model-benchmark-content-accessibility` (new delta capability)
- Affected code: `ModelBenchmarkWorkbench.tsx`, F-22-scoped i18n keys, focused component tests, and only necessary content styles
- Adjacent owners:
  - `add-model-benchmark-workbench` owns cost capture and the missing ranking control.
  - `control-model-benchmark-run-lifecycle` owns stop, live execution state, active deletion, and interrupted recovery.
  - `ensure-model-benchmark-storage-consistency` owns storage readiness, ordering, and failure feedback.
  - `sanitize-model-benchmark-diagnostics` owns provider result/error content crossing UI/export/storage/analytics.
  - `scope-model-benchmark-launch-handoff` owns shortcut request consumption.
  - `fix-tool-window-viewport-transition` and `improve-tool-window-accessibility` own outer WinBox geometry/focus/title controls.
- Explicitly deferred: compact/touch geometry, global dark-theme policy, shared TDesign Select/Input/ConfirmDialog defaults, and any new benchmark operation
- Data/network impact: none; no provider call, KV key/schema, session/entry value, prompt, export format, analytics schema, or migration change
- Rollback: remove the content semantics, F-22 i18n keys/consumers, and focused tests; no stored data or cache cleanup is required

## Evidence

- Production `dist/apps/web` in Chromium at 1280×720/DPR 1 exposed four modality buttons, three comparison buttons, and five history-filter buttons, all with `aria-pressed=null`, `aria-selected=null`, and `aria-current=null`.
- Activating image changed its class to `active`, focused the image button, and changed the prompt to the image preset; the selected-state attributes remained null. This proves a real state transition, not a conclusion drawn from class names alone.
- The visible `对比模型` and `参测供应商` concepts were separate generic text while their textboxes were named only by placeholders. Production DOM showed zero `labels`, no `aria-label`, and no `aria-labelledby` for history search, model select input, provider select input, and prompt textarea. `最大并发` is explicitly named and is a non-problem.
- `ModelBenchmarkWorkbench.tsx:647-652,1603-1756,2006-2058,2184-2247` renders the current stateful controls and form/result content; manual feedback selection uses only active CSS classes.
- `ModelBenchmarkWorkbench.tsx` does not import or consume `useI18n`; application-authored builder, history, empty, confirmation, result, error-label, and export-status copy is hard-coded Chinese. The outer tool manager does consume the language provider, so outer title localization does not localize the content.
- Existing 1280×720 before screenshot: `docs/evidence/f22-model-benchmark/workbench-empty-desktop-1280x720.png`. No after screenshot exists.

## Approval

Implementation is blocked until the user approves F-22 content selected-state semantics, label/region relationships, and scoped Chinese/English application copy.
