/** App libraries are filtered views of Drive locations, never separate storage. */
export interface LibraryLocation { organization: string; workspace: string | null }
export function inLibraryWorkspace<T extends LibraryLocation>(files: T[], location: LibraryLocation | null): T[] {
  if (!location?.workspace) return [];
  return files.filter(file => file.organization === location.organization && file.workspace === location.workspace);
}
