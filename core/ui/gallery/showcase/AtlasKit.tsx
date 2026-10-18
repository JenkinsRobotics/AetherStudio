import { isModeDuplicate, kitSpecimenSection } from "./inventory";
import { Specimen } from "./Specimen";
/** UIKitPrototype.swift — CodexUI's design system as flat Specimen rows, filed by section (inventory.ts). */
import { useState, type ReactNode } from "react";
import { sectionTab } from "../showcase";
import {
  AD, Badge, ChannelMapTable, CommandButton, CueTimeline, DeviceStatusRow, DialogCard, DocumentTabs, DopeSheetTimeline, Field, InspectorTabs, ListRow, LogicNode,
  MaterialPreviewSphere, MetricCard, NodeCanvas, NotificationCard, PanelCard, PerformanceHUD, ProgressBar, Range, RobotViewport, Segmented, Sym, ToggleLine, WorkspaceStageTabs, } from "../../src/Kit";
import { ATLAS_WORKSPACES } from "../atlas-demo/catalog";
import { ATLAS_PRESETS, SettingsPanes, useAtlas } from "../atlas-demo/AtlasDemoApp";
import { ANIMATE_TRACKS, CUE_TRACKS, CHANNELS, GRAPH_LINKS, GRAPH_NODES, NodeInspectorPanels, NodeLibraryPanel } from "../atlas-demo/workspaces";

const COVERAGE = [
  ["PrototypePanel", "Panels & Dialogs", "Panel anatomy"], ["PrototypeRow", "Rows & Fields", "Hierarchy rows"], ["PropertyField", "Rows & Fields", "Numeric inspector"], ["LabelPill", "Buttons & Controls", "Pills and states"],
  ["MetricCard", "Diagnostics & Status", "Metric card"], ["ChromeIconButtonStyle", "Diagnostics & Status", "Command buttons"], ["WorkspaceStageTabs", "App Chrome", "Workspace navigator"], ["AdaptiveRibbon", "App Chrome", "Tool ribbon"],
  ["DockingWorkspace", "Appearance & Layout", "Layout contract"], ["MockViewport", "Viewport", "Viewport mock"], ["TimelinePrototype", "Timelines", "Production dope sheet"], ["ViewportPerformanceHUD", "Diagnostics & Status", "Performance HUD"],
  ["PrototypeSettingsView", "Settings", "Settings form"], ["SpatialSelectionToolsSpecimen", "Contextual Animatronic Widgets", "Selection rail and adaptive actions"], ["SpatialContextStackSpecimen", "Contextual Animatronic Widgets", "Context stack"],
  ["SpatialTimelineSpecimen", "Timelines", "Live Follow timeline"], ["PrototypeNodeCard", "Nodes", "Node types and states"], ["PrototypeNodeLibrary", "Nodes", "Categorized node library"], ["PrototypeNodeInspector", "Nodes", "Selected-node inspector"],
  ["PrototypeNodePortRow", "Nodes", "Typed node ports"], ["PrototypeNodeCanvas", "Node Canvas", "Connected behavior graph"],
];

const Btn = ({ children, primary, disabled }: { children: ReactNode; primary?: boolean; disabled?: boolean }) => <button type="button" className="atlas-btn" data-primary={primary || undefined} disabled={disabled}>{children}</button>;

