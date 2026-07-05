-- R35.4 — bind a personal MCP token to one org. An MCP call has no session, so
-- the token names the org it acts in (set when generated on /account). Nullable:
-- a user with no token has none; a legacy token rebinds on next regeneration.
ALTER TABLE "User" ADD COLUMN "mcpTokenOrgId" TEXT;
