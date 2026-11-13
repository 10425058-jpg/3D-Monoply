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
