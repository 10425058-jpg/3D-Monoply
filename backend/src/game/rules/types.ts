// Types for the mini-v1 online rules engine (docs/ONLINE-MVP-RULES.md, docs/GAME-STATE.md).
// This folder is pure TypeScript: no database, no network, no NestJS. Keep it that way so
// every rule can be unit-tested quickly (see backend/test/).

export const MAP_ID = 'central-castle';
export const RULESET_ID = 'mini-v1';
export const CONTENT_VERSION = 'central-castle@1';

export const BOARD_SIZE = 40;
export const GO_SALARY = 200;
export const STARTING_CASH = 1500;
export const JAIL_SPACE = 10;
export const JAIL_BAIL = 50;
export const MAX_JAIL_ATTEMPTS = 3;
export const TURN_LIMIT = 80;
export const MAX_MONEY = 2147483647; // PostgreSQL INTEGER upper bound

export type SpaceType =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'chance'
  | 'chest'
  | 'tax'
  | 'jail'
  | 'free_parking'
  | 'go_to_jail';

export interface BoardSpace {
  id: number;
  name: string;
  type: SpaceType;
  colorGroup: string;
  price?: number;
  rent?: number[];
  taxAmount?: number;
}

export type DeckType = 'chance' | 'chest';

export type CardActionType =
  | 'collect'
  | 'pay'
  | 'move_to'
  | 'move_relative'
  | 'nearest_utility'
  | 'nearest_railroad'
  | 'go_to_jail'
  | 'get_out_of_jail'
  | 'repairs'
  | 'pay_each_player'
  | 'collect_from_each_player';

export interface Card {
  id: string;
  deck: DeckType;
  title: string;
  actionType: CardActionType;
  amount?: number;
  targetSpaceId?: number;
  steps?: number;
  perHouse?: number;
  perHotel?: number;
}

export interface Content {
  version: string;
  spaces: BoardSpace[];
  cards: Card[];
}

export type MatchStatus = 'IN_PROGRESS' | 'PAUSED' | 'FINISHED' | 'ABANDONED';
export type TurnPhase = 'PRE_ROLL' | 'LANDED_ACTION' | 'END_TURN' | 'GAME_OVER';
export type FinishReason = 'LAST_PLAYER' | 'TURN_LIMIT';
export type BankruptReason =
  | 'INSOLVENT_TO_BANK'
  | 'INSOLVENT_TO_PLAYER'
  | 'VOLUNTARY_FORFEIT'
  | 'HOST_FORFEIT_ABSENT';

export type ActionName =
  | 'roll-dice'
  | 'buy-property'
  | 'decline-property'
  | 'end-turn'
  | 'pay-jail-bail'
  | 'use-jail-card'
  | 'forfeit'
  | 'forfeit-player'
  | 'abandon';

export const ACTION_NAMES: ActionName[] = [
  'roll-dice',
  'buy-property',
  'decline-property',
  'end-turn',
  'pay-jail-bail',
  'use-jail-card',
  'forfeit',
  'forfeit-player',
  'abandon',
];

export interface DiceState {
  values: [number, number];
  total: number;
  rolledByPlayerId: string;
}

export interface LastCardResolved {
  cardId: string;
  deck: DeckType;
  playerId: string;
  effects: Array<{ type: string; amount?: number; targetSpaceId?: number }>;
  stateVersion: number;
  resolvedAt: string;
}

export interface EnginePlayer {
  playerId: string;
  seatOrder: number;
  position: number;
  money: number;
  inJail: boolean;
  jailTurns: number;
  heldJailCardIds: string[];
  isBankrupt: boolean;
  finalRank: number | null;
}

/**
 * Full authoritative match state, including the SECRET deck order.
 * Never send this object to a client; the server projects a public MatchState from it.
 */
export interface EngineState {
  status: MatchStatus;
  players: EnginePlayer[]; // always sorted by seatOrder
  /** spaceId -> owner playerId (or null). Only purchasable spaces appear here. */
  owners: Record<number, string | null>;
  currentPlayerId: string | null;
  turnNumber: number;
  completedTurns: number;
  turnPhase: TurnPhase;
  dice: DiceState | null;
  doublesCount: number;
  pendingExtraRoll: boolean;
  pendingPurchaseSpaceId: number | null;
  lastCardResolved: LastCardResolved | null;
  winnerPlayerId: string | null;
  finishReason: FinishReason | null;
  /** Draw piles. Index 0 is the next card. Held Get Out of Jail cards are not in the pile. */
  decks: Record<DeckType, string[]>;
  /** How many cards have been drawn from each deck so far (audit only). */
  drawCounts: Record<DeckType, number>;
}

export interface EngineAction {
  type: ActionName;
  actorPlayerId: string;
  spaceId?: number;
  cardId?: string;
  targetPlayerId?: string;
}

export interface EngineEvent {
  type: string;
  actorPlayerId: string | null;
  payload: Record<string, unknown>;
}

/** Source of randomness. The server uses crypto; tests use a scripted sequence. */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

export interface EngineContext {
  rng: Rng;
  content: Content;
  /** UTC ISO timestamp for this action. */
  now: string;
  /** The stateVersion this action will be committed as. */
  stateVersion: number;
}

export interface EngineResult {
  state: EngineState;
  events: EngineEvent[];
  result: Record<string, unknown>;
}

export type RuleErrorCode =
  | 'NOT_YOUR_TURN'
  | 'INVALID_PHASE'
  | 'INVALID_ACTION'
  | 'INSUFFICIENT_FUNDS'
  | 'MATCH_PAUSED'
  | 'MATCH_ALREADY_TERMINAL'
  | 'PLAYER_NOT_ELIGIBLE_FOR_FORFEIT';

export class RuleError extends Error {
  code: RuleErrorCode;
  constructor(code: RuleErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'RuleError';
  }
}
