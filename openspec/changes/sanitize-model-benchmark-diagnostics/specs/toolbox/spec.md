## ADDED Requirements

### Requirement: Model Benchmark Diagnostics Shall Cross A Safe Data Boundary

The system SHALL normalize model benchmark responses and errors into bounded allowlisted preview and diagnostic fields before persistence, rendering, export, or analytics.

#### Scenario: Provider returns an untrusted benchmark response

- **GIVEN** a successful provider response contains unknown, nested, oversized, recursive, credential-shaped, URL/query, HTML, or control-text fields
- **WHEN** the benchmark result is stored, rendered, exported, or analyzed
- **THEN** only the bounded modality preview fields required for comparison SHALL cross those boundaries
- **AND** the raw provider response, prompt echo, credential, token, request metadata, or stack SHALL NOT be persisted or emitted

#### Scenario: Provider returns an unsafe benchmark error

- **WHEN** a provider error contains an arbitrary or unsafe message
- **THEN** durable state and user feedback SHALL contain only safe stage/category/status and an optional bounded allowlisted redacted reason
- **AND** analytics SHALL NOT receive the raw error message, response body, URL, credential, prompt, or stack
- **AND** the original failure SHALL remain classified as a failure

#### Scenario: Historical session contains raw diagnostic data

- **GIVEN** an existing persisted benchmark session contains legacy raw response fields
- **WHEN** the session is loaded
- **THEN** those fields SHALL be ignored by UI, export, and analytics immediately
- **AND** SHALL be omitted on the next ordinary accepted write without a destructive background store migration
