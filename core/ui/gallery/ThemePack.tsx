import { useEffect, useState } from "react";
import {
  Button, SegmentedControl, Tabs, TextField, activeAetherTheme, activeAetherViewportTheme, aetherThemes, aetherViewportThemes, setAetherTheme, setAetherViewportTheme,
  type ResolvedTheme,
} from "../src";
import "./ThemePack.css";

function useActiveThemes() {
  const [theme, setTheme] = useState(activeAetherTheme);
  const [viewport, setViewport] = useState(activeAetherViewportTheme);
  useEffect(() => {
    const follow = () => { setTheme(activeAetherTheme()); setViewport(activeAetherViewportTheme()); };
    document.addEventListener("aether-theme", follow);
    return () => document.removeEventListener("aether-theme", follow);
  }, []);
  return { theme, viewport };
}

/** A theme drawn with its own tokens: the scoped class carries the palette, the mode class forces dark or light. */
function ThemeTile({ theme, mode, active, onSelect }: { theme: ResolvedTheme; mode: "dark" | "light"; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`theme-tile aether-theme-${theme.id} aether-${mode}-theme`} data-active={active || undefined} onClick={onSelect} title={theme.description}>
      <span className="theme-tile-bar"><i /><i /><i /></span>
      <span className="theme-tile-body">
        <span className="theme-tile-rail" />
        <span className="theme-tile-panel"><b /><em /><em /></span>
      </span>
      <span className="theme-tile-name">{theme.name}<small>{mode}</small></span>
    </button>
  );
}

/** A viewport theme drawn as a stage: gradient, grid, a part and a sketch line. */
function ViewportTile({ theme, active, onSelect }: { theme: ResolvedTheme | null; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`viewport-tile ${theme ? `aether-viewport-${theme.id}` : ""}`} data-active={active || undefined} onClick={onSelect} title={theme?.description ?? "The interface theme's own viewport look"}>
      <span className="viewport-tile-stage"><span className="viewport-tile-part" /><span className="viewport-tile-sketch" /></span>
      <span className="theme-tile-name">{theme?.name ?? "Theme default"}</span>
    </button>
  );
}

const GROUPS: readonly { id: keyof ResolvedTheme | "viewport"; label: string }[] = [
  { id: "modes", label: "Colour" }, { id: "viewport", label: "Viewport" }, { id: "geometry", label: "Geometry" }, { id: "font", label: "Type" }, { id: "effects", label: "Effects" },
];

/** Every token of the active theme, by category, with a swatch per mode where the value is a colour. */
function TokenTable({ theme }: { theme: ResolvedTheme }) {
  const [group, setGroup] = useState<string>("modes");
  const rows: { name: string; dark: string; light?: string }[] =
    group === "modes" ? Object.keys(theme.modes.dark).filter((n) => !n.startsWith("viewport-")).map((n) => ({ name: n, dark: theme.modes.dark[n], light: theme.modes.light[n] }))
    : group === "viewport" ? Object.keys(theme.modes.dark).filter((n) => n.startsWith("viewport-")).map((n) => ({ name: n, dark: theme.modes.dark[n], light: theme.modes.light[n] }))
    : Object.entries(theme[group as "geometry" | "font" | "effects"]).map(([name, dark]) => ({ name, dark }));
  const swatch = (value: string) => /^(#|rgb|hsl)/.test(value) ? <i className="token-swatch" style={{ background: value }} /> : null;
  return (
    <div className="token-table">
      <SegmentedControl ariaLabel="Token category" options={GROUPS.map((g) => ({ id: g.id, label: g.label }))} value={group} onChange={setGroup} />
      <table>
        <thead><tr><th>Token</th><th>{rows[0]?.light !== undefined ? "Dark" : "Value"}</th>{rows[0]?.light !== undefined && <th>Light</th>}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td><code>--aether-{row.name}</code></td>
              <td>{swatch(row.dark)}<span>{row.dark}</span></td>
              {row.light !== undefined && <td>{swatch(row.light)}<span>{row.light}</span></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The same shared widgets once per theme: what "one engine" buys — every column is the same CSS reading different data. */
function ThemeLab({ mode }: { mode: "dark" | "light" }) {
  return (
    <div className="theme-lab">
      {aetherThemes.map((theme) => (
        <div key={theme.id} className={`theme-lab-column aether-theme-${theme.id} aether-${mode}-theme`}>
          <strong>{theme.name}</strong>
          <Tabs tabs={[{ id: "a", label: "Design" }, { id: "b", label: "Animate" }]} activeID="a" onSelect={() => {}} />
          <div className="theme-lab-row"><Button primary>Create</Button><Button>Cancel</Button></div>
          <TextField placeholder="Search parts" defaultValue="" />
          <div className="theme-lab-panel"><span>Head Pan</span><em>revolute</em></div>
        </div>
      ))}
    </div>
  );
}

/** The theme pack section: pick a theme or a viewport theme, read its tokens, and compare the widgets across the pack. */
export function ThemePackBrowser() {
  const { theme, viewport } = useActiveThemes();
  const [labMode, setLabMode] = useState<"dark" | "light">("dark");
  const active = aetherThemes.find((t) => t.id === theme) ?? aetherThemes[0];
  return (
    <div className="theme-pack">
      <p>A theme is one manifest in core/assets/themes: both colour modes, geometry, type, effects and the viewport look. Every widget reads only these tokens, so choosing a theme here restyles this page, and a product on its next build. A viewport theme changes the stage alone.</p>
      <div className="theme-pack-group"><h4>Interface themes</h4>
        <div className="theme-tiles">{aetherThemes.flatMap((t) => (["dark", "light"] as const).map((mode) => <ThemeTile key={`${t.id}-${mode}`} theme={t} mode={mode} active={t.id === theme} onSelect={() => setAetherTheme(t.id)} />))}</div>
      </div>
      <div className="theme-pack-group"><h4>Viewport themes</h4>
        <div className="theme-tiles">
          <ViewportTile theme={null} active={!viewport} onSelect={() => setAetherViewportTheme(null)} />
          {aetherViewportThemes.map((v) => <ViewportTile key={v.id} theme={v} active={v.id === viewport} onSelect={() => setAetherViewportTheme(v.id)} />)}
        </div>
      </div>
      <div className="theme-pack-group"><h4>Tokens of {active.name}</h4><TokenTable theme={active} /></div>
      <div className="theme-pack-group">
        <div className="theme-pack-head"><h4>The shared widgets across the pack</h4><SegmentedControl ariaLabel="Lab mode" options={[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }]} value={labMode} onChange={(id) => setLabMode(id as "dark" | "light")} /></div>
        <ThemeLab mode={labMode} />
      </div>
    </div>
  );
}
