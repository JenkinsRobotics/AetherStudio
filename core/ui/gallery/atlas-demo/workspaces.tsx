/** The six CodexUI workspace prototypes (AssetsPrototype … NodesPrototype), composed from the kit over DockingWorkspace. */
import { useState, type ReactNode } from "react";
import {
  AD, Badge, ChannelMapTable, ConnectorField, CueTimeline, DockSafeArea, DockingWorkspace, useDockInsets, DopeSheetTimeline, DropZone, Field, LabeledSlider, ListRow, MetricCard, NodeCanvas, NodeLibraryRow,
  NodePortRow, PanelAction, PanelCard, PerformanceHUD, Range, RobotViewport, SafetyStatus, SearchField, Sym, ToggleLine,
} from "../../src/Kit";
import { useAtlas } from "./AtlasDemoApp";

/** Every prototype used the same frame; only the titles, widths and content differ. */
function Frame({ leftTitle, rightTitle, leftWidth, rightWidth, centerInset = 10, left, center, right }: { leftTitle: string; rightTitle: string; leftWidth: number; rightWidth: number; centerInset?: number; left: ReactNode; center: ReactNode; right: ReactNode }) {
  const m = useAtlas();
  return <DockingWorkspace leftTitle={leftTitle} rightTitle={rightTitle} leftWidth={leftWidth} rightWidth={rightWidth} centerInset={centerInset} leftPlacement={m.left} rightPlacement={m.right} canvasReveal={m.detectedPreset === "canvas"} ribbonClearance={m.ribbon === "floating" ? m.ribbonEdge : null} left={left} center={center} right={right} />;
}

const Filter = ({ text }: { text: string }) => <div className="atlas-filter"><Sym name="search" size={10} /><span>{text}</span></div>;
const Fields = ({ rows }: { rows: readonly [string, string, string?][] }) => <>{rows.map(([l, v, u]) => <Field key={l} label={l} value={v} unit={u} />)}</>;
const Toggle = ({ label, on = true }: { label: string; on?: boolean }) => { const [v, setV] = useState(on); return <ToggleLine label={label} isOn={v} onChange={setV} size="mini" />; };
const Btn = ({ children, primary, danger, large, onClick }: { children: ReactNode; primary?: boolean; danger?: boolean; large?: boolean; onClick?: () => void }) => (
  <button type="button" className="atlas-btn" data-primary={primary || undefined} data-danger={danger || undefined} data-large={large || undefined} onClick={onClick}>{children}</button>
);

function Viewport({ mode, selected, showsStage = false }: { mode: string; selected: string; showsStage?: boolean }) {
  const m = useAtlas();
  const insets = useDockInsets(); // the HUD steps clear of a floating inspector stack
  return (
    <RobotViewport mode={mode} selected={selected} showsStage={showsStage} hud={m.showsHUD} onToggleHud={() => m.setShowsHUD(!m.showsHUD)} style={{ borderRadius: 0 }}>
      {m.showsHUD && <div style={{ position: "absolute", right: 12 + insets.right, bottom: 52, transition: "right .3s ease" }}><PerformanceHUD engine="Native Metal preview" fps={60} cpuPercent={5.2} memoryMB={284} onClose={() => m.setShowsHUD(false)} /></div>}
    </RobotViewport>
  );
}

// MARK: - Assets

const PARTS = [
  ["Head Pan Assembly", "head_pan.usdz", 4, "Head", "Ready", "rotate-3d", AD.warn], ["Head Tilt Yoke", "tilt_yoke.step", 2, "Head", "Ready", "move", AD.purple],
  ["Jaw Mechanism", "jaw.stl", 3, "Head", "Updated", "gears", AD.blue], ["Torso Shell", "torso.usdz", 1, "Body", "Ready", "cube", AD.accent2],
  ["Left Arm Link", "arm_left.obj", 2, "Body", "Ready", "figure", AD.ok], ["Right Arm Link", "arm_right.obj", 2, "Body", "Ready", "figure", AD.ok],
  ["LED Eye Matrix", "eye_panel.usdz", 6, "Face", "Ready", "grid-dots", AD.pink], ["Chest Display", "screen.usdz", 1, "Body", "Ready", "display", AD.purple],
] as const;

