import { useState } from "react";
import { FreeCADIcon, freecadIconCatalog } from "../src/FreeCADIcon";
import { activeAetherTheme } from "../src/StudioChrome";
import creditsUrl from "@aether/assets/icon-packs/freecad-graphite/ATTRIBUTION.md?url&no-inline";
import sourcesUrl from "@aether/assets/icon-packs/freecad-graphite/sources.zip?url&no-inline";
import "./FreeCADIconPack.css";

const workbenches = [...new Set(freecadIconCatalog.map(icon => icon.workbench))];
const workbenchLabel = (name: string) => name === "Aether" ? "Aether additions" : name === "Fem" ? "FEM" : name === "PartDesign" ? "Part Design" : name;
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
const pageSize = 96;

export function FreeCADIconPack() {
  const [query, setQuery] = useState("");
  const [workbench, setWorkbench] = useState("All");
  const [page, setPage] = useState(0);
  const matches = freecadIconCatalog.filter(icon => (workbench === "All" || icon.workbench === workbench)
    && [icon.name, ...icon.toolNames].some(name => normalize(name).includes(normalize(query))));
  const visible = matches.slice(page * pageSize, (page + 1) * pageSize);
  const pages = Math.ceil(matches.length / pageSize);
  return <div className="freecad-pack">
    <p>FreeCAD tool artwork adapted to graphite, silver, and blue. Light and dark editions, including coverage of all 123 Aether illustrated tools. Find the 24 new designs under Aether additions. <a href={creditsUrl} target="_blank" rel="noreferrer">Credits and licenses</a> · <a href={sourcesUrl} download="freecad-graphite-sources.zip">Download editable sources</a></p>
    <div className="freecad-pack-filters">
      <label>Workbench <select value={workbench} onChange={event => { setWorkbench(event.target.value); setPage(0); }}>
        {["All", ...workbenches].map(value => <option key={value} value={value}>{workbenchLabel(value)}</option>)}
      </select></label>
      <label>Find an icon <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Pad, fillet, constraint…" /></label>
      <span role="status">{matches.length} of {freecadIconCatalog.length} icons</span>
    </div>
    {pages > 1 && <nav className="freecad-pack-pagination" aria-label="FreeCAD icon pages">
      <button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page + 1} of {pages}</span>
      <button disabled={page + 1 === pages} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
    <div className="freecad-pack-palettes">
      {(["dark", "light"] as const).map(palette => <div className={`freecad-pack-palette aether-theme-${activeAetherTheme()} aether-${palette}-theme`} key={palette} data-aether-theme={palette}>
        <h4>{palette === "dark" ? "Dark" : "Light"} palette</h4>
        {matches.length === 0 && <p>No matching icons.</p>}
        {workbenches.map(group => {
          const icons = visible.filter(icon => icon.workbench === group);
          return icons.length > 0 && <div key={group}>
            <h5>{workbenchLabel(group)} <span>({icons.length})</span></h5>
            <div className="freecad-pack-grid">{icons.map(icon => <div className="freecad-pack-cell" key={icon.id} title={icon.name}>
              <FreeCADIcon name={icon.id} palette={palette} />
              <span>{icon.id === "TechDraw/none" ? "None (no decoration)" : icon.name.replace(/^(PartDesign|Part|Sketcher|Assembly)_/, "").replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
            </div>)}</div>
          </div>;
        })}
      </div>)}
    </div>
  </div>;
}
