import io from "@aether/assets/branding/new-aether-2026-09/aether-io.webp";
import ioHero from "@aether/assets/branding/new-aether-2026-09/aether-io-hero.webp";
import sketch from "@aether/assets/branding/new-aether-2026-09/aether-sketch.png";
import sketchHero from "@aether/assets/branding/new-aether-2026-09/aether-sketch-hero.webp";
import drive from "@aether/assets/branding/new-aether-2026-09/aether-drive.webp";
import driveHero from "@aether/assets/branding/new-aether-2026-09/aether-drive-hero.webp";
import studio from "@aether/assets/branding/new-aether-2026-09/aether-studio.webp";
import cad from "@aether/assets/branding/new-aether-2026-09/aether-cad.webp";
import animation from "@aether/assets/branding/new-aether-2026-09/aether-animate.webp";
import map from "@aether/assets/branding/new-aether-2026-09/aether-map.webp";
import cadHero from "@aether/assets/branding/new-aether-2026-09/aether-cad-hero.webp";
import animationHero from "@aether/assets/branding/new-aether-2026-09/aether-animate-hero.webp";
import mapHero from "@aether/assets/branding/new-aether-2026-09/aether-map-hero-v2.webp";

const artwork = { studio, cad, animation, map, drive, io, sketch };
const heroes = { io: ioHero, sketch: sketchHero, cad: cadHero, animation: animationHero, map: mapHero, drive: driveHero };

/** Full-size welcome artwork belongs to Studio's home bundle, not the UI barrel. */
export function ApplicationArtwork({ app }: { app: keyof typeof artwork }) {
  return <img src={artwork[app]} alt="" width={1254} height={1254} />;
}

export function ApplicationHeroArtwork({ app }: { app: keyof typeof heroes }) {
  return <img src={heroes[app]} alt="" width={1672} height={941} loading="lazy" />;
}
