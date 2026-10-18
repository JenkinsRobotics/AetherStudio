/** Source is a caption; function determines where a specimen is reviewed. */
export const STUDIO_SPECIMEN_SECTIONS = {
  trees: "Trees + hierarchies — every variant side by side",
  inspectors: "Inspectors + property panels — every variant side by side",
  appearance: "Appearance, materials + visualization — every variant side by side",
  timelines: "Timelines — every variant side by side",
  collaboration: "Document history + collaboration",
  revisions: "Revision trees + branches",
  viewports: "Viewports — transform gizmo, navigation cube, camera chrome, imperative canvas",
  floating: "Floating + detached windows",
} as const;
export type StudioSpecimenKind = keyof typeof STUDIO_SPECIMEN_SECTIONS;

export const STUDIO_SPECIMEN_SOURCES = [
  { id: "avatar", oldSection: "Avatar studio controls", kinds: ["appearance", "viewports", "inspectors"] },
  { id: "material", oldSection: "Material studio controls", kinds: ["appearance", "inspectors", "trees", "timelines"] },
  { id: "model", oldSection: "Model studio controls", kinds: ["trees", "inspectors", "appearance", "collaboration", "revisions", "viewports", "floating"] },
  { id: "wheel", oldSection: "Wheel studio controls", kinds: ["trees", "inspectors", "appearance"] },
  { id: "wheel-reference", oldSection: "Wheel reference controls", kinds: ["trees", "inspectors"] },
  { id: "spotlight", oldSection: "Spotlight studio controls", kinds: ["trees", "inspectors", "appearance"] },
] as const satisfies readonly { id: string; oldSection: string; kinds: readonly StudioSpecimenKind[] }[];

/** Saved mixed collections expand to every destination; old bookmarks use the first. */
export function relocatedStudioSections(title: string): readonly string[] {
  const source = STUDIO_SPECIMEN_SOURCES.find(source => source.oldSection === title);
  return source ? source.kinds.map(kind => STUDIO_SPECIMEN_SECTIONS[kind]) : [title];
}
