# Change: Make knowledge-base navigation and actions accessible

## Why

The reachable knowledge-base tree uses clickable `div` rows for directories, user notes, system Skills, and related notes without a role, tab stop, or keyboard handler. Its portalled context menu and menu items are also plain `div` elements. Icon-only editor, tree, related-note, and right-panel buttons rely on hover tips but do not expose accessible names or state relationships.

The controlled 390×844 browser sample recorded all three rendered editor action buttons with no `aria-label` or `title`; source inspection supplies the remaining exact DOM contracts. Keyboard and screen-reader behavior is user-observable, so semantic and focus changes require approval.

## What Changes

- Make directory, note, virtual Skill, related-note, and similar-note selection operable with keyboard while preserving pointer behavior and nested actions.
- Add semantic names and state relationships for expand/collapse, create, rename, delete, duplicate, insert, read/export/media, details tabs, and other icon-only knowledge-base actions.
- Give the portalled context menu menu semantics, roving or deterministic focus, Escape dismissal, and focus return to its invoking row.
- Preserve confirmation rules, selection, storage mutations, shortcuts outside the knowledge base, visual glyphs, and desktop layout.
- Reuse localized strings from the independent knowledge-base localization change when available; do not hard-code a second label source.

## Impact

- Affected specs: `knowledge-base-accessibility`
- Affected code: knowledge-base tree/editor/related/content/tag surfaces, hover/menu integration, focused accessibility tests, and browser snapshots
- Responsive boundary: `fix-knowledge-base-responsive-layout` owns compact pane navigation and 44×44 compact targets; this change owns semantics and keyboard parity for existing knowledge-base actions at every size
- No note, directory, tag, asset, task, cache, backup, or migration format changes
- Rollback removes roles/names/keyboard/focus management and tests; no data cleanup is required

## Current Evidence

- `KBUnifiedTree.tsx:394-451,470-526,557-612` uses pointer-only row selection and unnamed nested icon buttons.
- `KBUnifiedTree.tsx:245-329` portals a context menu of clickable `div` items with no menu/item roles, focus entry, or Escape handler.
- `KBNoteEditor.tsx:305-365` renders icon-only reading/export/media buttons without accessible names.
- `KnowledgeBaseContent.tsx:1098-1142` renders unnamed right-panel icon/tab controls.
- `KBRelatedNotes.tsx:98-171` uses clickable note containers and nested icon buttons without a complete keyboard contract.
- The browser sample's editor-button attributes corroborate the rendered absence; no screen-reader compatibility is inferred from hover text.
