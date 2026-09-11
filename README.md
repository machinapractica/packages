# Machina Practica packages

This is the proposed home for `@machinapractica/*`: small, independently released packages extracted from implementation practices proven in real repositories.

**Status: pre-extraction.** No packages are implemented or published here. npm organization ownership must be verified before the scope is described as reserved. Workspace and release tooling will be selected after the Wave 0 source inventory.

[Practica](https://github.com/machinapractica/practica) owns the books, method, skills, and [website](https://machinapractica.com). This repository owns runtime APIs, compatibility promises, and package releases.

Read the [vision](VISION.md), [extraction proposal](docs/proposals/PACKAGE_EXTRACTION_PROPOSAL.md), and [companion project setup proposal](https://github.com/machinapractica/practica/blob/main/docs/proposals/PROJECT_SETUP_PROPOSAL.md).

## Contribution and release rules

Extract from working consumer code and retain regression fixtures. Before 1.0, require three independent adopters, net deletion of duplicated code, and compatibility checks against retained histories or artifacts. Keep dependencies and browser/server boundaries explicit. Pilot with experimental 0.x releases and record exactly what each release proves.

Use small PRs and record development prompts verbatim in [PROMPTS.md](PROMPTS.md), following [AGENTS.md](AGENTS.md). Enable the complete inherited provenance hooks with `git config core.hooksPath .githooks`; CI enforces the same contract. Use `python3 scripts/check_prompt_provenance.py --mode diff --base-ref main` to verify a branch after its remote exists.

The first real package should configure npm trusted publishing from GitHub-hosted Actions with provenance. No placeholder packages or long-lived publish tokens belong in this bootstrap.

Licensing is awaiting the owner's decision; no license grant is implied by this draft.