export function AssetsWorkspace() {
  const m = useAtlas();
  return (
    <Frame leftTitle="Project Content" rightTitle="Import + Preview" leftWidth={256} rightWidth={304}
      left={(
        <PanelCard title="Project Content" subtitle="Atlas Show Project · V12" icon="folder" className="atlas-panel">
          <div className="atlas-rows">
            <Filter text="Filter project contents" />
            <ListRow icon="group" title="Characters" detail="2" /><ListRow icon="person" title="Atlas" level={1} selected statusColor={AD.ok} /><ListRow icon="cube" title="Parts" detail="14" level={2} selected />
            <ListRow icon="archive" title="Source Assets" detail="9" level={2} /><ListRow icon="image" title="Renders" detail="3" level={2} /><ListRow icon="layers" title="Assemblies" detail="2" level={2} /><ListRow icon="braces" title="Scripts" detail="4" level={2} /><ListRow icon="curve" title="Animations" detail="11" level={2} />
            <span className="aui-kit-divider" style={{ margin: "5px 0" }} />
            <ListRow icon="package" title="Parts Library" detail="USER" /><ListRow icon="grid-cross" title="Castings" detail="18" level={1} /><ListRow icon="gears" title="Motors" detail="7" level={1} /><ListRow icon="cube" title="Structural" detail="26" level={1} /><ListRow icon="display" title="Displays" detail="6" level={1} />
            <span className="aui-kit-spacer" />
            <div style={{ padding: 9 }}><Btn primary>+ Create New Character</Btn></div>
          </div>
        </PanelCard>
      )}
      center={(
        <DockSafeArea><PanelCard title="Parts" subtitle="Active character · Atlas" icon="cube-transparent" className="atlas-panel atlas-center-panel">
          <div className="atlas-table-toolbar"><span className="aui-kit-hstack-5"><Sym name="list" size={10} />Table</span><span className="aui-kit-hstack-5 aui-kit-t2"><Sym name="grid-2" size={10} />Grid</span><span className="aui-kit-spacer" /><span className="atlas-input">Filter parts</span><Btn>+ Import</Btn></div>
          <div className="atlas-table-head"><span>PART</span><span>SOURCE</span><span>VERSION</span><span>ASSEMBLY</span><span>STATE</span></div>
          {PARTS.map(([name, source, version, assembly, state, icon, color], i) => (
            <div key={name} className="atlas-table-row" data-selected={m.selectedPart === name || undefined} onClick={() => m.setSelectedPart(name)}>
              <span className="atlas-part-cell" style={{ fontWeight: i === 0 ? 600 : 400 }}><span className="atlas-part-tile" style={{ color, background: `color-mix(in srgb, ${color} 25%, transparent)` }}><Sym name={icon} size={13} /></span>{name}</span>
              <span className="aui-kit-t2">{source}</span><span><Badge text={`V${version}`} /></span><span>{assembly}</span>
              <span className="aui-kit-hstack-5" style={{ color: state === "Ready" ? AD.ok : AD.warn }}><Sym name={state === "Ready" ? "status-ok" : "refresh"} size={10} />{state}</span>
            </div>
          ))}
        </PanelCard></DockSafeArea>
      )}
      right={(<>
        <PanelCard title="Load 3D Assembly" subtitle="STL · OBJ · USD · USDZ" icon="import" className="atlas-panel"><div style={{ padding: 10 }}><DropZone footLeft={<><Sym name="ruler" size={9} />Units prompted</>} footRight="Batch supported" /></div></PanelCard>
        <PanelCard title="Preview" subtitle={m.selectedPart} icon="visible" className="atlas-panel"><div style={{ padding: 8, height: 236 }}><RobotViewport mode="ASSET PREVIEW" selected={m.selectedPart} style={{ borderRadius: 8 }} /></div></PanelCard>
      </>)} />
  );
}

// MARK: - Rig

