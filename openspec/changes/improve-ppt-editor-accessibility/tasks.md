## 1. Evidence And Approval

- [x] 1.1 Inspect PPT panel, add dialog, slideshow controls, input names, selection state, inactivity visibility, and navigation in Chromium/source.
- [x] 1.2 Trace every affected control to its existing callback and confirm no new product action is required.
- [x] 1.3 Separate outer project-drawer/WinBox accessibility ownership from PPT workflow controls.
- [ ] 1.4 Obtain user approval for localized names, state semantics, and focus-visible slideshow controls.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing accessible-name/state tests for PPT toolbar, outline/page actions, and disabled/pending states.
- [ ] 2.2 Associate custom width/height labels and name the custom-size add action.
- [ ] 2.3 Add localized names and pressed/selected group semantics to slideshow tools and pen settings.
- [ ] 2.4 Name previous/next/exit-related controls and keep controls visible while keyboard focus is inside.
- [ ] 2.5 Preserve callbacks, shortcuts, visual geometry, focus restoration, viewport restoration, deck data, and privacy boundaries.

## 3. Verification

- [ ] 3.1 Run focused PPT panel/dialog/slideshow accessibility and behavior tests with exact counts and exit codes.
- [ ] 3.2 Verify Tab order, names, selected/disabled/pending state, Enter/Space/pointer parity, Escape, timers, and fullscreen in Chinese/English.
- [ ] 3.3 Capture same-state desktop/tablet/mobile light/dark before/after screenshots and measure control geometry.
- [ ] 3.4 Run targeted lint, Drawnix/full typecheck, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; CLI unavailable (exit 127), then complete manual format/name/conflict validation.
