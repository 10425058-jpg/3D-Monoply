# 3D Monopoly — PostgreSQL Database Design v1.0.0

**Status:** Canonical schema specification for review; migrations are not implemented by this document.
**ORM:** Prisma | **API:** [API-CONTRACT.md](./API-CONTRACT.md) | **Types:** [GAME-STATE.md](./GAME-STATE.md)

## 1. Global conventions

Use UUID or opaque strings consistently for user, room, match, match-player and action IDs. UTC `TIMESTAMPTZ`. **Money, coins and experience use PostgreSQL `INTEGER`** (range -2147483648..2147483647), serialized as JSON/TypeScript `number` and validated as safe integers within this range; **never use `BIGINT` for v1 monetary fields**. Game-state version and event sequence are `INTEGER` with checked overflow (perform a documented migration if future limits require BIGINT). All balance-changing writes use database transactions and server authorization.

## 2. Core tables

### users
`id UUID PK, username VARCHAR(24) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash TEXT NOT NULL, avatar_url TEXT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL`. Password hashing: Argon2id or bcrypt with reviewed parameters; never return hash.

### user_sessions
`id UUID PK, user_id UUID FK users(id), refresh_token_hash TEXT UNIQUE NOT NULL, rotated_from_id UUID NULL FK user_sessions(id), expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL`. Refresh token itself never stored plaintext. Rotation and revoke are transactional. The CSRF token or its session-bound verification data must also be managed securely; no password/hash exposed by API.

### player_profiles (not required for 21-day multiplayer MVP)
`user_id UUID PK/FK users(id), level INTEGER DEFAULT 1, experience INTEGER DEFAULT 0, coins INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, selected_token VARCHAR(64) NULL, updated_at TIMESTAMPTZ NOT NULL`. Progression updates are **deferred**; no need to create table in first migration.

### rooms
`id UUID PK, host_user_id UUID FK users(id), status VARCHAR(20) NOT NULL, map_id VARCHAR(80) NOT NULL, max_players SMALLINT NOT NULL CHECK (max_players BETWEEN 2 AND 4), is_private BOOLEAN NOT NULL DEFAULT FALSE, invite_code_hash TEXT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL`.

### room_members
`id UUID PK, room_id UUID FK rooms(id), user_id UUID FK users(id), is_ready BOOLEAN NOT NULL DEFAULT FALSE, is_host BOOLEAN NOT NULL DEFAULT FALSE, joined_at TIMESTAMPTZ NOT NULL, left_at TIMESTAMPTZ NULL`. Unique active `(room_id,user_id)`; on host departure transfer to oldest active member or close empty room. Ensure `rooms.host_user_id` and active member host markers remain consistent transactionally.

### matches
```sql
id UUID PRIMARY KEY,
room_id UUID NOT NULL REFERENCES rooms(id),
status VARCHAR(20) NOT NULL, -- IN_PROGRESS | PAUSED | FINISHED | ABANDONED
map_id VARCHAR(80) NOT NULL,
ruleset_id VARCHAR(80) NOT NULL,
content_version VARCHAR(80) NOT NULL, -- central-castle@1
current_player_id UUID NULL, -- FK match_players(id) added after initial table creation
turn_number INTEGER NOT NULL DEFAULT 1,
turn_phase VARCHAR(40) NOT NULL,
state_version INTEGER NOT NULL DEFAULT 0,
dice_state JSONB NULL,       -- {values:[3,4],total:7,rolledByPlayerId:"..."}
doubles_count SMALLINT NOT NULL DEFAULT 0,
auction_state JSONB NULL,    -- canonical AuctionState, deferred feature
pending_trade_state JSONB NULL, -- canonical TradeState, deferred feature
pending_debt_state JSONB NULL,  -- canonical PendingDebtState, deferred feature
winner_player_id UUID NULL, -- FK match_players(id) added after initial table creation
paused_at TIMESTAMPTZ NULL,
pause_reason VARCHAR(80) NULL,
started_at TIMESTAMPTZ NOT NULL,
updated_at TIMESTAMPTZ NOT NULL,
ended_at TIMESTAMPTZ NULL
```
The JSONB columns are **durable**, schema-validated by application code with tested read/write round trips. Deferred feature state is nullable (null at MVP). Enforce member/match consistency of player FKs and validate allowed phases.

