## ADDED Requirements

### Requirement: Mobile canvas surfaces SHALL remain mutually operable without occlusion

The system SHALL lay out the existing unified toolbar and primary canvas AI input at mobile widths so their interactive and content regions remain mutually visible and operable across existing responsive states and safe-area insets, without changing their actions or desktop/tablet layout.

#### Scenario: Mobile canvas opens with the toolbar collapsed

- **WHEN** the canvas is ready at an existing mobile portrait or landscape breakpoint with the unified toolbar collapsed and the primary AI input visible
- **THEN** the toolbar SHALL NOT cover the AI input's interactive or content region
- **AND** the AI input SHALL NOT cover a visible toolbar action
- **AND** both surfaces SHALL remain inside the visual viewport and current safe-area insets

#### Scenario: User expands the toolbar on a short mobile viewport

- **WHEN** the user expands the unified toolbar at a supported short mobile viewport
- **THEN** the toolbar SHALL preserve access to its existing actions through its existing scrolling behavior
- **AND** it SHALL NOT cover the primary AI input's interactive or content region
- **AND** collapse, action order, action behavior, and touch-target behavior SHALL remain equivalent to the current capability

#### Scenario: AI input height changes

- **WHEN** the primary AI input enters an existing focused, expanded, attachment-preview, prompt-expanded, or long-text state at a mobile breakpoint
- **THEN** the toolbar/input clearance SHALL continue to protect the currently visible interactive and content regions
- **AND** the AI input's existing width, composition controls, submit/cancel behavior, and safe-area placement SHALL remain unchanged

#### Scenario: Viewport or safe area changes

- **WHEN** an open canvas crosses an existing mobile orientation, viewport-size, or safe-area boundary
- **THEN** the toolbar and primary input SHALL recompute into a non-occluding in-viewport layout without requiring a reload
- **AND** no responsive clamp SHALL be persisted as user-selected toolbar or input data

#### Scenario: Canvas uses a desktop or tablet viewport

- **WHEN** the viewport is one of the existing desktop or tablet responsive ranges
- **THEN** this mobile clearance change SHALL NOT alter the current toolbar/input geometry, stacking ownership, or interaction behavior
