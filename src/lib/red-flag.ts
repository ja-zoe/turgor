import { prisma } from "@/lib/prisma";

/**
 * Evaluates whether a project should be auto-flagged BEHIND based on the
 * Settings singleton thresholds. Returns true if flagged.
 *
 * Condition A: at least one deliverable is incomplete and its targetDate is
 *              more than `weeksBehindMilestone` weeks in the past.
 * Condition B: the last `missedGoalsInARow` meeting records all have goalMet === false.
 * If `requireBoth`, both conditions must be true; otherwise either suffices.
 */
export async function shouldFlagBehind(projectId: string): Promise<boolean> {
  const [settings, project] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        statusOverride: true,
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

  // Never auto-flag when PM has manually overridden
  if (!project || project.statusOverride) return false;

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
  projectId: string
): Promise<"ON_TRACK" | "AT_RISK" | "BEHIND"> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true, statusOverride: true },
  });
  if (!project || project.statusOverride) return project?.status ?? "ON_TRACK";

  const flagged = await shouldFlagBehind(projectId);
  if (flagged && project.status !== "BEHIND") {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "BEHIND" },
    });
    return "BEHIND";
  }
  return project.status;
}
