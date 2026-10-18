import { AetherIcon } from "../../src/AetherIcon";
import type { ChartSeries, ComparisonPoint, DashboardNavItem, RankedListItem } from "../../src";
import sg from "@aether/assets/illustrations/dashboard/sg.svg";
import eg from "@aether/assets/illustrations/dashboard/eg.svg";
import us from "@aether/assets/illustrations/dashboard/us.svg";
import fr from "@aether/assets/illustrations/dashboard/fr.svg";
import nl from "@aether/assets/illustrations/dashboard/nl.svg";

export const SERIES: readonly ChartSeries[] = [{ id: "trial", label: "Trial", color: "var(--aether-color-accent)" }, { id: "demo", label: "Demo", color: "var(--aether-color-warn)" }];
export const LEAD_SERIES = SERIES.map((item, index) => ({ ...item, label: index ? "Expected" : "Real data" }));
export const PERIODS = [{ value: "current", label: "Aug 1 – Aug 11", start: 1, month: "Aug", factor: 1 }, { value: "previous", label: "Jul 21 – Jul 31", start: 21, month: "Jul", factor: .82 }, { value: "next", label: "Aug 12 – Aug 22", start: 12, month: "Aug", factor: 1.16 }];
export const NAV: readonly DashboardNavItem[] = [{ id: "dashboard", label: "Dashboard", icon: <AetherIcon name="dashboard"/> }, { id: "traffic", label: "Acquisition", icon: <AetherIcon name="tray"/> }, { id: "users", label: "Customers", icon: <AetherIcon name="people"/> }, { id: "plans", label: "Subscriptions", icon: <AetherIcon name="credit-card"/> }, { id: "reports", label: "Reports", icon: <AetherIcon name="document-download"/> }];
export const COUNTRIES = [{ id: "sg", name: "Singapore", flag: sg, count: 4.7 }, { id: "eg", name: "Egypt", flag: eg, count: 3.9 }, { id: "us", name: "United States", flag: us, count: 2.8 }, { id: "fr", name: "France", flag: fr, count: 2.5 }, { id: "nl", name: "Netherlands", flag: nl, count: 1.7 }];
export const SOURCES = [{ id: "twitter", label: "Twitter", mark: "t", count: 3.9 }, { id: "instagram", label: "Instagram", mark: "◎", count: 3.3 }, { id: "linkedin", label: "LinkedIn", mark: "in", count: 2.8 }, { id: "producthunt", label: "Product Hunt", mark: "P", count: 2.5 }, { id: "google", label: "Google", mark: "G", count: 1.9 }];
export function trendData(period: string): ComparisonPoint[] {
  const selected = PERIODS.find(item => item.value === period) ?? PERIODS[0];
  const trial = [900, 3100, 2850, 2400, 2350, 2050, 1780, 1850, 1900, 2010, 2180, 2350, 2850, 2400, 2310, 1940, 1670, 1450, 1270, 1540, 1320, 1980, 1460, 1230, 1050, 840, 630, 800, 1020, 1190, 1550, 1290, 1640, 1750];
  return trial.map((value, index) => ({ id: `t${index}`, label: `${selected.month} ${selected.start + Math.min(10, Math.floor(index / 3.1))}`, values: { trial: Math.round(value * selected.factor), demo: Math.round((1400 + Math.sin(index * 1.6) * 300 + (index < 15 ? 300 : -350)) * selected.factor) } }));
}
export function leadData(period: string): ComparisonPoint[] {
  const selected = PERIODS.find(item => item.value === period) ?? PERIODS[0];
  return [420, 130, 390, 490, 420, 140, 460, 220, 500, 135, 60].map((value, index) => ({ id: `l${index}`, label: `${selected.month} ${selected.start + index}`, values: { trial: Math.round(value * selected.factor), demo: Math.round([260, 300, 420, 380, 260, 540, 280, 270, 310, 315, 275][index] * selected.factor) } }));
}
export function countryItems(factor = 1): RankedListItem[] { return COUNTRIES.map(item => ({ id: item.id, label: item.name, value: `${(item.count * factor).toFixed(1)}M`, icon: <img src={item.flag} alt=""/> })); }
export function sourceItems(factor = 1): RankedListItem[] { return SOURCES.map(item => ({ id: item.id, label: item.label, value: `${(item.count * factor).toFixed(1)}M`, icon: <span aria-hidden>{item.mark}</span> })); }
export interface AnalyticsUser { id: string; name: string; username: string; email: string; country: string; status: "Active" | "Inactive"; plan: "Business Plan" | "Pro Plan" | "Free Plan"; period: string; }
const NAMES = ["Mahdi Mohammed", "Sarah Molatio", "Alex Morgan", "James Thomas", "Sophia Taylor", "Noah Bernard", "Mila de Vries", "Omar Hassan"];
export const USERS: AnalyticsUser[] = PERIODS.flatMap((period, p) => NAMES.map((name, index) => ({ id: `${period.value}-${index}`, name, username: name.toLowerCase().replace(/\s+/g, "_"), email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`, country: COUNTRIES[index < 2 ? 0 : (index + p) % 5].id, status: index === 4 || index === 7 ? "Inactive" : "Active", plan: index % 3 === 0 ? "Business Plan" : index % 3 === 1 ? "Pro Plan" : "Free Plan", period: period.value })));
