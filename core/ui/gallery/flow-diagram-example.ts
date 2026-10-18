import type { FlowConnection, FlowDocument, FlowNode, FlowPort } from "../src/flow-diagram-model";

const output = (id: string, offset = .5, side: FlowPort["side"] = "right"): FlowPort => ({ id, label: id, offset, side, direction: "output" });
const input = (id: string, offset = .5): FlowPort => ({ id, label: id, offset, side: "left", direction: "input" });
const source = (id: string, label: string, x: number, y: number, tone: FlowNode["tone"]): FlowNode => ({
  id, label, x, y, width: 150, height: 34, tone, kind: "source", detail: "", notes: "", ports: [output("Out", 1, "left")],
});
const connection = (id: string, sourceNode: string, sourcePort: string, targetNode: string, targetPort: string, tone: FlowNode["tone"], waypoints: { x: number; y: number }[] = [], dashed = false): FlowConnection => ({
  id, label: id.replaceAll("-", " "), source: { nodeId: sourceNode, portId: sourcePort }, target: { nodeId: targetNode, portId: targetPort }, tone, notes: "", dashed, waypoints,
});

/** An editable document, not a second hard-coded drawing of the same connections. */
export function createFlowExample(): FlowDocument {
  return {
    version: 1, width: 1160, height: 470,
    nodes: [
      source("agents", "External agents", 78, 42, "green"),
      source("assistant", "In-app assistant", 237, 86, "violet"),
      source("application", "Application / website", 78, 160, "red"),
      source("extensions", "Extensions", 78, 206, "neutral"),
      source("documents", "Studio documents", 78, 270, "teal"),
      source("services", "Local services", 78, 336, "blue"),
      source("devices", "Device adapters", 78, 382, "amber"),
      { id: "tools", label: "Tools", detail: "", notes: "Shared gateway for agent requests.", kind: "gate", tone: "green", x: 389, y: 65, width: 18, height: 80, ports: [input("Agents", 11 / 80), output("Direct", 11 / 80), output("Tools", .5), output("Events", .85)] },
      { id: "adapter", label: "UI adapter", detail: "", notes: "", kind: "gate", tone: "red", x: 518, y: 184, width: 18, height: 28, ports: [input("App", 10 / 28), output("Commands", 10 / 28)] },
      { id: "gateway", label: "Gateway", detail: "", notes: "Join different input streams while retaining their identities.", kind: "gate", tone: "violet", x: 648, y: 144, width: 18, height: 68, ports: [input("Tools", .2), input("Assistant", .45), output("Out", .8)] },
      { id: "scheduler", label: "Scheduler", detail: "", notes: "Illustrative scheduling node. The editor does not run a scheduler.", kind: "gate", tone: "teal", x: 720, y: 325, width: 18, height: 65, ports: [input("Documents", .15), output("Events", .3), output("Queue", .7)] },
      { id: "system", label: "Aether", detail: "SIGNAL SYSTEM", notes: "Commands, events and local I/O arrive through independently editable inputs.", kind: "processor", tone: "neutral", x: 930, y: 28, width: 212, height: 414, ports: [
        input("Agents", (174 - 28) / 414), input("Commands", (194 - 28) / 414), input("Gateway", (212 - 28) / 414), input("Documents", (230 - 28) / 414),
        input("App events", (280 - 28) / 414), input("Extensions", (298 - 28) / 414), input("Agent events", (316 - 28) / 414),
        input("Scheduled", (345 - 28) / 414), input("Queue", (371 - 28) / 414), input("Services", (390 - 28) / 414), input("Devices", (416 - 28) / 414),
      ] },
    ],
    connections: [
      connection("agent-bridge", "agents", "Out", "tools", "Agents", "green"),
      connection("agents-direct", "tools", "Direct", "system", "Agents", "green"),
      connection("agent-tools", "tools", "Tools", "gateway", "Tools", "green"),
      connection("assistant-gateway", "assistant", "Out", "gateway", "Assistant", "violet"),
      connection("agent-events", "tools", "Events", "system", "Agent events", "green", [{ x: 516, y: 264 }, { x: 711, y: 264 }, { x: 763, y: 316 }]),
      connection("gateway-system", "gateway", "Out", "system", "Gateway", "violet"),
      connection("application-adapter", "application", "Out", "adapter", "App", "red"),
      connection("application-commands", "adapter", "Commands", "system", "Commands", "red"),
      connection("application-events", "adapter", "Commands", "system", "App events", "red"),
      connection("extension-events", "extensions", "Out", "system", "Extensions", "neutral", [{ x: 203, y: 240 }, { x: 238, y: 214 }, { x: 710, y: 214 }, { x: 794, y: 298 }]),
      connection("document-events", "documents", "Out", "system", "Documents", "teal"),
      connection("document-schedule", "documents", "Out", "scheduler", "Documents", "teal"),
      connection("scheduled-events", "scheduler", "Events", "system", "Scheduled", "teal"),
      connection("scheduler-queue", "scheduler", "Queue", "system", "Queue", "teal", [], true),
      connection("local-services", "services", "Out", "system", "Services", "blue"),
      connection("device-adapters", "devices", "Out", "system", "Devices", "amber"),
    ],
  };
}
