## ADDED Requirements

### Requirement: Route GPT Image Generation Through The Official GPT Adapter

The system SHALL route GPT Image generation that resolves to `openai-gpt-image` through the official GPT image adapter.

#### Scenario: GPT Image generation uses official adapter ownership

- **GIVEN** a provider profile resolves image API compatibility to `openai-gpt-image`
- **AND** the selected model is a GPT Image model
- **WHEN** image generation is invoked
- **THEN** the request SHALL use `openai.image.gpt-generation-json`
- **AND** the request SHALL be handled by `gpt-image-adapter`

### Requirement: Route GPT Image Edit Through The Official GPT Adapter

The system SHALL route GPT Image edit requests that resolve to `openai-gpt-image` through the official GPT edit schema and adapter.

#### Scenario: GPT Image edit uses official edit transport

- **GIVEN** a provider profile resolves image API compatibility to `openai-gpt-image`
- **AND** the selected model is a GPT Image model
- **WHEN** image edit is invoked with reference images
- **THEN** the request SHALL use `openai.image.gpt-edit-form`
- **AND** the request SHALL be handled by `gpt-image-adapter`

### Requirement: Remove Dedicated For GPT Image Adapter Path

The system SHALL not register or select a dedicated For GPT image adapter.

#### Scenario: Removed For GPT compatibility is used by existing settings

- **GIVEN** existing settings contain `for-gpt-image`, `tuzi-gpt-image`, or `tuzi-compatible`
- **WHEN** image routing and adapter selection run after normalization
- **THEN** the selected compatibility SHALL be `openai-gpt-image`
- **AND** the selected adapter SHALL be `gpt-image-adapter`
