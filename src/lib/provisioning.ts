import { prisma } from "@/lib/prisma";
import { UserStatus } from "@/generated/prisma";
import { BUILT_IN_ROLES } from "@/lib/built-in-roles";

/**
 * Org provisioning (R35.3). The single primitive for standing up a tenant: create
 * the Organization, seed its built-in roles + Settings, and (optionally) attach an
 * owner as an ACTIVE Project Manager. Idempotent. Uses the raw client because it
 * operates across the org boundary (before any tenant scope exists).
 *
 * The private turgor-cloud repo calls this to provision a paying org; the seed
 * calls it for the default org; auth's sign-in path uses ensureMembership below.
 */

export async function provisionOrg(input: {
  slug: string;
  name: string;
  ownerEmail?: string | null;
  /** Fixed id for the default org so the migration + seed agree; omit for new orgs. */
  id?: string;
}): Promise<{ id: string; slug: string; name: string }> {
  const org = await prisma.organization.upsert({
    where: { slug: input.slug },
    create: { ...(input.id ? { id: input.id } : {}), slug: input.slug, name: input.name },
    update: {},
    select: { id: true, slug: true, name: true },
  });

  // Built-in roles, per org, keyed by (orgId, builtInKey).
  for (const { key, defaultName, permissions } of BUILT_IN_ROLES) {
    await prisma.role.upsert({
      where: { orgId_builtInKey: { orgId: org.id, builtInKey: key } },
      create: { orgId: org.id, builtInKey: key, name: defaultName, isBuiltIn: true, permissions },
      update: { isBuiltIn: true, permissions },
    });
  }

  // Settings row for the org (one-to-one).
  await prisma.settings.upsert({
    where: { orgId: org.id },
    create: { orgId: org.id, orgName: input.name },
    update: {},
  });

  if (input.ownerEmail) {
    const owner = await prisma.user.upsert({
      where: { email: input.ownerEmail },
      create: { email: input.ownerEmail, name: input.ownerEmail.split("@")[0] },
      update: {},
      select: { id: true },
    });
    const pmRoleId = await getOrgRoleId(org.id, "pm");
    await ensureMembership(owner.id, org.id, { status: UserStatus.ACTIVE, roleId: pmRoleId });
  }

  return org;
}

/** The org-scoped id of a built-in role, by stable key. */
export async function getOrgRoleId(orgId: string, builtInKey: string): Promise<string | null> {
  const role = await prisma.role.findUnique({
    where: { orgId_builtInKey: { orgId, builtInKey } },
    select: { id: true },
  });
  return role?.id ?? null;
}

/**
 * Ensure a user has a membership in an org. Idempotent on (userId, orgId). When
 * `activate` is set it upgrades an existing membership's status/role (used to
 * promote the PM); otherwise it leaves an existing membership untouched.
 */
export async function ensureMembership(
  userId: string,
  orgId: string,
  opts: { status?: UserStatus; roleId?: string | null } = {},
): Promise<void> {
  const existing = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    select: { id: true },
  });
  if (existing) {
    if (opts.status !== undefined || opts.roleId !== undefined) {
      await prisma.membership.update({
        where: { id: existing.id },
        data: {
          ...(opts.status !== undefined ? { status: opts.status } : {}),
          ...(opts.roleId !== undefined ? { roleId: opts.roleId } : {}),
        },
      });
    }
    return;
  }
  await prisma.membership.create({
    data: {
      userId,
      orgId,
      status: opts.status ?? UserStatus.PENDING,
      roleId: opts.roleId ?? null,
    },
  });
}

/**
 * Which org a new sign-in joins. Seam the cloud repo overrides for its
 * invite/signup flow; the free tier has exactly one org (the default).
 */
export async function resolveSignupOrgId(_email: string): Promise<string> {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (org) return org.id;
  // No org yet (pre-seed) — create the default one.
  const created = await provisionOrg({ id: "org_default", slug: "default", name: "Turgor" });
  return created.id;
}
