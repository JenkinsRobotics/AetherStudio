import { useEffect, useRef, useState } from "react";
import { AetherIcon, AppWordmark, Button, Checkbox, Dialog, DockPanel, DocumentBar, DocumentTabs, IconButton, Ribbon, RibbonGroup, RibbonTool, ViewportNavigationCube, useScopedAetherTheme, type ViewportOrientation } from "../../src";
import { SpotlightViewport, type SpotlightViewHandle } from "./SpotlightViewport";
import { StudyBrowser, StudyGeometry, StudySurface, StudioLighting, type Inspector } from "./SpotlightWidgets";
import { initialLighting, studies, updateStudy, type Study } from "./state";
import "./spotlight-studio.css";

const editors = [{ id: "shape", label: "Shape", icon: "cube-transparent" }, { id: "rounding", label: "Rounding", icon: "sliders" }, { id: "surface", label: "Surface", icon: "appearance" }, { id: "lighting", label: "Lighting", icon: "lighting" }] as const;
const directions = { front: [0, 0, 1], back: [0, 0, -1], right: [1, 0, 0], left: [-1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0] } as const;
export function SpotlightStudioDemo({ onExit }: { onExit?: () => void }) {
  useScopedAetherTheme("aether-slate", "dark");
  const [documents, setDocuments] = useState(studies), [active, setActive] = useState("enclosure");
  const study = documents.find(item => item.id === active)!;
  const [editor, setEditor] = useState<Inspector>("rounding"), [selected, setSelected] = useState("rounding");
  const [lighting, setLighting] = useState(initialLighting), [grid, setGrid] = useState(true), [wireframe, setWireframe] = useState(false), [turntable, setTurntable] = useState(false);
  const [orientation, setOrientation] = useState<ViewportOrientation>([0, 0, 0, 1]), viewport = useRef<SpotlightViewHandle>(null);
  const [mobile, setMobile] = useState<"features" | "inspector" | null>(null), [about, setAbout] = useState(false);
  const [download, setDownload] = useState<string | null>(null), [exporting, setExporting] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => () => { if (download) URL.revokeObjectURL(download); }, [download]);
  const change = (patch: Partial<Study>) => setDocuments(items => items.map(item => item.id === active ? updateStudy(item, patch) : item));
  const open = (id: Inspector) => { setEditor(id); setSelected(id); setMobile("inspector"); };
  const select = (id: string) => { setSelected(id); if (editors.some(item => item.id === id)) setEditor(id as Inspector); else if (id === "body" || id === "lid") setEditor("shape"); };
  async function capture() {
    setExporting(true); setNotice("");
    try { const blob = await viewport.current?.capture(); if (blob) setDownload(URL.createObjectURL(blob)); else setNotice("The render could not be exported. Check that WebGL is available."); }
    catch { setNotice("The render could not be exported. Please try again."); }
    finally { setExporting(false); }
  }
  return <div className="spotlight-studio">
    <DocumentBar windowChrome={false} className="ss-header" leading={<><AppWordmark app="cad" size={32}/><span className="ss-header-separator"/><strong className="ss-document-name">{study.name}</strong><span className="ss-local">Local study</span></>} trailing={<><span className="ss-mobile-actions"><IconButton label="Show features" aria-pressed={mobile === "features"} onClick={() => setMobile(value => value === "features" ? null : "features")}><AetherIcon name="folder"/></IconButton><IconButton label="Show inspector" aria-pressed={mobile === "inspector"} onClick={() => setMobile(value => value === "inspector" ? null : "inspector")}><AetherIcon name="sliders"/></IconButton></span><IconButton label="About Spotlight Studio" onClick={() => setAbout(true)}><AetherIcon name="info"/></IconButton>{onExit && <Button onClick={onExit}>Demo apps</Button>}</>}/>
    <main className="ss-workspace" aria-label="Spotlight studio workspace">
      <aside className={`ss-left aui-float ${mobile === "features" ? "ss-panel-open" : ""}`} aria-label="Feature browser"><DockPanel><StudyBrowser study={study} selected={selected} onSelect={select} onVisibility={id => change({ [id]: !study[id] })}/></DockPanel></aside>
      <section className="ss-center" aria-label="Central workspace">
      <div className="ss-ribbon aui-float"><Ribbon><RibbonGroup label="Study">{editors.map(item => <RibbonTool key={item.id} icon={<AetherIcon name={item.icon}/>} label={item.label} active={editor === item.id} aria-pressed={editor === item.id} onClick={() => open(item.id)}/>)}</RibbonGroup><RibbonGroup label="View"><RibbonTool icon={<AetherIcon name="fit"/>} label="Fit" onClick={() => viewport.current?.fit()}/><RibbonTool icon={<AetherIcon name="rotate-3d"/>} label="Turntable" active={turntable} aria-pressed={turntable} onClick={() => setTurntable(value => !value)}/><RibbonTool icon={<AetherIcon name="file-image"/>} label={exporting ? "Rendering…" : "Export PNG"} disabled={exporting} onClick={capture}/></RibbonGroup></Ribbon></div>
      <div className="ss-render-area"><SpotlightViewport ref={viewport} study={study} lighting={lighting} grid={grid} wireframe={wireframe} selected={selected} turntable={turntable} onSelect={select} onOrientation={setOrientation}/><div className="ss-vignette"/>
      <div className="ss-cube"><ViewportNavigationCube orientation={orientation} onSelectView={view => viewport.current?.direction(directions[view])} onSelectDirection={value => viewport.current?.direction(value)} onFit={() => viewport.current?.fit()} onNudge={(x, y) => viewport.current?.nudge(x, y)} onRoll={value => viewport.current?.roll(value)}/></div>
      <div className="ss-scene-caption"><span>STUDIO / 01</span><strong>{study.name}</strong><p>Drag to orbit · Scroll to zoom · Select a part</p></div>
      <div className="ss-render-status" role="status">{notice || `${turntable ? "Turntable running" : "Live render"} · ${study.length} × ${study.width} × ${study.height} mm`}</div>
      </div></section>
      <aside className={`ss-right aui-float ${mobile === "inspector" ? "ss-panel-open" : ""}`} aria-label="Study inspector"><DockPanel title={editors.find(item => item.id === editor)!.label} actions={<IconButton label="Reset this study" size="small" onClick={() => change(studies().find(item => item.id === active)!)}><AetherIcon name="undo"/></IconButton>}>
        {editor === "lighting" ? <StudioLighting lighting={lighting} onChange={setLighting}/> : editor === "surface" ? <StudySurface study={study} onChange={change}/> : <StudyGeometry study={study} onChange={change} rounding={editor === "rounding"}/>}
        <div className="ss-display"><Checkbox label="Ground grid" checked={grid} onChange={event => setGrid(event.target.checked)}/><Checkbox label="Wireframe" checked={wireframe} onChange={event => setWireframe(event.target.checked)}/></div>
      </DockPanel></aside>
    </main>
    <footer className="ss-documents aui-float"><DocumentTabs ariaLabel="Design studies" tabs={documents.map(item => ({ id: item.id, label: item.name, icon: <AetherIcon name="cube-transparent"/> }))} activeID={active} onSelect={id => { setActive(id); setSelected("rounding"); }}/><span>MM <b>•</b> PERSPECTIVE</span></footer>
    <Dialog open={about} title="Aether Spotlight Studio" onClose={() => setAbout(false)} actions={<Button onClick={() => setAbout(false)}>Done</Button>}><p>A live 3D design study composed from Aether UI panels, fields, toolbars and navigation. Drag to orbit, right-drag to pan, and scroll to zoom.</p><p>Edit the enclosure dimensions and rounded edges, or use Lighting to move the spotlight and tune its beam. Export PNG captures the rendered scene without the interface.</p><p>This concept uses procedural render geometry. It is not a CAD kernel, and studies reset when you reload.</p></Dialog>
    <Dialog open={!!download} title="Render ready" onClose={() => setDownload(null)} actions={<Button onClick={() => setDownload(null)}>Done</Button>}>{download && <><img className="ss-export-preview" src={download} alt="Exported spotlight render"/><a className="aui-button aui-button--primary" href={download} download={`${study.id}-render.png`}>Download PNG</a></>}</Dialog>
  </div>;
}
