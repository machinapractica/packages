# Machina Practica extraction proposal

Status: research proposal, not an implementation commitment. Imported from `OURWAY_PROPOSAL.md`, developed from cross-repository evidence before the Machina Practica organization existed. Original research and evidence are retained; proposed artifact names have been updated.

Companion: [project setup proposal](https://github.com/machinapractica/practica/blob/main/docs/proposals/PROJECT_SETUP_PROPOSAL.md).

The summary files cited below were not included with this handoff. Their original source paths are retained as provenance, not represented as files in this repository. Wave 0 must locate and verify them against source repositories.

## Recommendation

The `@machinapractica` npm scope should begin as a set of small, layered packages for the engineering practices that have already survived reuse and real feedback across many repositories. It should not begin as a universal application framework or design system.

The first extraction should be the test-and-evidence tooling, followed by build identity, a pure event/replay kernel, Firebase event transport, and room lifecycle helpers. Offline/PWA and GitHub Pages support should follow once the build-identity package exists. Shared-table/private-device behavior is clearly proven as a product architecture, but only its protocol-level pieces should be extracted, and only after the lower layers have been adopted successfully.

The proposed dependency direction is:

```text
@machinapractica/testing                    independent
@machinapractica/build-info                 independent
@machinapractica/events                     independent
    └── @machinapractica/events-firestore   depends on events
            └── @machinapractica/rooms      depends on events-firestore
                    └── @machinapractica/tabletop-protocol
@machinapractica/pwa                        depends on build-info
@machinapractica/pages                      depends on build-info
```

This ordering turns existing evidence into reusable foundations without making later packages responsible for concerns that belong below them.

## What “proven” means

For this proposal, a practice is proven when it meets all of these tests:

1. It appears in at least three independent repositories, preferably across more than one product domain.
2. It has survived follow-up fixes, migration, replay, deployment, production feedback, or real-device use—not merely initial scaffolding.
3. The repeated part has a stable invariant that can be expressed without importing application-specific rules or presentation.
4. A shared package can remove code and maintenance from consuming repositories rather than adding a second abstraction alongside existing code.

The summaries show several practices that comfortably exceed this threshold. They also show practices that are philosophically consistent but do not yet share a proven API. The distinction matters: repeated intent is evidence for a standard; repeated mechanics are evidence for a library.

## Proven practices

| Practice | Evidence of independent reuse | Conclusion |
| --- | --- | --- |
| Deterministic append-only events, pure replay, rebuildable projections, migrations, and compensating actions | Ark Nova, DRM, Game of Things, GotFive, Hunger, Istanbul, Jaipur, Outpost 7, PhotoStore, Rebel Princess, RoboRally, Sudoku, Todo, WFME, X-Wing, and WO-OCD | The strongest candidate for a core library. The common kernel is proven even though storage and authorization differ. |
| Semantic end-to-end tracers using ordinary user actions, multiple actors/surfaces, bounded waits, and retained evidence | Ark Nova, DRM, GotFive, Hunger, Istanbul, Jaipur, Player, Rebel Princess, RoboRally, Sudoku, WFME, X-Wing, Zodiac, and others | Proven and low-risk to extract first. It can validate every later extraction. |
| Reviewed visual baselines with deterministic capture and platform-specific exact comparison | Cross Clues, DRM, GotFive, Hunger, Istanbul, Jaipur, MathPub, Medinag, Player, Rebel Princess, RoboRally, Sudoku, TTLauncher, WFME, X-Wing, WO-OCD, and Zodiac | Proven as test infrastructure. Exact equality should be an available policy, not a universal default. |
| Immutable Firestore room events, anonymous/authenticated actors, replay subscriptions, emulator-backed rules, and noncanonical presence | DRM, Game of Things, GotFive, Istanbul, Jaipur, Outpost 7, QR, Rebel Princess, RoboRally, WFME, and X-Wing | Proven as an adapter layered over an event kernel. Authorization must remain application-supplied. |
| Shared-table/private-device room lifecycle, QR joining, viewer-correct projections, action ownership, and reconnect/rematch behavior | Ark Nova, DRM, Game of Things, Istanbul, Jaipur, Outpost 7, Rebel Princess, RoboRally, WFME, and X-Wing | Proven as an architecture. Extract protocol/state helpers later; visual components are not yet uniform enough. |
| Exact build identity, revision manifests, artifact checks, health/version exposure, and explicit update state | Ark Nova, Dosage, Hunger, MathPub, PhotoStore, Player, QuorTexTT, Zodiac, and the Anna’s Dad Press/Sudoku deployments | Proven and suitable for a small package used by build, runtime, test, and deployment code. |
| Root/subpath-safe static builds, retained PR previews, deterministic preview URLs, and deployment verification | Ark Nova, Quilt, Sudoku, Zodiac, Anna’s Dad Press, Jaipur’s rollback, and several game deployments | Proven, but part library and part trusted workflow template. npm code must not obscure the GitHub token/security boundary. |
| Versioned offline shells, controlled service-worker activation, local-only storage, deletion/recovery checks, and no-network evidence | Dosage, Hunger, Sudoku, and Zodiac, with related constraints in WO-OCD | Proven across enough applications for shared runtime and test helpers, after build identity is standardized. |
| Explicitly recording what automation does not prove | Ark Nova, Dosage, ESPNowCam, Hunger, Player, X-Wing, and WO-OCD | Proven as an organizational release standard, not an npm library. |
| Nix-pinned environments and reproducible production checks | Most substantive repositories in the summaries | Proven as an organizational standard, but it belongs in flake/templates and CI conventions rather than the npm scope. |

## Package plan, in order

### 1. `@machinapractica/testing`

This should be the first package because it has the widest evidence base, the least domain coupling, and will provide the acceptance harness for every package that follows.

Initial entry points should cover:

- semantic polling with explicit time bounds and useful timeout receipts;
- named actors and browser contexts for phone, tabletop, cast, anonymous, and authenticated journeys;
- deterministic clocks, seeds, ports, temporary state, and artifact directories;
- capture manifests tying screenshots, logs, traces, build revision, actor, viewport, and scenario step together;
- candidate-versus-reviewed visual baselines, including exact RGBA/zero-pixel comparison where the consumer opts in;
- network-policy assertions such as same-origin-only, expected-endpoint allowlists, and offline execution;
- production-build launch helpers rather than development-server-only tests;
- a rule that baseline update creates reviewable candidates and never silently blesses new pixels.

The package should wrap Playwright without replacing Playwright’s API. Native XCTest/XCUITest receipts in Player and Hunger prove the same method, but a JavaScript package should not pretend to unify native runners initially. It can standardize artifact schemas that native scripts may also emit.

Pilot adoption should use RoboRally for multi-actor and zero-pixel behavior, Sudoku for offline/responsive behavior, and Zodiac for real-image fixtures and service-worker state. Success means the three repositories delete local harness code while preserving their existing scenarios and reviewed images.

### 2. `@machinapractica/build-info`

This should be deliberately small. It should generate and validate a versioned manifest containing the source revision, artifact hash, schema version, and optional release channel; expose the same information to application code; and compare a running build with a network-fetched manifest.

It should provide browser and Node entry points plus a CLI suitable for CI and deployment probes. It should not inject nondeterministic timestamps by default, infer that a commit is deployed merely because CI passed, or turn update availability into an automatic destructive reload. Zodiac’s `Current`/`Offline`/`Update available` states and deferred refresh are a good runtime model; Ark Nova and QuorTexTT provide the artifact/probe model.

Pilot adoption should use Zodiac, one static Pages application such as Sudoku, and one served artifact such as Ark Nova. This establishes that the manifest works for both static and server deployments before other packages depend on it.

### 3. `@machinapractica/events`

This is the highest-value core package, but it should follow the test package so extraction can be proven against real historical streams.

The package should be pure TypeScript with no Firebase, IndexedDB, Svelte, clocks, random-number generation, or UI dependencies. Its stable surface should include:

- a versioned event envelope with event ID, stream ID, actor, logical position/revision, type, payload, and causation metadata;
- canonical encoding and hashing hooks;
- pure `reduce` and `replay` functions;
- explicit migration chains and fail-closed handling for unknown future schema versions;
- idempotence and duplicate-event helpers;
- projection/checkpoint contracts in which projections are disposable and the event stream remains authoritative;
- compensating-event helpers for undo without history mutation;
- viewer projection hooks that make privacy filtering explicit rather than accidental;
- conformance tests for determinism, replay from zero, replay from checkpoint, duplicate delivery, migration, and rebuild.

It must not prescribe domain event names, game phases, database schemas, permissions, snapshot frequency, wall-clock semantics, or whether a product allows undo. It also must preserve old application histories byte-for-byte or through explicit consumer-owned migrations; adopting `@machinapractica/events` is not permission to rewrite existing logs.

The initial compatibility corpus should come from Hunger, Sudoku, and RoboRally: two different local/product histories and one multiplayer game with durable presentation boundaries. A fourth consumer—Todo or Istanbul—should adopt before a 1.0 release. A package that cannot replay representative old histories without special forks is not yet the right common kernel.

### 4. `@machinapractica/events-firestore`

Once the pure kernel is stable, extract the repeated Firebase mechanics:

- transactional append with expected stream revision and idempotency key;
- ordered subscriptions with reconnect/cursor recovery;
- actor attribution and application-provided authorization claims;
- immutable event collections separated from mutable presence/profile documents;
- conflict results that are explicit and replayable rather than silent last-write-wins updates;
- Firebase Emulator test fixtures and reusable allow/deny assertions;
- opt-in compatibility handling for known browser stream behavior, including Safari/WebKit;
- import/export of raw streams for deterministic reproduction without production credentials.

The adapter must not claim that client-visible Firestore events are secret, and it must not embed one game’s membership rules. X-Wing’s trustworthy-client caveat, Rebel Princess’s sealed simultaneous choices, and WO-OCD’s encrypted design demonstrate that privacy models differ and must remain above the transport.

GotFive, Outpost 7, and Jaipur are good pilots because all replaced or hardened networking around append-only events and exercised repeated-game recovery. Firestore Rules examples should live as test fixtures or recipes until several consumers share an identical deployable rule fragment.

### 5. `@machinapractica/rooms`

This package should build on `events-firestore` and own only generic room lifecycle:

- collision-resistant room creation and short display codes;
- QR/join URL construction and parsing;
- anonymous identity bootstrap and rejoin tokens;
- roles, seats, spectators, room epochs, expiration, and rematch isolation;
- single-use or expiring seat capabilities where configured;
- presence as disposable liveness information rather than domain truth;
- action-ownership status and viewer-aware room projections;
- hooks for application authorization, event validation, and content/version compatibility.

The package should not contain game setup, turn order, score, artwork, or a mandatory Firebase UI. It should expose headless state and protocol functions so Svelte, React, native shells, or a server can present them differently.

Adopt first in one small room application and two full games—for example QR or Game of Things, Jaipur, and RoboRally—before moving older games. The key acceptance case is not merely joining; it is refresh, reconnect, rematch, stale identity rejection, and simultaneous-action conflict.

### 6. `@machinapractica/pwa`

This package should combine the proven mechanics around offline startup and safe freshness:

- a versioned asset/app-shell manifest tied to `@machinapractica/build-info`;
- registration and observable `Current`, `Offline`, `Update available`, and `Activating` states;
- network-first version checks without making application content network-dependent;
- application-controlled critical sections that defer activation during a capture, edit, import, or other unsafe interruption point;
- root and subpath scope verification;
- hooks for complete cache deletion and tests that distinguish cache clearing from domain-data erasure;
- offline and unexpected-network assertions through `@machinapractica/testing`.

The package should not own IndexedDB domain data or claim that installing a new service worker migrates local state. Hunger, Sudoku, and Zodiac should be the pilots because they exercise different combinations of event storage, active work, and image capture.

### 7. `@machinapractica/pages`

This should be a CLI/library plus separately visible reusable workflow templates. The npm portion should provide base-path-safe URL construction, static artifact inspection, CNAME generation/validation, revision-manifest checks, preview URL calculation, and post-deploy smoke tests. Workflow templates should handle retained per-PR directories, one sticky preview comment, close cleanup, and production preservation.

The security boundary must stay obvious: forked PR code must never receive a write token, trusted default-branch workflows must verify the exact artifact and PR identity they deploy, and HTTPS/DNS administrator writes should not be added merely to make a workflow self-healing. Quilt, Ark Nova, Anna’s Dad Press, and Sudoku provide evidence for these rules; Jaipur’s completed rollback is evidence that migration and reversal must both be testable.

Pilot the static path in Sudoku, Zodiac, and one simple site. Keep Ark Nova’s host deployment as a consumer of shared manifest/probe code, not as the initial definition of a generic Pages package.

### 8. `@machinapractica/tabletop-protocol`

This should be the last planned extraction. The product pattern is highly proven, but the UI implementations are intentionally diverse. The initial package should therefore contain protocol/state helpers only:

- surface roles such as tabletop, private hand/controller, cast, observer, and replay;
- seat-relative orientation transforms and viewer identity;
- action-owner/waiting-state descriptions;
- presentation cursors and animation barriers that prevent private decisions from outrunning the shared display;
- reconnect-safe handoff and face-down/unrevealed state contracts;
- responsive calibration primitives expressed as geometry, not styled components.

RoboRally, Istanbul, and X-Wing are the best extraction references because together they exercise shared/private presentation, spatial orientation, private decisions, and durable replay. DRM is a useful fourth adopter because it already consolidated several games internally. Do not publish framework-styled cards, boards, dialogs, audio, or brand tokens as part of the first package.

## Proven practices that should be standards, not packages

Some of the clearest repeated successes should shape every `@machinapractica` repository without becoming runtime dependencies:

- **Claim discipline:** release notes must separate automated, simulator, physical-device, security-review, regulatory, and production evidence. Unperformed checks stay explicit.
- **Reproducible environments:** retain Nix-owned toolchains and production-build checks. Publish npm packages from the pinned environment, but do not recreate Nix in JavaScript.
- **Reviewable evidence:** screenshots, traces, deployment receipts, and provenance manifests are durable artifacts tied to the exact revision.
- **Fail-closed migrations:** unknown future data, unverifiable artifacts, ambiguous remote writes, or mismatched revisions require review or refusal rather than guessed recovery.
- **Privacy boundaries:** local-only, trustworthy-client, encrypted, and server-authorized systems make different promises. Package documentation must state which boundary it provides.
- **Ordinary-action tests:** end-to-end evidence should exercise user-visible controls and externally observable outcomes instead of implementation-only shortcuts.

These belong in an `@machinapractica` engineering standard, package templates, and pull-request checklist.

## Do not extract yet

The following areas are valuable but have not demonstrated a sufficiently common library boundary:

- a universal visual component library or design system—the applications share rigor, not a single aesthetic or interaction vocabulary;
- game rules, bots, fixed-point collision geometry, card renderers, and animation systems—the domains and performance constraints remain specific;
- URL/QR transfer of complete local state—Sudoku has deep evidence, but room joining is a different problem and should not be counted as replication;
- zero-knowledge enrollment and cryptography—WO-OCD is one implementation and explicitly still requires independent review;
- native WebView bridges, StoreKit/App Store tooling, audiobook import, and provider lifecycle handling—these are strong but product/platform-specific;
- OCR, camera rectification, and image-fixture processing—Zodiac and Sudoku use related inputs but not yet a shared, stable pipeline;
- resident CLI/service architecture—Todo provides one substantial implementation, not a repeated contract;
- formal-proof integration—Dosage and MathPub show complementary ideas, not one npm-ready API;
- immutable server activation and rollback—Ark Nova and QuorTexTT prove the operational pattern, but most of it belongs in Nix/systemd/workflow tooling rather than npm;
- a generic IndexedDB event adapter—Hunger and Sudoku are promising references, but the summaries do not yet demonstrate three consumers with the same transaction, tab-synchronization, and migration requirements. Revisit after a third adoption.

## Extraction and release rules

Each package should satisfy the following before 1.0:

1. **Extract, do not reimagine.** Begin from working consumer code and retain its regression fixtures. New abstractions must be justified by at least two existing implementations.
2. **Three real adopters.** At least three independent repositories must consume the package, with net deletion of local code in each. A demo repository does not count.
3. **Historical compatibility.** Event, storage, build, and deployment packages must run against representative retained histories or artifacts from before extraction.
4. **Consumer contract CI.** Package CI should run its own tests plus pinned compatibility fixtures from pilot consumers. Consumers should pin released versions rather than unpublished workspace state.
5. **Layered entry points.** Browser-safe core modules must not pull Firebase, Node, Playwright, Svelte, or service-worker globals into unrelated consumers.
6. **Small dependency surface.** Prefer standards and injected interfaces. Avoid a catch-all `@machinapractica/core` package.
7. **Explicit stability.** Publish 0.x releases during pilot migration, document event/wire/artifact compatibility separately from TypeScript API compatibility, and declare which surfaces are stable before 1.0.
8. **Evidence-bearing releases.** Every release records source revision, package contents, test results, pilot compatibility, and known unverified boundaries.
9. **No forced migration.** Existing repositories can remain on local implementations until the shared package proves a net benefit. Extraction should not destabilize mature products solely to increase adoption counts.

## Suggested execution sequence

### Wave 0: inventory and contracts

Before publishing code, compare the actual duplicated modules in the proposed pilot repositories. Record event envelopes, ordering rules, actor fields, migration behavior, screenshot naming, timeout helpers, build manifests, and room documents. Build golden fixtures from real, sanitized histories and artifacts. This phase may show that two apparently common concepts need separate interfaces.

### Wave 1: evidence foundation

Publish experimental versions of `@machinapractica/testing` and `@machinapractica/build-info`. Adopt each in three repositories and require net code deletion. Establish package provenance, changelogs, API reports, and consumer compatibility CI here so later packages inherit a functioning release process.

### Wave 2: state foundation

Extract `@machinapractica/events`, prove old-history replay in the pilot corpus, then add `@machinapractica/events-firestore`. Do not develop the Firestore package in parallel with an unstable event envelope; transport feedback may extend the kernel, but it should not couple the kernel to Firebase.

### Wave 3: application infrastructure

Build `@machinapractica/rooms` on the released event packages. In parallel only after `build-info` is stable, extract `@machinapractica/pwa` and `@machinapractica/pages`. Their shared dependency should be the manifest contract, not each other.

### Wave 4: tabletop protocol

Extract only the headless, stable intersections of RoboRally, Istanbul, X-Wing, and DRM. If adoption requires copying each application’s UI into the package, stop: that is evidence the boundary is still a design pattern rather than a library.

## Expected result

The useful end state is not that every repository imports every package. It is that a new local-first or multiplayer application can start with already-proven answers for evidence capture, build identity, deterministic replay, Firestore event delivery, room lifecycle, offline freshness, and deployment verification—while keeping its product rules, privacy claims, and visual identity explicit and local.

The first two packages should make work more observable. The next three should make state and multiplayer behavior more reliable. The remaining packages should make offline delivery and multi-surface deployment less repetitive. That sequence follows the strongest evidence in the summaries and minimizes the risk that `@machinapractica` merely centralizes code before its true shared boundaries are understood.

## Summary sources reviewed

- `summaries/github-work-2026-06-24-through-2026-08-24.md` (original research input; not supplied)
- `summaries/github-work-2026-07-10-through-2026-08-14.md` (original research input; not supplied)
- `summaries/github-work-2026-08-18-through-2026-09-01.md` (original research input; not supplied)
- `summaries/github-work-2026-08-31-through-2026-09-07.md` (original research input; not supplied)
- `summaries/github-work-2026-09-08-through-2026-09-11.md` (original research input; not supplied)
- `summaries/github-work-email-2026-07-07-through-2026-08-17.md` (original research input; not supplied)
- `summaries/github-work-email-ultrabrief-2026-07-07-through-2026-08-17.md` (original research input; not supplied)
