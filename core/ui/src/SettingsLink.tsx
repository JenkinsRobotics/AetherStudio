import type { ButtonHTMLAttributes } from "react";
import { AetherIcon } from "./AetherIcon";
import "./WorkflowElements.css";
export interface SettingsLinkProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; description?: string; destructive?: boolean; }
export function SettingsLink({ label, description, destructive, className = "", ...props }: SettingsLinkProps) {
  return <button type="button" {...props} className={`aui-settings-link ${className}`} data-destructive={destructive || undefined}>
    <span><strong>{label}</strong>{description && <small>{description}</small>}</span><AetherIcon name="chevron-right" />
  </button>;
}
