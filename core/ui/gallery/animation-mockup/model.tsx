/**
 * The demo's data — ProjectModel / DemoModel / RigModel / AnimationModel /
 * HardwareModel / DesignModel / ShowModel from the Swift source, as one React
 * store. The Swift demo imported real STEP files; the web port has no engine,
 * so it seeds a representative character and lets Import add sample parts.
 * ponytail: one context, plain setState; a reducer if the demo grows verbs.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { group, tool, ribbonGroup, treeNode, treeState, type Mate, type MateType, type RibbonGroup, type ToolCategory, type ToolGroup, type TreeState, type DesignShape, MATE_TYPES, AD } from "../../src/Kit";

export type Workspace = "home" | "character" | "design" | "rig" | "animate" | "show" | "hardware" | "uiKit";

export const WORKSPACES: readonly { id: Workspace; name: string; icon: string }[] = [
  { id: "home", name: "Home", icon: "grid-2" },
  { id: "character", name: "Character", icon: "figure-stand" },
  { id: "design", name: "Design", icon: "copy" },
  { id: "rig", name: "Rig", icon: "nodes" },
  { id: "animate", name: "Animate", icon: "curve" },
  { id: "show", name: "Show", icon: "rectangle-group" },
  { id: "hardware", name: "Hardware", icon: "cpu" },
];
/** The tabs in the top bar — Design is the sandbox and is reached from Home. */
export const PIPELINE: readonly Workspace[] = ["character", "rig", "animate", "show", "hardware"];
export const workspaceDef = (id: Workspace) => WORKSPACES.find((w) => w.id === id)!;

export interface Part { id: string; name: string; faces: number; edges: number; triangles: number; importMs: number }
export interface Character { id: string; name: string; parts: string[]; sourceAssets: string[]; groups: string[]; clips: number; channels: number }
export interface Keyframe { time: number; value: number }
export interface Clip { id: string; name: string; duration: number; tracks: { mateID: string; keys: Keyframe[] }[] }
export interface ServoChannel { id: string; mateID: string; channel: number; name: string; trimDegrees: number; inverted: boolean; minPulse: number; maxPulse: number }

let serial = 0;
const id = (p: string) => `${p}-${++serial}`;

const SAMPLE_PARTS: Part[] = [
  { id: id("part"), name: "Rover Base", faces: 42, edges: 118, triangles: 8204, importMs: 312 },
  { id: id("part"), name: "Bracket L", faces: 18, edges: 52, triangles: 2410, importMs: 96 },
  { id: id("part"), name: "Bracket R", faces: 18, edges: 52, triangles: 2410, importMs: 94 },
  { id: id("part"), name: "Cover", faces: 26, edges: 70, triangles: 5180, importMs: 188 },
];

const mate = (name: string, type: MateType, parent: string, child: string, value = 0): Mate => ({
  id: id("mate"), name, type, parent, child, axis: "Z", value,
  minValue: MATE_TYPES.find((t) => t.id === type)!.driven ? -90 : 0, maxValue: MATE_TYPES.find((t) => t.id === type)!.driven ? 90 : 0,
});

export interface DemoStore {
  projectName: string;
  saved: boolean; setSaved: (v: boolean) => void;
  status: string; setStatus: (s: string) => void;
  characters: Character[]; activeCharacterID: string | null; setActiveCharacterID: (id: string | null) => void;
  addCharacter: (name?: string) => Character;
  parts: Part[]; selectedPartID: string | null; setSelectedPartID: (id: string | null) => void;
  importModel: () => void; importing: { title: string; detail: string; progress: number; countText: string } | null; removePart: (id: string) => void;
  partsTree: TreeState; setPartsTree: (t: TreeState) => void;
  assembly: TreeState; setAssembly: (t: TreeState) => void;
  mates: Mate[]; setMates: (m: Mate[]) => void; selectedMateID: string | null; setSelectedMateID: (id: string | null) => void;
  selectedParts: string[]; setSelectedParts: (ids: string[]) => void;
  addMate: (type: MateType) => void; removeMate: (id: string) => void;
  clips: Clip[]; selectedClipID: string | null; setSelectedClipID: (id: string | null) => void; addClip: () => void;
  time: number; isPlaying: boolean; setPlaying: (v: boolean) => void; scrub: (fraction: number) => void; addKey: (mateID: string, value: number) => void;
  channels: ServoChannel[]; setChannels: (c: ServoChannel[]) => void; armed: boolean; setArmed: (v: boolean) => void;
  selectedChannelID: string | null; setSelectedChannelID: (id: string | null) => void; controllerSelected: boolean; setControllerSelected: (v: boolean) => void;
  shapes: DesignShape[]; setShapes: (s: DesignShape[]) => void; selectedShapeID: string | null; setSelectedShapeID: (id: string | null) => void;
  selectedNode: string | null; setSelectedNode: (n: string | null) => void;
  centerView: string; setCenterView: (v: string) => void;
  importMode: "copy" | "link"; setImportMode: (m: "copy" | "link") => void;
  showNewCharacter: boolean; setShowNewCharacter: (v: boolean) => void;
}

