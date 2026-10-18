/** HomeAssets.swift — CharacterWorkspace, CharacterTools, PartsCenterView; RealViewport's chrome as EngineViewport. */
import { useEffect, useState, type ReactNode } from "react";
import {
  AD, Divider, EmptyStage, Field, MoveGizmo, NewCharacterDialog, PanelAction, PerformanceHUD, Segmented, Sym, TreeRow, TreeView, ViewCube, ViewportMock,
  WorkspaceScaffold, panelStack, useKitShell, useContentInsets, usePanelStack,
} from "../../../src/Kit";
import type { AppState } from "../AnimationMockupApp";
import { CATALOG, CHARACTER_ACTIONS, useDemo, type Part } from "../model";
import { useTray } from "../tray";

const SECTIONS = [
  { id: "Parts", icon: "package" }, { id: "Source Assets", icon: "cube" }, { id: "Renders", icon: "image" },
  { id: "Assemblies", icon: "stack-3d" }, { id: "Scripts", icon: "braces" }, { id: "Animations", icon: "curve" },
] as const;

/** The real viewport's chrome — engine badge, view cube, pinned HUD, move gizmo — over the mock stage. */
export function EngineViewport({ app, part, onSelectPart, onDeselect }: { app: AppState; part: Part; onSelectPart?: () => void; onDeselect?: () => void }) {
  const [camera, setCamera] = useState({ yaw: 0.7, pitch: 0.42 });
  const [gizmo, setGizmo] = useState(false);
  const { view } = useKitShell();
  return (
    <ViewportMock selected showGizmo={false} onTapPart={onSelectPart} onTapCanvas={onDeselect}>
      <div className="viewport-badge" aria-hidden><Sym name="cpu" size={9} /><span>{app.render.engine}</span><span className="aui-kit-hair" /><span>{part.name} · {part.triangles.toLocaleString()} tris</span></div>
      {app.render.showViewCube && view.showViewCube && <div className="viewport-cube"><ViewCube yaw={camera.yaw} pitch={camera.pitch} onSelect={(yaw, pitch) => setCamera({ yaw, pitch })} /></div>}
      {app.render.pinPerformance && <div className="viewport-hud"><PerformanceHUD engine={app.render.engine} fps={60} cpuPercent={4.2} memoryMB={318.4} loadMs={part.importMs} triangles={part.triangles} onClose={() => app.setRender({ ...app.render, pinPerformance: false })} /></div>}
      <button type="button" className="viewport-move-toggle" aria-pressed={gizmo} onClick={(e) => { e.stopPropagation(); setGizmo(!gizmo); }} title="Move controls"><Sym name="move" size={12} /></button>
      {gizmo && <div className="viewport-gizmo"><MoveGizmo onDismiss={() => setGizmo(false)} /></div>}
    </ViewportMock>
  );
}

