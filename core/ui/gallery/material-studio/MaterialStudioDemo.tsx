import { useEffect, useRef, useState } from "react";
import { AetherIcon, AppMark, Button, Checkbox, Dialog, DockPanel, DocumentBar, FloatingPanel, FloatingToolbar, IconButton, MenuButton, Rail, RailButton, useScopedAetherTheme } from "../../src";
import { StudioViewport, type StudioTool } from "./StudioViewport";
import { StudioLightingControls, StudioMaterialControls, StudioMaterialShelf, StudioPreviewTimeline, StudioSceneTree, StudioTransformControls } from "./StudioWidgets";
import { DURATION, MATERIALS, identityTransform, initialObjects, nextPreviewTime, type StudioMaterial, type StudioObject, type StudioTransform } from "./state";
import "./material-studio.css";

interface Study { objects: StudioObject[]; materials: StudioMaterial[]; }
const freshStudy = (): Study => ({ objects: initialObjects(), materials: MATERIALS.map(material => ({ ...material })) });
const TOOLS: { id: StudioTool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "cursor" }, { id: "orbit", label: "Orbit camera", icon: "rotate-3d" },
  { id: "translate", label: "Move object", icon: "move" }, { id: "rotate", label: "Rotate object", icon: "rotate" }, { id: "scale", label: "Scale object", icon: "scale" },
];