export function RigWorkspace() {
  const m = useAtlas();
  const [preview, setPreview] = useState(0.52);
  return (
    <Frame leftTitle="Character Browser" rightTitle="Mate Inspector" leftWidth={252} rightWidth={302} centerInset={0}
      left={(
        <PanelCard title="Character Browser" subtitle="Semantic rig" icon="nodes" className="atlas-panel">
          <div className="atlas-rows">
            <Filter text="Filter :part :mate :locked" />
            <ListRow icon="cube-filled" title="Atlas" detail="ROOT" statusColor={AD.ok} /><ListRow icon="lock" title="Torso" detail="Grounded" level={1} /><ListRow icon="cube" title="Neck Base" level={1} />
            <ListRow icon="link" title="Neck Yaw" detail="Revolute" level={2} /><ListRow icon="cube" title="Head Pan Assembly" level={2} selected onClick={() => m.setSelectedPart("Head Pan Assembly")} /><ListRow icon="link" title="Head Tilt" detail="Revolute" level={3} /><ListRow icon="cube" title="Head Tilt Yoke" level={3} />
            <ListRow icon="link" title="Jaw Hinge" detail="Revolute" level={4} /><ListRow icon="cube" title="Jaw Mechanism" level={4} /><ListRow icon="link" title="Left Shoulder" detail="Ball" level={2} /><ListRow icon="cube" title="Left Arm" level={2} /><ListRow icon="link" title="Right Shoulder" detail="Ball" level={2} /><ListRow icon="cube" title="Right Arm" level={2} />
            <span className="aui-kit-divider" style={{ margin: "4px 0" }} />
            <ListRow icon="equal" title="Relations" detail="3" /><ListRow icon="gears" title="Eyes Coupled" detail="Gear" level={1} /><ListRow icon="swap-horizontal" title="Jaw Linkage" detail="Linear" level={1} />
            <span className="aui-kit-spacer" />
            <div className="aui-kit-hstack-8" style={{ padding: 9 }}><Btn>+</Btn><Btn>Group</Btn><span className="aui-kit-spacer" /><Btn><Sym name="more" size={11} /></Btn></div>
          </div>
        </PanelCard>
      )}
      center={<Viewport mode="RIG · CONNECTOR EDIT" selected={m.selectedPart} />}
      right={(<>
        <PanelCard title="Revolute Mate" subtitle="Head yaw · 1 DOF" icon="rotate-3d" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}>
          <div className="aui-kit-between"><Badge text="CONNECTED" tint={AD.ok} /><span className="aui-kit-hstack-6"><Btn>✓</Btn><Btn>×</Btn></span></div>
          <ConnectorField label="Connector A" value="Neck Base · Top center" /><ConnectorField label="Connector B" value="Head Pan · Origin" />
          <Toggle label="Offset" /><Fields rows={[["X", "0.0", "mm"], ["Y", "18.5", "mm"], ["Z", "0.0", "mm"], ["Rotate about", "Z"], ["Angle", "0.0", "deg"]]} /><Toggle label="Simulation connection" />
        </div></PanelCard>
        <PanelCard title="Motion Limits" subtitle="Neutral + safe range" icon="gauge" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}>
          <Fields rows={[["Minimum", "-75.0", "deg"], ["Neutral", "0.0", "deg"], ["Maximum", "+75.0", "deg"]]} />
          <div className="aui-kit-hstack-8"><span style={{ fontSize: 9 }}>Preview</span><Range value={preview} onChange={setPreview} ariaLabel="Preview" /><span className="aui-kit-mono" style={{ fontSize: 9 }}>{Math.round((preview - 0.5) * 150)}°</span></div>
        </div></PanelCard>
        <PanelCard title="Actuator Intent" subtitle="Hardware-neutral" icon="hardware" className="atlas-panel"><div className="aui-kit-between" style={{ padding: 10 }}><Badge text="UNMAPPED" tint={AD.warn} /><Btn>Map later</Btn></div></PanelCard>
      </>)} />
  );
}

// MARK: - Animate

const KEY_TIMES = [[0, 1.2, 2.4, 4.5, 6.8], [0, 2.0, 3.3, 5.7, 8], [0.6, 1.5, 2.8, 4.2, 6.0], [0, 1.1, 2.2, 3.8, 7.4], [0, 2.5, 5.2, 8], [0, 2.5, 5.2, 8]];
const TRACK_NAMES = ["Head Pan", "Head Tilt", "Jaw", "Eyes", "Left Arm", "Right Arm"];
export const ANIMATE_TRACKS = TRACK_NAMES.map((name, i) => ({ id: name, name, color: i % 2 === 0 ? AD.purple : AD.accent2, keys: KEY_TIMES[i].map((t) => t / 8) }));

