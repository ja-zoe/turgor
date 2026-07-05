import { prisma } from "@/lib/prisma";

/**
 * The org-scoped Prisma client (R35.2). Lives in its own module — importing only
 * `prisma`, never `auth` — so request-less callers (the notification engine,
 * red-flag detection) can scope by org without pulling the auth graph in and
 * creating an import cycle (auth → notifications → tenant-db). Request-scoped
 * callers use `tenantDb()`/`getTenantContext` from `tenant.ts`.
 */

export const ACTIVE_ORG_COOKIE = "turgor-active-org";
export const DEFAULT_ORG_ID = "org_default";
// R38: a request header (set by the Cloud fork's subdomain middleware) naming the active org
// by its Organization.slug. Generic — core does no subdomain parsing; self-host never sets it.
export const ACTIVE_ORG_SLUG_HEADER = "x-turgor-active-org-slug";

// Models that carry orgId (R35.1) — the scope allowlist. Others (User,
// Organization, Account, Session, VerificationToken) pass through unscoped.
const TENANT_MODELS = new Set([
  "Project",
  "ProjectAssignment",
  "Deliverable",
  "Subtask",
  "StatusUpdate",
  "MeetingRecord",
  "ActionItem",
  "NotificationRule",
  "Notification",
  "CalendarEvent",
  "McpConnection",
  "Role",
  "Settings",
  "Membership",
]);

const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * A Prisma client scoped to one org. Reads/list/aggregate get `orgId` merged into
 * `where`; `findUnique` is post-filtered by `orgId`; create/createMany get `orgId`
 * injected; update/delete/upsert-by-id are pre-guarded by an ownership check
 * (a unique `where` can't take a non-unique field). Nested writes are NOT covered
 * by extension hooks — audited at the call sites (see R35.2 spec); `orgId` is NOT
 * NULL with no default, so a missed nested insert fails loudly rather than leaking.
 */
export function forOrg(orgId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = args ?? {};
          switch (operation) {
            case "findMany":
            case "findFirst":
            case "findFirstOrThrow":
            case "count":
            case "aggregate":
            case "groupBy":
            case "updateMany":
            case "deleteMany":
              a.where = a.where ? { AND: [{ orgId }, a.where] } : { orgId };
              return query(a);
            case "findUnique":
            case "findUniqueOrThrow": {
              const res = await query(a);
              if (res && res.orgId !== orgId) {
                if (operation === "findUniqueOrThrow") {
                  throw new Error(`${model} not found in org ${orgId}`);
                }
                return null;
              }
              return res;
            }
            case "create":
              a.data = { ...a.data, orgId };
              return query(a);
            case "createMany":
            case "createManyAndReturn":
              a.data = Array.isArray(a.data)
                ? a.data.map((d: Record<string, unknown>) => ({ ...d, orgId }))
                : { ...a.data, orgId };
              return query(a);
            case "update":
            case "delete": {
              const id = a.where?.id;
              if (typeof id === "string") {
                const owned = await (
                  prisma as unknown as Record<
                    string,
                    { findFirst: (x: unknown) => Promise<unknown> }
                  >
                )[lcFirst(model)].findFirst({ where: { id, orgId }, select: { id: true } });
                if (!owned) throw new Error(`${model} ${id} not found in org ${orgId}`);
              }
              return query(a);
            }
            case "upsert":
              a.create = { ...a.create, orgId };
              return query(a);
            default:
              return query(a);
          }
        },
      },
    },
  });
}

export type TenantPrisma = ReturnType<typeof forOrg>;
