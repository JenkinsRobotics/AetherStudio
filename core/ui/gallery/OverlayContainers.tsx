import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AetherIcon, Button, Checkbox, FieldRow, FloatingPanel, LinkCard, LinkCardGrid, NumberField, SelectField, TextField, ToolIcon } from "../src/index";
import { openFeatureWindow } from "../src/FeatureWindow";
import { CAD_FEATURE_EDITORS } from "./CADFeatureEditors";
import { sectionID, sectionTab } from "./showcase";
import "./OverlayContainers.css";

export const OVERLAY_CONTAINERS = [
  { title: "Window layouts", icon: "layout", section: "Window layouts", description: "Standard two-column general interface and three-column application workspace. Review both container layouts together." },
  { title: "Navigation bars", icon: "sidebar", section: "Navigation sidebars — in use, and the reference configurations", description: "App identity, navigation and collapse behavior. Apps supply destinations and actions." },
  { title: "Sidebars", icon: "sidebar", section: "Side tool bars", description: "Containers sized for the left or right column, attached or detached. Each tab can host a tree, inspector or another widget." },
  { title: "Toolbars", icon: "tools", section: "Floating toolbars", description: "Horizontal containers for the wider center column, including floating toolbars and bottom docks. Apps supply commands or widgets." },
  { title: "Floating panels and editing popups", icon: "mode-floating", section: "Floating + detached windows", description: "Shared frame, header, movement and actions. Host a feature editor, property form or information widget." },
  { title: "Settings windows", icon: "settings", section: "Settings window — universal per-app settings (macOS anatomy)", description: "Shared window and category navigation. Apps supply settings pages and values." },
  { title: "Dialogs", icon: "windows", section: "Dialogs + alerts", description: "Shared modal surface, focus and dismissal. Apps supply the question, body and action labels." },
  { title: "Anchored popovers", icon: "window", section: "Popovers", description: "Shared anchoring and dismissal around a control. Apps supply the contextual content." },
  { title: "Status bars", icon: "status-ok", section: "Status bar — every variant side by side", description: "Shared status and app-identity placement. Apps supply their actual status." },
] as const;

/** Documentation of shared containers, not a new container implementation. */
export function OverlayContainerOverview() {
  return <div className="overlay-container-overview">
    <p>Overlays are reusable containers for widgets and elements. The container sets the frame and behavior; the app chooses its contents.</p>
    <p>General interfaces use two columns: left navigation and a main workspace. Application workspaces use three columns: left sidebar, wider center area, and right sidebar. Sidebars fit the side columns; horizontal toolbars and bottom docks use the center area’s available width.</p>
    <dl className="overlay-container-contract">
      <div><dt>The container owns</dt><dd>Header and action placement, spacing, borders, selection, sizing, anchoring, collapse, movement, focus and dismissal—as appropriate to its type.</dd></div>
      <div><dt>The app supplies</dt><dd>Content, tabs, tools, labels, data and actions. Changing a sidebar tab or using a popup for a different task does not create a new container design.</dd></div>
    </dl>
    <p>Use the shared standards below across apps. New container designs need separate review and approval; reference specimens are not additional standards.</p>
    <LinkCardGrid ariaLabel="Overlay container standards">
      {OVERLAY_CONTAINERS.map(item => <LinkCard key={item.title} title={item.title} description={item.description}
        icon={<AetherIcon name={item.icon} />} action="Review container" href={`#tab=${sectionTab(item.section)}&section=${sectionID(item.section)}`} />)}
    </LinkCardGrid>
  </div>;
}

function SampleContents({ kind }: { kind: string }) {
  const [name, setName] = useState("Sample part");
  const [width, setWidth] = useState(60);
  const [showEdges, setShowEdges] = useState(true);
  return <div className="overlay-sample-content">
    {kind === "form" ? <>
      <FieldRow label="Name"><TextField aria-label="Sample name" value={name} onChange={event => setName(event.target.value)} /></FieldRow>
      <FieldRow label="Width"><NumberField aria-label="Sample width" value={width} unit="mm" onValueChange={value => setWidth(value ?? 0)} /></FieldRow>
      <Checkbox label="Show edges" checked={showEdges} onChange={event => setShowEdges(event.target.checked)} />
    </> : <><strong>About this sample</strong><p>This information uses the same container as the property form. Only the content changes.</p></>}
  </div>;
}

