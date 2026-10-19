import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import "./StudioAppFrame.css";
import "./StudioCameraControl.css";

/** One expanding camera surface; products supply their real navigation. */
export function StudioCameraControl({ projection = "Perspective", children }: { projection?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return <div className="aui-studio-camera-control" data-expanded={open}>
    <div className="aui-studio-camera-surface">
      <div id={id} className="aui-studio-camera-content" role="group" aria-label="Camera navigation" aria-hidden={!open} inert={!open}>
        {children}
      </div>
      <button ref={button} className="aui-studio-camera-toggle" type="button" aria-label="Camera view" title={open ? "Collapse view cube" : "Expand view cube"} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><AetherIcon name="cube"/></button>
    </div>
    <span className="aui-studio-camera-projection">{projection}</span>
  </div>;
}
