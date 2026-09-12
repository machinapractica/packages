# Machina Practica packages

This is the home for `@machinapractica/*`: small, independently released packages extracted from implementation practices proven in real repositories.

**Status: experimental alpha releases.** `@machinapractica/testing` and `@machinapractica/build-info` provide tested ESM/TypeScript entry points and alpha releases (`0.1.0-alpha.0`) on npm. There are no consumer adopters yet. The other proposed packages remain behind the evidence and dependency gates in the [source inventory](docs/SOURCE_INVENTORY.md).

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for the complete proposal mapping. Run `./scripts/verify.sh`; see [release tooling and evidence limits](docs/RELEASING.md), [testing](packages/testing/README.md), and [build-info](packages/build-info/README.md).

[Practica](https://github.com/machinapractica/practica) owns the books, method, skills, and [website](https://machinapractica.com). This repository owns runtime APIs, compatibility promises, and package releases.

Read the [vision](VISION.md), [extraction proposal](docs/proposals/PACKAGE_EXTRACTION_PROPOSAL.md), and [companion project setup proposal](https://github.com/machinapractica/practica/blob/main/docs/proposals/PROJECT_SETUP_PROPOSAL.md).

## Contribution and release rules

Extract from working consumer code and retain regression fixtures. Before 1.0, require three independent adopters, net deletion of duplicated code, and compatibility checks against retained histories or artifacts. Keep dependencies and browser/server boundaries explicit. Pilot with experimental 0.x releases and record exactly what each release proves.

Use small PRs and record development prompts verbatim in [PROMPTS.md](PROMPTS.md), following [AGENTS.md](AGENTS.md). Enable the complete inherited provenance hooks with `git config core.hooksPath .githooks`; CI enforces the same contract. Use `python3 scripts/check_prompt_provenance.py --mode diff --base-ref main` to verify a branch after its remote exists.

The first real package should configure npm trusted publishing from GitHub-hosted Actions with provenance. No placeholder packages or long-lived publish tokens belong in this bootstrap.

Original content is licensed under [GPLv3](LICENSE); see [licensing boundaries](LICENSES.md).
