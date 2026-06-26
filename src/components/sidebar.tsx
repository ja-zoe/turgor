"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plant,
  Folders,
  ClipboardText,
  CheckSquare,
  Users,
  Gear,
  SignOut,
  ChartBar,
} from "@phosphor-icons/react";
import { Permission } from "@/generated/prisma";

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
];

const pmItems = [
  { href: "/pm/users", label: "Users", icon: Users, perm: Permission.MANAGE_USERS },
  { href: "/pm/review", label: "Monthly Review", icon: ChartBar, perm: Permission.VIEW_MONTHLY_REVIEW },
  { href: "/pm/settings", label: "Settings", icon: Gear, perm: Permission.CONFIGURE_NOTIFICATIONS },
];

export function Sidebar({ userName, userEmail, permissions, signOutAction }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const pmVisible = pmItems.filter((item) => permissions.includes(item.perm));

  return (
    <aside className="w-56 flex-shrink-0 h-screen sticky top-0 flex flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Plant size={18} weight="fill" className="text-primary" />
          <span
            className="text-sm font-semibold text-foreground tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            SEED Tracker
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
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

      {/* User footer */}
      <div className="border-t border-border px-3 py-3">
        <div className="px-3 py-2">
          <p className="text-sm font-medium text-foreground truncate">{userName}</p>
          <p
            className="text-xs text-muted-foreground truncate"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {userEmail}
          </p>
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
    </aside>
  );
}
