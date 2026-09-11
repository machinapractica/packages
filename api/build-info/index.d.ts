export interface BuildInfo {
    formatVersion: 1;
    repository: string;
    revision: string;
    contentHash: string;
    channel: string;
}
export declare function parseBuildInfo(value: unknown): BuildInfo;
export type Freshness = {
    state: 'current' | 'update-available';
    remote: BuildInfo;
} | {
    state: 'unavailable';
    reason: string;
};
export declare function compareBuilds(local: BuildInfo, remote: BuildInfo): Freshness;
/** Endpoint must be same-origin. This reports freshness only; it never reloads or activates a worker. */
export declare function probeBuild(options: {
    local: BuildInfo;
    pageUrl: string;
    manifestUrl: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
}): Promise<Freshness>;