export function MaterialStudioDemo({ onExit }: { onExit?: () => void }) {
  useScopedAetherTheme("aether-slate", "dark");
  const [history, setHistory] = useState<{ past: Study[]; present: Study; future: Study[] }>({ past: [], present: freshStudy(), future: [] });
  const study = history.present;
  const [selected, setSelected] = useState("head"), [tool, setTool] = useState<StudioTool>("select");
  const [lights, setLights] = useState({ key: true, rim: true }), [exposure, setExposure] = useState(.95);
  const [grid, setGrid] = useState(false), [wireframe, setWireframe] = useState(false), [resetView, setResetView] = useState(0);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [loop, setLoop] = useState(true);
  const [materialOpen, setMaterialOpen] = useState(() => window.innerWidth > 800), [transformOpen, setTransformOpen] = useState(() => window.innerWidth >= 1440 && window.innerHeight >= 800);
  const [about, setAbout] = useState(false), [notice, setNotice] = useState("Drag to orbit · Scroll to zoom");
  const [download, setDownload] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 900, height: 500 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const object = study.objects.find(item => item.id === selected) ?? study.objects[0];
  const material = study.materials.find(item => item.id === object.material)!;
  const lightSelected = selected === "key" || selected === "rim";
  useEffect(() => { const element = viewport.current; if (!element) return; const observer = new ResizeObserver(() => { const rect = element.getBoundingClientRect(); setSize({ width: rect.width, height: rect.height }); }); observer.observe(element); return () => observer.disconnect(); }, []);
  useEffect(() => { if (!playing) return; let request = 0, previous = performance.now(); const advance = (now: number) => { const delta = Math.min(.1, (now - previous) / 1000); previous = now; setTime(value => nextPreviewTime(value, delta, loop)); request = requestAnimationFrame(advance); }; request = requestAnimationFrame(advance); return () => cancelAnimationFrame(request); }, [playing, loop]);
  useEffect(() => { if (!loop && time >= DURATION) setPlaying(false); }, [loop, time]);
  useEffect(() => () => { if (download) URL.revokeObjectURL(download); }, [download]);
  function edit(change: (value: Study) => Study) {
    setHistory(value => {
      const present = change(value.present);
      if (JSON.stringify(present) === JSON.stringify(value.present)) return value;
      return { past: [...value.past.slice(-39), value.present], present, future: [] };
    });
  }
  const transform = (id: string, value: StudioTransform) => edit(doc => ({ ...doc, objects: doc.objects.map(item => item.id === id ? { ...item, transform: value } : item) }));
  const assign = (id: string) => { edit(doc => ({ ...doc, objects: doc.objects.map(item => item.id === object.id ? { ...item, material: id } : item) })); setNotice(`${study.materials.find(item => item.id === id)?.name} assigned to ${object.name}`); };
  const toggleLight = (id: "key" | "rim") => setLights(value => ({ ...value, [id]: !value[id] }));
  const toggleVisibility = (id: string) => edit(doc => ({ ...doc, objects: doc.objects.map(item => item.id === id ? { ...item, visible: !item.visible } : item) }));
  function undo() { setHistory(value => value.past.length ? { past: value.past.slice(0, -1), present: value.past[value.past.length - 1], future: [value.present, ...value.future] } : value); }
  function redo() { setHistory(value => value.future.length ? { past: [...value.past, value.present], present: value.future[0], future: value.future.slice(1) } : value); }
  function chooseTool(id: StudioTool) { setPlaying(false); setTime(0); setTool(id); setNotice(id === "select" || id === "orbit" ? "Drag to orbit · Scroll to zoom" : "Drag the colored handles to transform the selected object"); }
  function create(id: string) { setSelected(id); edit(doc => ({ ...doc, objects: doc.objects.map(item => item.id === id ? { ...item, visible: true } : item) })); chooseTool("translate"); }
  function command(id: string) {
    if (id === "undo") undo(); else if (id === "redo") redo();
    else if (id === "grid") setGrid(value => !value); else if (id === "wireframe") setWireframe(value => !value);
    else if (id === "frame") setResetView(value => value + 1);
    else if (id === "material") setMaterialOpen(value => !value); else if (id === "transform") setTransformOpen(value => !value);
    else if (id === "play") { setTool("select"); if (time === DURATION) setTime(0); setPlaying(value => !value); }
    else if (id === "stop") { setPlaying(false); setTime(0); }
    else if (id === "reset-layout") { setPositions({}); setMaterialOpen(true); setTransformOpen(size.width >= 1000 && size.height >= 550); setResetView(value => value + 1); }
    else if (id === "new") { setHistory({ past: [], present: freshStudy(), future: [] }); setSelected("head"); setPlaying(false); setTime(0); setNotice("New sculpture study"); }
    else if (id === "save") setDownload(URL.createObjectURL(new Blob([JSON.stringify({ format: "aether-material-study-demo", ...study, lights, exposure }, null, 2)], { type: "application/json" })));
    else if (id === "about") setAbout(true);
  }
  function panelPosition(id: string, width: number, height: number) {
    const fallback = id === "material" ? { x: size.width * .55, y: 18 } : { x: size.width - width - 18, y: size.height - height - 18 };
    const value = positions[id] ?? fallback;
    return { x: Math.max(8, Math.min(size.width - width - 8, value.x)), y: Math.max(8, Math.min(size.height - height - 8, value.y)) };
  }
  const materialWidth = Math.min(268, size.width - 24), transformWidth = Math.min(316, size.width - 24);
  const materialPosition = panelPosition("material", materialWidth, 350), transformPosition = panelPosition("transform", transformWidth, 180);
  const resetTransform = () => transform(object.id, identityTransform());
  return <div className="material-studio">
    <div className="ms-app-window">
      <DocumentBar windowChrome={false} className="ms-menubar" leading={<>
        <IconButton label="Back to Aether UI" appearance="glyph" onClick={onExit}><AppMark app="animation" size={21}/></IconButton>
        <MenuButton label="File" items={[{ id: "new", label: "New study" }, { id: "save", label: "Save study settings…" }]} onSelect={command}>File</MenuButton>
        <MenuButton label="Edit" items={[{ id: "undo", label: "Undo", disabled: !history.past.length }, { id: "redo", label: "Redo", disabled: !history.future.length }]} onSelect={command}>Edit</MenuButton>
        <MenuButton label="Create" items={[{ id: "cube", label: "Cube", icon: <AetherIcon name="cube"/> }, { id: "sphere", label: "Sphere", icon: <AetherIcon name="circle"/> }]} onSelect={create}>Create</MenuButton>
        <MenuButton label="View" items={[{ id: "grid", label: "Ground grid", kind: "checkbox", checked: grid }, { id: "wireframe", label: "Wireframe", kind: "checkbox", checked: wireframe }, { id: "frame", label: "Reset camera" }]} onSelect={command}>View</MenuButton>
        <MenuButton label="Render" items={[{ id: "play", label: playing ? "Pause turntable" : "Preview turntable" }, { id: "stop", label: "Stop preview" }]} onSelect={command}>Render</MenuButton>
        <MenuButton label="Window" items={[{ id: "material", label: "Material editor", kind: "checkbox", checked: materialOpen }, { id: "transform", label: "Transform panel", kind: "checkbox", checked: transformOpen }, { id: "reset-layout", label: "Reset layout" }]} onSelect={command}>Window</MenuButton>
        <Button appearance="link" onClick={() => setAbout(true)}>Help</Button>
      </>} trailing={<span className="ms-app-name">AETHER MATERIAL STUDIO <i>CONCEPT</i></span>}/>
      <div className="ms-command-row"><FloatingToolbar variant="document" ariaLabel="Studio commands" onAction={id => { if (TOOLS.some(item => item.id === id)) chooseTool(id as StudioTool); else command(id); }} groups={[
        { id: "history", label: "History", actions: [{ id: "undo", label: "Undo", icon: <AetherIcon name="undo"/>, disabled: !history.past.length }, { id: "redo", label: "Redo", icon: <AetherIcon name="redo"/>, disabled: !history.future.length }] },
        { id: "tools", label: "Transform tools", separatorBefore: true, actions: TOOLS.map(item => ({ ...item, icon: <AetherIcon name={item.icon}/>, pressed: tool === item.id })) },
        { id: "view", label: "Viewport controls", separatorBefore: true, actions: [{ id: "grid", label: "Ground grid", icon: <AetherIcon name="grid-3"/>, pressed: grid }, { id: "wireframe", label: "Wireframe", icon: <AetherIcon name="cube-transparent"/>, pressed: wireframe }, { id: "frame", label: "Reset camera", icon: <AetherIcon name="fit"/> }] },
      ]}/><span>Sculpture study <b>/</b> Material exploration</span></div>
      <main className="ms-layout" aria-label="Material studio workspace">
        <Rail className="ms-rail" aria-label="Workspace tools">
          <RailButton label="Show material editor" active={materialOpen} onClick={() => setMaterialOpen(value => !value)}><AetherIcon name="appearance"/></RailButton>
          <RailButton label="Show transform panel" active={transformOpen} onClick={() => setTransformOpen(value => !value)}><AetherIcon name="sliders"/></RailButton>
          <RailButton label="Add cube" onClick={() => create("cube")}><AetherIcon name="cube"/></RailButton>
          <RailButton label="Add sphere" onClick={() => create("sphere")}><AetherIcon name="circle"/></RailButton>
          <RailButton label="Reset studio layout" onClick={() => command("reset-layout")}><AetherIcon name="layout"/></RailButton>
        </Rail>
        <div className="ms-center">
          <div className="ms-viewport" ref={viewport}>
            <StudioViewport objects={study.objects} materials={study.materials} selected={selected} tool={tool} time={time} grid={grid} wireframe={wireframe} lights={lights} exposure={exposure} resetView={resetView} onSelect={setSelected} onTransform={transform}/>
            <div className="ms-viewport-label"><span className="ms-live-dot"/>Live viewer <span>Perspective</span></div>
            <div className="ms-viewport-caption"><span>01 / SCULPTURE STUDY</span><strong>Light. Surface. Form.</strong></div>
            <div className="ms-float-overlay">
              {materialOpen && <FloatingPanel title={material.name} {...materialPosition} width={materialWidth} onMove={(x, y) => setPositions(value => ({ ...value, material: { x, y } }))} onClose={() => setMaterialOpen(false)}>
                <StudioMaterialControls material={material} assignment={object.name} onChange={patch => edit(doc => ({ ...doc, materials: doc.materials.map(item => item.id === material.id ? { ...item, ...patch } : item) }))}/>
              </FloatingPanel>}
              {transformOpen && <FloatingPanel title={`${object.name} · Transform`} {...transformPosition} width={transformWidth} onMove={(x, y) => setPositions(value => ({ ...value, transform: { x, y } }))} onClose={() => setTransformOpen(false)}><StudioTransformControls value={object.transform} onChange={value => transform(object.id, value)} onReset={resetTransform}/></FloatingPanel>}
            </div>
          </div>
          <StudioPreviewTimeline time={time} playing={playing} loop={loop} onSeek={value => { setPlaying(false); setTime(value); }} onPlay={() => command("play")} onLoop={() => setLoop(value => !value)}/>
          <div className="ms-library"><header><strong>Materials</strong><span>Choose a surface to apply to {object.name}</span></header><StudioMaterialShelf materials={study.materials} selected={material.id} onSelect={assign}/></div>
        </div>
        <aside className="ms-inspectors">
          <DockPanel title="Scene" actions={<span className="ms-panel-count">{study.objects.filter(item => item.visible).length} visible</span>}><StudioSceneTree objects={study.objects} selected={selected} onSelect={setSelected} onVisibility={toggleVisibility} lights={lights} onLightToggle={toggleLight}/></DockPanel>
          <DockPanel title={lightSelected ? "Studio lighting" : object.name}>
            {lightSelected ? <StudioLightingControls lights={lights} intensity={exposure} onToggle={toggleLight} onIntensity={setExposure}/> : <>
              <div className="ms-property-heading"><AetherIcon name={object.kind === "head" ? "person" : object.kind === "cube" ? "cube" : "circle"}/><span>Object properties</span><Checkbox label="Visible" checked={object.visible} onChange={() => toggleVisibility(object.id)}/></div>
              <StudioTransformControls value={object.transform} onChange={value => transform(object.id, value)} onReset={resetTransform}/>
              <div className="ms-assigned-material"><span>Surface</span><Button appearance="link" onClick={() => setMaterialOpen(true)}>{material.name}<AetherIcon name="chevron-right"/></Button></div>
              <StudioLightingControls lights={lights} intensity={exposure} onToggle={toggleLight} onIntensity={setExposure}/>
            </>}
          </DockPanel>
        </aside>
      </main>
      <footer className="ms-status"><span role="status">{notice}</span><span>Local concept · {playing ? "Preview running" : "Ready"}</span></footer>
    </div>
    <Dialog open={about} title="Aether Material Studio" onClose={() => setAbout(false)} actions={<Button onClick={() => setAbout(false)}>Done</Button>}><p>A local material and lighting concept using the shared Aether UI widgets, elements and overlay containers.</p><p>The timeline previews a turntable rotation. Scene controls do not write to a production CAD or animation document.</p><p>Head scan: <a href="https://github.com/mrdoob/three.js/tree/r180/examples/models/gltf/LeePerrySmith" target="_blank" rel="noreferrer">Infinite, by Lee Perry-Smith / Infinite Realities</a>, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>. Materials, lighting and display scale are modified for this study.</p></Dialog>
    <Dialog open={!!download} title="Save study settings" onClose={() => setDownload(null)} actions={<Button onClick={() => setDownload(null)}>Done</Button>}><p>Material, transform and lighting settings for this local concept.</p>{download && <a className="aui-button aui-button--primary" href={download} download="aether-material-study.json">Download JSON</a>}</Dialog>
  </div>;
}
