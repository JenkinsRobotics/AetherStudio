import type { CSSProperties } from "react";
import "./MaterialSwatch.css";
export interface MaterialSwatchProps { color: string; roughness?: number; size?: "small" | "large"; label?: string; }
/** A compact illustrative surface sample. The owning renderer supplies the actual material preview. */
export function MaterialSwatch({ color, roughness = .5, size = "small", label }: MaterialSwatchProps) {
  return <span className="aui-material-swatch" data-size={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ "--material-swatch-color": color, "--material-swatch-shine": 1 - Math.max(0, Math.min(1, roughness)) } as CSSProperties}/>;
}
