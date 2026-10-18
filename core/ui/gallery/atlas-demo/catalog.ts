/** WorkspaceCatalog.swift — the seven CodexUI workspaces and their ribbon groups, verbatim. */
import { AD, group, tool, type ToolGroup } from "../../src/Kit";

export type AtlasWorkspace = "assets" | "rig" | "animate" | "show" | "hardware" | "nodes" | "uiKit";
export interface AtlasWorkspaceDef { id: AtlasWorkspace; name: string; icon: string; purpose: string }

export const ATLAS_WORKSPACES: readonly AtlasWorkspaceDef[] = [
  { id: "assets", name: "Assets", icon: "package", purpose: "Import, inspect, version, and organize reusable character content." },
  { id: "rig", name: "Rig", icon: "nodes", purpose: "Create parts, connectors, mates, motion limits, and actuator intent." },
  { id: "animate", name: "Animate", icon: "play-circle", purpose: "Author expressive motion with tracks, curves, audio, and live preview." },
  { id: "show", name: "Show", icon: "show", purpose: "Sequence animation, audio, screens, lighting, events, and operator cues." },
  { id: "hardware", name: "Hardware", icon: "hardware", purpose: "Map semantic motion to devices with visible safety and live telemetry." },
  { id: "nodes", name: "Nodes", icon: "nodes", purpose: "Compose deterministic behavior, AI, I/O, and performance logic visually." },
];

const tint = { blue: AD.blue, indigo: AD.purple, teal: AD.teal, purple: AD.purple, orange: AD.warn, red: AD.danger, green: AD.ok, pink: AD.pink } as const;

export const ATLAS_CATALOG: Record<AtlasWorkspace, ToolGroup[]> = {
  assets: [
    group("Import", [tool("characters", "Character"), tool("cube-transparent", "3D Model"), tool("waveform", "Audio"), tool("video", "Video"), tool("image", "Image")], undefined, tint.blue),
    group("Manage", [tool("refresh", "Replace"), tool("search", "Reveal"), tool("folder-add", "Folder"), tool("copy", "Duplicate")], undefined, tint.indigo),
    group("Prepare", [tool("ruler", "Units"), tool("move", "Up Axis"), tool("target", "Origin"), tool("list-tree", "Hierarchy"), tool("shield-check", "Validate")], undefined, tint.teal),
  ],
  rig: [
    group("Structure", [tool("cube", "Box"), tool("cylinder", "Cylinder"), tool("grid-cross", "Sphere"), tool("target", "Locator")], undefined, tint.teal),
    group("Mates", [tool("link", "Fastened"), tool("rotate-3d", "Revolute"), tool("arrows-vertical", "Slider"), tool("cylindrical", "Cylindrical"), tool("layers", "Planar"), tool("hexgrid", "Ball")], undefined, tint.purple),
    group("Relations", [tool("gears", "Gear"), tool("swap-horizontal", "Rack"), tool("scribble-variable", "Screw"), tool("equal", "Linear")], undefined, tint.orange),
    group("Inspect", [tool("ruler", "Measure"), tool("split-diagonal", "Section"), tool("gauge", "Limits")], undefined, tint.blue),
  ],
  animate: [
    group("Keyframes", [tool("keyframe-filled", "Auto Key"), tool("keyframe-add", "Insert"), tool("skip-forward", "Hold"), tool("spline", "Bezier")], undefined, tint.blue),
    group("Motion", [tool("figure", "Pose"), tool("arrows-horizontal", "Mirror"), tool("repeat", "Loop"), tool("contrast", "Blend")], undefined, tint.purple),
    group("Capture", [tool("record", "Record"), tool("pencil", "Puppet"), tool("mic", "Audio"), tool("face", "Face")], undefined, tint.red),
  ],
  show: [
    group("Create Cue", [tool("figure-wave", "Animation"), tool("audio", "Audio"), tool("display", "Screen"), tool("lighting", "Lighting"), tool("bolt", "Event")], undefined, tint.orange),
    group("Sequence", [tool("rectangle-group", "Scene"), tool("swap-horizontal", "Transition"), tool("flag", "Marker"), tool("repeat", "Loop")], undefined, tint.blue),
    group("Run", [tool("play", "Rehearse"), tool("play-filled", "Go"), tool("pause", "Hold"), tool("stop", "Stop")], undefined, tint.green),
  ],
  hardware: [
    group("Connections", [tool("wireless", "Discover"), tool("hardware", "Connect"), tool("drive", "Driver")], undefined, tint.blue),
    group("Map", [tool("sliders", "Servo"), tool("refresh", "Stepper"), tool("hexagon", "Dynamixel"), tool("open-external", "Output")], undefined, tint.purple),
    group("Safety", [tool("shield", "Limits"), tool("stethoscope", "Test"), tool("unlock", "Arm"), tool("octagon", "E-Stop")], undefined, tint.red),
  ],
  nodes: [
    group("Inputs", [tool("bolt", "Trigger"), tool("sensor", "Sensor"), tool("waveform", "Speech"), tool("visible", "Vision")], undefined, tint.blue),
    group("Logic", [tool("branch", "If"), tool("list-numbered", "Select"), tool("clock", "Wait"), tool("repeat", "Loop"), tool("arrow-turn-right", "Call")], undefined, tint.purple),
    group("AI + Media", [tool("brain", "LLM"), tool("mic", "STT"), tool("audio", "TTS"), tool("film-stack", "Clip")], undefined, tint.pink),
    group("Outputs", [tool("figure-walk", "Motion"), tool("display", "Screen"), tool("hardware", "Hardware")], undefined, tint.green),
  ],
  uiKit: [
    group("Catalog", [tool("sidebar", "Panels"), tool("sidebar-right", "Inspectors"), tool("window", "Dialogs"), tool("rectangle-inset", "Popovers")], undefined, tint.blue),
    group("Components", [tool("button", "Buttons"), tool("text-cursor", "Inputs"), tool("menucard", "Menus"), tool("timeline", "Timeline")], undefined, tint.purple),
    group("Review", [tool("grid-dots", "States"), tool("arrows-horizontal-square", "Spacing"), tool("contrast", "Contrast")], undefined, tint.green),
  ],
};
