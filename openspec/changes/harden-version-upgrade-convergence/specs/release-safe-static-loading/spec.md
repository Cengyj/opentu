## ADDED Requirements

### Requirement: Every build has one immutable release identity

The system SHALL keep the human-facing/npm `version` separate from an immutable `releaseId` identifying one built release. Release-control artifacts, Service Worker state, release-scoped cache namespaces, and verified production image metadata MUST agree on the same `releaseId`.

#### Scenario: Two builds retain the same display version

- **GIVEN** a candidate has different bytes from an existing release
- **WHEN** its display/npm version is unchanged
- **THEN** the release gate SHALL reject publication under that immutable version coordinate
- **AND** a new display/npm version SHALL be assigned before publication

#### Scenario: Release-control artifacts are generated

- **WHEN** the web release is built
- **THEN** `index.html`, `version.json`, `sw.js`, `precache-manifest.json`, and `idle-prefetch-manifest.json` SHALL expose the same `releaseId`
- **AND** static cache namespaces and Service Worker committed/pending state SHALL use that identity

#### Scenario: A build has no explicit release identity

- **GIVEN** a local or self-hosted build does not supply `OPENTU_RELEASE_ID`
- **WHEN** an uncached web candidate is generated
- **THEN** it SHALL derive a non-reserved release identity from the display version plus available commit/build-time evidence
- **AND** it SHALL reject reserved placeholders such as `unknown`, `development`, `dev`, or `local` when supplied explicitly
- **AND** reuse of an exact cached build layer SHALL retain the same bytes and identity as the same candidate rather than masquerade as a different release

#### Scenario: Production image metadata is inspected

- **WHEN** a production candidate or published image is verified
- **THEN** `org.opencontainers.image.version` SHALL equal the display semver
- **AND** `org.opencontainers.image.revision` SHALL identify the source revision when that revision is available to the gate
- **AND** `io.opentu.release-id` SHALL equal `version.json.releaseId`
- **AND** promotion SHALL fail when any required image label disagrees with the candidate contract

#### Scenario: A preload manifest has stale identity

- **WHEN** its display version or `releaseId` differs from the evaluating Service Worker
- **THEN** that worker SHALL reject the manifest
- **AND** an updating worker SHALL NOT become ready from those stale resources

### Requirement: Container serves deterministic release cache headers

The production container SHALL apply explicit cache policy at its own static-server boundary. The release MUST NOT depend solely on platform-specific `_headers` files that the container server does not consume.

#### Scenario: Browser requests SPA HTML

- **WHEN** the container serves `/`, `index.html`, or SPA navigation HTML
- **THEN** it SHALL return `Cache-Control: no-cache, max-age=0, must-revalidate`

#### Scenario: Browser requests release control metadata

- **WHEN** the container serves `sw.js`, `version.json`, `precache-manifest.json`, `idle-prefetch-manifest.json`, or `changelog.json`
- **THEN** it SHALL return `Cache-Control: no-store`

#### Scenario: Browser requests the web manifest

- **WHEN** the container serves `manifest.json`
- **THEN** it SHALL return `Cache-Control: no-cache`
- **OR** a separately approved and tested short-cache policy SHALL replace that exact rule

#### Scenario: Browser requests a content-hashed asset

- **WHEN** the container serves an `/assets/*` file whose filename contains its verified content-derived hash
- **THEN** it SHALL return `Cache-Control: public, max-age=31536000, immutable`

#### Scenario: A requested content-hashed asset is absent

- **WHEN** the container returns a non-success status for a content-hashed `/assets/*` request
- **THEN** that error response SHALL NOT contain the `immutable` cache directive
- **AND** the release gate SHALL probe and reject a container or public origin that makes such an error immutable

#### Scenario: Browser requests a non-content-hashed asset

- **WHEN** a static asset does not have a verified content-derived filename hash
- **THEN** the container SHALL apply an explicit revalidation policy
- **AND** it MUST NOT mark the response `immutable`

