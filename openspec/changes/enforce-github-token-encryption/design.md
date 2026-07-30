## Context

`TokenService` validates a candidate Token against GitHub before saving it, then uses a device-derived password through `CryptoUtils`. The shared `@aitu/utils` crypto helper intentionally supports a non-secure Base64 fallback for development/unsupported environments and identifies both AES and fallback strings as encrypted. That generic fallback may have other callers, so changing it globally would broaden scope.

The existing Token key is a localStorage string. Secure values are JSON containing AES ciphertext, IV, and salt; fallback values start with `OPENTU_FB:` or legacy `AITU_FB:`. The Token guide currently makes an unconditional AES-256 claim.

## Goals / Non-Goals

- Goals: make Token persistence/use fail closed unless AES-256-GCM is verified, preserve an existing secure Token on save failure, safely rewrite recoverable fallback records when possible, surface actionable non-secret state, and keep the current key/API/sync behavior.
- Non-Goals: hardware-backed credentials, server-side secrets, OAuth/device flow, changing Token scopes, changing GitHub endpoints, changing sync payload encryption, deleting Gists, rotating Tokens remotely, migrating the custom synchronization password, or removing the generic crypto fallback for unrelated consumers.

## Decisions

- Decision: add or expose an explicit secure-ciphertext predicate/result at the crypto boundary. `isEncrypted()` cannot be used because it intentionally returns true for fallback values.
- Decision: `TokenService.saveToken` computes and verifies a secure ciphertext before mutating localStorage or the in-memory cache. An unsupported/failed crypto attempt returns a typed safe error and leaves any prior secure record/cache intact.
- Decision: `TokenService.getToken` classifies the stored string before decrypting. Secure AES proceeds as today. Fallback data is decoded only inside an in-memory migration transaction, immediately re-encrypted, verified, and written at the same key before the Token can be cached or used.
- Decision: if fallback migration cannot produce and commit verified AES, do not expose/use/cache the plaintext and do not delete/overwrite the stored fallback. Return a typed “secure storage unavailable/migration required” state so the UI can explain recovery without the credential.
- Decision: malformed values keep the current safe-disconnect behavior only after tests distinguish unrecoverable corruption from recoverable fallback. No raw ciphertext/plaintext enters errors or logs.
- Decision: keep normal AES parameters and key derivation unchanged to avoid invalidating secure existing records. No eager scan runs outside an existing Token read/connect path.

## Invariants

- `github_sync_token` and `github_token_validated` keys remain unchanged.
- GitHub format validation, `/user` validation, scope check, authorization header, config, Gist selection, pull/push, and disconnect semantics remain unchanged after a Token is securely available.
- Normal secure Token records remain readable without rewrite.
- A failed new save never replaces a prior secure record with fallback or clears it.
- Fallback plaintext/ciphertext is never logged, included in UI text, analytics, backups, or accessible names.
- Backup secrets behavior and GitHub payload AES-256-GCM are separate and unchanged.

## Risks / Trade-offs

- Users in an insecure/unsupported environment can validate a Token but cannot persist/use it for sync. This is the intended fail-closed trade-off and requires clear recovery feedback.
- Rewriting a fallback record is a sensitive mutation. Mitigation: verify new AES ciphertext and successful same-key commit before caching/using; retain the old value on any failure.
- An already cached fallback Token from a runtime predating the fix cannot be classified by storage alone. Mitigation: initialization tests start with cache empty; deployment does not preserve JS singleton memory across reload.
- Device-key instability can still make secure records unreadable. This existing design is not changed; corrupted/unreadable handling remains tested and non-secret.
- Rollback after successful migration keeps the AES record and remains compatible. It cannot reconstruct the insecure fallback representation, which is neither needed nor desirable.

## Migration And Rollback

1. On an ordinary Token read, classify the stored string.
2. If secure AES, decrypt normally.
3. If fallback and secure crypto is available, decode in memory, encrypt to verified AES, write same key, then cache/use.
4. If any migration step fails, leave the original localStorage value untouched, clear transient plaintext, block sync, and expose a safe recovery status.
5. Rollback restores permissive detection/use. Securely migrated records remain compatible with the old normal AES path; no reverse migration is run.

## Verification

- Unit tests cover normal AES save/read, no-Web-Crypto save, encryption rejection, prior-record preservation, both fallback prefixes, migration success, write failure, unsupported migration, malformed ciphertext, cache state, clear/reconnect, and redacted logs/errors.
- Integration tests cover Token format/GitHub validation/scope success and failure without making real requests.
- Browser tests use fixture Tokens only and verify safe copy/state; no real credential is read or written.
- Full backup/GitHub tests prove no payload, key, config, record, or Gist regression.
