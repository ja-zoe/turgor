"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Plant,
  Folders,
  CheckSquare,
  Users,
  Gear,
  SignOut,
  ChartBar,
  ListChecks,
  List,
  X,
  UserCircle,
  CalendarDots,
} from "@phosphor-icons/react";
import { Permission } from "@/generated/prisma";
import { NotificationBell } from "@/components/notification-bell";

interface SidebarProps {
  userName: string;
  userEmail: string;
  permissions: Permission[];
  signOutAction: () => Promise<void>;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Plant },
  { href: "/projects", label: "Projects", icon: Folders },
  { href: "/my-tasks", label: "My Tasks", icon: CheckSquare },
  { href: "/action-items", label: "Action Items", icon: ListChecks },
  { href: "/calendar", label: "Semester Calendar", icon: CalendarDots },
  { href: "/account", label: "Account", icon: UserCircle },
];

const pmItems = [
  {
    href: "/pm/users",
    label: "Users & Roles",
    icon: Users,
    perm: Permission.MANAGE_USERS,
  },
  {
    href: "/pm/review",
    label: "Monthly Review",
    icon: ChartBar,
    perm: Permission.VIEW_MONTHLY_REVIEW,
  },
  {
    href: "/pm/settings",
    label: "Settings",
    icon: Gear,
    perm: Permission.CONFIGURE_NOTIFICATIONS,
  },
];

export function Sidebar({
  userName,
  userEmail,
  permissions,
  signOutAction,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  const pmVisible = pmItems.filter((item) => permissions.includes(item.perm));

  const navContent = (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive(href)
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon size={16} weight={isActive(href) ? "fill" : "regular"} />
            {label}
          </Link>
        ))}

        {pmVisible.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p
                className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                PM Tools
              </p>
            </div>
            {pmVisible.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive(href)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={16} weight={isActive(href) ? "fill" : "regular"} />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {userName}
            </p>
            <p
              className="text-xs text-muted-foreground truncate"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {userEmail}
            </p>
          </div>
          <NotificationBell />
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <SignOut size={16} />
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-8 h-8 flex items-center justify-center rounded-md bg-card border border-border text-foreground hover:bg-muted transition-colors"
        aria-label="Open menu"
      >
        <List size={16} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-56 bg-card border-r border-border flex flex-col z-50 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-border flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            onClick={() => setMobileOpen(false)}
          >
            <Image
              src="/seed-logo-transparent.png"
              alt="SEED"
              width={36}
              height={36}
              unoptimized
              className="object-contain flex-shrink-0"
            />
            <span
              className="text-lg font-semibold text-foreground tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              SEED Tracker
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 h-screen sticky top-0 flex-col border-r border-border bg-card">
        <div className="px-5 py-5 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/seed-logo-transparent.png"
              alt="SEED"
              width={36}
              height={36}
              unoptimized
              className="object-contain flex-shrink-0"
            />
            <span
              className="text-lg font-semibold text-foreground tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              SEED Tracker
            </span>
          </Link>
        </div>
        {navContent}
      </aside>
    </>
  );
}
