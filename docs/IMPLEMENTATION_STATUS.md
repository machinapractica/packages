# Package proposal status

Recorded 2026-09-11. This implementation changes the shared package repository only. It creates no consumer migrations and counts no test fixture as an adopter.

| Component | Status | Gate to further work |
| --- | --- | --- |
| Wave 0 | Initial immutable inventory and licensed reference snapshots from seven sources, with hash verification and boundary comparisons | Real sanitized historical event streams and retained offline/deployment artifacts are still needed |
| testing | Experimental TypeScript/ESM core, Node evidence/process helpers, Playwright actors, polling, deterministic controls, network policy, candidate review matching, RGBA comparison, hashed artifacts | Real adoption in proposed pilots; broader browser/native evidence |
| build-info | Experimental browser/Node APIs and CLI; strict v1 manifest, deterministic artifact hashing, explicit freshness; legacy mapping regression | Static and served consumer adoption; deployment probes against actual deployed artifacts |
| events | Source comparisons and retained modules | Hunger/Sudoku/RoboRally historical replay corpus and agreed consumer-owned envelope/migration contracts |
| events-firestore | Dependency and emulator acceptance requirements recorded | Tested event kernel, append-only/reconnect/order/authorization emulator contracts |
| rooms | Deferred by dependency order | Released event transport and consumer lifecycle contracts |
| pwa | Worker references compared | Stable build identity plus real cache/update/offline fixtures; selected product activation/privacy policy |
| pages | Deployment/evidence boundaries recorded in companion skills | Stable manifest plus retained deployment/preview artifacts and validation of privileged publication |
| tabletop-protocol | Protocol-only boundary retained | Successful lower-layer adoption and viewer/privacy/reconnect fixtures |
| Release system | Independent versions/changelogs, API reports, packed-install checks, read-only CI, OIDC alpha workflow with dry-run default | Initial alpha publications and CLI trust configuration completed 2026-09-12; no placeholder or stored publish token |

Local verification: 18 unit/CLI/source-integrity contracts and three Chromium contracts, plus packed imports, public declarations, CLI and tarball file checks. Test helpers run against a synthetic package-conformance fixture, not a newly generated product. Snapshots preserve real committed source; the retained Ark Nova manifest example was already a synthetic source unit fixture. These distinctions matter to the proposal's historical compatibility requirement.

The TypeScript sources and license travel in the npm tarballs. `.artifacts/release-manifest.json` binds tarball contents to the verified source revision and flags a dirty working tree. CI retains logs and browser evidence even on failure. See [release procedure](RELEASING.md) and [source inventory](SOURCE_INVENTORY.md).

On 2026-09-12 npm confirmed publication of both `0.1.0-alpha.0` packages with public access and the `alpha` tag. Both have trusted publishers for `machinapractica/packages`, `release.yml`, environment `npm`. The first versions were locally bootstrapped without GitHub provenance; future workflow publications request OIDC provenance. No additional version was published merely to test the trust configuration.
