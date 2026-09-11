# Agent Instructions

These instructions apply to all agents working in this repository.

## Prompt Provenance

Every prompt used to develop this project must be recorded verbatim in `PROMPTS.md`.

For this repository, a prompt includes:

- A human instruction that asks an agent to create, revise, review, publish, or otherwise develop project content.
- A human instruction that changes the project vision, scope, process, or repository structure.
- A prompt written by one agent and passed to another agent, model, or automated assistant for project work.

Routine shell commands, tool calls, and generated implementation details are not prompts unless they are intentionally used as instructions to another agent or model.

## Required Workflow

Before a pull request is complete, update `PROMPTS.md` in the same branch with:

- The prompt text exactly as received or sent.
- The date recorded.
- The actor or source, when known.
- The pull request or pull requests produced by that prompt.
- A short note only when needed to explain the relationship between the prompt and the resulting PR.

If the pull request URL or number is not known when the first commit is made, record it as pending, open the PR, then update `PROMPTS.md` before handing the work back for review.

## Verbatim Means Verbatim

Do not paraphrase, normalize, correct spelling, or silently remove formatting from recorded prompts. Preserve punctuation, capitalization, Markdown, quoted text, and typos.

Historical prompt entries are append-only. Do not edit a recorded prompt except to fix a transcription error, and when doing so, add a note explaining the correction.

If a prompt contains credentials, private keys, or other material that should not be committed to a public repository, stop and ask the maintainer how to proceed before publishing it.

## Review Standard

Treat prompt provenance as part of the project source. A PR that changes project content without updating `PROMPTS.md` is incomplete.

The repository enforces this expectation in local Git hooks and CI. If the checks fail, add the missing prompt entry rather than bypassing the check.

In a local checkout, run `git config core.hooksPath .githooks` before committing so Git uses the tracked pre-commit and pre-push hooks.
