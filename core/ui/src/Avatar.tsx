import { useState } from "react";
import "./WorkflowElements.css";
export interface AvatarProps { name: string; src?: string; size?: "small" | "standard"; }
/** Initials are always available if no portrait is supplied or it fails to load. */
export function Avatar({ name, src, size = "standard" }: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string>();
  return <span className="aui-avatar" data-size={size} role="img" aria-label={name}>
    {src && src !== failedSource ? <img src={src} alt="" onError={() => setFailedSource(src)} /> : name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "?"}
  </span>;
}
