-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(24) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "csrf_token_hash" TEXT NOT NULL,
    "rotated_from_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "host_user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "map_id" VARCHAR(80) NOT NULL,
    "max_players" SMALLINT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "invite_code_hash" TEXT,
    "room_revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_members" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seat_order" SMALLINT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "color" VARCHAR(16) NOT NULL,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),

    CONSTRAINT "room_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "map_id" VARCHAR(80) NOT NULL,
    "ruleset_id" VARCHAR(80) NOT NULL,
    "content_version" VARCHAR(80) NOT NULL,
    "current_player_id" UUID,
    "turn_number" INTEGER NOT NULL DEFAULT 1,
    "completed_turns" INTEGER NOT NULL DEFAULT 0,
    "turn_phase" VARCHAR(40) NOT NULL,
    "state_version" INTEGER NOT NULL DEFAULT 0,
    "dice_state" JSONB,
    "last_card_resolved" JSONB,
    "doubles_count" SMALLINT NOT NULL DEFAULT 0,
    "pending_extra_roll" BOOLEAN NOT NULL DEFAULT false,
    "pending_purchase_space_id" INTEGER,
    "winner_player_id" UUID,
    "finish_reason" VARCHAR(24),
    "paused_at" TIMESTAMPTZ(6),
    "pause_reason" VARCHAR(80),
    "all_players_offline_since" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_players" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seat_order" SMALLINT NOT NULL,
    "username_snapshot" VARCHAR(24) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "color" VARCHAR(16) NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "money" INTEGER NOT NULL DEFAULT 1500,
    "in_jail" BOOLEAN NOT NULL DEFAULT false,
    "jail_turns" SMALLINT NOT NULL DEFAULT 0,
    "held_jail_card_ids" JSONB NOT NULL DEFAULT '[]',
    "is_bankrupt" BOOLEAN NOT NULL DEFAULT false,
    "connection_status" VARCHAR(16) NOT NULL DEFAULT 'CONNECTED',
    "disconnected_at" TIMESTAMPTZ(6),
    "final_rank" SMALLINT,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_ownerships" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "space_id" INTEGER NOT NULL,
    "owner_player_id" UUID,
    "houses" SMALLINT NOT NULL DEFAULT 0,
    "is_mortgaged" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "property_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_decks" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "deck_type" VARCHAR(16) NOT NULL,
    "ordered_card_ids" JSONB NOT NULL,
    "draw_cursor" INTEGER NOT NULL DEFAULT 0,
    "returned_card_ids" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "match_decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_actions" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "client_action_id" UUID NOT NULL,
    "actor_player_id" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "expected_state_version" INTEGER NOT NULL,
    "result_state_version" INTEGER NOT NULL,
    "response_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_events" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "state_version" INTEGER NOT NULL,
    "actor_player_id" UUID,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "rooms_status_is_private_created_at_idx" ON "rooms"("status", "is_private", "created_at");

-- CreateIndex
CREATE INDEX "room_members_room_id_user_id_idx" ON "room_members"("room_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_room_id_key" ON "matches"("room_id");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_players_match_id_seat_order_key" ON "match_players"("match_id", "seat_order");

-- CreateIndex
CREATE UNIQUE INDEX "match_players_match_id_user_id_key" ON "match_players"("match_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_ownerships_match_id_space_id_key" ON "property_ownerships"("match_id", "space_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_decks_match_id_deck_type_key" ON "match_decks"("match_id", "deck_type");

-- CreateIndex
CREATE UNIQUE INDEX "processed_actions_match_id_client_action_id_key" ON "processed_actions"("match_id", "client_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_events_match_id_sequence_key" ON "game_events"("match_id", "sequence");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_rotated_from_id_fkey" FOREIGN KEY ("rotated_from_id") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_current_player_id_fkey" FOREIGN KEY ("current_player_id") REFERENCES "match_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_player_id_fkey" FOREIGN KEY ("winner_player_id") REFERENCES "match_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_owner_player_id_fkey" FOREIGN KEY ("owner_player_id") REFERENCES "match_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_decks" ADD CONSTRAINT "match_decks_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_actions" ADD CONSTRAINT "processed_actions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_actions" ADD CONSTRAINT "processed_actions_actor_player_id_fkey" FOREIGN KEY ("actor_player_id") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_actor_player_id_fkey" FOREIGN KEY ("actor_player_id") REFERENCES "match_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints not expressible in Prisma schema: keep in migration history.
-- CHECK constraints from docs/DATABASE-DESIGN.md that Prisma's schema language cannot express.
-- Safe to run more than once. Apply after every `prisma migrate dev` / `prisma migrate deploy`:
--   npm run db:constraints

ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_max_players_check";
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_max_players_check" CHECK ("max_players" BETWEEN 2 AND 4);

ALTER TABLE "room_members" DROP CONSTRAINT IF EXISTS "room_members_seat_order_check";
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_seat_order_check" CHECK ("seat_order" BETWEEN 0 AND 3);

ALTER TABLE "match_players" DROP CONSTRAINT IF EXISTS "match_players_position_check";
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_position_check" CHECK ("position" BETWEEN 0 AND 39);

ALTER TABLE "match_players" DROP CONSTRAINT IF EXISTS "match_players_money_check";
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_money_check" CHECK ("money" >= 0);

-- mini-v1 has no buildings or mortgages. Remove these two when a later ruleset adds them.
ALTER TABLE "property_ownerships" DROP CONSTRAINT IF EXISTS "property_ownerships_houses_check";
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_houses_check" CHECK ("houses" = 0);

ALTER TABLE "property_ownerships" DROP CONSTRAINT IF EXISTS "property_ownerships_is_mortgaged_check";
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_is_mortgaged_check" CHECK ("is_mortgaged" = false);