const StoreContext = createContext<DemoStore | null>(null);
export const useDemo = () => {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useDemo needs <DemoProvider>");
  return store;
};

export function DemoProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState(true);
  const [status, setStatus] = useState("Import a STEP file to begin.");
  const [parts, setParts] = useState<Part[]>(SAMPLE_PARTS);
  const [selectedPartID, setSelectedPartID] = useState<string | null>(SAMPLE_PARTS[0].id);
  const [characters, setCharacters] = useState<Character[]>(() => [{ id: id("char"), name: "Rover", parts: SAMPLE_PARTS.map((p) => p.id), sourceAssets: ["rover_assembly.step"], groups: ["Drivetrain"], clips: 1, channels: 2 }]);
  const [activeCharacterID, setActiveCharacterID] = useState<string | null>(characters[0]?.id ?? null);
  const [importing, setImporting] = useState<DemoStore["importing"]>(null);
  const [partsTree, setPartsTree] = useState<TreeState>(() => treeState(SAMPLE_PARTS.map((p) => treeNode(p.name, "cube", { detail: `${p.faces}f`, payload: p.id }))));
  const [assembly, setAssembly] = useState<TreeState>(() => treeState([
    treeNode("Rover Base", "cube", { payload: SAMPLE_PARTS[0].id }),
    treeNode("Arm", "folder", { isFolder: true, children: [treeNode("Bracket L", "cube", { payload: SAMPLE_PARTS[1].id }), treeNode("Bracket R", "cube", { payload: SAMPLE_PARTS[2].id })] }),
  ]));
  const [mates, setMates] = useState<Mate[]>(() => [
    mate("Knee", "revolute", SAMPLE_PARTS[0].id, SAMPLE_PARTS[1].id, 42),
    mate("Jaw", "revolute", SAMPLE_PARTS[0].id, SAMPLE_PARTS[2].id, 12),
    mate("Cover mount", "fastened", SAMPLE_PARTS[0].id, SAMPLE_PARTS[3].id),
  ]);
  const [selectedMateID, setSelectedMateID] = useState<string | null>(mates[0]?.id ?? null);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [clips, setClips] = useState<Clip[]>(() => [{ id: id("clip"), name: "Greeting", duration: 8, tracks: [{ mateID: mates[0].id, keys: [{ time: 0.4, value: 0 }, { time: 2.4, value: 60 }, { time: 5, value: -20 }, { time: 7.2, value: 0 }] }, { mateID: mates[1].id, keys: [{ time: 1, value: 0 }, { time: 3.5, value: 30 }, { time: 6.2, value: 0 }] }] }]);
  const [selectedClipID, setSelectedClipID] = useState<string | null>(clips[0].id);
  const [time, setTime] = useState(2.9);
  const [isPlaying, setPlaying] = useState(false);
  const [channels, setChannels] = useState<ServoChannel[]>(() => mates.filter((m) => MATE_TYPES.find((t) => t.id === m.type)!.driven).map((m, i) => ({ id: id("ch"), mateID: m.id, channel: i, name: m.name, trimDegrees: 0, inverted: false, minPulse: 500, maxPulse: 2500 })));
  const [armed, setArmed] = useState(false);
  const [selectedChannelID, setSelectedChannelID] = useState<string | null>(null);
  const [controllerSelected, setControllerSelected] = useState(true);
  const [shapes, setShapes] = useState<DesignShape[]>([]);
  const [selectedShapeID, setSelectedShapeID] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>("Clip");
  const [centerView, setCenterView] = useState("3D");
  const [importMode, setImportMode] = useState<"copy" | "link">("copy");
  const [showNewCharacter, setShowNewCharacter] = useState(false);

  const store = useMemo<DemoStore>(() => {
    const clip = clips.find((c) => c.id === selectedClipID) ?? clips[0];
    const duration = Math.max(clip?.duration ?? 8, 0.1);
    return {
      projectName: "Rex Animatronic", saved, setSaved, status, setStatus,
      characters, activeCharacterID, setActiveCharacterID,
      addCharacter: (name) => { const c: Character = { id: id("char"), name: name ?? `Character ${characters.length + 1}`, parts: [], sourceAssets: [], groups: [], clips: 0, channels: 0 }; setCharacters([...characters, c]); setActiveCharacterID(c.id); setSaved(false); return c; },
      parts, selectedPartID, setSelectedPartID,
      importing,
      importModel: () => {
        if (importing) return;
        const name = ["wheel_assembly", "gripper", "servo_horn", "mast"][parts.length % 4];
        // Six ticks over ~2s: long enough for the determinate bar to be seen filling.
        const steps = 6;
        let step = 0;
        const report = () => setImporting({ title: "Importing model", detail: `${name}.step`, progress: step / steps, countText: `${step} of ${steps} bodies` });
        report();
        const tick = window.setInterval(() => {
          step += 1;
          if (step >= steps) {
            window.clearInterval(tick);
            const part: Part = { id: id("part"), name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), faces: 12 + parts.length * 3, edges: 40 + parts.length * 9, triangles: 1800 + parts.length * 640, importMs: 120 + parts.length * 30 };
            setParts((ps) => [...ps, part]);
            setPartsTree((t) => ({ ...t, nodes: [...t.nodes, treeNode(part.name, "cube", { detail: `${part.faces}f`, payload: part.id })] }));
            setSelectedPartID(part.id);
            setStatus(`Imported ${part.name} (${importMode === "copy" ? "copied into project" : "linked"})`);
            setImporting(null); setSaved(false);
          } else report();
        }, 330);
      },
      removePart: (pid) => { setParts(parts.filter((p) => p.id !== pid)); if (selectedPartID === pid) setSelectedPartID(null); setSaved(false); },
      partsTree, setPartsTree, assembly, setAssembly,
      mates, setMates, selectedMateID, setSelectedMateID, selectedParts, setSelectedParts,
      addMate: (type) => { if (selectedParts.length < 2) return; const m = mate(`${MATE_TYPES.find((t) => t.id === type)!.label} ${mates.length + 1}`, type, selectedParts[0], selectedParts[1]); setMates([...mates, m]); setSelectedMateID(m.id); setSaved(false); },
      removeMate: (mid) => { setMates(mates.filter((m) => m.id !== mid)); if (selectedMateID === mid) setSelectedMateID(null); },
      clips, selectedClipID, setSelectedClipID,
      addClip: () => { const c: Clip = { id: id("clip"), name: `Clip ${clips.length + 1}`, duration: 8, tracks: [] }; setClips([...clips, c]); setSelectedClipID(c.id); },
      time, isPlaying, setPlaying,
      scrub: (fraction) => setTime(Math.min(Math.max(fraction, 0), 1) * duration),
      addKey: (mateID, value) => {
        if (!clip) return;
        setClips(clips.map((c) => {
          if (c.id !== clip.id) return c;
          const tracks = c.tracks.some((t) => t.mateID === mateID) ? c.tracks : [...c.tracks, { mateID, keys: [] }];
          return { ...c, tracks: tracks.map((t) => t.mateID !== mateID ? t : { ...t, keys: t.keys.some((k) => Math.abs(k.time - time) < 0.01) ? t.keys.map((k) => Math.abs(k.time - time) < 0.01 ? { ...k, value } : k) : [...t.keys, { time, value }] }) };
        }));
      },
      channels, setChannels, armed, setArmed, selectedChannelID, setSelectedChannelID, controllerSelected, setControllerSelected,
      shapes, setShapes, selectedShapeID, setSelectedShapeID,
      selectedNode, setSelectedNode, centerView, setCenterView, importMode, setImportMode, showNewCharacter, setShowNewCharacter,
    };
  }, [saved, status, characters, activeCharacterID, parts, selectedPartID, importing, partsTree, assembly, mates, selectedMateID, selectedParts, clips, selectedClipID, time, isPlaying, channels, armed, selectedChannelID, controllerSelected, shapes, selectedShapeID, selectedNode, centerView, importMode, showNewCharacter]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Linear interpolation between surrounding keys; clamps outside the range. */
