import type { ImgHTMLAttributes } from "react";
import { appIconSources as sources } from "@aether/assets/branding/apps/sources";
// Raster identities are served once by the suite host. Importing them here
// would copy every product's full-size logo into every consumer's bundle.
/** Product identity artwork, separate from monochrome toolbar symbols. */
export function AppIcon({ app = "studio", size = 32, alt = "", style, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { app?: string; size?: number }) {
  return <img src={sources[app as keyof typeof sources] ?? sources.studio} alt={alt} width={size} height={size} style={{ objectFit: "contain", borderRadius: "22%", flexShrink: 0, ...style }} {...props} />;
}
