"use client";

import { useState, useTransition } from "react";
import { Check } from "@phosphor-icons/react";
import { saveProfile } from "@/lib/actions/profile";

const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors disabled:opacity-60";
const labelClass =
  "block text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5";

export function ProfileSettingsForm({
  firstName,
  lastName,
  nickname,
  email,
}: {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
}) {
  const [vals, setVals] = useState({ firstName, lastName, nickname });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof vals>(key: K, value: string) {
    setVals((v) => ({ ...v, [key]: value }));
    setSaved(false);
    setError(null);
  }

  function submit() {
    if (!vals.firstName.trim() || !vals.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    const fd = new FormData();
    fd.set("firstName", vals.firstName);
    fd.set("lastName", vals.lastName);
    fd.set("nickname", vals.nickname);
    startTransition(async () => {
      await saveProfile(fd);
      setSaved(true);
    });
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-4">Profile</h2>
      <div className="p-5 bg-card border border-border rounded-xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>First name</label>
            <input
              value={vals.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              disabled={isPending}
              className={inputClass}
              data-testid="profile-firstName"
            />
          </div>
          <div>
            <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Last name</label>
            <input
              value={vals.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              disabled={isPending}
              className={inputClass}
              data-testid="profile-lastName"
            />
          </div>
        </div>

        <div>
          <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>
            Nickname <span className="normal-case tracking-normal text-muted-foreground/70">(how you&apos;re shown around the app)</span>
          </label>
          <input
            value={vals.nickname}
            onChange={(e) => set("nickname", e.target.value)}
            disabled={isPending}
            placeholder="optional"
            className={inputClass}
            data-testid="profile-nickname"
          />
        </div>

        <div>
          <label className={labelClass} style={{ fontFamily: "var(--font-mono)" }}>Email</label>
          <input
            value={email}
            readOnly
            disabled
            className={`${inputClass} cursor-not-allowed text-muted-foreground`}
            data-testid="profile-email"
          />
          <p className="text-xs text-muted-foreground mt-1">Managed by Rutgers CAS — can&apos;t be changed here.</p>
        </div>

        {error && <p className="text-xs text-[#A4503C]">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            data-testid="profile-save"
            className="rounded-md cursor-pointer bg-primary text-primary-foreground text-sm font-medium px-5 py-2.5 hover:bg-primary/80 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
          {saved && !isPending && (
            <span className="inline-flex items-center gap-1 text-xs text-[#588157]" data-testid="profile-saved" style={{ fontFamily: "var(--font-mono)" }}>
              <Check size={13} weight="bold" /> Saved
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
