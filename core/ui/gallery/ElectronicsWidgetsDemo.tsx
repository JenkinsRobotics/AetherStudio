import { useState } from "react";
import {
  HarnessDrawingScope,
  HarnessConnectorCard,
  ConnectorFace,
  ConnectorPreview,
  HarnessConnectionTable,
  AppWordmark,
  Button,
  CircuitSymbol,
  SignalMonitor,
  type CircuitSymbolKind,
} from "../src/index";
export function ElectronicsWidgetsDemo() {
  const [lit, setLit] = useState(false);
  return (
    <div style={{ width: "100%", display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <div>
          <AppWordmark app="io" size={40} />
          <p>
            Shared circuit artwork and signal presentation. Product code owns
            connections and simulation.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
        {(
          [
            "resistor",
            "capacitor",
            "led",
            "switch",
            "connector",
            "mcu",
          ] as CircuitSymbolKind[]
        ).map((kind) => (
          <div
            key={kind}
            style={{
              display: "grid",
              gap: 8,
              textAlign: "center",
              color: "var(--aether-color-text)",
            }}
          >
            <CircuitSymbol kind={kind} lit={lit} width={96} height={75} />
            <span>{kind}</span>
          </div>
        ))}
      </div>
      <Button onClick={() => setLit(!lit)} aria-pressed={lit}>
        Toggle LED highlight
      </Button>
      <SignalMonitor
        caption="Illustrative logic and analog traces"
        duration="2 s"
        traces={[
          {
            id: "digital",
            label: "Digital input",
            values: [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
          },
          {
            id: "analog",
            label: "Analog input",
            values: Array.from(
              { length: 60 },
              (_, i) => (Math.sin(i / 5) + 1) / 2,
            ),
            color: "var(--aether-color-ok)",
          },
        ]}
      />
      <SignalMonitor caption="Awaiting trace input" traces={[]} duration="—" />
      <h3>Harness connectors and pin tables</h3>
      <svg
        viewBox="0 0 880 200"
        style={{
          width: "100%",
          background: "var(--aether-color-bg-panel)",
          borderRadius: 9,
        }}
        aria-label="Harness widget specimens"
      >
        <HarnessDrawingScope>
          <g transform="translate(20 25)">
            <HarnessConnectorCard
              title="Injector 1"
              pins={[
                { id: "1", label: "BAT +" },
                { id: "2", label: "INJ 1" },
              ]}
            />
          </g>
          <g transform="translate(230 25)">
            <ConnectorPreview title="Two-pin connector" />
          </g>
          <g transform="translate(335 25)">
            <ConnectorFace title="Connector face" pins={["1", "2"]} />
          </g>
          <g transform="translate(460 25)">
            <HarnessConnectionTable
              rows={[
                {
                  id: "1",
                  pin: "1",
                  destination: "Power.1",
                  color: "#ec5862",
                  part: "22 AWG",
                  length: "7.9 in",
                },
                {
                  id: "2",
                  pin: "2",
                  destination: "Bulk Head.1",
                  color: "#f48629",
                  part: "22 AWG",
                  length: "53.2 in",
                },
              ]}
            />
          </g>
        </HarnessDrawingScope>
      </svg>
    </div>
  );
}
