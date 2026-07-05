-- R35.1 — Tenancy foundation (expand phase).
--
-- Introduce Organization (tenant root) + Membership (user<->org, carrying the
-- per-org role + activation status) and denormalize orgId onto every tenant-owned
-- table. Backfill all existing data into one "default" org so a stock/free-tier
-- install behaves identically. This is the EXPAND phase: User.roleId / User.status
-- are KEPT (existing reads still use them) and dropped later in the R35.3 contract
-- migration once reads are repointed at Membership.
--
-- The whole file runs in one transaction (scripts/migrate.ts wraps it).

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roleId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- The single default org for this install. Name inherited from the existing
-- Settings row so branding is unchanged; fixed id 'org_default' for a stable anchor.
INSERT INTO "Organization" ("id", "slug", "name", "createdAt", "updatedAt")
SELECT 'org_default', 'default', COALESCE((SELECT "orgName" FROM "Settings" LIMIT 1), 'Turgor'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP;

-- AlterTable — add orgId nullable, backfill to the default org, then enforce NOT NULL.
ALTER TABLE "Role" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Project" ADD COLUMN "orgId" TEXT;
ALTER TABLE "ProjectAssignment" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Deliverable" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Subtask" ADD COLUMN "orgId" TEXT;
ALTER TABLE "StatusUpdate" ADD COLUMN "orgId" TEXT;
ALTER TABLE "MeetingRecord" ADD COLUMN "orgId" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "orgId" TEXT;
ALTER TABLE "NotificationRule" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "orgId" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "orgId" TEXT;
ALTER TABLE "McpConnection" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "orgId" TEXT;

UPDATE "Role" SET "orgId" = 'org_default';
UPDATE "Project" SET "orgId" = 'org_default';
UPDATE "ProjectAssignment" SET "orgId" = 'org_default';
UPDATE "Deliverable" SET "orgId" = 'org_default';
UPDATE "Subtask" SET "orgId" = 'org_default';
UPDATE "StatusUpdate" SET "orgId" = 'org_default';
UPDATE "MeetingRecord" SET "orgId" = 'org_default';
UPDATE "ActionItem" SET "orgId" = 'org_default';
UPDATE "NotificationRule" SET "orgId" = 'org_default';
UPDATE "Notification" SET "orgId" = 'org_default';
UPDATE "CalendarEvent" SET "orgId" = 'org_default';
UPDATE "McpConnection" SET "orgId" = 'org_default';
UPDATE "Settings" SET "orgId" = 'org_default';

-- One membership per existing user, copying their current role + status into the
-- default org. (roleId/status still live on User during the expand phase.)
INSERT INTO "Membership" ("id", "userId", "orgId", "roleId", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'org_default', u."roleId", u."status", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u;

ALTER TABLE "Role" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ProjectAssignment" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Deliverable" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Subtask" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "StatusUpdate" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "MeetingRecord" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ActionItem" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "NotificationRule" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "CalendarEvent" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "McpConnection" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Settings" ALTER COLUMN "orgId" SET NOT NULL;

-- Settings is now one row per org; drop the legacy singleton default (id becomes a
-- client-side cuid). The existing row keeps its 'singleton' id value.
ALTER TABLE "Settings" ALTER COLUMN "id" DROP DEFAULT;

-- Roles become per-org: global name/builtInKey uniques become composite with orgId.
DROP INDEX "Role_name_key";
DROP INDEX "Role_builtInKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");
CREATE UNIQUE INDEX "Settings_orgId_key" ON "Settings"("orgId");
CREATE UNIQUE INDEX "Role_orgId_name_key" ON "Role"("orgId", "name");
CREATE UNIQUE INDEX "Role_orgId_builtInKey_key" ON "Role"("orgId", "builtInKey");
CREATE INDEX "Role_orgId_idx" ON "Role"("orgId");
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");
CREATE INDEX "ProjectAssignment_orgId_idx" ON "ProjectAssignment"("orgId");
CREATE INDEX "Deliverable_orgId_idx" ON "Deliverable"("orgId");
CREATE INDEX "Subtask_orgId_idx" ON "Subtask"("orgId");
CREATE INDEX "StatusUpdate_orgId_idx" ON "StatusUpdate"("orgId");
CREATE INDEX "MeetingRecord_orgId_idx" ON "MeetingRecord"("orgId");
CREATE INDEX "ActionItem_orgId_idx" ON "ActionItem"("orgId");
CREATE INDEX "NotificationRule_orgId_idx" ON "NotificationRule"("orgId");
CREATE INDEX "Notification_orgId_idx" ON "Notification"("orgId");
CREATE INDEX "CalendarEvent_orgId_idx" ON "CalendarEvent"("orgId");
CREATE INDEX "McpConnection_orgId_idx" ON "McpConnection"("orgId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusUpdate" ADD CONSTRAINT "StatusUpdate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingRecord" ADD CONSTRAINT "MeetingRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "McpConnection" ADD CONSTRAINT "McpConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
