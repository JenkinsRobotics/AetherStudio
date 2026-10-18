/** RigAnimate.swift — RigWorkspace + AssetLibraryPanel, AnimateWorkspace. */
import { useEffect, useState } from "react";
import {
  AD, CurveInspector, Divider, DopeSheetTimeline, EmptyStage, ListRow, MATE_TYPES, MateInspector, PanelAction, Segmented, Sym, TreeRow, TreeView, WorkspaceScaffold,
  mateType, panelStack, treeNode, usePanelStack, type TimelineTrack,
} from "../../../src/Kit";
import type { AppState } from "../AnimationMockupApp";
import { CATALOG, keyValue, useDemo } from "../model";
import { EngineViewport } from "./Character";
import { useTray } from "../tray";

export function RigWorkspace({ app }: { app: AppState }) {
  const demo = useDemo();
  const [leftPanels, leftActions] = usePanelStack(() => panelStack(["Assets", "Structure", "Mates"], ["Mates"], "left"));
  const [assetView, setAssetView] = useState<"compact" | "thumbnail">("compact");
  const tray = useTray(app, "rig");
  const part = demo.parts.find((p) => p.id === demo.selectedPartID);
  const partName = (id: string) => demo.parts.find((p) => p.id === id)?.name ?? "—";
  const selectedMate = demo.mates.find((m) => m.id === demo.selectedMateID);

  const importAsset = (name: string, icon: string, payload?: string) => {
    demo.setAssembly({ ...demo.assembly, nodes: [...demo.assembly.nodes, treeNode(name, icon, { payload })] });
    demo.setStatus(`Imported ${name} into the assembly`);
  };

  const assetsPanel = (
    <div className="stack-0">
      <div className="aui-kit-between" style={{ paddingBottom: 8 }}><span className="aui-kit-caption">LIBRARY</span>
        <Segmented options={[{ id: "compact", icon: "list", label: "List" }, { id: "thumbnail", icon: "grid-2", label: "Tiles" }]} value={assetView} onChange={setAssetView} ariaLabel="Asset view" /></div>
      <Divider />
      <div className="aui-kit-between" style={{ padding: "8px 0 3px" }}><span className="aui-kit-caption" style={{ fontSize: 9 }}>PARTS</span><span className="aui-kit-t3" style={{ fontSize: 9 }}>{demo.parts.length}</span></div>
      {demo.parts.length === 0 ? <p className="aui-kit-hint">Import parts in the Character tab first.</p>
        : assetView === "compact" ? demo.parts.map((p) => (
          <div key={p.id} className="asset-row"><Sym name="cube" size={12} style={{ color: AD.accent2, width: 18 }} /><span className="aui-kit-stack-1"><span>{p.name}</span><small>{p.faces}f</small></span><span className="aui-kit-spacer" />
            <button type="button" className="aui-kit-plain" aria-label={`Import ${p.name} into the assembly`} title="Import into the assembly" style={{ color: AD.accent }} onClick={() => importAsset(p.name, "cube", p.id)}><Sym name="plus-circle-filled" size={14} /></button></div>))
          : <div className="asset-tiles">{demo.parts.map((p) => (
            <div key={p.id} className="asset-tile"><span className="asset-tile-thumb"><Sym name="cube" size={26} weight="light" /><button type="button" className="aui-kit-plain" aria-label={`Import ${p.name}`} style={{ color: AD.accent }} onClick={() => importAsset(p.name, "cube", p.id)}><Sym name="plus-circle-filled" size={14} /></button></span><span>{p.name}</span></div>))}</div>}
      <div className="aui-kit-between" style={{ padding: "8px 0 3px" }}><span className="aui-kit-caption" style={{ fontSize: 9 }}>ASSEMBLIES</span><span className="aui-kit-t3" style={{ fontSize: 9 }}>1</span></div>
      <div className="asset-row"><Sym name="stack-3d" size={12} style={{ color: AD.accent2, width: 18 }} /><span>Drivetrain</span><span className="aui-kit-spacer" />
        <button type="button" className="aui-kit-plain" aria-label="Import Drivetrain sub-assembly" title="Import this sub-assembly" style={{ color: AD.accent }} onClick={() => importAsset("Drivetrain", "stack-3d")}><Sym name="plus-circle-filled" size={14} /></button></div>
    </div>
  );

  const structurePanel = (
    <div className="stack-0">
      <span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4, padding: "0 0 3px" }}>CURRENT ASSEMBLY · {demo.assembly.nodes.length} ITEMS</span>
      {demo.assembly.nodes.length === 0 ? <div className="empty-hint"><Sym name="tray" size={20} className="aui-kit-t3" /><strong>Empty assembly</strong><span>Open the Assets panel and import parts into this assembly.</span></div>
        : (<><TreeView model={demo.assembly} onChange={demo.setAssembly} ariaLabel="Assembly" onActivate={(n) => { if (n.payload) demo.setSelectedParts([...demo.selectedParts.filter((id) => id !== n.payload), n.payload].slice(-2)); }} />
          <Divider /><div className="aui-kit-hstack-8" style={{ padding: 10 }}><PanelAction icon="import" label="Save Assembly" onClick={() => demo.setStatus("Assembly saved to assets/assemblies (placeholder)")} /></div></>)}
    </div>
  );

  const matesPanel = (
    <div className="stack-0">
      <span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4, padding: "0 0 3px" }}>{demo.mates.length} AUTHORED</span>
      {demo.mates.map((m) => <TreeRow key={m.id} icon={mateType(m.type).icon} title={m.name} detail={`${partName(m.parent)} → ${partName(m.child)}`} selected={demo.selectedMateID === m.id} onTap={() => demo.setSelectedMateID(m.id)} />)}
      <Divider style={{ marginTop: 4 }} />
      <div className="aui-kit-stack-8" style={{ padding: 10 }}>
        <p className="aui-kit-t3" style={{ fontSize: 9.5 }}>{demo.selectedParts.length >= 2 ? "Create a mate between the 2 selected parts" : "Select two parts in Structure to create a mate"}</p>
        <div className="aui-kit-hstack-5">{MATE_TYPES.map((t) => <button key={t.id} type="button" className="mate-type-btn" disabled={demo.selectedParts.length < 2} title={t.label} aria-label={t.label} onClick={() => demo.addMate(t.id)}><Sym name={t.icon} size={12} /></button>)}</div>
      </div>
    </div>
  );

  return (
    <WorkspaceScaffold toolGroups={CATALOG.rig.groups} toolArmGroup={CATALOG.rig.armGroup}
      leftTabs={[{ id: "Assets", icon: "package" }, { id: "Structure", icon: "cube-transparent" }, { id: "Mates", icon: "nodes" }]} leftPanels={leftPanels} leftActions={leftActions}
      center={<div className="center-stack">{part ? <EngineViewport app={app} part={part} /> : <EmptyStage status="Import a model in Assets, then rig it here." importAction={demo.importModel} />}</div>}
      left={(id) => (id === "Assets" ? assetsPanel : id === "Structure" ? structurePanel : matesPanel)} tray={tray}
      inspector={selectedMate ? <MateInspector mate={selectedMate} onChange={(m) => demo.setMates(demo.mates.map((x) => (x.id === m.id ? m : x)))} parentName={partName(selectedMate.parent)} childName={partName(selectedMate.child)} onDelete={() => demo.removeMate(selectedMate.id)} /> : <p className="aui-kit-hint" style={{ padding: "18px 0" }}>Select a mate</p>} />
  );
}

