import { useEffect, useState } from "react";

/** Presentation projection of the host's per-user application catalog. */
export interface StudioApplication {
  id: string;
  name: string;
  url: string;
  description?: string;
  comingSoon?: boolean;
}

export function applicationsFromStatus(status: unknown): StudioApplication[] {
  if (!status || typeof status !== "object" || !("apps" in status) || !Array.isArray(status.apps)) return [];
  return status.apps.flatMap((app: unknown) => {
    if (!app || typeof app !== "object") return [];
    const value = app as Record<string, unknown>;
    if (value.enabled === false || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.url !== "string") return [];
    // The host uses same-origin application paths. Do not turn malformed catalog
    // entries into executable or external links in every application's header.
    if (!value.url.startsWith("/")) return [];
    try {
      if (new URL(value.url, "https://studio.invalid").origin !== "https://studio.invalid") return [];
    } catch { return []; }
    return [{
      id: value.id, name: value.name, url: value.url,
      description: typeof value.description === "string" ? value.description : undefined,
      comingSoon: value.comingSoon === true || value.coming_soon === true || value.installed === false,
    }];
  });
}

/** Transport belongs to the platform adapter, never the design system. */
export function useStudioApplications(): readonly StudioApplication[] {
  const [apps, setApps] = useState<StudioApplication[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/status", { credentials: "same-origin", signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!controller.signal.aborted) setApps(applicationsFromStatus(result));
      }).catch(() => { /* The suite-home link remains available while offline. */ });
    return () => controller.abort();
  }, []);
  return apps;
}
