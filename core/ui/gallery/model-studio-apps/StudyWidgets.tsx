import { DemoReviewPanel } from "../demo-review/DemoReviewPanel";
import { AetherIcon, Button, Checkbox, ColorField, IconButton, NumberField, TextField, TreePanel, TreePanelSplit, type TreeNode } from "../../src";
import { AssistantPanel } from "../../src/AssistantPanel";
import { ModelRevisionsPanel } from "../plasticity-studio/ModelReviewPanels";
import { studies, type StudyApp, type StudyItem } from "./studies";

export function StudyTree({app,items,selected,onSelect,onVisibility,documentName}:{documentName?:string;app:StudyApp;items:StudyItem[];selected:string;onSelect:(id:string)=>void;onVisibility:(id:string)=>void}) {
  const study=studies[app];
  const nodes:TreeNode[]=items.map(item=>({id:item.id,label:item.name,category:"item",dimmed:!item.visible,icon:<AetherIcon name={app==="io"?"file-circuit":app==="map"?"rectangle":"sketch"}/>,actions:item.visible?[]:[{id:"visibility",label:`Show ${item.name}`,icon:<AetherIcon name="hidden"/>,pinned:true}]}));
  const common={selectedIDs:new Set([selected]),onSelect:(ids:readonly string[])=>{if(items.some(item=>item.id===ids[0]))onSelect(ids[0]);},onAction:onVisibility,onCommand:onVisibility,menuItems:(id:string)=>items.some(item=>item.id===id)?[{id:"visibility",label:items.find(item=>item.id===id)?.visible?"Hide":"Show",icon:<AetherIcon name="view"/>}]:[]};
  return <TreePanelSplit primaryLabel={study.collection} secondaryLabel={study.secondary}
    primary={<TreePanel {...common} ariaLabel={study.collection} title={study.collection} filterLabel={`Search ${study.collection.toLowerCase()}`} nodes={[{id:"document",label:documentName??study.document,icon:<AetherIcon name="collection-folder"/>,children:nodes}]}/>}
    secondary={<TreePanel {...common} ariaLabel={study.secondary} title={`${study.secondary} (${items.length})`} showFilter={false} nodes={nodes}/>}/>;
}
export function StudyProperties({app,item,onChange}:{app:StudyApp;item?:StudyItem;onChange:(item:StudyItem)=>void}) {
  if(!item)return <div className="ps-settings">Select an object to inspect.</div>;
  return <div className="ps-properties study-properties">
    <div className="study-inspector-heading"><AetherIcon name={app==="io"?"file-circuit":app==="map"?"rectangle":"sketch"}/><strong>{item.name}</strong><small>{item.kind}</small></div>
    <section><h3>Object</h3><label>Name<TextField aria-label="Object name" value={item.name} onChange={event=>onChange({...item,name:event.target.value})}/></label><Checkbox label="Visible" checked={item.visible} onChange={event=>onChange({...item,visible:event.target.checked})}/></section>
    <section><h3>Position offset</h3>{(["x","y"] as const).map(axis=><label key={axis}>{axis.toUpperCase()}<NumberField aria-label={`Position ${axis.toUpperCase()}`} unit={studies[app].unit} value={item[axis]} onCommit={value=>onChange({...item,[axis]:value})}/></label>)}</section>
    <section><h3>{app==="map"?"Projection":app==="io"?"Appearance":"Stroke"}</h3><label>{app==="map"?"Intensity":"Opacity"}<NumberField aria-label="Opacity" value={item.opacity} min={0} max={100} unit="%" onCommit={opacity=>onChange({...item,opacity})}/></label>
      {app==="sketch"&&<label>Width<NumberField aria-label="Stroke width" value={item.weight} min={.5} max={12} step={.5} unit="px" onCommit={weight=>onChange({...item,weight})}/></label>}
      <label>Color<ColorField ariaLabel="Object color" value={item.color} onChange={color=>onChange({...item,color})}/></label>
    </section>
    <section><h3>{app==="io"?"Footprint":app==="map"?"Source":"Document"}</h3><dl><dt>{app==="io"?"Package":app==="map"?"Pattern":"Artboard"}</dt><dd>{app==="io"?item.kind:app==="map"?"Prism lines":"Orbit / 01"}</dd><dt>{app==="io"?"Board":app==="map"?"Output":"Units"}</dt><dd>{app==="io"?"2-layer study":app==="map"?"Local preview":"Pixels"}</dd></dl></section>
    <Button onClick={()=>onChange({...item,x:0,y:0,opacity:100})}>Reset placement</Button>
  </div>;
}
export function StudyReview({app,panel,selected,onClose,documentName}:{app:StudyApp;panel:string;selected?:StudyItem;onClose:()=>void;documentName?:string}) {
  return <><div className="ps-review-content" hidden={panel!=="comments"}><DemoReviewPanel documentName={documentName??studies[app].document} selectedName={selected?.name} onClose={onClose}/></div>
    {panel==="revisions"&&<ModelRevisionsPanel onClose={onClose}/>}
    {panel==="ai"&&<div className="ps-chat"><AssistantPanel title={`${studies[app].title} assistant`} heading="Aether assistant" layout="agent" detail="Local concept" status="No AI provider connected" disabled messages={[]} toolbar={<IconButton label="Close AI chat" onClick={onClose}><AetherIcon name="close"/></IconButton>}
    welcome={<div className="ps-chat-welcome"><AetherIcon name="brain"/><h3>What will you create?</h3><p>Your document, tools, and ideas in one place.</p><small>This demo previews the assistant layout. Connect an AI provider in the real application to send prompts.</small></div>}
    context={<span className="ps-chat-context"><AetherIcon name="document"/>{selected?.name??studies[app].document}</span>}
    composerActions={<><Button className="ps-composer-add" aria-label="Attach file" disabled>+</Button><Button className="ps-composer-pill" disabled><AetherIcon name="sliders"/>Tools</Button><Button className="ps-composer-pill" disabled>Normal</Button><Button className="ps-composer-pill ps-composer-voice" disabled>Voice</Button></>}/></div>}
  </>;
}
