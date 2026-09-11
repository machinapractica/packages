/** Browser-safe coordination and evidence contracts. No runner or application policy. */
export const EVIDENCE_CONTRACT = '1.0.0' as const;
export async function bounded<T>(label: string, timeoutMs: number, task: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeout must be positive');
  if (parent?.aborted) throw new Error(`${label}: cancelled`);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    return await Promise.race([Promise.resolve().then(() => task(controller.signal)), new Promise<never>((_, reject) => {
      cancel = () => { controller.abort(); reject(new Error(`${label}: cancelled`)); };
      if (parent?.aborted) { cancel(); return; }
      parent?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => { controller.abort(); reject(new Error(`${label}: deadline exceeded (${timeoutMs}ms)`)); }, timeoutMs);
    })]);
  } finally { clearTimeout(timer); if (cancel) parent?.removeEventListener('abort', cancel); }
}
export async function poll<T>(options: { label: string; timeoutMs: number; intervalMs?: number; observe: (signal: AbortSignal) => Promise<T>; ready: (value: T) => boolean }): Promise<T> {
  const interval = options.intervalMs ?? 25;
  if (!Number.isFinite(interval) || interval < 1) throw new Error('poll interval must be positive');
  let last: T | undefined;
  try {
    return await bounded(options.label, options.timeoutMs, async signal => {
      while (!signal.aborted) {
        last = await options.observe(signal);
        if (signal.aborted) break;
        if (options.ready(last)) return last;
        await new Promise<void>(resolve => {
          const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
          const timer = setTimeout(finish, interval);
          signal.addEventListener('abort', finish, { once: true });
        });
      }
      throw new Error('poll aborted');
    });
  } catch (cause) {
    throw new Error(`${options.label}: readiness failed; last observation: ${JSON.stringify(last)}`, { cause });
  }
}
export interface Identity { scenario: string; revision: string; platform: string; artifact?: string }
export interface Capture { path: string; sha256: string; actor: string; viewport: { width: number; height: number } }
export interface Receipt { index: number; description: string; checks: string[]; captures: Capture[] }
export interface Artifact { path: string; sha256: string; kind: 'log' | 'trace' | 'result-bundle' | 'build-manifest' }
export interface Evidence extends Identity { contractVersion: typeof EVIDENCE_CONTRACT; status: 'running' | 'passed' | 'failed'; steps: Receipt[]; artifacts: Artifact[]; failure?: string }
export interface Step {
  description: string;
  action: (signal: AbortSignal) => Promise<void>;
  ready: (signal: AbortSignal) => Promise<void>;
  checks: { description: string; check: (signal: AbortSignal) => Promise<void> }[];
  stabilize: (signal: AbortSignal) => Promise<void>;
  capture: (index: number, signal: AbortSignal) => Promise<Capture[]>;
}
export function relativePath(path: string): boolean {
  return !!path && !/[^a-zA-Z0-9._/-]/.test(path) && !path.startsWith('/') && path.split('/').every(p => p !== '' && p !== '.' && p !== '..');
}
export class Recorder {
  private evidence: Evidence;
  private busy = false;
  constructor(identity: Identity, private timeoutMs = 10000) {
    for (const value of [identity.scenario, identity.revision, identity.platform]) if (!value.trim()) throw new Error('complete evidence identity required');
    this.evidence = { ...identity, contractVersion: EVIDENCE_CONTRACT, status: 'running', steps: [], artifacts: [] };
  }
  snapshot(): Evidence { return structuredClone(this.evidence); }
  addArtifact(artifact: Artifact): void {
    if (this.busy) throw new Error('step in progress');
    if (!relativePath(artifact.path) || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !['log','trace','result-bundle','build-manifest'].includes(artifact.kind)) throw new Error('invalid artifact metadata');
    const paths = [...this.evidence.artifacts, ...this.evidence.steps.flatMap(s => s.captures)].map(a => a.path);
    if (paths.includes(artifact.path)) throw new Error('duplicate artifact path');
    this.evidence.artifacts.push(structuredClone(artifact));
  }
  async step(step: Step): Promise<void> {
    if (this.busy || this.evidence.status !== 'running') throw new Error('recorder is busy or finished');
    this.busy = true;
    try {
      if (!step.description.trim() || !step.checks.length || step.checks.some(c => !c.description.trim())) throw new Error('named semantic checks required');
      const index = this.evidence.steps.length + 1;
      await bounded('action', this.timeoutMs, step.action);
      await bounded('readiness', this.timeoutMs, step.ready);
      for (const check of step.checks) await bounded(check.description, this.timeoutMs, check.check);
      await bounded('presentation', this.timeoutMs, step.stabilize);
      const captures = await bounded('capture', this.timeoutMs, signal => step.capture(index, signal));
      if (!captures.length) throw new Error('capture required');
      const paths = new Set([...this.evidence.artifacts, ...this.evidence.steps.flatMap(s => s.captures)].map(a => a.path));
      for (const capture of captures) {
        if (paths.has(capture.path)) throw new Error('duplicate artifact path');
        paths.add(capture.path);
        if (!relativePath(capture.path) || !/^[a-f0-9]{64}$/.test(capture.sha256) || !capture.actor.trim() || !Number.isSafeInteger(capture.viewport.width) || capture.viewport.width <= 0 || !Number.isSafeInteger(capture.viewport.height) || capture.viewport.height <= 0) throw new Error('invalid capture metadata');
      }
      this.evidence.steps.push(structuredClone({ index, description: step.description, checks: step.checks.map(c => c.description), captures }));
    } catch (error) {
      this.evidence.status = 'failed';
      this.evidence.failure = error instanceof Error ? error.message : String(error);
      throw error;
    } finally { this.busy = false; }
  }
  finish(): Evidence {
    if (this.busy) throw new Error('step in progress');
    if (this.evidence.status === 'running') {
      if (!this.evidence.steps.length) throw new Error('no completed steps');
      this.evidence.status = 'passed';
    }
    return this.snapshot();
  }
}
const escape = (text: string) => text.replace(/[\\`*_[\]<>]/g, '\\$&').replace(/[\r\n]/g, ' ');
export function walkthrough(evidence: Evidence): string {
  const lines = [`# ${escape(evidence.scenario)}`, '', `Status: ${evidence.status}`, `Revision: ${escape(evidence.revision)}`, `Platform: ${escape(evidence.platform)}`, `Evidence contract: ${evidence.contractVersion}`, ''];
  for (const step of evidence.steps) {
    lines.push(`## ${step.index}. ${escape(step.description)}`, '');
    for (const check of step.checks) lines.push(`- [x] ${escape(check)}`);
    for (const capture of step.captures) lines.push('', `![${escape(capture.actor)}](<${capture.path}>)`, '', `SHA-256: ${capture.sha256}`);
  }
  for (const artifact of evidence.artifacts) lines.push('', `[${artifact.kind}](<${artifact.path}>) SHA-256: ${artifact.sha256}`);
  if (evidence.failure) lines.push('', `Failure: ${escape(evidence.failure)}`);
  return lines.join('\n') + '\n';
}
/** Input must be decoded RGBA, not PNG file bytes. */
export function compareRgba(a: { width: number; height: number; data: Uint8Array }, b: { width: number; height: number; data: Uint8Array }): { equal: boolean; differentPixels: number | null } {
  for (const image of [a, b]) if (!Number.isSafeInteger(image.width) || image.width <= 0 || !Number.isSafeInteger(image.height) || image.height <= 0 || image.data.length !== image.width * image.height * 4) throw new Error('invalid RGBA image');
  if (a.width !== b.width || a.height !== b.height) return { equal: false, differentPixels: null };
  let differentPixels = 0;
  for (let i = 0; i < a.data.length; i += 4) if ([0,1,2,3].some(c => a.data[i+c] !== b.data[i+c])) differentPixels++;
  return { equal: differentPixels === 0, differentPixels };
}

export interface BaselineReview { candidateSha256: string; revision: string; platform: string; reviewer: string }
/** Consumes an explicit review record; it does not create or approve one. */
export function reviewMatches(capture: Capture, identity: Identity, review: BaselineReview): boolean {
  return /^[a-f0-9]{64}$/.test(review.candidateSha256) && !!review.reviewer.trim() && review.candidateSha256 === capture.sha256 && review.revision === identity.revision && review.platform === identity.platform;
}
