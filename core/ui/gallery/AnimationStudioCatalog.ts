import type { AetherIconName, LayoutPreset, WorkspacePanelState } from "../src/index";

export type WorkspaceID = "assets" | "modeling" | "animate" | "canvas2d" | "vr" | "show" | "nodes" | "hardware" | "design" | "ui-dev";
export type CenterView = "three-d" | "gallery" | "table";

interface WorkspaceDefinition {
  id: WorkspaceID;
  label: string;
  icon: AetherIconName;
  purpose: string;
}

export interface RibbonCommand {
  id: string;
  label: string;
  icon: AetherIconName;
  group?: string;
  iconOnly?: boolean;
  disabled?: boolean;
}

export interface RibbonSection {
  label: string;
  commands: readonly RibbonCommand[];
}

export interface PartRow {
  primitive?: string;
  positionMM?: readonly [number, number, number];
  id: string;
  part: string;
  source: string;
  version: string;
  parent: string;
  state: "Ready" | "Disconnected";
}

export interface HardwareRow {
  id: string;
  device: string;
  kind: string;
  channels: number;
  status: string;
}

export const workspaces: readonly WorkspaceDefinition[] = [
  { id: "assets", label: "Assets", icon: "import", purpose: "Import and organize character assets and source media" },
  { id: "modeling", label: "3D Modeling", icon: "mate", purpose: "Assemble parts, mates, and subassemblies" },
  { id: "animate", label: "Animate", icon: "animate", purpose: "Author clips, keyframes, and curves" },
  { id: "canvas2d", label: "2D", icon: "layers", purpose: "Compose 2D surfaces, faces, and media" },
  { id: "vr", label: "VR", icon: "view", purpose: "Perform a live avatar driven by face tracking" },
  { id: "show", label: "Show", icon: "show", purpose: "Sequence characters, media, screens, and events" },
  { id: "nodes", label: "Nodes", icon: "sketch-nodes", purpose: "Plan scene logic, cues, gates, and events" },
  { id: "hardware", label: "Hardware", icon: "hardware", purpose: "Map, calibrate, monitor, and safely arm outputs" },
  { id: "design", label: "Design", icon: "design", purpose: "Sandbox future in-app CAD tools and part properties" },
];

