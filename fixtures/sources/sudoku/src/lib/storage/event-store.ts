import { replay } from '$lib/domain/reducer';
import type {
  AppProjection,
  Digit,
  GameSettings,
  ImportedPuzzleMetadata,
  ImportedPuzzleWorkAction,
  PuzzleDefinition,
  StoredEventDocumentV1,
  SudokuEvent
} from '$lib/domain/types';

export const EVENT_STORE_KEY = 'sudoku.event-store.v1';
export const CORRUPT_STORE_PREFIX = 'sudoku.event-store.corrupt.';

export const emptyDocument = (): StoredEventDocumentV1 => ({ storageVersion: 1, nextSequence: 1, events: [] });

export function copyImportedPuzzleMetadata(metadata: ImportedPuzzleMetadata): ImportedPuzzleMetadata {
  return {
    ...(metadata.elapsedMs !== undefined ? { elapsedMs: metadata.elapsedMs } : {}),
    ...(metadata.hintedCells !== undefined ? { hintedCells: [...metadata.hintedCells] } : {}),
    ...(metadata.mistakes !== undefined ? { mistakes: metadata.mistakes } : {}),
    ...(metadata.settings !== undefined ? { settings: { ...metadata.settings } } : {})
  };
}

interface StoredEventDocumentV0 { storageVersion: 0; events: SudokuEvent[]; }

export function parseDocument(raw: string): { document: StoredEventDocumentV1; migrated: boolean } {
  const parsed = JSON.parse(raw) as StoredEventDocumentV1 | StoredEventDocumentV0;
  if (parsed.storageVersion === 0 && Array.isArray(parsed.events)) {
    return {
      document: {
        storageVersion: 1,
        nextSequence: Math.max(0, ...parsed.events.map((event) => event.sequence)) + 1,
        events: parsed.events
      },
      migrated: true
    };
  }
  if (parsed.storageVersion !== 1 || !Array.isArray(parsed.events) || !Number.isInteger(parsed.nextSequence)) {
    throw new Error('This puzzle history cannot be opened safely');
  }
  return { document: parsed, migrated: false };
}

function readDocument(storage: Storage): StoredEventDocumentV1 {
  const raw = storage.getItem(EVENT_STORE_KEY);
  if (!raw) return emptyDocument();
  return parseDocument(raw).document;
}

export class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

export interface EventStoreLoadResult {
  store: EventStore;
  warning: string;
}

export interface EventMetadata {
  id: string;
  occurredAt: Date;
  elapsedMs?: number;
}

export class EventStore {
  private document: StoredEventDocumentV1;
  private projection: AppProjection;

  private persistent: boolean;
  private warning = '';

  constructor(private readonly storage: Storage, document?: StoredEventDocumentV1, persistent = true, warning = '') {
    this.document = document ?? readDocument(storage);
    this.projection = replay(this.document.events);
    this.persistent = persistent;
    this.warning = warning;
  }

  getProjection(): AppProjection { return structuredClone(this.projection); }
  getDocument(): StoredEventDocumentV1 { return structuredClone(this.document); }
  isPersistent(): boolean { return this.persistent; }
  getWarning(): string { return this.warning; }

  reload(): AppProjection {
    if (!this.persistent) return this.getProjection();
    try {
      this.document = readDocument(this.storage);
      this.projection = replay(this.document.events);
    } catch {
      this.persistent = false;
      this.warning = 'Progress can no longer be saved in this browser.';
    }
    return this.getProjection();
  }

  private append(
    metadata: EventMetadata,
    create: (sequence: number) => SudokuEvent
  ): AppProjection {
    let latest = this.document;
    if (this.persistent) {
      try { latest = readDocument(this.storage); }
      catch {
        this.persistent = false;
        this.warning = 'Progress can no longer be saved in this browser.';
      }
    }
    const event = create(latest.nextSequence);
    const next: StoredEventDocumentV1 = {
      storageVersion: 1,
      nextSequence: latest.nextSequence + 1,
      events: [...latest.events, event]
    };
    if (this.persistent) {
      try { this.storage.setItem(EVENT_STORE_KEY, JSON.stringify(next)); }
      catch {
        this.persistent = false;
        this.warning = 'This browser cannot save progress. This session will continue in memory.';
      }
    }
    this.document = next;
    this.projection = replay(next.events);
    return this.getProjection();
  }