export function keyValue(keys: Keyframe[], t: number): number | null {
  if (!keys.length) return null;
  const sorted = [...keys].sort((a, b) => a.time - b.time);
  if (t <= sorted[0].time) return sorted[0].value;
  if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i], b = sorted[i + 1];
    if (t >= a.time && t <= b.time) { const span = b.time - a.time; return span > 0 ? a.value + (b.value - a.value) * ((t - a.time) / span) : b.value; }
  }
  return sorted[sorted.length - 1].value;
}

export const commandedDegrees = (mateValue: number, trim: number, inverted: boolean) => (inverted ? -mateValue : mateValue) + trim;
export const fractionOf = (value: number, lo: number, hi: number) => (hi - lo > 0 ? Math.min(Math.max((value - lo) / (hi - lo), 0), 1) : 0);
export const pulseOf = (fraction: number, minPulse: number, maxPulse: number) => minPulse + (maxPulse - minPulse) * Math.min(Math.max(fraction, 0), 1);

// MARK: - Tool catalogs, verbatim from the Swift workspaces

export const CHARACTER_ACTIONS = new Set(["Character", "3D Model", "Audio", "Video", "Image", "Replace", "Reveal", "Folder", "Duplicate", "Units", "Up Axis", "Origin", "Hierarchy", "Validate"]);

