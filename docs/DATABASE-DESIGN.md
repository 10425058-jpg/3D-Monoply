# 3D Monopoly — Database Contract v1.1.2

**Status:** Proposed schema baseline; SQL/Prisma migrations not executed.
**Rules:** [ONLINE-MVP-RULES.md](./ONLINE-MVP-RULES.md) | **API:** [API-CONTRACT.md](./API-CONTRACT.md) | **State:** [GAME-STATE.md](./GAME-STATE.md)

## 1. Types and constraints

Use PostgreSQL + Prisma. Opaque entity IDs are UUIDs. Money **INTEGER NOT NULL CHECK(money >= 0)**, max PostgreSQL 2147483647; API/TypeScript `number` with server-side integer/boundary validation, no monetary BIGINT. Timestamps are UTC TIMESTAMPTZ. Immutable game events and action result must be transactionally written with match/player/property state, so crashes and retries cannot roll twice.

## 2. Tables — required in online mini-v1

**users**
`id UUID PK, username VARCHAR(24) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash TEXT NOT NULL, avatar_url TEXT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL`.

**user_sessions**
`id UUID PK, user_id UUID REFERENCES users(id), refresh_token_hash TEXT UNIQUE NOT NULL, csrf_token_hash TEXT NOT NULL, rotated_from_id UUID NULL REFERENCES user_sessions(id), expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL`. Refresh is rotated atomically and limited to 7 days maximum. No raw refresh token or raw CSRF secret persisted. Client receives refresh via HttpOnly cookie, CSRF token via login/register or bootstrap; see API contract.

**rooms**
`id UUID PK, host_user_id UUID REFERENCES users(id), status VARCHAR(20) NOT NULL, map_id VARCHAR(80) NOT NULL, max_players SMALLINT NOT NULL CHECK(max_players BETWEEN 2 AND 4), is_private BOOLEAN NOT NULL DEFAULT false, invite_code_hash TEXT NULL, room_revision INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL`. Only the **one-time response** to creating private room (or rotating invite code) contains raw invite code; DB stores hash. Host change is transactionally synchronized with membership.

**room_members**
`id UUID PK, room_id UUID REFERENCES rooms(id), user_id UUID REFERENCES users(id), seat_order SMALLINT NOT NULL CHECK(seat_order BETWEEN 0 AND 3), token VARCHAR(64) NOT NULL, color VARCHAR(16) NOT NULL, is_ready BOOLEAN NOT NULL DEFAULT false, is_host BOOLEAN NOT NULL DEFAULT false, joined_at TIMESTAMPTZ NOT NULL, left_at TIMESTAMPTZ NULL`. Enforce one active membership per (room,user) and active (room,seat_order); each seat maps to a fixed token/color palette in GAME-STATE.md. A seat freed before match start can be reused. Once match starts, copy seat metadata to match_players and freeze seat order. Host must be consistently present; host implied ready. Room revision increments on membership/ready/host changes.

**matches**
```sql
id UUID PRIMARY KEY,
room_id UUID NOT NULL UNIQUE REFERENCES rooms(id),
status VARCHAR(20) NOT NULL, -- IN_PROGRESS, PAUSED, FINISHED, ABANDONED
map_id VARCHAR(80) NOT NULL,
ruleset_id VARCHAR(80) NOT NULL, -- mini-v1
content_version VARCHAR(80) NOT NULL, -- central-castle@1
current_player_id UUID NULL, -- match_players FK added after tables
turn_number INTEGER NOT NULL DEFAULT 1,
completed_turns INTEGER NOT NULL DEFAULT 0,
turn_phase VARCHAR(40) NOT NULL,
state_version INTEGER NOT NULL DEFAULT 0,
dice_state JSONB NULL,
last_card_resolved JSONB NULL, -- public LastCardResolved, null until first card
doubles_count SMALLINT NOT NULL DEFAULT 0,
pending_extra_roll BOOLEAN NOT NULL DEFAULT false,
pending_purchase_space_id INTEGER NULL,
winner_player_id UUID NULL, -- match_players FK added after tables
finish_reason VARCHAR(24) NULL, -- LAST_PLAYER | TURN_LIMIT
paused_at TIMESTAMPTZ NULL,
pause_reason VARCHAR(80) NULL,
all_players_offline_since TIMESTAMPTZ NULL,
started_at TIMESTAMPTZ NOT NULL,
updated_at TIMESTAMPTZ NOT NULL,
ended_at TIMESTAMPTZ NULL
```
`current_player_id` must be non-null in IN_PROGRESS/PAUSED (CHECK or transactional app invariant) and becomes null in FINISHED/ABANDONED. Winner nullable on ABANDONED, required on FINISHED. `pending_purchase_space_id` non-null only during LANDED_ACTION. Match remains PAUSED until all eligible participants reconnect, a connected host resolves overdue absences or abandons, or 24h all-offline auto-abandon occurs (see §6).

