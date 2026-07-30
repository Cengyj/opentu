## ADDED Requirements

### Requirement: `.drawnix` file actions shall expose complete, partial, cancelled and failed outcomes

The system SHALL distinguish complete, partial, cancelled and failed `.drawnix` file operations at every reachable application-menu, hotkey and command-palette entry without changing the persisted version-1 file schema.

#### Scenario: User cancels a file picker

- **WHEN** the user aborts the existing open or save picker
- **THEN** the action SHALL settle as cancelled without error feedback
- **AND** SHALL NOT replace or mutate the current board, history, workspace or cache

#### Scenario: File save fails outside cancellation

- **WHEN** serialization or filesystem save rejects for a reason other than user cancellation
- **THEN** the invoking menu, hotkey or command entry SHALL consume the rejection exactly once
- **AND** SHALL show localized retryable failure feedback
- **AND** SHALL NOT report a successful save

#### Scenario: File open is invalid or fails

- **WHEN** the selected file cannot be read, parsed or validated
- **THEN** the invoking entry SHALL consume the rejection exactly once and show localized failure feedback
- **AND** the current board children, viewport, theme, history and selection SHALL remain unchanged

#### Scenario: File action succeeds completely

- **WHEN** the file action and all applicable embedded-media work complete successfully
- **THEN** the action SHALL settle as complete exactly once
- **AND** existing file, board, history and autosave semantics SHALL remain unchanged

### Requirement: `.drawnix` transfer shall report partial embedded-media outcomes

The system SHALL preserve structurally valid best-effort export/import behavior while truthfully reporting embedded media that could not be included or restored.

#### Scenario: Export cannot embed referenced virtual media

- **WHEN** one or more referenced virtual media items have no readable cache Blob or their conversion fails
- **THEN** the structurally valid file MAY still be saved using the existing version-1 fields
- **AND** the action SHALL report a localized partial outcome with the failed item count
- **AND** SHALL NOT expose media URLs, contents, cache keys or raw error bodies in user feedback

#### Scenario: Import cannot restore some embedded media

- **WHEN** a structurally valid file is parsed but one or more embedded-media cache restorations fail
- **THEN** the existing structural import MAY complete
- **AND** the action SHALL report a localized partial outcome with the failed item count
- **AND** successfully restored media SHALL remain available

#### Scenario: User retries a partial transfer

- **WHEN** a partial transfer has settled and the user invokes the existing open or save action again
- **THEN** the action SHALL be available without a hidden pending state or automatic background retry

### Requirement: Existing file entries shall provide localized and truthful feedback

The system SHALL use the selected application language for file/image action failures and SHALL name the `.drawnix` save action consistently with the file it creates.

#### Scenario: Image export fails in Chinese or English

- **WHEN** PNG or JPG export fails in a Chinese or English session
- **THEN** one retryable error message SHALL be shown in the selected language
- **AND** the selected-only/full-board and transparent/white export choices SHALL remain unchanged

#### Scenario: Command palette displays file save

- **WHEN** the command palette renders the current `.drawnix` save command in Chinese or English
- **THEN** its label SHALL identify saving a `.drawnix` file rather than a generic JSON artifact
- **AND** its command ID, shortcut and `saveAsJSON` execution target SHALL remain unchanged

#### Scenario: Internal diagnostics receive an error

- **WHEN** a file or media step records a non-cancellation error through the existing diagnostic boundary
- **THEN** user-facing feedback SHALL remain free of file content, media URL, query, token, credential and raw response body values
- **AND** no new analytics event or persisted diagnostic schema SHALL be introduced by this change

### Requirement: File-transfer recovery shall preserve storage and format compatibility

The system SHALL add only transient outcome handling and SHALL preserve existing `.drawnix`, board, workspace, cache, backup and task formats.

#### Scenario: Existing version-1 files are used

- **WHEN** a current version-1 `.drawnix` file with or without `embeddedMedia` is opened or saved after the correction
- **THEN** the existing type, version, source, elements, viewport and optional embedded-media fields SHALL remain compatible
- **AND** no migration or cache purge SHALL be required

#### Scenario: Change is applied or rolled back

- **WHEN** the feedback/recovery change is applied or reverted
- **THEN** board elements, workspace records, cache entries, backups, assets, tasks, credentials, provider routes and analytics schemas SHALL retain their existing formats

