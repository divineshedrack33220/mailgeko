export type WorkspaceRole = "owner" | "admin" | "manager" | "viewer";

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
}

/** Owners and admins manage the workspace (team, billing, keys, AI). */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Owners and admins launch campaigns to the audience. */
export function canSend(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Managers and above can create and edit content (contacts, campaigns, etc.). */
export function canManage(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}
