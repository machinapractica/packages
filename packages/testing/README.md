# @machinapractica/testing

Experimental semantic evidence mechanics, derived from the retained Sudoku, Hunger, X-Wing, RoboRally and Ark Nova helpers. Version `0.1.0-alpha.1` adds package-owned testing policy and Git hooks. No consumer migrations or baseline approvals are implied.

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

## Automatic testing policy

```sh
npm install --save-dev --save-exact @machinapractica/testing@0.1.0-alpha.1
```

With npm lifecycle scripts enabled, installation in a Git working tree installs a pre-commit check. It checks **the index**, so repairing a working file without staging the repair cannot hide a prohibited wait. Existing Git hooks still run and can still reject the commit. The package keeps its dispatcher in Git metadata and sets repository-local `core.hooksPath`; it does not overwrite existing hook files or global Git configuration. This lifecycle behavior also applies when npm installs the package transitively. Global installs do not configure project hooks.

The project setup skill also runs:

```sh
npx --no-install mp-testing setup
```

This idempotent command installs the hooks and adds `prepare` and `pretest` commands to package.json, preserving existing commands. Commit those script changes and the lockfile. `prepare` restores enforcement after a fresh clone and runs after an existing hook manager such as Husky. `pretest` checks working files before `npm test`.

If installation uses `--ignore-scripts`, no package can run its installation hook. The skill runs `setup` after installation in that case too. In CI, run the policy explicitly before test scenarios, even when commits bypass local hooks:

```sh
npm ci --ignore-scripts
npx --no-install mp-testing check
```

The checker parses JavaScript and TypeScript in `test`, `tests`, `spec`, `specs`, `e2e` and `__tests__` directories, files named `*.test.*` or `*.spec.*`, and Playwright configuration files. Keep test helpers in these directories too. Generated output and node_modules are excluded. Working checks include untracked files; commit checks use tracked index contents. Invalid syntax fails the check.

It rejects Playwright `waitForTimeout` references, including optional access, literal computed access and direct/destructured aliases; calls to imported `timers/promises.setTimeout`; and common promise wrappers that resolve through `setTimeout`. Comments and string examples are ignored. Failure deadlines and observable-state polling remain valid. This is a syntax guard for recognizable sleeps, not whole-program analysis: arbitrary aliases, dynamic property names and custom sleep helpers still need review. Screenshot determinism, meaningful assertions and race-free application design require their own checks.

Run `mp-testing setup --hooks-only` to repair hooks without editing scripts. Run `mp-testing uninstall` **before** removing the dependency to restore the previous hooks path, then remove the package commands from prepare/pretest. This restores hooks for the whole repository, including registered subprojects. A missing package fails commits with an installation diagnostic. Setup without Git reports that hooks could not be installed; run it again after `git init`.

The CLI requires Node 22.18+ in the 22 series, or Node 24.11+. Hook installation is tested with npm on macOS and Linux; other package managers must allow lifecycle scripts or run setup explicitly. Browser imports remain free of Node tooling.
