# Design: Startup recovery interface accessibility

## Context

There are two recovery surfaces:

1. index.html must work before React and when application CSS/modules fail.
2. ErrorFallbackUI serves repeated-crash, workspace initialization, lazy-chunk and React render errors.

They share the user intent but have different dependency constraints. The HTML surface cannot depend on React, TDesign, application CSS, storage reads or a network translation catalog. The React surface must remain available outside Drawnix's provider tree.

## Goals and non-goals

Goals:

- Expose terminal startup failure distinctly from loading completion.
- Give users direct, explicit access to existing recovery routes.
- Make the blocking React surface understandable and operable by keyboard/screen reader.
- Preserve usability without application CSS and at compact/zoomed layouts.
- Reuse known runtime language without creating a second language owner.

Non-goals:

- Change crash detection thresholds/history or workspace safe-mode board rules.
- change error-log content, sanitization, storage or export; sanitize-diagnostic-capture-and-export owns those.
- change lazy-asset retry timing, CDN/SW/cache behavior or startup chunking.
- add language persistence or infer selected language from browser locale.
- decide whether the remote support QR request is allowed; privacy policy evidence is missing.
- add automatic retry or automatic safe mode.

## Decisions

### Separate loading and terminal failure semantics in the HTML shell

Normal boot remains one polite status with a determinate progressbar. markError transitions the same shell to one named assertive error region, hides/removes the progressbar from the accessibility tree, and reveals three existing routes:

- Retry: reload the current URL without changing safe-mode state.
- Safe mode: explicitly set/use the existing safe-mode route and reload only after user action.
- Debug: navigate to the existing same-origin /sw-debug.html route.

Retry receives focus on the terminal transition but is never activated automatically. Repeated markError calls update the same bounded region and do not duplicate controls.

### Use an alertdialog for the React blocking surface

ErrorFallbackUI will expose one alertdialog named by its current heading and described by concise recovery copy/error summary. Initial focus goes to the least destructive current action: “continue loading” in crash mode when present, otherwise the log/details/retry-safe control selected by the approved implementation. Focusing must not invoke a callback.

The overlay is a terminal whole-application replacement, so focus return is needed only for the crash “continue” flow if it stops reloading in a future approved design; current handlers reload/navigate and remain unchanged here.

### Expose disclosure and memory state without announcing raw diagnostics

The detail button uses aria-expanded and aria-controls with a stable detail ID. The stack/pre content is not live. The memory bar is a progressbar with min 0, max 100, clamped now value and concise value text; it does not announce raw crash history or URLs.

### Keep inline resilience and compact layout

All critical recovery layout/visibility/focus styles remain inline or in the index document. The React card explicitly uses border-box-safe viewport sizing, bounded padding, wrapping actions/help content and at least 44×44 compact/pointer-coarse hit areas. Motion uses the existing duration for normal mode and no nonessential transition when prefers-reduced-motion is active. No application token import may become required for basic operation.

### Reuse only an already-available runtime language

The early HTML shell uses its document/default language because no persisted selected language exists. The React surface may read or receive the existing in-memory zh/en value through a lightweight one-way bridge that does not import the full Drawnix root graph and does not persist a new setting. User/provider/error/stack content is never translated. If no runtime language exists, current Chinese fallback remains deterministic.

## Invariants

- All current callbacks and routes remain available exactly once.
- No automatic reload, safe mode, debug navigation or download.
- Existing localStorage keys, crash count/history and safe-mode semantics stay compatible.
- Stack/component/error strings and diagnostic payloads are unchanged here and never put in a live region or accessible name.
- Normal boot still exposes one polite progress status and markReady still removes the shell.
- Recovery remains available if application styles fail.
- No root-barrel import or translation dependency may regress the startup graph.

## Risks and mitigations

- Retry loop: never auto-activate and preserve a separate safe-mode action.
- Focus steals user input after a late error: only terminal replacement states move focus, tested once per transition.
- Screen reader repeats long stack/provider errors: live/description copy stays concise; raw detail is opt-in and non-live.
- Compact content overflow: test exact border boxes, long zh/en labels, 200% zoom and missing QR image.
- Language bridge regresses startup bytes: keep it data-only and verify the entry graph and raw/gzip delta.
- QR failure blocks layout: image remains optional and help/actions must be usable without it.

## Verification

- Synthetic index-controller tests for normal progress, resource/script/rejection error, repeated markError, retry/safe/debug URLs, focus and markReady removal.
- ErrorFallback component tests for crash/init/render/chunk variants, one named alertdialog, description, initial focus, disclosure, memory values and every callback exactly once.
- zh/en known-language and unavailable-language tests while sentinel error/stack/content remains byte-identical.
- 320×568, 390×844, 768×1024 and 1280×720; 100%/200% zoom, long strings, QR failure, keyboard, touch/pointer-coarse and reduced motion.
- Focused Web tests, typecheck/lint, full tests, cycles, build:web, size and verify:startup.
- Five normal-startup samples and HTML/bootstrap byte comparison before/after. No speed/visual claim without raw before/after evidence.

## Rollback

Restore the text-only HTML markError state and generic ErrorFallback markup/styles, remove scoped language bridge/keys/tests, and keep all existing recovery callbacks/storage untouched. No migration or data/cache cleanup. With no Git metadata, rollback is an explicit file patch.
