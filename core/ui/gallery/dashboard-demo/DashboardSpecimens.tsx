import { useState } from "react";
import { AetherIcon } from "../../src/AetherIcon";
import { ActivityList, DashboardCard, GoalProgress, MetricCard } from "../../src/DashboardCards";
import { DashboardBarChart, DashboardLineChart } from "../../src/DashboardCharts";
import { HOURLY, INITIAL_ACTIVITY, WEEK, money } from "./data";
/** The same components as the concept app, added to the main widget catalogue. */
export function DashboardSpecimens() {
  const [hour, setHour] = useState("h4"), [day, setDay] = useState("d3");
  return <>
    <div className="gallery-variant" style={{ width: 290 }}><small>MetricCard · headline and change</small><MetricCard label="Total Revenue" value="$149,824" change="+18.4%" trend="positive" detail="vs last 30 days" icon={<AetherIcon name="monitor"/>}/></div>
    <div className="gallery-variant" style={{ width: 290 }}><small>GoalProgress · value against target</small><GoalProgress label="Monthly Revenue" value={149824} target={200000} format={money}/></div>
    <div className="gallery-variant" style={{ width: 400 }}><small>DashboardCard + ActivityList</small><DashboardCard title="Live Activity"><ActivityList items={INITIAL_ACTIVITY.slice(0, 3)}/></DashboardCard></div>
    <div className="gallery-variant" style={{ width: 380 }}><small>DashboardLineChart · hover, focus and select</small><DashboardLineChart label="Sample hourly revenue" data={HOURLY} selectedID={hour} onSelect={setHour} maximum={6000} formatValue={money}/></div>
    <div className="gallery-variant" style={{ width: 520 }}><small>DashboardBarChart · selectable categories</small><DashboardBarChart label="Sample weekly revenue" data={WEEK} selectedID={day} onSelect={setDay} formatValue={money}/></div>
  </>;
}
