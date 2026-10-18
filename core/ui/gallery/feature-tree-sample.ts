import { DEFAULT_FEATURE_GEOMETRY, flattenFeatureItems, type FeatureTreeItem, type FeatureTreeRequest } from "../src/feature-tree";
export interface FeatureTreeSample { geometry:FeatureTreeItem[]; features:FeatureTreeItem[]; parts:FeatureTreeItem[]; rollback:number }
export function createFeatureTreeSample():FeatureTreeSample {
  const types=["sketch","revolve","fillet","chamfer","fillet","shell","sketch","sketch","extrude","chamfer","fillet","sketch","extrude","sketch","sketch"];
  const names=["Sketch 1","Revolve 1","Fillet 3","Chamfer 1","Fillet 1","Shell 1","Sketch 2","Sketch 3","Extrude 1","Chamfer 2","Fillet 2","Sketch 5","Extrude 2","Sketch 6","Sketch 4"];
  return {geometry:DEFAULT_FEATURE_GEOMETRY.map(item=>({...item})),features:types.map((type,i)=>({id:`feature-${i+1}`,label:names[i],type,kind:"feature",hidden:i===0 || i===11,suppressed:i===5 || i===14})),parts:[{id:"sample-part",label:"Part 1",kind:"part",type:"part"}],rollback:14};
}
export const SAMPLE_FEATURE_COMMANDS = ["rename","visibility","suppress","rollback","move","new-folder","add-to-folder","delete","copy-sketch","dimensions","hide-other-sketches","hide-all-sketches"] as const;
function map(items:readonly FeatureTreeItem[],update:(item:FeatureTreeItem)=>FeatureTreeItem):FeatureTreeItem[]{return items.map(item=>update({...item,children:item.children&&map(item.children,update)}));}
function without(items:readonly FeatureTreeItem[],ids:readonly string[]):FeatureTreeItem[]{return items.filter(item=>!ids.includes(item.id)).map(item=>({...item,children:item.children&&without(item.children,ids)}));}
function insert(items:readonly FeatureTreeItem[],target:string,moved:readonly FeatureTreeItem[],position:string):FeatureTreeItem[]{return items.flatMap(item=>item.id === target ? position === "inside"?[{...item,children:[...(item.children??[]),...moved]}]:position === "before"?[...moved,item]:[item,...moved]:[{...item,children:item.children&&insert(item.children,target,moved,position)}]);}
/** Local demonstration state only. Production apps dispatch these requests to their own document commands. */
export function updateFeatureTreeSample(state:FeatureTreeSample,request:FeatureTreeRequest,newID:string):FeatureTreeSample {
  const ids=request.ids,all=flattenFeatureItems([...state.geometry,...state.features,...state.parts]);
  const affected=request.command === "visibility" ? new Set(all.filter(item=>ids.includes(item.id)).flatMap(item=>flattenFeatureItems([item]).map(row=>row.id))) : new Set(ids);
  const update=(item:FeatureTreeItem):FeatureTreeItem=>{
    if(request.command === "hide-all-sketches" || request.command === "hide-other-sketches")return item.type === "sketch" && (request.command === "hide-all-sketches" || !ids.includes(item.id))?{...item,hidden:true}:item;
    if(!affected.has(item.id))return item;
    if(request.command === "rename" && request.name)return {...item,label:request.name};
    if(request.command === "visibility")return {...item,hidden:!request.value};
    if(request.command === "suppress" && item.kind === "feature")return {...item,suppressed:request.value};
    if(request.command === "dimensions")return {...item,dimensionsShown:request.value};
    return item;
  };
  let next={...state,geometry:map(state.geometry,update),features:map(state.features,update),parts:map(state.parts,update)};
  if(request.command === "rollback")return {...next,rollback:Math.max(0,Math.min(flattenFeatureItems(state.features).filter(row=>row.kind === "feature").length,request.index??state.rollback))};
  if(request.command === "delete"){
    const dissolve=(items:readonly FeatureTreeItem[]):FeatureTreeItem[]=>items.flatMap(item=>ids.includes(item.id)?item.kind === "folder"?dissolve(item.children??[]):[]:[{...item,children:item.children&&dissolve(item.children)}]);
    next.features=dissolve(next.features);next.parts=dissolve(next.parts);
  }
  if(request.command === "copy-sketch"){
    const item=all.find(item=>item.id === ids[0]);if(item)next.features=insert(next.features,item.id,[{...item,id:newID,label:`${item.label} copy`}],"after");
  }
  if(request.command === "new-folder"){
    const selected=selectionRoots(next.features,ids);
    const count=flattenFeatureItems(next.features).filter(item=>item.kind === "folder").length;
    next.features=[...without(next.features,ids),{id:newID,label:`Folder ${count+1}`,type:"folder",kind:"folder",children:selected}];
  }
  if((request.command === "move" || request.command === "add-to-folder")&&request.targetID){
    const moved=selectionRoots(next.features,ids);
    const target=all.find(item=>item.id === request.targetID);
    if(target&&!moved.some(item=>item.id===target.id||flattenFeatureItems(item.children??[]).some(child=>child.id===target.id)))next.features=insert(without(next.features,ids),request.targetID,moved,request.command === "add-to-folder"?"inside":request.position??"before");
  }
  // Keep a rollback boundary at the same history entity when editing rows before it.
  const before=flattenFeatureItems(state.features).filter(item=>item.kind === "feature"),after=flattenFeatureItems(next.features).filter(item=>item.kind === "feature");
  const boundary=before[state.rollback]?.id;
  next.rollback=boundary ? Math.max(0,after.findIndex(item=>item.id===boundary)) : after.length;
  if(boundary&&!after.some(item=>item.id===boundary))next.rollback=Math.min(state.rollback,after.length);
  return next;
}

function selectionRoots(items:readonly FeatureTreeItem[],ids:readonly string[]):FeatureTreeItem[]{return items.flatMap(item=>ids.includes(item.id)?[item]:selectionRoots(item.children??[],ids));}
