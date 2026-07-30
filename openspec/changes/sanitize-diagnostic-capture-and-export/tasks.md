## 1. Evidence and approval

- [x] 1.1 Trace crash, console/network, unified-log, localStorage/SW/IndexedDB, display/copy, and both download paths.
- [x] 1.2 Prove sink propagation with synthetic URL/key/bearer/error sentinels and confirm existing network-URL sanitization as a positive control.
- [x] 1.3 Separate generic sink protection from benchmark, Suno/provider, task, SW-transport, and analytics-context ownership.
- [ ] 1.4 Obtain user approval for bounded/redacted diagnostics and non-destructive legacy handling.

## 2. Failing tests and implementation (approval required)

- [ ] 2.1 Add table-driven diagnostic-sanitizer tests for keys, strings, URLs, stack, nested/array/cycle/oversize, malformed, and safe values.
- [ ] 2.2 Add the dedicated no-throw diagnostic projection without broadening unrelated `sanitizeObject()` behavior.
- [ ] 2.3 Project crash snapshots before localStorage/SW send and again before SW persistence/live broadcast.
- [ ] 2.4 Normalize unified-log message/data/Error fields before memory/IndexedDB insertion.
- [ ] 2.5 Sanitize application error downloads and SW-debug display/copy/combined/crash downloads, including legacy records.
- [ ] 2.6 Preserve safe recovery metrics, IDs/types/categories, store/RPC schemas, caps, retention, and clear controls.

## 3. Verification

- [ ] 3.1 Run focused utility/crash/SW/unified-log/export tests with exact counts and exit codes.
- [ ] 3.2 Assert unsafe sentinels never reach memory/localStorage/SW/IndexedDB/UI/copy/download while safe summaries remain.
- [ ] 3.3 Test current plus legacy records, refresh/recovery, SW unavailable queueing, malformed/cyclic data, and export failure behavior.
- [ ] 3.4 Run package/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Record OpenSpec CLI absence; complete manual format, requirement-name, and active-change conflict checks without claiming strict validation passed.
