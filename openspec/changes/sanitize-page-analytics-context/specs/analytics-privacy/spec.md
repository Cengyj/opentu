## ADDED Requirements

### Requirement: Page analytics SHALL exclude query, fragment, and detailed referrer data

The system SHALL construct a privacy-safe page context before page lifecycle or Web Vitals data reaches the analytics transport.

#### Scenario: Page lifecycle event is reported

- **WHEN** an initial view, SPA view, unload, hidden, visible, or page-performance event is reported
- **THEN** page URL context SHALL contain at most the page origin and pathname
- **AND** query parameters and fragments SHALL NOT enter the analytics payload
- **AND** existing event names, route path, release context, timing, device, and resource fields SHALL remain unchanged

#### Scenario: Web Vitals metric is reported

- **WHEN** a Web Vitals callback reports a supported metric
- **THEN** metric value, delta, rating, navigation type, route path, and timestamp SHALL be preserved
- **AND** referrer context SHALL contain at most a parseable HTTP(S) origin
- **AND** referrer path, query, fragment, credential, or token values SHALL NOT enter the analytics payload

#### Scenario: Referrer is unavailable or unsafe to parse

- **WHEN** referrer is empty, malformed, opaque, or uses an unsupported scheme
- **THEN** referrer analytics context SHALL be omitted or empty
- **AND** event or metric reporting SHALL continue without throwing

#### Scenario: Analytics is disabled

- **WHEN** the analytics transport is unavailable or disabled
- **THEN** page and Web Vitals reporting SHALL remain a no-op
- **AND** the privacy context helper SHALL NOT introduce a network, storage, or user-visible side effect
