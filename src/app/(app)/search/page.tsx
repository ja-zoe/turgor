import Link from "next/link";
import { requireAuth, getUserPermissions } from "@/lib/permissions";
import { searchAll, MIN_QUERY_LENGTH, type SearchResults } from "@/lib/search";
import {
  ProjectStatusBadge,
  ArchivedBadge,
  TimelineStatusBadge,
} from "@/components/status-badge";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { ProjectStatus, TimelineStatus } from "@/generated/prisma";

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <p
      className="text-xs text-muted-foreground uppercase tracking-widest"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {label} — {count}
    </p>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAuth();
  const permissions = await getUserPermissions(user.roleId);
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const results: SearchResults = await searchAll(user.orgId, query, user.id, permissions);
  const total =
    results.projects.length +
    results.deliverables.length +
    results.actionItems.length +
    results.users.length;

  return (
    <div className="space-y-8">
      <div>
        <p
          className="text-xs text-muted-foreground uppercase tracking-widest mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Search
        </p>
        <h1
          className="text-3xl text-foreground"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "-0.02em",
          }}
        >
          Find anything
        </h1>
      </div>

      <form method="GET" action="/search" className="max-w-xl">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-primary/40">
          <MagnifyingGlass size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Projects, deliverables, action items, people…"
            className="w-full bg-transparent text-sm text-foreground focus:outline-none"
            data-testid="search-input"
          />
        </div>
      </form>

      {query.length < MIN_QUERY_LENGTH ? (
        <p className="text-sm text-muted-foreground">
          Type at least {MIN_QUERY_LENGTH} characters and press Enter to search.
        </p>
      ) : total === 0 ? (
        <div className="p-12 border border-dashed border-border rounded-xl text-center">
          <MagnifyingGlass size={28} className="text-muted-foreground mx-auto mb-3" weight="thin" />
          <p className="text-sm text-muted-foreground" data-testid="search-empty">
            No results for “{query}”.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {results.projects.length > 0 && (
            <section className="space-y-2" data-testid="search-projects">
              <SectionHeader label="Projects" count={results.projects.length} />
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {results.projects.map((p) => (
                  <div
                    key={p.id}
                    className="clickable-row flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${p.id}`}
                        className="clickable text-sm font-medium text-foreground"
                      >
                        {p.name}
                      </Link>
                      <p
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {p.semester}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.archived && <ArchivedBadge />}
                      <ProjectStatusBadge status={p.status as ProjectStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.deliverables.length > 0 && (
            <section className="space-y-2" data-testid="search-deliverables">
              <SectionHeader label="Deliverables" count={results.deliverables.length} />
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {results.deliverables.map((d) => (
                  <div
                    key={d.id}
                    className="clickable-row flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${d.project.id}`}
                        className="clickable text-sm font-medium text-foreground"
                      >
                        {d.title}
                      </Link>
                      <p
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        in {d.project.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {d.project.archived && <ArchivedBadge />}
                      <TimelineStatusBadge status={d.status as TimelineStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.actionItems.length > 0 && (
            <section className="space-y-2" data-testid="search-action-items">
              <SectionHeader label="Action items" count={results.actionItems.length} />
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {results.actionItems.map((a) => (
                  <div
                    key={a.id}
                    className="clickable-row flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${a.project.id}/action-items`}
                        className="clickable text-sm text-foreground line-clamp-1"
                      >
                        {a.description}
                      </Link>
                      <p
                        className="text-xs text-muted-foreground"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        in {a.project.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {a.project.archived && <ArchivedBadge />}
                      <span
                        className="text-xs text-muted-foreground uppercase"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {a.status.toLowerCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.users.length > 0 && (
            <section className="space-y-2" data-testid="search-users">
              <SectionHeader label="People" count={results.users.length} />
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {results.users.map((u) => (
                  <div
                    key={u.id}
                    className="clickable-row flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href="/pm/users"
                        className="clickable text-sm font-medium text-foreground"
                      >
                        {u.displayName}
                      </Link>
                      <p
                        className="text-xs text-muted-foreground truncate"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {u.email}
                      </p>
                    </div>
                    {u.roleName && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {u.roleName}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
