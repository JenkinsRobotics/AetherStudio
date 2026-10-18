import { useRef, useState, type PointerEvent } from "react";
import type { Stroke } from "./data";
export function Annotations({strokes,caption,color,brushWidth,aspect,drawing,onStroke}:{strokes:readonly Stroke[];caption:string;color:string;brushWidth:number;aspect:number;drawing:boolean;onStroke:(stroke:Stroke)=>void}) {
  const [draft,setDraft]=useState<Stroke|null>(null); const pending=useRef<Stroke|null>(null);
  const point=(event:PointerEvent<SVGSVGElement>):[number,number]=>{const r=event.currentTarget.getBoundingClientRect();return [Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))];};
  const cancel=()=>{pending.current=null;setDraft(null);};
  return <svg className="avatar-annotations" data-drawing={drawing} viewBox={`0 0 1000 ${1000/aspect}`} aria-label="Scene annotations" role="img"
    onPointerDown={event=>{if(!drawing||event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);const next={color,width:brushWidth,points:[point(event)]};pending.current=next;setDraft(next);}}
    onPointerMove={event=>{if(!pending.current)return;const next={...pending.current,points:[...pending.current.points,point(event)]};pending.current=next;setDraft(next);}}
    onPointerUp={event=>{if(!pending.current)return;onStroke({...pending.current,points:[...pending.current.points,point(event)]});cancel();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
    onPointerCancel={cancel} onLostPointerCapture={cancel}>
    {[...strokes,...(draft?[draft]:[])].map((stroke,index)=><polyline key={index} points={stroke.points.map(([x,y])=>`${x*1000},${y*1000/aspect}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round"/>)}
    {caption && <text x="65" y={1000/aspect*.82} fill={color} fontSize="34" fontFamily="sans-serif" fontWeight="600">{caption}</text>}
  </svg>;
}
