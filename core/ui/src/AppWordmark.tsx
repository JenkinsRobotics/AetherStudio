import { useId, type CSSProperties, type SVGProps } from "react";
import { appMarkSources } from "@aether/assets/branding/marks/sources";
import { appWordmarkData, type AppWordmarkName } from "@aether/assets/branding/wordmarks/data";
import "./AppWordmark.css";

export type { AppWordmarkName } from "@aether/assets/branding/wordmarks/data";
export interface AppWordmarkProps extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  app: AppWordmarkName;
  /** Overall logo height. 28, 36 and 40 fit the standard header sizes. */
  size?: number;
  /** Auto follows the surrounding Aether surface; explicit values suit fixed artwork. */
  appearance?: "auto" | "light" | "dark";
  /** Hide from assistive technology when its parent link already names the app. */
  decorative?: boolean;
}

/** Resolve only registered identities; custom app names keep their own branding. */
export function resolveAppWordmark(identity: string): AppWordmarkName | undefined {
  const value = identity.trim().toLowerCase();
  return (Object.keys(appWordmarkData.apps) as AppWordmarkName[]).find(app =>
    app === value || `aether ${appWordmarkData.apps[app].name}`.toLowerCase() === value);
}

/** Header identity: the app's original A and font-independent outlined lettering.
 * This composition has no button, tile, frame or navigation behavior of its own. */
export function AppWordmark({ app, size = 36, appearance = "auto", decorative = false, className, style, ...props }: AppWordmarkProps) {
  const id = `aether-wordmark-${useId().replaceAll(":", "")}`;
  const item = appWordmarkData.apps[app], { layout, word } = appWordmarkData;
  const colors = { "--aui-wordmark-light-start": item.accents[0], "--aui-wordmark-light-end": item.accents[1], "--aui-wordmark-dark-start": item.accents[2], "--aui-wordmark-dark-end": item.accents[3] } as CSSProperties;
  const suffixX = layout.textX + word.advance * layout.scale + layout.gap;
  return <svg {...props} className={["aui-app-wordmark", className].filter(Boolean).join(" ")} data-app={app} data-appearance={appearance}
    width={item.width * size / layout.height} height={size} viewBox={`0 0 ${item.width} ${layout.height}`} preserveAspectRatio="xMinYMid meet"
    role={decorative ? undefined : "img"} aria-label={decorative ? undefined : `Aether ${item.name}`} aria-hidden={decorative || undefined} focusable="false" style={{ ...colors, ...style }}>
    <defs><linearGradient id={id} x1="0" y1="1" x2="0" y2="0"><stop className="aui-app-wordmark-accent-start"/><stop className="aui-app-wordmark-accent-end" offset="1"/></linearGradient></defs>
    <image href={appMarkSources[app]} width={layout.markSize} height={layout.markSize}/>
    <path className="aui-app-wordmark-name" d={word.path} transform={`translate(${layout.textX} ${layout.baseline}) scale(${layout.scale} -${layout.scale})`}/>
    <path d={item.outline.path} transform={`translate(${suffixX} ${layout.baseline}) scale(${layout.scale} -${layout.scale})`} fill={`url(#${id})`}/>
  </svg>;
}
