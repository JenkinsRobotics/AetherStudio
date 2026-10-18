import { useState } from "react";
import { AetherIcon, AppMark, FloatingToolbar, FloatingToolbarMenu, type FloatingToolbarAction } from "../src/index";
import "./FloatingToolbarDemo.css";

const tools = [
  ["spline", "Spline"], ["line", "Line"], ["circle", "Circle"], ["hexagon", "Polygon"],
  ["concentric", "Offset"], ["rectangle", "Rectangle"], ["curve", "Curve"], ["scissors", "Trim"],
  ["ball", "Sphere"], ["cube-transparent", "Box"], ["cylinder", "Cylinder"],
] as const;
const shortcuts: readonly FloatingToolbarAction[] = [
  { id: "bridge", label: "Bridge", tone: "amber" },
  { id: "split", label: "Split", tone: "blue" },
  { id: "boolean", label: "Boolean", tone: "green" },
];
const selectionModes = [["vertex", "Vertex", "dot-circle"], ["edge", "Edge", "cube-transparent"], ["face", "Face", "cube"], ["object", "Object", "cube-filled"]] as const;
const documents = ["Scifirobot.obj", "Bracket.step", "Surface study.obj"];

/** Controlled sample commands; product operations are supplied by the consumer. */
export function FloatingToolbarDemo() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [automatic, setAutomatic] = useState(true);
  const [selection, setSelection] = useState("object");
  const [document, setDocument] = useState(documents[0]);
  const [notice, setNotice] = useState("Choose a tool or type a command.");
  const matching = tools.filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()));
  const choose = (id: string) => {
    if (id === "automatic" || id === "manual") { setAutomatic(id === "automatic"); setNotice(id === "automatic" ? "Automatic evaluation on." : "Manual evaluation on."); return; }
    const label = tools.find(([key]) => key === id)?.[1] ?? shortcuts.find(action => action.id === id)?.label;
    if (!label) return;
    setActive(id); setQuery(""); setNotice(`${label} tool selected.`);
  };
  const submit = (value: string) => {
    const commands = [...tools.map(([id, label]) => ({ id, label })), ...shortcuts];
    const candidates = commands.filter(action => action.label.toLowerCase().includes(value.toLowerCase()));
    const match = candidates.find(action => action.label.toLowerCase() === value.toLowerCase()) ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (match) choose(match.id);
    else setNotice(candidates.length ? "Keep typing to choose one command." : `No command matches “${value}”.`);
  };
  return <div className="floating-toolbar-specimens">
    <section className="floating-toolbar-specimen" aria-label="Command toolbar variant">
      <small>Command + tools</small>
      <FloatingToolbar ariaLabel="Modeling tools" className="floating-toolbar-command-example"
        command={{ value: query, onValueChange: value => { setQuery(value); setNotice(value ? "Enter to choose a command; Escape to clear." : "Choose a tool or type a command."); }, onSubmit: submit, shortcuts: shortcuts.map(action => ({ ...action, pressed: active === action.id })) }}
        groups={[
          { id: "draw", label: "Drawing and solid tools", actions: matching.map(([id, label]) => ({ id, label, icon: <AetherIcon name={id} />, pressed: active === id })) },
          { id: "evaluation", label: "Evaluation mode", capsule: true, actions: [
            { id: "automatic", label: "Automatic evaluation", icon: <AetherIcon name="bolt" />, pressed: automatic },
            { id: "manual", label: "Manual evaluation", icon: <AetherIcon name="bolt-slash" />, pressed: !automatic },
          ] },
        ]} onAction={choose} />
      <output aria-live="polite">{notice}</output>
    </section>
    <section className="floating-toolbar-specimen" aria-label="Document toolbar variant">
      <small>Document + selection</small>
      <FloatingToolbar ariaLabel="Document tools" variant="document" onAction={setSelection}
        leading={<>
          <FloatingToolbarMenu iconOnly label="Toolbar menu" items={[
            { id: "reset", label: "Reset toolbar", icon: <AetherIcon name="undo" /> },
            { id: "clear", label: "Clear active tool", icon: <AetherIcon name="close" />, disabled: active === null },
          ]} onSelect={id => { setActive(null); setQuery(""); setNotice("Choose a tool or type a command."); if (id === "reset") { setSelection("object"); setAutomatic(true); } }}><AetherIcon name="menu" /></FloatingToolbarMenu>
          <AppMark app="cad" size={22} />
        </>}
        groups={[{ id: "selection", label: "Selection mode", separatorBefore: true, actions: selectionModes.map(([id, label, icon]) => ({ id, label: `${label} selection`, icon: <AetherIcon name={icon} />, pressed: selection === id })) }]}
        trailing={<FloatingToolbarMenu label="Choose sample document" items={documents.map(name => ({ id: name, label: name, kind: "radio", checked: document === name, icon: <AetherIcon name="file-model" /> }))} onSelect={setDocument}>
          <span>{document}</span><AetherIcon name="chevron-down" />
        </FloatingToolbarMenu>} />
      <output aria-live="polite">{selectionModes.find(([id]) => id === selection)?.[1]} selection · {document}</output>
    </section>
  </div>;
}
