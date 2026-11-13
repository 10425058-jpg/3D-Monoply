export type OnlineToken = 'rubber_duck' | 'cat' | 'racecar' | 'yacht';
export interface User { id: string; username: string; email: string; avatarUrl: string | null; createdAt: string }
export interface SessionTokens { accessToken: string; csrfToken: string; expiresIn: number }
export interface AuthResponse extends SessionTokens { user: User }
export interface RoomMember {
  userId: string; username: string; avatarUrl: string | null; seatOrder: number;
  token: OnlineToken; color: string; isReady: boolean; isHost: boolean;
}
export interface Room {
  roomId: string; roomRevision: number; status: 'WAITING' | 'IN_PROGRESS' | 'CLOSED';
  hostUserId: string; mapId: 'central-castle'; maxPlayers: number; isPrivate: boolean;
  members: RoomMember[]; matchId: string | null;
}
export interface RoomSummary { roomId: string; mapId: string; memberCount: number; maxPlayers: number; status: 'WAITING' }
export interface RoomPage { items: RoomSummary[]; nextCursor: string | null }
export type ActionName = 'roll-dice' | 'buy-property' | 'decline-property' | 'end-turn' |
  'pay-jail-bail' | 'use-jail-card' | 'forfeit' | 'forfeit-player' | 'abandon';
export interface OnlinePlayer {
  playerId: string; userId: string; username: string; avatarUrl: string | null;
  token: OnlineToken; color: string; seatOrder: number; position: number; money: number;
  inJail: boolean; jailTurns: number; heldJailCardIds: string[]; isBankrupt: boolean;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED'; disconnectedAt: string | null;
}
export interface Match {
  matchId: string; roomId: string; status: 'IN_PROGRESS' | 'PAUSED' | 'FINISHED' | 'ABANDONED';
  mapId: 'central-castle'; rulesetId: 'mini-v1'; contentVersion: 'central-castle@1';
  players: OnlinePlayer[];
  properties: { spaceId: number; ownerPlayerId: string | null; houses: number; isMortgaged: boolean }[];
  currentPlayerId: string | null; turnNumber: number; completedTurns: number;
  turnPhase: 'PRE_ROLL' | 'LANDED_ACTION' | 'END_TURN' | 'GAME_OVER';
  dice: { values: [number, number]; total: number; rolledByPlayerId: string } | null;
  doublesCount: number; pendingExtraRoll: boolean; pendingPurchaseSpaceId: number | null;
  lastCardResolved: { cardId: string; deck: 'chance' | 'chest'; playerId: string;
    effects: { type: string; amount?: number; targetSpaceId?: number }[]; stateVersion: number; resolvedAt: string } | null;
  allowedActions: ActionName[]; winnerPlayerId: string | null; finishReason: 'LAST_PLAYER' | 'TURN_LIMIT' | null;
  stateVersion: number; pausedAt: string | null; pauseReason: string | null;
  allPlayersOfflineSince: string | null; startedAt: string; updatedAt: string;
  standings?: { playerId: string; rank: number; money: number; netWorth: number }[];
}
export interface ActionBody { clientActionId: string; expectedStateVersion: number; contentVersion: string;
  spaceId?: number; cardId?: string; targetPlayerId?: string }
export interface ActionReceipt { actionId: string; matchId: string; stateVersion: number; status: Match['status'];
  events: { type: string; payload: Record<string, unknown> }[] }
export interface EventPayloads {
  'room:snapshot': Room;
  'room:updated': Room;
  'room:host_changed': { roomId: string; previousHostUserId: string; newHostUserId: string; roomRevision: number };
  'match:started': { matchId: string; stateVersion: number };
  'match:snapshot': Match;
  'game:dice_rolled': { playerId: string; dice: [number, number]; total: number; fromPosition: number; toPosition: number };
  'game:player_moved': { playerId: string; fromPosition: number; toPosition: number; passedGo: boolean };
  'game:property_purchased': { playerId: string; spaceId: number; price: number; balance: number };
  'game:rent_paid': { payerPlayerId: string; ownerPlayerId: string; spaceId: number; amount: number };
  'game:money_changed': { playerId: string; amount: number; balance: number; reason: string };
  'game:card_resolved': { playerId: string; cardId: string; deck: string; effects: unknown[]; resolvedAt: string };
  'game:jail_changed': { playerId: string; inJail: boolean; jailTurns: number };
  'game:turn_changed': { currentPlayerId: string | null; turnPhase: string };
  'game:paused': { pausedAt: string; reason: string };
  'game:resumed': { matchId: string; stateVersion: number };
  'game:player_bankrupt': { playerId: string; creditorPlayerId: string | null; reason: string };
  'game:finished': { winnerPlayerId: string; finishReason: string; standings: { playerId: string; rank: number; netWorth: number }[] };
  'game:abandoned': { reason: string };
  'player:connection_changed': { playerId: string; connectionStatus: string; disconnectedAt: string | null };
}
export interface Envelope<T = unknown> { eventId: string; occurredAt: string; payload: T;
  roomId?: string; matchId?: string; stateVersion?: number; sequence?: number }
export type Connection = 'connecting' | 'connected' | 'reconnecting' | 'offline';