export const ribbonCatalog: Record<WorkspaceID, readonly RibbonSection[]> = {
  assets: [
    { label: "Create", commands: [
      { id: "character-3d", label: "3D Character", icon: "cube" },
      { id: "character-2d", label: "2D Character", icon: "file-character" },
      { id: "character-vr", label: "VR Character", icon: "view" },
    ] },
    { label: "Import", commands: [
      { id: "character", label: "Character", icon: "file-character" },
      { id: "model", label: "3D Model", icon: "cube" },
      { id: "audio", label: "Audio", icon: "animate" },
      { id: "video", label: "Video", icon: "play" },
      { id: "image", label: "Image", icon: "image" },
      { id: "led", label: "LED Layout", icon: "apps" },
      { id: "batch", label: "Batch", icon: "layers" },
    ] },
    { label: "Manage", commands: [
      { id: "relink", label: "Relink", icon: "link" },
      { id: "replace", label: "Replace", icon: "redo" },
      { id: "reimport", label: "Reimport", icon: "import" },
      { id: "reveal", label: "Reveal", icon: "search" },
      { id: "folder", label: "Folder", icon: "folder-add" },
      { id: "duplicate", label: "Duplicate", icon: "layers" },
    ] },
    { label: "Prepare", commands: [
      { id: "units", label: "Units", icon: "settings" },
      { id: "up-axis", label: "Up Axis", icon: "planes-axes" },
      { id: "origin", label: "Origin", icon: "fit" },
      { id: "hierarchy", label: "Hierarchy", icon: "items" },
      { id: "map-nodes", label: "Map Nodes", icon: "node-select" },
      { id: "validate", label: "Validate", icon: "status-incomplete" },
    ] },
  ],
  modeling: [
    { label: "Build", commands: [
      { id: "box", label: "Box", icon: "box", group: "Create" },
      { id: "cylinder", label: "Cylinder", icon: "cylindrical", group: "Create" },
      { id: "sphere", label: "Sphere", icon: "ball", group: "Create" },
      { id: "empty-point", label: "Empty Point", icon: "plus", group: "Create" },
      { id: "locator", label: "Locator", icon: "fit", group: "Structure" },
      { id: "build-more", label: "More", icon: "more-circle", group: "Structure", iconOnly: true },
    ] },
    { label: "Mates", commands: [
      { id: "fastened", label: "Fastened", icon: "fastened" },
      { id: "parallel", label: "Parallel", icon: "parallel" },
      { id: "pin-slot", label: "Pin Slot", icon: "pin_slot" },
      { id: "width", label: "Width", icon: "mate" },
      { id: "tangent", label: "Tangent", icon: "mate" },
      { id: "revolute", label: "Revolute", icon: "revolute" },
      { id: "slider", label: "Slider", icon: "slider" },
      { id: "cylindrical", label: "Cylindrical", icon: "cylindrical" },
      { id: "planar", label: "Planar", icon: "planar" },
      { id: "ball", label: "Ball", icon: "ball" },
    ] },
    { label: "Relations", commands: [
      { id: "gear", label: "Gear", icon: "settings" },
      { id: "rack", label: "Rack", icon: "mate" },
      { id: "screw", label: "Screw", icon: "cylindrical" },
      { id: "linear", label: "Linear", icon: "parallel" },
    ] },
    { label: "Inspect", commands: [
      { id: "measure", label: "Measure", icon: "view" },
      { id: "section", label: "Section", icon: "surface-map" },
      { id: "limits", label: "Limits", icon: "gauge" },
    ] },
  ],
  animate: [
    { label: "Transport", commands: [
      { id: "stop", label: "Stop", icon: "close" },
      { id: "play", label: "Play", icon: "play" },
      { id: "loop", label: "Loop", icon: "redo" },
      { id: "previous-key", label: "Previous Key", icon: "undo" },
      { id: "next-key", label: "Next Key", icon: "redo" },
      { id: "frame", label: "Frame", icon: "fit" },
      { id: "grid", label: "Grid", icon: "layout" },
      { id: "more", label: "More", icon: "more-circle" },
    ] },
    { label: "Keyframes", commands: [
      { id: "add-key", label: "Add Key", icon: "file-clip" },
      { id: "delete-key", label: "Delete", icon: "delete" },
      { id: "copy-key", label: "Copy", icon: "layers" },
      { id: "paste-key", label: "Paste", icon: "import" },
      { id: "auto-key", label: "Auto Key", icon: "status-error" },
      { id: "snap-key", label: "Snap", icon: "fit" },
      { id: "reverse-key", label: "Reverse", icon: "parallel" },
    ] },
    { label: "Curves", commands: [
      { id: "hold", label: "Hold", icon: "step" },
      { id: "linear", label: "Linear", icon: "parallel" },
      { id: "bezier", label: "Bézier", icon: "animate" },
      { id: "ease-in", label: "Ease In", icon: "slider" },
      { id: "ease-out", label: "Ease Out", icon: "slider" },
      { id: "graph", label: "Graph", icon: "gauge" },
    ] },
    { label: "Tracks", commands: [
      { id: "add-track", label: "Add Track", icon: "plus" },
      { id: "group-track", label: "Group", icon: "folder" },
      { id: "mute-track", label: "Mute", icon: "hidden" },
      { id: "solo-track", label: "Solo", icon: "visible" },
      { id: "lock-track", label: "Lock", icon: "settings" },
      { id: "layers-track", label: "Layers", icon: "layers" },
      { id: "timeline", label: "Timeline", icon: "layout" },
    ] },
    { label: "Reference", commands: [
      { id: "reference-audio", label: "Audio", icon: "animate" },
      { id: "reference-video", label: "Video", icon: "play" },
      { id: "marker", label: "Marker", icon: "fit" },
      { id: "lip-sync", label: "Lip Sync", icon: "file-character" },
      { id: "beat", label: "Beat", icon: "gauge" },
    ] },
    { label: "Keys", commands: [
      { id: "select-key", label: "Select", icon: "node-select" },
      { id: "move-key", label: "Move", icon: "mouse" },
      { id: "scale-key", label: "Scale", icon: "fit" },
      { id: "break-key", label: "Break", icon: "connector" },
    ] },
    { label: "Playback", commands: [
      { id: "record", label: "Record", icon: "status-error" },
      { id: "preview", label: "Preview", icon: "play" },
      { id: "range", label: "Range", icon: "slider" },
      { id: "speed", label: "Speed", icon: "gauge" },
    ] },
    { label: "Edit", commands: [
      { id: "select", label: "Select", icon: "node-select" },
      { id: "ghost", label: "Ghost", icon: "layers" },
      { id: "mirror", label: "Mirror", icon: "parallel" },
      { id: "duplicate-keys", label: "Duplicate", icon: "layers" },
    ] },
  ],
  canvas2d: [
    { label: "Surfaces", commands: [
      { id: "2d-surface", label: "Surface", icon: "surface" },
      { id: "2d-group", label: "Group", icon: "layers" },
      { id: "2d-mask", label: "Mask", icon: "surface-map" },
    ] },
    { label: "Media", commands: [
      { id: "2d-image", label: "Image", icon: "image" },
      { id: "2d-video", label: "Video", icon: "play" },
      { id: "2d-face", label: "Face", icon: "file-character" },
    ] },
    { label: "Output", commands: [
      { id: "2d-led", label: "LED", icon: "apps" },
      { id: "2d-screen", label: "Screen", icon: "window" },
      { id: "2d-preview", label: "Preview", icon: "view" },
    ] },
  ],
  vr: [
    { label: "Avatar", commands: [
      { id: "vr-avatar", label: "Avatar", icon: "file-character" },
      { id: "vr-blendshapes", label: "Blendshapes", icon: "animate" },
      { id: "vr-calibrate", label: "Calibrate", icon: "fit" },
    ] },
    { label: "Tracking", commands: [
      { id: "vr-camera", label: "Camera", icon: "webcam" },
      { id: "vr-bind", label: "Bindings", icon: "link" },
      { id: "vr-monitor", label: "Monitor", icon: "gauge" },
    ] },
  ],
  show: [
    { label: "Sequence", commands: [
      { id: "character-track", label: "Character", icon: "file-character" },
      { id: "audio-track", label: "Audio", icon: "animate" },
      { id: "video-track", label: "Video", icon: "play" },
      { id: "screen-track", label: "Screen", icon: "window" },
      { id: "led-track", label: "LED", icon: "apps" },
      { id: "event-track", label: "Event", icon: "wireless" },
    ] },
    { label: "Clips", commands: [
      { id: "animation-clip", label: "Animation", icon: "file-clip" },
      { id: "trim-clip", label: "Trim", icon: "slider" },
      { id: "split-clip", label: "Split", icon: "connector" },
      { id: "loop-clip", label: "Loop", icon: "redo" },
      { id: "crossfade", label: "Crossfade", icon: "animate" },
      { id: "clip-speed", label: "Speed", icon: "gauge" },
    ] },
    { label: "Events", commands: [
      { id: "trigger", label: "Trigger", icon: "wireless" },
      { id: "on-off", label: "On / Off", icon: "visible" },
      { id: "event-curve", label: "Curve", icon: "animate" },
      { id: "message", label: "Message", icon: "comment" },
      { id: "hardware-event", label: "Hardware", icon: "hardware" },
      { id: "network-event", label: "Network", icon: "wireless" },
    ] },
    { label: "Sync", commands: [
      { id: "timecode", label: "Timecode", icon: "history" },
      { id: "show-marker", label: "Marker", icon: "fit" },
      { id: "pre-roll", label: "Pre-roll", icon: "undo" },
      { id: "scene", label: "Scene", icon: "scene" },
      { id: "show-timeline", label: "Timeline", icon: "layout" },
      { id: "show-grid", label: "Grid", icon: "layout" },
    ] },
    { label: "Nodes", commands: [
      { id: "show-node-scene", label: "Scene", icon: "scene" },
      { id: "show-node-trigger", label: "Trigger", icon: "wireless" },
      { id: "show-node-clip", label: "Clip", icon: "file-clip" },
      { id: "show-node-branch", label: "Branch", icon: "parallel" },
      { id: "show-node-wait", label: "Wait", icon: "history" },
      { id: "show-node-event", label: "Event", icon: "connector" },
    ] },
    { label: "Output", commands: [
      { id: "show-output-audio", label: "Audio", icon: "animate" },
      { id: "show-output-video", label: "Video", icon: "play" },
      { id: "show-output-light", label: "Light", icon: "lighting" },
      { id: "show-output-screen", label: "Screen", icon: "window" },
      { id: "show-output-led", label: "LED", icon: "apps" },
      { id: "show-output-hardware", label: "Hardware", icon: "hardware" },
    ] },
    { label: "Edit", commands: [
      { id: "show-select", label: "Select", icon: "node-select" },
      { id: "show-connect", label: "Connect", icon: "connector" },
      { id: "show-sequence", label: "Sequence", icon: "items" },
      { id: "show-duplicate", label: "Duplicate", icon: "layers" },
      { id: "show-delete", label: "Delete", icon: "delete" },
      { id: "show-validate", label: "Validate", icon: "status-incomplete" },
    ] },
  ],
  nodes: [
    { label: "Create", commands: [
      { id: "node-flow", label: "Flow", icon: "play" },
      { id: "node-logic", label: "Logic", icon: "parallel" },
      { id: "node-condition", label: "Condition", icon: "connector" },
      { id: "node-event", label: "Event", icon: "wireless" },
      { id: "node-output", label: "Output", icon: "export" },
    ] },
    { label: "Graph", commands: [
      { id: "node-select", label: "Select", icon: "node-select" },
      { id: "node-connect", label: "Connect", icon: "connector" },
      { id: "node-frame", label: "Frame All", icon: "fit" },
      { id: "node-validate", label: "Validate", icon: "status-incomplete" },
    ] },
  ],
  hardware: [
    { label: "Connection", commands: [
      { id: "connect", label: "Connect", icon: "connector" },
      { id: "rescan", label: "Rescan", icon: "redo" },
      { id: "serial", label: "Serial", icon: "link" },
      { id: "network", label: "Network", icon: "wireless" },
      { id: "diagnostics", label: "Diagnostics", icon: "gauge" },
    ] },
    { label: "Outputs", commands: [
      { id: "servo", label: "Servo", icon: "hardware" },
      { id: "controller", label: "PCA9685", icon: "settings" },
      { id: "stepper", label: "Stepper", icon: "slider" },
      { id: "dynamixel", label: "DYNAMIXEL", icon: "connector" },
      { id: "digital", label: "Digital", icon: "visible" },
      { id: "pwm", label: "PWM", icon: "animate" },
      { id: "led", label: "LED", icon: "apps" },
      { id: "screen", label: "Screen", icon: "window" },
      { id: "plugin", label: "Plugin", icon: "apps" },
    ] },
    { label: "Mapping", commands: [
      { id: "map-dof", label: "Map DOF", icon: "node-select" },
      { id: "range", label: "Range", icon: "slider" },
      { id: "reverse", label: "Reverse", icon: "parallel" },
      { id: "neutral", label: "Neutral", icon: "fit" },
      { id: "deadband", label: "Deadband", icon: "gauge" },
      { id: "curve", label: "Curve", icon: "animate" },
      { id: "velocity", label: "Velocity", icon: "gauge" },
      { id: "acceleration", label: "Acceleration", icon: "gauge" },
      { id: "smoothing", label: "Smoothing", icon: "animate" },
    ] },
    { label: "Calibration", commands: [
      { id: "jog", label: "Jog", icon: "mouse" },
      { id: "calibration-neutral", label: "Neutral", icon: "fit" },
      { id: "sweep", label: "Sweep", icon: "redo" },
      { id: "set-min", label: "Set Min", icon: "undo" },
      { id: "set-max", label: "Set Max", icon: "redo" },
      { id: "test-channel", label: "Test Channel", icon: "play" },
      { id: "test-rig", label: "Test Rig", icon: "file-character" },
    ] },
    { label: "Safety", commands: [
      { id: "arm", label: "Arm", icon: "hardware" },
      { id: "estop", label: "E-Stop", icon: "status-error" },
      { id: "failsafe", label: "Failsafe", icon: "status-incomplete" },
      { id: "safe-pose", label: "Safe Pose", icon: "file-character" },
      { id: "limits", label: "Limits", icon: "gauge" },
      { id: "reset-fault", label: "Reset Fault", icon: "redo" },
    ] },
    { label: "Monitor", commands: [
      { id: "channels", label: "Channels", icon: "items" },
      { id: "position", label: "Position", icon: "fit" },
      { id: "health", label: "Health", icon: "status-incomplete" },
      { id: "latency", label: "Latency", icon: "history" },
      { id: "logs", label: "Logs", icon: "document" },
      { id: "export-logs", label: "Export", icon: "export" },
      { id: "firmware", label: "Firmware", icon: "settings" },
    ] },
  ],
  design: [
    { label: "Design", commands: [
      { id: "design-sketch", label: "Sketch", icon: "sketch", group: "Create" },
      { id: "design-extrude", label: "Extrude", icon: "box", group: "Create" },
      { id: "design-revolve", label: "Revolve", icon: "redo", group: "Create" },
      { id: "design-loft", label: "Loft", icon: "surface", group: "Create" },
      { id: "design-sweep", label: "Sweep", icon: "animate", group: "Create" },
      { id: "design-fillet", label: "Fillet", icon: "cylindrical", group: "Modify" },
      { id: "design-shell", label: "Shell", icon: "cube", group: "Modify" },
      { id: "design-mirror", label: "Mirror", icon: "parallel", group: "Pattern" },
      { id: "design-measure", label: "Measure", icon: "gauge", group: "Utility" },
    ] },
    { label: "Sketch", commands: [
      { id: "design-line", label: "Line", icon: "sketch" },
      { id: "design-rectangle", label: "Rectangle", icon: "box" },
      { id: "design-circle", label: "Circle", icon: "ball" },
      { id: "design-trim", label: "Trim", icon: "delete" },
    ] },
    { label: "Inspect", commands: [
      { id: "design-properties", label: "Properties", icon: "settings" },
      { id: "design-measure-inspect", label: "Measure", icon: "gauge" },
    ] },
  ],
  "ui-dev": [
    { label: "App Surfaces", commands: [
      { id: "templates", label: "All Templates", icon: "window" },
      { id: "variants", label: "Variants", icon: "layout" },
      { id: "nodes", label: "Nodes", icon: "sketch-nodes" },
      { id: "design-sandbox", label: "Design", icon: "design" },
      { id: "agent", label: "Agent", icon: "aether" },
      { id: "navigator", label: "Navigator", icon: "sidebar" },
      { id: "inspector", label: "Inspector", icon: "settings" },
      { id: "timeline-preview", label: "Timeline", icon: "animate" },
      { id: "workspace-3d", label: "3D View", icon: "cube" },
      { id: "floating-window", label: "Floating Window", icon: "window" },
    ] },
    { label: "Interaction Labs", commands: [
      { id: "mate-editor", label: "Mate Editor", icon: "mate" },
      { id: "triad", label: "Triad", icon: "planes-axes" },
    ] },
    { label: "Patterns", commands: [
      { id: "references", label: "References", icon: "layers" },
      { id: "panels", label: "Panels", icon: "window" },
      { id: "dialogs", label: "Dialogs", icon: "comment" },
      { id: "popovers", label: "Popovers", icon: "comment" },
    ] },
    { label: "Controls", commands: [
      { id: "buttons", label: "Buttons", icon: "mouse" },
      { id: "inputs", label: "Inputs", icon: "text" },
      { id: "menus", label: "Menus", icon: "menu" },
    ] },
    { label: "Foundations", commands: [
      { id: "ui-kit", label: "UI Kit", icon: "palette" },
      { id: "overview", label: "Overview", icon: "apps" },
      { id: "tokens", label: "Tokens", icon: "palette" },
    ] },
  ],
};