export interface Catalog { groups: ToolGroup[]; categories?: ToolCategory[]; armGroup: RibbonGroup }

export const CATALOG: Record<Exclude<Workspace, "home" | "uiKit">, Catalog> = {
  character: {
    groups: [
      group("Import", [tool("character", "Character"), tool("cube", "3D Model"), tool("waveform", "Audio", false), tool("video", "Video", false), tool("image", "Image", false)], "import", AD.teal),
      group("Manage", [tool("refresh", "Replace"), tool("search", "Reveal"), tool("folder-add", "Folder", false), tool("copy", "Duplicate", false)], "sliders", AD.blue),
      group("Prepare", [tool("ruler", "Units"), tool("validate", "Validate"), tool("arrow-up-to-line", "Up Axis", false), tool("target", "Origin", false), tool("list-tree", "Hierarchy", false)], "tools", AD.warn),
    ],
    armGroup: ribbonGroup("Character", "character", AD.accent, []),
  },
  rig: {
    groups: [
      group("Structure", [tool("box", "Box"), tool("cylinder", "Cylinder"), tool("sphere", "Sphere"), tool("target", "Locator")], "cube-transparent", AD.teal),
      group("Mates", [tool("link", "Fastened"), tool("revolute", "Revolute"), tool("arrows-vertical", "Slider"), tool("cylindrical", "Cylindrical"), tool("stack-3d", "Planar"), tool("grid-dots", "Ball")], "nodes", AD.purple),
      group("Relations", [tool("gears", "Gear"), tool("swap-horizontal", "Rack"), tool("screw", "Screw"), tool("equal", "Linear")], "gears", AD.warn),
      group("Inspect", [tool("measure", "Measure"), tool("split", "Section"), tool("gauge", "Limits")], "search", AD.blue),
    ],
    armGroup: ribbonGroup("Rig", "nodes", AD.accent, []),
  },
  animate: {
    groups: [
      group("Keys", [tool("keyframe", "Key"), tool("pulse", "Curve"), tool("curve", "Ease")], "keyframe", AD.warn),
      group("Playback", [tool("record", "Record"), tool("refresh", "Loop")], "record", AD.danger),
      group("Edit", [tool("select", "Select"), tool("ghost", "Ghost"), tool("mirror", "Mirror")], "cursor", AD.teal),
    ],
    armGroup: ribbonGroup("Animate", "keyframe", AD.accent, []),
  },
  show: {
    groups: [
      group("Nodes", [tool("rectangle-group", "Scene"), tool("trigger", "Trigger"), tool("curve", "Clip")], "rectangle-group", AD.warn),
      group("Output", [tool("audio", "Audio"), tool("screen-play", "Video"), tool("lighting", "Light")], "hardware", AD.blue),
      group("Edit", [tool("select", "Select"), tool("list-numbered", "Sequence")], "cursor", AD.teal),
    ],
    armGroup: ribbonGroup("Show", "rectangle-group", AD.accent, []),
  },
  hardware: {
    groups: [
      group("Wire", [tool("link", "Bind"), tool("bolt", "Arm"), tool("home", "Home")], "link", AD.ok),
      group("Tune", [tool("tools", "Calibrate"), tool("play", "Test"), tool("pulse", "Monitor")], "tools", AD.warn),
    ],
    armGroup: ribbonGroup("Hardware", "cpu", AD.accent, []),
  },
  design: {
    groups: [
      group("Create", [tool("sketch", "Sketch"), tool("extrude", "Extrude"), tool("revolve", "Revolve"), tool("sweep", "Sweep"), tool("loft", "Loft")]),
      group("Modify", [tool("fillet", "Fillet"), tool("shell", "Shell"), tool("draft", "Draft"), tool("hole", "Hole")]),
      group("Pattern", [tool("pattern", "Pattern"), tool("mirror", "Mirror")]),
      group("Utility", [tool("measure", "Measure"), tool("insert", "Insert")]),
    ],
    categories: [
      { name: "Design", groups: [
        // Non-primary tools are the group's "more" tools: in its heading dropdown, not inline.
        group("Create", [tool("extrude", "Extrude"), tool("revolve", "Revolve"), tool("loft", "Loft"), tool("sweep", "Sweep"), tool("thicken", "Thicken", false)]),
        group("Modify", [tool("fillet", "Fillet"), tool("chamfer", "Chamfer"), tool("shell", "Shell"), tool("draft", "Draft"), tool("mirror", "Mirror"), tool("pattern", "Pattern"), tool("split", "Split", false), tool("move", "Transform", false), tool("boolean", "Boolean", false)]),
        group("Utility", [tool("measure", "Measure"), tool("insert", "Insert"), tool("select", "Select")]),
      ] },
      { name: "Sketch", groups: [
        group("Draw", [tool("line", "Line"), tool("rectangle", "Rectangle"), tool("circle", "Circle"), tool("curve", "Spline"), tool("pencil", "Arc")]),
        group("Constrain", [tool("measure", "Dimension"), tool("angle", "Angle"), tool("equal", "Equal")]),
      ] },
      { name: "Surface", groups: [
        group("Create", [tool("face", "Patch"), tool("loft", "Loft"), tool("sweep", "Sweep"), tool("offset", "Extend")]),
        group("Modify", [tool("trim", "Trim"), tool("weld", "Stitch")]),
      ] },
      { name: "Mesh", groups: [group("Prepare", [tool("grid", "Remesh"), tool("wireframe", "Reduce"), tool("check", "Repair")])] },
      { name: "Sheet Metal", groups: [group("Create", [tool("sheet", "Flange"), tool("hinge", "Bend"), tool("sheet", "Unfold")])] },
      { name: "Assemble", groups: [group("Structure", [tool("part", "Component"), tool("connector", "Joint"), tool("pattern", "Pattern")])] },
    ],
    armGroup: ribbonGroup("Design", "pencil", AD.accent, []),
  },
};

