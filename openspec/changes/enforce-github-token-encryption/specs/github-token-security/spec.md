## ADDED Requirements

### Requirement: GitHub Tokens are persisted only as verified secure ciphertext

The system SHALL persist and use a GitHub Token only after producing and verifying the existing AES-256-GCM ciphertext format and SHALL fail closed without replacing an existing secure record when secure encryption is unavailable or fails.

#### Scenario: Save a Token with secure crypto available
- **GIVEN** a candidate Token passes the existing format, GitHub identity, and scope validation
- **AND** Web Crypto produces the existing AES-256-GCM format
- **WHEN** the Token service commits the credential
- **THEN** only the verified ciphertext SHALL be written to the existing Token key
- **AND** the in-memory Token and validation state SHALL update only after the write succeeds

#### Scenario: Secure crypto is unavailable
- **GIVEN** a candidate Token reaches persistence but Web Crypto is unavailable
- **WHEN** the shared crypto layer would return a Base64 fallback
- **THEN** the Token service SHALL reject persistence and use
- **AND** SHALL NOT write, cache, log, or expose the candidate Token
- **AND** any prior secure Token record SHALL remain unchanged

#### Scenario: Secure encryption or storage fails
- **GIVEN** a prior secure Token may exist
- **WHEN** AES encryption, ciphertext verification, or localStorage commit fails for a new candidate
- **THEN** the connection SHALL report a non-secret recoverable failure
- **AND** the prior record/cache SHALL NOT be replaced by fallback, partial, or candidate data

### Requirement: Existing fallback Token records are secured before reuse

The system SHALL detect existing `OPENTU_FB:` and legacy `AITU_FB:` Token records and SHALL NOT cache or use their plaintext until an in-place verified AES rewrite succeeds.

#### Scenario: Securely migrate a fallback Token
- **GIVEN** the existing Token key contains a valid fallback record
- **AND** Web Crypto and localStorage commit are available
- **WHEN** the Token service reads the credential
- **THEN** it SHALL decode the value only in memory, produce verified AES ciphertext, and rewrite the same key
- **AND** SHALL cache or use the Token only after the secure rewrite succeeds

#### Scenario: Fallback migration cannot complete
- **GIVEN** the existing Token key contains a recoverable fallback record
- **WHEN** Web Crypto, encryption, verification, or storage commit is unavailable or fails
- **THEN** synchronization SHALL remain disconnected and expose a non-secret recovery state
- **AND** the original stored record SHALL remain unchanged for a later secure retry
- **AND** transient plaintext SHALL NOT be cached, logged, or returned for API use

#### Scenario: Stored Token data is malformed
- **GIVEN** the existing Token key contains neither verified AES ciphertext nor a valid fallback record
- **WHEN** the Token service reads it
- **THEN** the system SHALL follow the existing safe invalid-credential recovery path
- **AND** SHALL NOT include raw stored data in UI, logs, analytics, backups, or requests

### Requirement: GitHub Token security state is truthful and non-secret

The system SHALL communicate whether verified secure Token storage is available or requires recovery without disclosing credential data or changing GitHub synchronization data semantics.

#### Scenario: Secure storage is available
- **GIVEN** the Token is stored in verified AES ciphertext
- **WHEN** the user opens the Token guide or connection state
- **THEN** application copy MAY state that AES-256 encrypted local storage is active
- **AND** SHALL NOT reveal the Token, key material, ciphertext, or full authorization header

#### Scenario: Secure storage is unavailable or migration is blocked
- **GIVEN** verified AES persistence cannot complete
- **WHEN** the user attempts connection or opens the relevant recovery state
- **THEN** the UI SHALL state that secure credential storage is unavailable and provide the existing reconnect/retry path
- **AND** SHALL NOT claim that a fallback value is AES encrypted
- **AND** no GitHub pull, push, Gist mutation, or authorization request SHALL use that credential
