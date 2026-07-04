-- R33.1 — CAS removal + provider simplification. The org-level sign-in mechanism
-- (authProvider) and its button label (signInLabel) are gone: free-tier auth is
-- magic link + optional Google/GitHub OAuth, chosen per deployment via env, not per
-- org in the DB. Both columns are dropped. IF EXISTS keeps this idempotent.
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "authProvider";
ALTER TABLE "Settings" DROP COLUMN IF EXISTS "signInLabel";