export const defaultRibbonSections: Record<WorkspaceID, string> = {
  assets: "Create",
  modeling: "Build",
  animate: "Keyframes",
  canvas2d: "Surfaces",
  vr: "Avatar",
  show: "Sequence",
  nodes: "Create",
  hardware: "Connection",
  design: "Design",
  "ui-dev": "App Surfaces",
};

export const initialParts: readonly PartRow[] = [
  ["part-1", "arcada001_-_part_1_2", "ARCADA001 - Part 1 (2).step", "V1", "Character origin", "Ready"],
  ["part-2", "arcada001_-_arcad004", "ARCADA001 - ARCAD004.step", "V1", "Character origin", "Ready"],
  ["part-3", "arcada001_-_arcadp001", "ARCADA001 - ARCADP001.step", "V1", "Character origin", "Ready"],
  ["part-4", "arcada001_-_arcadp002_1", "ARCADA001 - ARCADP002 (1).step", "V1", "Character origin", "Ready"],
  ["part-5", "arcada001_-_arcadp002", "ARCADA001 - ARCADP002.step", "V1", "Character origin", "Ready"],
  ["part-6", "arcada001_-_arcadp003_1", "ARCADA001 - ARCADP003 (1).step", "V1", "Character origin", "Ready"],
  ["part-7", "arcada001_-_arcadp003", "ARCADA001 - ARCADP003.step", "V1", "Character origin", "Ready"],
  ["part-8", "arcada001_-_arcadp005", "ARCADA001 - ARCADP005.step", "V1", "Character origin", "Ready"],
  ["part-9", "arcada001_-_part_1_10", "ARCADA001 - Part 1 (10).step", "V1", "Character origin", "Ready"],
  ["part-10", "arcada001_-_part_1_12", "ARCADA001 - Part 1 (12).step", "V1", "Character origin", "Ready"],
  ["part-11", "arcada001_-_lcd_screen", "ARCADA001 - lcd screen .step", "V1", "Character origin", "Disconnected"],
].map(([id, part, source, version, parent, state]) => ({
  id, part, source, version, parent, state: state as PartRow["state"],
}));