  startGame(puzzle: PuzzleDefinition, metadata: EventMetadata): AppProjection {
    const storedPuzzle: PuzzleDefinition = {
      ...puzzle,
      provenance: puzzle.provenance ? { ...puzzle.provenance } : undefined
    };
    const settings: GameSettings = { ...this.projection.settings };
    return this.append(metadata, (sequence) => {
      const gameId = `game-${storedPuzzle.id}-${sequence}`;
      return {
        id: metadata.id,
        sequence,
        gameId,
        type: 'game/started',
        payload: { gameId, puzzle: storedPuzzle, settings },
        occurredAt: metadata.occurredAt.toISOString(),
        elapsedMs: metadata.elapsedMs ?? 0,
        schemaVersion: 1,
        reducerVersion: 1
      };
    });
  }

  importGame(
    puzzle: PuzzleDefinition,
    metadata: EventMetadata,
    importedSettings: GameSettings = this.projection.settings,
    work: readonly ImportedPuzzleWorkAction[] = [],
    sharedMetadata?: ImportedPuzzleMetadata,
    initialView?: 'walkthrough',
    importKind: 'puzzle-link' | 'camera-photo' = 'puzzle-link'
  ): AppProjection {
    const storedPuzzle: PuzzleDefinition = {
      ...puzzle,
      provenance: puzzle.provenance ? { ...puzzle.provenance } : undefined
    };
    const settings: GameSettings = { ...importedSettings };
    return this.append(metadata, (sequence) => {
      const gameId = `game-${storedPuzzle.id}-${sequence}`;
      return {
        id: metadata.id,
        sequence,
        gameId,
        type: 'game/imported',
        payload: {
          gameId,
          importKind,
          transferId: null,
          puzzle: storedPuzzle,
          settings,
          checkpoint: null,
          ...(work.length ? { work: work.map((action) => action.type === 'value'
            ? { ...action }
            : { ...action, values: [...action.values] }) } : {}),
          ...(sharedMetadata ? { sharedMetadata: copyImportedPuzzleMetadata(sharedMetadata) } : {}),
          ...(initialView ? { initialView } : {})
        },
        occurredAt: metadata.occurredAt.toISOString(),
        elapsedMs: sharedMetadata?.elapsedMs ?? 0,
        schemaVersion: 1,
        reducerVersion: 1
      };
    });
  }

