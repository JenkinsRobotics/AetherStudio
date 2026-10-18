import { useState } from "react";
import { AetherIcon, AppLayout, AppWordmark, Avatar, Button, Checkbox, DocumentBar, DocumentTabs, FieldRow, IconButton, Ribbon, RibbonGroup, RibbonTool, SelectField, TextField, WorkspaceBottomDock, WorkspaceShell } from "../src/index";
import { WorkbenchWindow } from "../src/ConceptWidgets";
import "./StandardWindowLayouts.css";

const destinations = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "settings", label: "Settings", icon: "settings" },
];

/** The existing split-window container, with lightweight navigation sample content. */
export function GeneralWindowLayout() {
  const [page, setPage] = useState("overview");
  const [name, setName] = useState("My workspace");
  const selected = destinations.find(item => item.id === page)!;
  return <WorkbenchWindow title={selected.label} subtitle="General interface · two columns"
    sidebarTitle="Left navigation" defaultSidebarWidth={232}
    sidebar={<nav className="standard-layout-navigation" aria-label="General interface navigation">{destinations.map(item =>
      <Button key={item.id} appearance="flat" active={page === item.id} aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}><AetherIcon name={item.icon} />{item.label}</Button>
    )}</nav>}
    statusBar={<span>Left navigation + main workspace</span>}>
    <div className="standard-layout-canvas">
      <AetherIcon name={selected.icon} width={32} height={32} />
      <h3>Main workspace</h3>
      <p>{selected.label} content fills the space beside the navigation.</p>
      <FieldRow label="Workspace name"><TextField aria-label="Workspace name" value={name} onChange={event => setName(event.target.value)} /></FieldRow>
    </div>
  </WorkbenchWindow>;
}

/** Application anatomy uses the same shared shell and center-column toolbar/dock. */
export function ApplicationWindowLayout() {
  const [selected, setSelected] = useState("Part 1");
  const [name, setName] = useState("Part 1");
  const [tool, setTool] = useState("select");
  const [bottom, setBottom] = useState<string | null>("timeline");
  return <div className="standard-layout-application">
    <DocumentBar windowChrome={false} leading={<><AetherIcon name="window" /><strong>Application workspace</strong></>} trailing={<span>Three columns</span>} />
    <WorkspaceShell preset="docked" inheritChromePreferences={false} animatePanels={false}
      sidebarVariant="tabs-top" toolbarSpan="center" style={{ flex: 1, minHeight: 0 }}
      leftPanels={[{ id: "browser", title: "Browser", icon: <AetherIcon name="layers" />, contentLayout: "custom", content: <div className="standard-layout-side-content"><h3>Left sidebar</h3><p>Navigation, trees and lists</p><div className="standard-layout-navigation">{["Part 1", "Part 2"].map(part => <Button key={part} appearance="flat" active={selected === part} aria-pressed={selected === part} onClick={() => { setSelected(part); setName(part); }}><AetherIcon name="cube" />{part}</Button>)}</div></div> }]}
      rightPanels={[{ id: "inspector", title: "Inspector", icon: <AetherIcon name="settings" />, contentLayout: "custom", content: <div className="standard-layout-side-content"><h3>Right sidebar</h3><p>Properties and contextual widgets</p><FieldRow label="Name"><TextField aria-label="Selected item name" value={name} onChange={event => setName(event.target.value)} /></FieldRow></div> }]}
      defaultOpenLeft={["browser"]} defaultOpenRight={["inspector"]}
      toolbar={<Ribbon><RibbonGroup label="Center toolbar">{[{ id: "select", label: "Select", icon: "mouse" }, { id: "move", label: "Move", icon: "move" }, { id: "rotate", label: "Rotate", icon: "redo" }].map(item => <RibbonTool key={item.id} icon={<AetherIcon name={item.icon} />} label={item.label} active={tool === item.id} onClick={() => setTool(item.id)} />)}</RibbonGroup></Ribbon>}
      centerBottom={<WorkspaceBottomDock tabs={[{ id: "timeline", label: "Timeline", icon: <AetherIcon name="animate" /> }]} activeTab={bottom} onTabChange={setBottom} widthFraction={1} height={72} ariaLabel="Center bottom dock"><div className="standard-layout-dock-content">Timeline / bottom dock · center column</div></WorkspaceBottomDock>}
      statusBar={<span className="standard-layout-status">{name} selected · {tool} tool</span>}>
      <div className="standard-layout-canvas"><AetherIcon name="cube" width={32} height={32} /><h3>Main workspace</h3><p>The wider center holds the editor or viewport.</p><small>{name}</small></div>
    </WorkspaceShell>
  </div>;
}

