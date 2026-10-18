/** Standalone previews serve UI only; product demos belong to the Studio host. */
export function isInstalledGallery(location = window.location.href) {
  const { pathname } = new URL(location);
  return pathname === "/ui" || pathname.startsWith("/ui/");
}

export function studioAppURL(path: string, location = window.location.href, configuredOrigin = import.meta.env.VITE_STUDIO_ORIGIN as string | undefined) {
  const current = new URL(location);
  return new URL(path, configuredOrigin || (isInstalledGallery(location) ? current.origin : "http://localhost:8780")).href;
}

/** Return from a demo to the single launch directory, preserving its install path. */
export function demoAppsURL(location = window.location.href) {
  const url = new URL(location);
  if (url.pathname.endsWith(".html")) url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1);
  url.search = "";
  url.hash = "tab=apps&section=showcase-concept-applications-launchable-demos";
  return url.href;
}