function ContentChoice({ value, onChange, features = false }: { value: string; onChange: (value: string) => void; features?: boolean }) {
  return <label className="overlay-content-choice">Example content
    <SelectField aria-label="Example content" value={value} onChange={event => onChange(event.target.value)}
      options={[
        ...(features ? CAD_FEATURE_EDITORS.map(editor => ({ value: editor.id, label: editor.id === "mate" ? "Mate" : editor.title.replace(/\s+\d+$/, "") })) : []),
        { value: "form", label: "Property form" }, { value: "info", label: "Information" },
      ]} />
  </label>;
}

export function FloatingContainerSpecimen() {
  const [kind, setKind] = useState("form");
  const [open, setOpen] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  return <div className="overlay-container-specimen" role="group" aria-label="Floating panel container specimen">
    <small>FloatingPanel · modeless container</small>
    <div className="overlay-floating-specimen">
      {open ? <FloatingPanel title="Floating panel" x={position.x} y={position.y} width={320}
        onMove={(x, y) => setPosition({ x, y })} onClose={() => setOpen(false)}>
        <SampleContents kind={kind} />
      </FloatingPanel> : <Button onClick={() => { setPosition({ x: 0, y: 0 }); setOpen(true); }}>Reopen floating panel</Button>}
    </div>
    <ContentChoice value={kind} onChange={setKind} />
  </div>;
}

export function EditingContainerSpecimen({ variant = "standard", initialContent = "form" }: {
  variant?: "standard" | "compact";
  initialContent?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [iconHost, setIconHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(true);
  const [kind, setKind] = useState(initialContent);
  const [notice, setNotice] = useState("");
  const editor = CAD_FEATURE_EDITORS.find(item => item.id === kind);
  const compact = variant === "compact";
  const label = compact ? "Compact editing window" : "Standard editing window";
  useEffect(() => {
    if (!open || !host.current) { setBody(null); setIconHost(null); return; }
    const icon = document.createElement("span");
    const title = editor ? (compact ? editor.title.replace(/\s+\d+$/, "") : editor.title) : "Editing popup";
    const win = openFeatureWindow({ viewport: host.current, className: "overlay-editing-specimen", title, variant, headerIcon: icon,
      acceptLabel: compact ? "Apply" : editor?.accept ?? "Apply sample",
      discardLabel: compact ? "Cancel" : editor ? "Discard" : "Discard sample",
      onAccept: () => { setNotice(`${editor?.title ?? "Sample"} applied`); setOpen(false); },
      onDiscard: () => { setNotice(`${editor?.title ?? "Sample"} discarded`); setOpen(false); },
    });
    editor?.build(win);
    setBody(win.body);
    setIconHost(icon);
    return () => win.close();
  }, [open, variant, compact, editor]);
  return <div className="overlay-container-specimen" role="group" aria-label={label}>
    <small>{label} · {compact ? "bottom actions" : "header actions"}</small>
    <div ref={host} className="overlay-editing-host" />
    {open && body && !editor && createPortal(<SampleContents kind={kind} />, body)}
    {open && iconHost && createPortal(editor ? <ToolIcon name={editor.icon} /> : <AetherIcon name="settings" />, iconHost)}
    {!open && <Button onClick={() => { setNotice(""); setOpen(true); }}>Reopen editing popup</Button>}
    <ContentChoice value={kind} onChange={value => { setKind(value); setNotice(""); }} features />
    {notice && <small role="status">{notice}</small>}
  </div>;
}

export function OverlayWindowSpecimens() {
  return <><p className="overlay-container-intro">Standard floating and detached windows. The modeless panel and both editing window variants use shared containers. Switch the example content to review feature editors, property forms or information.</p>
    <FloatingContainerSpecimen />
    <EditingContainerSpecimen variant="standard" initialContent="mate" />
    <EditingContainerSpecimen variant="compact" initialContent="sketch" />
  </>;
}
