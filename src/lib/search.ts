import { prisma } from "@/lib/prisma";
import { forOrg } from "@/lib/tenant-db";
import { Permission } from "@/generated/prisma";
import { getDisplayName } from "@/lib/utils";

/** Minimum query length — shorter strings match half the database. */
export const MIN_QUERY_LENGTH = 2;

/** Cap per category so one broad term can't render hundreds of rows. */
const TAKE = 20;

export type SearchResults = {
  projects: {
    id: string;
    name: string;
    semester: string;
    status: string;
    archived: boolean;
  }[];
  deliverables: {
    id: string;
    title: string;
    status: string;
    project: { id: string; name: string; archived: boolean };
  }[];
  actionItems: {
    id: string;
    description: string;
    status: string;
    project: { id: string; name: string; archived: boolean };
  }[];
  users: {
    id: string;
    displayName: string;
    email: string;
    roleName: string | null;
  }[];
};

export const EMPTY_RESULTS: SearchResults = {
  projects: [],
  deliverables: [],
  actionItems: [],
  users: [],
};

/**
 * Case-insensitive substring search across the four entity types, scoped exactly
 * like the listing pages: VIEW_ALL_PROJECTS or MANAGE_PROJECTS sees everything,
 * everyone else only their assigned projects (and whatever hangs off them). The
 * Users category needs MANAGE_USERS and hides anonymized deleted accounts.
 * Archived projects stay findable — search is a lookup tool — but are flagged.
 */
export async function searchAll(
  orgId: string,
  rawQuery: string,
  userId: string,
  permissions: Permission[]
): Promise<SearchResults> {
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY_LENGTH) return EMPTY_RESULTS;

  const db = forOrg(orgId);
  const canViewAll =
    permissions.includes(Permission.VIEW_ALL_PROJECTS) ||
    permissions.includes(Permission.MANAGE_PROJECTS);
  const projectScope = canViewAll ? {} : { assignments: { some: { userId } } };
  const contains = { contains: q, mode: "insensitive" as const };

  const [projects, deliverables, actionItems, users] = await Promise.all([
    db.project.findMany({
      where: { ...projectScope, OR: [{ name: contains }, { description: contains }] },
      select: { id: true, name: true, semester: true, status: true, archivedAt: true },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
    }),
    db.deliverable.findMany({
      where: { title: contains, project: projectScope },
      select: {
        id: true,
        title: true,
        status: true,
        project: { select: { id: true, name: true, archivedAt: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
    }),
    db.actionItem.findMany({
      where: { description: contains, project: projectScope },
      select: {
        id: true,
        description: true,
        status: true,
        project: { select: { id: true, name: true, archivedAt: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: TAKE,
    }),
    // Users search is scoped to members of this org (R35). Role name comes from the
    // user's membership in this org, not the (removed) global User.role.
    permissions.includes(Permission.MANAGE_USERS)
      ? prisma.user.findMany({
          where: {
            memberships: { some: { orgId } },
            OR: [
              { name: contains },
              { firstName: contains },
              { lastName: contains },
              { nickname: contains },
              { email: contains },
            ],
            NOT: { email: { endsWith: "@seed.invalid" } },
          },
          select: {
            id: true,
            name: true,
            firstName: true,
            nickname: true,
            email: true,
            memberships: { where: { orgId }, select: { role: { select: { name: true } } } },
          },
          orderBy: { email: "asc" },
          take: TAKE,
        })
      : Promise.resolve([]),
  ]);

  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      semester: p.semester,
      status: p.status,
      archived: p.archivedAt !== null,
    })),
    deliverables: deliverables.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      project: {
        id: d.project.id,
        name: d.project.name,
        archived: d.project.archivedAt !== null,
      },
    })),
    actionItems: actionItems.map((a) => ({
      id: a.id,
      description: a.description,
      status: a.status,
      project: {
        id: a.project.id,
        name: a.project.name,
        archived: a.project.archivedAt !== null,
      },
    })),
    users: users.map((u) => ({
      id: u.id,
      displayName: getDisplayName(u),
      email: u.email,
      roleName: u.memberships[0]?.role?.name ?? null,
    })),
  };
}
