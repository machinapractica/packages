/** Browser-safe coordination and evidence contracts. No runner or application policy. */
export declare const EVIDENCE_CONTRACT: '1.0.0';
export declare function bounded<T>(label: string, timeoutMs: number, task: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T>;
export declare function poll<T>(options: {
    label: string;
    timeoutMs: number;
    intervalMs?: number;
    observe: (signal: AbortSignal) => Promise<T>;
    ready: (value: T) => boolean;
}): Promise<T>;
export interface Identity {
    scenario: string;
    revision: string;
    platform: string;
    artifact?: string;
}
export interface Capture {
    path: string;
    sha256: string;
    actor: string;
    viewport: {
        width: number;
        height: number;
    };
}
export interface Receipt {
    index: number;
    description: string;
    checks: string[];
    captures: Capture[];
}
export interface Artifact {
    path: string;
    sha256: string;
    kind: 'log' | 'trace' | 'result-bundle' | 'build-manifest';
}
export interface Evidence extends Identity {
    contractVersion: typeof EVIDENCE_CONTRACT;
    status: 'running' | 'passed' | 'failed';
    steps: Receipt[];
    artifacts: Artifact[];
    failure?: string;
}
export interface Step {
    description: string;
    action: (signal: AbortSignal) => Promise<void>;
    ready: (signal: AbortSignal) => Promise<void>;
    checks: {
        description: string;
        check: (signal: AbortSignal) => Promise<void>;
    }[];
    stabilize: (signal: AbortSignal) => Promise<void>;
    capture: (index: number, signal: AbortSignal) => Promise<Capture[]>;
}
export declare function relativePath(path: string): boolean;
export declare class Recorder {
    private timeoutMs;
    private evidence;
    private busy;
    constructor(identity: Identity, timeoutMs?: number);
    snapshot(): Evidence;
    addArtifact(artifact: Artifact): void;
    step(step: Step): Promise<void>;
    finish(): Evidence;
}
export declare function walkthrough(evidence: Evidence): string;
/** Input must be decoded RGBA, not PNG file bytes. */
export declare function compareRgba(a: {
    width: number;
    height: number;
    data: Uint8Array;
}, b: {
    width: number;
    height: number;
    data: Uint8Array;
}): {
    equal: boolean;
    differentPixels: number | null;
};
export interface BaselineReview {
    candidateSha256: string;
    revision: string;
    platform: string;
    reviewer: string;
}
/** Consumes an explicit review record; it does not create or approve one. */
export declare function reviewMatches(capture: Capture, identity: Identity, review: BaselineReview): boolean;
