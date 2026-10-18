import { useState } from "react";
import { RelationEditor, type RelationEditorValue } from "../src/RelationEditor";
const kinds=[{value:"gear",label:"Gear"},{value:"rack",label:"Rack and pinion"},{value:"screw",label:"Screw"},{value:"linear",label:"Linear"}];
export function StudioRelationPreview({kind,onApply,onCancel}:{kind:string;onApply:(value:RelationEditorValue)=>void;onCancel:()=>void}) {
  const [value,setValue]=useState<RelationEditorValue>({kind,driver:"",driven:"",magnitude:1,reversed:false,offset:0});
  const translation=value.kind!=="gear";
  const source=value.kind==="linear"?["carriage.travel","lift.travel"]:["pan.rotation","tilt.rotation","jaw.rotation"];
  const target=translation?["carriage.travel","lift.travel"]:source;
  return <RelationEditor value={value} onChange={setValue} kinds={kinds} drivers={source.map(label=>({value:label,label}))} driven={target.filter(label=>label!==value.driver).map(label=>({value:label,label}))}
    ratioLabel={value.kind==="rack"||value.kind==="screw"?"Distance per revolution":"Relation ratio"} ratioUnit={value.kind==="rack"||value.kind==="screw"?"mm/rev":undefined} offsetUnit={translation?"mm":"deg"}
    description="Local UI preview. The production Aether Animation app validates and evaluates relations in its engine."
    onApply={()=>onApply(value)} onCancel={onCancel}/>;
}
