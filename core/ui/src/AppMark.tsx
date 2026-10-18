import type { ImgHTMLAttributes } from "react";
import { appMarkSources, type AppMarkName } from "@aether/assets/branding/marks/sources";

export type { AppMarkName } from "@aether/assets/branding/marks/sources";

export type AppMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  app?: AppMarkName;
  size?: number;
};

/** The application's standalone transparent A, without an icon tile or clipping. */
export function AppMark({ app = "studio", size = 32, alt = "", style, ...props }: AppMarkProps) {
  return <img
    src={appMarkSources[app]}
    alt={alt}
    width={size}
    height={size}
    decoding="async"
    style={{ objectFit: "contain", flexShrink: 0, ...style }}
    {...props}
  />;
}