export function AtlasKitSpecimens({ section }: { section: string }) {
  const m = useAtlas();
  const [slider, setSlider] = useState(0.62);
  const [mode, setMode] = useState("grid");
  const [edges, setEdges] = useState(true);
  const [docTab, setDocTab] = useState(0);
  const [inspectorTab, setInspectorTab] = useState(0);
  const S = (group: string, ...items: [string, ReactNode, boolean?][]) => items.map(([label, view, wide]) =>
    !isModeDuplicate(`atlas:${label}`) && kitSpecimenSection("atlas", group, label) === section ? <Specimen key={label} source="atlas" group={group} label={label} wide={wide}>{view}</Specimen> : null);
  const panel = (title: string, subtitle: string, icon: string, body: ReactNode) => <PanelCard contentOnly={sectionTab(section) === "widgets"} title={title} subtitle={subtitle} icon={icon} className="atlas-panel" style={{ width: "100%" }}>{body}</PanelCard>;
  const tokens = [["canvas", "var(--aether-color-bg-app)"], ["panel", "var(--aether-color-bg-panel)"], ["raised", "var(--aether-color-bg-control)"], ["inset", "var(--aether-color-bg-app)"], ["accent", AD.accent], ["teal", AD.accent2], ["indigo", AD.purple], ["warning", AD.warn], ["success", AD.ok], ["danger", AD.danger]];
  return (
    <>

        {S("Buttons & Controls",
          ["Buttons, pills, and states", panel("Controls", "Normal · Hover · Active · Disabled", "button", <div className="aui-kit-stack-10" style={{ padding: 10 }}>
            <div className="aui-kit-hstack-8"><Btn primary>Primary</Btn><Btn>Secondary</Btn><Btn disabled>Disabled</Btn></div>
            <div className="aui-kit-hstack-8"><Badge text="READY" tint={AD.ok} /><Badge text="WARNING" tint={AD.warn} /><Badge text="OFFLINE" /></div>
            <Segmented options={[{ id: "table", label: "Table" }, { id: "grid", label: "Grid" }, { id: "canvas", label: "Canvas" }]} value="grid" onChange={() => {}} ariaLabel="Mode" size="regular" />
            <Range value={0.62} onChange={() => {}} ariaLabel="Slider" /><ProgressBar value={0.72} /></div>)],
          ["Interactive input controls", panel("Inputs", "Interactive states", "sliders", <div className="aui-kit-stack-10" style={{ padding: 10 }}>
            <div className="aui-kit-between" style={{ fontSize: 10 }}><span>Roughness</span><span className="aui-kit-mono aui-kit-t2" style={{ fontSize: 9 }}>{slider.toFixed(2)}</span></div><Range value={slider} onChange={setSlider} ariaLabel="Roughness" />
            <Segmented options={[{ id: "table", label: "Table" }, { id: "grid", label: "Grid" }, { id: "canvas", label: "Canvas" }]} value={mode} onChange={setMode} ariaLabel="View" size="regular" />
            <ToggleLine label="Show edges" isOn={edges} onChange={setEdges} /><ProgressBar value={slider} /></div>)],
          ["Document and inspector tabs", panel("Tabs", "Document + inspector", "columns", <div className="aui-kit-stack-10" style={{ padding: 10 }}>
            <DocumentTabs tabs={["Atlas Rig", "Greeting.anim", "Museum.show"]} selection={docTab} onChange={setDocTab} />
            <InspectorTabs tabs={[{ label: "Properties", icon: "sliders" }, { label: "Appearance", icon: "palette" }, { label: "Output", icon: "hardware" }]} selection={inspectorTab} onChange={setInspectorTab} /></div>)],
        )}

        {S("Rows & Fields",
          ["Hierarchy rows and states", panel("Tree Panel", "Disclosure + states", "list-tree", <div className="atlas-rows" style={{ padding: 7 }}>
            <ListRow icon="folder" title="Head Assembly" detail="5" selected /><ListRow icon="cube" title="Head Pan" level={1} statusColor={AD.ok} /><ListRow icon="lock" title="Tilt Yoke" level={1} /><ListRow icon="hidden" title="Jaw" detail="Hidden" level={1} /><ListRow icon="link" title="Jaw Hinge" detail="Revolute" level={1} /></div>)],
          ["Numeric property inspector", panel("Inspector", "Numeric fields", "sidebar-right", <div className="aui-kit-stack-8" style={{ padding: 10 }}>
            <Field label="Position X" value="125.00" unit="mm" /><Field label="Position Y" value="0.00" unit="mm" /><Field label="Rotation Z" value="45.0" unit="deg" /><ToggleLine label="Grounded" isOn={false} onChange={() => {}} />
            <div className="aui-kit-between"><Btn>Cancel</Btn><Btn primary>Apply</Btn></div></div>)],
        )}

        {S("Panels & Dialogs",
          ["Mate authoring dialog", <DialogCard title="Revolute 4" subtitle="Docked tool window" icon="link" confirmLabel="✓"><Field label="Type" value="Revolute" /><Field label="Connector A" value="Neck.Top" /><Field label="Connector B" value="Head.Origin" /><ToggleLine label="Offset" isOn onChange={() => {}} /><Field label="Angle" value="0.0" unit="deg" /></DialogCard>],
          ["Non-blocking notification", <NotificationCard title="Character validated" message="14 parts, 11 mates, and 3 relations are ready to animate." action="View report" />],
          ["Panel anatomy", panel("Panel Anatomy", "Standard chrome", "square-dashed", <div className="aui-kit-stack-8" style={{ padding: 10, fontSize: 10 }}>
            {[["align-left", "Title + context"], ["window", "Shared placement authority"], ["hidden", "Canvas edge restore"], ["shadow", "Floating material + shadow"]].map(([i, t]) => <span key={t} className="aui-kit-hstack-6"><Sym name={i} size={11} />{t}</span>)}</div>)],
        )}

        {S("Appearance & Layout",
          ["Material controls", panel("Appearance", "Renderer-local", "palette", <div className="aui-kit-hstack-8" style={{ gap: 12, padding: 11, alignItems: "flex-start" }}>
            <MaterialPreviewSphere roughness={0.42} metallic={0.18} size={76} />
            <div className="aui-kit-stack-8" style={{ flex: 1 }}><Field label="Finish" value="Satin" /><Field label="Roughness" value="0.42" /><Field label="Metallic" value="0.18" /><div className="aui-kit-hstack-6">{["#ff453a", "#ff9f0a", "#ffd60a", "#30d158", "#0a84ff", "#bf5af2"].map((c) => <span key={c} style={{ width: 19, height: 19, borderRadius: 3, background: c }} />)}</div></div></div>)],
          ["Theme color tokens", panel("Color Tokens", "Current theme", "swatchpalette", <div className="kit-swatches" style={{ padding: 10 }}>{tokens.map(([n, c]) => <span key={n}><i style={{ background: c }} />{n}</span>)}</div>)],
          ["Live shell layout contract", panel("Panel Layout", "Live shell contract", "columns", <div className="aui-kit-stack-8" style={{ padding: 10 }}>
            <Field label="Left panel" value={m.left} /><Field label="Right panel" value={m.right} /><Field label="Tool ribbon" value={m.ribbon} />
            <Segmented options={ATLAS_PRESETS.map((p) => ({ id: p.id, label: p.label }))} value={m.detectedPreset ?? "studio"} onChange={m.applyPreset} ariaLabel="Preset" size="regular" />
            <span className="aui-kit-t2" style={{ fontSize: 9 }}>One browser, inspector, and ribbon contract serves every workspace.</span></div>)],
        )}

        {S("App Chrome",
          ["Centered workspace navigator", <WorkspaceStageTabs stages={ATLAS_WORKSPACES.map((w) => ({ id: w.id, name: w.name, icon: w.icon }))} activeID={m.workspace} utilityStartID="nodes" labelMode={m.labelMode} />, true],
        )}

        {S("Contextual Animatronic Widgets",
          ["Hierarchy, mate, and hardware stack", <div className="aui-kit-stack-8" style={{ width: "100%" }}>
            {panel("Items", "Character hierarchy", "list-tree", <div className="atlas-rows" style={{ padding: 7 }}><div className="atlas-filter" style={{ margin: 0 }}><Sym name="search" size={9} /><span>Filter items</span></div>
              <ListRow icon="characters" title="Atlas" detail="12" /><ListRow icon="cube-filled" title="Base" level={1} /><ListRow icon="cube-filled" title="Torso" level={1} /><ListRow icon="rotate-3d" title="Head Pan" detail="+22°" level={2} selected /><ListRow icon="rotate-3d" title="Head Tilt" detail="-8°" level={2} /><ListRow icon="link" title="Jaw" level={2} /><ListRow icon="audio" title="Dialogue.wav" detail="8.0 s" /><ListRow icon="stack" title="LED Face" detail="32 × 16" /></div>)}
            {panel("Head Pan", "Revolute mate", "sliders", <div className="aui-kit-stack-6" style={{ padding: 8 }}><Field label="Angle" value="+22.0" unit="deg" /><Field label="Minimum" value="-90.0" unit="deg" /><Field label="Maximum" value="+90.0" unit="deg" /><div className="aui-kit-between" style={{ fontSize: 9 }}><span className="aui-kit-t2">Output</span><Badge text="SERVO 01" tint={AD.purple} /></div><div className="aui-kit-hstack-6"><Btn>Add keyframe</Btn><Btn>Center</Btn></div></div>)}
            {panel("Hardware", "Live output", "hardware", <div className="aui-kit-stack-3" style={{ padding: 8 }}><DeviceStatusRow name="Servo Controller" route="USB" /><DeviceStatusRow name="LED Matrix" route="Wi-Fi" /><DeviceStatusRow name="Stage Audio" route="Local" /><span className="aui-kit-hstack-6 aui-kit-t2" style={{ fontSize: 8 }}><span className="aui-kit-dot" style={{ background: AD.warn }} />Output armed, not streaming</span></div>)}</div>],
        )}

        {S("Nodes",
          ["Node types and selection states", <div className="aui-kit-stack-10"><LogicNode title="Proximity Sensor" subtitle="input" icon="sensor" color={AD.accent2} outputs={["Distance", "Triggered"]} /><LogicNode title="If / Else" subtitle="logic" icon="branch" color={AD.purple} inputs={["Condition"]} outputs={["True", "False"]} /><LogicNode title="Language Model" subtitle="ai + media" icon="brain" color={AD.pink} inputs={["Prompt", "Memory"]} outputs={["Text", "Action"]} selected /><LogicNode title="Servo Output" subtitle="hardware" icon="hardware" color={AD.ok} inputs={["Target"]} outputs={["Complete"]} warning /></div>],
          ["Searchable categorized node library", <div style={{ width: "100%" }}><NodeLibraryPanel /></div>],
          ["Selected-node inspector and typed ports", <div className="aui-kit-stack-8" style={{ width: "100%" }}><NodeInspectorPanels /></div>],
        )}

        {S("Node Canvas",["Connected behavior graph, canvas status, zoom, and auto layout", <NodeCanvas nodes={GRAPH_NODES} links={GRAPH_LINKS} title="BEHAVIOR GRAPH · WELCOME" height={380} />, true],)}

        {S("Diagnostics & Status",
          ["Viewport performance HUD", <PerformanceHUD engine="Native Metal preview" fps={60} cpuPercent={5.2} memoryMB={284} />],
          ["Metric card", <MetricCard title="Triangles" value="18,204" caption="1 part · 3 face groups" tint={AD.accent2} />],
          ["Command icon button states", <div className="aui-kit-hstack-8"><CommandButton icon="home" label="Home" /><CommandButton icon="settings" label="Settings" active /><span style={{ opacity: 0.4 }}><CommandButton icon="delete" label="Delete" /></span><Badge text="READY" tint={AD.ok} /></div>],
        )}

        {S("Timelines",
          ["Production dope-sheet timeline", <DopeSheetTimeline tracks={ANIMATE_TRACKS} progress={m.selectedTime / 8} duration={8} onScrub={(p) => m.setSelectedTime(p * 8)} audio={{ name: "Dialogue.wav" }} style={{ height: 255, width: "100%" }} />, true],
          ["Full-width Live Follow timeline", <DopeSheetTimeline tracks={ANIMATE_TRACKS.slice(0, 3)} progress={0.3} duration={8} badge={{ text: "LIVE FOLLOW" }} audio={{ name: "Dialogue", color: AD.pink }} style={{ height: 210, width: "100%" }} />, true],
          ["Show sequence", <CueTimeline tracks={CUE_TRACKS} style={{ width: "100%" }} />, true],
        )}

        {S("Viewport",["Viewport mock with selection and camera chrome", <div className="kit-stage" style={{ height: 260 }}><RobotViewport mode="UI KIT VIEWPORT" selected="Head Pan Assembly" /></div>, true],)}

        {S("Settings",["Native appearance, layout, and behavior settings", <div className="atlas-settings-inline"><SettingsPanes tab="appearance" /><SettingsPanes tab="workspace" /><SettingsPanes tab="behavior" /></div>, true],)}

        {S("Hardware",["Channel mapping", <ChannelMapTable rows={CHANNELS} />, true],)}

        {S("Coverage",["Reusable component coverage", panel("Component Coverage", `${COVERAGE.length} of ${COVERAGE.length} shown`, "validate", <div className="atlas-coverage">{COVERAGE.map(([id, sec, sp]) => <span key={id}><Sym name="status-ok" size={11} style={{ color: AD.ok }} /><span className="aui-kit-stack-1"><strong>{id}</strong><small>{sec} · {sp}</small></span></span>)}</div>), true],)}
    </>
  );
}
