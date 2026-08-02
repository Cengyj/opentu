## ADDED Requirements

### Requirement: Persist Automatic Provider Protocol Intent

The system SHALL support `auto` as a `ProviderProfile.providerType` configuration intent and SHALL keep it distinct from image request-body compatibility and executable protocol state.

#### Scenario: User saves automatic provider type

- **WHEN** a user selects “自动（按模型）” for a provider profile and saves settings
- **THEN** the profile SHALL reload with `providerType=auto`
- **AND** its Base URL, API key, explicit `authType`, `extraHeaders`, image compatibility, and model catalog SHALL remain unchanged

#### Scenario: User switches image models

- **GIVEN** a provider profile has `providerType=auto`
- **WHEN** the user switches between models in that profile or completes an invocation
- **THEN** the stored profile SHALL remain `providerType=auto`
- **AND** the system SHALL NOT persist a separate effective protocol

#### Scenario: User creates a provider profile in settings

- **WHEN** a user creates a provider profile in the settings page
- **THEN** the new profile draft SHALL default to `providerType=auto`
- **AND** its existing authentication and image-compatibility defaults SHALL remain unchanged

#### Scenario: Existing or manually selected provider type loads

- **WHEN** an existing profile is loaded or a user selects `openai-compatible`, `gemini-compatible`, or `custom`
- **THEN** the saved provider type SHALL remain the selected value
- **AND** the new-profile default SHALL NOT override profile normalization or runtime routing

### Requirement: Route Auto Image Models Through Model-Scoped Bindings

The system SHALL construct and select automatic image bindings using at least the final `profileId + modelId + operation`, while preserving optional binding ID, preferred request schema, action, and selection identity.

#### Scenario: One profile contains GPT and Gemini image models

- **GIVEN** one auto provider profile contains `gpt-image-2` and a Gemini image model
- **WHEN** each final `ModelRef` is planned for image generation
- **THEN** each plan SHALL retain the same owning `profileId` and its own `modelId`
- **AND** each plan SHALL select only a binding belonging to that scoped provider model and operation

#### Scenario: GPT Image text-to-image generation

- **GIVEN** an auto profile exposes `gpt-image-2` with official GPT Image request compatibility
- **WHEN** a text-only image invocation is planned
- **THEN** the selected binding SHALL use protocol `openai.images.generations`
- **AND** request schema `openai.image.gpt-generation-json`
- **AND** submit path `/images/generations`

#### Scenario: GPT Image edit

- **GIVEN** an auto profile exposes `gpt-image-2` with official GPT Image request compatibility
- **WHEN** an image edit invocation prefers `openai.image.gpt-edit-form`
- **THEN** the selected binding SHALL use protocol `openai.images.edits`
- **AND** request schema `openai.image.gpt-edit-form`
- **AND** submit path `/images/edits`

#### Scenario: Gemini image generation

- **GIVEN** an auto profile exposes a Gemini image model with a Gemini image binding
- **WHEN** image generation is planned for that final model reference
- **THEN** the selected binding SHALL use protocol `google.generateContent`
- **AND** request schema `google.generate-content.image-inline`
- **AND** the model-scoped `:generateContent` submit path

#### Scenario: Same model ID belongs to different profiles

- **GIVEN** two profiles contain the same image `modelId`
- **WHEN** an invocation is planned with one profile's `ModelRef`
- **THEN** no binding from the other profile SHALL be eligible

### Requirement: Keep Invocation Binding Authoritative In Auto Mode

For an auto provider invocation, `InvocationPlan.binding` SHALL be the sole authority for protocol, request schema, adapter, submit path, polling path, and response schema.

#### Scenario: Direct and task-backed calls use the same model reference

- **WHEN** direct and task-backed image entry points resolve the same final `ModelRef` and action
- **THEN** they SHALL resolve the same binding identity
- **AND** the task invocation route snapshot SHALL preserve that binding identity for retry and recovery

#### Scenario: Auto binding has no registered adapter

- **WHEN** an auto invocation produces a binding for which no adapter is registered
- **THEN** execution SHALL fail clearly
- **AND** SHALL NOT fall back to a model-only adapter guess

#### Scenario: Auto model has no binding

- **WHEN** an auto profile's final provider model has no specialized, explicit, or unambiguous discovered image binding
- **THEN** invocation planning SHALL fail with the scoped profile, model, and operation
- **AND** SHALL NOT submit to an OpenAI or Gemini endpoint as a probe

#### Scenario: Auto model has equally ranked incompatible bindings

- **WHEN** an auto provider model has equally ranked candidate bindings with different protocols, request schemas, response schemas, submit paths, poll path templates, or Base URL strategies and no explicit selector resolves them
- **THEN** invocation planning SHALL report an ambiguity
- **AND** SHALL send zero provider requests

### Requirement: Separate Authentication From Automatic Protocol Selection

The system SHALL keep authentication and additional headers owned by the provider profile while allowing the selected binding to define protocol-specific transport details.

#### Scenario: Auto profile uses explicit authentication settings

- **GIVEN** an auto profile has an explicit `authType` and `extraHeaders`
- **WHEN** either a GPT or Gemini image binding is executed
- **THEN** the transport SHALL preserve those profile settings
- **AND** protocol selection SHALL NOT overwrite the profile

#### Scenario: Auto profile uses query authentication

- **GIVEN** an auto profile uses query authentication
- **WHEN** a Google binding is executed
- **THEN** the selected binding transport contract SHALL use query parameter `key`
- **AND** an OpenAI binding SHALL use `api_key`

### Requirement: Preserve Manual Provider Routing

The system SHALL retain the existing behavior of `openai-compatible`, `gemini-compatible`, and `custom` provider profiles and the existing semantics of `imageApiCompatibility`.

#### Scenario: Manual provider modes infer bindings

- **WHEN** a provider remains in any existing manual provider mode
- **THEN** its current binding inference, adapter resolution, authentication, and fallback behavior SHALL remain unchanged

#### Scenario: Image compatibility remains independent

- **WHEN** `imageApiCompatibility` is set to `auto`, `openai-gpt-image`, or `openai-compatible-basic`
- **THEN** its current request-body compatibility semantics SHALL remain independent from `providerType=auto`

#### Scenario: Specialized image model is planned

- **WHEN** an MJ, Flux, Seedream, model-scoped asynchronous image model, or explicitly discovered asynchronous image endpoint is planned
- **THEN** its existing specialized binding and priority behavior SHALL remain available
