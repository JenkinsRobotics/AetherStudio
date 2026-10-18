import type { DriveWorkspace } from "@aether/session/library/drive-api";

/** Organization directory projection; never moves files or changes membership. */
export function organizationChildren(workspaces: readonly DriveWorkspace[], current: string | null, parent: string | null, query: string): DriveWorkspace[] {
  const root = workspaces.find(w => w.id === current);
  if (!root?.is_default || parent || query.trim()) return [];
  return workspaces.filter(w => w.organization === root.organization && w.id !== root.id && !w.is_default)
    .sort((a,b) => a.name.localeCompare(b.name));
}
