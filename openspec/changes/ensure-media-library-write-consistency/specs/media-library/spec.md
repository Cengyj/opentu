## ADDED Requirements

### Requirement: Local asset writes shall expose one truthful commit result

The system SHALL report a local media-library upload as successful only when its required media and authoritative metadata are both readable, and SHALL safely compensate partial data created by a failed attempt without deleting pre-existing or referenced cache content.

#### Scenario: Local upload commits across required stores

- **GIVEN** a valid local media file that is not already represented by an asset record
- **WHEN** the required cache and metadata writes complete successfully
- **THEN** the system SHALL expose one usable asset card and success result
- **AND** refresh SHALL resolve that card to readable media with the same content identity

#### Scenario: A required local upload write fails

- **GIVEN** a local upload has written only part of its required cache or metadata state
- **WHEN** a later mandatory write fails
- **THEN** the system SHALL report failure and SHALL NOT expose an unusable asset as committed
- **AND** SHALL compensate only partial cache data newly created by that attempt and not referenced elsewhere
- **AND** SHALL preserve any pre-existing shared cache entry

### Requirement: Asset deletion shall preserve failed items and their canvas references

The system SHALL remove a media-library asset from React state, selection, playlists, and canvas references only according to its committed deletion outcome, and SHALL represent mixed batch outcomes per asset.

#### Scenario: Single asset deletion fails before commit

- **GIVEN** an asset is visible in the media library and is referenced by one or more canvas elements
- **WHEN** a required metadata or cache deletion fails and the operation cannot commit
- **THEN** the asset and its canvas elements SHALL remain available
- **AND** the system SHALL report a safe failure and leave the asset retryable
- **AND** SHALL NOT report clean success for a failed compensation

#### Scenario: A batch deletion partially succeeds

- **GIVEN** the user requests deletion of multiple assets or a card representing multiple stored duplicate records
- **WHEN** some durable deletions commit and others fail
- **THEN** only committed assets and their canvas references SHALL be removed
- **AND** failed assets or remaining duplicate records SHALL remain visible and selected for retry
- **AND** the result SHALL identify success, failure, and cleanup-partial counts without treating the whole request as success

### Requirement: Subject metadata shall follow the asset source's authoritative store

The system SHALL commit subject category/name metadata to the authoritative store for the asset source before exposing the updated subject projection, and SHALL treat a missing cache-only record or failed authoritative write as failure.

#### Scenario: Subject metadata commits successfully

- **GIVEN** a local, AI-generated, or cache-only image asset
- **WHEN** its source-authoritative subject metadata write and required projection complete
- **THEN** the system SHALL expose the subject badge/name and preserve them after refresh
- **AND** the asset title and media content SHALL remain unchanged

#### Scenario: Subject metadata write is partial or fails

- **GIVEN** a subject metadata update is in progress
- **WHEN** the authoritative write fails, a cache-only update returns no target, or a required projection cannot be reconciled
- **THEN** the system SHALL NOT report clean success
- **AND** the React projection SHALL match the last authoritative state after reconciliation
- **AND** the user SHALL be able to retry without changing the asset title or media

### Requirement: Local asset loading shall distinguish missing media from unavailable cache inspection

The system SHALL distinguish a readable cache containing no matching media from a Cache API that is unavailable or failed, without issuing a cross-origin fetch per asset during media-library rendering.

#### Scenario: Local metadata points to confirmed-missing media

- **GIVEN** Cache API inspection succeeds and confirms that a local asset's required media entry is absent
- **WHEN** the media library loads
- **THEN** the system SHALL NOT present that record as a usable local asset
- **AND** SHALL expose aggregate recovery diagnostics without fetching the remote source per card

#### Scenario: Cache availability is unknown

- **GIVEN** Cache API is unavailable or its inspection fails
- **WHEN** the media library loads local asset metadata
- **THEN** the system SHALL preserve the metadata without destructive cleanup
- **AND** SHALL expose the cache state as unknown rather than confirmed missing
- **AND** SHALL NOT perform one cross-origin request per asset
