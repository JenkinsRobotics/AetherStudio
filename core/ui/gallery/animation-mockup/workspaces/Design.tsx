/** DesignWorkspace.swift — the UI sandbox: place placeholder shapes with an armed tool, browse Documents/Features/Bodies/Mates. */
import { useRef, useState } from "react";
import { AD, DotGrid, PartPropertiesPanel, Sym, TreeRow, WorkspaceScaffold, panelStack, useKitShell, usePanelStack, type DesignShape } from "../../../src/Kit";
import type { AppState } from "../AnimationMockupApp";
import { CATALOG, useDemo } from "../model";

const TABS = [{ id: "Documents", icon: "duplicate" }, { id: "Features", icon: "list-tree" }, { id: "Bodies", icon: "cube" }, { id: "Mates", icon: "nodes" }];

/** Stand-in feature history matching the reference tree. */
const SAMPLE_HISTORY: { kind: string; icon: string }[] = [
  { kind: "Sketch", icon: "pencil" }, { kind: "Extrude", icon: "stack-3d" }, { kind: "Sketch", icon: "pencil" }, { kind: "Extrude", icon: "stack-3d" },
  { kind: "Shell", icon: "cube-transparent" }, { kind: "Sketch", icon: "pencil" }, { kind: "Extrude", icon: "stack-3d" },
];

let shapeSerial = 0;

export function DesignWorkspace(_: { app: AppState }) {
  const demo = useDemo();
  const shell = useKitShell();
  const [leftPanels, leftActions] = usePanelStack(() => panelStack(TABS.map((t) => t.id), ["Features"], "left", true));
  const [defaultGeometryOpen, setDefaultGeometryOpen] = useState(true);
  const canvas = useRef<HTMLDivElement>(null);
  const selected = demo.shapes.find((s) => s.id === demo.selectedShapeID);

  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = canvas.current?.getBoundingClientRect(); if (!box) return;
    if (!shell.armed) { demo.setSelectedShapeID(null); return; }
    const shape: DesignShape = { id: `shape-${++shapeSerial}`, kind: shell.armed.tool.label, icon: shell.armed.tool.icon, tint: shell.armed.tint, x: (e.clientX - box.left) / Math.max(box.width, 1), y: (e.clientY - box.top) / Math.max(box.height, 1), size: 76, material: "Not set", appearance: "Not set", opacity: 1, visible: true, rotation: [0, 0, 0] };
    demo.setShapes([...demo.shapes, shape]); demo.setSelectedShapeID(shape.id); shell.committed();
  };
  const drag = (shape: DesignShape) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    demo.setSelectedShapeID(shape.id);
    const box = canvas.current?.getBoundingClientRect(); if (!box) return;
    let moved = false;
    const move = (ev: PointerEvent) => { moved = true; demo.setShapes(demo.shapes.map((s) => (s.id === shape.id ? { ...s, x: (ev.clientX - box.left) / box.width, y: (ev.clientY - box.top) / box.height } : s))); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); if (!moved) demo.setSelectedShapeID(shape.id); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // Numbers each feature per type in creation order, like a real feature tree.
  const numbered = (() => { const counts: Record<string, number> = {}; return [...SAMPLE_HISTORY.map((h) => ({ ...h, id: null as string | null })), ...demo.shapes.map((s) => ({ kind: s.kind, icon: s.icon, id: s.id }))].map((f) => { counts[f.kind] = (counts[f.kind] ?? 0) + 1; return { ...f, label: `${f.kind} ${counts[f.kind]}` }; }); })();

  const sectionHeader = (text: string) => <div className="aui-kit-between" style={{ padding: "8px 0 3px" }}><span className="aui-kit-caption">{text}</span><Sym name="plus" size={10} weight="semibold" className="aui-kit-t3" /></div>;
  const heading = (text: string) => <span className="aui-kit-pref-label" style={{ padding: "4px 0 3px" }}>{text}</span>;
  const browser = (tab: string) => {
    switch (tab) {
      case "Documents": return (<div className="stack-0">{sectionHeader("PARTS")}{["ARCADP001", "ARCADP002", "ARCADP002 Copy 1", "ARCADP003", "ARCADP004"].map((n) => <TreeRow key={n} icon="document" title={n} selected={n === "ARCADP001"} />)}{sectionHeader("ASSEMBLIES")}{["Rover Assembly", "Drivetrain"].map((n) => <TreeRow key={n} icon="stack-3d" title={n} />)}</div>);
      case "Bodies": return (<div className="stack-0">{heading("Part files")}{["Rover Base", "Bracket L", "Bracket R", "Cover"].map((n) => <TreeRow key={n} icon="cube-filled" title={n} />)}</div>);
      case "Mates": return (<div className="stack-0">{heading("Mates")}{[["Base → Bracket L", "revolute"], ["Base → Bracket R", "revolute"], ["Cover → Base", "link"]].map(([n, i]) => <TreeRow key={n} icon={i} title={n} />)}</div>);
      default: return (
        <div className="stack-0">
          <button type="button" className="aui-kit-plain design-group-head" aria-expanded={defaultGeometryOpen} onClick={() => setDefaultGeometryOpen(!defaultGeometryOpen)}><Sym name="chevron-right" size={9} weight="semibold" className="aui-kit-t3" style={{ transform: defaultGeometryOpen ? "rotate(90deg)" : undefined }} /><span>Default geometry</span></button>
          {defaultGeometryOpen && (<><TreeRow depth={1} icon="dot-circle" title="Origin" />{["Top", "Front", "Right"].map((n) => <TreeRow key={n} depth={1} icon="squares-dashed" title={n} muted />)}</>)}
          {numbered.map((f, i) => <TreeRow key={`${f.label}-${i}`} icon={f.icon} title={f.label} selected={f.id !== null && demo.selectedShapeID === f.id} onTap={f.id ? () => demo.setSelectedShapeID(f.id) : undefined} />)}
        </div>);
    }
  };

  return (
    <WorkspaceScaffold toolGroups={CATALOG.design.groups} toolCategories={CATALOG.design.categories} toolArmGroup={CATALOG.design.armGroup}
      leftTabs={TABS} leftPanels={leftPanels} leftActions={leftActions}
      center={(
        <div ref={canvas} className="design-canvas" onClick={place} data-armed={shell.armed ? "" : undefined}>
          <DotGrid step={40} opacity={0.5} />
          {demo.shapes.map((s) => (
            <button key={s.id} type="button" className="design-shape" data-selected={demo.selectedShapeID === s.id || undefined} style={{ "--tint": s.tint, left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: s.size, height: s.size, opacity: s.visible ? s.opacity : 0.25 } as React.CSSProperties}
              onPointerDown={drag(s)} onClick={(e) => e.stopPropagation()}><Sym name={s.icon} size={22} weight="light" /><span>{s.kind}</span></button>))}
        </div>
      )}
      left={browser}
      inspector={selected ? <PartPropertiesPanel shape={selected} onChange={(s) => demo.setShapes(demo.shapes.map((x) => (x.id === s.id ? s : x)))} onDelete={(id) => { demo.setShapes(demo.shapes.filter((s) => s.id !== id)); demo.setSelectedShapeID(null); }} /> : <p className="aui-kit-hint" style={{ padding: "18px 0" }}>Nothing selected</p>} />
  );
}

export const designTint = AD.accent;
