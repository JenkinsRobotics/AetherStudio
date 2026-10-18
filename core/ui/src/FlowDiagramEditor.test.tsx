import { useState } from "react";
import { FlowDiagramEditor } from "./FlowDiagramEditor";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FlowDiagramDemo } from "../gallery/FlowDiagramDemo";
import { createFlowExample } from "../gallery/flow-diagram-example";
import { flowConnectionError, flowConnectionPath, flowDelete, flowMoveNode, flowMovePort, flowPortPoint, parseFlowDocument } from "./flow-diagram-model";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const saved = () => parseFlowDocument(localStorage.getItem("aether-ui-flow-diagram-v1")!);
const button = (name: string) => screen.getByRole("button", { name });
const commitNumber = (name: string, value: string) => {
  const input = screen.getByRole("textbox", { name });
  fireEvent.input(input, { target: { value } }); fireEvent.blur(input);
};

test("moving a node and its port reanchors attached paths without changing their identity", () => {
  const doc = createFlowExample(), edge = doc.connections[0];
  const before = flowConnectionPath(doc, edge);
  const moved = flowMoveNode(doc, "agents", { x: 102, y: 66 });
  expect(flowConnectionPath(moved, edge)).toMatch(/^M102 100/);
  expect(flowConnectionPath(moved, edge)).not.toBe(before);
  expect(moved.connections).toBe(doc.connections);
  const repointed = flowMovePort(moved, "agents", "Out", { x: 252, y: 83 });
  expect(repointed.nodes[0].ports[0]).toMatchObject({ side: "right", offset: .5 });
  expect(flowPortPoint(repointed.nodes[0], repointed.nodes[0].ports[0])).toEqual({ x: 252, y: 83 });
  expect(flowConnectionPath(repointed, edge)).toMatch(/^M252 83/);
  expect(flowMoveNode(doc, "agents", { x: -100, y: 9999 }).nodes[0]).toMatchObject({ x: 12, y: 424 });
  const fullCanvas = { ...doc, nodes: [{ ...doc.nodes[0], x: 0, y: 0, width: doc.width, height: doc.height }], connections: [] };
  expect(parseFlowDocument(JSON.stringify(flowMoveNode(fullCanvas, "agents", { x: 30, y: 30 })))).toEqual(fullCanvas);
});

test("deleting a port or node removes only its incident connections", () => {
  const doc = createFlowExample();
  const withoutPort = flowDelete(doc, { kind: "port", nodeId: "adapter", id: "Commands" });
  expect(withoutPort.connections).toHaveLength(doc.connections.length - 2);
  expect(withoutPort.nodes).toHaveLength(doc.nodes.length);
  const withoutNode = flowDelete(doc, { kind: "node", id: "adapter" });
  expect(withoutNode.connections).toHaveLength(doc.connections.length - 3);
  expect(withoutNode.nodes).toHaveLength(doc.nodes.length - 1);
  expect(doc.nodes.find(n => n.id === "adapter")?.ports).toHaveLength(2);
});

test("JSON round-trips editable geometry and rejects broken references, duplicates and directions", () => {
  const doc = createFlowExample();
  expect(parseFlowDocument(JSON.stringify(doc))).toEqual(doc);
  const changed = (edit: (draft: typeof doc) => void) => { const draft = createFlowExample(); edit(draft); return () => parseFlowDocument(JSON.stringify(draft)); };
  expect(changed(d => { d.connections[0].target.portId = "missing"; })).toThrow("Invalid flow diagram");
  expect(changed(d => { d.connections.push({ ...d.connections[0], id: "duplicate" }); })).toThrow("Invalid flow diagram");
  expect(changed(d => { d.nodes[0].ports[0].direction = "input"; })).toThrow("Invalid flow diagram");
  expect(changed(d => { d.nodes[0].ports[0].offset = 4; })).toThrow("Invalid flow diagram");
  expect(changed(d => { d.nodes[0].x = Infinity; })).toThrow("Invalid flow diagram");
  expect(changed(d => { d.connections[1] = null as never; })).toThrow("Invalid flow diagram");
  expect(flowConnectionError(doc, doc.connections[0].source, doc.connections[0].target)).toContain("already connected");
});

