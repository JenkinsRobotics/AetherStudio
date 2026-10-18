import { useEffect, useRef, useState } from "react";
import { AetherIcon, AppWordmark, Button, Dialog, DockPanel, DocumentBar, DocumentTabs, IconButton, Rail, RailButton, Ribbon, RibbonGroup, RibbonTool, SegmentedControl, SelectField, ToolIcon, ToolIconTheme, ViewportNavigationCube, useScopedAetherTheme, type ViewportOrientation } from "../../src";
import { StudioLighting } from "../spotlight-studio/SpotlightWidgets";
import { initialLighting } from "../spotlight-studio/state";
import { WheelViewport, type WheelViewHandle } from "./WheelViewport";
import { WheelAppearance, WheelBrowser, WheelDimensions, WheelProperties } from "./WheelWidgets";
import { initialDisplay, initialWheel, updateWheel, type WheelEditor, type WheelStudy } from "./state";
import "../spotlight-studio/spotlight-studio.css";
import "./wheel-studio.css";
const directions = { front: [0, 0, 1], back: [0, 0, -1], right: [1, 0, 0], left: [-1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0] } as const;
export function WheelStudioDemo({ onExit }: { onExit?: () => void }) {
  useScopedAetherTheme("aether-slate", "dark");
  const [wheel, setWheel] = useState(initialWheel), [assembly, setAssembly] = useState(false), [editor, setEditor] = useState<WheelEditor>("properties");
  const [selected, setSelected] = useState("wheel"), [display, setDisplay] = useState(initialDisplay), [lighting, setLighting] = useState({ ...initialLighting, azimuth: 55, power: 230, fill: .65 });
  const [orientation, setOrientation] = useState<ViewportOrientation>([0, 0, 0, 1]), viewport = useRef<WheelViewHandle>(null);
  const [mobile, setMobile] = useState<"features" | "inspector" | null>(null), [about, setAbout] = useState(false), [notes, setNotes] = useState("");
  const [download, setDownload] = useState<string | null>(null), [exporting, setExporting] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => () => { if (download) URL.revokeObjectURL(download); }, [download]);
  const change = (patch: Partial<WheelStudy>) => setWheel(value => updateWheel(value, patch));
  const open = (value: WheelEditor) => { setEditor(value); setMobile("inspector"); };
  const select = (id: string) => {
    setSelected(id);
    if (id === "origin") viewport.current?.fit();
    else if (id === "top" || id === "front" || id === "right") viewport.current?.direction(directions[id]);
    else if (id === "rounding" || id === "appearance") setEditor(id);
    else if (["profile", "revolve", "tread", "flange", "bore"].includes(id)) setEditor("profile");
    else if (id === "wheel" || id === "axle") setEditor("properties");
  };
  async function capture() {
    setExporting(true); setNotice("");
    try { const blob = await viewport.current?.capture(); if (blob) setDownload(URL.createObjectURL(blob)); else setNotice("The render could not be exported. Check that WebGL is available."); }
    catch { setNotice("The render could not be exported. Please try again."); }
    finally { setExporting(false); }
  }
  return <ToolIconTheme pack="graphite-ribbon" palette="dark"><div className="wheel-studio">
    <DocumentBar windowChrome={false} className="ws-header" leading={<><AppWordmark app="cad" size={32}/><span className="ws-separator"/><strong className="ws-document-title">Train Cart Wheel</strong><span className="ws-main">Main</span><span className="ws-local">Local concept</span></>} trailing={<><span className="ws-mobile-actions"><IconButton label="Show features" aria-pressed={mobile === "features"} onClick={() => setMobile(value => value === "features" ? null : "features")}><AetherIcon name="folder"/></IconButton><IconButton label="Show inspector" aria-pressed={mobile === "inspector"} onClick={() => setMobile(value => value === "inspector" ? null : "inspector")}><AetherIcon name="sliders"/></IconButton></span><IconButton label="About Wheel Studio" onClick={() => setAbout(true)}><AetherIcon name="info"/></IconButton>{onExit && <Button onClick={onExit}>Demo apps</Button>}</>}/>
    <main className="ws-workspace" aria-label="Wheel studio workspace">
      <aside className={`ws-left aui-float ${mobile === "features" ? "ws-panel-open" : ""}`} aria-label="Document and feature browser">
        <Rail className="ws-rail" role="navigation" aria-label="Workspace views">{([{ id: "features", label: "Tabs", icon: "folder" }, { id: "properties", label: "Properties", icon: "sliders" }, { id: "appearance", label: "Appearance", icon: "appearance" }, { id: "notes", label: "Notes", icon: "file-sketch" }] as const).map(item => <RailButton key={item.id} label={item.label === "Tabs" ? "Show document tabs" : `Open ${item.label}`} active={item.id === "features" ? mobile === "features" || editor === "profile" : editor === item.id} onClick={() => item.id === "features" ? setMobile("features") : open(item.id)}><AetherIcon name={item.icon}/><span>{item.label}</span></RailButton>)}</Rail>
        <DockPanel title="Tabs"><div className="ws-open-documents"><p>OPEN IN THIS DOCUMENT</p>{[{ id: false, name: wheel.name || "Train cart wheel", type: "Part Studio" }, { id: true, name: "Wheelset assembly", type: "Assembly" }].map(item => <button key={item.type} type="button" aria-label={`Open ${item.type}`} aria-pressed={assembly === item.id} onClick={() => { setAssembly(item.id); setSelected("wheel"); }}><ToolIcon name={item.id ? "assembly" : "revolve"}/><span><strong>{item.name}</strong><small>{item.type}</small></span></button>)}</div><WheelBrowser wheel={wheel} assembly={assembly} selected={selected} onSelect={select} onVisibility={() => change({ visible: !wheel.visible })}/></DockPanel>
      </aside>
      <section className="ws-center" aria-label="Central workspace">
        <div className="ws-ribbon aui-float"><Ribbon><RibbonGroup label="Wheel study"><RibbonTool icon={<ToolIcon name="sketch"/>} label="Profile" active={editor === "profile"} onClick={() => open("profile")}/><RibbonTool icon={<ToolIcon name="revolve"/>} label="Revolve" onClick={() => { open("profile"); setDisplay(value => ({ ...value, section: false })); viewport.current?.fit(); }}/><RibbonTool icon={<ToolIcon name="fillet"/>} label="Rounding" active={editor === "rounding"} onClick={() => open("rounding")}/><RibbonTool icon={<AetherIcon name="appearance"/>} label="Material" active={editor === "appearance"} onClick={() => open("appearance")}/><RibbonTool icon={<AetherIcon name="lighting"/>} label="Lighting" active={editor === "lighting"} onClick={() => open("lighting")}/></RibbonGroup><RibbonGroup label="View"><RibbonTool icon={<ToolIcon name="plane"/>} label="Cutaway" active={display.section} aria-pressed={display.section} onClick={() => setDisplay(value => ({ ...value, section: !value.section }))}/><RibbonTool icon={<AetherIcon name="fit"/>} label="Fit" onClick={() => viewport.current?.fit()}/><RibbonTool icon={<AetherIcon name="file-image"/>} label={exporting ? "Rendering…" : "Export PNG"} disabled={exporting} onClick={capture}/></RibbonGroup></Ribbon></div>
        <div className="ws-render-area"><WheelViewport ref={viewport} study={wheel} assembly={assembly} lighting={lighting} display={display} selected={selected} turntable={false} onSelect={select} onOrientation={setOrientation}/><div className="ws-vignette"/>
          <div className="ws-shading"><SelectField aria-label="Viewport shading" value={display.wireframe ? "wireframe" : "shaded"} options={[{ value: "shaded", label: "Shaded" }, { value: "wireframe", label: "Wireframe" }]} onChange={event => setDisplay(value => ({ ...value, wireframe: event.target.value === "wireframe" }))}/></div>
          <div className="ws-cube"><ViewportNavigationCube orientation={orientation} onSelectView={view => viewport.current?.direction(directions[view])} onSelectDirection={value => viewport.current?.direction(value)} onFit={() => viewport.current?.fit()} onNudge={(x, y) => viewport.current?.nudge(x, y)} onRoll={value => viewport.current?.roll(value)}/></div>
          <div className="ws-view-tools">{([{ key: "edges", icon: "cube-transparent", label: "Toggle edges" }, { key: "grid", icon: "grid-3", label: "Toggle grid" }, { key: "bounds", icon: "cube", label: "Toggle bounds" }] as const).map(item => <IconButton key={item.key} label={item.label} aria-pressed={display[item.key]} onClick={() => setDisplay(value => ({ ...value, [item.key]: !value[item.key] }))}><AetherIcon name={item.icon}/></IconButton>)}</div>
          <div className="ws-render-status" role="status">{notice || `${assembly ? "WHEELSET" : "PART STUDIO"} · Ø ${wheel.diameter} × ${wheel.width} mm`}<span>Drag to orbit · Right-drag to pan · Scroll to zoom</span></div>
        </div>
      </section>
      <aside className={`ws-right aui-float ${mobile === "inspector" ? "ws-panel-open" : ""}`} aria-label="Wheel inspector"><DockPanel title={wheel.name || "Train cart wheel"} actions={<IconButton size="small" label="Reset wheel" onClick={() => { setWheel(initialWheel); setDisplay(initialDisplay); }}><AetherIcon name="undo"/></IconButton>}>
        <p className="ws-inspector-subtitle">{assembly ? "Wheelset assembly" : "Part Studio"}</p><SegmentedControl ariaLabel="Inspector view" value={editor === "appearance" || editor === "notes" ? editor : "properties"} options={[{ id: "properties", label: "Properties" }, { id: "appearance", label: "Appearance" }, { id: "notes", label: "Notes" }]} onChange={value => open(value as WheelEditor)}/>
        {editor === "profile" || editor === "rounding" ? <WheelDimensions wheel={wheel} onChange={change} rounding={editor === "rounding"}/> : editor === "appearance" ? <WheelAppearance wheel={wheel} onChange={change}/> : editor === "lighting" ? <div className="ws-lighting"><StudioLighting lighting={lighting} onChange={setLighting}/></div> : editor === "notes" ? <div className="ws-notes"><label htmlFor="wheel-notes">Design notes</label><textarea id="wheel-notes" className="aui-textarea" placeholder="Record a dimension or finish to revisit…" value={notes} onChange={event => setNotes(event.target.value)}/><p className="ws-hint">Local notes for this session. Reloading clears this concept study.</p></div> : <WheelProperties wheel={wheel} onChange={change} display={display} onDisplay={setDisplay} assembly={assembly}/>}
      </DockPanel></aside>
    </main>
    <footer className="ws-documents aui-float"><DocumentTabs ariaLabel="Wheel documents" tabs={[{ id: "part", label: wheel.name || "Train cart wheel", icon: <ToolIcon name="revolve"/>, status: "Part Studio" }, { id: "assembly", label: "Wheelset assembly", icon: <ToolIcon name="assembly"/>, status: "Assembly" }]} activeID={assembly ? "assembly" : "part"} onSelect={id => { setAssembly(id === "assembly"); setSelected("wheel"); }}/><span>MM <b>·</b> PERSPECTIVE</span></footer>
    <Dialog open={about} title="Aether Wheel Studio" onClose={() => setAbout(false)} actions={<Button onClick={() => setAbout(false)}>Done</Button>}><p>A reference-inspired concept built from Aether UI components, with a live procedural wheel and wheelset assembly.</p><p>Use Profile and Rounding to change the model. Select materials, adjust studio lighting, orbit the view, inspect a cutaway or export a PNG.</p><p>This is a render study, not an exact CAD kernel. Wheel and assembly share the same parameters. Edits and notes last until reload.</p></Dialog>
    <Dialog open={!!download} title="Render ready" onClose={() => setDownload(null)} actions={<Button onClick={() => setDownload(null)}>Done</Button>}>{download && <><img className="ws-export-preview" src={download} alt="Exported wheel render"/><a className="aui-button aui-button--primary" href={download} download="train-cart-wheel.png">Download PNG</a></>}</Dialog>
  </div></ToolIconTheme>;
}