  changeSettings(changes: Partial<GameSettings>, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id, sequence, gameId: null, type: 'settings/changed', payload: changes,
      occurredAt: metadata.occurredAt.toISOString(), elapsedMs: 0,
      schemaVersion: 1, reducerVersion: 1
    }));
  }

  clearAll(): AppProjection {
    for (let index = this.storage.length - 1; index >= 0; index -= 1) {
      const key = this.storage.key(index);
      if (key?.startsWith('sudoku.')) this.storage.removeItem(key);
    }
    this.document = emptyDocument();
    this.projection = replay([]);
    this.warning = '';
    return this.getProjection();
  }

  enterValue(gameId: string, cell: number, value: Digit, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id,
      sequence,
      gameId,
      type: 'cell/value-entered',
      payload: { cell, value },
      occurredAt: metadata.occurredAt.toISOString(),
      elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1,
      reducerVersion: 1
    }));
  }

  toggleNote(
    gameId: string,
    cell: number,
    value: Digit,
    enabled: boolean,
    metadata: EventMetadata
  ): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id,
      sequence,
      gameId,
      type: 'cell/note-toggled',
      payload: { cell, value, enabled },
      occurredAt: metadata.occurredAt.toISOString(),
      elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1,
      reducerVersion: 1
    }));
  }

  fillNotes(gameId: string, cell: number, values: Digit[], metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id,
      sequence,
      gameId,
      type: 'cell/notes-filled',
      payload: { cell, values },
      occurredAt: metadata.occurredAt.toISOString(),
      elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1,
      reducerVersion: 1
    }));
  }

  clearCell(gameId: string, cell: number, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id,
      sequence,
      gameId,
      type: 'cell/cleared',
      payload: { cell },
      occurredAt: metadata.occurredAt.toISOString(),
      elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1,
      reducerVersion: 1
    }));
  }

  eraseValue(
    gameId: string,
    cell: number,
    value: Digit,
    targetEventId: string,
    metadata: EventMetadata
  ): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id,
      sequence,
      gameId,
      type: 'cell/value-erased',
      payload: { cell, value, targetEventId },
      occurredAt: metadata.occurredAt.toISOString(),
      elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1,
      reducerVersion: 1
    }));
  }

  undo(gameId: string, targetEventId: string, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id,
      sequence,
      gameId,
      type: 'move/undone',
      payload: { targetEventId },
      occurredAt: metadata.occurredAt.toISOString(),
      elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1,
      reducerVersion: 1
    }));
  }

  redo(gameId: string, targetEventId: string, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id,
      sequence,
      gameId,
      type: 'move/redone',
      payload: { targetEventId },
      occurredAt: metadata.occurredAt.toISOString(),
      elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1,
      reducerVersion: 1
    }));
  }

  pause(gameId: string, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id, sequence, gameId, type: 'game/paused', payload: {},
      occurredAt: metadata.occurredAt.toISOString(), elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1, reducerVersion: 1
    }));
  }

  resume(gameId: string, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id, sequence, gameId, type: 'game/resumed', payload: {},
      occurredAt: metadata.occurredAt.toISOString(), elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1, reducerVersion: 1
    }));
  }

  revealHint(gameId: string, cell: number, value: Digit, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id, sequence, gameId, type: 'hint/revealed', payload: { cell, value },
      occurredAt: metadata.occurredAt.toISOString(), elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1, reducerVersion: 1
    }));
  }

  restart(gameId: string, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id, sequence, gameId, type: 'game/restarted', payload: {},
      occurredAt: metadata.occurredAt.toISOString(), elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1, reducerVersion: 1
    }));
  }

  abandon(gameId: string, metadata: EventMetadata): AppProjection {
    return this.append(metadata, (sequence) => ({
      id: metadata.id, sequence, gameId, type: 'game/abandoned', payload: {},
      occurredAt: metadata.occurredAt.toISOString(), elapsedMs: metadata.elapsedMs ?? 0,
      schemaVersion: 1, reducerVersion: 1
    }));
  }
}

export function loadEventStore(storage: Storage, now = new Date()): EventStoreLoadResult {
  try {
    storage.setItem('sudoku.storage-check', '1');
    storage.removeItem('sudoku.storage-check');
  } catch {
    return {
      store: new EventStore(new MemoryStorage(), undefined, false, 'This browser cannot save progress. This session will continue in memory.'),
      warning: 'This browser cannot save progress. This session will continue in memory.'
    };
  }

  const raw = storage.getItem(EVENT_STORE_KEY);
  if (!raw) return { store: new EventStore(storage), warning: '' };
  try {
    const { document, migrated } = parseDocument(raw);
    if (migrated) storage.setItem(EVENT_STORE_KEY, JSON.stringify(document));
    return { store: new EventStore(storage, document), warning: migrated ? 'Local puzzle history was safely upgraded.' : '' };
  } catch {
    const quarantineKey = `${CORRUPT_STORE_PREFIX}${now.toISOString().replace(/[:.]/g, '-')}`;
    try {
      storage.setItem(quarantineKey, raw);
      storage.removeItem(EVENT_STORE_KEY);
      const warning = 'Unreadable puzzle history was preserved separately. A clean local store is ready.';
      return { store: new EventStore(storage, emptyDocument(), true, warning), warning };
    } catch {
      const warning = 'Puzzle history is unreadable and this browser cannot preserve a recovery copy.';
      return { store: new EventStore(new MemoryStorage(), undefined, false, warning), warning };
    }
  }
}
