# F-17 controlled diagnostics

Date: 2026-07-29 (Asia/Shanghai)

Runtime: workspace-provided Node and pnpm; Vitest 3.2.4.

## Concurrent patch diagnostic

Command:

```bash
pnpm exec vitest run packages/drawnix/src/components/shared/workflow/record-storage.test.ts
```

Temporary diagnostic assertion:

- Initial record: `{ id: 'a', starred: false, label: 'Old' }`
- Concurrent real helper calls: patch `label` to `New`; patch `starred` to `true`
- Expected durable record: `{ id: 'a', starred: true, label: 'New' }`
- Received durable record: `{ id: 'a', starred: true, label: 'Old' }`

Result: exit 1; 1 file failed; 7 tests total, 6 passed and 1 failed; duration 1.14 s. The temporary failing diagnostic was removed after recording the result.

## Concurrent add diagnostic

Command:

```bash
pnpm exec vitest run packages/drawnix/src/components/shared/workflow/record-storage.test.ts
```

Temporary diagnostic assertion:

- Initial durable records: `[]`
- Concurrent real helper calls: add record `a`; add record `b`
- Expected IDs: `['a', 'b']`
- Received IDs: `['b']`

Result: exit 1; 1 file failed; 7 tests total, 6 passed and 1 failed; duration 881 ms. The temporary failing diagnostic was removed after recording the result.

## Browser responsive and accessibility diagnostic

Raw geometry, steps, and accessibility attributes are in `metrics.json`. Screenshots use the same light-theme application state:

- `01-desktop-initial-1280x720.png`
- `02-mobile-390x844.png`
- `03-desktop-after-mobile-viewport.png`

The browser viewport override was reset after capture.

