import { prisma } from "@/lib/prisma";
import { forOrg } from "@/lib/tenant-db";
import { getOrgSettings } from "@/lib/org";
import { Channel, NotificationType, TriggerType } from "@/generated/prisma";

interface NotificationPayload {
  orgId: string;
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
      orgId: p.orgId,
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

  // Opted-out users (User.emailNotifications = false) are excluded here, which
  // covers every email path — all senders funnel through sendEmail. In-app
  // delivery is untouched.
  const users = await prisma.user.findMany({
    where: { id: { in: payloads.map((p) => p.userId) }, emailNotifications: true },
    select: { id: true, email: true, name: true },
  });
  const emailMap = new Map(users.map((u) => [u.id, u]));

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  // All payloads in one deliver() call share an org (R35.4).
  const { appName } = await getOrgSettings(payloads[0]?.orgId);
  const from = process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? `${appName} <onboarding@resend.dev>`;

  await Promise.allSettled(
    payloads.map(async (p) => {
      const user = emailMap.get(p.userId);
      if (!user) return;
      await resend.emails.send({
        from,
        to: user.email,
        subject: p.title,
        html: `<p>${p.body}</p>${p.link ? `<p><a href="${process.env.AUTH_URL ?? ""}${p.link}">View in ${appName}</a></p>` : ""}`,
      });
    })
  );
}

async function deliver(channel: Channel, payloads: NotificationPayload[]) {
  if (channel === "IN_APP" || channel === "BOTH") await sendInApp(payloads);
  if (channel === "EMAIL" || channel === "BOTH") await sendEmail(payloads);
}

// ── Recipient resolution (R35.4: per-org, keyed off Membership) ───────────────

