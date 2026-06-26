"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  ListTodo,
  CalendarClock,
  Users,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Bell,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

// Icon keys are passed from the server layout (functions can't cross the
// server→client boundary), then resolved to lucide components here.
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  mytasks: ListTodo,
  actions: ListChecks,
  review: CalendarClock,
  users: Users,
  roles: ShieldCheck,
  settings: SlidersHorizontal,
};

export type NavItem = { href: string; label: string; icon: string };

/**
 * App chrome: a dark "bento" sidebar that anchors the layout against the sage
 * background, with a responsive drawer on mobile. Nav items are computed
 * server-side from permissions and passed in.
 */
export function AppShell({
  groups,
  user,
  unreadCount,
  signOutAction,
  children,
}: {
  groups: { heading?: string; items: NavItem[] }[];
  user: { name?: string | null; email?: string | null; roleName: string | null };
  unreadCount: number;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const sidebar = (
    <nav style={{ width: 264, height: "100%", borderRadius: 0, padding: "20px 16px", display: "flex", flexDirection: "column", background: "var(--sidebar)", color: "var(--text-on-dark)" }} aria-label="Main">
      <Link href="/dashboard" onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px" }}>
        <span style={{ display: "inline-flex", width: 34, height: 34, borderRadius: 12, background: "var(--primary)", color: "#fff", alignItems: "center", justifyContent: "center" }}>
          <Sprout size={19} />
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text-on-dark)" }}>SEED Tracker</span>
      </Link>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{ marginTop: gi === 0 ? 4 : 18 }}>
            {g.heading && <p className="eyebrow" style={{ color: "var(--text-on-dark-soft)", padding: "0 12px 8px" }}>{g.heading}</p>}
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {g.items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`nav-item ${isActive(item.href) ? "nav-item-active" : ""}`}
                      aria-current={isActive(item.href) ? "page" : undefined}
                    >
                      <Icon />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="divider" style={{ margin: "14px 0" }} />
      <div style={{ padding: "0 8px" }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-on-dark)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user.name ?? user.email}
        </p>
        <p className="eyebrow" style={{ color: "var(--text-on-dark-soft)", marginTop: 2 }}>{user.roleName ?? "No role"}</p>
        <form action={signOutAction} style={{ marginTop: 12 }}>
          <button type="submit" className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start", paddingLeft: 8 }}>
            <LogOut /> Sign out
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="hidden md:block" style={{ position: "sticky", top: 0, height: "100vh", padding: 12 }}>
        <div style={{ height: "100%", overflow: "hidden", borderRadius: 28, background: "var(--sidebar)", border: "1px solid var(--border-on-dark)", boxShadow: "var(--shadow-dark)" }}>{sidebar}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden" style={{ position: "fixed", inset: 0, zIndex: 40 }}>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(17, 26, 19, 0.72)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRight: "1px solid var(--border-on-dark)" }}>{sidebar}</div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", gap: 12 }}>
          <button className="btn btn-secondary btn-icon md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </button>
          <div style={{ flex: 1 }} />
          <Link href="/notifications" className="btn btn-secondary btn-sm" aria-label="Notifications" style={{ position: "relative" }}>
            <Bell />
            <span className="hidden md:inline">Notifications</span>
            {unreadCount > 0 && (
              <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9999, background: "var(--behind)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {unreadCount}
              </span>
            )}
          </Link>
        </header>

        <main style={{ flex: 1, padding: "8px 24px 48px", maxWidth: 1240, width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// Re-export so the close icon is available if needed elsewhere.
export { X as CloseIcon };
