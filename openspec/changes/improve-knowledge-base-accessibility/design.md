# Design: Knowledge-base accessibility

## Decisions

- Keep composite rows as non-button containers where nested actions exist, but add one explicit semantic selection control or a `role="button"`/tab-stop contract with Enter and Space parity. Avoid invalid nested interactive elements.
- Directory disclosure controls expose `aria-expanded` and identify their directory. Selected notes/directories expose current selection without making disabled/read-only Skills appear editable.
- Icon-only buttons receive localized accessible names; toggle/tab controls expose pressed/selected/controls relationships where the target pane exists.
- Context menus use `role="menu"` and focusable `menuitem` actions, open with pointer or keyboard context-menu invocation, close with Escape/outside action, and return focus to the invoking row. Destructive confirmations remain unchanged.
- After note deletion, focus moves deterministically to the next note, previous note, or directory control. Creating/renaming retains existing input autofocus and Enter/Escape semantics with named confirm/cancel buttons.
- Compact activation sizes remain owned by the responsive change; desktop glyphs and visual density remain unchanged unless browser contrast/focus evidence requires a separate approved style adjustment.

## Alternatives rejected

- Add `tabIndex` only: exposes focus without names, state, or activation parity.
- Wrap entire rows in native buttons: creates invalid nested buttons around row actions.
- Treat hover tips as accessible names: the current DOM does not associate them with controls and touch/keyboard users cannot rely on hover.
- Add application-wide menu/focus infrastructure: scope and evidence are limited to the knowledge-base feature.

## Verification

- RTL/user-event tests cover Tab order, Enter/Space selection, disclosure state, context-menu open/navigation/Escape, action names, deletion focus, and read-only Skills.
- Browser accessibility snapshots cover tree, editor, details, menus, tags, empty states, and dialogs in Chinese/English and light/dark themes.
- Verify pointer behavior, confirmations, no duplicate activation, no global shortcut interception, and compact compatibility.
- Record exact focus order and accessible names before/after. This is not a performance optimization; run normal regression/typecheck/build gates without a speed claim.

## Rollback

Remove scoped semantic/keyboard/focus props, localized accessibility keys, and tests. Stored data and layouts require no reversal.
