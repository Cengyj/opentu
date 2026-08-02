## ADDED Requirements

### Requirement: Automatic Image Routing Evidence Converges Independently

The system SHALL version persisted automatic image-routing evidence independently from application `version` and `releaseId`. Discovered catalog image evidence may contribute to an automatic image `InvocationPlan` only when its evidence version is current, its discovery timestamp is finite, its normalized model API Base URL and opaque credential identity match the Profile, and the Profile currently has a credential. Pricing endpoint evidence additionally requires the current credential-scoped pricing-source signature and its configured freshness window.

#### Scenario: Automatic profile loads legacy catalog evidence

- **GIVEN** an `auto` Profile has persisted discovered image models whose routing evidence version is absent or stale
- **WHEN** settings-backed bindings are constructed
- **THEN** those image models SHALL NOT produce an automatic image binding
- **AND** non-image catalog entries and persisted selected model IDs SHALL remain intact

#### Scenario: Automatic profile loads stale endpoint evidence

- **GIVEN** pricing groups or prices remain readable from a persisted cache
- **AND** its image endpoint evidence has a stale version, mismatched source identity, missing current credential, or expired freshness
- **WHEN** an automatic image binding is constructed
- **THEN** that endpoint evidence SHALL NOT participate in planning
- **AND** no provider image-generation request SHALL be sent from the stale evidence

#### Scenario: Stale evidence is refreshed successfully

- **GIVEN** an enabled `auto` Profile has stale image-routing evidence and current credentials
- **WHEN** startup performs normal model discovery against that same Profile
- **THEN** the refreshed catalog SHALL persist the current routing evidence version and source identity
- **AND** previously selected model IDs that still exist SHALL remain selected
- **AND** subsequent invocations MAY plan from the refreshed evidence

#### Scenario: Profile credentials change while the application is running

- **GIVEN** an enabled `auto` Profile has current persisted image-routing evidence
- **WHEN** its Base URL or API credential changes at runtime
- **THEN** the previous image evidence SHALL become non-authoritative immediately
- **AND** one normal model discovery SHALL run against the new Profile identity
- **AND** selected model IDs that still exist in the new response SHALL remain selected
- **AND** changing only unrelated Profile presentation or header fields SHALL NOT trigger model discovery

#### Scenario: Concurrent discovery uses the same Profile identity

- **WHEN** multiple callers request model discovery concurrently for the same Profile, normalized Base URL, and credential identity
- **THEN** they SHALL share one in-flight `/models` request
- **AND** all callers SHALL observe the same completed catalog

#### Scenario: A superseded discovery completes late

- **GIVEN** model discovery for an older Profile identity remains in flight
- **WHEN** discovery for a newer identity starts or the catalog is explicitly cleared
- **THEN** the older request SHALL be aborted when possible
- **AND** its late success or failure SHALL NOT replace, clear, or mark the newer catalog as failed

#### Scenario: Distinct credentials produce routing identities

- **WHEN** a Profile credential is replaced with a distinct credential
- **THEN** catalog and pricing endpoint evidence created for the earlier credential SHALL NOT be accepted for the new credential
- **AND** persisted source signatures SHALL NOT contain the source credential

#### Scenario: Persisted pricing cache changes externally

- **GIVEN** the in-memory pricing service has loaded settings-backed endpoint evidence
- **WHEN** backup, sync, restore, or another settings writer replaces or removes that persisted cache
- **THEN** the in-memory cache SHALL converge to the authoritative settings snapshot
- **AND** removed Profile evidence SHALL no longer participate in routing

#### Scenario: Legacy evidence contains only unselected image models

- **GIVEN** an automatic Profile has a legacy image-only catalog with no signature and no selected model ID
- **WHEN** startup hides that non-authoritative image evidence
- **THEN** the retained stale catalog snapshot SHALL still count as refresh evidence
- **AND** normal model discovery SHALL be scheduled instead of treating the Profile as an empty never-discovered catalog

#### Scenario: Stale evidence refresh fails

- **GIVEN** an enabled `auto` Profile has stale image-routing evidence
- **WHEN** its normal discovery refresh fails
- **THEN** the legacy image evidence SHALL remain non-authoritative
- **AND** the system SHALL preserve the Profile, authentication settings, extra headers, catalog records, selected model IDs, prices, tasks, images, and artifacts
- **AND** it SHALL NOT probe image generation endpoints as a fallback

#### Scenario: Manual provider reads existing evidence

- **WHEN** a Profile explicitly selects `openai-compatible`, `gemini-compatible`, or `custom`
- **THEN** routing-evidence version gating SHALL NOT change its existing manual binding inference semantics

#### Scenario: Application release identity changes

- **WHEN** application `version` or `releaseId` changes without a routing evidence schema change
- **THEN** automatic image evidence validity SHALL continue to depend on `routingEvidenceVersion`, source identity, credential validity, and freshness
- **AND** the application release identity SHALL NOT become a second routing authority