test("node labels, notes, positions and port edits persist and undo restores the saved document", () => {
  const view = render(<FlowDiagramDemo />);
  fireEvent.click(button("Node: External agents"));
  fireEvent.change(screen.getByRole("textbox", { name: "Node label" }), { target: { value: "Operator console" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), { target: { value: "Trigger after doors close." } });
  commitNumber("Node X", "110");
  expect(saved().nodes[0]).toMatchObject({ label: "Operator console", notes: "Trigger after doors close.", x: 110 });
  fireEvent.click(button("Output point: Operator console / Out"));
  fireEvent.change(screen.getByRole("combobox", { name: "Point side" }), { target: { value: "bottom" } });
  commitNumber("Point position", "75");
  expect(saved().nodes[0].ports[0]).toMatchObject({ side: "bottom", offset: .75 });
  fireEvent.click(button("Undo"));
  expect(saved().nodes[0].ports[0].offset).toBe(1);
  fireEvent.click(button("Redo"));
  expect(saved().nodes[0].ports[0].offset).toBe(.75);
  view.unmount(); render(<FlowDiagramDemo />);
  fireEvent.click(button("Node: Operator console"));
  expect((screen.getByRole("textbox", { name: "Notes" }) as HTMLTextAreaElement).value).toBe("Trigger after doors close.");
});

test("create a node and connection, reject a duplicate, then delete and restore its incident edge", () => {
  render(<FlowDiagramDemo />);
  fireEvent.click(button("Add node"));
  expect(saved().nodes).toHaveLength(13);
  fireEvent.click(screen.getByRole("radio", { name: "Connect" }));
  fireEvent.click(button("Output point: New node / Output"));
  fireEvent.click(button("Input point: Aether / Commands"));
  expect(saved().connections).toHaveLength(17);
  fireEvent.click(screen.getByRole("radio", { name: "Connect" }));
  fireEvent.click(button("Output point: New node / Output"));
  fireEvent.click(button("Input point: Aether / Commands"));
  expect(screen.getByText("These points are already connected.")).toBeTruthy();
  expect(saved().connections).toHaveLength(17);
  fireEvent.click(screen.getByRole("radio", { name: "Select / move" }));
  fireEvent.click(button("Node: New node")); fireEvent.click(button("Delete node"));
  expect(saved().nodes).toHaveLength(12); expect(saved().connections).toHaveLength(16);
  fireEvent.click(button("Undo"));
  expect(saved().nodes).toHaveLength(13); expect(saved().connections).toHaveLength(17);
});

test("reconnecting and editing bends changes the actual animated path and preserves notes", () => {
  const { container } = render(<FlowDiagramDemo />);
  fireEvent.click(button("Connection: local services"));
  fireEvent.change(screen.getByRole("combobox", { name: "Connection target" }), { target: { value: JSON.stringify(["system", "Commands"]) } });
  fireEvent.click(button("Add bend")); commitNumber("Bend 1 Y", "410");
  const edge = saved().connections.find(e => e.id === "local-services")!;
  expect(edge.target.portId).toBe("Commands"); expect(edge.waypoints[0].y).toBe(410);
  const actual = container.querySelector('[data-route="local-services"] .aui-flow-route-signal')?.getAttribute("d");
  expect(actual).toBe(flowConnectionPath(saved(), edge));
  fireEvent.keyDown(button("Route bend 1"), { key: "ArrowRight", shiftKey: true });
  expect(saved().connections.find(e => e.id === edge.id)!.waypoints[0].x).toBe(edge.waypoints[0].x + 10);
  fireEvent.click(button("Auto route"));
  expect(saved().connections.find(e => e.id === edge.id)!.waypoints).toEqual([]);
});

test("port creation and removal are undoable and keyboard nudges follow the selected node", () => {
  render(<FlowDiagramDemo />);
  fireEvent.click(button("Node: External agents"));
  fireEvent.keyDown(button("Node: External agents"), { key: "ArrowDown", shiftKey: true });
  expect(saved().nodes[0].y).toBe(52);
  fireEvent.click(button("Add input"));
  expect(saved().nodes[0].ports).toHaveLength(2);
  fireEvent.click(button("Delete point"));
  expect(saved().nodes[0].ports).toHaveLength(1);
  fireEvent.click(button("Undo"));
  expect(saved().nodes[0].ports).toHaveLength(2);
});

test("invalid import leaves the current diagram intact and valid import can be undone", async () => {
  render(<FlowDiagramDemo />); fireEvent.click(button("Add node"));
  const before = saved();
  const input = screen.getByLabelText("Import flow diagram JSON");
  fireEvent.change(input, { target: { files: [{ size: 3, text: async () => "{}" }] } });
  expect(await screen.findByText(/Invalid flow diagram/)).toBeTruthy();
  expect(saved()).toEqual(before);
  const imported = createFlowExample(); imported.nodes[0].label = "Imported console";
  fireEvent.change(input, { target: { files: [{ size: 100, text: async () => JSON.stringify(imported) }] } });
  expect(await screen.findByText("Diagram imported. Undo restores the previous document.")).toBeTruthy();
  expect(saved()).toEqual(imported);
  fireEvent.click(button("Undo")); expect(saved()).toEqual(before);
});

test("storage failure is reported while the editor keeps accepting edits", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  render(<FlowDiagramDemo />); fireEvent.click(button("Add node"));
  expect(screen.getByText("Browser storage unavailable. Export JSON to keep your edits.")).toBeTruthy();
  expect(button("Node: New node")).toBeTruthy();
  expect(within(screen.getByLabelText("Diagram inspector")).getByRole("textbox", { name: "Node label" })).toBeTruthy();
});

