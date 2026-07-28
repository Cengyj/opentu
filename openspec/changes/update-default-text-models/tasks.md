## 1. Specification

- [x] 1.1 Record the default-display-only scope and explicit no-migration boundary
- [ ] 1.2 Validate the change with the OpenSpec CLI when available (blocked: the CLI is not installed in this workspace)

## 2. Static catalog and defaults

- [x] 2.1 Add the three GPT-5.6 text model definitions
- [x] 2.2 Add recommendation metadata that guarantees Sol, Terra, Luna order
- [x] 2.3 Replace the text default-display IDs
- [x] 2.4 Replace the empty-state default text model ID
- [x] 2.5 Keep the three legacy GPT text definitions intact

## 3. Runtime display compatibility

- [x] 3.1 Allow explicit static text models to be pinned without default-display membership
- [x] 3.2 Resolve persisted and route selections through pinning before clearing them
- [x] 3.3 Limit discovery-dialog “recommended models” to default-display IDs
- [x] 3.4 Preserve provider-aware selection keys and selected runtime model behavior
- [x] 3.5 Add built-in fallback and provider-selection presentation modes
- [x] 3.6 Suppress static and unselected-model pinning in provider-selection mode
- [x] 3.7 Reconcile invalid current selections and preset routes to selected provider models

## 4. Tests and verification

- [x] 4.1 Update default runtime-model-discovery expectations
- [x] 4.2 Add tests for GPT-5.6 static metadata and ordering
- [x] 4.3 Add tests for explicit legacy static-model pinning
- [x] 4.4 Add tests proving no user-data migration occurs
- [x] 4.5 Run relevant tests, typecheck, build, and local UI smoke checks
- [x] 4.6 Verify provider-selection mode shows only user-selected models across all selector surfaces
- [x] 4.7 Verify key switching, empty modality state, multi-provider isolation, and request routing
