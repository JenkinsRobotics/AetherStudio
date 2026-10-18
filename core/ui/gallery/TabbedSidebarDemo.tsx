import { useState } from "react";
import { AetherIcon, Button, Checkbox, IconButton, Menu, NumberField, SegmentedControl, WorkspaceShell, type LayoutPreset, type MenuItem } from "../src/index";
import { useSidebarWidgetPanels } from "./SidebarWidgetPanels";
import "./SidebarProperties.css";

export function SidebarProperties() {
  const [section, setSection] = useState("properties");
  const [values, setValues] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [plane, setPlane] = useState("No construction plane selected");
  const [planes, setPlanes] = useState<Record<string, boolean>>({ XY: true, YZ: true, XZ: true });
  return <div className="sidebar-properties">
    <SegmentedControl className="sidebar-properties-mode" ariaLabel="Inspector section" value={section} onChange={setSection} options={[{ id: "display", label: "Display" }, { id: "properties", label: "Properties" }]} />
    {section === "display" ? <><Checkbox label="Show edges" defaultChecked /><Checkbox label="Show grid" defaultChecked /><Checkbox label="X-ray" /></> : <>
      {["Location", "Rotation", "Scale"].map(group => <div key={group} className="sidebar-properties-group">
        <strong>{group}</strong>
        {["X", "Y", "Z"].map(axis => {
          const id = `${group} ${axis}`;
          return <div key={id} className="sidebar-properties-axis">
            <span>{axis}</span>
            <NumberField aria-label={id} value={values[id] ?? (group === "Scale" ? 1 : 0)} unit={group === "Location" ? "cm" : group === "Rotation" ? "°" : undefined} disabled={locked[id]} onValueChange={value => setValues(old => old[id] === (value ?? 0) ? old : ({ ...old, [id]: value ?? 0 }))} />
            <IconButton appearance="glyph" label={`${locked[id] ? "Unlock" : "Lock"} ${id}`} aria-pressed={!!locked[id]} onClick={() => setLocked(old => ({ ...old, [id]: !old[id] }))}><AetherIcon name={locked[id] ? "lock" : "unlock"} /></IconButton>
          </div>;
        })}
      </div>)}
      <strong style={{ fontSize: 11 }}>Construction planes</strong>
      {/* Plane visibility is a set of toggle buttons, not checkboxes. */}
      <div role="group" aria-label="Construction planes" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>{["XY", "YZ", "XZ"].map(axis =>
        <Button key={axis} active={planes[axis]} aria-pressed={planes[axis]} onClick={() => setPlanes(old => ({ ...old, [axis]: !old[axis] }))}>{axis}</Button>)}</div>
      <Button onClick={() => setPlane("Construction plane from selection")}>Plan from selection</Button>
      <Button onClick={() => setPlane("Construction plane from camera")}>Plan from camera</Button>
      <small role="status">{plane}</small>
    </>}
  </div>;
}

type Options = { preset: LayoutPreset; side: "left" | "right"; attachment: "attached" | "detached"; tabs: "rail" | "tabs-top" | "tabs-bottom";
  height: string; outside: boolean; content: "framed" | "canvas" };
const OPTION_LABELS = {
  preset: { floating: "Floating", docked: "Docked", canvas: "Canvas (hover edges)" },
  side: { right: "Right", left: "Left" },
  attachment: { attached: "Attached — one card", detached: "Detached — separate tray" },
  height: { auto: "Standard (left fills, right fits)", fill: "Full height", content: "Fit content", fixed: "Fixed · 360 px" },
  content: { framed: "Framed content", canvas: "Edge-to-edge canvas" },
} as const;
const HEADINGS: Record<keyof typeof OPTION_LABELS, string> = { preset: "Layout", side: "Workspace side", attachment: "Container", height: "Panel height", content: "Workspace content" };

/** One sidebar in one full-size workspace. Right-click (or Options) to change how it floats,
 *  docks, attaches and anchors; the widget updates in place (Jonathan, 2026-10-14). */
