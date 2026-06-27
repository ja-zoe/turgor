import { prisma } from "@/lib/prisma";
import { Channel, NotificationType, TriggerType } from "@/generated/prisma";

interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

async function sendInApp(payloads: NotificationPayload[]) {
  if (payloads.length === 0) return;
  await prisma.notification.createMany({
    data: payloads.map((p) => ({
      userId: p.userId,
      type: p.type,
      title: p.title,
      body: p.body,
      link: p.link ?? null,
    })),
    skipDuplicates: false,
  });
}

async function sendEmail(payloads: NotificationPayload[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || payloads.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: payloads.map((p) => p.userId) } },
    select: { id: true, email: true, name: true },
  });
  const emailMap = new Map(users.map((u) => [u.id, u]));

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? "SEED Tracker <onboarding@resend.dev>";

  await Promise.allSettled(
    payloads.map(async (p) => {
      const user = emailMap.get(p.userId);
      if (!user) return;
      await resend.emails.send({
        from,
        to: user.email,
        subject: p.title,
        html: `<p>${p.body}</p>${p.link ? `<p><a href="${process.env.AUTH_URL ?? ""}${p.link}">View in SEED Tracker</a></p>` : ""}`,
      });
    })
  );
}

async function deliver(channel: Channel, payloads: NotificationPayload[]) {
  if (channel === "IN_APP" || channel === "BOTH") await sendInApp(payloads);
  if (channel === "EMAIL" || channel === "BOTH") await sendEmail(payloads);
}

async function getPMUserIds(): Promise<string[]> {
  const pm = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { permissions: { has: "MANAGE_PROJECTS" } } },
    select: { id: true },
  });
  return pm.map((u) => u.id);
}

export async function getUserManagerIds(): Promise<string[]> {
  const managers = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { permissions: { has: "MANAGE_USERS" } } },
    select: { id: true },
  });
  return managers.map((u) => u.id);
}

export async function notifyNewSignup(newUser: { id: string; name: string | null; email: string }) {
  const recipientIds = await getUserManagerIds();
  if (recipientIds.length === 0) return;
  const name = newUser.name ?? newUser.email.split("@")[0];
  const payloads: NotificationPayload[] = recipientIds.map((userId) => ({
    userId,
    type: NotificationType.USER_SIGNUP,
    title: "New account awaiting approval",
    body: `${name} (${newUser.email}) signed in and is awaiting approval.`,
    link: "/pm/users",
  }));
  await deliver(Channel.BOTH, payloads);
}

async function getProjectLeadUserIds(projectId: string): Promise<string[]> {
  const leads = await prisma.projectAssignment.findMany({
    where: {
      projectId,
      role: { in: ["LEAD", "SUBLEAD"] },
      user: { status: "ACTIVE" },
    },
    select: { userId: true },
  });
  return leads.map((a) => a.userId);
}

