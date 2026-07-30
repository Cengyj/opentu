## ADDED Requirements

### Requirement: Latest Provider Discovery Intent SHALL Own Catalog State

The system SHALL allow only the latest discovery, credential invalidation, or explicit clear intent for a provider profile to commit that profile's discovery catalog, status, error, persistence, and subscriber events.

#### Scenario: Older discovery succeeds after a newer discovery

- **GIVEN** two model discovery requests are in flight for the same provider profile
- **AND** the newer request completes successfully before the older request
- **WHEN** the older request later completes successfully
- **THEN** the profile SHALL retain the newer request's catalog and ready state
- **AND** the older result SHALL NOT be persisted or emitted as the current catalog

#### Scenario: Older discovery fails after a newer discovery succeeds

- **GIVEN** two model discovery requests are in flight for the same provider profile
- **AND** the newer request has completed successfully
- **WHEN** the older request later fails
- **THEN** the profile SHALL retain the newer request's catalog and ready state
- **AND** the user SHALL NOT receive a failure message for the superseded request

#### Scenario: Credentials change while discovery is in flight

- **GIVEN** a model discovery request is in flight for a provider profile
- **WHEN** the user changes that profile's credentials and the previous catalog is invalidated
- **THEN** the in-flight request using the previous credentials SHALL become stale
- **AND** its later result SHALL NOT recreate the invalidated catalog

#### Scenario: Provider catalog is explicitly cleared while discovery is in flight

- **GIVEN** a model discovery request is in flight for a provider profile
- **WHEN** that profile's runtime catalog is explicitly cleared
- **THEN** the in-flight request SHALL become stale
- **AND** its later result SHALL NOT repopulate the cleared catalog

#### Scenario: Different profiles discover concurrently

- **GIVEN** model discovery requests are in flight for two different provider profiles
- **WHEN** both requests complete in any order
- **THEN** each profile SHALL retain its own latest result
- **AND** one profile's request ownership SHALL NOT supersede the other profile

