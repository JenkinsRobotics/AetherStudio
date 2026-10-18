/** Local gallery study format. Production CAD/Map/Sketch/IO files are separate. */
export interface DemoMetadata {
  name: string;
  description: string;
  workspaceName: string;
  workspaceDescription: string;
}
export interface DemoDocument<T> extends DemoMetadata {
  format: "aether-ui-study";
  version: 1;
  app: string;
  data: T;
}
export const MAX_STUDY_BYTES = 2_000_000;
export function parseDemoDocument<T>(text: string, app: string, validate: (value: unknown) => T): DemoDocument<T> {
  if (text.length > MAX_STUDY_BYTES) throw Error("This study is too large to open (2 MB maximum).");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw Error("This is not a valid study JSON file."); }
  const doc = value as Partial<DemoDocument<unknown>> | null;
  if (!doc || doc.format !== "aether-ui-study" || doc.version !== 1 || doc.app !== app)
    throw Error("Open a study saved by this demo app. Production application files use a different format.");
  for (const key of ["name", "workspaceName", "description", "workspaceDescription"] as const) {
    if (typeof doc[key] !== "string" || doc[key]!.length > (key.includes("escription") ? 4000 : 160))
      throw Error("The study contains invalid document properties.");
  }
  if (!doc.name!.trim() || !doc.workspaceName!.trim()) throw Error("Document and workspace names cannot be blank.");
  return { format: "aether-ui-study", version: 1, app, name: doc.name!, workspaceName: doc.workspaceName!, description: doc.description!, workspaceDescription: doc.workspaceDescription!, data: validate(doc.data) };
}
export function studyFilename(name: string): string {
  return `${name.replace(/[^a-z0-9 _.-]/gi, "").trim().slice(0, 100) || "Untitled"}.aetherstudy.json`;
}
export function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
export function finiteTuple(value: unknown, size: number): value is number[] { return Array.isArray(value) && value.length === size && value.every(v => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 100000); }
export function validItem(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.id === "string" && value.id.length > 0 && value.id.length <= 160 && typeof value.name === "string" && value.name.length <= 160 && typeof value.visible === "boolean" && typeof value.color === "string" && /^#[0-9a-f]{6}$/i.test(value.color);
}
export function validateItems(value: unknown): asserts value is Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > 1000 || value.some(item => !validItem(item)) || new Set(value.map(item => item.id)).size !== value.length)
    throw Error("The study contains invalid or duplicate objects.");
}
