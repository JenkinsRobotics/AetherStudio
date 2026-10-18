import packagedAssets0 from "@aether/assets/catalogs/c0b2566acef0ce";
import { useId, useSyncExternalStore } from "react";
import type { SVGProps } from "react";

/** The default pack is the folder: every SVG in core/assets/icons (pack.json
 * `iconsFromDirectory`), keyed by file name. Adding an icon is adding a file;
 * dev/check-icon-pack.mjs guards the drawing conventions. */
const files = (packagedAssets0 as Record<string, string>);
const icons: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, markup]) => [path.slice(path.lastIndexOf("/") + 1, -".svg".length), markup]),
);

export type AetherIconName = keyof typeof icons;
export const aetherIconNames = Object.keys(icons).sort() as AetherIconName[];
export interface AetherIconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML" | "ref"> {
  name: AetherIconName;
}

/** Artwork lives in core/assets/icons. This component only supplies presentation.
 * The markup is trusted, repository-owned SVG imported at build time, never user data.
 * Buttons/controls provide accessible labels; their icon is decorative. */
/** Icon-pack seam: a pack registers alternate markup for the same names.
 * Partial packs fall back to the default artwork per icon. Registration is a
 * hot swap — every mounted icon re-renders immediately via the pack store. */
let activeIconPack: Partial<Record<AetherIconName, string>> | null = null;
let iconPackVersion = 0;
const iconPackListeners = new Set<() => void>();
const subscribeIconPack = (listener: () => void) => {
  iconPackListeners.add(listener);
  return () => iconPackListeners.delete(listener);
};
export function registerIconPack(pack: Partial<Record<AetherIconName, string>> | null) {
  activeIconPack = pack;
  iconPackVersion += 1;
  for (const listener of iconPackListeners) listener();
}

export function AetherIcon({ name, ...props }: AetherIconProps) {
  const instanceID = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useSyncExternalStore(subscribeIconPack, () => iconPackVersion, () => iconPackVersion);
  const source = activeIconPack?.[name] ?? icons[name];
  // An unknown name renders an empty glyph marked data-icon-missing rather than throwing mid-render.
  const body = (source ?? "").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  // Inline gradient/clip IDs must be local to this instance, including when a
  // light preview and a dark preview of the same artwork appear on one page.
  const ids = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const scoped = (id: string) => ids.has(id) ? `aui-${instanceID}-${id}` : id;
  const markup = body.replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${scoped(id)}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${scoped(id)})`)
    .replace(/\bhref="#([^"]+)"/g, (_, id: string) => `href="#${scoped(id)}"`);
  // Which glyph this is, for tests and for reading a rendered tree in devtools.
  // The markup alone cannot say, since the registry inlines it.
  return <svg aria-hidden="true" focusable="false" data-icon={name} data-icon-missing={source ? undefined : ""} viewBox="0 0 24 24"
    width="1em" height="1em" fill="none" stroke="currentColor"
    strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7"
    {...props} dangerouslySetInnerHTML={{ __html: markup }} />;
}
