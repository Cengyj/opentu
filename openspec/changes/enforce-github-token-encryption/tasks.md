## 1. Evidence And Approval

- [x] 1.1 Trace Token input through GitHub validation, CryptoUtils, localStorage, cache, authorization use, clear, and UI feedback.
- [x] 1.2 Distinguish normal Token AES, Token fallback, sync payload AES, and custom synchronization-password storage.
- [x] 1.3 Reproduce the no-Web-Crypto fallback with a fixed non-secret sentinel and prove a different password decodes it.
- [x] 1.4 Search formal specs/active changes and confirm no current Token fallback/fail-closed owner.
- [ ] 1.5 Obtain user approval for fail-closed Token persistence/use and same-key fallback secure rewrite.

## 2. Failing Tests And Secure Boundary (Approval Required)

- [ ] 2.1 Add failing crypto-boundary tests that distinguish verified AES ciphertext from `OPENTU_FB:`/`AITU_FB:` fallback and malformed data.
- [ ] 2.2 Expose the minimum secure-result/predicate API without changing generic fallback behavior for unrelated callers.
- [ ] 2.3 Add failing TokenService tests for unsupported crypto, encryption rejection, no localStorage mutation, prior secure-record/cache preservation, and redacted errors/logs.
- [ ] 2.4 Make new Token persistence fail closed unless the produced ciphertext is verified AES-256-GCM.

## 3. Fallback Record Recovery (Approval Required)

- [ ] 3.1 Add failing tests for both fallback prefixes, secure migration success, secure-encrypt failure, localStorage write failure, no-Web-Crypto state, and malformed records.
- [ ] 3.2 Classify stored Token values before use and atomically rewrite recoverable fallback data to the same key before caching/use.
- [ ] 3.3 On migration failure, retain the original stored value, discard transient plaintext, block Token use, and return a typed safe recovery state.
- [ ] 3.4 Preserve normal AES reads, clear/disconnect, validation cache, Token format, scope, and request authorization behavior.

## 4. Feedback And Preservation (Approval Required)

- [ ] 4.1 Add safe application copy for secure-storage unavailable, migration required/failed, and reconnect recovery states.
- [ ] 4.2 Update the Token guide so the AES statement is conditional on enforced verified storage and never exposes implementation secrets or credential values.
- [ ] 4.3 Test that Token plaintext/ciphertext never appears in UI, errors, logs, analytics, backups, accessible names, or screenshots.
- [ ] 4.4 Prove sync payload encryption, custom-password storage, GitHub config/Gist data, backup data, and all non-Token keys/formats are unchanged.

## 5. Verification

- [ ] 5.1 Run crypto and Token unit tests with exact counts/exits, including redaction and localStorage mutation assertions.
- [ ] 5.2 Run GitHub context/API/sync and F-03 backup/GitHub regression tests against baseline without real credentials or network.
- [ ] 5.3 Run focused lint and utils/Drawnix typecheck, then full typecheck/tests/cycles/build/size/startup checks against baseline.
- [ ] 5.4 Run available browser/E2E fixture flows for supported/unsupported/migration/reconnect states; classify missing browser binaries separately.
- [ ] 5.5 Review storage before/after at the exact Token key using synthetic records only and document rollback compatibility; never print real values.
- [x] 5.6 Attempt strict OpenSpec validation; the CLI is unavailable (exit 127), so perform manual structure/scenario/requirement-name/conflict checks without claiming strict validation.