async function getAllActiveUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Main cron function — runs all enabled notification rules. */
export async function runNotificationEngine(): Promise<{ fired: number; errors: string[] }> {
  const rules = await prisma.notificationRule.findMany({ where: { enabled: true } });
  let fired = 0;
  const errors: string[] = [];

  for (const rule of rules) {
    try {
      const payloads: NotificationPayload[] = [];
      const nowMs = Date.now();

      // ── MISSING_SUBMISSION ────────────────────────────────────────────────
      if (rule.triggerType === TriggerType.MISSING_SUBMISSION) {
        const windowHours = rule.thresholdHours ?? 24;
        const windowMs = windowHours * 60 * 60 * 1000;
        const cutoff = new Date(nowMs - windowMs);

        // Projects with no status update in the last windowHours hours
        const projects = await prisma.project.findMany({
          where: {
            assignments: { some: { role: { in: ["LEAD", "SUBLEAD"] } } },
            statusUpdates: { none: { submittedAt: { gte: cutoff } } },
          },
          select: { id: true, name: true },
        });

        for (const project of projects) {
          const leadIds = await getProjectLeadUserIds(project.id);
          const pmIds = await getPMUserIds();
          const recipientIds =
            rule.recipients === "PM"
              ? pmIds
              : rule.recipients === "PROJECT_LEADS"
                ? leadIds
                : rule.recipients === "ALL_ACTIVE"
                  ? await getAllActiveUserIds()
                  : [...leadIds, ...pmIds];

          payloads.push(
            ...recipientIds.map((userId) => ({
              userId,
              type: NotificationType.REMINDER,
              title: `Status update missing: ${project.name}`,
              body: `No status update has been submitted for ${project.name} in the last ${windowHours} hours.`,
              link: `/projects/${project.id}/status/new`,
            }))
          );
        }
      }

      // ── PROJECT_BEHIND ────────────────────────────────────────────────────
      if (rule.triggerType === TriggerType.PROJECT_BEHIND) {
        const behindProjects = await prisma.project.findMany({
          where: { status: "BEHIND" },
          select: { id: true, name: true },
        });

        for (const project of behindProjects) {
          const pmIds = await getPMUserIds();
          const leadIds = await getProjectLeadUserIds(project.id);
          const recipientIds =
            rule.recipients === "PM"
              ? pmIds
              : rule.recipients === "PROJECT_LEADS"
                ? leadIds
                : rule.recipients === "ALL_ACTIVE"
                  ? await getAllActiveUserIds()
                  : [...pmIds, ...leadIds];

          payloads.push(
            ...recipientIds.map((userId) => ({
              userId,
              type: NotificationType.PROJECT_BEHIND,
              title: `Project behind: ${project.name}`,
              body: `${project.name} has been flagged as Behind schedule.`,
              link: `/projects/${project.id}`,
            }))
          );
        }
      }

      // ── ACTION_ITEM_DUE ───────────────────────────────────────────────────
      if (rule.triggerType === TriggerType.ACTION_ITEM_DUE) {
        const windowHours = rule.thresholdHours ?? 24;
        const windowEnd = new Date(nowMs + windowHours * 60 * 60 * 1000);

        const dueItems = await prisma.actionItem.findMany({
          where: {
            status: "OPEN",
            ownerId: { not: null },
            deadline: { gte: new Date(), lte: windowEnd },
          },
          include: { project: { select: { id: true, name: true } } },
        });

        for (const item of dueItems) {
          const recipientIds =
            rule.recipients === "PM"
              ? await getPMUserIds()
              : rule.recipients === "ACTION_OWNER" && item.ownerId
                ? [item.ownerId]
                : rule.recipients === "ALL_ACTIVE"
                  ? await getAllActiveUserIds()
                  : item.ownerId
                    ? [item.ownerId]
                    : [];

          payloads.push(
            ...recipientIds.map((userId) => ({
              userId,
              type: NotificationType.ACTION_ITEM,
              title: `Action item due: ${item.project.name}`,
              body: `"${item.description}" is due within ${windowHours} hours.`,
              link: `/projects/${item.project.id}`,
            }))
          );
        }
      }

      // ── GOAL_MISSED ───────────────────────────────────────────────────────
      if (rule.triggerType === TriggerType.GOAL_MISSED) {
        const recentRecords = await prisma.meetingRecord.findMany({
          where: { goalMet: false },
          orderBy: { meetingDate: "desc" },
          distinct: ["projectId"],
          select: { projectId: true, project: { select: { name: true } } },
        });

        for (const record of recentRecords) {
          const pmIds = await getPMUserIds();
          const leadIds = await getProjectLeadUserIds(record.projectId);
          const recipientIds =
            rule.recipients === "PM"
              ? pmIds
              : rule.recipients === "PROJECT_LEADS"
                ? leadIds
                : rule.recipients === "ALL_ACTIVE"
                  ? await getAllActiveUserIds()
                  : pmIds;

          payloads.push(
            ...recipientIds.map((userId) => ({
              userId,
              type: NotificationType.GOAL_MISSED,
              title: `Weekly goal missed: ${record.project.name}`,
              body: `${record.project.name} missed its goal at the most recent meeting.`,
              link: `/projects/${record.projectId}`,
            }))
          );
        }
      }

      if (payloads.length > 0) {
        await deliver(rule.channel, payloads);
        fired += payloads.length;
      }
    } catch (err) {
      errors.push(`Rule ${rule.id} (${rule.triggerType}): ${String(err)}`);
    }
  }

  return { fired, errors };
}
