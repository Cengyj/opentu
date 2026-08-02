## ADDED Requirements

### Requirement: Select Asynchronous Image Protocols From Invocation Evidence

The system SHALL select an asynchronous image protocol from the final model binding evidence and SHALL NOT expose or persist a provider-profile preference that forces unrelated image models onto an asynchronous endpoint.

#### Scenario: Provider settings omit the experimental preference

- **WHEN** a user creates, edits, saves, reloads, exports, or imports a provider profile
- **THEN** the profile SHALL NOT expose or emit `preferAsyncImageEndpoint`
- **AND** image protocol selection SHALL remain owned by `InvocationPlan.binding`

#### Scenario: Legacy settings contain the removed property

- **GIVEN** stored settings or a backup contains `preferAsyncImageEndpoint`
- **WHEN** provider profiles are normalized
- **THEN** the obsolete property SHALL be ignored
- **AND** other provider fields SHALL remain unchanged
- **AND** the next normalized settings write SHALL omit the property

#### Scenario: Ordinary image model has no asynchronous evidence

- **GIVEN** a final image model has no asynchronous model classification, discovered asynchronous endpoint, or explicit executable binding metadata
- **WHEN** its invocation is planned
- **THEN** the system SHALL NOT fabricate an `openai.async.media` binding or `/videos` submit path
- **AND** the model's existing dedicated or compatible image binding SHALL remain eligible

#### Scenario: Supported provider model is explicitly asynchronous

- **GIVEN** the final provider-scoped model is classified as a supported asynchronous image model
- **AND** its provider profile supports the existing asynchronous-image template
- **WHEN** its invocation is planned
- **THEN** the existing `openai.async.media` binding SHALL remain available
- **AND** submit, poll, cancellation, cache, retry, recovery, and result handling SHALL retain their existing behavior

#### Scenario: Provider discovery declares an asynchronous image endpoint

- **GIVEN** endpoint metadata for the final provider-scoped image model declares `scenario=async-image`
- **WHEN** bindings are inferred and planned
- **THEN** the discovered asynchronous binding SHALL be eligible without a profile-wide preference
- **AND** its binding-defined submit and poll paths SHALL remain authoritative

#### Scenario: Existing task has a complete asynchronous binding snapshot

- **GIVEN** an existing submitted image task persisted its complete credential-free asynchronous binding snapshot and remote ID
- **WHEN** retry or refresh recovery resumes the task for the same profile and model
- **THEN** the system SHALL execute the persisted protocol, schemas, submit path, and poll path from that snapshot
- **AND** SHALL refresh credentials only from the same current profile
- **AND** SHALL NOT add or reconstruct that binding in normal candidates for new invocations

#### Scenario: Legacy task has only an asynchronous binding ID

- **GIVEN** an existing image task lacks a complete executable binding snapshot
- **WHEN** retry or refresh recovery is requested with only a binding ID or other partial routing state
- **THEN** the system SHALL fail recovery explicitly before transport
- **AND** SHALL NOT reconstruct `/videos`, replan against the current catalog, submit again, or probe another endpoint
