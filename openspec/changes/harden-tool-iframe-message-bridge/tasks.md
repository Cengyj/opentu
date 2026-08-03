## 1. Evidence And Contract

- [x] 1.1 Trace iframe creation, imported canvas/toolbox definitions, bridge
  message dispatch, image-task creation and response delivery.
- [x] 1.2 Confirm source/origin, wildcard target, credential-init and URL-policy
  gaps from current production code rather than documentation assumptions.
- [x] 1.3 Define runtime identity, capability authority, URL policy and explicit
  non-goals without changing Chat-MJ credential-template behavior.

## 2. Implementation

- [x] 2.1 Register exact live iframe identities/origins; unregister and stop the
  old iframe on URL/component/manifest replacement and renderer teardown.
- [x] 2.2 Validate inbound envelopes/payloads before dedupe and require explicit
  trusted manifest capabilities for privileged commands.
- [x] 2.3 Reject detached frames, send all responses to the exact registered
  origin and remove provider credentials from `board:init`.
- [x] 2.4 Keep ToolGenerator/bridge and tool image-generation runtime behind the
  startup boundary while preserving one authorized task path and closed-tool
  zero-submit behavior.
- [x] 2.5 Share one acquired bridge per board and release its listener/cache only
  after the last live ToolGenerator is destroyed; stale/double release must not
  affect a replacement runtime.
- [x] 2.6 Apply one final-HTTP(S) URL policy to add, update, import and render
  paths.

## 3. Verification

- [x] 3.1 Run the final touched-scope bridge, renderer and tool image-generation
  tests: 6 files / 45 tests passed, exit 0.
- [x] 3.2 Run the startup-boundary contract and inspect the built graph: the main
  bundle contains only a dynamic import of the separate ToolGenerator chunk;
  bridge/image-generation implementations are not members of the main static
  import graph and idle-prefetch defaults are empty.
- [x] 3.3 Run `drawnix:typecheck` (exit 0), focused ESLint (0 errors; 4 existing
  ToolGenerator warnings), `check:cycles` (0 cycles) and `git diff --check`
  (exit 0) after the lifecycle fix.
- [x] 3.4 Re-run final verification: Web/Drawnix typecheck, full `pnpm test`
  (292 files / 2,218 tests: 2,217 passed, 1 skipped), production build,
  `git diff --check` and startup verification passed with exit 0; cycle count
  was zero, `drawnix-app` was 481,924B, the startup graph was 1,941,175B and
  every single startup asset remained at or below 512,000B. Full-repository
  lint remains exit 1, but is improved from HEAD and adds zero diagnostics.
- [ ] 3.5 Run `openspec validate harden-tool-iframe-message-bridge --strict`.
  Current result: `/bin/bash: openspec: command not found` (exit 127), so strict
  validation is not complete.
