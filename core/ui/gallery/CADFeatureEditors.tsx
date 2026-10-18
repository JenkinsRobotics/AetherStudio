import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openFeatureWindow, ToolIcon, type FeatureWindow, type ToolIconName } from "../src/index";

/** The CAD feature editors as bare FeatureWindow widgets (Jonathan, 2026-10-14:
 * widgets, not a collection page in a frame). Layout and local validation only;
 * Aether CAD owns engine validation and the live sketch-plane controls.
 * ponytail: mirrors Aether-CAD/gallery/features; replace with an import if CAD
 * ever publishes those builders without its engine dependencies. */
const input = (value: string) => Object.assign(document.createElement("input"), { type: "text", value });
const unit = (text: string) => Object.assign(document.createElement("span"), { textContent: text });
const checkbox = (checked = false) => Object.assign(document.createElement("input"), { type: "checkbox", checked });

/** An entities box whose rows can be removed; `rule` returns the error, if any. */
function entities(win: FeatureWindow, caption: string, initial: string[], rule: (count: number) => string | null) {
  const box = win.entitiesBox(caption);
  let items = [...initial];
  const render = () => {
    box.render(items.map((label, index) => ({ label, onRemove: () => { items = items.filter((_, at) => at !== index); render(); } })));
    win.setError(rule(items.length));
  };
  render();
}
const atLeast = (n: number, message: string) => (count: number) => count >= n ? null : message;
const bodyTabs = (win: FeatureWindow) => { win.tabs(["Solid", "Surface", "Thin"]); win.tabs(["New", "Add", "Remove", "Intersect"]); };

function nested(win: FeatureWindow, title: string, kind: "checkbox" | "disclosure", rows: [string, ...HTMLElement[]][]) {
  const section = win.subsection(title, { kind });
  for (const [label, ...controls] of rows) {
    const row = Object.assign(document.createElement("div"), { className: "aui-feature-row" });
    const control = Object.assign(document.createElement("span"), { className: "aui-feature-row-control" });
    for (const field of controls) {
      if (field.matches("input, select, textarea") && !field.hasAttribute("aria-label")) field.setAttribute("aria-label", label);
    }
    control.append(...controls);
    row.append(unit(label), control);
    section.body.append(row);
  }
  return section;
}

