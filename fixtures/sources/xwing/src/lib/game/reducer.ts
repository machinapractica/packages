import {
  baseIntersectsCircle,
  containsPose,
  executeManeuver,
  isInFrontArc,
  overlaps,
  rangeBetween,
  rollbackOverlap,
  segmentIntersectsCircle
} from '$lib/geometry';
import {
  MANIFEST_VERSION,
  RULESET_ID,
  setupOrder,
  shipById,
  ships,
  teachingDuel,
  type Seat
} from '$lib/manifests/teaching-duel';
import type { Diagnostic, GameConfig, GameEvent, GameState, ShipState } from './model';
import { rollAttack, rollDefense } from './prng';
import { createDamageDeck, damageDefinition } from '$lib/manifests/damage-deck';

export const GAME_CONFIG: GameConfig = {
  ruleset: RULESET_ID,
  manifest: MANIFEST_VERSION,
  reducer: 'teaching-reducer-1',
  geometry: 'fixed-point-geometry-1',
  prng: 'xorshift32-1',
  damageDeck: 'standard-damage-deck-1'
};
const gameConfigKeys = Object.keys(GAME_CONFIG) as (keyof GameConfig)[];

function supportsGameConfig(config: GameConfig) {
  return (
    Object.keys(config).length === gameConfigKeys.length &&
    gameConfigKeys.every((key) => config[key] === GAME_CONFIG[key])
  );
}

const initialShip = (id: string): ShipState => {
  const manifest = shipById(id)!;
  const pose =
    id === 'red-five'
      ? { x: 45_720, y: 80_000, angle: 0 }
      : id === 'onyx-one'
        ? { x: 36_000, y: 11_440, angle: 180_000 }
        : { x: 55_440, y: 11_440, angle: 180_000 };
  return {
    id,
    seat: manifest.seat,
    pose,
    hull: manifest.hull,
    shields: manifest.shields,
    force: manifest.force ?? 0,
    stress: 0,
    focus: 0,
    evade: 0,
    damage: [],
    revealed: false,
    activated: false,
    engaged: false,
    skipAction: false,
    destroyed: false
  };
};

export const createInitialState = (gameId = 'uncreated', seed = 0x5857494e): GameState => ({
  gameId,
  revision: 0,
  phase: 'lobby',
  round: 0,
  seed,
  config: GAME_CONFIG,
  seats: {
    rebel: { joined: false, ready: false, committed: false },
    imperial: { joined: false, ready: false, committed: false }
  },
  setupPlaced: [],
  ships: Object.fromEntries(ships.map((ship) => [ship.id, initialShip(ship.id)])),
  damageDeck: createDamageDeck(seed),
  damageCursor: 0,
  pending: null,
  log: []
});

const activationOrder = (state: GameState) =>
  ships
    .filter((ship) => !state.ships[ship.id]!.activated && !state.ships[ship.id]!.destroyed)
    .sort((a, b) => a.initiative - b.initiative || a.id.localeCompare(b.id));
const engagementOrder = (state: GameState) =>
  ships
    .filter((ship) => !state.ships[ship.id]!.engaged && !state.ships[ship.id]!.destroyed)
    .sort((a, b) => b.initiative - a.initiative || a.id.localeCompare(b.id));
const nextActivation = (state: GameState) => {
  const next = activationOrder(state)[0];
  if (next) {
    state.activeShipId = next.id;
    state.pending = 'reveal';
  } else {
    state.phase = 'engagement';
    state.activeShipId = engagementOrder(state)[0]?.id;
    state.pending = state.activeShipId ? 'target' : 'end';
  }
};

