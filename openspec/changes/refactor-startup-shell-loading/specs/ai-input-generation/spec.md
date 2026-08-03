## ADDED Requirements

### Requirement: AI Input SHALL Render a Real Composer Core Initially
The AI input surface SHALL mount a real, immediately interactive `ComposerCore` on initial render instead of a placeholder that is later replaced by the complete AI business runtime. `ComposerCore` SHALL own the authoritative Prompt draft, focus and IME state, basic generation type, current selection summary and submit intent while preserving the existing input geometry.

#### Scenario: User types before optional runtimes load
- **GIVEN** model, parameter, attachment, history, Agent and generation-submit runtimes have not loaded
- **WHEN** the user focuses the AI input and edits the Prompt
- **THEN** focus and text editing SHALL work without waiting for those runtimes
- **AND** the entered draft SHALL remain the authoritative draft after any action runtime later loads

#### Scenario: IME composition handles Enter without submitting
- **GIVEN** the user is composing text through an IME
- **WHEN** the composer receives an Enter key event before composition ends
- **THEN** the composer SHALL update the composition according to the browser event sequence
- **AND** MUST NOT create a generation submit intent from that Enter event

#### Scenario: Runtime loading preserves draft and selector identity
- **GIVEN** the user has a non-empty draft and a model preference identified by `selectionKey`
- **WHEN** an action runtime loads, retries or fails
- **THEN** the Prompt draft, generation type, selected `ModelRef`, selector state and `selectionKey`-scoped preference SHALL remain unchanged
- **AND** the input container SHALL NOT be replaced by a second state owner

### Requirement: AI Input SHALL Load Business Runtimes by Action
The AI input SHALL isolate model/parameter, attachment/library, history/optimizer, Agent/Workflow/MCP/external-skill and generation-submit dependencies behind action-specific, retryable single-flight loaders. Loading or evaluating `ComposerCore` and its statically reachable modules MUST NOT initialize those business runtimes or perform their side effects.

#### Scenario: Initial composer evaluation has no business initialization side effects
- **WHEN** the initial AI composer modules are imported and evaluated
- **THEN** they MUST NOT initialize MCP, the long-video chain, external skills, TaskQueue or a provider generation executor
- **AND** they MUST NOT create a provider request, generation task or workflow submission

#### Scenario: User opens an action-specific control
- **WHEN** the user opens a model/parameter selector, attachment/library control, history/optimizer control or Agent/Workflow/MCP control
- **THEN** the composer SHALL load only the runtime required by that action plus its explicit shared foundation
- **AND** loading one action MUST NOT initialize unrelated action runtimes

#### Scenario: Intent preheats a side-effect-free runtime
- **WHEN** pointer, focus or touch intent preheats an action runtime before click
- **THEN** the loader MAY fetch and evaluate only that action's side-effect-free core
- **AND** MUST NOT mount hidden business UI, mutate settings, initialize MCP or TaskQueue, or send a provider request
- **AND** the subsequent click SHALL reuse the same in-flight or fulfilled loader promise

#### Scenario: Business service initializes at its owning action boundary
- **WHEN** the user actually activates Agent/MCP, long-video or external-skill behavior
- **THEN** its owning action runtime SHALL invoke the existing idempotent initialization entry explicitly
- **AND** module-top-level evaluation MUST NOT remain a second initialization path

### Requirement: Generation Submit Runtime SHALL Preserve Exactly-Once Intent
Before invoking an existing AI generation handler, the composer SHALL load the generation-submit runtime through a retryable single-flight loader and continue each accepted user submit intent at most once. Runtime loading SHALL NOT create a parallel generation executor, planner, router or TaskQueue implementation.

#### Scenario: User submits while generation runtime is unloaded
- **GIVEN** the Prompt is valid and the generation-submit runtime has not loaded
- **WHEN** the user accepts a submit action by button or non-composing Enter
- **THEN** the composer SHALL capture one immutable pending intent and enter an accessible preparing state
- **AND** SHALL start or reuse one in-flight generation-runtime load
- **AND** SHALL invoke the existing generation handler exactly once after that runtime becomes ready

#### Scenario: Repeated trigger does not duplicate a pending intent
- **GIVEN** an accepted submit intent is waiting for the generation-submit runtime
- **WHEN** the same button or key action is triggered again before that intent continues or fails
- **THEN** the composer MUST NOT create a second submit for the pending intent
- **AND** MUST NOT create a provider request or paid task before the runtime is ready

#### Scenario: Generation runtime load fails and retries explicitly
- **WHEN** the generation-submit runtime fails to load
- **THEN** the composer SHALL preserve the Prompt and the captured selection state
- **AND** SHALL expose an understandable retry action without invoking the generation handler
- **AND** a retry SHALL reuse the same logical intent unless the user explicitly changes or cancels it

#### Scenario: Composer is cancelled or unmounted before runtime readiness
- **WHEN** a pending submit intent is cancelled or its composer owner unmounts before the loader resolves
- **THEN** a late loader result MUST NOT invoke the generation handler
- **AND** MUST NOT create a task, provider request, canvas insertion or history result

### Requirement: Runtime Decomposition SHALL Preserve Generation Semantics
The AI input runtime decomposition SHALL preserve the existing generation type, selector, `selectionKey`, ModelRef, Prompt, parameter, routing, task and result-consumer semantics. It MUST change only loading and state-ownership boundaries and MUST NOT introduce a second image, text, video, audio, Agent or workflow execution path.

#### Scenario: Pending intent continues through the existing generation path
- **GIVEN** the generation-submit runtime has become ready for an accepted intent
- **WHEN** the composer continues that intent
- **THEN** it SHALL pass the captured generation type, Prompt, selected `ModelRef`, selector state, `selectionKey`-scoped preferences and validated parameters to the existing handler
- **AND** the existing handler SHALL remain authoritative for routing, capability validation, TaskQueue/direct execution, provider submission, results and canvas insertion

#### Scenario: Image generation behavior is unchanged by loading boundaries
- **WHEN** an image-generation submit proceeds after the runtime is ready
- **THEN** it SHALL use the same selected Profile, model, operation, invocation binding, parameters, task semantics and result consumers as the existing image-generation path
- **AND** action preloading or Composer rendering MUST NOT issue an image provider request

#### Scenario: Selector changes retain existing scoped preferences
- **WHEN** the user switches generation type, Profile or model through the loaded selector runtime
- **THEN** the existing selector behavior SHALL determine the next selection
- **AND** model preferences SHALL remain isolated by the existing `selectionKey`
- **AND** the runtime split MUST NOT substitute a default model, rewrite a Profile or copy preferences between selection keys
