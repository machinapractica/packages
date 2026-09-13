import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hookNames = ['applypatch-msg', 'pre-applypatch', 'post-applypatch', 'pre-commit', 'pre-merge-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit', 'pre-rebase', 'post-checkout', 'post-merge', 'pre-push', 'pre-receive', 'update', 'proc-receive', 'post-receive', 'post-update', 'reference-transaction', 'push-to-checkout', 'pre-auto-gc', 'post-rewrite', 'sendemail-validate', 'fsmonitor-watchman', 'p4-changelist', 'p4-prepare-changelist', 'p4-post-changelist', 'p4-pre-submit', 'post-index-change'];
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
function repository(project) {
  const git = (...args) => execFileSync('git', args, { cwd: project, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const root = git('rev-parse', '--show-toplevel');
  const common = resolve(project, git('rev-parse', '--git-common-dir'));
  return { git, root, directory: join(common, 'machina-testing-hooks') };
}
export function installHooks(project) {
  let repo;
  try { repo = repository(project); }
  catch { console.log('mp-testing: no Git working tree; run mp-testing setup after git init.'); return; }
  const { git, root, directory } = repo;
  const stateFile = join(directory, 'state.json');
  const config = (...args) => { try { return git('config', ...args); } catch { return null; } };
  const current = config('--get', 'core.hooksPath');
  let state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { projects: [] };
  if (current !== directory) {
    state.previous = current === null ? git('rev-parse', '--git-path', 'hooks') : current;
    // Default Git paths may be relative to this invocation's working directory.
    if (current === null) state.previous = resolve(project, state.previous);
    state.previousLocal = config('--local', '--get', 'core.hooksPath');
  }
  state.projects = [...new Set([...state.projects, relative(root, project) || '.'])];
  mkdirSync(directory, { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
  writeFileSync(join(directory, 'dispatch.cjs'), readFileSync(fileURLToPath(new URL('./hook-dispatch.cjs', import.meta.url))));
  for (const name of hookNames) {
    const file = join(directory, name);
    writeFileSync(file, `#!/bin/sh\nexec node ${quote(join(directory, 'dispatch.cjs'))} ${quote(name)} "$@"\n`);
    chmodSync(file, 0o755);
  }
  git('config', '--local', 'core.hooksPath', directory);
  console.log('mp-testing: installed staged testing policy; existing Git hooks are chained.');
}
export function removeHooks(project) {
  const { git, directory } = repository(project);
  const state = JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8'));
  if (git('config', '--get', 'core.hooksPath') !== directory) throw new Error('Another hook manager changed core.hooksPath; leaving it unchanged.');
  if (state.previousLocal === null) git('config', '--local', '--unset', 'core.hooksPath');
  else git('config', '--local', 'core.hooksPath', state.previousLocal);
  console.log('mp-testing: restored previous Git hooks. Remove package-owned prepare/pretest script commands before removing the dependency.');
}
