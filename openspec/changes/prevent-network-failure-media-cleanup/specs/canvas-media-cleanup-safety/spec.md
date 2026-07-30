## ADDED Requirements

### Requirement: Canvas media cleanup shall delete only confirmed invalid media

The system SHALL distinguish valid, confirmed-invalid and unknown media-link outcomes and SHALL remove a canvas media element only when the bounded probe produces definitive invalid evidence.

#### Scenario: Media is reachable

- **WHEN** the cleanup probe establishes that a canvas media resource is reachable or receives the existing compatible opaque response
- **THEN** the system SHALL keep the media element
- **AND** SHALL NOT count it as invalid or unknown

#### Scenario: Media is definitively absent

- **WHEN** a readable bounded probe establishes a terminal absence response such as HTTP 404 or 410
- **THEN** the system SHALL remove the corresponding current canvas media element through the existing Plait operation path
- **AND** SHALL count it as a confirmed invalid removal

#### Scenario: Reachability is unknown

- **WHEN** offline state, network rejection, DNS, CORS or browser policy, abort, authorization, rate limit, unsupported method, or temporary server failure prevents definitive classification
- **THEN** the system SHALL classify the result as unknown
- **AND** SHALL preserve the canvas media element

#### Scenario: HEAD is inconclusive but fallback succeeds

- **WHEN** the HEAD probe is unsupported or inconclusive and the single bounded fallback establishes reachability
- **THEN** the system SHALL classify the media as valid
- **AND** SHALL preserve it without issuing additional retries

### Requirement: Canvas media cleanup shall expose truthful aggregate outcomes

The system SHALL report confirmed removals separately from preserved unknown items and SHALL keep unknown items retryable without exposing media URLs or contents.

#### Scenario: Mixed confirmed-invalid and unknown media

- **WHEN** one cleanup run contains both confirmed-invalid and unknown results
- **THEN** the system SHALL remove and report only the confirmed-invalid elements
- **AND** SHALL report that unknown elements were preserved
- **AND** SHALL allow the user to rerun the existing action after conditions change

#### Scenario: All checked media remain valid or unknown

- **WHEN** a cleanup run has no confirmed-invalid result
- **THEN** the system SHALL perform no remove operation
- **AND** SHALL distinguish “no invalid media” from “some media could not be verified” in localized feedback

#### Scenario: Duplicate activation while scanning

- **WHEN** the cleanup action is activated again while the current scan is pending
- **THEN** the system SHALL keep a single active scan and mutation sequence
- **AND** SHALL re-enable the existing action after the run settles

### Requirement: Confirmed cleanup shall preserve board history and persistence contracts

The system SHALL keep confirmed cleanup removals in the existing Plait history and workspace persistence flow while unknown-only scans remain non-mutating.

#### Scenario: User undoes a confirmed cleanup

- **WHEN** confirmed invalid elements are removed and the user invokes the existing undo action before another conflicting edit
- **THEN** the removed elements SHALL be restored through the existing board history
- **AND** the restored state SHALL follow the normal workspace autosave path

#### Scenario: Unknown-only scan completes

- **WHEN** every non-valid result is unknown
- **THEN** the system SHALL create no element-removal operation
- **AND** SHALL NOT create a board persistence write solely for cleanup

#### Scenario: Board order changes while probes are pending

- **WHEN** another board operation changes element indices before a cleanup probe settles
- **THEN** cleanup SHALL resolve the scanned element by current identity/path
- **AND** SHALL NOT remove a different element that occupies the scan-time index

#### Scenario: Data contracts remain compatible

- **WHEN** the cleanup safety correction is applied or rolled back
- **THEN** board elements, `.drawnix` files, workspace records, cache entries, backups and migrations SHALL retain their existing formats
- **AND** no cache purge, user-data rewrite, credential, provider route, task record or analytics schema change SHALL be required