export function StandardWindowLayouts() {
  return <div className="standard-window-layouts">
    <p>Standard app wireframes and working window layouts, together for review. Apps supply the navigation, widgets and workspace content.</p>
    <article aria-label="Full-height app wireframe">
      <header><div><h2>Standard app layout · five named regions</h2><p>Header, Left, Center, Right and Footer. Center owns its top and bottom toolbars; each region has one purpose and shared size limits.</p></div></header>
      <div className="standard-layout-scroll" role="region" aria-label="App wireframe preview" tabIndex={0}><div className="standard-layout-preview standard-layout-preview--wireframe"><ThreeColumnWireframe /></div></div>
    </article>
    <article aria-label="General interface layout">
      <header><div><h2>General interface · two columns</h2><p>Left navigation + main workspace</p></div></header>
      <div className="standard-layout-scroll" role="region" aria-label="Two-column layout preview" tabIndex={0}><div className="standard-layout-preview standard-layout-preview--general"><GeneralWindowLayout /></div></div>
    </article>
    <article aria-label="Application workspace layout">
      <header><div><h2>Application workspace · three columns</h2><p>Left sidebar + wider center workspace + right sidebar. Toolbars and bottom docks span the center.</p></div></header>
      <div className="standard-layout-scroll" role="region" aria-label="Three-column layout preview" tabIndex={0}><div className="standard-layout-preview standard-layout-preview--application"><ApplicationWindowLayout /></div></div>
    </article>
    <p>Resize or collapse the navigation and sidebars to try the existing behavior. Full-window examples and the original Workbench demo are on Apps.</p>
  </div>;
}

