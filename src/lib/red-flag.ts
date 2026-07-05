import { forOrg } from "@/lib/tenant-db";

/**
 * Evaluates whether a project should be auto-flagged BEHIND based on the org's
 * Settings thresholds (R35). Returns true if flagged. Scoped to `orgId` so a
 * project can only ever be evaluated against its own org's data.
 *
 * Condition A: at least one deliverable is incomplete and its targetDate is
 *              more than `weeksBehindMilestone` weeks in the past.
 * Condition B: the last `missedGoalsInARow` meeting records all have goalMet === false.
 * If `requireBoth`, both conditions must be true; otherwise either suffices.
 */
export async function shouldFlagBehind(orgId: string, projectId: string): Promise<boolean> {
  const db = forOrg(orgId);
  const [settings, project] = await Promise.all([
    db.settings.findFirst(),
    db.project.findUnique({
      where: { id: projectId },
      select: {
        statusOverride: true,
        archivedAt: true,
        deliverables: {
          // Backlogged deliverables are deliberately deferred — they don't count as "behind".
          where: { completed: false, backlog: false },
          select: { targetDate: true },
        },
        meetingRecords: {
          orderBy: { meetingDate: "desc" },
          select: { goalMet: true },
        },
      },
    }),
  ]);

  // Never auto-flag when PM has manually overridden, or the project is archived
  if (!project || project.statusOverride || project.archivedAt) return false;

  const weeksBehind = settings?.weeksBehindMilestone ?? 1;
  const missedInARow = settings?.missedGoalsInARow ?? 2;
  const requireBoth = settings?.requireBoth ?? false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBehind * 7);

  const conditionA = project.deliverables.some((d) => d.targetDate < cutoff);

  const recentRecords = project.meetingRecords.slice(0, missedInARow);
  const conditionB =
    recentRecords.length >= missedInARow &&
    recentRecords.every((r) => r.goalMet === false);

  return requireBoth ? conditionA && conditionB : conditionA || conditionB;
}

/** Runs detection and updates project.status if not overridden. Returns new status. */
export async function runRedFlagDetection(
  orgId: string,
  projectId: string
): Promise<"ON_TRACK" | "AT_RISK" | "BEHIND"> {
  const db = forOrg(orgId);
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { status: true, statusOverride: true, archivedAt: true },
  });
  if (!project || project.statusOverride || project.archivedAt) {
    return project?.status ?? "ON_TRACK";
  }

  const flagged = await shouldFlagBehind(orgId, projectId);
  if (flagged && project.status !== "BEHIND") {
    await db.project.update({
      where: { id: projectId },
      data: { status: "BEHIND" },
    });
    return "BEHIND";
  }
  return project.status;
}