### match_players
`id UUID PK, match_id UUID FK matches(id), user_id UUID NOT NULL FK users(id), seat_order SMALLINT NOT NULL, username_snapshot VARCHAR(24) NOT NULL, token VARCHAR(64) NOT NULL, color VARCHAR(16) NOT NULL, position SMALLINT NOT NULL DEFAULT 0, money INTEGER NOT NULL DEFAULT 1500, in_jail BOOLEAN NOT NULL DEFAULT FALSE, jail_turns SMALLINT NOT NULL DEFAULT 0, is_bankrupt BOOLEAN NOT NULL DEFAULT FALSE, connection_status VARCHAR(16) NOT NULL DEFAULT 'CONNECTED', disconnected_at TIMESTAMPTZ NULL, final_rank SMALLINT NULL`. Constraints unique `(match_id,seat_order)`, unique `(match_id,user_id)`, position 0..39. First online release is humans only; no nullable userId AI seats.

### property_ownerships
`id UUID PK, match_id UUID FK matches(id), space_id INTEGER NOT NULL, owner_player_id UUID NULL FK match_players(id), houses SMALLINT NOT NULL DEFAULT 0, is_mortgaged BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL`. Unique `(match_id,space_id)`; owner must belong to same match. Board catalog is versioned backend data `central-castle@1` and need not be a separate SQL table for MVP.

### processed_actions (required)
```sql
id UUID PRIMARY KEY,
match_id UUID NOT NULL REFERENCES matches(id),
client_action_id UUID NOT NULL,
actor_player_id UUID NOT NULL REFERENCES match_players(id),
request_hash TEXT NOT NULL,
expected_state_version INTEGER NOT NULL,
result_state_version INTEGER NOT NULL,
response_json JSONB NOT NULL,
created_at TIMESTAMPTZ NOT NULL,
UNIQUE (match_id, client_action_id)
```
Enforce idempotency atomically with game-state writes and event recording. On retry: if `(match_id,client_action_id)` exists and request hash matches, return original `response_json` without a new state transition. If payload differs, return `409 INVALID_ACTION`. Guard concurrent duplicates with unique constraint/locking. A command first committed with old expected version must still replay its original response on identical retry before stale-version rejection.

### game_events
`id UUID PK, match_id UUID FK matches(id), sequence INTEGER NOT NULL, state_version INTEGER NOT NULL, actor_player_id UUID NULL FK match_players(id), event_type VARCHAR(80) NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL`. Unique `(match_id,sequence)` and `id`; multiple event rows may share one `state_version`. Client event envelope `eventId` maps to durable row `id`.

## 3. Transaction, consistency and recovery

For accepted action: authenticate/authorize → check idempotency → check content and expected state version → validate rule/phase → transactionally mutate match, players, properties, processed_actions, and game_events → commit → emit Socket.IO notifications (prefer durable outbox/retry; reconnection always uses GET snapshot). Persist transient fields `dice_state`, `doubles_count`, `auction_state`, `pending_trade_state`, `pending_debt_state`, `connection_status`, `disconnected_at`, `paused_at`, `pause_reason` so an app restart can restore the same authoritative state. Never update money/ownership in separate non-atomic transactions. The server alone determines all economic values.

Indexes: `users(email)` and `users(username)` unique; `room_members(room_id,user_id)` active unique; `match_players(match_id,seat_order)` and `(match_id,user_id)` unique; `property_ownerships(match_id,space_id)` unique; `processed_actions(match_id,client_action_id)` unique; `game_events(match_id,sequence)` unique; index `matches(room_id,status)`.

## 4. Security and scope

No plaintext tokens/passwords; no secrets in broadcast event payloads. Profile/meta progression, inventory, leaderboards and other optional systems are outside the 21-day MVP. Migration PR must test numeric boundaries, action replay and crash/reconnect round trips. This document does not create tables by itself.
