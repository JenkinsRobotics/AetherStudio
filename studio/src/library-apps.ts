import type { AetherIconName } from "@aether/ui";
import type { CreateMenuChoices } from "./CreateMenu";
export type LibraryAppID = "cad" | "map" | "animation" | "io" | "sketch";
export interface LibraryAppType {
  id: string;
  label: string;
  icon: AetherIconName;
  test: RegExp;
}
export interface LibraryAppConfig {
  brand: string;
  appIcon: LibraryAppID;
  appUrl: string;
  accept: string;
  uploadPattern: RegExp;
  uploadHint: string;
  heroLead: string;
  emptyHint: string;
  fallbackIcon: AetherIconName;
  types: readonly LibraryAppType[];
  menu: CreateMenuChoices;
  start: readonly {
    kind: string;
    title: string;
    tagline: string;
    icon: AetherIconName;
    action?: "new-doc" | "dialog" | "import";
    tooltip?: string;
  }[];
}
export const LIBRARY_APPS: Record<LibraryAppID, LibraryAppConfig> = {
  cad: {
    brand: "Aether CAD",
    appIcon: "cad",
    appUrl: "/cad/index.html",
    accept: ".acpart,.acad,.acasm,.cadpart,.aether,.step,.stp",
    uploadPattern: /\.(acpart|acad|acasm|cadpart|aether|step|stp)$/i,
    uploadHint: "Import an .acpart, .acad, .acasm, .step or legacy CAD file.",
    heroLead: "Create a part, pick up recent work, or bring an existing design into your library.",
    emptyHint: "Create a Part or import a design to get started.",
    fallbackIcon: "file-part",
    types: [
      { id: "part", label: "Parts", icon: "file-part", test: /\.(acpart|cadpart)$/ },
      { id: "assembly", label: "Assemblies", icon: "file-assembly", test: /\.(acasm|aether)$/ },
      { id: "drawing", label: "Drawings", icon: "file-drawing", test: /\.(acdrw|acdraw)$/ },
      { id: "project", label: "Hybrid Designs", icon: "file-project", test: /\.acad$/ },
    ],
    menu: [["design","New design…","file-part"],["project","Hybrid Design","file-project"],["folder","Folder","file-folder"],["part","Part","file-part"],["assembly","Assembly","file-assembly"],["import","Import file…","import"]],
    start: [
      { kind: "part", title: "Part", tagline: "Model exact solid geometry", icon: "file-part", action: "new-doc" },
      { kind: "assembly", title: "Assembly", tagline: "Mate parts into mechanisms", icon: "file-assembly", action: "dialog" },
      { kind: "drawing", title: "Drawing", tagline: "Dimensioned sheets — open a document", icon: "file-drawing", tooltip: "Drawing sheets are created inside an open Part or Assembly document." },
      { kind: "project", title: "Hybrid Design", tagline: "Combine parts and assemblies", icon: "file-project", action: "dialog" },
    ],
  },
  map: {
    brand: "Aether Map",
    appIcon: "map",
    appUrl: "/map/index.html",
    accept: ".aethermap",
    uploadPattern: /\.aethermap$/i,
    uploadHint: "Import an .aethermap show.",
    heroLead: "Create a show, pick up recent work, or bring an existing mapping into your library.",
    emptyHint: "Create a Show to get started.",
    fallbackIcon: "file-show",
    types: [
      { id: "show", label: "Shows", icon: "file-show", test: /\.aethermap$/ },
    ],
    menu: [["folder","Folder","file-folder"],["show","Show","file-show"],["import","Import file…","import"]],
    start: [
      { kind: "show", title: "Show", tagline: "Map projections onto physical geometry", icon: "file-show", action: "new-doc" },
      { kind: "surface", title: "Surface", tagline: "Warp a quad onto a real shape", icon: "layers", tooltip: "Surfaces are authored inside an open show." },
      { kind: "device", title: "Output device", tagline: "Pair a projector over the network", icon: "hardware", tooltip: "Pair a Raspberry Pi from Devices inside an open show." },
    ],
  },
  animation: {
    brand: "Aether Animation",
    appIcon: "animation",
    appUrl: "/animation/index.html",
    accept: ".anima,.aether",
    uploadPattern: /\.(anima|aether)$/i,
    uploadHint: "Import an .anima character or .aether workspace file.",
    heroLead: "Create a character, pick up recent work, or bring an existing rig into your library.",
    emptyHint: "Create a Character or import a rig to get started.",
    fallbackIcon: "file-character",
    types: [
      { id: "character", label: "Characters", icon: "file-character", test: /\.anima$/ },
      { id: "workspace", label: "Workspaces", icon: "file-workspace", test: /\.aether$/ },
      { id: "show", label: "Shows", icon: "file-show", test: /\.show$/ },
    ],
    menu: [["folder","Folder","file-folder"],["character","Character","file-character"],["import","Import file…","import"]],
    start: [
      { kind: "character", title: "Character", tagline: "Rig and pose a machine", icon: "file-character", action: "new-doc" },
      { kind: "clip", title: "Clip", tagline: "Author motion inside a character", icon: "file-clip", tooltip: "Clips are authored inside an open character." },
      { kind: "show", title: "Show", tagline: "Sequence clips for playback", icon: "file-show", tooltip: "Show authoring arrives with the web session bridge." },
      { kind: "project", title: "Project", tagline: "Group related documents", icon: "file-project", tooltip: "Projects are a CAD library feature today." },
    ],
  },
  io: {brand:"Aether IO",appIcon:"io",appUrl:"/io/index.html",accept:".aetherio",uploadPattern:/\.aetherio$/i,uploadHint:"Import an .aetherio circuit.",heroLead:"Create circuits, connect components, and return to your hardware designs.",emptyHint:"Create a circuit to get started.",fallbackIcon:"document",types:[{id:"circuit",label:"Circuits",icon:"document",test:/\.aetherio$/i}],menu:[["circuit","Circuit","document"],["folder","Folder","file-folder"],["import","Import file…","import"]],start:[{kind:"circuit",title:"Circuit",tagline:"Connect components and hardware",icon:"document",action:"new-doc"}]},
  sketch: {brand:"Aether Sketch",appIcon:"sketch",appUrl:"/sketch/index.html",accept:".aethersketch",uploadPattern:/\.aethersketch$/i,uploadHint:"Import an .aethersketch drawing.",heroLead:"Draw shapes, edit paths, and bring your next idea to the canvas.",emptyHint:"Create a sketch to get started.",fallbackIcon:"document",types:[{id:"sketch",label:"Sketches",icon:"document",test:/\.aethersketch$/i}],menu:[["sketch","Sketch","document"],["folder","Folder","file-folder"],["import","Import file…","import"]],start:[{kind:"sketch",title:"Sketch",tagline:"Create paths, shapes and illustrations",icon:"document",action:"new-doc"}]},

};
