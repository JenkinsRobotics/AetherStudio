import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AetherIcon, AppearanceToggle, Button, EmptyState, SearchField } from "../src/index";
import { WorkbenchWindow } from "../src/ConceptWidgets";
import "../tokens/tokens.css";
import "../src/widgets.css";
import "./WorkbenchWindowDemo.css";
import { demoAppsURL } from "./demo-location";

function WorkbenchWindowDemo() {
  const [files,setFiles]=useState<readonly {id:number;name:string}[]>([]);
  const [selected,setSelected]=useState<number>();
  const [filter,setFilter]=useState("");
  const [nextID,setNextID]=useState(1);
  const active=files.find((file)=>file.id===selected);
  const add=()=>{setFiles((items)=>[...items,{id:nextID,name:`Document ${nextID}`}]);setSelected(nextID);setNextID(nextID+1);setFilter("");};
  const remove=()=>{setFiles((items)=>items.filter((item)=>item.id!==selected));setSelected(undefined);};
  return <div className="workbench-demo">
    <div className="workbench-demo-bar"><a href={demoAppsURL()}>← Demo apps</a><span>Window template</span><AppearanceToggle/></div>
    <WorkbenchWindow title="Workbench" subtitle="Aether UI window template" sidebarTitle="Workspace"
      defaultSidebarCollapsed={window.innerWidth<600}
      sidebarActions={<Button aria-label="Add document" onClick={add}><AetherIcon name="plus"/></Button>}
      sidebar={<><SearchField ariaLabel="Find documents" value={filter} onQueryChange={setFilter} placeholder="Find documents"/><div className="workbench-demo-files" role="group" aria-label="Documents">{files.filter((file)=>file.name.toLowerCase().includes(filter.toLowerCase())).map((file)=><button key={file.id} aria-pressed={selected===file.id} onClick={()=>setSelected(file.id)}><AetherIcon name="document"/><span>{file.name}<small>Template document</small></span></button>)}{!files.length?<p>Add a document to explore the sidebar.</p>:null}</div></>}
      sidebarFooter={<Button onClick={add}>New document</Button>}
      toolbar={<><Button disabled={!active} onClick={remove}>Remove</Button><Button primary onClick={add}>New document</Button></>}
      canvasOverlay={<div className="workbench-demo-note">Resizable sidebar<br/>Double-click the divider to collapse</div>}
      canvasFooter={<small className="workbench-demo-note">Drag the divider · Arrow keys resize · Enter collapses</small>}
      statusBar={<><span>{files.length} documents</span><span className="workbench-demo-status-end">UI template · local sample state</span></>}
    >
      <div className="workbench-demo-canvas">{active?<section className="workbench-demo-document"><AetherIcon name="document"/><label>Document name<input value={active.name} onChange={(event)=>setFiles((items)=>items.map((item)=>item.id===selected?{...item,name:event.target.value}:item))}/></label><p>This canvas is a slot for the owning application's editor or viewport.</p></section>:<EmptyState title="Your workspace" description="Explore the split window, collapsible sidebar, toolbar and status strip." icon={<AetherIcon name="window"/>} primaryAction={<Button primary onClick={add}>New document</Button>}/>}</div>
    </WorkbenchWindow>
  </div>;
}

createRoot(document.getElementById("root")!).render(<WorkbenchWindowDemo/>);
