import { driveRequest, type DriveFile } from "@aether/session/library/drive-api";

export interface DriveListQuery {
  organization: string;
  view: string;
  parent?: string | null;
  workspace?: string | null;
  query?: string;
  shared_scope?: "with" | "by";
}
export interface DriveListing {
  files: DriveFile[];
  path: { id: string; name: string }[];
}

/** Personal navigation spans the authorized catalog, using the same organization
 * request contract as workspace navigation. A freshly built client must also
 * work while an older Studio host is keeping editors' live sessions open. */
export async function listDriveFiles(
  query: DriveListQuery,
  organizations: readonly { id: string }[],
  request = (data: DriveListQuery) => driveRequest<DriveListing>("list", data),
): Promise<DriveListing> {
  if (query.organization !== "all") return request(query);
  if (query.parent || query.view === "workspace") throw new Error("Choose a workspace or folder organization.");
  const scopes = [...new Set(organizations.map(organization => organization.id))];
  // Do not silently turn a failed scope into an apparently complete file list.
  const results = await Promise.all(scopes.map(organization => request({ ...query, organization })));
  return {
    files: [...new Map(results.flatMap(result => result.files).map(file => [file.id, file])).values()],
    path: [],
  };
}
