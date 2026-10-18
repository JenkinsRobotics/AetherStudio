import type { ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { CollapsibleSidebar, SidebarLabel, SidebarToggle } from "./CollapsibleSidebar";
import "./DashboardShell.css";
import {SidebarRow} from "./ApplicationSidebar";
export interface DashboardNavigationGroup { label: string; items: readonly { id: string; label: string; icon: ReactNode }[]; }
/** Business-app template. Collapsing navigation, page header, and a scrolling content canvas. */
export function DashboardShell({ id, brand, subtitle, mark, navigation, activeID, onNavigate, search, profile, breadcrumb, title, actions, children }: {
  id: string; brand: string; subtitle: string; mark: ReactNode; navigation: readonly DashboardNavigationGroup[]; activeID: string; onNavigate: (id: string) => void;
  search?: ReactNode; profile?: ReactNode; breadcrumb: ReactNode; title: string; actions?: ReactNode; children: ReactNode;
}) {
  return <div className="aui-dashboard-stage"><div className="aui-dashboard-shell">
    <CollapsibleSidebar id={id} ariaLabel="Dashboard navigation" className="aui-dashboard-sidebar aui-application-sidebar" toggle="custom" footer={<><SidebarLabel>{profile}</SidebarLabel><SidebarToggle/></>}>
      <div className="aui-dashboard-brand"><span className="aui-dashboard-brand__mark">{mark}</span><SidebarLabel><strong>{brand}</strong><small>{subtitle}</small></SidebarLabel></div>
      <div className="aui-dashboard-sidebar__search"><SidebarLabel>{search}</SidebarLabel></div>
      <nav>{navigation.map(group => <div className="aui-dashboard-nav-group" key={group.label}><SidebarLabel><h2>{group.label}</h2></SidebarLabel>
        {group.items.map(item => <SidebarRow key={item.id} item={{...item,current:item.id === activeID,onSelect:()=>onNavigate(item.id)}}/>)}
      </div>)}</nav>
    </CollapsibleSidebar>
    <main className="aui-dashboard-main"><header className="aui-dashboard-page-header"><div><div className="aui-dashboard-breadcrumb"><AetherIcon name="dashboard"/>{breadcrumb}</div><h1>{title}</h1></div><div className="aui-dashboard-page-actions">{actions}</div></header>
      <div className="aui-dashboard-content">{children}</div>
    </main>
  </div></div>;
}
