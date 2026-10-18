import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SegmentedControl } from "./SegmentedControl";
import "./ConceptWidgets.css";
import "./MaterialBrowser.css";

export interface MaterialOption { id: string; name: string; category: string; color: string; finish?: string; }
export interface MaterialEnvironmentOption { id: string; name: string; color: string; secondaryColor?: string; transparent?: boolean; }
export interface MaterialBrowserProps {
  materials: readonly MaterialOption[]; selectedID?: string; onSelect?: (id: string) => void;
  usedIDs?: readonly string[]; assignmentLabel?: string;
  environments?: readonly MaterialEnvironmentOption[]; environmentID?: string;
  onEnvironmentSelect?: (id: string) => void; environmentControls?: ReactNode;
  initialTab?: "material" | "environment";
  /** Embed only the material library when the host supplies its own navigation. */
  showTabs?: boolean;
}
/** Presentation-only library: callers own material assignment and renderer settings. */
export function MaterialBrowser({ materials, selectedID, onSelect, usedIDs = [], assignmentLabel,
  environments = [], environmentID, onEnvironmentSelect, environmentControls, initialTab = "material", showTabs = true }: MaterialBrowserProps) {
  const [selectedTab, setTab] = useState(initialTab);
  const tab = showTabs ? selectedTab : "material";
  const [query, setQuery] = useState("");
  const shown = useMemo(() => materials.filter(item =>
    [item.name,item.category,item.finish,item.color].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [materials, query]);
  const groups = [...new Set(shown.map(item => item.category))];
  const used = materials.filter(item => usedIDs.includes(item.id));
  const sphere = (material: MaterialOption) => <span className="aui-material-browser__sphere" style={{ "--material-color": material.color } as CSSProperties}/>;
  return <section className="aui-material-browser" aria-label="Material browser">
    {showTabs && <SegmentedControl ariaLabel="Visualization" value={tab} onChange={id => setTab(id as typeof tab)} options={[{id:"material",label:"Material"},{id:"environment",label:"Environment"}]}/>}
    {tab === "material" ? <>
      <input className="aui-material-browser__search" aria-label="Search materials" placeholder="Search Materials" value={query} onChange={event=>setQuery(event.target.value)}/>
      {assignmentLabel && <p className="aui-material-browser__assignment">Applying to {assignmentLabel}</p>}
      {!query && used.length > 0 && <section className="aui-material-browser__used"><h4>Used Materials ({used.length})</h4>{used.map(material =>
        <button key={material.id} type="button" aria-pressed={selectedID === material.id} onClick={() => onSelect?.(material.id)}>{sphere(material)}<span><small>{material.finish}</small><strong>{material.name}</strong><small>{material.color}</small></span></button>)}</section>}
      {groups.map(group => <section key={group}><h4>{group}</h4><div className="aui-material-browser__grid">{shown.filter(item => item.category === group).map(material =>
        <button className="aui-material-browser__item" type="button" key={material.id} aria-pressed={selectedID === material.id} onClick={() => onSelect?.(material.id)}>{sphere(material)}<span>{material.finish}</span><strong>{material.name}</strong></button>)}</div></section>)}
      {!shown.length && <p role="status">No matching materials.</p>}
    </> : <div className="aui-material-browser__environments">
      {environments.map(environment => <button key={environment.id} type="button" aria-pressed={environmentID === environment.id} onClick={() => onEnvironmentSelect?.(environment.id)}>
        <span className={environment.transparent ? "is-transparent" : undefined} style={{background:environment.transparent ? undefined : `linear-gradient(135deg, ${environment.color}, ${environment.secondaryColor ?? environment.color})`}}/><strong>{environment.name}</strong>
      </button>)}
      {environmentControls}
      {!environments.length && !environmentControls && <p role="status">No environments supplied.</p>}
    </div>}
  </section>;
}
