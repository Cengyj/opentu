## ADDED Requirements

### Requirement: Pending version readiness is mount-order independent

The system SHALL retain the current page's authoritative pending-version readiness until the deferred update UI can consume it, independent of whether readiness or UI mounting occurs first. Replacement, clearing, and asynchronous metadata updates MUST be fenced by current version and page-local revision.

#### Scenario: Update is ready before deferred UI mounts

- **GIVEN** a staged version differs from the committed version and is ready
- **AND** the update UI has not mounted
- **WHEN** the deferred update UI later mounts
- **THEN** it SHALL consume the retained pending version without requiring a second Service Worker transition

#### Scenario: Update is ready after deferred UI mounts

- **GIVEN** the deferred update UI is already subscribed
- **WHEN** a distinct pending version becomes ready
- **THEN** it SHALL receive the same state and actions as the before-mount path

#### Scenario: A stale version response completes

- **GIVEN** pending version A was replaced by version B or authoritatively cleared
- **WHEN** an asynchronous metadata response for A completes
- **THEN** it SHALL NOT restore or overwrite current readiness

#### Scenario: Display version is unchanged but release identity differs

- **GIVEN** the current and pending releases have the same human-facing version
- **AND** their `releaseId` values differ
- **WHEN** the pending worker reports ready
- **THEN** the runtime SHALL treat it as a distinct pending release
- **AND** metadata and confirmation SHALL be fenced by `releaseId`, not display text

### Requirement: Ready updates remain discoverable

Whenever a distinct pending version is ready, the system MUST expose an update notice or equivalent discoverable status. Task state may constrain actions but MUST NOT cause all update UI to disappear.

#### Scenario: Persisted task says processing without a live owner

- **GIVEN** a task row has persisted status `processing`
- **AND** the authoritative lifecycle proves no dispatch was consumed or has committed safe interrupted/terminal reconciliation
- **WHEN** a pending version becomes ready
- **THEN** the update notice SHALL remain discoverable
- **AND** the persisted status alone SHALL NOT block the upgrade

#### Scenario: An ownership snapshot proves live work

- **GIVEN** a matching consumed-dispatch/session heartbeat or acknowledged-remote/query lease classifies the current attempt `live`
- **WHEN** a pending version is ready
- **THEN** the update notice SHALL remain discoverable and explain that live work is being preserved
- **AND** the default behavior SHALL wait without committing or terminating the task

### Requirement: Upgrade blockers use authoritative execution facts

The system SHALL classify each relevant image, video, audio, chat, workflow, plugin, and other executable task as `live`, `recovering`, `stale-orphan`, or `unknown-authority` using its authoritative task/attempt revision, consumed-dispatch and matching executor/session heartbeat, acknowledged-remote and query-only polling lease, recovery, terminal decision, and typed storage-read facts. `unknown-authority` MUST include reason `storage-error`, `projection-unavailable`, or `inconsistent-state`. A persisted lifecycle status by itself MUST NOT establish a live blocker.

#### Scenario: Consumed dispatch has matching live executor

- **WHEN** the current attempt has a consumed dispatch token and a fresh executor/session heartbeat correlated to that same task, attempt, token, and session
- **THEN** the system SHALL classify it as `live`
- **AND** normal upgrade confirmation SHALL wait unless an independently approved termination path is explicitly invoked

#### Scenario: Consumed dispatch heartbeat is missing or delayed

- **GIVEN** the current attempt has an unresolved consumed dispatch token
- **WHEN** its matching executor/session heartbeat is absent, expired, or unverifiable
- **THEN** the system SHALL classify it as `recovering` when the attempt/provider deadline is authoritative, or `unknown-authority` with reason `inconsistent-state` otherwise
- **AND** it MUST NOT classify the attempt `stale-orphan` or make normal upgrade confirmation eligible
- **AND** heartbeat expiry SHALL NOT grant any context provider-submit authority

#### Scenario: Remote query lease is current

- **WHEN** a current attempt has committed `remoteId` and route plus a valid query-only polling lease
- **THEN** the system SHALL classify it as `live`
- **AND** it SHALL treat that lease only as authority to query the existing remote job

#### Scenario: Remote query ownership is recovering

- **WHEN** a task has authoritative `remoteId` and route and its query-only lease is awaiting bounded takeover
- **THEN** the system SHALL classify it as `recovering`
- **AND** it SHALL reclassify after query ownership transfers or the task lifecycle commits a terminal decision
- **AND** polling-lease expiry SHALL NOT authorize submit

#### Scenario: Task is authoritatively stale or orphaned

- **WHEN** the task lifecycle proves that no dispatch token was consumed or has committed a safe interrupted/terminal reconciliation for the current attempt
- **THEN** the task lifecycle SHALL commit or confirm a truthful interrupted/terminal reconciliation before upgrade eligibility
- **AND** the updater SHALL classify that reconciled task as `stale-orphan`
- **AND** the stale row SHALL NOT remain an upgrade blocker

#### Scenario: Storage read fails

- **WHEN** task ownership cannot be read because the authoritative storage operation failed
- **THEN** the system SHALL classify the condition as `unknown-authority` with reason `storage-error`
- **AND** expose a bounded retry/recovery path
- **AND** SHALL NOT silently hide the update or assume tasks are safe to terminate

#### Scenario: Ownership facts are inconsistent

- **WHEN** stored attempt, dispatch, heartbeat, remote identity, lease, revision, or terminal facts contradict or cannot be correlated
- **THEN** the system SHALL classify the condition as `unknown-authority` with reason `inconsistent-state`
- **AND** expose lifecycle re-read and authoritative reconciliation rather than a misleading storage-failure message
- **AND** SHALL NOT make normal update confirmation eligible

