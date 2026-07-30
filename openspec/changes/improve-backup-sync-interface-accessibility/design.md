## Context

Backup/restore is a custom Floating UI dialog mounted lazily inside the Drawnix container. Cloud sync is a TDesign dialog wrapped by a lazily mounted `GitHubSyncProvider`. Both launch from application-menu items that disappear when the menu closes, so neither dialog currently has a surviving reference element for focus restoration. Nested confirmation dialogs already use the shared `ConfirmDialog` and must retain precedence over their parent surface.

The data paths are separately owned: ZIP export/import, workspace reload/current-board transition, GitHub pull/push/conflict application, Token persistence, custom-password persistence, and destructive Gist/recycle-bin actions are not redesigned here.

## Goals / Non-Goals

- Goals: expose the existing two modal workflows, their current controls, states, and Chinese/English application copy consistently to pointer, keyboard, and assistive-technology users; mask password presentation by default; preserve one callback per activation.
- Non-Goals: new backup domains, drag-and-drop upload, backup preview, undo restore, new cloud-sync actions, conflict resolution, retry policy, global language persistence, shared TDesign/Dialog redesign, Token encryption policy, credential storage migration, dark-mode introduction, or unmeasured performance claims.

## Decisions

- Decision: keep semantics component-scoped. Backup/restore uses the existing Floating UI `DialogHeading`/description relationship. Cloud sync receives an F-03-specific semantic shell/custom close contract; the shared TDesign dialog and the 22-caller shared confirmation primitive are not changed opportunistically.
- Decision: capture the connected invoker before opening. On close, restore it if still connected; otherwise focus the stable named application-menu launcher. A nested confirmation closes back into its parent dialog before any outer restoration.
- Decision: implement backup/restore as a labelled tab set with roving focus and panel relationships. Left/Right/Home/End change focused/selected tab without changing backup or import data.
- Decision: use a native labelled file control or one native activation owner for the existing `.zip` input. Pointer, Enter, and Space each invoke the file chooser at most once; no import starts before a file is selected and confirmed under the existing replace rules.
- Decision: expose progress with determinate value and concise live text; expose final success/partial/error results through status/alert semantics without moving focus on every update. Existing toast output remains supplemental.
- Decision: convert Gist/recycle headers to native disclosure buttons with `aria-expanded`/`aria-controls`. Loading and empty projections remain the same data owners; activation only toggles the existing sections.
- Decision: use explicit labels for Token, custom password, and auto-sync. Newly typed passwords are `type=password` by default. Stored password display does not interpolate plaintext into a placeholder or accessible name; the existing show/hide action is a named stateful control and is the only reveal path.
- Decision: add typed F-03 translation keys for application-authored copy. User names, board names, Gist IDs, file names, provider payloads, imported warning/error strings, and credentials are data and remain byte-preserved.

## Invariants

- Backup v2/v3/v4 compatibility, manifest/ZIP layout, selected domains, time filtering, secrets encryption, merge/replace, workspace state, domain ordering, and refresh behavior remain unchanged.
- GitHub API endpoints, Token/config/password keys, encryption algorithms, sync debounce/concurrency, Gist selection, pull/push overwrite semantics, tombstones, conflict merging, and reload behavior remain unchanged.
- Destructive actions still require their existing confirmation text/value and call their service once at most.
- Dialog activation does not read, log, or expose stored credentials beyond the existing explicit password-reveal action.
- No performance or visual improvement is claimed without separate before/after measurement.

## Risks / Trade-offs

- Focus restoration can race menu dismissal and lazy mount. Mitigation: capture before state change, test connected/disconnected invokers, and use the stable launcher only as fallback.
- A labelled file control can double-open if both container and input own click. Mitigation: one native activation owner and an exact callback-count test.
- Live progress can be noisy. Mitigation: one polite message region plus determinate numeric progress; do not announce every DOM subtree mutation.
- Scoped localization can accidentally translate user/provider data. Mitigation: typed keys only for literals and sentinel byte-preservation tests.
- Password masking can make replacement less convenient. Mitigation: retain the explicit show/hide action and do not change stored value, save, clear, or encryption behavior.
- Shared TDesign styles may constrain compact width, but no fresh 320/390 geometry exists. Compact overflow remains a verification item, not a claimed current defect or an authorization for redesign.

## Verification And Rollback

- Component tests cover named/modal roots, initial/return focus, Escape/nested precedence, tabs, exact file activation count, progress/result/live semantics, fields/switch/icon names, disclosures, password mask/reveal, and Chinese/English initial/live switch.
- Service spies prove backup export/import, pull/push, config, delete, restore, and password callbacks retain existing arguments and execute once.
- Browser verification covers connected and disconnected UI using fixture providers only; no real credential or destructive remote action is required.
- Capture matched desktop and, when tooling permits, 390/320 screenshots in Chinese/English and inspect overflow/focus without claiming visual improvement unless an after comparison is produced.
- Roll back only the F-03 component semantics, focus plumbing, typed copy, mask presentation, styles, and tests. No user data or cache cleanup is required.
