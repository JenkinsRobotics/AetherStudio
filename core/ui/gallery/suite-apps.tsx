/**
 * The suite-wide application launcher for the gallery and its concept apps:
 * the waffle in every Aether header lists Aether Studio's applications, never
 * a page's own demos (those open from the gallery's left rail).
 */
import { useEffect, useState } from "react";
import { AppLauncher, type LaunchableApp } from "../src/index";

/** The bundled applications, used when the gallery runs without the host (`npm run gallery`). */
export const SUITE_APPS: readonly LaunchableApp[] = [
  { id: "io", name: "Aether IO", description: "Electronics design · UI preview", url: "/io/" },
  { id: "cad", name: "Aether CAD", description: "Parts, assemblies, and mates", url: "/cad/" },
  { id: "animation", name: "Aether Animation", description: "Rig, animate, show, and hardware", url: "/animation/" },
  { id: "map", name: "Aether Map", description: "Projection mapping and show output", url: "/map/" },
  { id: "sketch", name: "Aether Sketch", description: "2D drawing", url: "/sketch/", comingSoon: true },
  { id: "vector", name: "Aether Vector", description: "Vector artwork", url: "/vector/", comingSoon: true },
  { id: "ui", name: "Aether UI", description: "The shared design system", url: "/ui/" },
];

/** The host's per-user application list (`/api/status`) when it serves the page; the static list otherwise. */
export function useSuiteApps(): readonly LaunchableApp[] {
  const [apps, setApps] = useState(SUITE_APPS);
  useEffect(() => {
    if (typeof fetch !== "function" || !window.location.pathname.startsWith("/ui/")) return;
    let cancelled = false;
    fetch("/api/status", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => {
        const list = status?.apps;
        if (cancelled || !Array.isArray(list) || list.length === 0) return;
        setApps(list.map((app) => ({ id: String(app.id), name: String(app.name), description: app.description ? String(app.description) : undefined, url: String(app.url), comingSoon: Boolean(app.coming_soon) || app.enabled === false || app.installed === false })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return apps;
}

export function SuiteLauncher({ currentID }: { currentID: string }) {
  return <AppLauncher apps={useSuiteApps()} currentID={currentID} homeUrl="/" homeName="Aether Studio" />;
}
