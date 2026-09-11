# Wave 0 source inventory

The [machine-readable manifest](../fixtures/source-manifest.json) identifies exact commits, paths, SHA-256 hashes, and retained license texts. Snapshots in `fixtures/sources` preserve the originals byte-for-byte. They are compatibility references, not new consumers. Source checkouts were read with `git show` at fixed commits; local uncommitted files were excluded.

| Mechanism | Compared implementations | Common boundary | Differences retained locally |
| --- | --- | --- | --- |
| Evidence steps | Sudoku, Hunger, X-Wing, RoboRally, Ark Nova | Named semantic checks precede screenshot and generated documentation | Readiness selectors, scroll policies, touch sizes, actor surfaces, canonical OS, naming and baseline decisions |
| Build identity | Sudoku version route and shell update; Ark Nova buildinfo | Source identity, versioned validation, explicit unavailable/update states | Sudoku exposes revision; Ark Nova commit/contentVersion/toolchain fields. Neither legacy format is silently rewritten |
| Event history | Hunger events/migrations; Sudoku event store; X-Wing model/reducer; Ark Nova eventlog | Authoritative stream, disposable projections, consumer reducer | Hunger sorts sequence and deduplicates IDs; Sudoku storage and reducer versions differ; X-Wing rejection diagnostics belong to the game; Ark Nova is Go. No universal envelope established |
| PWA freshness | Sudoku, Hunger, Food workers | Explicit network freshness and shell cache lifecycle | Activation timing, cache scope, navigation fallback and data privacy are product policies |
| Native receipts | Player iOS evidence manifest | Artifact identity, hashes, checks and limits | Native qualification and result bundles remain native; Playwright does not prove hardware behavior |

## Extraction decisions

Start with `testing` and `build-info`. Their shared mechanics can be tested without replacing a consumer's rules. Keep browser entry points free of Node imports. Node evidence output and artifact hashing are separate entry points. Use TypeScript declarations and ESM, pinned Node/npm, exact build dependencies, and packed-install checks. Neither package owns application setup or a framework.

Testing keeps checks as caller functions, with readiness and presentation hooks. It produces candidate captures and receipts only for completed checks. It never blesses a baseline. Exact pixels compare decoded RGBA buffers; PNG container bytes are only artifact integrity hashes. Multi-actor context isolation is explicit; network interception must disclose its service-worker boundary.

Build-info introduces an explicit new v1 contract. Adapters for old revision/commit fields are deliberate caller choices. Deterministic content identity excludes only the declared output manifest and rejects links. Source revision and content digest are independent. Unavailable or cached freshness is never evidence that an application is current.

## Remaining gates

The retained source modules are **not a sanitized corpus of production event histories**. Before extracting events, retain representative historical streams and expected replay output from Hunger, Sudoku and RoboRally, including migrations and rejected events. Do not manufacture adoption or call synthetic examples old histories.

Firestore requires an agreed event kernel and emulator contracts for append-only writes, ordering, reconnect, duplicate delivery and consumer authorization. Rooms depends on that released transport; tabletop protocol depends on successful lower-layer adoption. PWA and Pages need a stable build manifest plus real offline/deployment artifact fixtures. These layers have references and an implementation sequence, not placeholder npm packages.

Repositories lacking an explicit reuse license were inspected for boundary comparison only and are not vendored. Proprietary material is excluded. See [third-party notices](../fixtures/NOTICE.md).
