import { SCHEMA_VERSION, type EatingEpisode, type Program } from './schema';

export class UnsupportedSchemaError extends Error {
  constructor(version: number) { super(`Stored data uses unsupported schema version ${version}`); }
}

export function migrateProgram(record: Program): Program {
  if ((record.schemaVersion ?? 1) > SCHEMA_VERSION) throw new UnsupportedSchemaError(record.schemaVersion);
  return { ...record, onboardingVersion: record.onboardingVersion ?? 1, schemaVersion: SCHEMA_VERSION };
}

export function migrateEpisode(record: EatingEpisode): EatingEpisode {
  if ((record.schemaVersion ?? 1) > SCHEMA_VERSION) throw new UnsupportedSchemaError(record.schemaVersion);
  return { ...record, recalledAfter: record.recalledAfter ?? false, note: record.note ?? null, photoId: record.photoId ?? null, schemaVersion: SCHEMA_VERSION };
}