### Requirement: Container static server is production-configurable and testable

The final deployment image SHALL use a pinned Nginx/OpenResty-compatible static server and repository-owned configuration for SPA fallback, MIME types, and response headers.

#### Scenario: Production image is built

- **WHEN** the final container stage is inspected and started
- **THEN** its active server configuration SHALL be present in the image and testable without an external proxy
- **AND** it SHALL apply the specified fallback, content type, and cache rules directly

#### Scenario: Hosting platform also supports `_headers`

- **WHEN** another deployment target consumes a platform-specific header file
- **THEN** that file MAY mirror the container policy
- **AND** it SHALL NOT replace container-direct verification

### Requirement: Browser update checks bypass HTTP cache reuse

The web application SHALL register its Service Worker with `updateViaCache: 'none'` and SHALL fetch authoritative version metadata with `cache: 'no-store'`.

#### Scenario: Browser checks for a Service Worker update

- **WHEN** the application registers or updates the Service Worker
- **THEN** imported update scripts SHALL not be reused through the registration HTTP cache mode

#### Scenario: Production container is accessed through localhost

- **GIVEN** a production build is exposed through `localhost` or `127.0.0.1`
- **WHEN** its page and Service Worker evaluate update behavior
- **THEN** build mode SHALL remain authoritative for production behavior
- **AND** hostname alone SHALL NOT enable development-only forced activation or development cache routing

#### Scenario: Browser reads version metadata

- **WHEN** the application requests `version.json` to decide pending-version readiness
- **THEN** the request SHALL use `cache: 'no-store'`
- **AND** the response SHALL be validated before changing runtime version state

### Requirement: Static cache handover preserves active older tabs

The Service Worker SHALL scope application static caches by `releaseId` and SHALL NOT delete earlier release caches using an unconditional activation timer. Cache recovery MUST remain separate from image/media and application IndexedDB data.

#### Scenario: A new worker activates while an older tab remains open

- **WHEN** the older tab requests a content-hashed chunk from its release
- **THEN** the worker SHALL be able to read the retained prior-release static cache
- **AND** activation SHALL NOT have deleted it after an arbitrary elapsed time

#### Scenario: Lazy dynamic import recovery is requested

- **WHEN** the current release reports a failed dynamic import
- **THEN** recovery MAY delete the currently committed static cache
- **AND** it SHALL retain other release-scoped static caches, `drawnix-images`, and all user IndexedDB data

### Requirement: Release gate verifies container and public origins

Every release SHALL pass both container-direct and public post-deployment checks for release identity, byte identity, and required response headers on version-sensitive and representative immutable resources.

#### Scenario: Container-direct pre-promotion gate runs

- **WHEN** a candidate deployment image is evaluated
- **THEN** the gate SHALL verify status, final URL, version, byte hash, `Cache-Control`, content type, and relevant validators for HTML, Service Worker, version metadata, manifests, changelog metadata, and representative core hashed assets
- **AND** every same-origin content-hashed JavaScript and CSS entry referenced directly by `index.html` SHALL exist and be verified, regardless of representative sampling order
- **AND** the gate SHALL verify that a known-missing content-hashed path returns an error without immutable caching
- **AND** promotion SHALL fail on any contract mismatch

#### Scenario: Public post-deployment gate runs

- **WHEN** a candidate is deployed to production routing
- **THEN** the same checks SHALL run independently against `https://image.forcodeai.xyz` and `https://image.foropencode.com`
- **AND** release completion SHALL fail if either origin differs from the approved container release or required cache policy

#### Scenario: Immutable policy is applied to an unhashed file

- **WHEN** verification finds `immutable` on a file without a verified content-derived filename hash
- **THEN** the release gate SHALL fail

#### Scenario: Version-sensitive response lacks its required policy

- **WHEN** HTML, `sw.js`, version metadata, or a release manifest lacks or contradicts its required `Cache-Control`
- **THEN** the release gate SHALL fail even if response bytes match the candidate build