#### Scenario: A task type has no authoritative ownership projection

- **WHEN** a task type cannot provide revision-fenced dispatch/heartbeat, remote-query lease, recovery, and terminal-decision facts
- **THEN** the system SHALL classify its upgrade safety as `unknown-authority` with reason `projection-unavailable`
- **AND** it SHALL keep the update visible without guessing from persisted status

### Requirement: Running work is preserved by default

The system SHALL NOT automatically interrupt tasks classified `live`, `recovering`, or `unknown-authority` to install an update. Any terminate-and-upgrade behavior MUST be separately approved and MUST use the authoritative task cancellation contract with explicit user confirmation.

#### Scenario: User takes no destructive action

- **GIVEN** one or more tasks are classified `live`, `recovering`, or `unknown-authority`
- **WHEN** the user views or dismisses the update notice
- **THEN** no task SHALL be cancelled or interrupted
- **AND** no `COMMIT_UPGRADE` SHALL be sent until normal eligibility and explicit confirmation

#### Scenario: Long synchronous request is background-throttled

- **GIVEN** an image attempt consumed its one-shot dispatch token and its synchronous provider request has not reached a terminal decision
- **WHEN** browser throttling delays its executor/session heartbeat beyond the freshness window
- **THEN** the system SHALL preserve the task as `recovering` or `unknown-authority` with reason `inconsistent-state`
- **AND** it SHALL NOT send `COMMIT_UPGRADE`, interrupt the request, classify it stale, or create submit authority

#### Scenario: Terminate-and-upgrade is not approved

- **WHEN** the product has no separate approval for destructive upgrade behavior
- **THEN** the interface SHALL omit the terminate-and-upgrade action
- **AND** waiting or reason-specific recovery for unresolved work SHALL remain the available safe path

### Requirement: One confirmed version produces one upgrade commit

For each current pending version, one explicit user confirmation SHALL cause exactly one `COMMIT_UPGRADE` to be posted to the matching live waiting worker. Duplicate UI and transport signals MUST be idempotent by pending-version identity.

#### Scenario: User confirms once

- **GIVEN** the current pending version is eligible and a matching waiting worker exists
- **WHEN** the user explicitly confirms the update
- **THEN** the page SHALL post exactly one `COMMIT_UPGRADE` for that version
- **AND** it SHALL wait for matching activation or controller takeover before reload

#### Scenario: Confirmation signals repeat

- **GIVEN** a commit was already sent for the current pending version
- **WHEN** duplicate clicks, events, rerenders, remounts, or cross-client intents occur
- **THEN** no second logical commit SHALL occur for that version

#### Scenario: Confirmed release has not activated yet

- **GIVEN** an older release is committed and a fully prepared newer release is pending
- **WHEN** the newer waiting worker accepts `COMMIT_UPGRADE`
- **THEN** the newer release SHALL remain the pending release in `committing` state
- **AND** the older `committedReleaseId` SHALL remain authoritative until activation succeeds
- **AND** only the activate transaction SHALL promote the newer release to `committedReleaseId`

#### Scenario: An already-open page sends the legacy confirmed commit shape

- **GIVEN** the user explicitly confirmed an update in a page whose bootstrap cannot attach `releaseId`
- **AND** the receiving worker is `ready` with its own `releaseId` as the current pending release
- **WHEN** it receives one legacy `COMMIT_UPGRADE`
- **THEN** it MAY map that explicit confirmation to only its own pending release
- **AND** duplicate cross-client messages SHALL remain idempotent
- **AND** this compatibility SHALL NOT trigger automatic navigation or select a different release

#### Scenario: Waiting worker is unavailable

- **GIVEN** a pending update remains current
- **WHEN** confirmation cannot resolve its matching waiting worker
- **THEN** the system SHALL keep the update visible and retry authoritative state/update checks within a bound
- **AND** it SHALL NOT report a successful commit

### Requirement: Confirmed activation converges to the new controller

After a matching pending version is confirmed and activates or takes controller authority, the system SHALL complete the dedicated version-transition reload without applying the obsolete generic persisted-active-task guard again.

#### Scenario: Controller changes after confirmed commit

- **GIVEN** the user confirmed the pending version and one commit was sent
- **WHEN** the matching worker activates or `controllerchange` proves takeover
- **THEN** the dedicated upgrade convergence path SHALL reload into the new controller
- **AND** a stale persisted `processing` row SHALL NOT block that approved reload

#### Scenario: Unrelated reload is requested

- **WHEN** a reload is not part of a confirmed matching version transition
- **THEN** existing general task-safety guards SHALL remain applicable

### Requirement: Upgrade activation remains explicit

The default upgrade flow SHALL preserve explicit confirmation and MUST NOT unconditionally combine `skipWaiting` with navigation of all clients.

#### Scenario: A waiting update exists without confirmation

- **WHEN** a new worker is installed and waiting but the user has not confirmed
- **THEN** it SHALL remain staged according to the existing protocol
- **AND** the system SHALL NOT force all clients to navigate

#### Scenario: A forced legacy bridge is proposed

- **WHEN** automatic forced activation or client navigation is considered for already-running legacy pages
- **THEN** it SHALL require separate explicit approval, compatibility tests, and rollback semantics

### Requirement: Legacy clients receive honest recovery guidance

The release process SHALL document that already-loaded legacy JavaScript cannot be retroactively changed and SHALL provide a manual hard-refresh and conditional Service Worker unregister/reload recovery path.

#### Scenario: A client remains on old suppressed-prompt code

- **WHEN** a deployed fix cannot execute because the page has not loaded the new bundle
- **THEN** support guidance SHALL instruct a hard refresh and, only if needed, Service Worker unregister/reload
- **AND** it SHALL warn about open-work and offline-cache impact before unregistering