**match_players**
`id UUID PK, match_id UUID REFERENCES matches(id), user_id UUID NOT NULL REFERENCES users(id), seat_order SMALLINT NOT NULL, username_snapshot VARCHAR(24) NOT NULL, token VARCHAR(64) NOT NULL, color VARCHAR(16) NOT NULL, position SMALLINT NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 39), money INTEGER NOT NULL DEFAULT 1500 CHECK(money >= 0), in_jail BOOLEAN NOT NULL DEFAULT false, jail_turns SMALLINT NOT NULL DEFAULT 0, held_jail_card_ids JSONB NOT NULL DEFAULT '[]', is_bankrupt BOOLEAN NOT NULL DEFAULT false, connection_status VARCHAR(16) NOT NULL DEFAULT 'CONNECTED', disconnected_at TIMESTAMPTZ NULL, final_rank SMALLINT NULL`. Unique (match_id,seat_order) and (match_id,user_id); no server AI seats in mini-v1. Held Jail card IDs are validated as string arrays.

**Board/card contracts and materialized snapshots**
`last_card_resolved` stores only the **most recently revealed** card and public effects as `LastCardResolved`. Deck order remains private in `match_decks`. `allowedActions` is computed **per authenticated viewer** by the online rules engine and is **not a database column**. `turn_number` starts 1 and increments when a new participant turn begins; `completed_turns` starts 0 and increases once when a player turn fully ends, not on doubles. See GAME-STATE.md.

**property_ownerships**
`id UUID PK, match_id UUID REFERENCES matches(id), space_id INTEGER NOT NULL, owner_player_id UUID NULL REFERENCES match_players(id), houses SMALLINT NOT NULL DEFAULT 0 CHECK(houses = 0), is_mortgaged BOOLEAN NOT NULL DEFAULT false CHECK(is_mortgaged = false), updated_at TIMESTAMPTZ NOT NULL`. Unique (match_id,space_id). Owner must be participant in same match. These check constraints are for mini-v1 and require migration when adding buildings/mortgages in future rulesets.

**match_decks**
`id UUID PK, match_id UUID REFERENCES matches(id), deck_type VARCHAR(16) NOT NULL, ordered_card_ids JSONB NOT NULL, draw_cursor INTEGER NOT NULL DEFAULT 0, returned_card_ids JSONB NOT NULL DEFAULT '[]', updated_at TIMESTAMPTZ NOT NULL`. Unique (match_id,deck_type). Persist private shuffled deck state; card ID held by player removed from draw pool; when used, return to bottom. JSONB schema validated by backend against versioned cards catalog. **Never send deck order** in public snapshots.

