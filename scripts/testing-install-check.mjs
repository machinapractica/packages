import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const tarball = resolve(process.argv[2]);
const temp = mkdtempSync(join(tmpdir(), 'mp install hooks '));
function run(cwd, command, args, status = 0) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, HUSKY: '0' } });
  assert.equal(result.status, status, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function init(name, scripts = {}) {
  const root = join(temp, name); mkdirSync(root);
  run(root, 'git', ['init', '-q']);
  run(root, 'git', ['config', 'user.name', 'Policy fixture']);
  run(root, 'git', ['config', 'user.email', 'policy@example.invalid']);
  writeFileSync(join(root, '.gitignore'), 'node_modules/\nhook-ran\n');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, scripts }));
  return root;
}
function install(root, ignored = false) {
  run(root, 'npm', ['install', '--save-dev', '--offline', '--no-audit', '--no-fund', ...(ignored ? ['--ignore-scripts'] : ['--ignore-scripts=false']), tarball]);
}
function cli(root, ...args) { return run(root, join(root, 'node_modules/.bin/mp-testing'), args); }
try {
  const root = init('existing hook');
  mkdirSync(join(root, '.githooks'));
  const hook = '#!/bin/sh\necho original >> hook-ran\n';
  writeFileSync(join(root, '.githooks/pre-commit'), hook); chmodSync(join(root, '.githooks/pre-commit'), 0o755);
  run(root, 'git', ['config', 'core.hooksPath', '.githooks']);
  install(root);
  assert.match(run(root, 'git', ['config', 'core.hooksPath']), /machina-testing-hooks/);
  const file = join(root, 'a test.spec.ts');
  writeFileSync(file, 'await page.waitForTimeout(100);');
  run(root, 'git', ['add', '.']);
  // A working-tree repair must not hide the forbidden staged blob.
  writeFileSync(file, 'await page.getByText("Ready").waitFor();');
  run(root, 'git', ['commit', '-qm', 'must fail'], 1);
  assert.equal(readFileSync(join(root, 'hook-ran'), 'utf8'), 'original\n');
  run(root, 'git', ['add', '.']);
  run(root, 'git', ['commit', '-qm', 'observable wait']);
  assert.equal(readFileSync(join(root, '.githooks/pre-commit'), 'utf8'), hook);
  // Repeated setup preserves commands and does not recurse through its own hooks.
  cli(root, 'setup'); cli(root, 'setup');
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'))).scripts;
  assert.equal(scripts.prepare, 'mp-testing setup --hooks-only');
  assert.equal(scripts.pretest, 'mp-testing check');
  run(root, 'git', ['add', '.']); run(root, 'git', ['commit', '-qm', 'persistent setup']);
  // Existing hook failures still block otherwise valid commits.
  writeFileSync(join(root, '.githooks/pre-commit'), '#!/bin/sh\nexit 23\n');
  run(root, 'git', ['commit', '--allow-empty', '-qm', 'must fail'], 1);
  writeFileSync(join(root, '.githooks/pre-commit'), hook);
  // Renames, deletions and invalid syntax are checked using the index.
  run(root, 'git', ['mv', 'a test.spec.ts', 'renamed.spec.ts']);
  cli(root, 'check', '--staged');
  run(root, 'git', ['rm', '-f', 'renamed.spec.ts']); cli(root, 'check', '--staged');
  cli(root, 'uninstall');
  assert.equal(run(root, 'git', ['config', 'core.hooksPath']).trim(), '.githooks');

  const ignored = init('ignored scripts', { prepare: 'node -e "void 0"', pretest: 'node -e "void 0"', test: 'node -e "void 0"' });
  install(ignored, true);
  run(ignored, 'git', ['config', '--local', '--get', 'core.hooksPath'], 1);
  cli(ignored, 'setup');
  assert.match(JSON.parse(readFileSync(join(ignored, 'package.json'))).scripts.prepare, /^node .* && mp-testing setup --hooks-only$/);
  writeFileSync(join(ignored, 'bad.spec.js'), 'await new Promise(done => setTimeout(done, 150));');
  run(ignored, 'git', ['add', '.']);
  run(ignored, 'git', ['commit', '-qm', 'must fail'], 1);
  run(ignored, 'npm', ['test'], 1);
  writeFileSync(join(ignored, 'bad.spec.js'), 'const =');
  run(ignored, join(ignored, 'node_modules/.bin/mp-testing'), ['check'], 1);
  writeFileSync(join(ignored, 'bad.spec.js'), '// valid');
  run(ignored, 'git', ['add', '.']); run(ignored, 'git', ['commit', '-qm', 'ready']);
  // A fresh clone recreates local hooks from the committed prepare command.
  const clone = join(temp, 'clone'); run(temp, 'git', ['clone', '-q', ignored, clone]);
  run(clone, 'npm', ['ci', '--offline', '--ignore-scripts=false', '--no-audit', '--no-fund']);
  assert.match(run(clone, 'git', ['config', 'core.hooksPath']), /machina-testing-hooks/);
  // Installation from a project below the Git root keeps paths relative to that project.
  const mono = init('monorepo');
  const nested = join(mono, 'apps', 'game'); mkdirSync(nested, { recursive: true });
  writeFileSync(join(nested, 'package.json'), JSON.stringify({ private: true }));
  install(nested);
  writeFileSync(join(nested, 'nested.spec.ts'), 'await page.waitForTimeout(50);');
  run(mono, 'git', ['add', '.']);
  run(mono, 'git', ['commit', '-qm', 'must fail'], 1);
  writeFileSync(join(nested, 'nested.spec.ts'), '// ready');
  run(mono, 'git', ['add', '.']); run(mono, 'git', ['commit', '-qm', 'nested ready']);
  cli(nested, 'uninstall');
  run(mono, 'git', ['config', '--local', '--get', 'core.hooksPath'], 1);
  const prefixed = init('explicit prefix');
  run(temp, 'npm', ['install', '--prefix', prefixed, '--offline', '--ignore-scripts=false', '--no-audit', '--no-fund', tarball]);
  assert.match(run(prefixed, 'git', ['config', 'core.hooksPath']), /machina-testing-hooks/);
  // Lifecycle scripts cannot create a Git repository where none was requested.
  const plain = join(temp, 'not a repository'); mkdirSync(plain);
  writeFileSync(join(plain, 'package.json'), '{"private":true}'); install(plain);
  console.log('Packed install contracts passed: automatic hooks, staged blobs, existing hooks, setup, npm test, clone.');
} finally { rmSync(temp, { recursive: true, force: true }); }
