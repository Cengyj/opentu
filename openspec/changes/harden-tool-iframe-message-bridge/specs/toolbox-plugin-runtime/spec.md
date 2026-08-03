## ADDED Requirements

### Requirement: Tool Iframe Messages Shall Use Registered Runtime Identity

The system SHALL authenticate every iframe bridge message against the exact
live iframe window and origin registered by its renderer before deduplication,
reply resolution or host handler dispatch.

#### Scenario: Registered iframe sends a valid ready message

- **GIVEN** the renderer registered a live HTTP(S) iframe for a tool instance
- **WHEN** that iframe's exact `contentWindow` sends a supported `tool:ready`
  envelope from its resolved origin
- **THEN** the ready handler SHALL run once
- **AND** the host response SHALL target only that exact origin

#### Scenario: Another frame forges a tool identity

- **GIVEN** a tool iframe is registered
- **WHEN** another window, another origin, a stale iframe or an unregistered
  sender posts a message containing the registered `toolId`
- **THEN** no handler or pending reply SHALL run
- **AND** the rejected message ID SHALL NOT prevent a later valid message with
  that ID from being processed

#### Scenario: Registered iframe is detached during replacement

- **GIVEN** an iframe was registered for a tool instance
- **WHEN** the iframe is no longer connected to the document, including before
  an explicit unregister completes
- **THEN** the system SHALL reject its messages before deduplication or handler
  dispatch
- **AND** the detached frame SHALL NOT retain mutation or image-generation
  authority

### Requirement: Privileged Tool Commands Shall Require Trusted Capabilities

The system SHALL require a distinct trusted runtime capability before an iframe
can insert content, request host data, close a canvas tool or create an image
generation task.

#### Scenario: External or imported tool requests a privileged action

- **GIVEN** an external, custom or imported tool has no matching trusted
  built-in manifest capability
- **WHEN** it sends an insert, data, close or generate-image message
- **THEN** the system SHALL reject the message before a host handler runs
- **AND** zero canvas mutations, tasks and provider requests SHALL occur

#### Scenario: Trusted manifest grants the exact capability

- **GIVEN** a live iframe matches its trusted built-in manifest and the manifest
  grants the requested capability
- **WHEN** the registered iframe sends a valid command from its exact origin
- **THEN** the existing host handler SHALL run once
- **AND** unrelated capabilities SHALL remain unavailable

#### Scenario: Tool URL or manifest identity changes

- **GIVEN** a registered iframe has capabilities from an exactly matching
  built-in manifest
- **WHEN** its canvas element changes URL, switches to an internal component or
  changes manifest identity
- **THEN** the previous iframe SHALL be unregistered and stopped before its DOM
  content is replaced
- **AND** capabilities SHALL be resolved again from the current manifest and URL
- **AND** an invalid or non-matching replacement SHALL have no capability

### Requirement: Generic Tool Initialization Shall Exclude Provider Credentials

The system SHALL keep application provider credentials and routing settings out
of the generic iframe initialization message.

#### Scenario: Tool iframe becomes ready

- **WHEN** the host sends `board:init` to a registered tool iframe
- **THEN** the payload MAY contain board identity and theme
- **AND** SHALL NOT contain an API key, provider base URL, selected model or full
  settings payload

### Requirement: Iframe Tool URLs Shall Use One Network-Scheme Policy

The system SHALL accept only iframe tool URLs whose final resolution is a
syntactically valid HTTP(S) URL at toolbox add, update, import and canvas render
boundaries.

#### Scenario: Valid network URL crosses toolbox boundaries

- **WHEN** a tool uses a valid absolute `http:`/`https:` URL or a relative local
  URL that resolves to the application's HTTP(S) origin
- **THEN** add, update, import and render SHALL apply the same normalized policy
- **AND** existing URL templates and valid custom-tool persistence SHALL remain
  unchanged

#### Scenario: Unsafe or malformed URL reaches any boundary

- **WHEN** a tool URL uses `javascript:`, `data:`, `file:`, `blob:`, an opaque
  origin or malformed syntax
- **THEN** the system SHALL reject it before iframe navigation
- **AND** SHALL NOT silently rewrite it to another scheme or execute fallback
  content

### Requirement: Tool Bridge Runtime Shall Follow Live Renderer Lifetime

The system SHALL lazily acquire one synchronous bridge runtime per board for all
live ToolGenerator instances and SHALL destroy that runtime after the last live
generator releases it.

#### Scenario: Multiple tool elements render on one board

- **WHEN** two or more ToolGenerator instances are live on the same board
- **THEN** they SHALL share one ToolCommunicationService and one global message
  listener
- **AND** destroying any non-final generator SHALL NOT destroy the shared bridge

#### Scenario: Last tool generator is destroyed

- **WHEN** the final live ToolGenerator releases the board runtime
- **THEN** the service SHALL remove its global listener and clear pending,
  handler, dedupe and iframe registration state
- **AND** the board SHALL no longer cache that runtime
- **AND** a later tool SHALL acquire one clean replacement runtime
- **AND** a stale or duplicate release SHALL NOT destroy that replacement
