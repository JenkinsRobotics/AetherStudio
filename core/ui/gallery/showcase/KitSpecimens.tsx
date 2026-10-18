/** UIKit.swift — every component of the Aether demo, one flat Specimen row per widget, filed by section (inventory.ts). */
import { useState, type ReactNode } from "react";
import { sectionTab } from "../showcase";
import { Sym } from "../../src/kit/icons";
import {
  AD, AxisGizmo, Badge, Callout, ChipPicker, CommandButton, CurveCard, DialogCard, Diamond, DocumentTabBar, DocumentTabs, DopeSheetTimeline, EnvironmentPanel,
  FeatureTimeline, Field, GraphNode, InspectorTabs, LabeledSlider, ListRow, LogicNode, MateInspector, MaterialSphere, MetricCard, NodeLibraryRow, NotificationCard, Panel,
  PanelAction, PanelCard, PerformanceHUD, PerspectiveGrid, Pill, ProgressBar, ProgressCard, PropertyField, RadialMenu, Row, SearchField, SegmentedIcons, ServoTrack, StageChip,
  StatusBar, StepperField, SystemStatusView, Toast, ToggleRow, Triangle, ViewCube, ViewportMock, VisualizationIcon, VisualizationPanel, 
  ChannelMapTable, ConnectorField, CueTimeline, DeviceStatusRow, DropZone, NodeCanvas, NodePortRow, RobotViewport, SafetyStatus, ThemeTileGrid, WalkthroughCard,
  WorkspaceStageTabs, STAGE_LABEL_MODES, CalibrationRangeBar, DeviceIdentity, ProjectCard, StatChip, type Mate, type StageLabelMode,
} from "../../src/Kit";
import { WORKSPACES } from "../animation-mockup/model";
import { defaultRenderPrefs } from "../../src/Kit";
import { isModeDuplicate, kitSpecimenSection } from "./inventory";
import { Specimen } from "./Specimen";
import { workspaceDef } from "../animation-mockup/model";

const SAMPLE_TRACKS = [
  { id: "hip", name: "Hip", color: AD.accent, keys: [0.05, 0.3, 0.62, 0.9] }, { id: "knee", name: "Knee", color: AD.accent, keys: [0.12, 0.44, 0.78] }, { id: "jaw", name: "Jaw", color: AD.warn, keys: [0.2, 0.55] },
];
const SAMPLE_DOCS = ["ARCADP001", "ARCADP002", "ARCADP002 Copy 1", "ARCADP003", "ARCADP004"].map((name) => ({ id: name, name }));
const SAMPLE_FEATURES = [["pencil", "Sketch 1"], ["stack-3d", "Extrude 1"], ["contrast", "Fillet 1"], ["flip-horizontal", "Mirror 1"]].map(([icon, title]) => ({ id: title, icon, title }));

