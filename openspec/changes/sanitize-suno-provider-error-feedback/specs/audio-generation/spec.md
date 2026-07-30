## ADDED Requirements

### Requirement: Suno Provider Failures Shall Cross A Safe Error Boundary

The system SHALL convert an untrusted Suno submit or fetch failure response into a bounded safe user/task message and privacy-safe diagnostic summary before storage, rendering, or logging.

#### Scenario: Provider returns an unsafe or unknown error body

- **GIVEN** a failed Suno response contains HTML, an oversized body, request echoes, URLs/query strings, credential-like text, or an unrecognized shape
- **WHEN** the failure reaches task state or Music Analyzer feedback
- **THEN** the user message SHALL contain only a localized action/stage, safe category, and HTTP status
- **AND** task state and diagnostic logging SHALL NOT contain the raw body, prompt, request payload, media URL, credential, token, or stack

#### Scenario: Provider returns a recognized safe reason

- **GIVEN** a failed Suno response contains a bounded allowlisted code or message field
- **WHEN** the reason passes markup, control-character, length, URL, and credential redaction checks
- **THEN** the system MAY include that sanitized reason in user guidance and diagnostics
- **AND** SHALL preserve the original HTTP failure classification

#### Scenario: Successful Suno response is handled

- **WHEN** submit or fetch returns a successful response
- **THEN** routing, polling, result normalization, task persistence, insertion, and Music Analyzer projection SHALL remain unchanged by the error-sanitization boundary
