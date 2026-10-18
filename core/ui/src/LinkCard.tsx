import type { ReactNode } from "react";
import "./LinkCard.css";

/**
 * A card that opens something: icon, title, description and an action line
 * (Jonathan, 2026-10-13 — the concept-app card, made the standard). Used for
 * app showcases, demo directories and any "go to" tile. A link when given
 * `href`, otherwise a button.
 */
export function LinkCard({ icon, title, description, action, href, external = false, onSelect, className }: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** The call to action, e.g. "Open demo in new tab". */
  action?: string;
  href?: string;
  /** Opens in a new tab and marks the action with ↗. */
  external?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const body = <>
    {icon && <span className="aui-link-card-icon" aria-hidden="true">{icon}</span>}
    <strong className="aui-link-card-title">{title}</strong>
    {description && <span className="aui-link-card-description">{description}</span>}
    {action && <small className="aui-link-card-action">{action}{external && <span aria-hidden="true"> ↗</span>}</small>}
  </>;
  const classes = `aui-link-card${icon ? "" : " aui-link-card--no-icon"}${className ? ` ${className}` : ""}`;
  return href
    ? <a className={classes} href={href} onClick={onSelect} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{body}</a>
    : <button type="button" className={classes} onClick={onSelect}>{body}</button>;
}

/** Responsive grid for LinkCards. */
export function LinkCardGrid({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) {
  return <div className="aui-link-card-grid" aria-label={ariaLabel}>{children}</div>;
}
