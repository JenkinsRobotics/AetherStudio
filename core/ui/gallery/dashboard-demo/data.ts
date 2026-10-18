import type { DashboardActivity } from "../../src/DashboardCards";
export const money = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
export const price = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export interface Order { id: string; customer: string; initials: string; status: "Fulfilled" | "Processing" | "Pending"; payment: string; total: number; store: "online" | "retail"; }
export const INITIAL_ORDERS: Order[] = [
  { id: "NX-28491", customer: "Ethan Brooks", initials: "EB", status: "Fulfilled", payment: "Paid", total: 248.90, store: "online" },
  { id: "NX-28490", customer: "Sophia Turner", initials: "ST", status: "Processing", payment: "Paid", total: 89.50, store: "retail" },
  { id: "NX-28489", customer: "Liam Carter", initials: "LC", status: "Pending", payment: "Pending", total: 512.75, store: "online" },
  { id: "NX-28488", customer: "Yuki Tanaka", initials: "YT", status: "Fulfilled", payment: "Paid", total: 348, store: "online" },
  { id: "NX-28487", customer: "Olivia Chen", initials: "OC", status: "Processing", payment: "Paid", total: 165.20, store: "retail" },
  { id: "NX-28486", customer: "Noah Williams", initials: "NW", status: "Fulfilled", payment: "Paid", total: 124, store: "online" },
];
export const INITIAL_ACTIVITY: DashboardActivity[] = [
  { id: "order", text: "New order #ORD–9841 — $348", time: "4m ago", tone: "warning" },
  { id: "review", text: "5★ review on Merino Wool Jacket", time: "12m ago", tone: "positive" },
  { id: "refund", text: "Refund approved — #ORD–9838", time: "1h ago", tone: "negative" },
  { id: "stock", text: "Chelsea Boots stock below threshold", time: "2h ago", tone: "warning" },
  { id: "customer", text: "New customer registered — Yuki Tanaka", time: "3h ago", tone: "accent" },
];
export const HOURLY = [0, 480, 1600, 2850, 3847, 3310, 4080, 5120, 3830, 4330, 1830].map((value, i) => ({ id: `h${i}`, label: i < 4 ? `${8 + i}am` : i === 4 ? "12pm" : `${i - 4}pm`, value }));
export const WEEK = [12400, 18700, 15200, 23500, 31800, 28400, 19824].map((value, i) => ({ id: `d${i}`, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], value }));
export const PRODUCTS = [
  { id: "SKU-1001", name: "Merino Wool Jacket", category: "Outerwear", stock: 128, price: 248.90 },
  { id: "SKU-1002", name: "Chelsea Boots", category: "Footwear", stock: 8, price: 165.20 },
  { id: "SKU-1003", name: "Everyday Canvas Tote", category: "Accessories", stock: 342, price: 89.50 },
  { id: "SKU-1004", name: "Cashmere Crewneck", category: "Knitwear", stock: 64, price: 124 },
];
export const NAV = [
  { label: "Command", items: [{ id: "overview", label: "Overview", icon: "dashboard" }, { id: "live", label: "Live Monitor", icon: "monitor" }, { id: "alerts", label: "Alerts", icon: "bell" }] },
  { label: "Commerce", items: [{ id: "orders", label: "Order Queue", icon: "shopping-bag" }, { id: "catalog", label: "Catalog", icon: "copy" }, { id: "pricing", label: "Pricing Engine", icon: "price-tag" }, { id: "customers", label: "Customers", icon: "people" }, { id: "reviews", label: "Reviews", icon: "star" }] },
  { label: "Finance", items: [{ id: "revenue", label: "Revenue Desk", icon: "chart-bars" }, { id: "payouts", label: "Payouts", icon: "credit-card" }, { id: "tax", label: "Tax Engine", icon: "home" }] },
  { label: "Platform", items: [{ id: "marketplace", label: "Marketplace", icon: "storefront" }, { id: "pos", label: "POS", icon: "pencil" }, { id: "social", label: "Social Channels", icon: "camera" }, { id: "settings", label: "Settings", icon: "settings" }] },
];
