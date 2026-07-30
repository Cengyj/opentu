# Change: Secure External Tool Credential Launch

## Why

The reachable Chat-MJ built-in manifest places the application's configured `${apiKey}` inside the fragment of an iframe URL on `https://vercel.ddaiai.com`. A deterministic test with the mock value `F21_SENTINEL_KEY_DO_NOT_USE` confirmed that `processToolUrl()` places that value in the third-party document's fragment. URL fragments are not part of the HTTP request, but scripts executing in that third-party document can read their own `location.hash`; therefore this is a confirmed cross-origin credential delivery boundary. The custom-tool form warns users before they author a credential template, while the built-in Chat-MJ entry gives no equivalent disclosure or destination choice.

The missing-key guard is also owned only by the toolbox drawer handlers. Pinned launcher clicks, launcher “new window”, and canvas “open as popup” call the window service directly. The same mock test confirmed that an unresolved Chat-MJ `${apiKey}` is retained while `toolWindowService.openTool()` still creates an `open` window state.

Removing the built-in credential delivery and enforcing launch preflight across every entry changes credential/security and launch-recovery semantics, so implementation requires approval.

## What Changes

- Stop interpolating the application's global provider API key into the built-in Chat-MJ cross-origin URL. Launch the existing external page without an application credential; the external page remains responsible for any credential the user chooses to configure there.
- Preserve the explicitly documented `${apiKey}` capability for user-authored custom URL tools and continue storing only the unresolved template in canvas/catalog data.
- Enforce missing-sensitive-variable preflight before every window, new-instance, canvas insertion, canvas render/refresh, launcher, and canvas-to-popup transition.
- When preflight rejects a launch, do not create a window, issue an iframe request, remove the canvas element, or expose raw URL/key text. Return localized actionable feedback through the caller's existing settings/message boundary.
- Preserve successful window lifecycle, pinning, multi-instance, sandbox, task, analytics schema, and custom-tool persistence behavior.

## Impact

- Affected specs: `toolbox-plugin-runtime`
- Affected code: built-in manifests, URL-template launch preflight, toolbox drawer, tool-window service, minimized launcher, canvas tool generator, tests and documentation
- Related changes: `refactor-toolbox-plugin-runtime` owns registry structure; `ensure-toolbox-initialization-consistency` owns catalog readiness; neither owns credential delivery or cross-entry launch preflight
- User-visible trade-off: Chat-MJ no longer receives the application's provider key automatically; it still opens, and any external-page credential configuration is isolated from Opentu
- Rollback: restore the manifest template and remove centralized preflight/caller feedback/tests; no storage migration or user-data rewrite is required

## Evidence

- `packages/drawnix/src/tools/built-in-manifests.tsx:95-103` defines the cross-origin Chat-MJ URL and `${apiKey}` fragment.
- `packages/drawnix/src/utils/url-template.ts:18-20,78-86,94-108` reads the application key and performs raw runtime substitution.
- Isolated sentinel diagnostic: 1 file / 2 tests passed; the destination origin was `https://vercel.ddaiai.com`, its hash contained the sentinel, and missing-key `openTool()` still returned an open instance.
- `ToolboxDrawer.tsx:190-217,269-296` contains the only settings-opening missing-key gates.
- `MinimizedToolsBar.tsx:95-115,121-138` and `tool.generator.ts:662-674` call window creation without that gate.
- `tool-window-service.ts:325-441` creates/reuses state without inspecting template variables.
- A credential-free navigation to `https://vercel.ddaiai.com/#/` rendered the existing ChatGPT Web Midjourney Proxy shell; no external form, generation action, or real credential was used.

