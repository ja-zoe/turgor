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
  Permission.MANAGE_CALENDAR,
  Permission.VIEW_LEAD_MEETINGS,
  Permission.MANAGE_STATUS_UPDATES,
  Permission.MANAGE_MEETING_RECORDS,
  Permission.DELETE_USERS,
];

const LEAD_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.VIEW_ASSIGNED_PROJECTS,
  Permission.SUBMIT_STATUS_UPDATES,
  Permission.EDIT_OWN_PROJECT,
  Permission.CLOSE_ACTION_ITEMS,
  Permission.VIEW_LEAD_MEETINGS,
];

const VIEWER_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.VIEW_ASSIGNED_PROJECTS,
];

// Eboard: built-in role that can see + manage lead/eboard meetings, with broad
// visibility. (R10.2 will also grant it privileged status-update edit/delete.)
const EBOARD_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.VIEW_ASSIGNED_PROJECTS,
  Permission.VIEW_MONTHLY_REVIEW,
  Permission.MANAGE_CALENDAR,
  Permission.VIEW_LEAD_MEETINGS,
  Permission.MANAGE_STATUS_UPDATES,
];

async function main() {
  console.log("Seeding roles...");

  // Keyed by builtInKey, not name — the PM may rename built-in roles, and a re-run
  // must update the same rows (never recreate them under the default names).
  const builtInRoles: { key: string; defaultName: string; permissions: Permission[] }[] = [
    { key: "pm", defaultName: "Project Manager", permissions: PM_PERMISSIONS },
    { key: "lead", defaultName: "Project Lead", permissions: LEAD_PERMISSIONS },
    { key: "viewer", defaultName: "Viewer", permissions: VIEWER_PERMISSIONS },
    { key: "eboard", defaultName: "Eboard", permissions: EBOARD_PERMISSIONS },
  ];

  for (const { key, defaultName, permissions } of builtInRoles) {
    await prisma.role.upsert({
      where: { builtInKey: key },
      create: { builtInKey: key, name: defaultName, isBuiltIn: true, permissions },
      update: { isBuiltIn: true, permissions },
    });
  }

  console.log("Seeding Settings singleton...");

  await prisma.settings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      weeksBehindMilestone: 1,
      missedGoalsInARow: 2,
      requireBoth: false,
      submissionDeadlineHours: 24,
      orgName: "SEED",
      orgFullName: "Students for Environmental & Energy Development",
      orgInstitution: "Rutgers University–New Brunswick",
      orgLogoUrl: "/seed-logo-transparent.png",
      signInLabel: "Rutgers NetID",
      periodLabel: "Semester",
      themePreset: "forest",
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
