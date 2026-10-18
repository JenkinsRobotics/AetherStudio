import { useLayoutEffect, useRef, useState } from "react";
import { FloatingPanel } from "../../src";
import { ModelMeasurement } from "./ModelViewTools";
import type { Vector } from "./state";

/** Modeless shared window: the viewport remains available for point picking. */
export function ModelMeasurePopup({ points, onClear, onClose }: {
  points: Vector[]; onClear: () => void; onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 800, height: 600, panelHeight: 180 });
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const element = host.current; if (!element) return;
    const panel = element.querySelector<HTMLElement>(".aui-float-panel");
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setBounds({ width: rect.width || window.innerWidth, height: rect.height || window.innerHeight, panelHeight: panel?.getBoundingClientRect().height || 180 });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element); if (panel) observer.observe(panel);
    element.querySelector<HTMLElement>(".aui-float-panel-header")?.focus();
    return () => observer.disconnect();
  }, []);
  const width = Math.min(280, Math.max(100, bounds.width - 24));
  const constrain = (x: number, y: number) => ({
    x: Math.max(12, Math.min(x, bounds.width - width - 12)),
    y: Math.max(12, Math.min(y, bounds.height - bounds.panelHeight - 12)),
  });
  const placed = constrain(position?.x ?? bounds.width - width - (bounds.width > 820 ? 256 : 12), position?.y ?? 120);
  return <div className="ps-measure-layer" ref={host} role="dialog" aria-label="Measure" aria-modal="false"
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <FloatingPanel title="Measure" x={placed.x} y={placed.y} width={width}
      onMove={(x, y) => setPosition(constrain(x, y))} onClose={onClose}>
      <ModelMeasurement points={points} onClear={onClear}/>
    </FloatingPanel>
  </div>;
}
