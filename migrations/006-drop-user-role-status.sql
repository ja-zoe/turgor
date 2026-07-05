-- R35.3 (contract phase) — drop User.roleId and User.status now that global role +
-- activation are per-org on Membership. The data was copied into Membership in the
-- R35.1 expand migration (004); every read moved to the active membership in R35.2/
-- R35.3. This is the destructive half of the expand→migrate→contract rollout.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_roleId_fkey";
ALTER TABLE "User" DROP COLUMN "roleId";
ALTER TABLE "User" DROP COLUMN "status";
