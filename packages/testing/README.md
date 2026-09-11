# @machinapractica/testing

Experimental semantic evidence mechanics, derived from the retained Sudoku, Hunger, X-Wing, RoboRally and Ark Nova helpers. Version `0.1.0-alpha.0` is initially available as a locally built tarball. No consumer migrations or baseline approvals are implied.

- Root export: `Recorder`, `poll`, `bounded`, `walkthrough`, `compareRgba`, and receipt types. Browser-safe; no Playwright or Node dependency.
- `/node`: new per-scenario directories, exclusive capture/receipt writes, SHA-256 integrity.
- `/playwright`: isolated actor contexts, allowlisted HTTP/WebSocket origins and screenshot capture. Optional peer: Playwright 1.63 or later within major 1. Service workers are blocked in these contexts; test PWA behavior in a separate explicitly scoped harness.

```js
import { Recorder } from '@machinapractica/testing';
const recorder = new Recorder({ scenario: 'Open a document', revision, platform });
await recorder.step({
  description: 'The document opens',
  action: async () => openThroughPublicUI(),
  ready: async () => waitForDocument(),
  checks: [{ description: 'The title matches', check: async () => assertTitle() }],
  stabilize: async () => waitForPresentation(),
  capture: async (index) => captureActors(index)
});
const evidence = recorder.finish();
```

The caller supplies product semantics, fixed clocks/seeds, font readiness, actors/viewports and source/artifact identity. Persist `recorder.finish()` in failure cleanup too; it remains failed after a failed step. Completed earlier steps are retained. No step can pass without checks and captures. Parallel scenarios require separate recorders/directories; concurrent calls on one recorder are rejected.

Deadlines apply to each stage. Hooks receive an AbortSignal and must cooperate with cancellation; JavaScript cannot forcibly stop an arbitrary promise or undo application actions. A late result never appends a passing receipt. Readiness polling retries only unsuccessful observations, not thrown errors.

Captures are **candidates**, not reviewed baselines. `compareRgba` requires decoded RGBA buffers with dimensions. File hashes verify artifact bytes and are not pixel comparisons. Native runners may emit the evidence schema; this package does not run or qualify native applications.

Use a trusted newly created output directory. These helpers are not a sandbox for concurrently hostile filesystem writers. Receipts report caller-executed assertions; they cannot establish that a supplied assertion is meaningful. The repository verifier exercises real Chromium actions, isolated storage, network rejection, deadlines and installed tarballs. See the source inventory and API reports in the repository. GPL-3.0-only.

`withProcess` in `/node` launches an explicit command/argument list, waits for caller-supplied bounded readiness, runs the scenario and cleans up its owned process group. It retains the last 8 KiB of process output in failure diagnostics; use `onOutput` to retain full logs. The caller chooses the production command and port. On Windows cleanup covers the direct child only; descendant cleanup needs a platform job runner.

`actor` optionally accepts a fixed clock, seeded `Math.random` and an endpoint predicate in addition to origins. These opt-ins do not replace cryptographic randomness or prove service-worker isolation. Native Playwright controls remain available on the returned context/page. `reviewMatches` consumes a separately authored review record binding the candidate hash, revision, platform and reviewer; it never generates approval.

`writeArtifact` retains flat named log/trace/result-archive/build-manifest bytes with a hash; `Recorder.addArtifact` links the resulting identity without changing test status. Attach only artifacts actually retained. Trace timing and native result-bundle collection remain the runner's responsibility.
