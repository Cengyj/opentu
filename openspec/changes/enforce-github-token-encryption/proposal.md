# Change: Enforce GitHub Token encryption before persistence and use

## Why

The reachable Token guide states that the GitHub Token is stored locally with AES-256 encryption. The current Token service normally satisfies that statement through `CryptoUtils`, but the shared crypto utility silently falls back to reversible `OPENTU_FB:` Base64 when Web Crypto is unavailable or AES encryption throws. It also reports that fallback as “encrypted.” A controlled no-Web-Crypto diagnostic confirmed that a value encoded with one fixture password is recovered with a different password.

Persisting or reusing a Token under that fallback contradicts the current user-facing security contract. Failing closed and safely handling existing fallback records changes credential availability, storage, recovery, and security behavior, so implementation requires approval.

## What Changes

- Require a verified AES-256-GCM result before the existing Token service commits a new GitHub Token to its current localStorage key.
- Reject connection persistence with actionable non-secret feedback when secure encryption is unavailable or fails; do not overwrite an existing valid secure Token.
- Detect existing `OPENTU_FB:`/legacy fallback Token records before use.
- When Web Crypto is available, decode and atomically rewrite a valid fallback record into the existing AES format before caching or using it.
- When secure migration is unavailable or fails, block use without deleting or logging the recoverable stored value and ask the user to restore a secure context/reconnect.
- Make the Token guide and connection state truthful about secure-storage availability without exposing the Token.
- Preserve GitHub validation/scope requests, Token/config keys, AES parameters, sync payload encryption, Gist data, and all non-credential storage.

## Impact

- Affected specs: `github-token-security` (new delta capability)
- Affected code: `packages/utils/src/crypto` secure-result detection/API, `crypto-utils.ts`, `github-sync/token-service.ts`, `GitHubSyncContext.tsx`, Token guide/connection feedback, and focused tests
- Adjacent changes:
  - `improve-backup-sync-interface-accessibility` owns field names, dialog/status semantics, i18n, and password presentation, not storage policy.
  - GitHub data sync changes own records, conflict application, tasks, Gists, and payload encryption.
  - Custom synchronization-password XOR storage has no approved threat-model contract and remains a separately recorded hypothesis; it is not migrated here.
- Data impact: opportunistic in-place rewrite of only fallback-encoded `github_sync_token` values at the same key; no plaintext export, bulk migration, or other key/schema change
- Rollback: restore permissive fallback behavior and old tests; already migrated Tokens remain valid AES payloads, but rollback cannot reconstruct a fallback record that was securely rewritten

## Evidence

- `token-service.ts:28-47` writes exactly the string returned by `CryptoUtils.encrypt` to `github_sync_token`; it does not distinguish AES from fallback.
- `crypto-utils.ts:57-68` delegates Token encryption/decryption to `@aitu/utils`.
- `packages/utils/src/crypto/aes-gcm.ts:161-197` returns `OPENTU_FB:` Base64 when Web Crypto is unavailable or encryption throws.
- `aes-gcm.ts:219-220,257-260` decodes fallback without a password check and reports fallback data as encrypted.
- Controlled Node/Vitest diagnostic with a non-secret sentinel and `crypto=undefined`: `prefix=OPENTU_FB:`, `isReportedEncrypted=true`, and `differentPasswordRecoversPlaintext=true`; 1/1 test passed, exit 0.
- `TokenGuide.tsx:95-99` unconditionally states that the Token is stored locally with AES-256 encryption.
- Normal Token encryption remains separately evidenced by `aes-gcm.ts:16-19,65-95,175-192` using PBKDF2/SHA-256 and AES-GCM length 256. This proposal does not claim the normal path is broken.

## Approval

Implementation is blocked until the user approves fail-closed Token persistence/use and opportunistic fallback-record secure rewrite behavior.
