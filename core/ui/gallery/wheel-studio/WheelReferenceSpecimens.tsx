import type { StudioSpecimenKind } from "../showcase/studio-specimen-sections";
import { useState } from "react";
import { ReferenceDimensions, ReferenceFeatureTree, ReferenceProperties, type ReferenceUnit } from "./WheelReferenceWidgets";
import { initialDisplay, initialWheel, updateWheel, type WheelStudy } from "./state";
import "./wheel-reference.css";
export function WheelReferenceSpecimens({ kind }: { kind: StudioSpecimenKind }){
 const [wheel,setWheel]=useState({...initialWheel,name:"train when",width:180,flange:32}),[display,setDisplay]=useState(initialDisplay),[selected,setSelected]=useState("sketch3"),[unit,setUnit]=useState<ReferenceUnit>("mm"),[decimals,setDecimals]=useState(2),[hidden,setHidden]=useState(false),[custom,setCustom]=useState<{name:string;value:string}[]>([]);
 const change=(patch:Partial<WheelStudy>)=>setWheel(v=>updateWheel(v,patch));
 return <div className="wr-widget-specimens">{kind === "trees" && <article><small className="showcase-studio-source">Wheel study</small><h3>Compact reference features</h3><ReferenceFeatureTree selected={selected} query="" onSelect={setSelected} wheel={wheel} onVisibility={()=>change({visible:!wheel.visible})}/></article>}{kind === "inspectors" && <article><small className="showcase-studio-source">Wheel study</small><h3>Reference properties</h3><ReferenceProperties wheel={wheel} onChange={change} display={display} onDisplay={setDisplay} unit={unit} onUnit={setUnit} decimals={decimals} onDecimals={setDecimals} hiddenLines={hidden} onHiddenLines={setHidden} custom={custom} onCustom={()=>setCustom(v=>[...v,{name:`Property ${v.length+1}`,value:"Sample value"}])}/></article>}{kind === "inspectors" && <article><small className="showcase-studio-source">Wheel study</small><h3>Wheel dimensions</h3><ReferenceDimensions wheel={wheel} onChange={change} unit={unit}/></article>}</div>;
}