export function CharacterWorkspace({ app }: { app: AppState }) {
  const demo = useDemo();
  const shell = useKitShell();
  const [leftPanels, leftActions] = usePanelStack(() => panelStack(["Characters", ...SECTIONS.map((s) => s.id)], ["Characters"], "left"));
  const [filter, setFilter] = useState("");
  const [charactersExpanded, setCharactersExpanded] = useState(true);
  const [expanded, setExpanded] = useState<string[]>(demo.characters.map((c) => c.id));
  const [focusedFolder, setFocusedFolder] = useState<string | null>(null);
  const character = demo.characters.find((c) => c.id === demo.activeCharacterID) ?? demo.characters[0];
  const part = demo.parts.find((p) => p.id === demo.selectedPartID);
  const tray = useTray(app, "character");

  // Import/Manage/Prepare tools are immediate actions, not canvas-arm tools.
  useEffect(() => {
    shell.actionHandler.current = (tool) => {
      if (!CHARACTER_ACTIONS.has(tool.label)) return false;
      switch (tool.label) {
        case "Character": demo.setShowNewCharacter(true); break;
        case "3D Model": case "Replace": demo.importModel(); break;
        case "Audio": case "Video": case "Image": demo.setStatus(`${tool.label} import — coming soon (${demo.importMode === "copy" ? "copy into project" : "link"})`); break;
        case "Reveal": demo.setStatus("Reveal in Finder (placeholder)"); break;
        case "Duplicate": if (character) demo.addCharacter(`${character.name} Copy`); break;
        default: demo.setStatus(`${tool.label} — prep step (placeholder)`);
      }
      return true;
    };
    return () => { shell.actionHandler.current = null; };
  });

  const filtered = demo.characters.filter((c) => !filter.trim() || c.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const sectionCount = (id: string) => ({ Parts: character?.parts.length ?? 0, "Source Assets": character?.sourceAssets.length ?? 0, Renders: 0, Assemblies: character?.groups.length ?? 0, Scripts: character?.channels ?? 0, Animations: character?.clips ?? 0 })[id] ?? 0;

  const charactersTab = (
    <div className="stack-0">
      <div className="aui-kit-between" style={{ padding: "0 0 6px" }}><span className="aui-kit-caption" style={{ fontSize: 10, letterSpacing: 0.4 }}>PROJECT: {demo.projectName.toUpperCase()}</span><span className="version-chip">V1</span></div>
      <div className="aui-kit-search" style={{ marginBottom: 8 }}><Sym name="search" size={11} className="aui-kit-t3" /><input placeholder="Filter project contents" aria-label="Filter project contents" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
      <Divider />
      <TreeRow icon="people" title="Project Characters" count={filtered.length} bold expandable expanded={charactersExpanded} onToggleExpand={() => setCharactersExpanded(!charactersExpanded)} onTap={() => setCharactersExpanded(!charactersExpanded)} />
      {charactersExpanded && (filtered.length === 0
        ? <p className="aui-kit-hint">{demo.characters.length === 0 ? "No characters yet — create one to start assembling parts." : "No matches."}</p>
        : filtered.map((c) => {
          const active = character?.id === c.id, open = expanded.includes(c.id);
          return (
            <div key={c.id}>
              <TreeRow depth={1} icon="figure-stand" title={c.name} selected={active} expandable expanded={open} onToggleExpand={() => setExpanded(open ? expanded.filter((e) => e !== c.id) : [...expanded, c.id])} onTap={() => demo.setActiveCharacterID(c.id)}
                trailing={active ? <Sym name="circle-filled" size={6} style={{ color: AD.accent }} /> : undefined} />
              {open && SECTIONS.map((s) => (
                <TreeRow key={s.id} depth={2} icon={s.icon} title={s.id} count={sectionCount(s.id)} selected={active && focusedFolder === s.id}
                  onTap={() => { demo.setActiveCharacterID(c.id); setFocusedFolder(s.id); if (!leftPanels.enabled.includes(s.id)) leftActions.toggle(s.id); }} />))}
            </div>);
        }))}
    </div>
  );

  const partsTab = (
    <div className="stack-0">
      <span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4, paddingBottom: 3 }}>{character ? `${character.name} · ${demo.parts.length} parts` : "no character"}</span>
      {demo.parts.length === 0 ? <p className="aui-kit-hint">Import a STEP file to add parts to this character.</p>
        : <TreeView model={demo.partsTree} onChange={demo.setPartsTree} ariaLabel="Parts" onActivate={(node) => node.payload && demo.setSelectedPartID(node.payload)} />}
      <Divider style={{ marginTop: 4 }} />
      <div className="aui-kit-between" style={{ padding: "6px 0 0" }}><span className="aui-kit-caption" style={{ fontSize: 8.5 }}>NEW IMPORTS</span>
        <Segmented options={[{ id: "copy", label: "Copy" }, { id: "link", label: "Link" }]} value={demo.importMode} onChange={demo.setImportMode} ariaLabel="New imports" size="mini" /></div>
      <p className="aui-kit-t3" style={{ fontSize: 9.5, padding: "4px 0 2px" }}>{demo.importMode === "copy" ? "Copies the file into the project so it travels with it." : "References the file where it is; moving it breaks the link."}</p>
      <div className="aui-kit-hstack-8" style={{ padding: "10px 0" }}><PanelAction icon={demo.importing ? "hourglass" : "plus"} label="Import Model" onClick={demo.importModel} /></div>
    </div>
  );

  const genericSection = (section: (typeof SECTIONS)[number]) => {
    const rows: { title: string; detail: string }[] = ({
      Parts: [],
      "Source Assets": (character?.sourceAssets ?? []).map((a) => ({ title: a, detail: "source" })),
      Renders: [], Assemblies: (character?.groups ?? []).map((g) => ({ title: g, detail: "group" })),
      Scripts: demo.channels.map((c) => ({ title: `Channel ${c.channel}`, detail: "servo" })),
      Animations: demo.clips.map((c) => ({ title: c.name, detail: `${c.duration.toFixed(1)}s` })),
    } as Record<string, { title: string; detail: string }[]>)[section.id] ?? [];
    return (
      <div className="stack-0">
        <span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4, padding: "0 0 3px" }}>{(character?.name ?? "—").toUpperCase()} · {rows.length} {section.id.toUpperCase()}</span>
        {rows.length === 0 && <p className="aui-kit-hint">No {section.id.toLowerCase()} yet.</p>}
        {rows.map((r) => <TreeRow key={r.title} icon={section.icon} title={r.title} detail={r.detail} />)}
        <Divider style={{ marginTop: 4 }} />
        <div className="aui-kit-hstack-8" style={{ padding: 10 }}><PanelAction icon="plus" label="Add" onClick={() => demo.setStatus(`Add ${section.id} (placeholder)`)} /><PanelAction icon="folder-add" label="Folder" onClick={() => demo.setStatus(`New folder in ${section.id} (placeholder)`)} /></div>
      </div>
    );
  };

  const inspector = part ? (
    <>
      <Field label="Source" value={part.name} /><Field label="Faces" value={String(part.faces)} /><Field label="Edges" value={String(part.edges)} /><Field label="Triangles" value={part.triangles.toLocaleString()} /><Field label="Import" value={String(part.importMs)} unit="ms" />
      <Divider />
      <span className="aui-kit-caption">STATUS</span>
      <span className="status-dot" style={{ "--tint": AD.ok } as React.CSSProperties}><Sym name="status-ok" size={10} />Geometry OK</span>
      <span className="status-dot" style={{ "--tint": AD.warn } as React.CSSProperties}><Sym name="status-error" size={10} />Not rigged</span>
      <button type="button" className="aui-kit-wide-btn" data-danger onClick={() => demo.removePart(part.id)}><Sym name="delete" size={12} />Remove</button>
    </>
  ) : <p className="aui-kit-hint" style={{ padding: "18px 0" }}>Nothing selected</p>;

  const center = (
    <div className="center-stack">
      {part ? <EngineViewport app={app} part={part} onDeselect={() => demo.setSelectedPartID(null)} /> : <EmptyStage status={demo.status} importAction={demo.importModel} />}
      {demo.centerView !== "3D" && <PartsCenterView mode={demo.centerView} />}
    </div>
  );

  return (
    <>
      <WorkspaceScaffold toolGroups={CATALOG.character.groups} toolArmGroup={CATALOG.character.armGroup}
        leftTabs={[{ id: "Characters", icon: "character" }, ...SECTIONS]} leftPanels={leftPanels} leftActions={leftActions}
        centerTabs={[{ id: "3D", icon: "cube" }, { id: "Gallery", icon: "grid-2" }, { id: "Table", icon: "list" }]} centerSelection={demo.centerView} onCenterSelect={demo.setCenterView}
        center={center} left={(id) => (id === "Characters" ? charactersTab : id === "Parts" ? partsTab : genericSection(SECTIONS.find((s) => s.id === id)!))} inspector={inspector} tray={tray} />
      {demo.showNewCharacter && <div className="animation-mockup-scrim" onClick={() => demo.setShowNewCharacter(false)}><div onClick={(e) => e.stopPropagation()}><NewCharacterDialog onCancel={() => demo.setShowNewCharacter(false)} onCreate={(name) => { demo.addCharacter(name); demo.setShowNewCharacter(false); }} /></div></div>}
    </>
  );
}

