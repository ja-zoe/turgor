import { Permission } from "@/generated/prisma";

/**
 * Single source of truth for the built-in role permission sets (R35.1). Shared by
 * the seed (default org) and provisionOrg (every new org) so a role's permissions
 * never drift between the two provisioning paths.
 */
export const PM_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.SUBMIT_STATUS_UPDATES,
  Permission.EDIT_OWN_PROJECT,
  Permission.POST_MEETING_TRACKING,
  Permission.MANAGE_PROJECTS,
  Permission.MANAGE_MILESTONES,
  Permission.ASSIGN_ACTION_ITEMS,
  Permission.CLOSE_ACTION_ITEMS,
  Permission.VIEW_MONTHLY_REVIEW,
  Permission.CONFIGURE_NOTIFICATIONS,
  Permission.MANAGE_USERS,
  Permission.MANAGE_ROLES,
  Permission.MANAGE_CALENDAR,
  Permission.VIEW_LEAD_MEETINGS,
  Permission.MANAGE_STATUS_UPDATES,
  Permission.MANAGE_MEETING_RECORDS,
  Permission.DELETE_USERS,
];

export const LEAD_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.SUBMIT_STATUS_UPDATES,
  Permission.EDIT_OWN_PROJECT,
  Permission.CLOSE_ACTION_ITEMS,
  Permission.VIEW_LEAD_MEETINGS,
];

export const VIEWER_PERMISSIONS: Permission[] = [Permission.VIEW_ALL_PROJECTS];

// Eboard: broad visibility + lead/eboard meeting management.
export const EBOARD_PERMISSIONS: Permission[] = [
  Permission.VIEW_ALL_PROJECTS,
  Permission.VIEW_MONTHLY_REVIEW,
  Permission.MANAGE_CALENDAR,
  Permission.VIEW_LEAD_MEETINGS,
  Permission.MANAGE_STATUS_UPDATES,
];

export type BuiltInRoleDef = { key: string; defaultName: string; permissions: Permission[] };

// Keyed by builtInKey (stable), never by the PM-editable display name.
export const BUILT_IN_ROLES: BuiltInRoleDef[] = [
  { key: "pm", defaultName: "Project Manager", permissions: PM_PERMISSIONS },
  { key: "lead", defaultName: "Project Lead", permissions: LEAD_PERMISSIONS },
  { key: "viewer", defaultName: "Viewer", permissions: VIEWER_PERMISSIONS },
  { key: "eboard", defaultName: "Eboard", permissions: EBOARD_PERMISSIONS },
];
