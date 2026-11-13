-- Step 2 operations maintenance indexes. No rows are dropped by migration.
-- Session cleanup deletes only already expired or older revoked sessions.
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");
CREATE INDEX "user_sessions_revoked_at_idx" ON "user_sessions"("revoked_at");
