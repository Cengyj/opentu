# Reachable registry and feature-ledger coverage audit

Date: 2026-07-30 (Asia/Shanghai)

## Scope and interpretation

This is a source-reachability and ledger-ownership audit. A missing ledger owner is a documentation coverage gap, not evidence that the product behavior is defective. A manifest, enum value, or static search hit is counted only when the current composition has a reachable writer and mounted consumer. Line references describe the 2026-07-30 source snapshot; Git history and worktree cleanliness cannot be checked because this directory has no Git metadata.

## Built-in tool registry

`packages/drawnix/src/tools/built-in-manifests.tsx:26-167` registers 12 tools. `packages/drawnix/src/tools/registry.tsx:10-74` has matching lazy component loaders for all nine internal-component manifests; the remaining three manifests use external URLs.

| Reachable manifest | Component/boundary | Ledger owner |
| --- | --- | --- |
| `comic-creator` | internal component | F-16 |
| `video-analyzer` | internal component | F-17 |
| `mv-creator` | internal component | F-18 |
| `batch-image` | internal component | F-19 |
| `music-analyzer` | internal component | F-20 |
| `chat-mj` | external URL | F-21 |
| `model-benchmark` | internal component | F-22 |
| `prompt-history` | internal component | F-14 |
| `banana-prompt` | external URL | F-21 |
| `pose-library` | external URL | F-21 |
| `knowledge-base` | internal component | F-23 |
| `music-player` | internal component | F-24 |

Result: 12/12 manifests have a feature-ledger owner. This result does not assert that their feature cycles are complete.

## Dialog registry

`packages/drawnix/src/hooks/use-drawnix.tsx:15-20` defines four `DialogType` values. `packages/drawnix/src/components/ttd-dialog/ttd-dialog.tsx:689-721,723-857` mounts all four consumers.

| Dialog type | Reachable writers | Ledger owner |
| --- | --- | --- |
| `aiImageGeneration` | creation/more/unified toolbars, task panels, workflow tools and feature tools | F-08; upstream handoffs retain their own feature owners |
| `aiVideoGeneration` | creation/more/unified toolbars, task panels, workflow tools and feature tools | F-08; upstream handoffs retain their own feature owners |
| `mermaidToDrawnix` | creation toolbar `:557-558`, more-tools `:424-425`, command registry `:395-400` | newly registered F-30 |
| `markdownToDrawnix` | creation toolbar `:559-560`, more-tools `:427-428`, command registry `:402-406` | newly registered F-30 |

Result: the two generation dialogs already had an owner. The two text-conversion dialogs were reachable but lacked a complete user-intent owner; this audit registers F-30 without making a runtime-defect claim.

## Application menu

The current application-menu composition is `packages/drawnix/src/components/toolbar/app-toolbar/app-toolbar.tsx:89-109`.

| Menu surface | Current owner |
| --- | --- |
| Open `.drawnix`, save `.drawnix`, export PNG/JPG, clear board, clean invalid media links | newly registered F-29 |
| Language and Settings | F-26 |
| Backup/restore and cloud sync | F-03 |
| Debug panel | F-27, with SW-specific boundaries in F-01/F-27 |
| Quick commands | panel shell/search/navigation is newly registered F-31; command targets remain with F-04/F-05/F-25/F-26/F-29/F-30 |
| User manual and version/changelog | F-26 application/help surface; startup/update delivery remains F-01 |

The first five menu entries are directly composed at `app-toolbar.tsx:89-93`. Their implementation spans `app-menu-items.tsx:38-168,326-458`, file serialization, filesystem access, image export, board history, media cache and workspace autosave. They therefore form one complete canvas file/export/maintenance user intent rather than five file-local cleanup tasks.

## Command registry

`packages/drawnix/src/components/command-palette/command-registry.ts:27-418` returns commands in seven groups. Ownership follows the performed user intent, not the command-palette component:

| Group | Entry count | Owner boundary |
| --- | ---: | --- |
| tool | 13 | F-04/F-05/F-25 |
| util | 1 | F-04 |
| edit | 12 | F-04/F-05 |
| view | 5 | F-04/F-25 |
| export | 2 | F-29 |
| settings | 2 | F-26 and F-29 |
| ai | 2 | F-30 |

The registry contains 37 current command entries. Static composition confirms every command target group now has a ledger boundary. A 1280×720 production inspection then confirmed that the cross-feature command-panel shell/search/focus/execute user intent itself had no complete owner, so this audit additionally registers F-31. F-31 was subsequently fact-modeled with desktop/compact/landscape production evidence and a controlled component diagnostic; the 37-entry static count itself still does not validate predicates, target outcomes, responsive behavior or localization.

## Confirmed coverage gaps and next gate

1. **F-29 coverage gap — confirmed and registered.** The menu, hotkey and command entries are reachable, but the previous F-01–F-28 ledger had no end-to-end owner for file serialization/import, image export, clear-board confirmation and invalid-link cleanup. F-03 owns workspace backup/restore rather than the application-menu `.drawnix` flow.
2. **F-30 coverage gap — confirmed, registered and subsequently fact-modeled.** The two dialog types have three reachable entry families and mounted consumers. F-05 explicitly scopes them out, and no previous row owned their parse/preview/insertion/recovery chain. The completed F-30 investigation and approval-only owners are recorded in `docs/evidence/f30-text-conversion/diagnostics.md`; this registry file does not duplicate those defect conclusions.
3. **No product defect followed from registration alone.** F-29, F-30 and F-31 were each investigated afterward with separate evidence chains. Their confirmed findings remain approval-blocked; runtime changes are still forbidden until the corresponding independent OpenSpec change is approved.
4. **F-31 shell coverage gap — confirmed, registered and subsequently fact-modeled.** Earlier mapping assigned all 37 command targets to feature owners but did not own opening, searching, focus/navigation, predicate projection, command execution and return as one user intent. The completed evidence and two approval-only owners are recorded in `docs/evidence/f31-command-palette/diagnostics.md`; target-specific outcomes remain outside the shell.
