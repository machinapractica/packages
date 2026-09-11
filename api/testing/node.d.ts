import { type Evidence, type Capture, type Artifact } from './index.js';
export declare const sha256: (bytes: Uint8Array) => string;
/** Own a NEW directory per scenario/worker. Refuse existing paths, including symlinks. */
export declare function createEvidenceDirectory(parent: string, name: string): Promise<string>;
export declare function writeCapture(directory: string, index: number, actor: string, viewport: Capture['viewport'], bytes: Uint8Array): Promise<Capture>;
export declare function writeEvidence(directory: string, evidence: Evidence): Promise<void>;
/** Run an owned production process with bounded startup and guaranteed process-group cleanup. */
export declare function withProcess<T>(options: {
    command: string;
    args: string[];
    cwd?: string;
    timeoutMs?: number;
    onOutput?: (text: string) => void;
    ready: (signal: AbortSignal) => Promise<void>;
}, use: (signal: AbortSignal) => Promise<T>): Promise<T>;
/** Copy retained log/trace/archive bytes into the owned evidence directory and return their identity. */
export declare function writeArtifact(directory: string, name: string, kind: Artifact['kind'], bytes: Uint8Array): Promise<Artifact>;
