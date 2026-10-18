import { useId } from "react";
import "./SignalMonitor.css";
export interface SignalTrace {
  id: string;
  label: string;
  values: readonly number[];
  color?: string;
}
/** Normalized presentation traces, labelled by the caller; no simulated data invented here. */
export function SignalMonitor({
  traces,
  caption = "",
  duration = "1 s",
}: {
  traces: readonly SignalTrace[];
  caption?: string;
  duration?: string;
}) {
  const id = useId();
  return (
    <figure className="aui-signal-monitor">
      <figcaption>
        {caption}
        <span>{duration}</span>
      </figcaption>
      <svg
        viewBox="0 0 700 90"
        role="img"
        aria-label={caption || "Signal traces"}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={id} width="35" height="18" patternUnits="userSpaceOnUse">
            <path
              d="M35 0H0V18"
              fill="none"
              stroke="var(--aether-color-border)"
              strokeWidth=".5"
            />
          </pattern>
        </defs>
        <rect width="700" height="90" fill={`url(#${id})`} />
        {traces.map((trace, index) => (
          <polyline
            key={trace.id}
            fill="none"
            stroke={trace.color || "var(--aether-color-accent)"}
            strokeWidth="2"
            points={trace.values
              .map(
                (v, i) =>
                  `${(i * 700) / Math.max(1, trace.values.length - 1)},${((index + 1) * 90) / (traces.length + 1) - Math.max(0, Math.min(1, v)) * 20}`,
              )
              .join(" ")}
          />
        ))}
      </svg>
      <div className="aui-signal-legend">
        {traces.map((t) => (
          <span key={t.id}>
            <i
              style={{ background: t.color || "var(--aether-color-accent)" }}
            />
            {t.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
