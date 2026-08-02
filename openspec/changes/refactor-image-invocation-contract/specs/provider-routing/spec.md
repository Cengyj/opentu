## ADDED Requirements

### Requirement: Executable Image Binding Is Authoritative

The system SHALL use the selected image `InvocationPlan.binding` as the only authority for request schema, response schema, adapter, submit path, poll path, and Base URL strategy.

#### Scenario: Automatic profile selects an adapter

- **WHEN** an automatic provider image plan is resolved
- **THEN** the selected adapter SHALL explicitly support the binding request schema
- **AND** a protocol-only or model-name match SHALL NOT override that requirement

#### Scenario: Binding adapter is unavailable

- **WHEN** no image adapter exactly supports an automatic plan's request schema
- **THEN** execution SHALL fail before transport
- **AND** SHALL NOT try another endpoint as a probe

#### Scenario: Executable image binding is unavailable

- **WHEN** an image invocation has no plan, requests a missing binding, or carries an incomplete binding snapshot
- **THEN** execution SHALL fail with a structured binding or recovery error before adapter and transport execution
- **AND** manual and automatic profiles SHALL NOT use a fixed image endpoint as a no-plan fallback

#### Scenario: Binding carries custom endpoint metadata

- **WHEN** a selected image binding contains custom submit or poll paths
- **THEN** every adapter and transport request SHALL use those paths
- **AND** fixed OpenAI, Gemini, MJ, Flux, Seedream, or asynchronous templates SHALL NOT replace them

#### Scenario: Same model ID belongs to different profiles or bindings

- **WHEN** identical image model IDs exist under different profiles or binding identities
- **THEN** capabilities, adapter, endpoint, retry, and recovery SHALL remain isolated by the complete provider-scoped identity

#### Scenario: Submitted task resumes from its binding snapshot

- **GIVEN** an image task persisted a complete credential-free binding snapshot
- **WHEN** retry or refresh recovery hydrates the invocation
- **THEN** protocol, schemas, submit path, and poll path SHALL come from that snapshot
- **AND** the system SHALL refresh credentials only from the same current profile
- **AND** SHALL NOT reconstruct a binding from the current catalog or a binding ID alone

#### Scenario: Current and resumed pollers obey the selected binding

- **WHEN** a current-session queue execution polls after submit or a prior-session task performs query-only recovery
- **THEN** the poll request and response parser SHALL come from that execution's selected or persisted binding snapshot
- **AND** neither path SHALL re-plan an endpoint or create a second routing authority

#### Scenario: Uncalled Photo Wall executor cannot bypass routing

- **GIVEN** the audited legacy Photo Wall direct image executor has no production caller
- **WHEN** image execution surfaces are converged
- **THEN** the dead executor SHALL be removed rather than retained as a parallel client path
- **AND** live Photo Wall consumers SHALL continue through the canonical MCP or canvas boundaries

### Requirement: Image Planning Fails Before Network On Ambiguity

The system SHALL resolve endpoint metadata in evidence order and SHALL reject unresolved conflicts before executing provider transport.

#### Scenario: Discovered endpoint overrides a fixed template

- **WHEN** model-scoped discovered metadata explicitly supplies a protocol, request schema, submit path, or poll path
- **THEN** the invocation binding SHALL preserve that supported metadata according to its evidence priority
- **AND** an unrelated fixed template SHALL NOT overwrite it

#### Scenario: Endpoint evidence conflicts

- **WHEN** equally authoritative image binding metadata selects incompatible execution identities and no binding selector resolves the conflict
- **THEN** planning SHALL fail with the profile, model, and operation identity
- **AND** SHALL send zero provider requests

### Requirement: Image Routing Does Not Change Other Modalities

The system SHALL keep the existing text, video, and audio planner, adapter, transport, and task behavior while refactoring image execution.

#### Scenario: Non-image route executes

- **WHEN** a text, video, or audio request is planned and executed
- **THEN** its binding selection, request serialization, endpoint, cancellation, retry, and result behavior SHALL remain unchanged