const MiniCurve = () => (
  <svg className="atlas-mini-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
    {[0, 25, 50, 75, 100].map((y) => <line key={y} x1={0} x2={100} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />)}
    <path d="M0 78 C35 82 62 12 100 18" fill="none" stroke="var(--aether-color-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
  </svg>
);

export function AnimateWorkspace() {
  const m = useAtlas();
  const [playing, setPlaying] = useState(false);
  return (
    <Frame leftTitle="Animation Browser" rightTitle="Motion Inspector" leftWidth={244} rightWidth={286} centerInset={0}
      left={(<>
        <PanelCard title="Animation Clips" subtitle="Atlas · 11 clips" icon="film-stack" className="atlas-panel"><div className="atlas-rows">
          {[["Greeting", "8.0 s"], ["Idle Breathing", "12.0 s"], ["Curious Look", "4.5 s"], ["Point Left", "3.2 s"], ["Point Right", "3.2 s"], ["Shutdown", "6.0 s"]].map(([n, d], i) => <ListRow key={n} icon="video" title={n} detail={d} selected={i === 0} />)}
          <span className="aui-kit-divider" style={{ margin: "4px 0" }} /><div className="aui-kit-hstack-8" style={{ padding: 9 }}><Btn>+ Clip</Btn><Btn><Sym name="copy" size={11} /></Btn></div>
        </div></PanelCard>
        <PanelCard title="Layers" subtitle="Motion blending" icon="layers" className="atlas-panel"><div className="atlas-rows" style={{ padding: "5px 0" }}>
          <ListRow icon="circle-filled" title="Base Motion" detail="100%" statusColor={AD.ok} /><ListRow icon="contrast" title="Face + Eyes" detail="100%" statusColor={AD.purple} /><ListRow icon="circle" title="Live Puppet" detail="0%" />
        </div></PanelCard>
      </>)}
      center={(
        <div className="atlas-center-stack">
          <Viewport mode="ANIMATE · AUTO KEY" selected="Greeting Pose" />
          <DockSafeArea edges={["bottom"]} style={{ flex: "none" }}><DopeSheetTimeline tracks={ANIMATE_TRACKS} progress={m.selectedTime / 8} duration={8} isPlaying={playing} onScrub={(p) => m.setSelectedTime(p * 8)} onTogglePlay={() => setPlaying(!playing)} onRewind={() => m.setSelectedTime(0)} audio={{ name: "Dialogue.wav" }} style={{ height: 255, margin: "8px 10px 10px" }} /></DockSafeArea>
        </div>
      )}
      right={(<>
        <PanelCard title="Selected Keyframe" subtitle="Head Pan · 2.40 s" icon="keyframe-filled" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}>
          <Fields rows={[["Time", m.selectedTime.toFixed(2), "s"], ["Value", "+22.0", "deg"], ["Interpolation", "Bezier"]]} />
          <div className="aui-kit-between" style={{ fontSize: 9 }}><span>Ease</span><span className="aui-kit-hstack-6"><Badge text="IN 42%" /><Badge text="OUT 58%" /></span></div><MiniCurve />
        </div></PanelCard>
        <PanelCard title="Pose Controls" subtitle="Live at playhead" icon="figure" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}>
          <LabeledSlider label="Head Pan" value={0.64} onChange={() => {}} readout="+22°" tint={AD.purple} /><LabeledSlider label="Head Tilt" value={0.42} onChange={() => {}} readout="-8°" tint={AD.accent2} /><LabeledSlider label="Jaw" value={0.18} onChange={() => {}} readout="12%" tint={AD.warn} /><LabeledSlider label="Eye Aim" value={0.56} onChange={() => {}} readout="+4°" tint={AD.blue} />
        </div></PanelCard>
        <PanelCard title="Record" subtitle="Puppeteering" icon="record" className="atlas-panel"><div className="aui-kit-between" style={{ padding: 10 }}><Btn>Arm Capture</Btn><Badge text="OFFLINE" /></div></PanelCard>
      </>)} />
  );
}

// MARK: - Show