function resolveDamage(state: GameState) {
  if (!state.attack) return { shieldLoss: 0, hullLoss: 0, destroyed: false };
  const defender = state.ships[state.attack.defenderId]!;
  const hullBefore = defender.hull;
  const hits = state.attack.attack.filter((face) => face === 'hit' || face === 'critical').length;
  const evades = state.attack.defense.filter((face) => face === 'evade').length;
  let remaining = Math.max(0, hits - evades);
  const shieldLoss = Math.min(defender.shields, remaining);
  defender.shields -= shieldLoss;
  remaining -= shieldLoss;
  for (let index = 0; index < remaining; index += 1) {
    const faceup = state.attack.attack.includes('critical') && index === remaining - 1;
    const instanceId = state.damageDeck[state.damageCursor++] ?? `exhausted-${state.damageCursor}`;
    const definition = damageDefinition(instanceId);
    defender.hull -= 1;
    defender.damage.push({
      id: instanceId,
      faceup,
      title: faceup ? (definition?.title ?? 'Critical damage') : 'Facedown damage'
    });
    if (faceup && definition?.id === 'direct-hit') {
      defender.damage.at(-1)!.faceup = false;
      defender.damage.at(-1)!.title = 'Facedown damage';
      const extraId = state.damageDeck[state.damageCursor++] ?? `exhausted-${state.damageCursor}`;
      defender.hull -= 1;
      defender.damage.push({ id: extraId, faceup: false, title: 'Facedown damage' });
    }
  }
  defender.destroyed = defender.hull <= 0;
  return { shieldLoss, hullLoss: hullBefore - defender.hull, destroyed: defender.destroyed };
}

const title = (seat: Seat) => (seat === 'rebel' ? 'Rebel' : 'Imperial');
const faceSummary = (faces: string[]) => (faces.length ? faces.join(', ') : 'no results');

