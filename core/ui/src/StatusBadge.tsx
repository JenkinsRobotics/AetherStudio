import type { ReactNode } from "react";
import "./AnalyticsElements.css";

/** A concise state or change label; meaning and wording come from the caller. */
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "positive" | "negative" | "warning" | "neutral" }) {
  return <span className="aui-status-badge" data-tone={tone}>{children}</span>;
}
