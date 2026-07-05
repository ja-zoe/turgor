"use server";

import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/org";
import { requirePermission } from "@/lib/permissions";
import { ensureMembership } from "@/lib/provisioning";
import { assertWithinLimit } from "@/lib/entitlements/limits";
import { UserStatus } from "@/generated/prisma";
import { Permission } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

/** Active-member count for the org (a seat consumed) — used for the MAX_MEMBERS quota. */
async function activeMemberCount(orgId: string): Promise<number> {
  return prisma.membership.count({ where: { orgId, status: UserStatus.ACTIVE } });
}

/**
 * PM user management is per-org (R35.3): approve/suspend/role changes act on the
 * target user's Membership in the acting PM's active org, never the global User
 * row. A user who also belongs to other orgs is unaffected there.
 */

async function setMembershipStatus(orgId: string, userId: string, status: UserStatus) {
  await prisma.membership.update({
    where: { userId_orgId: { userId, orgId } },
    data: { status },
  });
}

export async function approveUser(userId: string, roleId: string) {
  const me = await requirePermission(Permission.MANAGE_USERS);
  // Plan quota (set 37): activating a member consumes a seat. Community = unlimited (no-op).
  await assertWithinLimit(me.orgId, "MAX_MEMBERS", await activeMemberCount(me.orgId));
  // Idempotent: creates the membership if somehow missing, else activates it.
  await ensureMembership(userId, me.orgId, { status: UserStatus.ACTIVE, roleId });

  const { appFullName } = await getOrgSettings(me.orgId);
  await prisma.notification.create({
    data: {
      orgId: me.orgId,
      userId,
      type: "USER_APPROVAL",
      title: "Your account has been approved",
      body: `You now have access to ${appFullName}.`,
      link: "/dashboard",
    },
  });

  revalidatePath("/pm/users");
}

export async function updateUserRole(userId: string, roleId: string) {
  const me = await requirePermission(Permission.MANAGE_USERS);
  await prisma.membership.update({
    where: { userId_orgId: { userId, orgId: me.orgId } },
    data: { roleId },
  });
  revalidatePath("/pm/users");
}

export async function suspendUser(userId: string) {
  const me = await requirePermission(Permission.MANAGE_USERS);
  await setMembershipStatus(me.orgId, userId, UserStatus.SUSPENDED);
  revalidatePath("/pm/users");
}

export async function reactivateUser(userId: string) {
  const me = await requirePermission(Permission.MANAGE_USERS);
  // Reactivating also consumes a seat — same quota as approval (set 37).
  await assertWithinLimit(me.orgId, "MAX_MEMBERS", await activeMemberCount(me.orgId));
  await setMembershipStatus(me.orgId, userId, UserStatus.ACTIVE);
  revalidatePath("/pm/users");
}

/**
 * Remove a user from the acting PM's org (R18.2 → R35.3, now org-scoped). Marks
 * their membership DELETED and drops their org-scoped access (project assignments,
 * MCP connections). We never hard-delete — that would orphan authored history. A PM
 * can NEVER delete themselves. If this was the user's last non-deleted membership
 * anywhere, we also anonymize the global User and revoke sessions (the full R18.2
 * scrub); otherwise the global identity is left intact for their other orgs.
 */
export async function deleteUser(userId: string) {
  const me = await requirePermission(Permission.DELETE_USERS);
  if (me.id === userId) {
    throw new Error("You cannot delete your own account.");
  }
  const orgId = me.orgId;

  await setMembershipStatus(orgId, userId, UserStatus.DELETED);
  await prisma.projectAssignment.deleteMany({ where: { orgId, userId } });
  await prisma.mcpConnection.deleteMany({ where: { orgId, userId } });

  const remaining = await prisma.membership.count({
    where: { userId, status: { not: UserStatus.DELETED } },
  });
  if (remaining === 0) {
    // Truly gone — anonymize identity + force logout everywhere.
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted user",
        firstName: null,
        lastName: null,
        nickname: null,
        email: `deleted+${userId}@seed.invalid`,
        mcpToken: null,
        mcpTokenOrgId: null,
        image: null,
      },
    });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
  }

  revalidatePath("/pm/users");
}
