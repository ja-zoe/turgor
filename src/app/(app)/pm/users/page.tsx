import { requirePermission, getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma";
import { approveUser, updateUserRole, suspendUser, reactivateUser } from "@/lib/actions/users";
import { createRole, updateRole, deleteRole } from "@/lib/actions/roles";
import { CheckCircle, XCircle, PauseCircle, UserCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

const ALL_PERMISSIONS: { value: Permission; label: string }[] = [
  { value: Permission.VIEW_ALL_PROJECTS, label: "View all projects" },
  { value: Permission.VIEW_ASSIGNED_PROJECTS, label: "View assigned projects" },
  { value: Permission.SUBMIT_STATUS_UPDATES, label: "Submit status updates" },
  { value: Permission.EDIT_OWN_PROJECT, label: "Edit own project" },
  { value: Permission.POST_MEETING_TRACKING, label: "Post-meeting tracking" },
  { value: Permission.MANAGE_PROJECTS, label: "Manage projects" },
  { value: Permission.MANAGE_MILESTONES, label: "Manage milestones / deliverables" },
  { value: Permission.ASSIGN_ACTION_ITEMS, label: "Assign action items" },
  { value: Permission.CLOSE_ACTION_ITEMS, label: "Close action items" },
  { value: Permission.VIEW_MONTHLY_REVIEW, label: "View monthly review" },
  { value: Permission.CONFIGURE_NOTIFICATIONS, label: "Configure notifications" },
  { value: Permission.MANAGE_USERS, label: "Manage users" },
  { value: Permission.MANAGE_ROLES, label: "Manage roles" },
];

export default async function UsersPage() {
  const me = await requirePermission(Permission.MANAGE_USERS);
  const myPermissions = await getUserPermissions(me.roleId);
  const canManageRoles = myPermissions.includes(Permission.MANAGE_ROLES);

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: { role: { select: { id: true, name: true } } },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  const pending = users.filter((u) => u.status === "PENDING");
  const active = users.filter((u) => u.status === "ACTIVE");
  const suspended = users.filter((u) => u.status === "SUSPENDED");

  return (
    <div className="space-y-10">
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          PM Tools
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Users & Roles
        </h1>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <UserCircle size={15} className="text-[#C99846]" weight="fill" />
            Pending Approval
            <span
              className="text-xs text-[#C99846] bg-[#FBF3DB] px-1.5 py-0.5 rounded ml-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {pending.length}
            </span>
          </h2>
          <div className="space-y-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3 bg-[#FBF3DB]/40 border border-[#C99846]/20 rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{u.name ?? u.email}</p>
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {u.email} &middot; joined{" "}
                    {u.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    const roleId = fd.get("roleId") as string;
                    await approveUser(u.id, roleId);
                  }}
                  className="flex items-center gap-2"
                >
                  <select
                    name="roleId"
                    required
                    className="rounded-md border border-border bg-card text-sm px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <option value="">Assign role…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 hover:bg-primary/80 transition-colors"
                  >
                    <CheckCircle size={13} weight="fill" />
                    Approve
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await suspendUser(u.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-[#A4503C] transition-colors"
                    title="Reject"
                  >
                    <XCircle size={16} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active users */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Active Users — {active.length}
        </h2>
        <div className="border border-border rounded-xl overflow-hidden">
          {active.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No active users yet.</p>
          ) : (
            active.map((u, i) => (
              <div
                key={u.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i !== active.length - 1 ? "border-b border-border" : ""
                } hover:bg-muted/20 transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{u.name ?? u.email}</p>
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {u.email}
                  </p>
                </div>
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    const roleId = fd.get("roleId") as string;
                    await updateUserRole(u.id, roleId);
                  }}
                  className="flex items-center gap-2"
                >
                  <select
                    name="roleId"
                    defaultValue={u.roleId ?? ""}
                    className="rounded-md border border-border bg-card text-xs px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <option value="">No role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Save
                  </button>
                </form>
                {u.id !== me.id && (
                  <form
                    action={async () => {
                      "use server";
                      await suspendUser(u.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-[#A4503C] transition-colors"
                      title="Suspend"
                    >
                      <PauseCircle size={15} />
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Suspended users */}
      {suspended.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Suspended — {suspended.length}
          </h2>
          <div className="border border-border rounded-xl overflow-hidden opacity-70">
            {suspended.map((u, i) => (
              <div
                key={u.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i !== suspended.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{u.name ?? u.email}</p>
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {u.email}
                  </p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await reactivateUser(u.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs text-muted-foreground hover:text-[#588157] transition-colors"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Reactivate
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Role Builder */}
      {canManageRoles && (
        <section>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <ShieldCheck size={15} className="text-muted-foreground" />
            Roles
          </h2>

          <div className="space-y-4">
            {roles.map((role) => (
              <details
                key={role.id}
                className="border border-border rounded-xl overflow-hidden group"
              >
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors list-none">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{role.name}</span>
                    {role.isBuiltIn && (
                      <span
                        className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        built-in
                      </span>
                    )}
                    <span
                      className="text-xs text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    edit ↓
                  </span>
                </summary>
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    await updateRole(role.id, fd);
                  }}
                  className="border-t border-border px-4 py-4 bg-muted/10"
                >
                  <div className="mb-3">
                    <label className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                      Name
                    </label>
                    <input
                      name="name"
                      defaultValue={role.name}
                      className="mt-1 w-full max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {ALL_PERMISSIONS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name={`perm_${value}`}
                          defaultChecked={role.permissions.includes(value)}
                          className="rounded accent-primary"
                        />
                        <span className="text-xs text-foreground">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors"
                    >
                      Save role
                    </button>
                    {!role.isBuiltIn && (
                      <button
                        type="button"
                        onClick={async () => {
                          // Handled via separate form below
                        }}
                        className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                        formNoValidate
                      />
                    )}
                  </div>
                </form>
                {!role.isBuiltIn && (
                  <div className="border-t border-border px-4 py-2 bg-muted/10">
                    <form
                      action={async () => {
                        "use server";
                        await deleteRole(role.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs text-[#A4503C] hover:text-[#A4503C]/70 transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Delete role
                      </button>
                    </form>
                  </div>
                )}
              </details>
            ))}
          </div>

          {/* Create new role */}
          <details className="mt-4 border border-dashed border-border rounded-xl overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors list-none">
              + Create custom role
            </summary>
            <form
              action={createRole}
              className="border-t border-border px-4 py-4"
            >
              <div className="mb-3">
                <label className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  Role name
                </label>
                <input
                  name="name"
                  required
                  placeholder="e.g. External Advisor"
                  className="mt-1 w-full max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {ALL_PERMISSIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name={`perm_${value}`}
                      className="rounded accent-primary"
                    />
                    <span className="text-xs text-foreground">{label}</span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:bg-primary/80 transition-colors"
              >
                Create role
              </button>
            </form>
          </details>
        </section>
      )}
    </div>
  );
}
