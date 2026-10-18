import { ToolIcon, type ToolIconName } from "@aether/ui";

/** Decorative editorial compositions, not interactive product controls. */
export function CADUpdateArtwork({ scene, icon }: { scene: string; icon: ToolIconName }) {
  if (scene === "appearance" || scene === "materials") return <div className={`cad-news-scene cad-news-scene--${scene}`}>
    <div className="cad-news-sphere" /><div className="cad-news-sphere cad-news-sphere--small" />
    <div className="cad-news-swatches"><i /><i /><i /><i /></div>
  </div>;
  if (scene === "inspectors") return <div className="cad-news-scene cad-news-scene--inspectors">
    <div className="cad-news-mini-panel"><ToolIcon name={icon} /><b /><span /><span /><span /><div><i /><i /><i /></div></div>
  </div>;
  return <div className={`cad-news-scene cad-news-scene--${scene}`}>
    <div className="cad-news-drafting-grid" />
    <ToolIcon className="cad-news-model" name={icon} />
    {scene === "tabs" ? <div className="cad-news-mini-tabs"><span>Part</span><span>Assembly</span></div> : null}
    {scene === "variants" ? <><ToolIcon className="cad-news-variant cad-news-variant--one" name={icon} /><ToolIcon className="cad-news-variant cad-news-variant--two" name={icon} /></> : null}
    {scene === "views" ? <><div className="cad-news-orbit" /><span className="cad-news-view-label">FRONT / 01</span></> : null}
  </div>;
}
