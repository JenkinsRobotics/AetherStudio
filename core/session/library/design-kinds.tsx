import { FileIcon } from "@aether/ui";
import type { DesignKind } from "@aether/ui/new-design";

/** CAD-only design kinds. Hybrid uses the existing project document format. */
export const CAD_DESIGN_KINDS: readonly DesignKind[] = [
  { id: "part", title: "Part Design", summary: "One component",
    description: "Create sketches and bodies to model a single component to manufacture or use in an assembly.",
    icon: <FileIcon icon="file-part" size={44} /> },
  { id: "assembly", title: "Assembly Design", summary: "Components and relationships",
    description: "Create or insert parts and other assemblies as external components, then define relationships between them to create an assembly.",
    icon: <FileIcon icon="file-assembly" size={44} /> },
  { id: "project", title: "Hybrid Design", summary: "Internal and external components together",
    description: "Create and model internal components, insert external components, and define relationships between them.",
    icon: <FileIcon icon="file-project" size={44} /> },
  { id: "drawing", title: "Drawing", summary: "Views and annotations",
    description: "Create views and annotations to document the active design for manufacturing.",
    icon: <FileIcon icon="file-drawing" size={44} />,
    unavailable: "Aether CAD has a Drawing workspace, but drawings are not yet their own document. Open a part or assembly and switch to Drawing." },

];

/** Unit systems offered beside every design kind. */
export const DESIGN_UNIT_OPTIONS = [
  { value: "mm", label: "millimeter (mm)" },
  { value: "cm", label: "centimeter (cm)" },
  { value: "m", label: "meter (m)" },
  { value: "in", label: "inch (in)" },
  { value: "ft", label: "foot (ft)" },
] as const;