export const hardwareRows: readonly HardwareRow[] = [
  { id: "servo-a", device: "Head controller", kind: "JaegerOS bridge", channels: 12, status: "Connected" },
  { id: "servo-b", device: "Jaw servos", kind: "PWM bank", channels: 4, status: "Armed off" },
  { id: "screen", device: "Face display", kind: "LED canvas", channels: 1, status: "Preview" },
];

export const defaultPanelLayouts: Record<LayoutPreset, WorkspacePanelState> = {
  floating: {
    navigator: { placement: "hidden" }, collections: { placement: "hidden" }, media: { placement: "hidden" },
    assemblies: { placement: "hidden" }, scripts: { placement: "hidden" }, clips: { placement: "hidden" },
    view: { placement: "hidden" }, environment: { placement: "hidden" }, appearance: { placement: "hidden" },
    performance: { placement: "hidden" }, inspector: { placement: "hidden" },
  },
  docked: {
    navigator: { placement: "docked" }, collections: { placement: "hidden" }, media: { placement: "hidden" },
    assemblies: { placement: "hidden" }, scripts: { placement: "hidden" }, clips: { placement: "hidden" },
    view: { placement: "hidden" }, environment: { placement: "hidden" }, appearance: { placement: "hidden" },
    performance: { placement: "hidden" }, inspector: { placement: "docked" },
  },
  canvas: {
    navigator: { placement: "docked" }, collections: { placement: "hidden" }, media: { placement: "hidden" },
    assemblies: { placement: "hidden" }, scripts: { placement: "hidden" }, clips: { placement: "hidden" },
    view: { placement: "hidden" }, environment: { placement: "hidden" }, appearance: { placement: "hidden" },
    performance: { placement: "hidden" }, inspector: { placement: "docked" },
  },
};
