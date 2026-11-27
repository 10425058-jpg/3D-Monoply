import type { IslandTransfer } from '../../presentation/islandMoney';
import { ISLAND_SCALE, PLAYER_ISLANDS, islandPosition } from './playerIslandLayout';
import { coinPieces, type CoinValue } from './royalCoinValues';

type Point = [number, number, number];
type PointTarget = { set(x: number, y: number, z: number): unknown };

// Organized in three groups on the outer paving, with a clear lane in front of the plaque.
export const TREASURY_LAYOUT: Record<CoinValue, { x: number; z: number; radius: number }> = {
  1: { x: -1.59, z: 1.78, radius: .145 }, 5: { x: -1.96, z: 1.50, radius: .152 },
  10: { x: -2.22, z: 1.20, radius: .17 }, 20: { x: -2.33, z: -.43, radius: .17 },
  50: { x: -2.27, z: -.03, radius: .18 }, 100: { x: -2.08, z: .34, radius: .19 },
  500: { x: 1.96, z: 1.34, radius: .232 }, 1000: { x: 2.28, z: .98, radius: .253 },
};

export const MAX_ISLAND_TRANSFERS = 10;
export const MAX_FLIGHT_COINS = 7;
export const COIN_STAGGER_MS = 46;

export type IslandFlight = IslandTransfer & {
  id: number;
  startedAt: number;
  duration: number;
  arrivesAt: number;
  expiresAt: number;
  pieces: CoinValue[];
};

export const islandSeat = (id: number | null) => PLAYER_ISLANDS.find(site => site.seat === id)?.seat ?? null;

export function islandFlight(transfer: IslandTransfer, id: number, now: number, reduced: boolean, low: boolean): IslandFlight | undefined {
  const fromId = islandSeat(transfer.fromId), toId = islandSeat(transfer.toId);
  if (fromId === null && toId === null) return;
  const direct = fromId !== null && toId !== null;
  const across = direct && Math.abs(toId - fromId) === 2;
  const pieces = reduced ? [] : coinPieces(transfer.amount, low ? 4 : MAX_FLIGHT_COINS);
  const duration = direct ? (across ? 1160 : 960) : 720;
  const arrivesAt = pieces.length ? now + duration + (pieces.length - 1) * COIN_STAGGER_MS : now;
  return { fromId, toId, amount: transfer.amount, id, startedAt: now, duration, arrivesAt,
    expiresAt: Math.max(now + 1320, arrivesAt + 820), pieces };
}

export function liveIslandFlights(flights: readonly IslandFlight[], now: number) {
  return flights.filter(flight => flight.expiresAt > now).slice(-MAX_ISLAND_TRANSFERS);
}

function treasuryPoint(seat: number, value: CoinValue): Point {
  const [x, y, z] = islandPosition(PLAYER_ISLANDS[seat]);
  const pocket = TREASURY_LAYOUT[value];
  return [x + pocket.x * ISLAND_SCALE, y + .25, z + pocket.z * ISLAND_SCALE];
}

const smooth = (edge0: number, edge1: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** A direct transfer takes the shorter arc in open air, including opposite board edges. */
export function coinFlightPath(fromId: number | null, toId: number | null, value: CoinValue, lane: number) {
  const seat = (toId ?? fromId)!;
  const target = treasuryPoint(seat, value);
  if (fromId === null || toId === null) {
    const [dx, dz] = PLAYER_ISLANDS[seat].direction;
    const outward = 3.1 + lane * .16;
    return (progress: number, point: PointTarget) => {
      const t = smooth(0, 1, progress);
      const distance = (fromId === null ? 1 - t : t) * outward;
      const arc = Math.sin(t * Math.PI);
      point.set(target[0] + dx * distance - dz * arc * .57,
        target[1] + arc * (1.22 + lane * .08) + (fromId === null ? (1 - t) * .65 : -t * .64),
        target[2] + dz * distance + dx * arc * .57);
    };
  }

  const start = treasuryPoint(fromId, value);
  const bearing = Math.atan2(start[2], start[0]);
  const delta = Math.atan2(target[2], target[0]) - bearing;
  const sweep = Math.atan2(Math.sin(delta), Math.cos(delta));
  const fromRadius = Math.hypot(start[0], start[2]), toRadius = Math.hypot(target[0], target[2]);
  const outerRadius = 20.85 + lane * .21;
  return (t: number, point: PointTarget) => {
    const turn = smooth(.065, .935, t);
    const angle = bearing + sweep * turn;
    const radius = fromRadius + (outerRadius - fromRadius) * smooth(0, .245, t) +
      (toRadius - outerRadius) * smooth(.755, 1, t);
    const height = start[1] + (target[1] - start[1]) * t + (2.1 + lane * .06) * Math.sin(Math.PI * t);
    point.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  };
}
