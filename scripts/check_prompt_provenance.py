#!/usr/bin/env python3
"""Ensure project changes update PROMPTS.md."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


PROMPTS_FILE = "PROMPTS.md"


def git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout


def changed_paths_from_names(output: str) -> set[str]:
    return {line.strip() for line in output.splitlines() if line.strip()}


def staged_paths() -> set[str]:
    return changed_paths_from_names(git(["diff", "--cached", "--name-only", "--diff-filter=ACMRTD"]))


def diff_paths(base_ref: str) -> set[str]:
    git(["fetch", "--no-tags", "--depth=1", "origin", f"{base_ref}:refs/remotes/origin/{base_ref}"])
    return changed_paths_from_names(
        git(["diff", "--name-only", "--diff-filter=ACMRTD", f"origin/{base_ref}...HEAD"])
    )


def is_project_content(path: str) -> bool:
    return path != PROMPTS_FILE


def check_prompts_file_exists() -> list[str]:
    if Path(PROMPTS_FILE).is_file():
        return []
    return [f"{PROMPTS_FILE} is required for prompt provenance."]


def check_paths(paths: set[str]) -> list[str]:
    failures = check_prompts_file_exists()
    content_paths = sorted(path for path in paths if is_project_content(path))

    if content_paths and PROMPTS_FILE not in paths:
        failures.append(
            "Project content changed without updating PROMPTS.md. "
            "Record the prompt that produced this change before committing or merging."
        )
        failures.append("Content paths: " + ", ".join(content_paths))

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=("staged", "diff"),
        default="staged",
        help="Check staged changes or all changes against a base branch.",
    )
    parser.add_argument(
        "--base-ref",
        default="main",
        help="Base branch for --mode diff.",
    )
    args = parser.parse_args()

    paths = staged_paths() if args.mode == "staged" else diff_paths(args.base_ref)
    failures = check_paths(paths)

    if failures:
        print("Prompt provenance check failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print("Prompt provenance check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
