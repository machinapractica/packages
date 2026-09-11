export const DATABASE_NAME = 'learn-your-appetite';
export const DATABASE_VERSION = 3;
export const SCHEMA_VERSION = 2;

export type ProgramStatus = 'active' | 'paused' | 'complete';

export interface Program {
  id: string;
  startedAt: number;
  timeZone: string;
  status: ProgramStatus;
  onboardingVersion: number;
  schemaVersion: number;
}

export type EatingReason =
  | 'physical-hunger'
  | 'craving'
  | 'emotion'
  | 'boredom'
  | 'habit'
  | 'social-context';

export type Occasion = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

export interface EatingEpisode {
  id: string;
  programId: string;
  startedAt: number;
  completedAt: number | null;
  capturedTimeZone: string;
  beforeLevel: number;
  afterLevel: number | null;
  reason: EatingReason | null;
  occasion: Occasion | null;
  note: string | null;
  photoId: string | null;
  recalledAfter: boolean;
  status: 'open' | 'complete' | 'unfinished';
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface InsightSnapshot {
  id: string;
  programId: string;
  shownAt: number;
  algorithmVersion: number;
  copyVersion: number;
  result: unknown;
  feedback: 'helpful' | 'not-for-me' | null;
  sourceChanged: boolean;
  sourceStatus?: 'current' | 'changed' | 'deleted';
}

export interface ExperimentRecord {
  id: string;
  programId: string;
  insightId: string;
  kind: 'eat-earlier-noticing' | 'midway-pause' | 'name-body-hunger' | 'slow-first-minutes';
  startedAt: number;
  endedAt: number | null;
  baselineEpisodeIds: string[];
  target: {
    label: string;
    measure: 'uncomfortable-ending-rate' | 'comfortable-ending-rate';
    direction: 'lower' | 'higher';
    days: 7;
  };
  status: 'active' | 'paused' | 'stopped' | 'complete';
  result: {
    state: 'changed' | 'similar' | 'learning';
    baselineCount: number;
    baselineTotal: number;
    experimentCount: number;
    experimentTotal: number;
  } | null;
  algorithmVersion: number;
}

export interface PhotoRecord {
  id: string;
  programId: string;
  blob: Blob;
  mediaType: string;
  width: number;
  height: number;
  bytes: number;
}

export interface AppSettings {
  id: 'settings';
  appearance: 'light' | 'dark';
  remindersPaused: boolean;
  reminderWindows: string[];
  permissionState: NotificationPermission | 'unsupported';
  reducedPrompts: boolean;
  includePhotosInExport: boolean;
  dismissedSupport: boolean;
  schemaVersion: number;
}

export const initialSettings: AppSettings = {
  id: 'settings',
  appearance: 'light',
  remindersPaused: false,
  reminderWindows: [],
  permissionState: 'default',
  reducedPrompts: false,
  includePhotosInExport: false,
  dismissedSupport: false,
  schemaVersion: SCHEMA_VERSION
};

export const storeNames = [
  'programs',
  'episodes',
  'insights',
  'experiments',
  'photos',
  'settings'
] as const;

export type StoreName = (typeof storeNames)[number];

export const EVENT_STORE_NAME = 'events' as const;
export const METADATA_STORE_NAME = 'metadata' as const;
export const allStoreNames = [...storeNames, EVENT_STORE_NAME, METADATA_STORE_NAME] as const;
