## ADDED Requirements

### Requirement: Provider-Only Selection SHALL Require A Successful Catalog

The system SHALL enter provider-only model selection only after at least one enabled provider profile has a successfully obtained authoritative catalog. A credential signature without a successful catalog SHALL continue to invalidate stale provider models but SHALL NOT by itself suppress curated built-in defaults.

#### Scenario: First discovery is loading

- **GIVEN** an enabled provider profile has credentials but has never obtained a successful model catalog
- **WHEN** its first discovery request is loading
- **THEN** model selectors SHALL keep the curated built-in defaults available
- **AND** SHALL NOT recreate provider models from stale saved references

#### Scenario: First discovery fails

- **GIVEN** no enabled provider profile has a successful model catalog
- **WHEN** the first discovery request fails, returns non-JSON, lacks a data array, or returns an empty list
- **THEN** the user SHALL receive the existing visible failure message
- **AND** model selectors SHALL keep the curated built-in defaults available

#### Scenario: New credentials invalidate a previous catalog

- **GIVEN** a provider profile had a successful catalog for previous credentials
- **WHEN** new credentials invalidate that catalog before a new discovery succeeds
- **THEN** models from the previous credentials SHALL remain unavailable and SHALL NOT be recreated from saved model references
- **AND** curated built-in defaults SHALL remain available if no other enabled profile has a successful catalog

#### Scenario: Another enabled profile has a successful catalog

- **GIVEN** one enabled provider profile has a successful catalog
- **AND** another enabled profile has no successful catalog or its discovery has failed
- **WHEN** a model selector resolves its options
- **THEN** the selector SHALL remain in provider-only mode using enabled successful catalogs
- **AND** SHALL NOT mix curated built-in defaults into the provider-backed list
