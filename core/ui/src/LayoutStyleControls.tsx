import { useState, type CSSProperties } from "react";
import { Checkbox } from "./Checkbox";
import { ColorField } from "./ColorField";
import { NumberField } from "./NumberField";
import { SegmentedControl } from "./SegmentedControl";
import { SelectField } from "./SelectField";
import "./LayoutStyleControls.css";
export interface LayoutStyleValue { direction:"row"|"column"; alignment:"stretch"|"center"|"start"|"end"; gap:number; padding:number; radius:number; strokeWidth:number; stroke:string; fill:string; clip:boolean; }
export const defaultLayoutStyle:LayoutStyleValue={direction:"row",alignment:"center",gap:12,padding:16,radius:8,strokeWidth:1,stroke:"#b8bec8",fill:"#f5f7fa",clip:true};
export function LayoutStyleControls({value,onChange}: {value?:LayoutStyleValue;onChange?:(value:LayoutStyleValue)=>void}) {
  const [local,setLocal]=useState(defaultLayoutStyle);const v=value??local;
  const update=(patch:Partial<LayoutStyleValue>)=>{const next={...v,...patch};if(!value)setLocal(next);onChange?.(next);};
  const number=(label:string,key:"gap"|"padding"|"radius"|"strokeWidth",max=100)=><label>{label}<NumberField aria-label={label} value={v[key]} min={0} max={max} unit="px" onCommit={n=>update({[key]:n})}/></label>;
  const style:CSSProperties={flexDirection:v.direction,alignItems:v.alignment==="start"?"flex-start":v.alignment==="end"?"flex-end":v.alignment,gap:v.gap,padding:v.padding,borderRadius:v.radius,border:`${v.strokeWidth}px solid ${v.stroke}`,background:v.fill,overflow:v.clip?"hidden":"visible"};
  return <section className="aui-layout-style" aria-label="Layout and style controls">
    <div><fieldset><legend>LAYOUT</legend><label>Direction<SegmentedControl ariaLabel="Layout direction" value={v.direction} onChange={direction=>update({direction:direction as LayoutStyleValue["direction"]})} options={[{id:"row",label:"Row"},{id:"column",label:"Column"}]}/></label>
      <label>Alignment<SelectField aria-label="Layout alignment" value={v.alignment} onChange={e=>update({alignment:e.target.value as LayoutStyleValue["alignment"]})} options={["stretch","center","start","end"].map(id=>({value:id,label:id[0].toUpperCase()+id.slice(1)}))}/></label>{number("Gap","gap")}{number("Padding","padding")}</fieldset>
      <fieldset><legend>BORDER & BACKGROUND</legend>{number("Radius","radius")}{number("Stroke width","strokeWidth",12)}<label>Stroke<ColorField ariaLabel="Layout stroke" value={v.stroke} onChange={stroke=>update({stroke})}/></label><label>Fill<ColorField ariaLabel="Layout fill" value={v.fill} onChange={fill=>update({fill})}/></label><Checkbox label="Clip content" checked={v.clip} onChange={e=>update({clip:e.target.checked})}/></fieldset>
    </div><div className="aui-layout-style__stage"><div className="aui-layout-style__preview" aria-label="Layout preview" style={style}>{[1,2,3].map(i=><span key={i}>{i}</span>)}</div></div>
  </section>;
}