export function applyEvent(source: GameState, event: GameEvent): { state: GameState; diagnostic?: Diagnostic } {
  if (event.sequence !== source.revision + 1)
    return { state: source, diagnostic: { eventId: event.id, message: 'Event sequence is stale or out of order.' } };
  const state = structuredClone(source);
  const reject = (message: string) => ({ state: source, diagnostic: { eventId: event.id, message } });
  state.outcome = undefined;
  const outcome = (kind: NonNullable<GameState['outcome']>['kind'], text: string, shipIds: string[]) => {
    state.outcome = { eventId: event.id, kind, text, shipIds };
  };
  switch (event.type) {
    case 'game/created':
      if (state.phase !== 'lobby' || state.revision !== 0) return reject('A game already exists.');
      if (!supportsGameConfig(event.payload.config))
        return reject('This game references an unsupported rules or engine version.');
      state.gameId = event.payload.gameId;
      state.seed = event.payload.seed;
      state.config = { ...event.payload.config };
      state.damageDeck = createDamageDeck(event.payload.seed);
      state.damageCursor = 0;
      state.log.push('Table opened the teaching duel.');
      break;
    case 'player/joined':
      if (event.actor !== event.payload.seat || state.seats[event.payload.seat].joined)
        return reject('Seat claim is not authorized.');
      state.seats[event.payload.seat].joined = true;
      state.log.push(`${event.payload.seat === 'rebel' ? 'Rebel' : 'Imperial'} phone paired.`);
      break;
    case 'player/ready':
      if (event.actor !== 'table' || !state.seats[event.payload.seat].joined)
        return reject('Only the table can ready a paired seat.');
      state.seats[event.payload.seat].ready = true;
      state.log.push(`${title(event.payload.seat)} squad readied.`);
      if (state.seats.rebel.ready && state.seats.imperial.ready) {
        state.phase = 'setup';
        state.pending = 'setup';
        state.log.push('Both squads ready. Fixed setup began.');
      }
      break;
    case 'setup/completed':
      if (event.actor !== 'table' || state.phase !== 'setup') return reject('Setup is not waiting on the table.');
      state.setupPlaced = setupOrder.map((piece) => piece.id);
      state.phase = 'planning';
      state.round = 1;
      state.pending = null;
      state.log.push('All ships entered the play area. Planning began.');
      break;
    case 'setup/placed': {
      const expected = setupOrder[state.setupPlaced.length];
      if (event.actor !== 'table' || state.phase !== 'setup' || !expected || event.payload.pieceId !== expected.id)
        return reject('Place the highlighted setup piece next.');
      state.setupPlaced.push(expected.id);
      state.log.push(
        `${expected.seat === 'rebel' ? 'Rebel' : 'Imperial'} placed ${expected.kind === 'ship' ? shipById(expected.id)!.name : `obstacle ${state.setupPlaced.length}`}.`
      );
      if (state.setupPlaced.length === setupOrder.length) {
        state.phase = 'planning';
        state.round = 1;
        state.pending = null;
        state.log.push('Setup complete. Planning began.');
      }
      break;
    }
    case 'planning/assigned': {
      const ship = state.ships[event.payload.shipId];
      const selected = shipById(event.payload.shipId)?.dial.find((item) => item.id === event.payload.maneuverId);
      if (
        state.phase !== 'planning' ||
        !ship ||
        event.actor !== ship.seat ||
        state.seats[ship.seat].committed ||
        !selected
      )
        return reject('That private maneuver cannot be assigned now.');
      ship.maneuver = selected;
      break;
    }
    case 'planning/committed': {
      const owned = Object.values(state.ships).filter((ship) => ship.seat === event.payload.seat && !ship.destroyed);
      if (state.phase !== 'planning' || event.actor !== event.payload.seat || owned.some((ship) => !ship.maneuver))
        return reject('Every active ship needs a dial before commitment.');
      state.seats[event.payload.seat].committed = true;
      state.log.push(`${title(event.payload.seat)} squad committed its maneuvers.`);
      if (state.seats.rebel.committed && state.seats.imperial.committed) {
        state.phase = 'activation';
        nextActivation(state);
        state.log.push('Both squadrons committed. Activation began.');
      }
      break;
    }
    case 'activation/revealed': {
      const ship = state.ships[event.payload.shipId];
      if (
        event.actor !== 'table' ||
        state.phase !== 'activation' ||
        event.payload.shipId !== state.activeShipId ||
        !ship?.maneuver
      )
        return reject('This is not the active ship.');
      const destination = executeManeuver(ship.pose, ship.maneuver);
      const occupied = Object.values(state.ships)
        .filter((other) => other.id !== ship.id && !other.destroyed)
        .map((other) => other.pose);
      const collision = occupied.some((pose) => overlaps(destination, pose));
      ship.revealed = true;
      ship.pose = collision ? rollbackOverlap(ship.pose, destination, occupied) : destination;
      const obstacle = teachingDuel.obstacleGeometry.find((item) => baseIntersectsCircle(ship.pose, item, item.radius));
      ship.skipAction = collision || obstacle?.type === 'asteroid';
      if (obstacle?.type === 'debris') ship.stress += 1;
      if (ship.maneuver.difficulty === 'red') ship.stress += 1;
      if (ship.maneuver.difficulty === 'blue' && ship.stress) ship.stress -= 1;
      state.pending = 'action';
      const movementResults = [
        `${ship.maneuver.speed} ${ship.maneuver.bearing}`,
        collision ? 'stopped before overlap' : '',
        obstacle?.type === 'asteroid' ? 'asteroid: action skipped' : '',
        obstacle?.type === 'debris' ? 'debris: +1 stress' : '',
        ship.maneuver.difficulty === 'red' ? 'red maneuver: +1 stress' : '',
        ship.maneuver.difficulty === 'blue' ? 'blue maneuver: stress reduced' : ''
      ].filter(Boolean);
      state.log.push(`${shipById(ship.id)!.name} moved: ${movementResults.join(' · ')}.`);
      outcome('movement', movementResults.join(' · ').toUpperCase(), [ship.id]);
      break;
    }
    case 'activation/action': {
      const ship = state.ships[event.payload.shipId];
      const manifest = shipById(event.payload.shipId);
      if (
        event.actor !== 'table' ||
        state.phase !== 'activation' ||
        state.pending !== 'action' ||
        ship?.id !== state.activeShipId
      )
        return reject('This ship cannot act now.');
      if (
        event.payload.action !== 'pass' &&
        (!manifest?.actions.includes(event.payload.action) || ship.stress > 0 || ship.skipAction)
      )
        return reject('That action is not legal.');
      let actionResult = 'passed its action';
      if (event.payload.action === 'focus') {
        ship.focus += 1;
        actionResult = 'gained 1 focus token';
      }
      if (event.payload.action === 'evade') {
        ship.evade += 1;
        actionResult = 'gained 1 evade token';
      }
      if (event.payload.action === 'lock') {
        const target = event.payload.targetId ? state.ships[event.payload.targetId] : undefined;
        if (!target || target.destroyed || target.seat === ship.seat || rangeBetween(ship.pose, target.pose) > 3)
          return reject('Touch an enemy at range 0–3 to acquire a lock.');
        ship.lock = target.id;
        actionResult = `locked ${shipById(target.id)!.name}`;
      }
      if (event.payload.action === 'barrel-roll') {
        if (!event.payload.direction) return reject('Choose the left or right barrel-roll position.');
        ship.pose.x += event.payload.direction === 'left' ? -4_000 : 4_000;
        actionResult = `barrel rolled ${event.payload.direction}`;
      }
      if (event.payload.action === 'pass' && ship.skipAction) actionResult = 'skipped its action after an obstruction';
      state.log.push(`${shipById(ship.id)!.name} ${actionResult}.`);
      outcome('action', actionResult.toUpperCase(), [ship.id]);
      ship.activated = true;
      nextActivation(state);
      break;
    }
    case 'damage/repaired': {
      const ship = state.ships[event.payload.shipId];
      const card = ship?.damage.find((damage) => damage.id === event.payload.cardId);
      const repairable = card?.id.startsWith('weapons-failure-') || card?.id.startsWith('structural-damage-');
      if (
        event.actor !== 'table' ||
        state.phase !== 'activation' ||
        state.pending !== 'action' ||
        ship?.id !== state.activeShipId ||
        ship.stress > 0 ||
        ship.skipAction ||
        !card?.faceup ||
        !repairable
      )
        return reject('That faceup damage card cannot be repaired as this ship’s action.');
      const title = card.title;
      card.faceup = false;
      card.title = 'Facedown damage';
      ship.activated = true;
      state.log.push(`${shipById(ship.id)!.name} repaired ${title}.`);
      outcome('action', `REPAIRED ${title.toUpperCase()}`, [ship.id]);
      nextActivation(state);
      break;
    }
    case 'engagement/targeted': {
      const attacker = state.ships[event.payload.attackerId];
      const defender = state.ships[event.payload.defenderId];
      const range = attacker && defender ? rangeBetween(attacker.pose, defender.pose) : 4;
      if (
        event.actor !== 'table' ||
        state.phase !== 'engagement' ||
        attacker?.id !== state.activeShipId ||
        !defender ||
        attacker.seat === defender.seat ||
        range < 1 ||
        range > 3 ||
        !isInFrontArc(attacker.pose, defender.pose)
      )
        return reject('Target must be an enemy in the front arc at range 1–3.');
      if (defender.id === 'red-five') defender.force = Math.min(shipById(defender.id)!.force ?? 0, defender.force + 1);
      const obstructed = teachingDuel.obstacleGeometry.some((obstacle) =>
        segmentIntersectsCircle(attacker.pose, defender.pose, obstacle, obstacle.radius)
      );
      state.attack = {
        attackerId: attacker.id,
        defenderId: defender.id,
        range: range as 1 | 2 | 3,
        obstructed,
        attack: [],
        defense: []
      };
      state.pending = 'attack';
      state.log.push(
        `${shipById(attacker.id)!.name} targeted ${shipById(defender.id)!.name} at range ${range}${obstructed ? ' through an obstruction' : ''}.`
      );
      outcome('attack', `TARGET LOCKED · RANGE ${range}${obstructed ? ' · OBSTRUCTED' : ''}`, [
        attacker.id,
        defender.id
      ]);
      break;
    }
    case 'engagement/passed': {
      const attacker = state.ships[event.payload.attackerId];
      if (
        event.actor !== 'table' ||
        state.phase !== 'engagement' ||
        state.pending !== 'target' ||
        attacker?.id !== state.activeShipId
      )
        return reject('This ship cannot pass now.');
      attacker.engaged = true;
      state.log.push(`${shipById(attacker.id)!.name} had no attack and passed.`);
      outcome('attack', 'NO ATTACK · PASSED', [attacker.id]);
      const next = engagementOrder(state)[0];
      state.activeShipId = next?.id;
      state.pending = next ? 'target' : 'end';
      break;
    }
    case 'engagement/rolled': {
      if (event.actor !== 'table' || state.phase !== 'engagement' || state.pending !== 'attack' || !state.attack)
        return reject('No attack is ready to roll.');
      const attackerState = state.ships[state.attack.attackerId]!;
      const defenderState = state.ships[state.attack.defenderId]!;
      const weaponsFailure = attackerState.damage.some((card) => card.faceup && card.id.startsWith('weapons-failure-'))
        ? 1
        : 0;
      const structuralDamage = defenderState.damage.some(
        (card) => card.faceup && card.id.startsWith('structural-damage-')
      )
        ? 1
        : 0;
      const attackDice = Math.max(
        0,
        shipById(state.attack.attackerId)!.attack - weaponsFailure + (state.attack.range === 1 ? 1 : 0)
      );
      const defenseDice = Math.max(
        0,
        shipById(state.attack.defenderId)!.agility -
          structuralDamage +
          (state.attack.range === 3 ? 1 : 0) +
          (state.attack.obstructed ? 1 : 0)
      );
      const attackRoll = rollAttack(state.seed, attackDice);
      const defenseRoll = rollDefense(attackRoll.seed, defenseDice);
      state.seed = defenseRoll.seed;
      state.attack.attack = attackRoll.results;
      state.attack.defense = defenseRoll.results;
      state.pending = 'attacker-modify';
      state.log.push(
        `${shipById(state.attack.attackerId)!.name} rolled ${faceSummary(attackRoll.results)}; ${shipById(state.attack.defenderId)!.name} rolled ${faceSummary(defenseRoll.results)}.`
      );
      outcome('attack', `ATTACK ${faceSummary(attackRoll.results)} · DEFENSE ${faceSummary(defenseRoll.results)}`, [
        state.attack.attackerId,
        state.attack.defenderId
      ]);
      break;
    }
    case 'engagement/attack-modified': {
      if (
        event.actor !== 'table' ||
        state.phase !== 'engagement' ||
        state.pending !== 'attacker-modify' ||
        !state.attack
      )
        return reject('The attacker cannot modify dice now.');
      const attacker = state.ships[state.attack.attackerId]!;
      if (event.payload.choice === 'focus') {
        if (!attacker.focus || !state.attack.attack.includes('focus'))
          return reject('No focus result can be modified.');
        state.attack.attack = state.attack.attack.map((face) => (face === 'focus' ? 'hit' : face));
        attacker.focus -= 1;
      } else if (event.payload.choice === 'force') {
        const firstFocus = state.attack.attack.indexOf('focus');
        if (!attacker.force || firstFocus < 0) return reject('No Force modification is available.');
        state.attack.attack[firstFocus] = 'hit';
        attacker.force -= 1;
      }
      state.pending = 'defender-modify';
      state.log.push(
        event.payload.choice === 'pass'
          ? `${shipById(attacker.id)!.name} passed attack modification.`
          : `${shipById(attacker.id)!.name} spent ${event.payload.choice}; attack results became ${faceSummary(state.attack.attack)}.`
      );
      outcome('attack', `ATTACK ${faceSummary(state.attack.attack)}`, [attacker.id]);
      break;
    }
    case 'engagement/defense-modified': {
      if (
        event.actor !== 'table' ||
        state.phase !== 'engagement' ||
        state.pending !== 'defender-modify' ||
        !state.attack
      )
        return reject('The defender cannot modify dice now.');
      const defender = state.ships[state.attack.defenderId]!;
      if (event.payload.choice === 'focus') {
        if (!defender.focus || !state.attack.defense.includes('focus'))
          return reject('No defense focus result can be modified.');
        state.attack.defense = state.attack.defense.map((face) => (face === 'focus' ? 'evade' : face));
        defender.focus -= 1;
      } else if (event.payload.choice === 'evade') {
        if (!defender.evade) return reject('No evade token is available.');
        defender.evade -= 1;
        state.attack.defense.push('evade');
      }
      state.pending = 'damage';
      state.log.push(
        event.payload.choice === 'pass'
          ? `${shipById(defender.id)!.name} passed defense modification.`
          : `${shipById(defender.id)!.name} spent ${event.payload.choice}; defense results became ${faceSummary(state.attack.defense)}.`
      );
      outcome('attack', `DEFENSE ${faceSummary(state.attack.defense)}`, [defender.id]);
      break;
    }
    case 'engagement/resolved': {
      if (event.actor !== 'table' || state.phase !== 'engagement' || state.pending !== 'damage' || !state.attack)
        return reject('No rolled attack is ready to resolve.');
      const attackerId = state.attack.attackerId;
      const defenderId = state.attack.defenderId;
      const damage = resolveDamage(state);
      const damageParts = [
        damage.shieldLoss ? `${damage.shieldLoss} shield${damage.shieldLoss === 1 ? '' : 's'} lost` : '',
        damage.hullLoss ? `${damage.hullLoss} hull lost` : '',
        !damage.shieldLoss && !damage.hullLoss ? 'no damage' : '',
        damage.destroyed ? 'destroyed' : ''
      ].filter(Boolean);
      state.log.push(
        `${shipById(attackerId)!.name}'s attack resolved against ${shipById(defenderId)!.name}: ${damageParts.join(' · ')}.`
      );
      outcome('damage', damageParts.join(' · ').toUpperCase(), [defenderId]);
      state.ships[attackerId]!.engaged = true;
      state.attack = undefined;
      const next = engagementOrder(state)[0];
      state.activeShipId = next?.id;
      state.pending = next ? 'target' : 'end';
      break;
    }
    case 'round/ended': {
      if (event.actor !== 'table' || state.phase !== 'engagement' || state.pending !== 'end')
        return reject('The round cannot end now.');
      const alive = (seat: Seat) =>
        Object.values(state.ships).some((ship) => ship.seat === seat && !ship.destroyed && containsPose(ship.pose));
      const rebel = alive('rebel');
      const imperial = alive('imperial');
      if (!rebel || !imperial) {
        state.phase = 'finished';
        state.winner = rebel === imperial ? 'draw' : rebel ? 'rebel' : 'imperial';
        state.pending = null;
        state.log.push(
          `Round ${state.round} ended. ${state.winner === 'draw' ? 'Both squadrons were eliminated.' : `${title(state.winner)} won the duel.`}`
        );
      } else {
        const completedRound = state.round;
        state.round += 1;
        state.phase = 'planning';
        state.pending = null;
        state.seats.rebel.committed = false;
        state.seats.imperial.committed = false;
        for (const ship of Object.values(state.ships)) {
          ship.maneuver = undefined;
          ship.revealed = false;
          ship.activated = false;
          ship.engaged = false;
          ship.skipAction = false;
          ship.focus = 0;
          ship.evade = 0;
        }
        state.log.push(`Round ${completedRound} ended. Round ${state.round} planning began; circular tokens cleared.`);
      }
      outcome('round', state.phase === 'finished' ? 'GAME COMPLETE' : `ROUND ${state.round} · PLANNING`, []);
      break;
    }
    case 'game/conceded':
      if (event.actor !== 'table' || state.phase === 'lobby' || state.phase === 'finished')
        return reject('This game cannot be conceded now.');
      state.phase = 'finished';
      state.winner = event.payload.seat === 'rebel' ? 'imperial' : 'rebel';
      state.pending = null;
      state.attack = undefined;
      state.log.push(`${event.payload.seat === 'rebel' ? 'Rebel' : 'Imperial'} squad conceded.`);
      break;
    case 'game/rematched':
      return {
        state: {
          ...createInitialState(state.gameId, event.payload.seed),
          revision: event.sequence,
          log: ['Rematch opened.']
        }
      };
  }
  state.revision = event.sequence;
  return { state };
}

export function replay(events: readonly GameEvent[]): { state: GameState; diagnostics: Diagnostic[] } {
  let state = createInitialState();
  const diagnostics: Diagnostic[] = [];
  for (const event of events) {
    const result = applyEvent(state, event);
    state = result.state;
    if (result.diagnostic) diagnostics.push(result.diagnostic);
  }
  return { state, diagnostics };
}
