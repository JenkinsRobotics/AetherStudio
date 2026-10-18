import { graphiteRibbonArtwork } from "@aether/assets/icon-packs/graphite-ribbon/artwork";
import { useToolIconTheme, type ToolIconPack, type ToolIconPalette } from "./ToolIconTheme";
import "./ToolIconTheme.css";
import undoIcon from "@aether/assets/icons/undo.svg?raw";
import redoIcon from "@aether/assets/icons/redo.svg?raw";
import constructionIcon from "@aether/assets/icons/tools/construction.svg?raw";
import textIcon from "@aether/assets/icons/tools/text.svg?raw";
// Aether Map mask workspace: drawing tools that CAD does not have.
import mapPen from "@aether/assets/icons/tools/pen.svg?raw";
import mapFreehand from "@aether/assets/icons/tools/freehand.svg?raw";
import mapMask from "@aether/assets/icons/tools/mask.svg?raw";
import mapFill from "@aether/assets/icons/tools/fill.svg?raw";
import mapBackdrop from "@aether/assets/icons/tools/backdrop.svg?raw";
import mapTransparentPng from "@aether/assets/icons/tools/transparent-png.svg?raw";
import mapCube from "@aether/assets/icons/tools/map-cube.svg?raw";
import mapBox from "@aether/assets/icons/tools/map-box.svg?raw";
import mapWebcam from "@aether/assets/icons/tools/webcam.svg?raw";
import mapTracker from "@aether/assets/icons/tools/tracker.svg?raw";
import mapSmartShape from "@aether/assets/icons/tools/smart-shape.svg?raw";
import mapAiGenerate from "@aether/assets/icons/tools/ai-generate.svg?raw";
import ellipticalArc from "@aether/assets/icons/tools/elliptical-arc.svg?raw";
import quadrantIcon from "@aether/assets/icons/tools/quadrant.svg?raw";
import symmetricIcon from "@aether/assets/icons/tools/symmetric.svg?raw";
import slot from "@aether/assets/icons/tools/slot.svg?raw";
import normal from "@aether/assets/icons/tools/normal.svg?raw";
import curvature from "@aether/assets/icons/tools/curvature.svg?raw";
import tangentArc from "@aether/assets/icons/tools/tangent-arc.svg?raw";
import variant0 from "@aether/assets/icons/tools/center-rectangle.svg?raw";
import variant1 from "@aether/assets/icons/tools/aligned-rectangle.svg?raw";
import variant2 from "@aether/assets/icons/tools/midpoint-line.svg?raw";
import variant3 from "@aether/assets/icons/tools/center-arc.svg?raw";
import variant4 from "@aether/assets/icons/tools/ellipse.svg?raw";
import variant5 from "@aether/assets/icons/tools/circle-three-point.svg?raw";
import variant6 from "@aether/assets/icons/tools/circumscribed-polygon.svg?raw";
import icon0 from "@aether/assets/icons/tools/add.svg?raw";
import icon1 from "@aether/assets/icons/tools/angle.svg?raw";
import icon2 from "@aether/assets/icons/tools/arc.svg?raw";
import icon3 from "@aether/assets/icons/tools/assembly.svg?raw";
import icon4 from "@aether/assets/icons/tools/axis.svg?raw";
import icon5 from "@aether/assets/icons/tools/back.svg?raw";
import icon6 from "@aether/assets/icons/tools/chamfer.svg?raw";
import icon7 from "@aether/assets/icons/tools/check.svg?raw";
import icon8 from "@aether/assets/icons/tools/circle.svg?raw";
import icon9 from "@aether/assets/icons/tools/concentric.svg?raw";
import icon10 from "@aether/assets/icons/tools/connector.svg?raw";
import icon11 from "@aether/assets/icons/tools/copy.svg?raw";
import icon12 from "@aether/assets/icons/tools/curve.svg?raw";
import icon13 from "@aether/assets/icons/tools/cut.svg?raw";
import icon14 from "@aether/assets/icons/tools/document.svg?raw";
import icon15 from "@aether/assets/icons/tools/draft.svg?raw";
import icon16 from "@aether/assets/icons/tools/edge.svg?raw";
import icon17 from "@aether/assets/icons/tools/emboss.svg?raw";
import icon18 from "@aether/assets/icons/tools/export.svg?raw";
import icon19 from "@aether/assets/icons/tools/extrude.svg?raw";
import icon20 from "@aether/assets/icons/tools/eye.svg?raw";
import icon21 from "@aether/assets/icons/tools/face.svg?raw";
import icon22 from "@aether/assets/icons/tools/fillet.svg?raw";
import icon23 from "@aether/assets/icons/tools/fit.svg?raw";
import icon24 from "@aether/assets/icons/tools/frame.svg?raw";
import icon25 from "@aether/assets/icons/tools/grid.svg?raw";
import icon26 from "@aether/assets/icons/tools/ground.svg?raw";
import icon27 from "@aether/assets/icons/tools/help.svg?raw";
import icon28 from "@aether/assets/icons/tools/hinge.svg?raw";
import icon29 from "@aether/assets/icons/tools/history.svg?raw";
import icon30 from "@aether/assets/icons/tools/hole.svg?raw";
import icon31 from "@aether/assets/icons/tools/home.svg?raw";
import icon32 from "@aether/assets/icons/tools/import.svg?raw";
import icon33 from "@aether/assets/icons/tools/insert.svg?raw";
import icon34 from "@aether/assets/icons/tools/inspect.svg?raw";
import icon35 from "@aether/assets/icons/tools/light.svg?raw";
import icon36 from "@aether/assets/icons/tools/line.svg?raw";
import icon37 from "@aether/assets/icons/tools/link.svg?raw";
import icon38 from "@aether/assets/icons/tools/list.svg?raw";
import icon39 from "@aether/assets/icons/tools/loft.svg?raw";
import icon40 from "@aether/assets/icons/tools/mass.svg?raw";
import icon41 from "@aether/assets/icons/tools/material.svg?raw";
import icon42 from "@aether/assets/icons/tools/measure.svg?raw";
import icon43 from "@aether/assets/icons/tools/mirror.svg?raw";
import icon44 from "@aether/assets/icons/tools/move.svg?raw";
import icon45 from "@aether/assets/icons/tools/new-part.svg?raw";
import icon46 from "@aether/assets/icons/tools/offset.svg?raw";
import icon47 from "@aether/assets/icons/tools/open.svg?raw";
import icon48 from "@aether/assets/icons/tools/pan.svg?raw";
import icon49 from "@aether/assets/icons/tools/panels.svg?raw";
import icon50 from "@aether/assets/icons/tools/parallel.svg?raw";
import icon51 from "@aether/assets/icons/tools/part.svg?raw";
import icon52 from "@aether/assets/icons/tools/pattern.svg?raw";
import icon53 from "@aether/assets/icons/tools/perpendicular.svg?raw";
import icon54 from "@aether/assets/icons/tools/plane.svg?raw";
import icon55 from "@aether/assets/icons/tools/point.svg?raw";
import icon56 from "@aether/assets/icons/tools/polygon.svg?raw";
import icon57 from "@aether/assets/icons/tools/properties.svg?raw";
import icon58 from "@aether/assets/icons/tools/push-pull.svg?raw";
import icon59 from "@aether/assets/icons/tools/rectangle.svg?raw";
import icon60 from "@aether/assets/icons/tools/remove.svg?raw";
import icon61 from "@aether/assets/icons/tools/replace-face.svg?raw";
import icon62 from "@aether/assets/icons/tools/revolve.svg?raw";
import icon63 from "@aether/assets/icons/tools/rotate.svg?raw";
import icon64 from "@aether/assets/icons/tools/save.svg?raw";
import commitIcon from "@aether/assets/icons/tools/commit.svg?raw";
import icon65 from "@aether/assets/icons/tools/scale.svg?raw";
import icon66 from "@aether/assets/icons/tools/select.svg?raw";
import icon67 from "@aether/assets/icons/tools/settings.svg?raw";
import icon68 from "@aether/assets/icons/tools/sheet.svg?raw";
import icon69 from "@aether/assets/icons/tools/shell.svg?raw";
import icon70 from "@aether/assets/icons/tools/sketch.svg?raw";
import icon71 from "@aether/assets/icons/tools/slider.svg?raw";
import icon72 from "@aether/assets/icons/tools/split.svg?raw";
import icon73 from "@aether/assets/icons/tools/suppressed.svg?raw";
import icon74 from "@aether/assets/icons/tools/sweep.svg?raw";
import icon75 from "@aether/assets/icons/tools/tangent.svg?raw";
import icon76 from "@aether/assets/icons/tools/thicken.svg?raw";
import icon77 from "@aether/assets/icons/tools/thread.svg?raw";
import icon78 from "@aether/assets/icons/tools/trim.svg?raw";
import icon79 from "@aether/assets/icons/tools/vertex.svg?raw";
import icon80 from "@aether/assets/icons/tools/view-front.svg?raw";
import icon81 from "@aether/assets/icons/tools/view-right.svg?raw";
import icon82 from "@aether/assets/icons/tools/view-top.svg?raw";
import icon83 from "@aether/assets/icons/tools/weld.svg?raw";
import icon84 from "@aether/assets/icons/tools/wireframe.svg?raw";
import tool_box from "@aether/assets/icons/tools/box.svg?raw";
import tool_cylinder from "@aether/assets/icons/tools/cylinder.svg?raw";
import tool_sphere from "@aether/assets/icons/tools/sphere.svg?raw";
import tool_equal from "@aether/assets/icons/tools/equal.svg?raw";
import tool_boolean from "@aether/assets/icons/tools/boolean.svg?raw";
// Mate artwork: the joint kinds FreeCAD's Assembly solver adds.
import mateBall from "@aether/assets/icons/tools/ball.svg?raw";
import mateBelt from "@aether/assets/icons/tools/belt.svg?raw";
import mateCylindrical from "@aether/assets/icons/tools/cylindrical.svg?raw";
import mateGears from "@aether/assets/icons/tools/gears.svg?raw";
import mateRackPinion from "@aether/assets/icons/tools/rack-pinion.svg?raw";
import { useId, type SVGProps } from "react";

