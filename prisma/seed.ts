import "dotenv/config";
import { PrismaClient, Permission } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PM_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.VIEW_ASSIGNED_PROJECTS,
  Permission.SUBMIT_STATUS_UPDATES,
  Permission.EDIT_OWN_PROJECT,
  Permission.POST_MEETING_TRACKING,
  Permission.MANAGE_PROJECTS,
  Permission.MANAGE_MILESTONES,
  Permission.ASSIGN_ACTION_ITEMS,
  Permission.CLOSE_ACTION_ITEMS,
  Permission.VIEW_MONTHLY_REVIEW,
  Permission.CONFIGURE_NOTIFICATIONS,
  Permission.MANAGE_USERS,
  Permission.MANAGE_ROLES,
];

const LEAD_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.VIEW_ASSIGNED_PROJECTS,
  Permission.SUBMIT_STATUS_UPDATES,
  Permission.EDIT_OWN_PROJECT,
  Permission.CLOSE_ACTION_ITEMS,
];

const VIEWER_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.VIEW_ASSIGNED_PROJECTS,
];

async function main() {
  console.log("Seeding roles...");

  await prisma.role.upsert({
    where: { name: "Project Manager" },
    create: { name: "Project Manager", isBuiltIn: true, permissions: PM_PERMISSIONS },
    update: { isBuiltIn: true, permissions: PM_PERMISSIONS },
  });

  await prisma.role.upsert({
    where: { name: "Project Lead" },
    create: { name: "Project Lead", isBuiltIn: true, permissions: LEAD_PERMISSIONS },
    update: { isBuiltIn: true, permissions: LEAD_PERMISSIONS },
  });

  await prisma.role.upsert({
    where: { name: "Viewer" },
    create: { name: "Viewer", isBuiltIn: true, permissions: VIEWER_PERMISSIONS },
    update: { isBuiltIn: true, permissions: VIEWER_PERMISSIONS },
  });

  console.log("Seeding Settings singleton...");

  await prisma.settings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      weeksBehindMilestone: 1,
      missedGoalsInARow: 2,
      requireBoth: false,
      submissionDeadlineHours: 24,
    },
    update: {},
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
