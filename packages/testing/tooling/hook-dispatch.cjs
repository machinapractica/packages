const { readFileSync, accessSync, constants } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const state = JSON.parse(readFileSync(join(__dirname, 'state.json'), 'utf8'));
const [name, ...args] = process.argv.slice(2);
function run(command, argv) {
  const result = spawnSync(command, argv, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
try {
  const previous = resolve(state.previous, name);
  let executable = false;
  try { accessSync(previous, constants.X_OK); executable = true; } catch {}
  if (executable) run(previous, args);
  if (name === 'pre-commit') {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    for (const project of state.projects) {
      const directory = resolve(root, project);
      const requireProject = createRequire(join(directory, 'package.json'));
      const cli = requireProject.resolve('@machinapractica/testing/cli');
      run(process.execPath, [cli, 'check', '--staged', '--root', directory]);
    }
  }
} catch (error) {
  console.error(`mp-testing hook: ${error.message}\nInstall project dependencies before committing; use mp-testing setup to repair hooks.`);
  process.exit(1);
}
