import type { ReactNode } from "react";
import { CollapsibleSidebar, SidebarLabel, SidebarToggle } from "./CollapsibleSidebar";
import { SidebarRow } from "./ApplicationSidebar";
import "./DashboardNavigation.css";

export interface DashboardNavItem { id: string; label: string; icon: ReactNode; }
/** The standard collapsible sidebar in a compact dashboard rail configuration. */
export function DashboardNavigation({ id, brand, mark, items, activeID, onNavigate, secondary, footer }: {
  id: string; brand: string; mark: ReactNode; items: readonly DashboardNavItem[]; activeID: string; onNavigate: (id: string) => void; secondary?: ReactNode; footer?: ReactNode;
}) {
  return <CollapsibleSidebar id={id} ariaLabel={`${brand} navigation`} className="aui-dashboard-navigation aui-application-sidebar aui-application-sidebar--tint" defaultCollapsed toggle="custom" footer={footer}>
    <SidebarToggle className="aui-dashboard-navigation__brand">{mark}<SidebarLabel>{brand}</SidebarLabel></SidebarToggle>
    <nav aria-label={brand}>{items.map(item => <SidebarRow key={item.id} item={{ ...item, current: activeID === item.id, onSelect: () => onNavigate(item.id) }}/>)}</nav>
    {secondary && <div className="aui-dashboard-navigation__secondary">{secondary}</div>}
  </CollapsibleSidebar>;
}