type Build = (win: FeatureWindow) => void;
export type CADFeatureEditor = { id: string; title: string; accept: string; icon: ToolIconName; build: Build };
export const CAD_FEATURE_EDITORS: CADFeatureEditor[] = [
  { id: "sketch", icon: "sketch", title: "Sketch 6", accept: "Apply sketch", build: (win) => {
    entities(win, "Sketch plane", ["Top Plane"], atLeast(1, "Select a sketch plane."));
    win.row("Disable imprinting", checkbox());
    win.row("Show constraints", checkbox(true));
    win.row("Show expressions", checkbox());
    win.row("Show errors", checkbox(true));
  } },
  { id: "extrude", icon: "extrude", title: "Extrude 1", accept: "Apply extrude", build: (win) => {
    bodyTabs(win);
    entities(win, "Faces and sketch regions to extrude", ["Sketch 6"], atLeast(1, "Extrude needs a profile region."));
    const endType = win.picker(["Blind", "Symmetric", "Up to next", "Up to face", "Up to vertex", "Through all"], { ariaLabel: "End type", onChange: () => sync() });
    win.body.append(endType.element);
    const depth = win.row("Depth", input("25"), unit("mm"));
    const upTo = win.entitiesBox("Up to entity");
    upTo.render([{ label: "Face 12", onRemove: () => {} }]);
    nested(win, "Draft", "checkbox", [["Draft angle", input("3"), unit("deg")]]);
    const direction = nested(win, "Direction", "disclosure", [["Flip direction", checkbox()], ["Direction reference", win.picker(["Normal to sketch", "Custom"], { ariaLabel: "Direction reference" }).element]]);
    nested(win, "Starting offset", "checkbox", [["Offset distance", input("0"), unit("mm")], ["Opposite direction", checkbox()]]);
    const second = nested(win, "Second end position", "checkbox", [["Second end type", win.picker(["Blind", "Up to face", "Through all"], { ariaLabel: "Second end type" }).element], ["Second depth", input("10"), unit("mm")]]);
    function sync() {
      const value = endType.value();
      depth.hidden = !(value === "Blind" || value === "Symmetric");
      upTo.element.hidden = !value.startsWith("Up to ") || value === "Up to next";
      direction.element.hidden = value === "Symmetric";
      second.element.hidden = value === "Symmetric" || value === "Through all";
    }
    sync();
  } },
  { id: "revolve", icon: "revolve", title: "Revolve 1", accept: "Apply revolve", build: (win) => {
    bodyTabs(win);
    entities(win, "Faces and sketch regions to revolve", ["Sketch 6"], atLeast(1, "Revolve needs a profile region."));
    entities(win, "Revolve axis", ["Origin · Y axis"], atLeast(1, "Revolve needs an axis."));
    win.row("Full revolve", checkbox(true));
  } },
  { id: "sweep", icon: "sweep", title: "Sweep 1", accept: "Apply sweep", build: (win) => {
    bodyTabs(win);
    entities(win, "Faces and sketch regions to sweep", ["Sketch 6"], atLeast(1, "Sweep needs a profile."));
    entities(win, "Sweep path", ["Curve 1"], atLeast(1, "Sweep needs a path."));
    win.row("Profile control", win.picker(["None", "Follow path", "Lock direction"], { ariaLabel: "Profile control" }).element);
    win.row("Twist", checkbox());
    win.row("Scale", checkbox());
  } },
  { id: "loft", icon: "loft", title: "Loft 1", accept: "Apply loft", build: (win) => {
    bodyTabs(win);
    entities(win, "Profiles", ["Sketch 6", "Sketch 7"], atLeast(2, "Loft needs at least two profiles."));
    win.row("Start profile condition", win.picker(["None", "Normal", "Tangent"], { ariaLabel: "Start profile condition" }).element);
    win.row("End profile condition", win.picker(["None", "Normal", "Tangent"], { ariaLabel: "End profile condition" }).element);
    for (const label of ["Guides and continuity", "Path", "Connections", "Show isocurves"]) win.row(label, checkbox());
  } },
  { id: "thicken", icon: "thicken", title: "Thicken 1", accept: "Apply thicken", build: (win) => {
    win.tabs(["New", "Add", "Remove", "Intersect"]);
    entities(win, "Faces and surfaces to thicken", ["Surface 1"], atLeast(1, "Thicken needs a face or surface."));
    win.row("Mid plane", checkbox());
    win.row("Thickness 1", input("5"), unit("mm"));
    win.row("Thickness 2", input("0"), unit("mm"));
    win.row("Keep tools", checkbox());
  } },
  { id: "enclose", icon: "boolean", title: "Enclose 1", accept: "Apply enclose", build: (win) => {
    win.tabs(["New", "Add", "Remove", "Intersect"]);
    entities(win, "Entities", ["Body 1"], atLeast(1, "Enclose needs at least one entity."));
    win.row("Keep tools", checkbox());
  } },
  { id: "plane", icon: "plane", title: "Plane 2", accept: "Apply plane", build: (win) => {
    entities(win, "Entities", ["Top plane"], atLeast(1, "Offset needs exactly 1 reference."));
    win.body.append(win.picker(["Offset", "Mid plane"], { ariaLabel: "Plane method" }).element);
    win.row("Offset distance", input("25"), unit("mm"));
    win.row("Flip normal", checkbox());
  } },
  { id: "mate", icon: "hinge", title: "Revolute 1", accept: "Accept mate", build: (win) => {
    entities(win, "Mate connectors", ["Moving · Bracket · Shaft axis", "Fixed · Base · Hub center"], (count) => count === 2 ? null : "A mate needs exactly two connectors.");
    win.body.append(win.picker(["Fastened", "Revolute", "Slider", "Cylindrical", "Pin slot", "Planar", "Ball"], { ariaLabel: "Mate type" }).element);
    win.row("Flip primary axis", checkbox());
    win.row("Offset Z", input("12"), unit("mm"));
  } },
];

export function FeatureEditor({ editor, variant = "standard" }: { editor: typeof CAD_FEATURE_EDITORS[number]; variant?: "standard" | "spacious" }) {
  const host = useRef<HTMLDivElement>(null);
  const [iconHost, setIconHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = host.current!;
    // Accept/discard rebuild the window, so the specimen always returns to its default.
    let current: FeatureWindow | undefined;
    const open = () => {
      current?.close();
      el.replaceChildren();
      const icon = document.createElement("span");
      const win = openFeatureWindow({ viewport: el, className: "gallery-demo", title: editor.title, variant, headerIcon: icon, acceptLabel: editor.accept, discardLabel: "Discard", onAccept: open, onDiscard: open });
      current = win;
      Object.assign(win.panel.style, { position: "relative", top: "0", right: "auto", left: "auto" });
      editor.build(win);
      setIconHost(icon);
    };
    open();
    return () => { current?.close(); el.replaceChildren(); };
  }, [editor, variant]);
  return <div className="cad-feature-editor" ref={host} aria-label={`${editor.title} editor`} role="group">
    {iconHost && createPortal(<ToolIcon name={editor.icon} />, iconHost)}
  </div>;
}

export function CADFeatureEditors() {
  return <div className="cad-feature-editors">{CAD_FEATURE_EDITORS.map((editor) => <FeatureEditor key={editor.id} editor={editor} />)}</div>;
}
