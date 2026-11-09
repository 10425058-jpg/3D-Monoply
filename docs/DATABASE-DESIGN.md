# 3D Monopoly — Database Design

**Status:** Draft proposal for team review  
**Database:** PostgreSQL  
**ORM:** Prisma

This is a proposed relational model for the first online release. It is not a migration and does not create tables. Backend developers should review relationships, indexes, deletion policies, and constraints before writing Prisma schema/migrations.

## 1. Design principles

- Use UUIDs (or another consistent opaque string ID strategy) for persistent entities.
- Store timestamps in UTC.
- Store money and experience as integers.
- Never store plaintext passwords; store a strong password hash (Argon2id or bcrypt with appropriate parameters).
- Do not persist ephemeral UI state such as camera position, hover, modal state, or animation progress.
- Avoid duplicating derivable values unless needed for performance or historical snapshots.
- Use transactions for money transfers, property ownership changes, and other multi-row state changes.

## 2. Core tables

### users

| Column | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| username | VARCHAR(24) | Unique, required |
| email | VARCHAR(255) | Unique, required |
| password_hash | TEXT | Required; never returned to client |
| avatar_url | TEXT | Nullable |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

### player_profiles

| Column | Type | Rules |
|---|---|---|
| user_id | UUID | Primary key + FK users.id |
| level | INTEGER | Default 1, nonnegative |
| experience | BIGINT | Default 0, nonnegative |
| coins | BIGINT | Default 0, nonnegative |
| wins | INTEGER | Default 0 |
| losses | INTEGER | Default 0 |
| selected_token | VARCHAR(64) | Nullable |
| updated_at | TIMESTAMPTZ | Required |

### rooms

| Column | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| host_user_id | UUID | FK users.id |
| status | VARCHAR / ENUM | WAITING, IN_PROGRESS, CLOSED |
| map_id | VARCHAR(80) | Required |
| max_players | SMALLINT | Proposed 2–4 |
| is_private | BOOLEAN | Default false |
| invite_code_hash | TEXT | Nullable; do not store raw secret invite code if avoidable |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

### room_members

| Column | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| room_id | UUID | FK rooms.id |
| user_id | UUID | FK users.id |
| is_host | BOOLEAN | Default false |
| is_ready | BOOLEAN | Default false |
| joined_at | TIMESTAMPTZ | Required |
| left_at | TIMESTAMPTZ | Nullable |

Constraint: one active membership per user per room; add an appropriate partial unique index or enforce in transaction logic.

### matches

| Column | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| room_id | UUID | FK rooms.id |
| status | VARCHAR / ENUM | IN_PROGRESS, FINISHED, ABANDONED |
| map_id | VARCHAR(80) | Required |
| ruleset_id | VARCHAR(80) | Required |
| current_player_id | UUID | Nullable FK match_players.id (cyclic FK may be added after table creation) |
| turn_number | INTEGER | Default 1 |
| turn_phase | VARCHAR(40) | Required |
| state_version | BIGINT | Default 0 |
| winner_player_id | UUID | Nullable |
| started_at | TIMESTAMPTZ | Required |
| ended_at | TIMESTAMPTZ | Nullable |

### match_players

| Column | Type | Rules |
|---|---|---|
| id | UUID | Primary key; online player/seat ID |
| match_id | UUID | FK matches.id |
| user_id | UUID | FK users.id; nullable only if server AI seats are supported |
| seat_order | SMALLINT | Required |
| username_snapshot | VARCHAR(24) | Required |
| token | VARCHAR(64) | Required |
| color | VARCHAR(16) | Required |
| position | SMALLINT | Default 0 |
| money | BIGINT | Default 1500 |
| in_jail | BOOLEAN | Default false |
| jail_turns | SMALLINT | Default 0 |
| is_bankrupt | BOOLEAN | Default false |
| final_rank | SMALLINT | Nullable |

Constraint: unique (match_id, seat_order); define whether one user may occupy only one seat per match.

### properties (optional catalog table)

If board content is maintained in code/config, a separate catalog table is not required initially. If persisted, fields could include:

| Column | Type | Rules |
|---|---|---|
| id | BIGINT / INTEGER | Stable board space ID |
| map_id | VARCHAR(80) | Required |
| name | VARCHAR(120) | Required |
| type | VARCHAR(32) | Required |
| price | INTEGER | Nullable |
| group_id | VARCHAR(80) | Nullable |

### property_ownerships

| Column | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| match_id | UUID | FK matches.id |
| space_id | INTEGER | Stable board space ID |
| owner_player_id | UUID | Nullable FK match_players.id |
| houses | SMALLINT | Default 0 |
| is_mortgaged | BOOLEAN | Default false |
| updated_at | TIMESTAMPTZ | Required |

Constraint: unique (match_id, space_id).

### game_events

Append-only event/audit log for important state changes.

| Column | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| match_id | UUID | FK matches.id |
| sequence | BIGINT | Required; unique per match |
| actor_player_id | UUID | Nullable FK match_players.id |
| event_type | VARCHAR(80) | Required |
| payload | JSONB | Required; validated server-side |
| created_at | TIMESTAMPTZ | Required |

Constraint: unique (match_id, sequence). Avoid putting secrets or unnecessary personal data in event payloads.

## 3. Optional tables for later releases

| Table | Purpose |
|---|---|
| refresh_tokens / sessions | Revocable login sessions |
| trades | Trade proposals and decisions |
| auctions | Auction state/history if not stored in event log |
| inventory_items | Player-owned skins/items |
| achievements | Achievement definitions |
| user_achievements | User progress/unlocks |
| match_results | Query-friendly historical results (may be derived from matches) |
| leaderboard_snapshots | Optional cached ranking snapshots |

Do not add all optional tables before their features are approved.

## 4. Relationship overview

```text
users 1 ─── 1 player_profiles
users 1 ─── many room_members
rooms 1 ─── many room_members
rooms 1 ─── many matches (or 1 if product rules require)
matches 1 ─── many match_players
users 1 ─── many match_players
matches 1 ─── many property_ownerships
match_players 1 ─── many property_ownerships (as owner)
matches 1 ─── many game_events
```

## 5. Transaction and consistency requirements

Use database transactions for at least:

- Deducting a purchase price and assigning property ownership.
- Transferring rent between players.
- Accepting a trade involving cash and/or properties.
- Resolving an auction winner and payment.
- Applying rewards that update both a balance and a claim record.

Use row locking or optimistic concurrency/version checks to prevent two simultaneous commands from spending the same money or buying the same property.

## 6. Index recommendations

- `users(email)` unique.
- `users(username)` unique.
- `room_members(room_id, user_id)`.
- `matches(room_id, status)`.
- `match_players(match_id, seat_order)` unique.
- `property_ownerships(match_id, space_id)` unique.
- `game_events(match_id, sequence)` unique.

Add indexes based on actual query patterns after implementation.

## 7. Retention and privacy

- Define a policy for account deletion and match-history retention.
- Do not store access tokens in plaintext.
- Restrict access to private room and match records.
- Do not expose password hashes, invite secrets, or internal event metadata in API responses.
- Use environment variables/secrets management for database credentials.