/** User ids of members of `orgId` with an ACTIVE membership whose role grants `perm`. */
async function getMemberIdsWithPermission(orgId: string, perm: string): Promise<string[]> {
  const members = await prisma.membership.findMany({
    where: { orgId, status: "ACTIVE", role: { permissions: { has: perm as never } } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

const getPMUserIds = (orgId: string) => getMemberIdsWithPermission(orgId, "MANAGE_PROJECTS");

export const getUserManagerIds = (orgId: string) =>
  getMemberIdsWithPermission(orgId, "MANAGE_USERS");

async function getAllActiveUserIds(orgId: string): Promise<string[]> {
  const members = await prisma.membership.findMany({
    where: { orgId, status: "ACTIVE" },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function getProjectLeadUserIds(orgId: string, projectId: string): Promise<string[]> {
  const leads = await prisma.projectAssignment.findMany({
    where: {
      orgId,
      projectId,
      role: { in: ["LEAD", "SUBLEAD"] },
      user: { memberships: { some: { orgId, status: "ACTIVE" } } },
    },
    select: { userId: true },
  });
  return leads.map((a) => a.userId);
}

export async function notifyNewSignup(
  newUser: { id: string; name: string | null; email: string },
  orgId: string,
) {
  const recipientIds = await getUserManagerIds(orgId);
  if (recipientIds.length === 0) return;
  const name = newUser.name ?? newUser.email.split("@")[0];
  const payloads: NotificationPayload[] = recipientIds.map((userId) => ({
    orgId,
    userId,
    type: NotificationType.USER_SIGNUP,
    title: "New account awaiting approval",
    body: `${name} (${newUser.email}) signed in and is awaiting approval.`,
    link: "/pm/users",
  }));
  await deliver(Channel.BOTH, payloads);
}

/**
 * Main cron function — runs all enabled notification rules, partitioned by org
 * (R35.4). Each org's rules only ever notify that org's members and concern that
 * org's projects; a scoped client (forOrg) enforces the boundary on every read.
 */
export async function runNotificationEngine(): Promise<{ fired: number; errors: string[] }> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  let fired = 0;
  const errors: string[] = [];

  for (const org of orgs) {
    const orgId = org.id;
    const db = forOrg(orgId);
    const rules = await db.notificationRule.findMany({ where: { enabled: true } });

    for (const rule of rules) {
      try {
        const payloads: NotificationPayload[] = [];
        const nowMs = Date.now();
        const mk = (
          userIds: string[],
          type: NotificationType,
          title: string,
          body: string,
          link: string,
        ) => payloads.push(...userIds.map((userId) => ({ orgId, userId, type, title, body, link })));

        // ── MISSING_SUBMISSION ──────────────────────────────────────────────
        if (rule.triggerType === TriggerType.MISSING_SUBMISSION) {
          const windowHours = rule.thresholdHours ?? 24;
          const cutoff = new Date(nowMs - windowHours * 60 * 60 * 1000);
          const projects = await db.project.findMany({
            where: {
              archivedAt: null,
              assignments: { some: { role: { in: ["LEAD", "SUBLEAD"] } } },
              statusUpdates: { none: { submittedAt: { gte: cutoff } } },
            },
            select: { id: true, name: true },
          });

          for (const project of projects) {
            const leadIds = await getProjectLeadUserIds(orgId, project.id);
            const pmIds = await getPMUserIds(orgId);
            const recipientIds =
              rule.recipients === "PM"
                ? pmIds
                : rule.recipients === "PROJECT_LEADS"
                  ? leadIds
                  : rule.recipients === "ALL_ACTIVE"
                    ? await getAllActiveUserIds(orgId)
                    : [...leadIds, ...pmIds];
            mk(
              recipientIds,
              NotificationType.REMINDER,
              `Project standing missing: ${project.name}`,
              `No project standing has been submitted for ${project.name} in the last ${windowHours} hours.`,
              `/projects/${project.id}/status/new`,
            );
          }
        }

        // ── PROJECT_BEHIND ──────────────────────────────────────────────────
        if (rule.triggerType === TriggerType.PROJECT_BEHIND) {
          const behindProjects = await db.project.findMany({
            where: { status: "BEHIND", archivedAt: null },
            select: { id: true, name: true },
          });
          for (const project of behindProjects) {
            const pmIds = await getPMUserIds(orgId);
            const leadIds = await getProjectLeadUserIds(orgId, project.id);
            const recipientIds =
              rule.recipients === "PM"
                ? pmIds
                : rule.recipients === "PROJECT_LEADS"
                  ? leadIds
                  : rule.recipients === "ALL_ACTIVE"
                    ? await getAllActiveUserIds(orgId)
                    : [...pmIds, ...leadIds];
            mk(
              recipientIds,
              NotificationType.PROJECT_BEHIND,
              `Project behind: ${project.name}`,
              `${project.name} has been flagged as Behind schedule.`,
              `/projects/${project.id}`,
            );
          }
        }

        // ── ACTION_ITEM_DUE ─────────────────────────────────────────────────
        if (rule.triggerType === TriggerType.ACTION_ITEM_DUE) {
          const windowHours = rule.thresholdHours ?? 24;
          const windowEnd = new Date(nowMs + windowHours * 60 * 60 * 1000);
          const dueItems = await db.actionItem.findMany({
            where: {
              status: "OPEN",
              ownerId: { not: null },
              deadline: { gte: new Date(), lte: windowEnd },
              project: { archivedAt: null },
            },
            include: { project: { select: { id: true, name: true } } },
          });
          for (const item of dueItems) {
            const recipientIds =
              rule.recipients === "PM"
                ? await getPMUserIds(orgId)
                : rule.recipients === "ACTION_OWNER" && item.ownerId
                  ? [item.ownerId]
                  : rule.recipients === "ALL_ACTIVE"
                    ? await getAllActiveUserIds(orgId)
                    : item.ownerId
                      ? [item.ownerId]
                      : [];
            mk(
              recipientIds,
              NotificationType.ACTION_ITEM,
              `Action item due: ${item.project.name}`,
              `"${item.description}" is due within ${windowHours} hours.`,
              `/projects/${item.project.id}`,
            );
          }
        }

        // ── GOAL_MISSED ─────────────────────────────────────────────────────
        if (rule.triggerType === TriggerType.GOAL_MISSED) {
          const recentRecords = await db.meetingRecord.findMany({
            where: { goalMet: false, project: { archivedAt: null } },
            orderBy: { meetingDate: "desc" },
            distinct: ["projectId"],
            select: { projectId: true, project: { select: { name: true } } },
          });
          for (const record of recentRecords) {
            const pmIds = await getPMUserIds(orgId);
            const leadIds = await getProjectLeadUserIds(orgId, record.projectId);
            const recipientIds =
              rule.recipients === "PM"
                ? pmIds
                : rule.recipients === "PROJECT_LEADS"
                  ? leadIds
                  : rule.recipients === "ALL_ACTIVE"
                    ? await getAllActiveUserIds(orgId)
                    : pmIds;
            mk(
              recipientIds,
              NotificationType.GOAL_MISSED,
              `Weekly goal missed: ${record.project.name}`,
              `${record.project.name} missed its goal at the most recent meeting.`,
              `/projects/${record.projectId}`,
            );
          }
        }

        if (payloads.length > 0) {
          await deliver(rule.channel, payloads);
          fired += payloads.length;
        }
      } catch (err) {
        errors.push(`Org ${orgId} rule ${rule.id} (${rule.triggerType}): ${String(err)}`);
      }
    }
  }

  return { fired, errors };
}
