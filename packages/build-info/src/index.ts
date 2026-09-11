export interface BuildInfo {
  formatVersion: 1;
  repository: string;
  revision: string;
  contentHash: string;
  channel: string;
}
export function parseBuildInfo(value: unknown): BuildInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('build manifest must be an object');
  const record = value as Record<string, unknown>;
  const keys = ['formatVersion', 'repository', 'revision', 'contentHash', 'channel'];
  if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !(key in record))) throw new Error('unexpected or missing manifest fields');
  if (record.formatVersion !== 1) throw new Error('unsupported build manifest version');
  if (typeof record.repository !== 'string' || !/^https:\/\/[^\s?#]+$/.test(record.repository)) throw new Error('repository must be an HTTPS URL');
  const url = new URL(record.repository);
  if (url.username || url.password) throw new Error('repository credentials forbidden');
  if (typeof record.revision !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(record.revision)) throw new Error('full source revision required');
  if (typeof record.contentHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(record.contentHash)) throw new Error('SHA-256 content identity required');
  if (typeof record.channel !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(record.channel)) throw new Error('invalid channel');
  return { formatVersion: 1, repository: record.repository, revision: record.revision, contentHash: record.contentHash, channel: record.channel };
}
export type Freshness = { state: 'current' | 'update-available'; remote: BuildInfo } | { state: 'unavailable'; reason: string };
export function compareBuilds(local: BuildInfo, remote: BuildInfo): Freshness {
  local = parseBuildInfo(local); remote = parseBuildInfo(remote);
  if (local.repository !== remote.repository || local.channel !== remote.channel) return { state: 'unavailable', reason: 'repository or channel mismatch' };
  return { state: local.revision === remote.revision && local.contentHash === remote.contentHash ? 'current' : 'update-available', remote };
}
/** Endpoint must be same-origin. This reports freshness only; it never reloads or activates a worker. */
export async function probeBuild(options: { local: BuildInfo; pageUrl: string; manifestUrl: string; timeoutMs?: number; fetch?: typeof fetch }): Promise<Freshness> {
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeout must be positive');
  parseBuildInfo(options.local);
  const page = new URL(options.pageUrl);
  const endpoint = new URL(options.manifestUrl, page);
  if (!['http:', 'https:'].includes(page.protocol) || endpoint.origin !== page.origin || endpoint.username || endpoint.password) throw new Error('same-origin HTTP manifest required');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async (): Promise<Freshness> => {
        const response = await (options.fetch ?? fetch)(endpoint, { cache: 'no-store', redirect: 'error', signal: controller.signal });
        if (!response.ok) return { state: 'unavailable', reason: `HTTP ${response.status}` };
        if (response.headers.get('X-Machina-Practica-Build-Source') === 'cache') return { state: 'unavailable', reason: 'cached manifest is not freshness evidence' };
        return compareBuilds(options.local, parseBuildInfo(await response.json()));
      })(),
      new Promise<Freshness>(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ state: 'unavailable', reason: 'manifest deadline exceeded' }); }, timeoutMs); })
    ]);
  } catch (error) { return { state: 'unavailable', reason: error instanceof Error ? error.message : String(error) }; }
  finally { clearTimeout(timer); }
}
