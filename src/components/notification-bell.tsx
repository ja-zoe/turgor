"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, X } from "@phosphor-icons/react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silently ignore
    }
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications/read", { method: "POST", body: JSON.stringify({}) });
      setNotifications((n) => n.map((x) => ({ ...x, read: true })));
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  async function markOneRead(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((n) =>
      n.map((x) => (x.id === id ? { ...x, read: true } : x))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer relative w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} weight={unreadCount > 0 ? "fill" : "regular"} />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: "#A4503C", fontFamily: "var(--font-mono)", paddingInline: "3px" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-card border border-border rounded-xl shadow-[0_2px_16px_rgba(0,0,0,0.08)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-xs text-muted-foreground clickable-icon"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground clickable-icon"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={20} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer ${
                      !n.read ? "bg-[#EDF3EC]/40" : ""
                    }`}
                    onClick={() => !n.read && markOneRead(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      )}
                      <div className={!n.read ? "" : "pl-3.5"}>
                        <p className="text-xs font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                        <p
                          className="text-[10px] text-muted-foreground/70 mt-1"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {new Date(n.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { markOneRead(n.id); setOpen(false); }}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
