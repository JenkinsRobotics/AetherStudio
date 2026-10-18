import { useRef } from "react";
import "./PanelResizeHandle.css";

export interface PanelResizeHandleProps {
  edge: "left" | "right" | "top" | "bottom";
  label: string;
  value: number | (() => number);
  min?: number;
  max?: number;
  /** Centered cards grow equally on both sides. */
  scale?: number;
  onChange: (size: number) => void;
  onReset?: () => void;
}
/** Pointer-captured and keyboard-operable sizing shared by workspace cards. */
export function PanelResizeHandle({ edge, label, value, min = 180, max = 1200, scale = 1, onChange, onReset }: PanelResizeHandleProps) {
  const drag = useRef<{ start: number; size: number } | null>(null);
  const horizontal = edge === "left" || edge === "right";
  const direction = edge === "left" || edge === "top" ? -1 : 1;
  const current = () => typeof value === "function" ? value() : value;
  const resize = (size:number) => onChange(Math.max(min, Math.min(max, size)));
  return <div className="aui-panel-resize-handle" data-edge={edge} role="separator" aria-label={label}
    aria-orientation={horizontal ? "vertical" : "horizontal"} aria-valuemin={min} aria-valuemax={Math.round(max)}
    aria-valuenow={typeof value === "number" ? Math.round(value) : undefined} tabIndex={0}
    title={`${label} · Drag or use arrow keys · Double-click to restore default`}
    onDoubleClick={onReset}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();event.stopPropagation();
      drag.current = {start: horizontal ? event.clientX : event.clientY, size: current()};
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (drag.current) resize(drag.current.size + ((horizontal ? event.clientX : event.clientY) - drag.current.start) * direction * scale);
    }}
    onPointerUp={event => {drag.current=null; if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);}}
    onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
    onKeyDown={event => {
      if (event.key === "Home" && onReset) {event.preventDefault();onReset();return;}
      const delta = event.key === (horizontal ? "ArrowRight" : "ArrowDown") ? 1 : event.key === (horizontal ? "ArrowLeft" : "ArrowUp") ? -1 : 0;
      if(delta) {event.preventDefault();resize(current()+delta*direction*(event.shiftKey?50:10));}
    }} />;
}
