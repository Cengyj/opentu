## 1. Drop result model

- [ ] 1.1 Return per-file success/failure data from the direct canvas media drop loop.
- [ ] 1.2 Count unsupported files without sending already handled supported files through the base drop handler.
- [ ] 1.3 Preserve successful insertions and viewport restoration after partial failure.

## 2. User feedback

- [ ] 2.1 Add localized success/partial-failure/all-failure/unsupported summaries.
- [ ] 2.2 Keep detailed errors in diagnostics without exposing URLs, tokens, or file contents.

## 3. Verification

- [ ] 3.1 Add deterministic tests for all-success, partial failure, all failure, and mixed supported/unsupported drops.
- [ ] 3.2 Verify image, video, and audio drops at single and multi-file positions, including refresh recovery for successful nodes.
- [ ] 3.3 Run targeted lint, Drawnix typecheck, insertion tests, and relevant Playwright flows.