**processed_actions**
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
UNIQUE(match_id,client_action_id)
```
Check processed action (same actor + canonical request hash) **before** expected state version; duplicate gets original response, mismatched reuse gets 409 INVALID_ACTION. Unique constraint and transaction locking protect simultaneous retries.

**game_events**
`id UUID PK, match_id UUID REFERENCES matches(id), sequence INTEGER NOT NULL, state_version INTEGER NOT NULL, actor_player_id UUID NULL REFERENCES match_players(id), event_type VARCHAR(80) NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL`. Unique (match_id,sequence). Each committed action increments match state version **once**, multiple events may share it; sequenced events provide ordered broadcast and dedup IDs. A durable outbox is recommended; clients always support snapshot recovery.

## 3. Mutation and presence transaction rules

- Check session + authorized room/match, validate payload and nonce, query processed_actions first, then content/expected version and phase. Lock match row (or optimistic transaction with retry) during command; commit money transfers, property change, deck draw, completedTurns, stateVersion, processed_actions and game_events atomically.
- Rent/payment insolvency causes **immediate bankruptcy** per ONLINE-MVP-RULES; no negative balances or inaccessible DEBT_RESOLUTION. Pay remaining cash and transfer/unown deeds within one transaction.
- On socket disconnect, persist presence only when last active socket is gone; `disconnected_at` starts 120-second grace. Once expired, persist status PAUSED; when all solvent/active player connections return, atomically set IN_PROGRESS and emit resumed. No automatic forfeiture solely from timeout; connected current host may deliberately forfeit an overdue player after grace, and all-offline 24h triggers abandonment.
- For match finish, persist winner, finishReason, endedAt and null currentPlayerId. For abandon, set ABANDONED with null winner and currentPlayerId. A match whose player reconnects cannot overwrite terminal status.
- Health `GET /api/v1/health` returns 503 DEPENDENCY_UNAVAILABLE when DB down.
- Validate user/session lifespan; refresh cookie + CSRF. Store only hashed invite code (one-time plaintext response to host), token hashes, password hashes and no secrets in game events.

## 4. Deferred data

Advanced online auctions/trades/mortgages/building/debt and profile progression are **not** enabled in mini-v1. Later ruleset releases add dedicated tables or versioned fields and migrations, not undocumented nullable JSONB assumptions. All player ID foreign keys require same-match integrity checks beyond basic FK.

## 5. Migration verification

Tests required: unsigned/overdrawn money rejected by DB, card deck persistence/replay, duplicate action unique conflict, stale replay returns original response, simultaneous rolls commit once, reconnect after restart restores turn and pause, terminal statuses nullable currentPlayerId, rooms hash invite code and refresh cookie/CSRF lifecycle.

## 6. Match/room relation, host failover and durable deadlines

- **Single canonical relation:** `matches.room_id UUID NOT NULL UNIQUE REFERENCES rooms(id)` is the only stored room↔match foreign key (one match per room in mini-v1). **No `rooms.match_id` column.** `RoomState.matchId` is computed by an indexed lookup on `matches.room_id` or null. Room closure updates `rooms.status=CLOSED` and the match terminal state atomically; query final results through that same association. This avoids competing two-way references.
- `matches.all_players_offline_since TIMESTAMPTZ NULL` (defined above) records when **last** eligible player goes offline and resets on reconnect. Background scheduling uses this persisted timestamp to auto-abandon only after 24 continuous hours. Recheck and commit terminal state using a transaction; never rely only on an in-memory timer.
- In IN_PROGRESS/PAUSED, host offline >=120 seconds transfers authority atomically to connected solvent participant with lowest `seat_order`. Update `rooms.host_user_id`, exactly one active `room_members.is_host`, `room_revision` and log/broadcast changes. If no candidate exists, elect on next eligible reconnect. Host-forced forfeit requires a transactionally rechecked target still offline >=120 seconds and a connected, current host.
- `processed_actions` and game_events are part of the same atomic transaction for host-forfeit and abandon under `/actions/`. Terminal match clears `current_player_id` and closes room. Check status before applying retries/new commands; only exact prior command ID replay is allowed if completed before terminal transition.
- **Migrations and tests:** enforce `UNIQUE(matches.room_id)`, `UNIQUE(active room_members.room_id,seat_order)` (partial index), fixed seat palette, valid `last_card_resolved` JSON schema, correct counters, 24-hour restart-safe expiry, host change, and terminal room association. Add `matches.current_player_id` player FK only after match_players exists; its cyclic **player** FK is separate from room-match association.