// MARK: - CenterTray items, verbatim from the July-19 "Rex" build (popover contents are supplied by the workspace)

export const TRAY_ITEMS: Record<Exclude<Workspace, "home" | "uiKit" | "design">, readonly { icon: string; label: string; popover?: "display" | "environment" | "performance" }[]> = {
  character: [{ icon: "plus", label: "Import" }, { icon: "cube", label: "Display", popover: "display" }, { icon: "appearance-light", label: "Environment", popover: "environment" }, { icon: "gauge", label: "Performance", popover: "performance" }, { icon: "fit", label: "Fit" }],
  rig: [{ icon: "cube", label: "Display", popover: "display" }, { icon: "appearance-light", label: "Environment", popover: "environment" }, { icon: "fit", label: "Fit" }],
  animate: [{ icon: "keyframe-filled", label: "Key" }, { icon: "record", label: "Record" }, { icon: "pulse", label: "Ease" }, { icon: "refresh", label: "Loop" }, { icon: "ghost", label: "Ghost" }],
  show: [{ icon: "plus", label: "Scene" }, { icon: "trigger", label: "Trigger" }, { icon: "audio", label: "Audio" }, { icon: "screen-play", label: "Video" }, { icon: "list-numbered", label: "Sequence" }],
  hardware: [{ icon: "link", label: "Bind" }, { icon: "bolt", label: "Arm" }, { icon: "tools", label: "Calibrate" }, { icon: "play", label: "Test" }, { icon: "home", label: "Home" }],
};

