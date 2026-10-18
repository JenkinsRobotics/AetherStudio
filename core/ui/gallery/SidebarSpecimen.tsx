import { useState, type CSSProperties } from "react";
import { AetherIcon, SelectField, TabbedSidebar } from "../src/index";
import { SidebarProperties } from "./TabbedSidebarDemo";
import { useSidebarWidgetPanels } from "./SidebarWidgetPanels";
import "./WorkspaceDemos.css";

/** The sidebar itself, without a canvas, shell or demonstration frame. */
export function SidebarSpecimen({ attachment, variant = "standard" }: { attachment: "attached" | "detached"; variant?: "standard" | "slim" }) {
  const [active, setActive] = useState<string | null>("properties");
  const [edge, setEdge] = useState<"top" | "bottom" | "left" | "right">("top");
  const widgets = useSidebarWidgetPanels();
  const panels = [
    { id: "properties", title: "Properties", icon: <AetherIcon name="settings" />, content: <SidebarProperties /> },
    ...widgets.panels,
  ];
  const slim = variant === "slim";
  const label = slim ? "Slim sidebar" : `${attachment === "attached" ? "Attached" : "Detached"} sidebar`;
  return <div className="sidebar-specimen" data-variant={variant} role="region" aria-label={`${label} specimen`}>
    <label className="sidebar-specimen-option">Tab edge
      <SelectField aria-label={`${label} tab edge`} value={edge} onChange={event => setEdge(event.target.value as typeof edge)}
        options={(slim ? ["top", "bottom"] : ["top", "bottom", "left", "right"]).map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} />
    </label>
    <div className="sidebar-specimen-stage">
      <TabbedSidebar ariaLabel={label} attachment={attachment} variant={variant} floating heightPolicy={slim ? "fill" : "content"} tabPosition={edge} anchor={edge}
        tabs={panels.map(panel => ({ id: panel.id, label: panel.title, icon: panel.icon }))}
        activeTab={active} onTabChange={setActive} expanded
        style={slim ? undefined : { "--aui-sidebar-expanded-width": "min(360px, 100%)", height: "auto" } as CSSProperties}>
        {panels.map(panel => <div key={panel.id} hidden={panel.id !== active} className="sidebar-specimen-content">{panel.content}</div>)}
      </TabbedSidebar>
    </div>
  </div>;
}