export const CUE_TRACKS = [
  { name: "Character", color: AD.purple, blocks: [{ start: 0.02, length: 0.25, label: "Idle" }, { start: 0.29, length: 0.34, label: "Greeting" }, { start: 0.67, length: 0.27, label: "Listen" }] },
  { name: "Dialogue", color: AD.warn, blocks: [{ start: 0.08, length: 0.5, label: "welcome.wav" }, { start: 0.64, length: 0.28, label: "prompt.wav" }] },
  { name: "Screen", color: AD.blue, blocks: [{ start: 0, length: 0.3, label: "Logo" }, { start: 0.32, length: 0.6, label: "Welcome Loop" }] },
  { name: "Lighting", color: AD.accent2, blocks: [{ start: 0, length: 0.2, label: "Standby" }, { start: 0.22, length: 0.7, label: "Warm Stage" }] },
  { name: "Events", color: AD.ok, blocks: [{ start: 0.12, length: 0.08, label: "Door" }, { start: 0.76, length: 0.1, label: "Ready" }] },
];

export function ShowWorkspace() {
  return (
    <Frame leftTitle="Show Browser" rightTitle="Cue Inspector" leftWidth={244} rightWidth={296} centerInset={0}
      left={(
        <PanelCard title="Show Browser" subtitle="Museum Welcome · V7" icon="show" className="atlas-panel"><div className="atlas-rows">
          <ListRow icon="rectangle-group" title="Scenes" detail="5" />
          {[["01 · Guest Arrives", "12 s"], ["02 · Welcome", "26 s"], ["03 · Demonstration", "48 s"], ["04 · Q + A", "∞"], ["05 · Goodbye", "18 s"]].map(([n, d], i) => <ListRow key={n} icon="video" title={n} detail={d} level={1} selected={i === 0} />)}
          <span className="aui-kit-divider" style={{ margin: "4px 0" }} />
          <ListRow icon="flag" title="Operator Cues" detail="8" /><ListRow icon="bolt" title="Triggers" detail="5" /><ListRow icon="repeat" title="Fallback Loops" detail="3" />
          <span className="aui-kit-spacer" /><div className="aui-kit-hstack-8" style={{ padding: 9 }}><Btn>+ Scene</Btn><Btn>+ Cue</Btn></div>
        </div></PanelCard>
      )}
      center={(
        <div className="atlas-center-stack">
          <Viewport mode="SHOW · STAGE PREVIEW" selected="Museum Welcome" showsStage />
          <DockSafeArea edges={["bottom"]} style={{ flex: "none" }}><PanelCard title="Show Sequence" subtitle="Multi-media cues" icon="timeline" className="atlas-panel" style={{ height: 230, margin: "8px 10px 10px" }}><CueTimeline tracks={CUE_TRACKS} style={{ boxShadow: "none", borderRadius: 0 }} /></PanelCard></DockSafeArea>
        </div>
      )}
      right={(<>
        <PanelCard title="Selected Cue" subtitle="Greeting · Character" icon="figure-wave" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}>
          <Fields rows={[["Clip", "Greeting"], ["Start", "7.20", "s"], ["Duration", "8.00", "s"], ["Blend In", "0.35", "s"], ["Blend Out", "0.50", "s"]]} /><Toggle label="Wait for completion" />
        </div></PanelCard>
        <PanelCard title="Operator" subtitle="Live show control" icon="person-key" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}>
          <div className="aui-kit-between"><Badge text="SAFE TO RUN" tint={AD.ok} /><Badge text="3 DEVICES" /></div>
          <Btn primary large>GO · Next Cue</Btn>
          <div className="aui-kit-hstack-6"><Btn>Hold</Btn><Btn>Fade Out</Btn><Btn>Stop</Btn></div>
        </div></PanelCard>
      </>)} />
  );
}

// MARK: - Hardware

