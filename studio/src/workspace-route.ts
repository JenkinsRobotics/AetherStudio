export type StudioArea = "personal" | "admin";
export type StudioRoute = { area: StudioArea; page: string };

export const personalPages = ["home", "apps", "plugins", "account"];
export const adminPages = ["overview", "organizations", "server", "apps", "plugins", "users", "email", "teams", "access", "services", "backups", "themes", "network", "activity"];

export function readStudioRoute(search = location.search): StudioRoute {
  const params = new URLSearchParams(search);
  const area = params.get("workspace") === "admin" ? "admin" : "personal";
  const requested = params.get("section") ?? (params.has("plugins") ? "plugins" : params.has("account") ? "account" : "");
  const pages = area === "admin" ? adminPages : personalPages;
  return { area, page: pages.includes(requested) ? requested : pages[0] };
}

export function studioRouteURL(route: StudioRoute): string {
  const params = new URLSearchParams();
  if (route.area === "admin") params.set("workspace", "admin");
  if (route.page !== (route.area === "admin" ? "overview" : "home")) params.set("section", route.page);
  return `/${params.size ? `?${params}` : ""}`;
}
