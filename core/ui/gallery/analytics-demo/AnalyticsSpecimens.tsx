import { useState } from "react";
import { AetherIcon, AppIcon, AppNavigationBar, Avatar, Button, Dialog, IconButton, ChartLegend, ComparisonChart, DashboardCard, DashboardNavigation, GaugeChart, RankedList, StatusBadge, type DataTableSort } from "../../src";
import { AnalyticsUsers } from "./AnalyticsUsers";
import { LEAD_SERIES, NAV, SERIES, USERS, countryItems, leadData, trendData } from "./data";
import "./analytics-demo.css";

export function AnalyticsSpecimens() {
  const [point, setPoint] = useState("t21"), [lead, setLead] = useState<string>(), [country, setCountry] = useState<string>();
  const [selected, setSelected] = useState<readonly string[]>([]), [sort, setSort] = useState<DataTableSort | null>(null);
  return <div className="analytics-specimens">
    <div className="analytics-specimen"><p>ComparisonChart · line series, toggles and keyboard inspection</p><DashboardCard density="compact" title="Trials vs demo request" caption="Aug 1 – Aug 11"><ComparisonChart label="Sample trials" data={trendData("current")} series={SERIES} selectedID={point} onSelect={setPoint}/></DashboardCard></div>
    <div className="analytics-specimen"><p>ComparisonChart · grouped bars</p><DashboardCard density="compact" title="Number of leads" caption="Aug 1 – Aug 11"><ComparisonChart label="Sample leads" kind="bar" data={leadData("current")} series={LEAD_SERIES} selectedID={lead} onSelect={setLead}/></DashboardCard></div>
    <div className="analytics-specimen"><p>GaugeChart · bounded target with independent metric label</p><DashboardCard density="compact" title="Conversion rate" caption="Aug 1 – Aug 11"><StatusBadge tone="positive">↑ 47%</StatusBadge><GaugeChart label="Conversion rate" value="15.4%" detail="20% target" fraction={.77}/></DashboardCard></div>
    <div className="analytics-specimen"><p>RankedList · selectable metric rows</p><DashboardCard density="compact" title="Top country visitor" caption="Aug 1 – Aug 11"><RankedList label="Sample ranked countries" items={countryItems()} selectedID={country} onSelect={setCountry}/></DashboardCard></div>
    <div className="analytics-specimen" style={{ gridColumn: "1 / -1", maxWidth: "100%" }}><p>DashboardTable · compact density, sorting and selection</p><DashboardCard density="compact" title="Users"><AnalyticsUsers rows={USERS.slice(0, 3)} selected={selected} onSelect={setSelected} sort={sort} onSort={setSort} onOpen={id => setSelected([id])}/></DashboardCard></div>
  </div>;
}
export function ChartLegendSpecimen() {
  const [hidden, setHidden] = useState<string[]>([]);
  return <ChartLegend series={SERIES} hidden={hidden} onToggle={id => setHidden(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])}/>;
}
export function StatusBadgeSpecimen() { return <div className="analytics-actions"><StatusBadge tone="positive">Active</StatusBadge><StatusBadge tone="positive">↑ 12%</StatusBadge><StatusBadge tone="negative">↓ 8%</StatusBadge><StatusBadge tone="warning">Pending</StatusBadge><StatusBadge>Inactive</StatusBadge></div>; }
export function DashboardNavigationSpecimen() {
  const [active, setActive] = useState("dashboard");
  return <div style={{ display: "flex", height: 450 }}><DashboardNavigation id="analytics-navigation-specimen" brand="Aether Analytics" mark={<AppIcon app="ui" size={24}/>} items={NAV} activeID={active} onNavigate={setActive}/></div>;
}

export function AppNavigationBarSpecimen() {
  const [active, setActive] = useState("dashboard"), [dialog, setDialog] = useState<string | null>(null);
  return <div style={{ width: "100%", minWidth: 0 }}>
    <AppNavigationBar brand="Aether Analytics" mark={<AppIcon app="ui" size={24}/>} items={NAV} activeID={active} onNavigate={setActive} onHome={() => setActive("dashboard")}
      actions={<><IconButton appearance="glyph" label="Search" onClick={() => setDialog("Search")}><AetherIcon name="search"/></IconButton><IconButton appearance="glyph" label="Notifications" onClick={() => setDialog("Notifications")}><AetherIcon name="bell"/></IconButton><Button primary onClick={() => setDialog("Share")}><AetherIcon name="link"/>Share</Button><IconButton appearance="glyph" label="Profile" onClick={() => setDialog("Profile")}><Avatar name="Alex Morgan" size="small"/></IconButton></>}/>
    <p role="status" className="analytics-footnote">{NAV.find(item => item.id === active)?.label} selected</p>
    <Dialog open={!!dialog} title={dialog ?? "Details"} onClose={() => setDialog(null)} actions={<Button onClick={() => setDialog(null)}>Done</Button>}>
      {dialog === "Share" ? "Sharing controls appear here when this header is connected to a document." : dialog === "Notifications" ? "Your latest report is ready." : dialog === "Profile" ? "Alex Morgan · Analytics administrator" : "Apps connect this action to their own search."}
    </Dialog>
  </div>;
}