export const CHANNELS = [
  { motion: "Head Pan", channel: "Head Controller · PWM 0", range: "-75° … +75°", color: AD.purple, live: 0.4 }, { motion: "Head Tilt", channel: "Head Controller · PWM 1", range: "-35° … +42°", color: AD.accent2, live: 0.55 },
  { motion: "Jaw", channel: "Head Controller · PWM 2", range: "0% … 100%", color: AD.warn, live: 0.7 }, { motion: "Eye Pan", channel: "Head Controller · PWM 3", range: "-28° … +28°", color: AD.blue, live: 0.85 },
  { motion: "Eye Tilt", channel: "Head Controller · PWM 4", range: "-18° … +18°", color: AD.blue, live: 0.4 }, { motion: "Left Shoulder", channel: "Body Controller · ID 1", range: "-90° … +90°", color: AD.ok, live: 0.55 },
  { motion: "Right Shoulder", channel: "Body Controller · ID 2", range: "-90° … +90°", color: AD.ok, live: 0.7 }, { motion: "Chest Screen", channel: "Chest Display · Layer 0", range: "RGBA", color: AD.pink, live: 0.85 },
];

export function HardwareWorkspace() {
  return (
    <Frame leftTitle="Hardware Rack" rightTitle="Safety + Output" leftWidth={250} rightWidth={300}
      left={(
        <PanelCard title="Hardware Rack" subtitle="Atlas · local network" icon="hardware" className="atlas-panel"><div className="atlas-rows">
          <Filter text="Search devices" />
          <ListRow icon="drive" title="Head Controller" detail="USB" selected statusColor={AD.ok} /><ListRow icon="nodes" title="PCA9685 · 0x40" detail="12 ch" level={1} statusColor={AD.ok} />
          <ListRow icon="drive" title="Body Controller" detail="UDP" statusColor={AD.ok} /><ListRow icon="gears" title="DYNAMIXEL Bus" detail="2" level={1} statusColor={AD.ok} /><ListRow icon="display" title="Chest Display" detail="LAN" statusColor={AD.ok} />
          <span className="aui-kit-divider" style={{ margin: "5px 0" }} /><ListRow icon="wireless" title="Discover Devices" /><ListRow icon="document-search" title="Driver Diagnostics" />
          <span className="aui-kit-spacer" /><div className="aui-kit-between" style={{ padding: 9 }}><Btn>Connect All</Btn><Btn><Sym name="rotate" size={11} /></Btn></div>
        </div></PanelCard>
      )}
      center={(
        <DockSafeArea><div className="atlas-center-stack" style={{ gap: 8 }}>
          <div className="aui-kit-hstack-8" style={{ flex: "none" }}>
            <MetricCard title="Devices" value="3 / 3" caption="All expected controllers online" tint={AD.ok} /><MetricCard title="Channels" value="14" caption="12 servo · 2 screen" tint={AD.blue} />
            <MetricCard title="Frame Rate" value="50 Hz" caption="Median jitter 0.7 ms" tint={AD.accent2} /><MetricCard title="Safety" value="ARMED" caption="Limits + heartbeat active" tint={AD.warn} />
          </div>
          <PanelCard title="Channel Mapping" subtitle="Semantic motion → physical output" icon="branch" className="atlas-panel atlas-center-panel"><ChannelMapTable rows={CHANNELS} /></PanelCard>
        </div></DockSafeArea>
      )}
      right={(<>
        <PanelCard title="Safety State" subtitle="Authoritative device layer" icon="shield" className="atlas-panel"><div style={{ padding: 10 }}><SafetyStatus rows={[{ label: "Position limits", value: "Enforced" }, { label: "Velocity limits", value: "Enforced" }, { label: "Acceleration limits", value: "Preview", tint: AD.warn }, { label: "Heartbeat failsafe", value: "250 ms" }]} /></div></PanelCard>
        <PanelCard title="Selected Output" subtitle="Head Pan · Servo 0" icon="sliders" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}>
          <Fields rows={[["Protocol", "PWM"], ["Minimum", "850", "µs"], ["Neutral", "1500", "µs"], ["Maximum", "2150", "µs"]]} /><div className="aui-kit-hstack-6"><Btn>Test -</Btn><Btn>Neutral</Btn><Btn>Test +</Btn></div>
        </div></PanelCard>
      </>)} />
  );
}

// MARK: - Nodes