test("a canceled drag makes no edit and a completed drag commits only one history entry", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const changed = vi.fn();
  function Harness() {
    const [value, setValue] = useState(createFlowExample);
    return <FlowDiagramEditor value={value} onChange={next => { changed(next); setValue(next); }} />;
  }
  const { container } = render(<Harness />);
  const node = button("Node: External agents");
  const svg = (node as unknown as SVGElement).ownerSVGElement!;
  Object.defineProperty(svg, "getScreenCTM", { value: () => null });
  Object.defineProperty(node, "setPointerCapture", { value: () => {} });
  Object.defineProperty(node, "focus", { value: () => {} });
  const x = () => container.querySelector('[data-node="agents"] .aui-flow-node-hit')!.getAttribute("x");
  fireEvent.pointerDown(node, { button: 0, clientX: 150, clientY: 50 });
  fireEvent.pointerMove(node, { clientX: 182, clientY: 74 });
  expect(x()).not.toBe("72"); expect(changed).not.toHaveBeenCalled();
  fireEvent.keyDown(node, { key: "Escape" }); fireEvent.pointerUp(node);
  expect(x()).toBe("72"); expect(changed).not.toHaveBeenCalled();
  fireEvent.pointerDown(node, { button: 0, clientX: 150, clientY: 50 });
  fireEvent.pointerMove(node, { clientX: 174, clientY: 74 }); fireEvent.pointerUp(node);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(changed.mock.calls[0][0].nodes[0]).toMatchObject({ x: 104, y: 64 });
});

test("export includes edited notes and geometry, with selectable JSON when clipboard access fails", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", Object.create(navigator, { clipboard: { value: { writeText } } }));
  render(<FlowDiagramDemo />);
  fireEvent.click(button("Node: External agents"));
  fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), { target: { value: "Keep this cue." } });
  commitNumber("Node X", "120");
  fireEvent.click(button("Export JSON"));
  const text = screen.getByRole("textbox", { name: "Diagram JSON" }) as HTMLTextAreaElement;
  expect(parseFlowDocument(text.value)).toEqual(saved());
  fireEvent.click(button("Copy JSON"));
  await screen.findByText("Diagram JSON copied.");
  expect(parseFlowDocument(writeText.mock.calls[0][0]).nodes[0]).toMatchObject({ notes: "Keep this cue.", x: 120 });
  writeText.mockRejectedValue(new Error("denied"));
  fireEvent.click(button("Copy JSON"));
  await waitFor(() => expect(text.selectionEnd - text.selectionStart).toBe(text.value.length));
  expect(screen.getByText("JSON selected. Use your system copy shortcut to copy it.")).toBeTruthy();
});
