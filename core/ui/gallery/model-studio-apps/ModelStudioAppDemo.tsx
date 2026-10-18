import { useEffect, useRef, useState } from "react";
import { AetherIcon, AppMark, AppWordmark, Button, Checkbox, Dialog, DockPanel, DocumentTabBar, FloatingToolbar, FloatingToolbarMenu, IconButton, MenuButton, TabbedSidebar, useScopedAetherTheme } from "../../src";
import { useDemoDocument } from "../demo-document/useDemoDocument";
import { validateStudyItems } from "./study-file";
import { StudyCanvas } from "./StudyCanvas";
import { StudyProperties, StudyReview, StudyTree } from "./StudyWidgets";
import { freshStudy, studies, type StudyApp, type StudyItem } from "./studies";
import "../plasticity-studio/plasticity-studio.css";
import "./model-studio-apps.css";

/** Three independent gallery apps sharing the approved Model Studio composition. */
export function ModelStudioAppDemo({ app, onExit }: { app: StudyApp; onExit?:()=>void }) {
  useScopedAetherTheme("aether-slate","dark");
  const study=studies[app];
  const [items,setItems]=useState(()=>freshStudy(app)),[selected,setSelected]=useState(study.items[app==="sketch"?1:app==="map"?2:0].id);
  const [tool,setTool]=useState("select"),[tab,setTab]=useState<string|null>("properties"),[leftPanel,setLeftPanel]=useState<string|null>(null);
  const [grid,setGrid]=useState(true),[guides,setGuides]=useState(true),[copper,setCopper]=useState(true),[playing,setPlaying]=useState(false);
  const [footer,setFooter]=useState(false),[fit,setFit]=useState(0),[zoom,setZoom]=useState(100),[mobile,setMobile]=useState<"objects"|"inspector"|null>(null);
  const [query,setQuery]=useState(""),[about,setAbout]=useState(false),[download,setDownload]=useState<string|null>(null);
  const [notice,setNotice]=useState("Select an object · Right-drag to pan · Scroll to zoom");
  const counter=useRef(1),root=useRef<HTMLDivElement>(null),item=items.find(value=>value.id===selected);
  useEffect(()=>{const before=document.title;document.title=study.title;return()=>{document.title=before;};},[study.title]);
  useEffect(()=>()=>{if(download)URL.revokeObjectURL(download);},[download]);
  const change=(next:StudyItem)=>setItems(values=>values.map(value=>value.id===next.id?next:value));
  const select=(id:string)=>{setSelected(id);setNotice(`${items.find(value=>value.id===id)?.name??"Object"} selected`);};
  const visibility=(id:string)=>setItems(values=>values.map(value=>value.id===id?{...value,visible:!value.visible}:value));
  const documentFile=useDemoDocument({app,initialName:study.document,data:items,units:"pixels",validate:value=>validateStudyItems(value,app),
    onOpen:values=>{setItems(values);setSelected(values[0]?.id??"");counter.current=Math.max(0,...values.map(value=>Number(value.id.replace("shape-",""))||0))+1;setFit(value=>value+1);setNotice("Local study opened");},
    onExport:()=>action("export"),onClose:()=>onExit?.(),demoItems:[{id:"reset",label:"Reset sample"},{id:"about",label:"About this demo"},{id:"exit",label:"Back to demo apps"}]});
  const fileItems=documentFile.items;

  function action(id:string){
    if(documentFile.run(id))return;
    if(["select","move","pan"].includes(id)){setTool(id);setNotice(id==="move"?"Drag an object to move it, or edit its position in Properties":id==="pan"?"Drag the canvas to pan":"Select an object in the drawing or tree");}
    else if(id==="grid")setGrid(value=>!value);
    else if(id==="guides")setGuides(value=>!value);
    else if(id==="copper")setCopper(value=>!value);
    else if(id==="play")setPlaying(value=>!value);
    else if(id==="frame"){setFit(value=>value+1);setNotice("Visible artwork fitted to the workspace");}
    else if(id==="footer")setFooter(value=>!value);
    else if(["comments","ai","revisions"].includes(id))setLeftPanel(value=>value===id?null:id);
    else if(id==="reset"){setItems(freshStudy(app));setSelected(study.items[0].id);setFit(value=>value+1);setNotice("Original sample restored");}
    else if(id.startsWith("add-")&&app==="sketch"){
      const circle=id==="add-circle",number=counter.current++,name=`${circle?"Circle":"Rectangle"} ${number}`;
      const next:StudyItem={id:`shape-${number}`,name,kind:circle?"Circle":"Rectangle",color:"#c9dce2",visible:true,x:0,y:0,opacity:100,weight:2,bounds:circle?[435,285,130,130]:[425,300,150,100]};
      setItems(values=>[...values,next]);setSelected(next.id);setTool("move");setNotice(`${name} added · Drag to position`);
    } else if(id==="export"){
      const canvas=root.current?.querySelector<SVGSVGElement>(".study-art");if(canvas){const clone=canvas.cloneNode(true) as SVGSVGElement;clone.setAttribute("xmlns","http://www.w3.org/2000/svg");clone.setAttribute("width","1000");clone.setAttribute("height","700");clone.querySelectorAll(".study-selection").forEach(node=>node.remove());setDownload(URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml"})));}
    } else if(id==="about")setAbout(true);else if(id==="exit")onExit?.();
    setQuery("");
  }
  const commands=[...study.tools,{id:"frame",label:"Fit drawing"},{id:"grid",label:"Toggle grid"},{id:"export",label:"Export preview SVG"},{id:"reset",label:"Reset sample"}];
  const matches=query?commands.filter(command=>command.label.toLowerCase().includes(query.toLowerCase())):[];
  const toggle=(id:string,label:string,icon:string,pressed?:boolean)=>({id,label,icon:<AetherIcon name={icon}/>,pressed});
  const tree=<StudyTree app={app} items={items} selected={selected} onSelect={select} onVisibility={visibility} documentName={documentFile.meta.name}/>;
  return <div ref={root} className="plasticity-studio study-app aether-theme-model-studio aether-dark-theme" data-app={app}>
    <aside className="ps-chat-sidebar" aria-label="Document sidebar" hidden={!leftPanel}><DockPanel><StudyReview documentName={documentFile.meta.name} app={app} panel={leftPanel??"comments"} selected={item} onClose={()=>setLeftPanel(null)}/></DockPanel></aside>
    <div className="ps-workspace"><main className="ps-window" aria-label={`${study.title} workspace`} data-mobile-panel={mobile??"none"}>
      <StudyCanvas app={app} items={items} selected={selected} tool={tool} grid={grid} guides={guides} copper={copper} playing={playing} fit={fit} onSelect={select}
        onMove={(id,x,y)=>setItems(values=>values.map(value=>value.id===id?{...value,x,y}:value))} onZoom={setZoom}/>
      <div className="ps-left"><div className="aui-float ps-browser"><DockPanel><header className="ps-identity"><div className="ps-identity-brand"><AppWordmark app={app} size={26}/><MenuButton label="File menu" className="aui-icon-button" data-size="small" data-appearance="rounded" items={fileItems} onSelect={action}><AetherIcon name="menu"/></MenuButton></div><div className="ps-identity-document"><strong>{documentFile.meta.name}</strong><span className="ps-identity-version">{documentFile.meta.workspaceName}</span></div></header><div className="ps-browser-content">{tree}</div></DockPanel></div><div className="ps-selection-readout"><span>X <b>{item?.x??0}</b></span><span>Y <b>{item?.y??0}</b></span><small>{study.unit}</small><span className="study-local">Local study</span></div></div>
      <div className="ps-document"><FloatingToolbar ariaLabel="Document tools" variant="document" onAction={action}
        leading={<><FloatingToolbarMenu label="Document menu" iconOnly items={fileItems} onSelect={action}><AetherIcon name="menu"/></FloatingToolbarMenu><AppMark app={app} size={22}/></>}
        groups={[{id:"display",label:"Display",separatorBefore:true,actions:[toggle("guides","Selection outlines","rectangle-dashed",guides),toggle("grid","Drawing grid","grid-3",grid)]}]}
        trailing={<FloatingToolbarMenu label="Study file" items={fileItems} onSelect={action}><span>{documentFile.meta.name}.{app}</span><AetherIcon name="chevron-down"/></FloatingToolbarMenu>}/></div>
      <div className="ps-right"><TabbedSidebar ariaLabel={`${app} inspector`} variant="slim" attachment="detached" tabPosition="top" anchor="top" floating activeTab={tab} onTabChange={setTab}
        tabs={[{id:"properties",label:"Properties",icon:<AetherIcon name="sliders"/>},{id:"layers",label:study.collection,icon:<AetherIcon name="layers"/>},{id:"view",label:"View",icon:<AetherIcon name="view"/>}]}>
        {tab==="properties"&&<StudyProperties app={app} item={item} onChange={change}/>}{tab==="layers"&&tree}
        {tab==="view"&&<div className="ps-settings"><h3>Canvas</h3><Checkbox label="Grid" checked={grid} onChange={event=>setGrid(event.target.checked)}/><Checkbox label="Selection outlines" checked={guides} onChange={event=>setGuides(event.target.checked)}/>{app==="io"&&<Checkbox label="Copper traces" checked={copper} onChange={event=>setCopper(event.target.checked)}/>}<Button onClick={()=>action("frame")}>Fit drawing</Button><h3>Preview</h3><p>{app==="map"?"Projection stays inside this window.":app==="io"?"Visual board study. No simulation is running.":"Vector artwork with local edits."}</p><Button onClick={()=>setAbout(true)}>About this demo</Button></div>}
      </TabbedSidebar></div>
      <div className="ps-workspace-tools"><FloatingToolbar ariaLabel="Workspace panels" variant="document" onAction={action} groups={[{id:"workspace",label:"Workspace",actions:[toggle("comments","Comments","comment",leftPanel==="comments"),toggle("ai","AI chat","brain",leftPanel==="ai"),toggle("revisions","Revisions","history",leftPanel==="revisions"),toggle("footer",study.secondary,"sidebar",footer)]}]}/></div>
      <div className="ps-view-tools"><FloatingToolbar ariaLabel="View tools" variant="document" onAction={action} groups={[{id:"view",label:"View",actions:[toggle("grid","Grid","grid-3",grid),toggle("frame","Fit drawing","fit"),toggle("guides","Guides","rectangle-dashed",guides),toggle("export","Export preview","export")]}]}/></div>
      <div className="ps-view-menu"><IconButton label="Reset zoom" onClick={()=>action("frame")}><AetherIcon name={app==="io"?"file-circuit":app==="map"?"display":"sketch"}/></IconButton><span>{zoom}%</span></div>
      <div className="ps-bottom">{query&&<div className="aui-float ps-command-results">{matches.length?matches.map(command=><Button key={command.id} onClick={()=>action(command.id)}>{command.label}</Button>):<span>No matching commands</span>}</div>}
        <FloatingToolbar ariaLabel={`${app} tools`} onAction={action} command={{value:query,onValueChange:setQuery,onSubmit:()=>{if(matches.length===1)action(matches[0].id);},shortcuts:[{id:"reset",label:"Reset",tone:"amber"},{id:"export",label:"SVG",tone:"blue"},{id:"frame",label:"Frame",tone:"green"}]}}
          groups={[{id:"tools",label:"Tools",actions:study.tools.map(value=>({...value,label:value.id==="play"&&playing?"Pause preview":value.label,icon:<AetherIcon name={value.id==="play"&&playing?"pause":value.icon}/>,pressed:value.id==="play"?playing:value.id==="guides"?guides:value.id==="copper"?copper:tool===value.id}))}]}/>
      </div>
      <div className="ps-mobile-switches"><IconButton label="Toggle objects" aria-pressed={mobile==="objects"} onClick={()=>setMobile(value=>value==="objects"?null:"objects")}><AetherIcon name="layers"/></IconButton><IconButton label="Toggle inspector" aria-pressed={mobile==="inspector"} onClick={()=>setMobile(value=>value==="inspector"?null:"inspector")}><AetherIcon name="sliders"/></IconButton></div>
      <output className="ps-status" aria-live="polite">{notice}</output>
    </main>{footer&&<div className="ps-parts-footer"><DocumentTabBar ariaLabel={study.secondary} variant="studio" tabs={items.map(value=>({id:value.id,label:value.name,detail:value.kind,current:selected===value.id,icon:<AetherIcon name={app==="io"?"file-circuit":"layers"}/>,onSelect:()=>select(value.id)}))}/></div>}</div>
    {documentFile.dialogs}
    <Dialog open={about} title={study.title} onClose={()=>setAbout(false)} actions={<Button onClick={()=>setAbout(false)}>Done</Button>}><p>{study.description}</p><p>Uses Model Studio’s shared toolbars, sidebars, tree widgets, fields, logos and theme. Save document downloads an editable local study; Open study restores it. SVG export saves the artwork.</p></Dialog>
    <Dialog open={!!download} title="Export preview" onClose={()=>setDownload(null)} actions={<Button onClick={()=>setDownload(null)}>Done</Button>}><p>Download the current artwork as SVG.</p>{download&&<a className="aui-button aui-button--primary" href={download} download={`${study.document.toLowerCase().replaceAll(" ","-")}.svg`}>Download SVG</a>}</Dialog>
  </div>;
}
