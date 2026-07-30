# Lint Toolchain Scope Diagnostics

## Loop Boundary And Decision

**Loop / maintainer scenario**: a maintainer runs `pnpm lint` as a repository quality gate and expects the reported files and rule findings to belong to project-maintained source or intentionally maintained static source. Dependency installations, generated bundles, and copied/minified vendor bundles must not dominate the result.

**Scope**: the root lint script, Nx lint target resolution, the six linted projects, project ESLint ignore precedence, and three proved generated/vendor Web artifacts. **Out of scope**: fixing any remaining first-party rule finding, changing lint rules or severity, formatting source, changing a product call chain, changing build output, and treating an `any`, `console`, warning, or rule hit as a product defect without feature evidence.

**OpenSpec gate**: no OpenSpec change is required. The patch changes only which files the existing static-analysis command reads. It does not change runtime code, user-observable behavior, data, API, cache, concurrency, recovery, security policy, or architecture. Any later product fix derived from a remaining rule finding must still be investigated in its owning user-feature loop and pass the normal OpenSpec gate.

## Forward And Reverse Tool Call Chain

1. `package.json:27-30` maps `pnpm lint` to `nx run-many -t=lint`.
2. `nx.json:31-35` enables the Nx ESLint plugin. Its inferred targets for `react-board`, `react-text`, and `web-e2e` resolve to `eslint .`; this was confirmed with `nx show project ... --json`. `apps/web/project.json:67-72` also explicitly runs `eslint .`. Drawnix explicitly limits ESLint to `src`, while Utils passes the package TypeScript glob.
3. The root `.eslintrc.json:2-4` ignores everything so that each project opts its owned files back in. Before this fix, the React Board, React Text, and Web child configs each started with `ignorePatterns: ["!**/*"]`. For the two package-local `eslint .` targets this negation also opted package-local dependency trees back in. For Web it opted all JavaScript below `public` back in, including build/copied bundles.
4. ESLint resolves and parses every included file, applies the existing rules, prints findings, and returns non-zero when errors exist. Nx aggregates that target status into the repository command.
5. Reverse tracing from the reported dependency paths returns to only the two inferred `eslint .` package targets. Reverse tracing from the three Web bundle paths returns to the Web `eslint .` target and the child negation. No product UI, network, storage, Service Worker runtime, test assertion, or user state consumes the ignore configuration.

## Ownership Proof For Excluded Files

- `apps/web/public/sw.js` is an output: `apps/web/vite.sw.config.ts:36-54` selects `public` as the development output directory and emits `sw.js` from `src/sw/index.ts`. The captured file is 344,203 bytes with SHA-256 `78a242d3211f75739d8824d3c222797096029291be9849e39ca84c32fd642977`.
- `apps/web/public/sw-debug/jszip.min.js` identifies itself in its header as JSZip 3.10.1 and is loaded by `public/sw-debug.html:9`. It is a 96,920-byte minified vendor bundle with SHA-256 `2fd0547716603ac8ee554e185acddc79cb7abec672df075fba5f8981a0123a17`.
- `apps/web/public/sw-debug/postmessage-duplex.js` is a one-line minified package bundle used by `public/sw-debug/duplex-client.js:6`; `package.json:96` and the lockfile own the installed dependency. The copied file is 44,144 bytes with SHA-256 `4266e552c62d88922f8f087a84b0f91d941ad9f9b97cfa00fd8316458b163ef8`.
- The remaining Web `public` JavaScript was not excluded: it is maintained static source unless separately proved otherwise. A blanket `public/**` exclusion would hide 30 currently processed files and was rejected.

## [TOOL-LINT-SCOPE-001]

**Status**: 已证实并已修复的工具链缺陷. **Evidence strength**: deterministic before/after file-boundary counts, exact-path bundle reproduction, config precedence, and full-command verification.

**Maintainer and user impact**: the quality gate processed 2,102 files that the project does not maintain at those paths and emitted 3,807 errors plus 6,089 warnings from them. That noise obscured the remaining project findings and made repository lint output unsuitable for feature regression attribution. No direct end-user runtime malfunction is attributed to this tool defect; the impact is reduced confidence and efficiency in the verification gate used to protect user features.

**Reproduction / static proof**:

1. Run the same summary formatter on the pre-fix scopes. React Board processed 1,837 files: 1,824 under `node_modules`, 12 under `src`, and one project file. Its dependency contribution was 1,144 errors / 1,965 warnings. React Text processed 284 files: 275 under `node_modules`, eight under `src`, and one project file. Its dependency contribution was 1,995 errors / 3,380 warnings.
2. Run ESLint with `--no-ignore` on only the three proved Web bundles. The result is exactly three files, 668 errors, and 744 warnings: JSZip 373/486, postmessage-duplex 126/126, generated SW 169/132.
3. Aggregate all six project scopes. Before the patch: 3,422 files, 4,255 errors, 8,614 warnings. After the patch: 1,320 files, 448 errors, 2,525 warnings. The exact delta is 2,102 files, 3,807 errors, and 6,089 warnings—the sum of the two dependency trees and the three proved bundles. First-party/project file counts and findings are unchanged.

