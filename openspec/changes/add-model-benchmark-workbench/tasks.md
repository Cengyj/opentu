## 1. Implementation
- [x] 1.1 Add sandboxed benchmark workbench tool: manifest, component, window plumbing, previews per modality.
- [ ] 1.2 Complete benchmark session metadata by capturing a unit-safe estimated cost when price data exists and preserving `null` as unknown otherwise.
- [x] 1.3 Wire settings dialog provider/model list so “快捷测试” buttons open workbench with context.
- [x] 1.4 Ensure workbench consumes runtime model discovery/presets and reuses adapter routing to execute tests per modality with default prompts.
- [ ] 1.5 Add reachable UI sorting/filtering and ranking controls (“速度优先”, “成本优先”, “综合/性价比”) while keeping existing manual feedback controls.
- [x] 1.6 Document new capability in specs delta and update design.md as needed.

## 2. Audit And Approval

- [x] 2.1 Trace toolbox/settings entry, selection, service, adapters, storage, ranking/export, and final UI in both directions.
- [x] 2.2 Confirm by source search and an isolated successful run that `estimatedCost` remains `null` and raw provider data is persisted.
- [x] 2.3 Confirm the reachable workbench has no ranking-mode caller/control and no stop/cancel operation.
- [x] 2.4 Record settings-shortcut browser verification as environment-blocked because the two configured groups expose zero model entries; do not create models or use credentials to manufacture the path.
- [ ] 2.5 Obtain user approval for truthful cost capture, reachable ranking controls, and stop behavior together with the related lifecycle change.

## 3. Verification
- [ ] 3.1 Benchmarks can run for image/video/audio/text with selected provider/model using mocks or explicitly authorized credentials.
- [ ] 3.2 Settings quick test buttons correctly pre-fill exactly one intended workbench instance.
- [ ] 3.3 Benchmark results stay in independent store and do not appear in task history.
- [x] 3.4 Pure ranking modes reorder entries as expected for supplied timing/cost values.
- [ ] 3.5 Cost UI/export distinguish measured estimate from unknown and use the declared currency/unit.
- [ ] 3.6 Users can start, monitor, and stop entries without orphaning paid work or reporting false cancellation.
- [ ] 3.7 Run focused tests, Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available smoke/feature/visual/responsive flows against baseline.
- [x] 3.8 Run OpenSpec strict validation; while the CLI is unavailable, record exit 127 and complete manual format/name/conflict validation.