export const NODE_LIBRARY: readonly { category: string; nodes: readonly [string, string, string][] }[] = [
  { category: "INPUTS", nodes: [["Trigger", "bolt", AD.accent], ["Sensor", "sensor", AD.accent2], ["Speech to Text", "mic", AD.accent]] },
  { category: "LOGIC", nodes: [["If / Else", "branch", AD.purple], ["Select", "list-numbered", AD.purple], ["Wait", "clock", AD.purple], ["Loop", "repeat", AD.purple]] },
  { category: "AI + MEDIA", nodes: [["Language Model", "brain", AD.pink], ["Text to Speech", "audio", AD.pink], ["Memory", "internaldrive", AD.pink]] },
  { category: "OUTPUTS", nodes: [["Play Motion", "figure-walk", AD.ok], ["Screen Media", "display", AD.ok], ["Hardware", "hardware", AD.ok]] },
];
export const GRAPH_NODES = [
  { id: "trigger", x: 0.18, y: 0.3, width: 170, title: "Guest Arrives", subtitle: "trigger", icon: "sensor", color: AD.accent, outputs: ["Event"] },
  { id: "llm", x: 0.5, y: 0.46, width: 205, title: "Language Model", subtitle: "ai", icon: "brain", color: AD.purple, inputs: ["Prompt", "Memory"], outputs: ["Text", "Action"], selected: true },
  { id: "tts", x: 0.81, y: 0.29, width: 185, title: "Text to Speech", subtitle: "voice", icon: "audio", color: AD.pink, inputs: ["Text"], outputs: ["Audio"] },
  { id: "motion", x: 0.81, y: 0.67, width: 185, title: "Play Greeting", subtitle: "motion", icon: "figure-wave", color: AD.ok, inputs: ["Action"], outputs: ["Complete"] },
];
export const GRAPH_LINKS = [{ from: [0.24, 0.3] as [number, number], to: [0.48, 0.44] as [number, number], color: AD.accent }, { from: [0.55, 0.44] as [number, number], to: [0.76, 0.29] as [number, number], color: AD.purple }, { from: [0.55, 0.48] as [number, number], to: [0.76, 0.66] as [number, number], color: AD.ok }];

export const NodeLibraryPanel = () => (
  <PanelCard title="Node Library" subtitle="Drag to canvas" icon="grid-2" className="atlas-panel"><div className="atlas-rows">
    <div style={{ padding: 8 }}><SearchField placeholder="Search nodes" text="" onChange={() => {}} /></div>
    {NODE_LIBRARY.map((c) => <div key={c.category}><span className="aui-kit-caption" style={{ fontSize: 8, padding: "6px 10px 0" }}>{c.category}</span>{c.nodes.map(([t, i, col]) => <NodeLibraryRow key={t} title={t} category="" icon={i} color={col} />)}</div>)}
  </div></PanelCard>
);
export const NodeInspectorPanels = () => (<>
  <PanelCard title="Language Model" subtitle="Selected node" icon="brain" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}><Fields rows={[["Provider", "Local / Adapter"], ["Model", "Character Brain"], ["Temperature", "0.65"], ["Timeout", "5.0", "s"]]} /><Toggle label="Allow tool calls" /><Toggle label="Deterministic fallback" /></div></PanelCard>
  <PanelCard title="Ports" subtitle="Typed connections" icon="nodes" className="atlas-panel"><div className="aui-kit-stack-8" style={{ padding: 10 }}><NodePortRow direction="IN" name="Prompt" type="String" color={AD.accent} /><NodePortRow direction="IN" name="Memory" type="Context" color={AD.accent2} /><NodePortRow direction="OUT" name="Text" type="String" color={AD.purple} /><NodePortRow direction="OUT" name="Action" type="Event" color={AD.ok} /></div></PanelCard>
  <PanelCard title="Execution" subtitle="Preview only" icon="play" className="atlas-panel"><div className="aui-kit-between" style={{ padding: 10 }}><Badge text="IDLE" /><Btn>Run Node</Btn></div></PanelCard>
</>);

export function NodesWorkspace() {
  return (
    <Frame leftTitle="Node Library" rightTitle="Node Inspector" leftWidth={240} rightWidth={290}
      left={<NodeLibraryPanel />}
      center={<NodeCanvas nodes={GRAPH_NODES} links={GRAPH_LINKS} title="BEHAVIOR GRAPH · WELCOME" height={undefined as unknown as number} style={{ height: "100%", borderRadius: 0 }} />}
      right={<NodeInspectorPanels />} />
  );
}

export { PanelAction as _AtlasPanelAction };