/** Illustrated, shared tool artwork. Brand marks remain separate. */
const artwork = {
  "pen": mapPen,
  "freehand": mapFreehand,
  "mask": mapMask,
  "fill": mapFill,
  "backdrop": mapBackdrop,
  "transparent-png": mapTransparentPng,
  "map-cube": mapCube,
  "map-box": mapBox,
  "webcam": mapWebcam,
  "tracker": mapTracker,
  "smart-shape": mapSmartShape,
  "ai-generate": mapAiGenerate,
  "ball": mateBall,
  "belt": mateBelt,
  "cylindrical": mateCylindrical,
  "gears": mateGears,
  "rack-pinion": mateRackPinion,
  "text": textIcon,
  "slot": slot,
  "normal": normal,
  "curvature": curvature,
  "tangent-arc": tangentArc,
  "quadrant": quadrantIcon,
  "symmetric": symmetricIcon,
  "center-rectangle": variant0,
  "aligned-rectangle": variant1,
  "midpoint-line": variant2,
  "elliptical-arc": ellipticalArc,
  "center-arc": variant3,
  "ellipse": variant4,
  "circle-three-point": variant5,
  "circumscribed-polygon": variant6,

  "add": icon0,
  "angle": icon1,
  "arc": icon2,
  "assembly": icon3,
  "axis": icon4,
  "back": icon5,
  "chamfer": icon6,
  "check": icon7,
  "circle": icon8,
  "concentric": icon9,
  "connector": icon10,
  "copy": icon11,
  "curve": icon12,
  "cut": icon13,
  "document": icon14,
  "draft": icon15,
  "edge": icon16,
  "emboss": icon17,
  "export": icon18,
  "extrude": icon19,
  "eye": icon20,
  "face": icon21,
  "fillet": icon22,
  "fit": icon23,
  "frame": icon24,
  "grid": icon25,
  "ground": icon26,
  "help": icon27,
  "hinge": icon28,
  "history": icon29,
  "undo": undoIcon,
  "redo": redoIcon,
  "hole": icon30,
  "home": icon31,
  "import": icon32,
  "insert": icon33,
  "inspect": icon34,
  "light": icon35,
  "line": icon36,
  "construction": constructionIcon,
  "link": icon37,
  "list": icon38,
  "loft": icon39,
  "mass": icon40,
  "material": icon41,
  "measure": icon42,
  "mirror": icon43,
  "move": icon44,
  "new-part": icon45,
  "offset": icon46,
  "open": icon47,
  "pan": icon48,
  "panels": icon49,
  "parallel": icon50,
  "part": icon51,
  "pattern": icon52,
  "perpendicular": icon53,
  "plane": icon54,
  "point": icon55,
  "polygon": icon56,
  "properties": icon57,
  "push-pull": icon58,
  "rectangle": icon59,
  "remove": icon60,
  "replace-face": icon61,
  "revolve": icon62,
  "rotate": icon63,
  "save": icon64,
  "commit": commitIcon,
  "scale": icon65,
  "select": icon66,
  "settings": icon67,
  "sheet": icon68,
  "shell": icon69,
  "sketch": icon70,
  "slider": icon71,
  "split": icon72,
  "suppressed": icon73,
  "sweep": icon74,
  "tangent": icon75,
  "thicken": icon76,
  "thread": icon77,
  "trim": icon78,
  "vertex": icon79,
  "view-front": icon80,
  "view-right": icon81,
  "view-top": icon82,
  "weld": icon83,
  "wireframe": icon84,
  "box": tool_box,
  "cylinder": tool_cylinder,
  "sphere": tool_sphere,
  "equal": tool_equal,
  "boolean": tool_boolean,
} as const;
export type ToolIconName = keyof typeof artwork | keyof typeof graphiteRibbonArtwork;
export const graphiteToolIconNames = Object.keys(graphiteRibbonArtwork) as ToolIconName[];
export const toolIconNames = Object.keys(artwork) as ToolIconName[];
export interface ToolIconProps extends Omit<SVGProps<SVGSVGElement>, "ref" | "name" | "children" | "dangerouslySetInnerHTML"> {
  name: ToolIconName;
  pack?: ToolIconPack;
  palette?: ToolIconPalette;
}
export function ToolIcon({ name, pack, palette, className = "", ...props }: ToolIconProps) {
  const inherited = useToolIconTheme();
  // A pack that lacks the name falls back to the other pack, so a partial pack never renders nothing.
  const wanted = pack ?? inherited.pack;
  const activePack: ToolIconPack = wanted === "graphite-ribbon"
    ? (name in graphiteRibbonArtwork ? "graphite-ribbon" : "classic")
    : (name in artwork ? "classic" : "graphite-ribbon");
  const activePalette = palette ?? inherited.palette;
  // Per-instance gradient IDs: repeated tools and multiple ribbons may coexist.
  const prefix = `tool-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const source = activePack === "graphite-ribbon" ? graphiteRibbonArtwork[name as keyof typeof graphiteRibbonArtwork] : artwork[name as keyof typeof artwork];
  // Keep the source's presentation defaults. Discarding the root used to turn
  // unfilled arcs into black wedges and strip currentColor strokes from glyphs.
  const body = source.replace(/^<svg\b([^>]*)>/, (_, attributes: string) =>
    `<g${attributes.replace(/\s(?:xmlns|viewBox|width|height)="[^"]*"/g, "")}>`)
    .replace(/<\/svg>\s*$/, "</g>");
  const [x, y, width, height] = (source.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 32 32")
    .trim().split(/[\s,]+/).map(Number);
  const normalized = x === 0 && y === 0 && width === 32 && height === 32 ? body
    : `<g transform="scale(${32 / width} ${32 / height}) translate(${-x} ${-y})">${body}</g>`;
  const markup = normalized
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`);
  return <svg {...props} className={`aui-tool-icon ${className}`} viewBox="0 0 32 32"
    width="32" height="32" aria-hidden="true" focusable="false"
    data-icon-pack={activePack} data-icon-palette={activePalette}
    dangerouslySetInnerHTML={{ __html: markup }} />;
}