export function AnimateWorkspace({ app }: { app: AppState }) {
  const demo = useDemo();
  const [leftPanels, leftActions] = usePanelStack(() => panelStack(["Clips", "Channels"], ["Clips"], "left"));
  const part = demo.parts.find((p) => p.id === demo.selectedPartID);
  const tray = useTray(app, "animate");
  const clip = demo.clips.find((c) => c.id === demo.selectedClipID) ?? demo.clips[0];
  const duration = Math.max(clip?.duration ?? 8, 0.1);
  const progress = Math.min(Math.max(demo.time / duration, 0), 1);

  // Playback: advance the playhead and pose the rig from the clip's tracks.
  useEffect(() => {
    if (!demo.isPlaying) return;
    let last = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      demo.scrub(((demo.time + dt) % duration) / duration);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  });
  useEffect(() => {
    if (!clip) return;
    const next = demo.mates.map((m) => { const track = clip.tracks.find((t) => t.mateID === m.id); const v = track ? keyValue(track.keys, demo.time) : null; return v == null || v === m.value ? m : { ...m, value: v }; });
    if (next.some((m, i) => m !== demo.mates[i])) demo.setMates(next);
  }, [demo.time]); // eslint-disable-line react-hooks/exhaustive-deps

  const tracks: TimelineTrack[] = demo.mates.map((m) => ({ id: m.id, name: m.name, color: mateType(m.type).driven ? AD.accent : AD.text3, keys: (clip?.tracks.find((t) => t.mateID === m.id)?.keys ?? []).map((k) => Math.min(Math.max(k.time / duration, 0), 1)) }));
  const keyCount = (mateID: string) => clip?.tracks.find((t) => t.mateID === mateID)?.keys.length ?? 0;

  const clipsTab = (
    <div className="stack-0">
      {demo.clips.map((c) => <ListRow key={c.id} icon="video" title={c.name} detail={`${c.duration.toFixed(1)} s`} selected={clip?.id === c.id} onClick={() => demo.setSelectedClipID(c.id)} />)}
      <Divider style={{ marginTop: 4 }} />
      <div className="aui-kit-hstack-8" style={{ padding: 10 }}><PanelAction icon="plus" label="Clip" onClick={demo.addClip} /><PanelAction icon="duplicate" onClick={() => demo.setStatus("Duplicate clip (placeholder)")} /></div>
    </div>
  );
  const channelsTab = (
    <div className="stack-0">
      <span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4, padding: "0 0 3px" }}>{demo.mates.length} FROM RIG</span>
      {demo.mates.length === 0 && <p className="aui-kit-hint">Author mates in Rig to animate them.</p>}
      {demo.mates.map((m) => <ListRow key={m.id} icon={mateType(m.type).icon} title={m.name} detail={`${m.value.toFixed(1)}${mateType(m.type).unit}`} selected={demo.selectedMateID === m.id} statusColor={keyCount(m.id) > 0 ? AD.ok : undefined} onClick={() => demo.setSelectedMateID(m.id)} />)}
    </div>
  );

  return (
    <WorkspaceScaffold toolGroups={CATALOG.animate.groups} toolArmGroup={CATALOG.animate.armGroup}
      leftTabs={[{ id: "Clips", icon: "film-stack" }, { id: "Channels", icon: "layers" }]} leftPanels={leftPanels} leftActions={leftActions}
      center={(
        <div className="center-stack">
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>{part ? <EngineViewport app={app} part={part} /> : <EmptyStage status="Import a model in Assets, rig it, then animate here." importAction={demo.importModel} />}</div>
          <DopeSheetTimeline tracks={tracks} progress={progress} duration={duration} isPlaying={demo.isPlaying} onScrub={demo.scrub} onTogglePlay={() => demo.setPlaying(!demo.isPlaying)} onRewind={() => demo.scrub(0)}
            onAddKey={() => { const m = demo.mates.find((x) => x.id === demo.selectedMateID) ?? demo.mates[0]; if (m) demo.addKey(m.id, m.value); }} style={{ height: 268, margin: 12, flexShrink: 0 }} />
        </div>
      )}
      left={(id) => (id === "Clips" ? clipsTab : channelsTab)} inspector={<CurveInspector />} tray={tray} />
  );
}