export function TabbedSidebarDemo({ fullScreen = false }: { fullScreen?: boolean } = {}) {
  const [options, setOptions] = useState<Options>({ preset: "floating", side: "right", attachment: "attached", tabs: "tabs-top", height: "auto", outside: false, content: "framed" });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const widgets = useSidebarWidgetPanels();
  const anchor = options.tabs === "rail" ? options.side : options.tabs === "tabs-top" ? "top" : "bottom";
  const panels = [
    { id: "properties", title: "Properties", icon: <AetherIcon name="settings" />, content: <SidebarProperties />, chromeless: true },
    ...widgets.panels,
  ].map(panel => ({ ...panel, floatingHeight: options.height === "auto" ? undefined : options.height === "fixed" ? 360 : options.height as "fill" | "content" }));
  const items: MenuItem[] = [
    ...(Object.keys(OPTION_LABELS) as (keyof typeof OPTION_LABELS)[]).flatMap((key) =>
      Object.entries(OPTION_LABELS[key]).map(([value, label], index): MenuItem => ({ id: `${key}:${value}`, label, kind: "radio",
        checked: options[key] === value, heading: index === 0 ? HEADINGS[key] : undefined, separatorBefore: index === 0 && key !== "preset" }))),
    ...(["top", "bottom", "left", "right"] as const).map((edge, index): MenuItem => ({
      id: `anchor:${edge}`, label: `Anchor ${edge}`, kind: "radio", checked: anchor === edge,
      heading: index === 0 ? "Collapse to edge" : undefined, separatorBefore: index === 0,
    })),
    { id: "outside", label: "Open toward window edge", kind: "checkbox", checked: options.outside, heading: "Opening", separatorBefore: true },
  ];
  const choose = (id: string) => {
    if (id === "outside") { setOptions(old => ({ ...old, outside: !old.outside })); return; }
    if (id.startsWith("anchor:")) {
      const edge = id.slice(7);
      setOptions(old => edge === "left" || edge === "right" ? { ...old, side: edge, tabs: "rail" } : { ...old, tabs: edge === "top" ? "tabs-top" : "tabs-bottom" });
      return;
    }
    const [key, value] = id.split(":") as [keyof Options, string];
    setOptions(old => ({ ...old, [key]: value }));
  };
  const summary = `${OPTION_LABELS.preset[options.preset]} · ${OPTION_LABELS.side[options.side]} · ${OPTION_LABELS.attachment[options.attachment]} · Anchored ${anchor}`;
  return <div role="region" aria-label="Sidebar workspace" style={{ minWidth: 0, display: "grid", gap: 10, width: "100%", height: fullScreen ? "100%" : undefined, gridTemplateRows: "auto minmax(0, 1fr)" }}
    onContextMenu={event => { if (event.defaultPrevented) return; event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }); }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Button onClick={event => { const box = event.currentTarget.getBoundingClientRect(); setMenu({ x: box.left, y: box.bottom + 4 }); }}>Options…</Button>
      <small style={{ color: "var(--aether-color-text-dim)" }}>{summary} — right-click anywhere in the workspace for options.</small>
    </div>
    <WorkspaceShell key={`${options.side}-${options.tabs}`} preset={options.preset} contentPresentation={options.content} inheritChromePreferences={false}
      sidebarAttachment={options.attachment} panelsOnOuterEdge={options.outside} sidebarVariant={options.tabs}
      leftPanels={options.side === "left" ? panels : []} rightPanels={options.side === "right" ? panels : []}
      defaultOpenLeft={["properties"]} defaultOpenRight={["properties"]}
      toolbar={<div className="aui-float" style={{ padding: "8px 18px", fontSize: 11 }}>Design workspace</div>} frameToolbar={false}
      style={{ height: fullScreen ? "100%" : "max(560px, calc(100vh - 300px))", minHeight: 0 }}>
      {widgets.preview}
    </WorkspaceShell>
    <Menu open={Boolean(menu)} anchor={menu} ariaLabel="Sidebar options" items={items} onSelect={choose} onClose={() => setMenu(null)} />
  </div>;
}
