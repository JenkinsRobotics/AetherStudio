import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PanelResizeHandle } from "./PanelResizeHandle";
import "./TreePanelSplit.css";

export interface TreePanelSplitProps {
  primary: ReactNode;
  secondary: ReactNode;
  primaryLabel: string;
  secondaryLabel: string;
  /** Fraction of available height assigned to the first collection. */
  defaultRatio?: number;
  storageKey?: string;
}

const bounded = (ratio: number) => Math.max(0.2, Math.min(0.8, ratio));

/** Two independently scrolling collections sharing one card and a movable divider. */
export function TreePanelSplit({ primary, secondary, primaryLabel, secondaryLabel, defaultRatio = 0.65, storageKey }: TreePanelSplitProps) {
  const root = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(600);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => { const size = element.getBoundingClientRect().height - 6; if (size > 0) setHeight(size); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const initial = Number.isFinite(defaultRatio) ? bounded(defaultRatio) : 0.65;
  const [ratio, setRatio] = useState(() => {
    try {
      const saved = storageKey && localStorage.getItem(storageKey);
      return saved && Number.isFinite(Number(saved)) ? bounded(Number(saved)) : initial;
    } catch { return initial; }
  });
  const update = (value: number) => {
    const next = bounded(value);
    setRatio(next);
    try { if (storageKey) localStorage.setItem(storageKey, String(next)); } catch { /* Private storage is optional. */ }
  };
  return <div ref={root} className="aui-tree-panel-split" style={{ gridTemplateRows: `minmax(0, ${ratio}fr) 6px minmax(0, ${1 - ratio}fr)` }}>
    <section className="aui-tree-panel-split-section" aria-label={primaryLabel}>{primary}</section>
    <div className="aui-tree-panel-split-divider">
      <PanelResizeHandle edge="bottom" label={`Resize ${primaryLabel} and ${secondaryLabel}`}
        value={height * ratio} min={height * 0.2} max={height * 0.8}
        onChange={size => update(size / height)} onReset={() => update(initial)} />
    </div>
    <section className="aui-tree-panel-split-section" aria-label={secondaryLabel}>{secondary}</section>
  </div>;
}
