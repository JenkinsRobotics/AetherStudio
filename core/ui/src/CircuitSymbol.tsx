import type { SVGProps } from "react";
import {
  circuitPaths,
  type CircuitSymbolKind,
} from "@aether/assets/electronics/symbols";
export type { CircuitSymbolKind } from "@aether/assets/electronics/symbols";
/** Scalable shared electrical artwork; this component assigns no electrical meaning. */
export function CircuitSymbol({
  kind,
  lit = false,
  ...props
}: Omit<SVGProps<SVGSVGElement>, "ref"> & {
  kind: CircuitSymbolKind;
  lit?: boolean;
}) {
  return (
    <svg
      viewBox="-6 -6 122 92"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {lit && kind === "led" && (
        <circle
          cx="53"
          cy="40"
          r="27"
          fill="currentColor"
          opacity=".18"
          stroke="none"
        />
      )}
      <path d={circuitPaths[kind]} />
    </svg>
  );
}
