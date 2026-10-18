import { useEffect, useRef, useState } from "react";
import type { Vector } from "./state";

/** Optional scene readout: never takes space away from the modeling tools. */
export function ModelPositionReadout({ position }: { position: Vector }) {
  const slot = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const available = slot.current, readout = content.current;
    if (!available || !readout || typeof ResizeObserver === "undefined") return;
    const measure = () => setFits(available.clientWidth > 0 && readout.scrollWidth <= available.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(available); observer.observe(readout); measure();
    return () => observer.disconnect();
  }, []);
  return <div className="ps-position-slot" ref={slot}>
    <div className="ps-selection-readout" ref={content} role="group" aria-label="Selected part position" style={{ visibility: fits ? "visible" : "hidden" }}>
      {position.map((value, axis) => <span key={axis}>{["X", "Y", "Z"][axis]} <b>{value}</b></span>)}<small>cm</small>
    </div>
  </div>;
}
