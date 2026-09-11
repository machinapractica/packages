import { type BuildInfo } from './index.js';
/** Hash sorted path/byte records, length-prefixed and domain-separated. Exclude only the declared manifest. */
export declare function hashArtifact(root: string, manifest?: string): Promise<string>;
export declare function createBuildInfo(root: string, identity: Omit<BuildInfo, 'formatVersion' | 'contentHash'>, manifest?: string): Promise<BuildInfo>;
export declare function verifyArtifact(root: string, manifest?: string): Promise<BuildInfo>;