/** The Character center in Gallery/Table mode, constrained to the visible zone. */
function PartsCenterView({ mode }: { mode: string }) {
  const insets = useContentInsets();
  const demo = useDemo();
  const header = <div className="parts-center-head"><strong>{demo.projectName} · Parts</strong><span className="aui-kit-t3 aui-kit-s11">{demo.parts.length} parts</span></div>;
  const cell = (text: string, width: number | null, opts: { header?: boolean; strong?: boolean; mono?: boolean; trailing?: boolean } = {}): ReactNode => (
    <span className="parts-cell" data-header={opts.header || undefined} data-strong={opts.strong || undefined} data-mono={opts.mono || undefined} style={{ width: width ?? undefined, flex: width ? "none" : 1, textAlign: opts.trailing ? "right" : "left" }}>{text}</span>
  );
  return (
    <div className="parts-center" style={{ inset: `${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px` }}>
      {header}<Divider />
      {mode === "Gallery" ? (
        <div className="parts-gallery aui-kit-scroll">
          {demo.parts.map((p) => (
            <button key={p.id} type="button" className="parts-tile" data-selected={demo.selectedPartID === p.id || undefined} onClick={() => demo.setSelectedPartID(p.id)}>
              <span className="parts-tile-thumb"><Sym name="cube" size={30} weight="light" /><small>{p.triangles} tris</small></span>
              <span className="parts-tile-text"><strong>{p.name}</strong><span>{p.faces} faces</span></span>
            </button>))}
        </div>
      ) : (
        <div className="parts-table aui-kit-scroll">
          <div className="parts-row" data-header>{cell("PART", null, { header: true })}{cell("TYPE", 120, { header: true })}{cell("MATERIAL", 120, { header: true })}{cell("FACES", 80, { header: true, trailing: true })}{cell("TRIS", 96, { header: true, trailing: true })}{cell("SIZE (MM)", 130, { header: true })}</div>
          <Divider />
          {demo.parts.map((p) => (
            <div key={p.id} className="parts-row" data-selected={demo.selectedPartID === p.id || undefined} onClick={() => demo.setSelectedPartID(p.id)} role="button">
              {cell(p.name, null, { strong: true })}{cell("Solid body", 120)}{cell("—", 120)}{cell(String(p.faces), 80, { mono: true, trailing: true })}{cell(String(p.triangles), 96, { mono: true, trailing: true })}{cell("—", 130)}
            </div>))}
        </div>
      )}
    </div>
  );
}
