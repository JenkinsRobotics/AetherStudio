import { useState } from "react";
import { Button, FeatureTree, type FeatureTreeRequest } from "../src";
import { createFeatureTreeSample, SAMPLE_FEATURE_COMMANDS, updateFeatureTreeSample } from "./feature-tree-sample";

export function FeatureTreeDemo(){
  const [state,setState]=useState(createFeatureTreeSample),[selection,setSelection]=useState<ReadonlySet<string>>(new Set(["feature-7"]));
  const [message,setMessage]=useState("Right-click a feature for actions. Drag rows to reorder; drag the rollback line or focus it and use ↑ / ↓, Home / End.");
  const dispatch=(request:FeatureTreeRequest)=>{setState(current=>updateFeatureTreeSample(current,request,crypto.randomUUID()));setMessage(`${request.command === "rollback"?`History active through ${request.index} features`:request.command.replaceAll("-"," ")} updated in this sample.`);};
  return <div className="feature-tree-demo">
    <div style={{height:810,width:306,display:"flex"}}><FeatureTree features={state.features} defaultGeometry={state.geometry} parts={state.parts} selectedIDs={selection}
      onSelect={(ids,mode)=>setSelection(current=>{if(mode!=="toggle")return new Set(ids);const next=new Set(current);ids.forEach(id=>next.has(id)?next.delete(id):next.add(id));return next;})} rollbackIndex={state.rollback} availableCommands={SAMPLE_FEATURE_COMMANDS} onCommand={dispatch} ariaLabel="CAD feature history" partsLabel="Parts" storageKey="aether-ui.feature-tree.split"/></div>
    <p role="status" style={{maxWidth:420,fontSize:12,color:"var(--aether-color-text-dim)"}}>{message}</p>
    <Button onClick={()=>{setState(createFeatureTreeSample());setSelection(new Set(["feature-7"]));setMessage("Sample reset.");}}>Reset feature sample</Button>
    <p style={{maxWidth:420,fontSize:12,color:"var(--aether-color-text-dim)"}}>Interactive tree state. CAD supplies model editing, rebuilds and service actions through the shared command contract.</p>
  </div>;
}
