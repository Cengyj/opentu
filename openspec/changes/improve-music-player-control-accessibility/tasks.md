## 1. Evidence And Approval

- [x] 1.1 Inspect the open tool, minimized overlay, every overlay button, sliders, accessible names, disabled state, and playback continuity in Chromium.
- [x] 1.2 Trace overlay controls to shared playback actions and separate outer WinBox ownership.
- [x] 1.3 Confirm corresponding music-player tool controls already expose explicit names.
- [ ] 1.4 Obtain user approval for localized/state-aware overlay control names.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Replace the skipped overlay placeholder with focused accessible-name/state tests using existing service mocks.
- [ ] 2.2 Add localized names for previous, play/pause, next, layout, and close without changing callbacks or visual markup.
- [ ] 2.3 Add privacy assertions excluding title, note text, URL, provider/task/clip ID, error body, and credential values.
- [ ] 2.4 Preserve tooltip, disabled, queue, playback, layout persistence, close/stop, and minimize/restore behavior.

## 3. Verification

- [ ] 3.1 Run focused overlay/music-player/playback tests with exact counts and exit codes.
- [ ] 3.2 Verify names, Tab order, Enter/Space/pointer parity, state transitions, audio/reading, and minimize/restore in Chinese/English.
- [ ] 3.3 Capture same-state desktop/tablet/mobile, light/dark before/after screenshots and exact control geometry.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; CLI unavailable (exit 127), then complete manual format/name/conflict validation.