export function KitSpecimens({ section }: { section: string }) {
  const [slider, setSlider] = useState(0.4);
  const [seg, setSeg] = useState(0);
  const [toggle, setToggle] = useState(true);
  const [chip, setChip] = useState("24 fps");
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [stepper, setStepper] = useState(45);
  const [inspectorTab, setInspectorTab] = useState(0);
  const [mate, setMate] = useState<Mate>({ id: "sample", name: "Revolute 1", type: "revolute", parent: "hub", child: "rim", axis: "Z", value: 42, minValue: -90, maxValue: 90 });
  const [env, setEnv] = useState(defaultRenderPrefs);
  const [hud, setHud] = useState(false);
  const [labelMode, setLabelMode] = useState<StageLabelMode>("automatic");
  const [themeTile, setThemeTile] = useState("studio");

  const S = (group: string, ...items: [string, ReactNode, boolean?][]) => items.map(([label, view, wide]) =>
    !isModeDuplicate(`kit:${label}`) && kitSpecimenSection("kit", group, label) === section ? <Specimen key={label} source="kit" group={group} label={label} wide={wide}>{view}</Specimen> : null);
  const stage = (view: ReactNode, height: number) => <div className="kit-stage" style={{ height }}>{view}</div>;

  return (
    <>

        {S("Buttons & Pills",
          ["Pill · active, idle, tints", <div className="aui-kit-hstack-8"><Pill icon="play-filled" label="Preview" active /><Pill icon="cube" label="Wireframe" /><Pill label="Key" active tint={AD.warn} /><Pill label="Loop" tint={AD.accent2} /></div>],
          ["Stage chips", <div className="aui-kit-hstack-4"><StageChip stage={workspaceDef("rig")} active /><StageChip stage={workspaceDef("show")} active={false} /></div>],
        )}

        {S("Rows & Fields",
          ["Row · plain and selected + controls", <div className="stack-0" style={{ width: 240, gap: 2 }}><Row icon="cube" label="Femur" detail="12f" tint={AD.accent2} /><Row icon="nodes" label="Knee" detail="revolute" tint={AD.accent} selected controls /></div>],
          ["Fields", <div className="aui-kit-stack-8"><Field label="Axis" value="Z" /><Field label="Angle" value="42.0" unit="°" /><Field label="Triangles" value="18,204" /></div>],
        )}

        {S("Panels & Toolbars",
          ["Panel", <Panel title="Models" systemImage="cube-transparent" style={{ height: 150 }}><div style={{ padding: "4px 0" }}><Row icon="cube" label="Wheel" detail="3f" tint={AD.accent2} /><Row icon="cube" label="Tire" detail="1f" tint={AD.accent2} /></div></Panel>],
        )}

        {S("Contextual Widgets",
          ["Mate inspector", <MateInspector mate={mate} onChange={setMate} parentName="Hub" childName="Rim" />],
          ["Curve card", <CurveCard />],
          ["Environment", <EnvironmentPanel prefs={env} onChange={setEnv} />],
          ["Performance HUD", <PerformanceHUD engine="RealityKit" fps={60} cpuPercent={4.2} memoryMB={318.4} />],
          ["System status", <SystemStatusView />],
        )}

        {S("Timeline & Graph",
          ["Dope-sheet timeline · full width", <DopeSheetTimeline tracks={SAMPLE_TRACKS} progress={0.36} duration={8} style={{ height: 230 }} />, true],
          ["Graph node", <div className="aui-kit-hstack-8" style={{ gap: 20 }}><GraphNode title="Clip" icon="curve" sub="Greeting.anim" tint={AD.accent} selected /><GraphNode title="Servos" icon="cpu" sub="6 channels" tint={AD.accent2} /></div>],
          ["Servo track", <div className="stack-0"><ServoTrack name="Knee" channel={2} degrees={42} fraction={0.55} selected armed /><ServoTrack name="Jaw" channel={4} degrees={12} fraction={0.2} armed /></div>],
        )}

        {S("Panels & Lists",
          ["Panel card · icon badge + subtitle + menu", <PanelCard contentOnly={sectionTab(section) === "widgets"} title="Animation Clips" subtitle="Atlas · 6 clips" icon="film-stack" tint={AD.accent}><div style={{ padding: "4px 0" }}><ListRow icon="video" title="Greeting" detail="8.0 s" selected /><ListRow icon="video" title="Idle Breathing" detail="12.0 s" /><ListRow icon="video" title="Curious Look" detail="4.5 s" /></div><span className="aui-kit-divider" /><div className="aui-kit-hstack-8" style={{ padding: 10 }}><PanelAction icon="plus" label="Clip" /><PanelAction icon="duplicate" /></div></PanelCard>],
          ["List rows · states", <div className="stack-0"><ListRow icon="circle-filled" title="Base Motion" detail="100%" statusColor={AD.ok} /><ListRow icon="contrast" title="Face + Eyes" detail="100%" statusColor={AD.purple} /><ListRow icon="circle" title="Live Puppet" detail="0%" /><ListRow icon="target" title="Nested child" detail="—" level={1} /></div>],
          ["Panel actions", <div className="aui-kit-hstack-8"><PanelAction icon="plus" label="Clip" /><PanelAction icon="duplicate" /><PanelAction label="Rename" /></div>],
        )}

        {S("Visualization",
          ["Material spheres", <div className="aui-kit-hstack-8" style={{ gap: 10 }}><MaterialSphere color={[0.9, 0.13, 0.15]} glossy /><MaterialSphere color={[0.16, 0.16, 0.17]} glossy={false} /><MaterialSphere color={[0.83, 0.68, 0.32]} glossy /><MaterialSphere color={[0.72, 0.73, 0.76]} glossy checkered /></div>],
          ["Visualization icon", <div className="aui-kit-hstack-8"><VisualizationIcon /><span className="kit-chip">Visualization</span></div>],
          ["Visualization panel", <VisualizationPanel />],
        )}

        {S("Node Graph",
          ["Logic nodes · types and states", <div className="aui-kit-hstack-8" style={{ gap: 12, alignItems: "flex-start" }}><div className="aui-kit-stack-10"><LogicNode title="Proximity Sensor" subtitle="input" icon="sensor" color={AD.accent2} outputs={["Distance", "Triggered"]} /><LogicNode title="If / Else" subtitle="logic" icon="branch" color={AD.purple} inputs={["Condition"]} outputs={["True", "False"]} /></div><div className="aui-kit-stack-10"><LogicNode title="Language Model" subtitle="ai + media" icon="brain" color={AD.pink} inputs={["Prompt", "Memory"]} outputs={["Text", "Action"]} selected /><LogicNode title="Servo Output" subtitle="hardware" icon="hardware" color={AD.ok} inputs={["Target"]} outputs={["Complete"]} warning /></div></div>],
          ["Node library", <div className="aui-kit-stack-1" style={{ gap: 2 }}><NodeLibraryRow title="Trigger" category="input" icon="trigger" color={AD.ok} /><NodeLibraryRow title="Clip" category="motion" icon="curve" color={AD.accent} /><NodeLibraryRow title="Servo Bus" category="hardware" icon="cpu" color={AD.accent2} /></div>],
          ["Feature timeline", <FeatureTimeline items={SAMPLE_FEATURES} selectedID={SAMPLE_FEATURES[1].id} />],
          ["Document tabs · floating pill", <DocumentTabBar tabs={SAMPLE_DOCS} selectedID={SAMPLE_DOCS[0].id} />],
        )}

        {S("Inputs",
          ["Search field", <SearchField text={search} onChange={setSearch} />],
          ["Stepper field", <StepperField label="Angle" value={stepper} step={1} unit="°" onChange={setStepper} />],
          ["Inspector tabs", <InspectorTabs tabs={["Properties", "Appearance", "Output"]} selection={inspectorTab} onChange={setInspectorTab} />],
          ["View cube", stage(<ViewCube yaw={0.7} pitch={0.42} />, 150)],
          ["Axis gizmo", stage(<AxisGizmo />, 90)],
        )}

        {S("Dialogs, Inspectors & Feedback",
          ["Property fields", <div className="aui-kit-stack-8"><PropertyField label="Position X" value="125.00" unit="mm" /><PropertyField label="Rotation Z" value="45.0" unit="deg" /></div>],
          ["Command buttons", <div className="aui-kit-hstack-8"><CommandButton icon="cursor" active label="Select" /><CommandButton icon="move" label="Move" /><CommandButton icon="rotate-3d" label="Rotate" /><CommandButton icon="ruler" label="Measure" /></div>],
          ["Notification card", <NotificationCard title="Character validated" message="14 parts, 11 mates, 3 relations ready to animate." action="View report" />],
          ["Document tabs", <DocumentTabs tabs={["Rex.anima", "Museum.show", "Lobby"]} selection={tab} onChange={setTab} />],
          ["Mate dialog", <DialogCard title="Revolute 4" subtitle="Mate" icon="link"><PropertyField label="Type" value="Revolute" /><PropertyField label="Connector A" value="Neck.Top" /><PropertyField label="Angle" value="0.0" unit="deg" /></DialogCard>],
        )}

        {S("Overlays & Shapes",
          ["Radial menu", <div style={{ position: "relative", width: 210, height: 210 }}><RadialMenu onDismiss={() => {}} /></div>],
          ["Shapes", <div className="aui-kit-hstack-8" style={{ gap: 18 }}><Diamond /><Triangle /></div>],
          ["Color tokens", <div className="kit-swatches">{[["accent", AD.accent], ["accent2", AD.accent2], ["warn", AD.warn], ["ok", AD.ok], ["danger", AD.danger], ["panelHi", "var(--aether-color-bg-control)"]].map(([n, c]) => <span key={n}><i style={{ background: c }} />{n}</span>)}</div>],
        )}

        {S("Viewport",
          ["Viewport mock", <div className="kit-stage" style={{ height: 220 }}><ViewportMock showGizmo selected /></div>, true],
          ["Perspective grid", stage(<PerspectiveGrid />, 160)],
        )}

        {S("Kit Widgets · ready for use",
          ["Badges", <div className="aui-kit-hstack-6"><Badge text="Armed" tint={AD.ok} /><Badge text="Offline" /><Badge text="Live" tint={AD.accent2} /></div>],
          ["Metric card", <MetricCard title="Triangles" value="18,204" caption="1 part · 3 faces" tint={AD.accent2} />],
          ["Labeled slider", <LabeledSlider label="Roughness" value={slider} onChange={setSlider} />],
          ["Segmented icons", <SegmentedIcons items={[{ icon: "cursor", help: "Select" }, { icon: "rectangle-dashed", help: "Box" }, { icon: "lasso", help: "Lasso" }]} selection={seg} onChange={setSeg} />],
          ["Chip picker", <ChipPicker options={["12 fps", "24 fps", "30 fps", "60 fps"]} selection={chip} onChange={setChip} />],
          ["Toast", <Toast message="STEP imported · 3 parts" tint={AD.ok} />],
          ["Callout", <Callout title="Kinematic preview" message="Physics is deferred — motion is evaluated, not simulated." />],
          ["Toggle row", <ToggleRow label="Show edges" isOn={toggle} onChange={setToggle} />],
          ["Progress card · busy state", <ProgressCard title="Importing model" detail="wheel_assembly.step" progress={0.45} countText="2 of 4" />],
          ["Progress bar", <div className="aui-kit-stack-8"><ProgressBar value={0.62} /><ProgressBar value={0.28} tint={AD.warn} /></div>],
        )}

        {S("Chrome",
          ["Status bar", <StatusBar workspace="Rig" model={{ name: "Rover Base", triangles: 8204 }} />, true],
        )}

        {S("Rex · Home, Assets and Hardware",
          ["Recent project cards", <div className="home-grid" style={{ width: "100%" }}><ProjectCard name="Rex" kind="animatronic dinosaur" meta="18 parts · 6 servos" tint={AD.accent2} /><ProjectCard name="Marble Bust" kind="AR avatar" meta="1 mesh · face rig" tint={AD.accent} /><ProjectCard name="Show — Lobby" kind="3 characters" meta="timeline · 4:20" tint={AD.warn} /></div>, true],
          ["Import stat chips", <div className="aui-kit-hstack-8"><StatChip label="Faces" value="42" /><StatChip label="Triangles" value="8,204" /><StatChip label="Read" value="124 ms" tint={AD.accent2} /><StatChip label="Kernel" value="OCCT 7.8" /></div>],
          ["Controller identity", <DeviceIdentity icon="cpu" name="Teensy 4.1" detail="USB · /dev/tty.usb" />],
          ["Calibration range · map range with µs markers", <div style={{ width: 260 }}><CalibrationRangeBar /><div className="aui-kit-hstack-8" style={{ marginTop: 8 }}><Pill icon="undo" label="Invert" /><Pill icon="target" label="Center" /></div></div>],
        )}


        {S("CodexUI · Viewport",
          ["Robot mock viewport · mode pill, mini cube, camera chrome, stage frame", <div className="kit-stage" style={{ height: 260 }}><RobotViewport mode="UI KIT VIEWPORT" selected="Head Pan Assembly" showsStage hud={hud} onToggleHud={() => setHud(!hud)}>{hud && <div style={{ position: "absolute", right: 12, bottom: 52 }}><PerformanceHUD engine="RealityKit" fps={60} cpuPercent={5.2} memoryMB={284} onClose={() => setHud(false)} /></div>}</RobotViewport></div>, true],
        )}

        {S("CodexUI · Node canvas",
          ["Connected behavior graph, canvas status, zoom, and auto layout", <NodeCanvas height={380} title="BEHAVIOR GRAPH · WELCOME"
            nodes={[
              { id: "trigger", x: 0.18, y: 0.3, width: 170, title: "Guest Arrives", subtitle: "trigger", icon: "sensor", color: AD.accent, outputs: ["Event"] },
              { id: "llm", x: 0.5, y: 0.46, width: 205, title: "Language Model", subtitle: "ai", icon: "brain", color: AD.purple, inputs: ["Prompt", "Memory"], outputs: ["Text", "Action"], selected: true },
              { id: "tts", x: 0.81, y: 0.29, width: 185, title: "Text to Speech", subtitle: "voice", icon: "audio", color: AD.pink, inputs: ["Text"], outputs: ["Audio"] },
              { id: "motion", x: 0.81, y: 0.67, width: 185, title: "Play Greeting", subtitle: "motion", icon: "figure-wave", color: AD.ok, inputs: ["Action"], outputs: ["Complete"] },
            ]}
            links={[{ from: [0.24, 0.3], to: [0.48, 0.44], color: AD.accent }, { from: [0.55, 0.44], to: [0.76, 0.29], color: AD.purple }, { from: [0.55, 0.48], to: [0.76, 0.66], color: AD.ok }]} />, true],
          ["Typed ports", <PanelCard contentOnly={sectionTab(section) === "widgets"} title="Ports" subtitle="Typed connections" icon="nodes" style={{ width: 290 }}><div className="aui-kit-stack-8" style={{ padding: 10 }}>
            <NodePortRow direction="IN" name="Prompt" type="String" color={AD.accent} /><NodePortRow direction="IN" name="Memory" type="Context" color={AD.accent2} /><NodePortRow direction="OUT" name="Text" type="String" color={AD.purple} /><NodePortRow direction="OUT" name="Action" type="Event" color={AD.ok} /></div></PanelCard>],
        )}

        {S("CodexUI · Timelines",
          ["Live Follow dope sheet · keys + audio lane", <DopeSheetTimeline tracks={SAMPLE_TRACKS} progress={0.3} duration={8} badge={{ text: "LIVE FOLLOW" }} audio={{ name: "Dialogue.wav" }} style={{ height: 250, width: "100%" }} />, true],
          ["Show sequence · multi-media cue blocks", <CueTimeline style={{ width: "100%" }} tracks={[
            { name: "Character", color: AD.purple, blocks: [{ start: 0.02, length: 0.25, label: "Idle" }, { start: 0.29, length: 0.34, label: "Greeting" }, { start: 0.67, length: 0.27, label: "Listen" }] },
            { name: "Dialogue", color: AD.warn, blocks: [{ start: 0.08, length: 0.5, label: "welcome.wav" }, { start: 0.64, length: 0.28, label: "prompt.wav" }] },
            { name: "Screen", color: AD.blue, blocks: [{ start: 0, length: 0.3, label: "Logo" }, { start: 0.32, length: 0.6, label: "Welcome Loop" }] },
            { name: "Lighting", color: AD.accent2, blocks: [{ start: 0, length: 0.2, label: "Standby" }, { start: 0.22, length: 0.7, label: "Warm Stage" }] },
            { name: "Events", color: AD.ok, blocks: [{ start: 0.12, length: 0.08, label: "Door" }, { start: 0.76, length: 0.1, label: "Ready" }] },
          ]} />, true],
        )}

        {S("CodexUI · Contextual animatronic widgets",
          ["Mate connectors + pose sliders", <div className="aui-kit-stack-8" style={{ width: 280 }}>
            <ConnectorField label="Connector A" value="Neck Base · Top center" /><ConnectorField label="Connector B" value="Head Pan · Origin" />
            <LabeledSlider label="Head Pan" value={0.64} onChange={() => {}} readout="+22°" tint={AD.purple} /><LabeledSlider label="Head Tilt" value={0.42} onChange={() => {}} readout="-8°" tint={AD.accent2} /><LabeledSlider label="Jaw" value={0.18} onChange={() => {}} readout="12%" tint={AD.warn} /></div>],
          ["Live hardware output", <PanelCard contentOnly={sectionTab(section) === "widgets"} title="Hardware" subtitle="Live output" icon="hardware" tint={AD.ok} style={{ width: 280 }}><div className="aui-kit-stack-3" style={{ padding: 8 }}>
            <DeviceStatusRow name="Servo Controller" route="USB" /><DeviceStatusRow name="LED Matrix" route="Wi-Fi" /><DeviceStatusRow name="Stage Audio" route="Local" />
            <span className="aui-kit-hstack-6 aui-kit-t2" style={{ fontSize: 8 }}><span className="aui-kit-dot" style={{ background: AD.warn }} />Output armed, not streaming</span></div></PanelCard>],
          ["Safety state · authoritative device layer", <PanelCard contentOnly={sectionTab(section) === "widgets"} title="Safety State" subtitle="Authoritative device layer" icon="shield" tint={AD.ok} style={{ width: 300 }}><div style={{ padding: 10 }}>
            <SafetyStatus rows={[{ label: "Position limits", value: "Enforced" }, { label: "Velocity limits", value: "Enforced" }, { label: "Acceleration limits", value: "Preview", tint: AD.warn }, { label: "Heartbeat failsafe", value: "250 ms" }]} /></div></PanelCard>],
          ["Channel mapping · semantic motion → physical output", <ChannelMapTable rows={[
            { motion: "Head Pan", channel: "Head Controller · PWM 0", range: "-75° … +75°", color: AD.purple, live: 0.4 }, { motion: "Head Tilt", channel: "Head Controller · PWM 1", range: "-35° … +42°", color: AD.accent2, live: 0.55 },
            { motion: "Jaw", channel: "Head Controller · PWM 2", range: "0% … 100%", color: AD.warn, live: 0.7 }, { motion: "Eye Pan", channel: "Head Controller · PWM 3", range: "-28° … +28°", color: AD.blue, live: 0.85 },
            { motion: "Left Shoulder", channel: "Body Controller · ID 1", range: "-90° … +90°", color: AD.ok, live: 0.4 }, { motion: "Chest Screen", channel: "Chest Display · Layer 0", range: "RGBA", color: AD.pink, live: 0.55 },
          ]} />, true],
        )}

        {S("CodexUI · Chrome",
          ["Centered workspace navigator · authoring | utilities, label modes", <div className="aui-kit-stack-10">
            <WorkspaceStageTabs stages={WORKSPACES.filter((w) => w.id !== "home" && w.id !== "design")} activeID="rig" utilityStartID="uiKit" labelMode={labelMode} />
            <WorkspaceStageTabs stages={WORKSPACES.filter((w) => w.id !== "home" && w.id !== "design")} activeID="rig" utilityStartID="uiKit" labelMode={labelMode} compact />
            <ChipPicker options={STAGE_LABEL_MODES.map((m) => m.label)} selection={STAGE_LABEL_MODES.find((m) => m.id === labelMode)!.label} onChange={(label) => setLabelMode(STAGE_LABEL_MODES.find((m) => m.label === label)!.id)} /></div>, true],
          ["Guided workspace walkthrough", <WalkthroughCard icon="nodes" progress="2 of 7" purpose="Create parts, connectors, mates, motion limits, and actuator intent." />, true],
          ["Drop zone · load 3D assembly", <div style={{ width: 300 }}><DropZone footLeft={<><Sym name="ruler" size={9} />Units prompted</>} footRight="Batch supported" /></div>],
          ["Theme tiles", <ThemeTileGrid activeID={themeTile} onSelect={setThemeTile} themes={[
            { id: "studio", label: "Blue", panel: "#171a20", accent: "#4c9dff" }, { id: "teal", label: "Teal", panel: "#171a20", accent: "#36d6c3" }, { id: "indigo", label: "Indigo", panel: "#171a20", accent: "#8b87ff" },
            { id: "orange", label: "Orange", panel: "#171a20", accent: "#ff9a4d" }, { id: "graphite", label: "Graphite", panel: "#171a20", accent: "#9aa3ae" }, { id: "light", label: "CAD Light", panel: "#ffffff", accent: "#2e6bf6", line: "rgba(0,0,0,0.15)" }, { id: "midnight", label: "Midnight", panel: "#0d121b", accent: "#4c9dff" },
          ]} />],
          ["Inspector tabs with icons", <InspectorTabs tabs={[{ label: "Properties", icon: "sliders" }, { label: "Appearance", icon: "palette" }, { label: "Output", icon: "hardware" }]} selection={inspectorTab} onChange={setInspectorTab} />],
        )}
    </>
  );
}
