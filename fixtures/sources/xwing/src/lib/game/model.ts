import type { Action, Maneuver, Seat } from '$lib/manifests/teaching-duel';
import type { Pose } from '$lib/geometry';
import type { AttackFace, DefenseFace } from './prng';
export type Phase = 'lobby' | 'setup' | 'planning' | 'activation' | 'engagement' | 'finished';
export interface GameConfig {
  ruleset: string;
  manifest: string;
  reducer: string;
  geometry: string;
  prng: string;
  damageDeck: string;
}
export interface ShipState {
  id: string;
  seat: Seat;
  pose: Pose;
  hull: number;
  shields: number;
  force: number;
  stress: number;
  focus: number;
  evade: number;
  lock?: string;
  damage: { id: string; faceup: boolean; title: string }[];
  maneuver?: Maneuver;
  revealed: boolean;
  activated: boolean;
  engaged: boolean;
  skipAction: boolean;
  destroyed: boolean;
}
export interface GameOutcome {
  eventId: string;
  kind: 'movement' | 'action' | 'attack' | 'damage' | 'round';
  text: string;
  shipIds: string[];
}
export interface GameState {
  gameId: string;
  revision: number;
  phase: Phase;
  round: number;
  seed: number;
  config: GameConfig;
  seats: Record<Seat, { joined: boolean; ready: boolean; committed: boolean }>;
  setupPlaced: string[];
  ships: Record<string, ShipState>;
  activeShipId?: string;
  pending:
    | 'setup'
    | 'reveal'
    | 'action'
    | 'target'
    | 'attack'
    | 'attacker-modify'
    | 'defender-modify'
    | 'damage'
    | 'end'
    | null;
  attack?: {
    attackerId: string;
    defenderId: string;
    range: 1 | 2 | 3;
    obstructed: boolean;
    attack: AttackFace[];
    defense: DefenseFace[];
  };
  winner?: Seat | 'draw';
  damageDeck: string[];
  damageCursor: number;
  log: string[];
  outcome?: GameOutcome;
}
export interface EventBase<T extends string, P> {
  id: string;
  type: T;
  actor: 'table' | Seat;
  sequence: number;
  payload: P;
}
export type GameEvent =
  | EventBase<'game/created', { gameId: string; seed: number; config: GameConfig }>
  | EventBase<'player/joined', { seat: Seat }>
  | EventBase<'player/ready', { seat: Seat }>
  | EventBase<'setup/placed', { pieceId: string }>
  | EventBase<'setup/completed', Record<string, never>>
  | EventBase<'planning/assigned', { shipId: string; maneuverId: string }>
  | EventBase<'planning/committed', { seat: Seat }>
  | EventBase<'activation/revealed', { shipId: string }>
  | EventBase<
      'activation/action',
      { shipId: string; action: Action | 'pass'; targetId?: string; direction?: 'left' | 'right' }
    >
  | EventBase<'damage/repaired', { shipId: string; cardId: string }>
  | EventBase<'engagement/targeted', { attackerId: string; defenderId: string }>
  | EventBase<'engagement/passed', { attackerId: string }>
  | EventBase<'engagement/rolled', Record<string, never>>
  | EventBase<'engagement/attack-modified', { choice: 'focus' | 'force' | 'pass' }>
  | EventBase<'engagement/defense-modified', { choice: 'focus' | 'evade' | 'pass' }>
  | EventBase<'engagement/resolved', Record<string, never>>
  | EventBase<'round/ended', Record<string, never>>
  | EventBase<'game/conceded', { seat: Seat }>
  | EventBase<'game/rematched', { seed: number }>;
export interface Diagnostic {
  eventId: string;
  message: string;
}
