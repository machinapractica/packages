#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { forbiddenWaits } from './policy.mjs';
import { installHooks, removeHooks } from './hooks.mjs';

const [command, ...args] = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const root = resolve(rootIndex < 0 ? '.' : args[rootIndex + 1]);
const git = (...arguments_) => execFileSync('git', arguments_, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
try {
  if (command === 'setup') {
    if (!args.includes('--hooks-only')) {
      const file = resolve(root, 'package.json');
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      manifest.scripts ??= {};
      for (const [key, value] of Object.entries({ prepare: 'mp-testing setup --hooks-only', pretest: 'mp-testing check' })) {
        const existing = manifest.scripts[key];
        if (!existing?.includes(value)) manifest.scripts[key] = existing ? `${existing} && ${value}` : value;
      }
      writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    }
    installHooks(root);
  } else if (command === 'uninstall') {
    removeHooks(root);
  } else if (command === 'check') {
    const staged = args.includes('--staged');
    const gitRoot = git('rev-parse', '--show-toplevel').trim();
    const prefix = relative(gitRoot, root).split(sep).join('/');
    const files = git('ls-files', '-z', ...(staged ? [] : ['--cached', '--others', '--exclude-standard'])).split('\0').filter(Boolean);
    let checked = 0;
    for (const file of new Set(files)) {
      if (!/\.[cm]?[jt]sx?$/.test(file) || /(^|\/)(node_modules|dist|build|coverage|\.artifacts)\//.test(file)) continue;
      if (!/(^|\/)(tests?|e2e|__tests__|specs?)\/|\.(test|spec)\.|(^|\/)playwright\.config\./.test(file)) continue;
      let source;
      try { source = staged ? git('show', `:${prefix ? prefix + '/' : ''}${file}`) : readFileSync(resolve(root, file), 'utf8'); }
      catch (error) { if (!staged && error.code === 'ENOENT') continue; throw error; }
      checked++;
      for (const finding of forbiddenWaits(source, file)) {
        console.error(`${file}:${finding.line}:${finding.column}: ${finding.message ?? 'waitForTimeout is prohibited; wait for observable state or transport completion.'}`);
        process.exitCode = 1;
      }
    }
    console.log(`Testing policy: checked ${checked} ${staged ? 'staged' : 'working'} files.`);
  } else {
    throw new Error('Usage: mp-testing setup [--hooks-only] | check [--staged] | uninstall; optional --root DIRECTORY');
  }
} catch (error) { console.error(`mp-testing: ${error.message}`); process.exitCode = 1; }
