import { createHash } from 'node:crypto';
import { mkdir, writeFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { walkthrough, type Evidence, type Capture, type Artifact, relativePath } from './index.js';
export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
/** Own a NEW directory per scenario/worker. Refuse existing paths, including symlinks. */
export async function createEvidenceDirectory(parent: string, name: string): Promise<string> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) throw new Error('invalid scenario directory name');
  if (!(await lstat(parent)).isDirectory()) throw new Error('parent must be a real directory');
  const directory = resolve(parent, name);
  await mkdir(directory);
  return directory;
}
export async function writeCapture(directory: string, index: number, actor: string, viewport: Capture['viewport'], bytes: Uint8Array): Promise<Capture> {
  if (!Number.isSafeInteger(index) || index < 1 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(actor)) throw new Error('invalid capture identity');
  const path = `${String(index).padStart(3, '0')}-${actor}.png`;
  await writeFile(join(directory, path), bytes, { flag: 'wx' });
  return { path, sha256: sha256(bytes), actor, viewport };
}
export async function writeEvidence(directory: string, evidence: Evidence): Promise<void> {
  await writeFile(join(directory, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(directory, 'walkthrough.md'), walkthrough(evidence), { flag: 'wx' });
}

import { spawn } from 'node:child_process';
import { bounded } from './index.js';
/** Run an owned production process with bounded startup and guaranteed process-group cleanup. */
export async function withProcess<T>(options: {
  command: string; args: string[]; cwd?: string; timeoutMs?: number;
  onOutput?: (text: string) => void;
  ready: (signal: AbortSignal) => Promise<void>;
}, use: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const child = spawn(options.command, options.args, { cwd: options.cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const controller = new AbortController();
  let output = '';
  let exited = false;
  let stopping = false;
  const exit = new Promise<void>(resolve => child.once('close', () => { exited = true; resolve(); }));
  let outputFailure: (error: unknown) => void = () => {};
  const failure = new Promise<never>((_, reject) => {
    outputFailure = reject;
    child.once('error', reject);
    child.once('exit', (code, signal) => { if (!stopping) { controller.abort(); reject(new Error(`process exited (${code ?? signal}); output: ${output}`)); } });
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    const text = String(chunk); output = (output + text).slice(-8192);
    try { options.onOutput?.(text); } catch (error) { outputFailure(error); controller.abort(); }
  });
  const kill = (signal: NodeJS.Signals) => {
    if (!child.pid) return;
    try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  try {
    await Promise.race([bounded('process readiness', options.timeoutMs ?? 10000, options.ready, controller.signal), failure]);
    return await Promise.race([use(controller.signal), failure]);
  } catch (error) { throw new Error(`production process failed; output: ${output}`, { cause: error }); }
  finally {
    stopping = true; controller.abort(); kill('SIGTERM');
    if (!exited) {
      try { await bounded('process cleanup', 1000, () => exit); }
      catch { kill('SIGKILL'); await exit; }
    }
    // A parent may exit before its descendants; kill any remaining owned Unix process group.
    if (process.platform !== 'win32') kill('SIGKILL');
  }
}

/** Copy retained log/trace/archive bytes into the owned evidence directory and return their identity. */
export async function writeArtifact(directory: string, name: string, kind: Artifact['kind'], bytes: Uint8Array): Promise<Artifact> {
  if (!relativePath(name) || name.includes('/') || ['evidence.json', 'walkthrough.md'].includes(name)) throw new Error('flat nonreserved artifact name required');
  await writeFile(join(directory, name), bytes, { flag: 'wx' });
  return { path: name, sha256: sha256(bytes), kind };
}
