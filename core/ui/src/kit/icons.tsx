/** The kit's icons come from the shared packs: `Sym` is the sized interface glyph
 * (core/assets/icons via AetherIcon, the kit's `.font(.system(size:))` shorthand),
 * `ToolGlyph` is a tool's icon — the illustrated ToolIcon pack when the name is a
 * tool, the interface glyph otherwise. Names are pack names, never SF names. */
import type { CSSProperties } from "react";
import { AetherIcon, type AetherIconName } from "../AetherIcon";
import { ToolIcon, graphiteToolIconNames, toolIconNames, type ToolIconName } from "../ToolIcon";

export type SymName = AetherIconName;

export interface SymProps {
  name: SymName;
  size?: number;
  /** SF weight → stroke width. */
  weight?: "light" | "regular" | "medium" | "semibold" | "bold" | "heavy";
  className?: string;
  style?: CSSProperties;
}

const STROKE: Record<NonNullable<SymProps["weight"]>, number> = {
  light: 1.3, regular: 1.6, medium: 1.9, semibold: 2.2, bold: 2.5, heavy: 2.9,
};

/** One SF-named glyph, sized like `.font(.system(size:))`. */
export function Sym({ name, size = 12, weight = "regular", className, style }: SymProps) {
  return <AetherIcon name={name} width={size} height={size} strokeWidth={STROKE[weight]} className={className ? `aui-kit-sym ${className}` : "aui-kit-sym"} style={{ flexShrink: 0, ...style }} />;
}

const TOOL_NAMES = new Set<string>([...toolIconNames, ...graphiteToolIconNames]);
export const isToolIconName = (name: string): name is ToolIconName => TOOL_NAMES.has(name);

/** A tool's icon: illustrated when the pack has it, else the interface glyph. */
export function ToolGlyph({ name, size = 16, weight, className, style }: SymProps) {
  return isToolIconName(name)
    ? <ToolIcon name={name} width={size} height={size} className={className} style={{ flexShrink: 0, ...style }} />
    : <Sym name={name} size={size} weight={weight} className={className} style={style} />;
}
