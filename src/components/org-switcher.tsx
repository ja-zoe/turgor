"use client";

import { useTransition } from "react";
import { Buildings, CaretUpDown } from "@phosphor-icons/react";
import { switchOrg } from "@/lib/actions/org";

export interface OrgOption {
  id: string;
  name: string;
  /** R39.3 (Cloud): the org's subdomain URL. When present, selecting navigates here instead
   *  of cookie-switching, so the URL matches the org. Absent on self-host. */
  url?: string;
}

/**
 * Active-org control (R35.2 / R39.3). A single-membership user sees a plain label (no
 * affordance — per the R19 rule, don't signal interactivity on a non-choice); a multi-org
 * user gets a select. On Turgor Cloud (options carry `url`) selecting navigates to that org's
 * subdomain; on self-host it cookie-switches the active org.
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

  const onSelect = (orgId: string) => {
    const target = orgs.find((o) => o.id === orgId);
    if (target?.url) {
      window.location.assign(target.url); // Cloud: go to the org's subdomain
    } else {
      startTransition(() => switchOrg(orgId)); // self-host: cookie switch
    }
  };

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
        onChange={(e) => onSelect(e.target.value)}
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
