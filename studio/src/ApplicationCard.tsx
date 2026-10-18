import { AppIcon } from "@aether/ui";
import type { App } from "./main";
import cadHero from "@aether/assets/branding/new-aether-2026-09/aether-cad-hero.webp";
import animationHero from "@aether/assets/branding/new-aether-2026-09/aether-animate-hero.webp";
import uiHero from "@aether/assets/branding/new-aether-2026-09/aether-ui-hero.webp";
import mapHero from "@aether/assets/branding/new-aether-2026-09/aether-map-hero-v2.webp";
import sketchHero from "@aether/assets/branding/new-aether-2026-09/aether-sketch-hero.webp";
import vectorHero from "@aether/assets/branding/new-aether-2026-09/aether-vector-hero.webp";
import ioHero from "@aether/assets/branding/new-aether-2026-09/aether-io-hero.webp";
import driveHero from "@aether/assets/branding/new-aether-2026-09/aether-drive-hero.webp";
import "./ApplicationCard.css";

const heroes: Record<string, string> = {
  io: ioHero,
  drive: driveHero,
  cad: cadHero,
  animation: animationHero,
  ui: uiHero,
  map: mapHero,
  sketch: sketchHero,
  vector: vectorHero,
};

/** Shared launcher presentation for the public and signed-in Studio home. */
export function ApplicationCard({ app }: { app: App }) {
  const hero = heroes[app.id];
  const available = app.installed && app.enabled;
  return (
    <a
      className="application-card"
      href={available ? app.url : undefined}
      target="_blank"
      rel="noopener"
      aria-disabled={!available}
    >
      <div className="application-art" aria-hidden="true">
        {hero ? (
          <img src={hero} alt="" width={1672} height={941} decoding="async" />
        ) : (
          <div className="application-icon-fallback"><AppIcon app={app.id} size={108} /></div>
        )}
      </div>
      <div className="application-copy">
        <h3>{app.name}</h3>
        {app.coming_soon && <span className="application-coming-soon">Coming soon</span>}
        <p>{app.description}</p>
        <span className="application-open">
          {!app.enabled ? "Disabled" : app.installed ? "Open application ↗" : "Build required"}
        </span>
      </div>
    </a>
  );
}
