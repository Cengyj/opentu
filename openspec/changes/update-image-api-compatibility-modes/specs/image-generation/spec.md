## ADDED Requirements

### Requirement: Keep Official GPT Image On The Dedicated Official Adapter

The system SHALL keep official GPT Image generation and edit requests on the dedicated official adapter path.

#### Scenario: Official GPT text-to-image uses the official adapter

- **GIVEN** a provider profile resolves image API compatibility to `openai-gpt-image`
- **AND** the selected model is a GPT Image model
- **WHEN** the user submits a text-to-image request
- **THEN** the request SHALL be handled by the dedicated official GPT image adapter
- **AND** SHALL use `/images/generations`

#### Scenario: Official GPT edit uses the official edit transport

- **GIVEN** a provider profile resolves image API compatibility to `openai-gpt-image`
- **AND** the selected model is a GPT Image model
- **AND** the request includes edit inputs
- **WHEN** the image task executes
- **THEN** the dedicated official GPT image adapter SHALL send the request to `/images/edits`
- **AND** SHALL use multipart/form-data

### Requirement: Route For GPT Generation Through A Dedicated For GPT Adapter

The system SHALL route For GPT generation through a dedicated For GPT image adapter instead of the generic default/basic adapter. The canonical compatibility identifier is `for-gpt-image`; historical `tuzi-gpt-image` and `tuzi-compatible` values remain legacy aliases that normalize to it.

#### Scenario: For GPT generation uses dedicated adapter ownership

- **GIVEN** a provider profile resolves image API compatibility to `for-gpt-image`
- **AND** the selected model is a GPT Image model
- **WHEN** the user submits a text-to-image request
- **THEN** the request SHALL be handled by the dedicated For GPT image adapter
- **AND** SHALL NOT rely on GPT-specific translation logic hidden inside the generic default/basic adapter

### Requirement: Keep Generic Basic Compatibility As Fallback

The system SHALL preserve a generic fallback path for broad OpenAI-compatible image gateways.

#### Scenario: Generic compatibility still uses the default adapter

- **GIVEN** a provider profile resolves image API compatibility to `openai-compatible-basic`
- **WHEN** the user submits an image request
- **THEN** the request SHALL remain eligible for the default/basic image adapter

### Requirement: Keep Official Quality Semantics Separate From Legacy Resolution Folding

The system SHALL keep official GPT image quality semantics separate from legacy compatibility resolution semantics.

#### Scenario: Official GPT forwards official quality values

- **GIVEN** a provider profile resolves image API compatibility to `openai-gpt-image`
- **AND** the request includes official GPT image quality such as `auto`, `low`, `medium`, or `high`
- **WHEN** the request is serialized
- **THEN** the outbound official GPT request SHALL preserve the official quality meaning

#### Scenario: For GPT folds compatibility resolution into legacy quality

- **GIVEN** a provider profile resolves image API compatibility to `for-gpt-image`
- **AND** the request includes a compatibility resolution tier such as `1k`, `2k`, or `4k`
- **WHEN** the request is serialized
- **THEN** the For GPT adapter SHALL translate that compatibility resolution into the outbound For/basic quality field
- **AND** SHALL NOT blindly forward official GPT quality values unless the For GPT contract explicitly supports them

### Requirement: Prepare For GPT Edit Support Without Rebinding It To Generic Fallback

The system SHALL leave room for a future For GPT edit contract without requiring it to live permanently inside the generic fallback adapter.

#### Scenario: For GPT edit remains a dedicated follow-up

- **GIVEN** a provider profile resolves image API compatibility to `for-gpt-image`
- **WHEN** the system later adds image-edit support for that mode
- **THEN** the implementation SHALL route through the For GPT adapter boundary
- **AND** SHALL NOT require the generic fallback adapter to become the long-term owner of For GPT edit semantics
