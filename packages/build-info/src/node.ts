import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseBuildInfo, type BuildInfo } from './index.js';

function manifestPath(path: string): void {
  if (!path || /[\\\x00-\x1f]/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('unsafe manifest path');
}
/** Hash sorted path/byte records, length-prefixed and domain-separated. Exclude only the declared manifest. */
export async function hashArtifact(root: string, manifest = 'build-info.json'): Promise<string> {
  manifestPath(manifest);
  if (!(await lstat(root)).isDirectory()) throw new Error('artifact root must be a real directory');
  const hash = createHash('sha256');
  hash.update('machinapractica-artifact-v1\0');
  const field = (bytes: Uint8Array) => { const length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(bytes.length)); hash.update(length); hash.update(bytes); };
  const walk = async (relative: string): Promise<void> => {
    const names = (await readdir(join(root, relative))).sort();
    for (const name of names) {
      if (/[\\\x00-\x1f]/.test(name)) throw new Error('nonportable artifact path');
      const path = relative ? `${relative}/${name}` : name;
      const stat = await lstat(join(root, path));
      if (stat.isSymbolicLink()) throw new Error(`artifact symlink forbidden: ${path}`);
      if (stat.isDirectory()) { await walk(path); continue; }
      if (!stat.isFile()) throw new Error(`special artifact entry forbidden: ${path}`);
      if (path === manifest) continue;
      field(Buffer.from(path)); field(await readFile(join(root, path)));
    }
  };
  await walk('');
  return 'sha256:' + hash.digest('hex');
}
export async function createBuildInfo(root: string, identity: Omit<BuildInfo, 'formatVersion' | 'contentHash'>, manifest = 'build-info.json'): Promise<BuildInfo> {
  const contentHash = await hashArtifact(root, manifest);
  const info = parseBuildInfo({ formatVersion: 1, ...identity, contentHash });
  // Exclusive creation also refuses an existing symlink; create manifests only in completed artifacts.
  await writeFile(join(root, manifest), JSON.stringify(info, null, 2) + '\n', { flag: 'wx' });
  return info;
}
export async function verifyArtifact(root: string, manifest = 'build-info.json'): Promise<BuildInfo> {
  manifestPath(manifest);
  const hash = await hashArtifact(root, manifest);
  const info = parseBuildInfo(JSON.parse(await readFile(join(root, manifest), 'utf8')));
  if (hash !== info.contentHash) throw new Error('artifact content hash mismatch');
  return info;
}