**Current versus expected**: before the fix, project-level opt-in patterns caused dependency/generated/vendor files to be treated as lint-owned source. Expected behavior is that the same rules continue to analyze every previously included project-owned file while dependency installations and only the three proved bundles are excluded. The full gate is expected to remain red until independently investigated first-party debt is resolved; a green result was not an acceptance criterion for this scope correction.

**Root cause**: the repository-level ignore-all/project-level opt-in convention was combined with inferred `eslint .` targets. The child `!**/*` pattern was broader than the intended ownership boundary. Web additionally had an explicit all-directory target but no exact exclusions for known build/vendor artifacts.

**Implemented minimum change**:

- `packages/react-board/.eslintrc.json:3`: add `node_modules/**` after the broad negation.
- `packages/react-text/.eslintrc.json:3`: add `node_modules/**` after the broad negation.
- `apps/web/.eslintrc.json:3-8`: add exact ignores for `public/sw.js`, `public/sw-debug/jszip.min.js`, and `public/sw-debug/postmessage-duplex.js`.

No rule, severity, source file, test, build script, dependency, or lint target was changed.

**Alternatives considered**:

- Replacing every `eslint .` target with `eslint src` was rejected because Web and the package projects have maintained project/static files outside `src`; no evidence justified dropping them.
- Ignoring all of `apps/web/public` was rejected because it would hide 30 still-processed maintained static-source files.
- Removing the repository opt-in convention was rejected as a cross-project config redesign with a larger unmeasured scope.
- Requiring a special CLI ignore flag was rejected because direct Nx/CI/editor invocations would retain the defect.
- Disabling rules or raising warning/error thresholds was rejected because it would hide first-party signals rather than repair ownership.

**Risks**: a future process could turn one exact Web artifact into hand-maintained source without updating its path ownership. Mitigation is the exact, narrow list and the generator/vendor proof above. Package-local `node_modules` is dependency-owned by definition; no package export or runtime resolution changes. ESLint cache staleness was avoided with `--skip-nx-cache` for target and full-command verification.

**Validation**:

- The three edited JSON files parse successfully.
- Post-fix React Board: 13 files, 0 errors / 34 warnings, exit 0; React Text: 9 files, 0 / 26, exit 0. Neither result contains a `node_modules` boundary.
- Post-fix Web: 63 files, 54 / 162, exit 1; all three exact bundles are absent while 30 other public files remain included.
- Drawnix, Web E2E, and Utils retain their existing scopes and counts: 1,150 files 377/1,742; 23 files 5/514; 62 files 12/47.
- `pnpm lint --skip-nx-cache --output-style=static` exits 1 because 448 project/static-source errors remain. This is an honest first-party baseline, not a passing gate and not evidence that each hit is a product defect.
- Full typecheck exits 0 for 5/5 projects; static runtime cycle check exits 0.

**Rollback**: remove only the added ignore entries from the three JSON files. This restores the old scan boundary and its noise. No runtime build, database, cache, user setting, migration, or recovery step is involved. Because the directory has no Git metadata, rollback must be applied as an explicit reverse patch; worktree/history cleanliness cannot be asserted.

## Baseline And Exit Review

| Project | Before files | Before errors | Before warnings | After files | After errors | After warnings | Removed ownership noise |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Web | 66 | 722 | 906 | 63 | 54 | 162 | 3 generated/vendor files; 668 errors / 744 warnings |
| Web E2E | 23 | 5 | 514 | 23 | 5 | 514 | none |
| Drawnix | 1,150 | 377 | 1,742 | 1,150 | 377 | 1,742 | none |
| React Board | 1,837 | 1,144 | 1,999 | 13 | 0 | 34 | 1,824 dependency files; 1,144 / 1,965 |
| React Text | 284 | 1,995 | 3,406 | 9 | 0 | 26 | 275 dependency files; 1,995 / 3,380 |
| Utils | 62 | 12 | 47 | 62 | 12 | 47 | none |
| **Total** | **3,422** | **4,255** | **8,614** | **1,320** | **448** | **2,525** | **2,102 files; 3,807 / 6,089** |

This loop meets its narrow exit criterion: the proved scope defect is fixed, every previously included project-owned file remains included, the full command was rerun, and no runtime behavior changed. The repository lint gate is **still failing**, now for 448 project/static-source errors. Those findings remain baseline debt until their owning feature call chains establish whether they are defects, tool false positives, or non-problems.

No product performance or visual change was made. File-count elimination is a scope result, not a timing claim; there are no five-run before/after timings, so no speed, CPU, memory, bundle-size, or UX improvement is claimed.
