import { Avatar, DashboardTable, StatusBadge, type DataTableSort } from "../../src";
import { COUNTRIES, type AnalyticsUser } from "./data";

/** App-specific column projection; shared table owns layout, sorting and selection. */
export function AnalyticsUsers({ rows, selected, onSelect, sort, onSort, onOpen }: { rows: readonly AnalyticsUser[]; selected: readonly string[]; onSelect: (ids: readonly string[]) => void; sort: DataTableSort | null; onSort: (sort: DataTableSort | null) => void; onOpen: (id: string) => void }) {
  return <DashboardTable<AnalyticsUser> density="compact" ariaLabel="Users" rows={rows} rowID={row => row.id} selectedIDs={new Set(selected)} onSelect={onSelect} sort={sort} onSortChange={onSort} rowHeight={40} onActivate={onOpen} columns={[
    { id: "name", header: "Name", width: 190, sortable: true, sortValue: row => row.name, cell: row => <span className="analytics-inline"><Avatar name={row.name} size="small"/>{row.name}</span> },
    { id: "username", header: "Username", width: 160, sortable: true, sortValue: row => row.username, cell: row => row.username },
    { id: "email", header: "Email", width: 220, cell: row => row.email },
    { id: "country", header: "Country", width: 140, sortable: true, sortValue: row => row.country, cell: row => { const country = COUNTRIES.find(item => item.id === row.country); return <span className="analytics-inline"><img width="14" height="14" src={country?.flag} alt=""/>{country?.name}</span>; } },
    { id: "status", header: "Status", width: 100, sortable: true, sortValue: row => row.status, cell: row => <StatusBadge tone={row.status === "Active" ? "positive" : "neutral"}>{row.status}</StatusBadge> },
    { id: "plan", header: "Plan type", width: 145, sortable: true, sortValue: row => row.plan, cell: row => row.plan },
  ]} emptyState={<p className="aui-dashboard-empty">No users match these filters.</p>}/>;
}
