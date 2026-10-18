import { useId, useState, useEffect } from "react";
import { AetherIcon, Button, Inspector, InspectorSection, NumberField, SelectField, Slider, TextField, FeatureTree, type ToolIconName } from "../../src";
import { Switch } from "../../src/kit/widgets";
import { finishes, type WheelDisplay, type WheelStudy } from "./state";
export const referenceFeatures: { id:string; name:string; icon:ToolIconName }[] = [
  {id:"sketch1",name:"Sketch 1",icon:"sketch"},{id:"revolve1",name:"Revolve 1",icon:"revolve"},{id:"fillet3",name:"Fillet 3",icon:"fillet"},{id:"chamfer1",name:"Chamfer 1",icon:"chamfer"},{id:"fillet1",name:"Fillet 1",icon:"fillet"},{id:"shell1",name:"Shell 1",icon:"shell"},{id:"sketch2",name:"Sketch 2",icon:"sketch"},{id:"sketch3",name:"Sketch 3",icon:"sketch"},{id:"extrude1",name:"Extrude 1",icon:"extrude"},{id:"chamfer2",name:"Chamfer 2",icon:"chamfer"},{id:"fillet2",name:"Fillet 2",icon:"fillet"},{id:"sketch5",name:"Sketch 5",icon:"sketch"},{id:"extrude2",name:"Extrude 2",icon:"extrude"},{id:"sketch6",name:"Sketch 6",icon:"sketch"},
];
/** Small original model illustration for document cards, not a replacement UI glyph. */
export function WheelPreview({ className="" }: { className?: string }) {
  const id=useId().replaceAll(":","");
  return <svg className={`wr-wheel-preview ${className}`} viewBox="0 0 64 72" aria-hidden="true"><defs><linearGradient id={id} x1="0" x2="1" y1="0" y2=".7"><stop stopColor="#b9e7ff"/><stop offset=".43" stopColor="#668fae"/><stop offset=".7" stopColor="#35596f"/><stop offset="1" stopColor="#88c1de"/></linearGradient></defs><g stroke="#0b1d2b" strokeWidth="1.4" fill={`url(#${id})`}><ellipse cx="26" cy="35" rx="19" ry="30" transform="rotate(14 26 35)"/><ellipse cx="29" cy="35" rx="17" ry="28" transform="rotate(14 29 35)"/><path d="M31 11C43 9 58 21 56 36S46 65 34 62L24 57C38 54 44 22 31 11Z"/><ellipse cx="42" cy="37" rx="13" ry="24" transform="rotate(14 42 37)"/><ellipse cx="43" cy="37" rx="9" ry="19" transform="rotate(14 43 37)" fill="#152d3e"/><path d="M42 20C34 28 30 47 36 53C27 45 32 25 42 20" fill="#91bed8"/><ellipse cx="41" cy="38" rx="3" ry="7" transform="rotate(14 41 38)" fill="#446b85"/></g></svg>;
}
export function ReferenceFeatureTree({ selected, query, onSelect, wheel, onVisibility }: { selected:string; query:string; onSelect(id:string):void; wheel:WheelStudy; onVisibility():void }) {
  const [filter,setFilter]=useState(query);useEffect(()=>setFilter(query),[query]);
  return <FeatureTree className="wr-feature-tree" ariaLabel="Reference features" partsLabel="Reference parts" filter={filter} onFilterChange={setFilter}
    features={referenceFeatures.map(item=>({id:item.id,label:item.name,kind:"feature",type:item.icon}))}
    parts={[{id:"part",label:"Part 1",kind:"part",type:"part",hidden:!wheel.visible}]}
    selectedIDs={new Set([selected])} onSelect={ids=>onSelect(ids[0])} availableCommands={["visibility","edit"]}
    canCommand={request=>request.command === "visibility" ? request.ids.every(id=>id === "part") || "Only the rendered part has visibility in this study." : request.ids.every(id=>referenceFeatures.some(item=>item.id === id))}
    onCommand={request=>{if(request.command === "visibility")onVisibility();else if(request.command === "edit")onSelect(request.ids[0]);}}/>;
}
export type ReferenceUnit="mm"|"cm"|"in";
export const unitScale=(unit:ReferenceUnit)=>unit==="cm"?10:unit==="in"?25.4:1;
export function ReferenceProperties({wheel,onChange,display,onDisplay,unit,onUnit,decimals,onDecimals,hiddenLines,onHiddenLines,custom,onCustom}: {
  wheel:WheelStudy;onChange(value:Partial<WheelStudy>):void;display:WheelDisplay;onDisplay(value:WheelDisplay):void;unit:ReferenceUnit;onUnit(value:ReferenceUnit):void;decimals:number;onDecimals(value:number):void;hiddenLines:boolean;onHiddenLines(value:boolean):void;custom:{name:string;value:string}[];onCustom():void;
}) {
  const format=(v:number)=>(v/unitScale(unit)).toFixed(decimals),finish=finishes.find(f=>f.color===wheel.color);
  return <Inspector className="wr-properties">
    <InspectorSection title="Details" defaultOpen><label className="wr-field"><span>Name</span><TextField aria-label="Reference part name" value={wheel.name} onChange={e=>onChange({name:e.target.value})}/></label><dl className="wr-details"><dt>Type</dt><dd>Part Studio</dd><dt>Document</dt><dd>Train Cart Wheel</dd><dt>Workspace</dt><dd>Main</dd><dt>Last modified</dt><dd>Local concept session</dd></dl></InspectorSection>
    <InspectorSection title="Display" defaultOpen><label className="wr-field"><span>Material</span><span className="wr-material"><i style={{background:wheel.color}}/><SelectField aria-label="Reference material" value={finish?.name??"custom"} options={[...finishes.map(f=>({value:f.name,label:f.name})),...(!finish?[{value:"custom",label:"Custom"}]:[])]} onChange={e=>{const f=finishes.find(f=>f.name===e.target.value);if(f)onChange({color:f.color,roughness:f.roughness,metalness:f.metalness});}}/></span></label><div className="wr-field"><span>Opacity</span><div className="wr-opacity"><Slider ariaLabel="Reference opacity" value={Math.round(wheel.opacity*100)} min={10} max={100} onChange={value=>onChange({opacity:value/100})} showValue={false}/><output>{Math.round(wheel.opacity*100)}%</output></div></div></InspectorSection>
    <InspectorSection title="Units & precision" defaultOpen><label className="wr-field"><span>Units</span><SelectField aria-label="Reference units" value={unit} options={[{value:"mm",label:"Millimeters (mm)"},{value:"cm",label:"Centimeters (cm)"},{value:"in",label:"Inches (in)"}]} onChange={e=>onUnit(e.target.value as ReferenceUnit)}/></label><label className="wr-field"><span>Decimal places</span><SelectField aria-label="Decimal places" value={decimals} options={[0,1,2,3].map(value=>({value:String(value),label:String(value)}))} onChange={e=>onDecimals(Number(e.target.value))}/></label></InspectorSection>
    <InspectorSection title="Analysis" defaultOpen><div className="wr-toggle"><span>Show edges</span><Switch label="Show reference edges" checked={display.edges} onChange={edges=>onDisplay({...display,edges})}/></div><div className="wr-toggle"><span>Show hidden lines</span><Switch label="Show hidden lines" checked={hiddenLines} onChange={onHiddenLines}/></div><div className="wr-toggle"><span>Show section plane</span><Switch label="Show section plane" checked={display.section} onChange={section=>onDisplay({...display,section})}/></div></InspectorSection>
    <InspectorSection title="Bounding box" defaultOpen={false}><div className="wr-toggle"><span>Show bounds</span><Switch label="Reference bounding box" checked={display.bounds} onChange={bounds=>onDisplay({...display,bounds})}/></div><dl className="wr-details"><dt>Diameter</dt><dd>{format(wheel.diameter+wheel.flange*2)} {unit}</dd><dt>Width</dt><dd>{format(wheel.width*1.05)} {unit}</dd><dt>Axle bore</dt><dd>{format(wheel.bore)} {unit}</dd></dl></InspectorSection>
    <InspectorSection title="Mass properties" defaultOpen={false}><p className="wr-muted">Exact mass needs a closed CAD solid. This concept uses render geometry.</p></InspectorSection>
    {custom.map((field,i)=><div className="wr-field wr-custom-value" key={`${field.name}-${i}`}><span>{field.name}</span><span>{field.value}</span></div>)}
    <Button className="wr-add-property" onClick={onCustom}><AetherIcon name="plus"/>Add custom property</Button>
  </Inspector>;
}
export function ReferenceDimensions({wheel,onChange,unit}: {wheel:WheelStudy;onChange(patch:Partial<WheelStudy>):void;unit:ReferenceUnit}){
  const scale=unitScale(unit);
  return <div className="wr-dimension-fields">{([['diameter','Tread diameter',180,700],['width','Width',50,wheel.diameter*.5],['bore','Axle bore',12,wheel.diameter*.22],['flange','Flange height',8,wheel.diameter*.12],['rounding','Edge radius',.2,Math.min(wheel.width*.06,wheel.flange*.4)]] as const).map(([key,label,min,max])=><label className="wr-field" key={key}><span>{label}</span><NumberField aria-label={`Reference ${label}`} value={wheel[key]/scale} min={min/scale} max={max/scale} step={key==='rounding'?.2/scale:1/scale} unit={unit} onCommit={value=>onChange({[key]:value*scale})}/></label>)}</div>;
}
