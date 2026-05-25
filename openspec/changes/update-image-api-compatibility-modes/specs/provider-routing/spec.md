## ADDED Requirements

### Requirement: Resolve GPT Image Compatibility To A Concrete Internal Mode

The system SHALL resolve GPT Image compatibility from the selected provider profile into a concrete internal mode before adapter selection.

#### Scenario: Automatic resolution chooses official GPT mode for OpenAI

- **GIVEN** a provider profile uses an `api.openai.com` base URL
- **AND** the selected image model is a GPT Image model
- **AND** the stored image API compatibility is `auto`
- **WHEN** provider routing resolves image compatibility
- **THEN** it SHALL resolve to `openai-gpt-image`

#### Scenario: Automatic resolution chooses official GPT mode for ForOpenCode

- **GIVEN** a provider profile uses a `foropencode.com` base URL
- **AND** the selected image model is a GPT Image model
- **AND** the stored image API compatibility is `auto`
- **WHEN** provider routing resolves image compatibility
- **THEN** it SHALL resolve to `openai-gpt-image`

#### Scenario: Automatic resolution chooses generic fallback

- **GIVEN** a provider profile is neither official OpenAI nor ForOpenCode/New API
- **AND** the selected image model is a GPT Image model
- **AND** the stored image API compatibility is `auto`
- **WHEN** provider routing resolves image compatibility
- **THEN** it SHALL resolve to `openai-compatible-basic`

#### Scenario: Manual compatibility override wins over auto inference

- **GIVEN** a provider profile stores a non-`auto` supported image API compatibility value
- **WHEN** provider routing resolves image compatibility
- **THEN** it SHALL use the stored value directly
- **AND** SHALL NOT replace it with an inferred mode

### Requirement: Migrate Removed Legacy Compatibility Values

The system SHALL accept previously stored For GPT compatibility values only as migration aliases to `openai-gpt-image`.

#### Scenario: Removed compatibility value is normalized

- **GIVEN** a provider profile stores `for-gpt-image`, `tuzi-gpt-image`, or `tuzi-compatible`
- **WHEN** the profile is normalized or loaded into a routing snapshot
- **THEN** the system SHALL treat it as `openai-gpt-image`
- **AND** SHALL NOT emit a For GPT request schema

### Requirement: Map Internal Modes To Official Or Generic Request Schemas

The system SHALL use request schemas as the formal dispatch boundary between official GPT Image and generic fallback routing.

#### Scenario: Official GPT generation emits official schema

- **GIVEN** a GPT Image invocation resolves to `openai-gpt-image`
- **WHEN** provider routing creates a generation binding
- **THEN** it SHALL emit `requestSchema = openai.image.gpt-generation-json`

#### Scenario: Official GPT edit emits official edit schema

- **GIVEN** a GPT Image invocation resolves to `openai-gpt-image`
- **WHEN** provider routing creates an edit binding
- **THEN** it SHALL emit `requestSchema = openai.image.gpt-edit-form`
- **AND** it SHALL use the `/images/edits` submit path

#### Scenario: Generic fallback emits basic schema

- **GIVEN** a GPT Image invocation resolves to `openai-compatible-basic`
- **WHEN** provider routing creates a generation binding
- **THEN** it SHALL emit `requestSchema = openai.image.basic-json`

#### Scenario: Removed For GPT schemas are not emitted

- **GIVEN** a GPT Image invocation previously would have resolved to For GPT compatibility
- **WHEN** provider routing creates bindings after migration
- **THEN** it SHALL NOT emit `for.image.gpt-generation-json`, `for.image.gpt-edit-json`, `tuzi.image.gpt-generation-json`, or `tuzi.image.gpt-edit-json`
