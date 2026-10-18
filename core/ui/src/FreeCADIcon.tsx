import packagedAssets0 from "@aether/assets/catalogs/fbb09378fa973b";
import type { CSSProperties } from "react";
import { freecadIconCatalog } from "@aether/assets/icon-packs/freecad-graphite/catalog";
import { freecadToolIconMap } from "@aether/assets/icon-packs/freecad-graphite/tool-map";
import "./FreeCADIcon.css";

export { freecadIconCatalog, freecadToolIconMap };
export type FreeCADToolIconName = keyof typeof freecadToolIconMap;
export type FreeCADIconName = typeof freecadIconCatalog[number]["id"] | FreeCADToolIconName;
const files = (packagedAssets0 as Record<string, string>);

/** Separate, attributed FreeCAD-derived artwork. Existing ToolIcon packs stay unchanged. */
export function FreeCADIcon({ name, palette = "auto", size = 32, label, className = "", style }: {
  name: FreeCADIconName;
  palette?: "auto" | "light" | "dark";
  size?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const iconId = name in freecadToolIconMap ? freecadToolIconMap[name as FreeCADToolIconName] : name;
  const palettes = palette === "auto" ? ["dark", "light"] as const : [palette];
  return <span className={`aui-freecad-icon ${className}`} data-palette={palette}
    role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ width: size, height: size, ...style }}>
    {palettes.map(mode => <img key={mode} className={`aui-freecad-icon-${mode}`} alt="" draggable={false}
      loading="lazy" width={size} height={size}
      src={files[`../../assets/icon-packs/freecad-graphite/${mode}/${iconId}.svg`]} />)}
  </span>;
}