/** The named app standard, composed from shared containers and reviewable widget slots. */
export function ThreeColumnWireframe() {
  const [header, setHeader] = useState(true), [footer, setFooter] = useState(true);
  const [top, setTop] = useState(true), [bottom, setBottom] = useState(true);
  const [footerContent, setFooterContent] = useState("documents");
  const [workspace, setWorkspace] = useState("Design"), [document, setDocument] = useState("Document 1");
  const [name, setName] = useState("Selected item"), [tool, setTool] = useState("Select");
  const [notice, setNotice] = useState("Ready"), [playing, setPlaying] = useState(false);
  return <div className="app-wireframe">
    <div className="app-wireframe-options" role="group" aria-label="Wireframe options">
      <strong>Standard app layout</strong>
      <Checkbox label="Header" checked={header} onChange={event => setHeader(event.target.checked)}/>
      <Checkbox label="Footer" checked={footer} onChange={event => setFooter(event.target.checked)}/>
      <Checkbox label="Top toolbar" checked={top} onChange={event => setTop(event.target.checked)}/>
      <Checkbox label="Bottom toolbar" checked={bottom} onChange={event => setBottom(event.target.checked)}/>
      <label>Footer content<SelectField aria-label="Footer content" value={footerContent} onChange={event => setFooterContent(event.target.value)} options={[{value:"status",label:"Status"},{value:"documents",label:"Documents"},{value:"timeline",label:"Timeline"}]}/></label>
    </div>
    <div className="app-wireframe-window">
      <AppLayout
        header={header && <DocumentBar windowChrome={false} className="app-wireframe-header"
          leading={<><strong className="app-wireframe-label">Header</strong><AppWordmark app="ui" size={36}/><label className="app-wireframe-workspace">Workspace<SelectField aria-label="Workspace" value={workspace} options={["Design","Review","Present"].map(value=>({value,label:value}))} onChange={event=>setWorkspace(event.target.value)}/></label></>}
          trailing={<><span>App controls · workspace · user / share</span><Button onClick={()=>setNotice("Share controls belong in Header")}>Share</Button><Avatar name="Alex Morgan" size="small"/></>}/>}
        left={[{ id:"left", title:"Left", icon:<AetherIcon name="folder"/>, chromeless:true, content:
          <WireframeRegion title="Left" detail="Document controls" note="280 px default · 220–360 px" side>
            <p>Files, document tree, tabs, versions and history.</p>
            <div className="app-wireframe-widget"><strong>Documents</strong>{["Document 1","Document 2"].map(item=><Button key={item} appearance="flat" active={document===item} onClick={()=>setDocument(item)}><AetherIcon name="document"/>{item}</Button>)}</div>
            <small>12 px widget padding · 8 px gaps<br/>Full body height · independent scrolling</small>
          </WireframeRegion> }]}
        center={<WireframeRegion title="Center" detail="Main workspace" note="Flexible width · 360 px minimum">
          <AetherIcon name="cube" width={44} height={44}/><p>{workspace} · {document}<br/>{name} · {tool} tool</p>
          <small>Canvas, viewport or editor fills the remaining space.<br/>Top and bottom toolbars stay within this column.</small>
        </WireframeRegion>}
        right={[{ id:"right", title:"Right", icon:<AetherIcon name="sliders"/>, chromeless:true, content:
          <WireframeRegion title="Right" detail="Workspace properties" note="280 px default · 220–360 px" side>
            <p>Properties for the workspace, active tool and current selection.</p>
            <div className="app-wireframe-widget"><strong>Selection</strong><FieldRow label="Name"><TextField aria-label="Selection name" value={name} onChange={event=>setName(event.target.value)}/></FieldRow></div>
            <small>Same sizing and padding as Left.<br/>Full body height · independent scrolling</small>
          </WireframeRegion> }]}
        topToolbar={top && <div className="app-wireframe-toolbar" role="toolbar" aria-label="Center tools"><strong>Top toolbar</strong>{["Select","Move","Rotate"].map((label,i)=><IconButton key={label} label={label} aria-pressed={tool===label} onClick={()=>setTool(label)}><AetherIcon name={["mouse","move","redo"][i]}/></IconButton>)}<span>Center only · 44–96 px</span></div>}
        bottomToolbar={bottom && <div className="app-wireframe-toolbar" role="toolbar" aria-label="Center view controls"><strong>Bottom toolbar</strong><IconButton label="Fit workspace" onClick={()=>setNotice("Workspace fitted")}><AetherIcon name="target"/></IconButton><span>View, selection and workspace tools · Center only</span></div>}
        footer={footer && <div className={`app-wireframe-footer app-wireframe-footer--${footerContent}`}>
          <div className="app-wireframe-footer-heading"><strong>Footer</strong><span>Full width · content height · 40 px minimum / 30% maximum</span></div>
          {footerContent==='status' ? <div className="app-wireframe-footer-status"><span>{notice}</span><span>Workspace status and background activity</span></div>
            : footerContent==='documents' ? <div className="app-wireframe-documents"><DocumentTabs tabs={["Document 1","Document 2"].map(item=>({id:item,label:item,icon:<AetherIcon name="document"/>}))} activeID={document} onSelect={setDocument}/><span>Document tabs · workspace-adjacent content</span></div>
            : <div className="app-wireframe-timeline"><Button onClick={()=>setPlaying(value=>!value)}>{playing?'Pause':'Play'}</Button><div className="app-wireframe-track" data-playing={playing} aria-label="Timeline preview"><span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span></div><span>{playing?'Playing preview':'Timeline / transport'} · variable Footer height</span></div>}
        </div>}/>
    </div>
  </div>;
}
function WireframeRegion({ title, detail, note, side = false, children }: { title: string; detail: string; note: string; side?: boolean; children?: import("react").ReactNode }) {
  return <section className={`app-wireframe-region${side ? " app-wireframe-region--side" : ""}`} aria-label={`${title} contents`}><h3>{title}</h3><strong>{detail}</strong><span className="app-wireframe-measure">{note}</span>{children}</section>;
}
