import {
  initialSettings,
  type AppSettings,
  type EatingEpisode,
  type ExperimentRecord,
  type InsightSnapshot,
  type PhotoRecord,
  type Program
} from './schema';
import { migrateEpisode, migrateProgram } from './migrations';

export const EVENT_SCHEMA_VERSION = 1;

interface AppetiteEventPayloads {
  'program/started': { program: Program };
  'program/status-changed': { program: Program };
  'settings/changed': { settings: AppSettings };
  'episode/started': { episode: EatingEpisode };
  'episode/changed': { episode: EatingEpisode };
  'episode/deleted': { episodeId: string };
  'photo/stored': { photo: PhotoRecord };
  'insight/snapshot-recorded': { snapshot: InsightSnapshot };
  'experiment/changed': { experiment: ExperimentRecord };
}

export type AppetiteEventType = keyof AppetiteEventPayloads;

export type NewAppetiteEvent = {
  [Type in AppetiteEventType]: {
    type: Type;
    occurredAt: number;
    payload: AppetiteEventPayloads[Type];
  };
}[AppetiteEventType];

export type AppetiteEvent = NewAppetiteEvent & {
  id: string;
  sequence: number;
  version: typeof EVENT_SCHEMA_VERSION;
};

export interface AppetiteProjection {
  programs: Program[];
  episodes: EatingEpisode[];
  insights: InsightSnapshot[];
  experiments: ExperimentRecord[];
  photos: PhotoRecord[];
  settings: AppSettings;
}

export class UnsupportedEventError extends Error {}

function upsert<T extends { id: string }>(records: T[], value: T): void {
  const index = records.findIndex((record) => record.id === value.id);
  if (index === -1) records.push(value);
  else records[index] = value;
}

function migrateSettings(settings: AppSettings): AppSettings {
  return {
    ...initialSettings,
    ...settings,
    reminderWindows: [...(settings.reminderWindows ?? [])],
    schemaVersion: initialSettings.schemaVersion
  };
}

export function projectAppetiteEvents(events: AppetiteEvent[]): AppetiteProjection {
  const projection: AppetiteProjection = {
    programs: [],
    episodes: [],
    insights: [],
    experiments: [],
    photos: [],
    settings: { ...initialSettings, reminderWindows: [] }
  };
  const seen = new Set<string>();

  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.version !== EVENT_SCHEMA_VERSION) {
      throw new UnsupportedEventError(`Unsupported event schema version ${event.version}`);
    }

    switch (event.type) {
      case 'program/started':
      case 'program/status-changed':
        upsert(projection.programs, migrateProgram(event.payload.program));
        break;
      case 'settings/changed':
        projection.settings = migrateSettings(event.payload.settings);
        break;
      case 'episode/started':
      case 'episode/changed': {
        const episode = migrateEpisode(event.payload.episode);
        const prior = projection.episodes.find((record) => record.id === episode.id);
        if (prior?.photoId && prior.photoId !== episode.photoId) {
          projection.photos = projection.photos.filter((photo) => photo.id !== prior.photoId);
        }
        upsert(projection.episodes, episode);
        break;
      }
      case 'episode/deleted': {
        const episode = projection.episodes.find((record) => record.id === event.payload.episodeId);
        projection.episodes = projection.episodes.filter(
          (record) => record.id !== event.payload.episodeId
        );
        if (episode?.photoId) {
          projection.photos = projection.photos.filter((photo) => photo.id !== episode.photoId);
        }
        break;
      }
      case 'photo/stored':
        upsert(projection.photos, event.payload.photo);
        break;
      case 'insight/snapshot-recorded':
        upsert(projection.insights, event.payload.snapshot);
        break;
      case 'experiment/changed':
        if (event.payload.experiment.status === 'active' || event.payload.experiment.status === 'paused') {
          projection.experiments = projection.experiments.map((experiment) =>
            experiment.id !== event.payload.experiment.id &&
            (experiment.status === 'active' || experiment.status === 'paused')
              ? { ...experiment, status: 'stopped', endedAt: event.occurredAt }
              : experiment
          );
        }
        upsert(projection.experiments, event.payload.experiment);
        break;
      default:
        throw new UnsupportedEventError(
          `Unsupported event type ${(event as AppetiteEvent).type}`
        );
    }
  }

  return projection;
}
