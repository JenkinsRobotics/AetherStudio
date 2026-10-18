import type { ReactNode } from "react";
import connectorArt from "@aether/assets/electronics/connector-housing.svg";
import "./HarnessWidgets.css";

export interface HarnessPin {
  side?: "left" | "right";
  id: string;
  label: string;
}
/** SVG presentation primitives. Coordinates, connections and electrical rules belong to the product. */
export function HarnessConnectorCard({
  title,
  pins,
  selected,
  activePin,
  onPin,
  onSelect,
  portSide = "right",
}: {
  title: string;
  pins: readonly HarnessPin[];
  selected?: boolean;
  activePin?: string;
  portSide?: "left" | "right";
  onPin?: (id: string) => void;
  onSelect?: () => void;
}) {
  return (
    <g className="aui-harness-card" data-selected={selected || undefined}>
      <rect
        width="180"
        height={32 + pins.length * 32}
        rx="9"
        className="aui-harness-card-body"
      />
      <path
        d="M9 0H171Q180 0 180 9V32H0V9Q0 0 9 0"
        className="aui-harness-card-head"
      />
      <g
        role="button"
        tabIndex={0}
        aria-label={`Select ${title}`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSelect?.();
        }}
      >
        <rect width="180" height="32" fill="transparent" />
        <text x="13" y="21" className="aui-harness-title">
          {title}
        </text>
        <text x="154" y="22">
          ⇥
        </text>
      </g>
      {pins.map((pin, i) => (
        <g
          key={pin.id}
          className="aui-harness-pin"
          role="button"
          tabIndex={0}
          aria-label={`${title} pin ${pin.id} ${pin.label}`}
          aria-pressed={activePin === pin.id}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPin?.(pin.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPin?.(pin.id);
            }
          }}
        >
          <rect
            x="1"
            y={32 + i * 32}
            width="178"
            height="32"
            fill="transparent"
          />
          <path d={`M0 ${32 + i * 32}H180`} className="aui-harness-divider" />
          <text x="13" y={53 + i * 32} className="aui-harness-muted">
            {pin.id}
          </text>
          <text x="39" y={53 + i * 32}>
            {pin.label}
          </text>
          <circle
            cx={(pin.side ?? portSide) === "right" ? 171 : 9}
            cy={48 + i * 32}
            r="3"
            className="aui-harness-port"
          />
        </g>
      ))}
    </g>
  );
}

export function ConnectorFace({
  pins,
  title,
  triangular = false,
}: {
  pins: readonly string[];
  title: string;
  triangular?: boolean;
}) {
  const points =
    pins.length === 3
      ? [
          [21, 21],
          [59, 21],
          [40, 52],
        ]
      : pins.length === 2
        ? [
            [27, 38],
            [53, 38],
          ]
        : pins.map((_, i) => [
            25 + (i % 2) * 30,
            (pins.length > 6 ? 16 : 23) +
              Math.floor(i / 2) *
                Math.min(18, 48 / Math.max(1, Math.ceil(pins.length / 2) - 1)),
          ]);
  return (
    <g
      className="aui-connector-face"
      aria-label={`${title} connector face`}
      role="img"
    >
      <rect x="20" y="-5" width="40" height="8" rx="3" />
      <path
        d={
          triangular
            ? "M13 0H67Q80 4 76 20L52 70Q40 86 28 70L4 20Q0 4 13 0Z"
            : "M10 0H70Q80 0 80 10V70Q80 80 70 80H10Q0 80 0 70V10Q0 0 10 0Z"
        }
      />
      {pins.map((pin, i) => (
        <g key={pin}>
          <circle
            cx={points[i]?.[0] ?? 40}
            cy={points[i]?.[1] ?? 40}
            r={pins.length > 8 ? 5 : 9}
          />
          <text
            x={points[i]?.[0] ?? 40}
            y={(points[i]?.[1] ?? 40) + 3.5}
            textAnchor="middle"
          >
            {pin}
          </text>
        </g>
      ))}
    </g>
  );
}
export function ConnectorPreview({
  title,
  tone = "neutral",
}: {
  title: string;
  tone?: "neutral" | "green" | "blue" | "orange";
}) {
  return (
    <g
      className="aui-connector-preview"
      data-tone={tone}
      role="img"
      aria-label={`${title} housing illustration`}
    >
      <rect width="82" height="82" rx="7" />
      <image href={connectorArt} x="4" y="4" width="74" height="74" />
    </g>
  );
}
export interface HarnessConnectionRow {
  id: string;
  pin: string;
  destination: string;
  color: string;
  part: string;
  length: string;
  contact?: string;
}
export function HarnessConnectionTable({
  rows,
  width = 330,
  contacts = false,
  onSelect,
}: {
  rows: readonly HarnessConnectionRow[];
  width?: number;
  contacts?: boolean;
  onSelect?: (id: string) => void;
}) {
  const partX = width * (contacts ? 0.42 : 0.58),
    lengthX = width * (contacts ? 0.65 : 0.89);
  return (
    <g className="aui-harness-table">
      <rect
        width={width}
        height={28 + rows.length * 26}
        rx="7"
        className="aui-harness-card-body"
      />
      <path
        d={`M7 0H${width - 7}Q${width} 0 ${width} 7V28H0V7Q0 0 7 0`}
        className="aui-harness-card-head"
      />
      <text x="32" y="18" className="aui-harness-muted">
        Destination
      </text>
      <text x={partX} y="18" className="aui-harness-muted">
        Part
      </text>
      <text
        x={lengthX}
        y="18"
        textAnchor="middle"
        className="aui-harness-muted"
      >
        Length
      </text>
      {contacts && (
        <text x={width * 0.78} y="18" className="aui-harness-muted">
          Contact
        </text>
      )}
      {rows.map((row, i) => (
        <g
          key={`${row.id}:${row.pin}`}
          role="button"
          tabIndex={0}
          aria-label={`Connection ${row.pin} to ${row.destination}`}
          onClick={() => onSelect?.(row.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSelect?.(row.id);
          }}
        >
          <rect y={28 + i * 26} width={width} height="26" fill="transparent" />
          <path
            d={`M0 ${28 + i * 26}H${width}`}
            className="aui-harness-divider"
          />
          <text x="10" y={46 + i * 26} className="aui-harness-muted">
            {row.pin}
          </text>
          <text x="32" y={46 + i * 26}>
            {row.destination}
          </text>
          <rect
            x={partX - 5}
            y={33 + i * 26}
            width="74"
            height="16"
            rx="8"
            className="aui-harness-gauge"
          />
          <path
            d={`M${partX} ${41 + i * 26}h12`}
            stroke={row.color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text x={partX + 18} y={45 + i * 26}>
            {row.part}
          </text>
          <text x={lengthX} y={46 + i * 26} textAnchor="middle">
            {row.length}
          </text>
          {contacts && (
            <text x={width * 0.78} y={46 + i * 26}>
              {row.contact ?? "—"}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
export function HarnessDrawingScope({ children }: { children: ReactNode }) {
  return <g className="aui-harness-drawing">{children}</g>;
}
