/** Gallery-only documents. These do not implement product file formats or engines. */
export type StudyApp = "sketch" | "map" | "io";
export interface StudyItem {
  id: string; name: string; kind: string; color: string; visible: boolean;
  x: number; y: number; opacity: number; weight: number;
  bounds: readonly [number, number, number, number];
}
export interface StudyDefinition {
  title: string; document: string; filename: string; collection: string; secondary: string;
  accent: string; unit: string; description: string; items: readonly StudyItem[];
  tools: readonly { id: string; label: string; icon: string }[];
}
const item = (id: string, name: string, kind: string, bounds: StudyItem["bounds"], color: string): StudyItem => ({ id, name, kind, bounds, color, x: 0, y: 0, opacity: 100, weight: 2, visible: true });
export const studies: Record<StudyApp, StudyDefinition> = {
  sketch: {
    title: "Aether Sketch Studio", document: "Orbit speaker", filename: "Orbit.sketch", collection: "Layers", secondary: "Drawing objects", accent: "#a9c4ce", unit: "px",
    description: "A vector drawing study. Select paths, move objects, change strokes and add circles or rectangles. This local demo does not replace the Sketch editor.",
    items: [
      item("enclosure", "Enclosure outline", "Path", [244, 113, 338, 466], "#d8e0e1"),
      item("driver", "Acoustic driver", "Compound path", [278, 275, 270, 270], "#a8c9d0"),
      item("tweeter", "High-frequency driver", "Ellipse", [345, 154, 136, 106], "#d8e0e1"),
      item("profile", "Side elevation", "Path", [667, 136, 99, 442], "#82989e"),
      item("dimensions", "Dimensions & guides", "Annotations", [164, 80, 666, 552], "#718a92"),
    ],
    tools: [{id:"select",label:"Select",icon:"cursor"},{id:"move",label:"Move",icon:"move"},{id:"pan",label:"Pan canvas",icon:"hand"},{id:"add-circle",label:"Add circle",icon:"circle"},{id:"add-rectangle",label:"Add rectangle",icon:"rectangle"}],
  },
  map: {
    title: "Aether Map Studio", document: "Prism pavilion", filename: "Prism.map", collection: "Surfaces", secondary: "Mapped surfaces", accent: "#58cfe5", unit: "px",
    description: "A projection-mapping stage study. Select surfaces, adjust position and intensity, and preview the animated light pattern. Output stays inside this demo; no projector is connected.",
    items: [
      item("left", "Left wing", "Projection surface", [125, 240, 240, 285], "#40c6e3"),
      item("right", "Right wing", "Projection surface", [635, 240, 240, 285], "#9980f4"),
      item("portal", "Central portal", "Projection surface", [365, 175, 270, 360], "#54d6e4"),
      item("crown", "Crown", "Projection surface", [275, 95, 450, 80], "#c8a4ef"),
      item("plinth", "Stage fascia", "Projection surface", [125, 535, 750, 52], "#619cbf"),
    ],
    tools: [{id:"select",label:"Select",icon:"cursor"},{id:"move",label:"Move surface",icon:"move"},{id:"pan",label:"Pan canvas",icon:"hand"},{id:"guides",label:"Surface guides",icon:"rectangle-dashed"},{id:"play",label:"Play preview",icon:"play"}],
  },
  io: {
    title: "Aether IO Studio", document: "Orbit controller", filename: "Orbit.io", collection: "Components", secondary: "Board components", accent: "#82d3b2", unit: "px",
    description: "An electronics layout study with a sample controller board. Select and move components, inspect their footprint, and toggle the copper overlay. This is a visual demo, not circuit simulation or fabrication output.",
    items: [
      item("mcu", "U1 · Microcontroller", "QFP-48", [400, 260, 168, 168], "#789a91"),
      item("usb", "J1 · USB-C", "USB-C receptacle", [145, 284, 110, 112], "#b7c5c3"),
      item("power", "U2 · Power regulator", "SOT-223", [290, 171, 100, 75], "#789a91"),
      item("header", "J2 · Expansion header", "2 × 8 header", [663, 207, 88, 256], "#d3bd82"),
      item("crystal", "Y1 · Crystal", "3225 oscillator", [443, 473, 89, 42], "#bec8c4"),
      item("passives", "Passives & indicators", "R / C / LED", [287, 446, 345, 97], "#baa47a"),
    ],
    tools: [{id:"select",label:"Select",icon:"cursor"},{id:"move",label:"Move component",icon:"move"},{id:"pan",label:"Pan canvas",icon:"hand"},{id:"guides",label:"Component outlines",icon:"rectangle-dashed"},{id:"copper",label:"Copper traces",icon:"nodes"}],
  },
};
export const freshStudy = (app: StudyApp): StudyItem[] => studies[app].items.map(value => ({...value}));
