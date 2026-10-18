import { useState } from "react";
import {
  AetherIcon, FreeCADIcon, SegmentedControl, TextField, ToolIcon, ToolIconTheme, activeAetherTheme, aetherIconNames, freecadToolIconMap, graphiteToolIconNames, toolIconNames,
  type FreeCADToolIconName, type ToolIconName, type ToolIconPack,
} from "../src";
import { FreeCADIconPack } from "./FreeCADIconPack";
import "./IconPacks.css";

type Palette = "dark" | "light";
const PALETTES = [{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }];
const matches = (names: readonly string[], query: string) => { const q = query.trim().toLowerCase(); return q ? names.filter((name) => name.includes(q)) : [...names]; };

/** The controls every pack section carries: pack, filter, palette, count. */
function PackControls({ packs, pack, onPack, query, onQuery, palette, onPalette, count, total }: {
  packs: readonly { id: string; label: string }[]; pack: string; onPack: (id: string) => void;
  query: string; onQuery: (value: string) => void; palette: Palette; onPalette: (palette: Palette) => void; count: number; total: number;
}) {
  return (
    <div className="icon-pack-controls">
      <SegmentedControl ariaLabel="Icon pack" options={packs} value={pack} onChange={onPack} />
      <div className="icon-pack-filter"><TextField placeholder="Filter icons" value={query} onChange={(event) => onQuery(event.target.value)} /></div>
      <SegmentedControl ariaLabel="Palette" options={PALETTES} value={palette} onChange={(id) => onPalette(id as Palette)} />
      <span className="icon-pack-count">{count} of {total} icons</span>
    </div>
  );
}

const SYSTEM_PACKS = [{ id: "aether-default", label: "Aether Default" }];

/** The system glyph pack: one style for every app's chrome, like SF Symbols on macOS. */
export function SystemIconBrowser() {
  const [pack, setPack] = useState("aether-default");
  const [query, setQuery] = useState("");
  const [palette, setPalette] = useState<Palette>("dark");
  const names = matches(aetherIconNames, query);
  return (
    <div className="icon-pack">
      <p>One glyph style for every Aether Studio app's chrome — headers, menus, panels, status, widget controls. 24px, 1.7px stroke, currentColor, from core/assets/icons; an alternate system pack registers the same names.</p>
      <PackControls packs={SYSTEM_PACKS} pack={pack} onPack={setPack} query={query} onQuery={setQuery} palette={palette} onPalette={setPalette} count={names.length} total={aetherIconNames.length} />
      <div className={`icon-pack-surface aether-theme-${activeAetherTheme()} aether-${palette}-theme`} data-palette={palette} data-aether-theme={palette}>
        <div className="icon-pack-grid">
          {names.map((name) => <div className="icon-pack-cell" key={name}><AetherIcon name={name} width={24} height={24} /><span>{name}</span></div>)}
        </div>
      </div>
    </div>
  );
}

const TOOL_PACKS = [{ id: "classic", label: "Aether Classic" }, { id: "graphite-ribbon", label: "Graphite Ribbon" }, { id: "freecad-graphite", label: "FreeCAD Graphite" }];
const FREECAD_TOOLS = Object.keys(freecadToolIconMap) as FreeCADToolIconName[];

/** The tool packs: the illustrated icons for the tools an app makes, scoped per app with ToolIconTheme. */
export function ToolPackBrowser() {
  const [pack, setPack] = useState("classic");
  const [query, setQuery] = useState("");
  const [palette, setPalette] = useState<Palette>("dark");
  const all: readonly string[] = pack === "classic" ? toolIconNames : pack === "graphite-ribbon" ? graphiteToolIconNames : FREECAD_TOOLS;
  const names = matches(all, query);
  const themePack: ToolIconPack = pack === "graphite-ribbon" ? "graphite-ribbon" : "classic";
  return (
    <div className="icon-pack">
      <p>The illustrated icons for the tools an app makes — CAD modelling, the Aether tool bars. An app scopes its pack with ToolIconTheme; the header's icon-pack menu switches it for every tool bar on this page. Names are shared across packs, so a pack that lacks one falls back to the other.</p>
      <PackControls packs={TOOL_PACKS} pack={pack} onPack={setPack} query={query} onQuery={setQuery} palette={palette} onPalette={setPalette} count={names.length} total={all.length} />
      <div className={`icon-pack-surface aether-theme-${activeAetherTheme()} aether-${palette}-theme`} data-palette={palette} data-aether-theme={palette}>
        <ToolIconTheme pack={themePack} palette={palette}>
          <div className="icon-pack-grid">
            {names.map((name) => (
              <div className="icon-pack-cell" key={name}>
                {pack === "freecad-graphite" ? <FreeCADIcon name={name as FreeCADToolIconName} palette={palette} /> : <ToolIcon name={name as ToolIconName} />}
                <span>{name}</span>
              </div>
            ))}
          </div>
        </ToolIconTheme>
      </div>
      {pack === "freecad-graphite" && (
        <details className="icon-pack-more">
          <summary>Every FreeCAD Graphite icon, by workbench — the attributed source set behind the tool names above</summary>
          <FreeCADIconPack />
        </details>
      )}
    </div>
  );
}
