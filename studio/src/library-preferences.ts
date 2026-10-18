export interface LibraryPreferences {
  designKind: "part" | "assembly" | "project";
  startPage: "home" | "personal" | "workspace";
  destination: "personal" | "workspace";
  view: "list" | "grid";
  showUpdates: boolean;
  objectPreviews: boolean;
  lengthUnit: "mm" | "cm" | "m" | "in" | "ft";
  angleUnit: "deg" | "rad";
  decimals: number;
}
export const defaultLibraryPreferences: LibraryPreferences = { designKind: "part", startPage: "home", destination: "personal", view: "list", showUpdates: true, objectPreviews: true, lengthUnit: "mm", angleUnit: "deg", decimals: 3 };
export function readLibraryPreferences(app: string): LibraryPreferences {
  let raw: Partial<LibraryPreferences> = {};
  try { raw = JSON.parse(localStorage.getItem(`aether-${app}.library-preferences.v1`) || "{}"); } catch { /* defaults */ }
  if (!raw || typeof raw !== "object") raw = {};
  const base = defaultLibraryPreferences;
  return {
    designKind: raw.designKind === "assembly" || raw.designKind === "project" ? raw.designKind : "part",
    startPage: ["home", "personal", "workspace"].includes(raw.startPage ?? "") ? raw.startPage! : base.startPage,
    destination: raw.destination === "workspace" ? "workspace" : "personal",
    objectPreviews: raw.objectPreviews !== false,
    view: raw.view === "grid" ? "grid" : "list", showUpdates: raw.showUpdates !== false,
    lengthUnit: ["mm", "cm", "m", "in", "ft"].includes(raw.lengthUnit ?? "") ? raw.lengthUnit! : base.lengthUnit,
    angleUnit: raw.angleUnit === "rad" ? "rad" : "deg",
    decimals: Number.isInteger(raw.decimals) && raw.decimals! >= 0 && raw.decimals! <= 8 ? raw.decimals! : base.decimals,
  };
}
export function writeLibraryPreferences(app: string, value: LibraryPreferences) {
  localStorage.setItem(`aether-${app}.library-preferences.v1`, JSON.stringify(value));
}
