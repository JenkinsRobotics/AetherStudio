import { useEffect, useId, useRef, useState } from "react";
import { StudyArtwork, StudyBackdrop } from "./StudyArtwork";
import type { StudyApp, StudyItem } from "./studies";

export function StudyCanvas({ app, items, selected, tool, grid, guides, copper, playing, fit, onSelect, onMove, onZoom }: {
  app: StudyApp; items: readonly StudyItem[]; selected: string; tool: string; grid: boolean; guides: boolean; copper: boolean; playing: boolean; fit: number;
  onSelect: (id: string) => void; onMove: (id: string, x: number, y: number) => void; onZoom: (value: number) => void;
}) {
  const prefix = `study-${useId().replaceAll(":", "")}`, svg = useRef<SVGSVGElement>(null);
  const [camera, setCamera] = useState({ x:0,y:0,zoom:1 });
  const gesture = useRef<{ pointer:number; startX:number; startY:number; x:number; y:number; item?:string } | undefined>(undefined);
  useEffect(()=>{
    if(!fit)return;
    const visible=items.filter(item=>item.visible), bounds=visible.map(item=>[item.bounds[0]+item.x,item.bounds[1]+item.y,item.bounds[2],item.bounds[3]]);
    if(app!=="sketch")bounds.push([80,40,840,620]);
    if(!bounds.length){setCamera({x:0,y:0,zoom:1});return;}
    const left=Math.min(...bounds.map(b=>b[0])),top=Math.min(...bounds.map(b=>b[1])),right=Math.max(...bounds.map(b=>b[0]+b[2])),bottom=Math.max(...bounds.map(b=>b[1]+b[3]));
    setCamera({x:500-(left+right)/2,y:350-(top+bottom)/2,zoom:Math.min(1.8,880/(right-left),610/(bottom-top))});
  },[fit]);
  useEffect(()=>{onZoom(Math.round(camera.zoom*100));},[camera.zoom,onZoom]);
  useEffect(()=>{
    const el=svg.current; if(!el)return;
    const wheel=(event:WheelEvent)=>{event.preventDefault();setCamera(current=>({...current,zoom:Math.max(.2,Math.min(5,current.zoom*Math.exp(-event.deltaY*.0015)))}));};
    el.addEventListener("wheel",wheel,{passive:false});return()=>el.removeEventListener("wheel",wheel);
  },[]);
  function point(clientX:number,clientY:number){const matrix=svg.current?.getScreenCTM();return matrix?new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse()):{x:clientX,y:clientY};}
  return <div className="study-canvas" data-grid={grid} data-playing={playing}>
    <svg ref={svg} viewBox="0 0 1000 700" aria-label={`${app} drawing canvas`} className="study-art" data-tool={tool} data-zoom={camera.zoom.toFixed(3)}
      onContextMenu={event=>event.preventDefault()}
      onPointerDown={event=>{
        if(event.button!==0&&event.button!==1&&event.button!==2)return;
        const target=(event.target as Element).closest('[data-item]')?.getAttribute('data-item');
        const current=items.find(item=>item.id===target),p=point(event.clientX,event.clientY);
        const pan=tool==="pan"||event.button!==0;
        if(!pan&&current)onSelect(current.id);
        if(pan||tool==="move"&&current){svg.current?.setPointerCapture(event.pointerId);gesture.current={pointer:event.pointerId,startX:p.x,startY:p.y,x:pan?camera.x:current!.x,y:pan?camera.y:current!.y,item:pan?undefined:current!.id};event.preventDefault();}
      }}
      onPointerMove={event=>{const drag=gesture.current;if(!drag||drag.pointer!==event.pointerId)return;const p=point(event.clientX,event.clientY),dx=(p.x-drag.startX)/camera.zoom,dy=(p.y-drag.startY)/camera.zoom;
        if(drag.item)onMove(drag.item,Math.round(drag.x+dx),Math.round(drag.y+dy));else setCamera(current=>({...current,x:drag.x+dx,y:drag.y+dy}));}}
      onPointerUp={()=>{gesture.current=undefined;}} onPointerCancel={()=>{gesture.current=undefined;}} onLostPointerCapture={()=>{gesture.current=undefined;}}>
      <g transform={`translate(500 350) scale(${camera.zoom}) translate(${-500+camera.x} ${-350+camera.y})`}>
        <StudyBackdrop app={app} copper={copper} prefix={prefix}/>
        {items.filter(item=>item.visible).map(item=><g key={item.id} data-item={item.id} role="button" tabIndex={0} aria-label={`Select ${item.name}`} aria-pressed={item.id===selected}
          transform={`translate(${item.x} ${item.y})`} opacity={item.opacity/100}
          onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(item.id);}}}>
          <StudyArtwork app={app} item={item} prefix={prefix}/>
          {guides&&item.id===selected&&<g className="study-selection" pointerEvents="none"><rect x={item.bounds[0]-7} y={item.bounds[1]-7} width={item.bounds[2]+14} height={item.bounds[3]+14} fill="none" stroke="#5da7ed" strokeWidth="1" strokeDasharray={app==="map"?undefined:"5 4"}/>
            {[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=><rect key={`${x}-${y}`} x={item.bounds[0]-10+x*(item.bounds[2]+14)} y={item.bounds[1]-10+y*(item.bounds[3]+14)} width="6" height="6" fill="#101112" stroke="#80bbfa"/>)}</g>}
        </g>)}
      </g>
    </svg>
  </div>;
}
