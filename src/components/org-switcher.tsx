"use client";

import { useTransition } from "react";
import { Buildings, CaretUpDown } from "@phosphor-icons/react";
import { switchOrg } from "@/lib/actions/org";

export interface OrgOption {
  id: string;
  name: string;
}

/**
 * Active-org control (R35.2). A single-membership user sees a plain label (no
 * affordance — per the R19 rule, don't signal interactivity on a non-choice); a
 * multi-org user gets a select that switches the active org.
 */
export function OrgSwitcher({
  orgs,
  activeOrgId,
}: {
  orgs: OrgOption[];
  activeOrgId: string;
}) {
  const [pending, startTransition] = useTransition();
  const active = orgs.find((o) => o.id === activeOrgId);

  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-foreground min-w-0">
        <Buildings size={16} weight="fill" className="flex-shrink-0 text-muted-foreground" />
        <span className="truncate">{active?.name ?? "Organization"}</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors">
      <Buildings size={16} weight="fill" className="flex-shrink-0 text-muted-foreground" />
      <select
        aria-label="Active organization"
        value={activeOrgId}
        disabled={pending}
        onChange={(e) => startTransition(() => switchOrg(e.target.value))}
        className="cursor-pointer appearance-none bg-transparent text-sm text-foreground w-full pr-5 focus:outline-none disabled:opacity-60 truncate"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <CaretUpDown
        size={13}
        className="pointer-events-none absolute right-3 text-muted-foreground"
      />
    </div>
  );
}
