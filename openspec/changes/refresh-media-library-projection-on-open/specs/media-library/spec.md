## ADDED Requirements

### Requirement: A visible media-library open shall read a current committed projection

The system SHALL treat each closed-to-open media-library transition as a freshness boundary and SHALL expose asset-source records that committed before that transition without suppressing the read solely because a prior successful projection is less than eight seconds old.

#### Scenario: A generation result commits before a quick reopen

- **GIVEN** the media library completed a successful load and was closed
- **AND** a completed media task and its cache metadata committed after that load
- **WHEN** the user reopens the media library before the previous projection's reuse interval expires
- **THEN** the settled library projection SHALL include the committed generation result
- **AND** the visible-open request SHALL NOT return only because the prior projection is younger than the reuse interval

#### Scenario: An external local or cache record commits before reopen

- **GIVEN** an asset source outside the current `AssetContext.addAsset` action commits a record while the media library is closed
- **WHEN** the next visible-open load begins after that commit
- **THEN** the settled projection SHALL be derived from the current local, task and unified-cache sources
- **AND** existing merge, deduplication and sort rules SHALL remain unchanged

### Requirement: Visible-open freshness shall preserve one load owner

The system SHALL satisfy visible-open freshness through the existing asset-load ownership boundary without creating duplicate concurrent source reads or a continuous polling loop.

#### Scenario: Initialization and visible open overlap

- **GIVEN** an asset load is already in flight when the media library becomes visible
- **WHEN** the visible-open request is issued
- **THEN** both callers SHALL settle from the same in-flight load operation
- **AND** each durable source SHALL be read at most once by that operation

#### Scenario: The open modal rerenders

- **GIVEN** the media library is already open
- **WHEN** filters, selection, responsive state, StrictMode replay or an unrelated render occurs without a new closed-to-open transition
- **THEN** the system SHALL NOT start another source-read wave solely because of that render
- **AND** SHALL NOT introduce periodic polling

### Requirement: A failed visible refresh shall preserve usable state and remain retryable

The system SHALL preserve the last usable asset projection when a visible-open refresh fails and SHALL allow a later closed-to-open transition to retry without destructive cleanup or a false successful-fresh marker.

#### Scenario: Visible-open source read fails

- **GIVEN** a prior usable asset projection exists
- **WHEN** a visible-open refresh fails while reading or merging a required source
- **THEN** the prior usable cards SHALL remain available with the existing failure feedback
- **AND** no asset, task, cache, playlist or canvas data SHALL be deleted
- **AND** the failed attempt SHALL NOT advance the successful-load timestamp

#### Scenario: The user reopens after a failed refresh

- **GIVEN** the preceding visible-open refresh failed
- **WHEN** the user closes and reopens the media library
- **THEN** the system SHALL make a new source-read attempt
- **AND** a successful retry SHALL publish one current merged projection
