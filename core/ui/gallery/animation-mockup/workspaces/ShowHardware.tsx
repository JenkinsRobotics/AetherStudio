/** ShowHardware.swift — ShowWorkspace (node graph) and HardwareWorkspace (wiring + servo readout). */
import { useEffect } from "react";
import {
  AD, CalibrationRangeBar, DeviceIdentity, Divider, DotGrid, Field, GraphNode, ListRow, PanelCard, Pill, PropertyField, Row, ServoTrack, StepperField, Sym, ToggleLine, WorkspaceScaffold, mateType, panelStack, usePanelStack,
} from "../../../src/Kit";
import type { AppState } from "../AnimationMockupApp";
import { CATALOG, commandedDegrees, fractionOf, pulseOf, useDemo, type ServoChannel } from "../model";
import { useTray } from "../tray";

const NODES = [
  { name: "Trigger", icon: "trigger", detail: "Motion sensor", tint: AD.ok },
  { name: "Clip", icon: "curve", detail: "Greeting.anim", tint: AD.accent },
  { name: "Servos", icon: "cpu", detail: "6 channels", tint: AD.accent2 },
  { name: "Audio", icon: "audio", detail: "hello.wav", tint: AD.warn },
  { name: "Video", icon: "screen-play", detail: "eyes.mov", tint: AD.warn },
];

const NODE_FIELDS: Record<string, [string, string, string?][]> = {
  Trigger: [["Source", "Motion"], ["Threshold", "40", "%"], ["Debounce", "250", "ms"], ["Enabled", "Yes"]],
  Clip: [["Clip", "Greeting"], ["Length", "0:30"], ["Speed", "1.0×"], ["Loop", "Off"]],
  Servos: [["Bus", "PCA9685"], ["Channels", "6"], ["Rate", "50", "Hz"], ["Armed", "Yes"]],
  Audio: [["File", "hello.wav"], ["Volume", "80", "%"], ["Output", "L / R"]],
  Video: [["File", "eyes.mov"], ["Loop", "On"], ["Output", "HDMI-1"]],
};

export function ShowWorkspace({ app }: { app: AppState }) {
  const demo = useDemo();
  const [leftPanels, leftActions] = usePanelStack(() => panelStack(["Scenes", "Nodes"], ["Scenes"], "left"));
  const tray = useTray(app, "show");
  const node = (n: (typeof NODES)[number]) => <GraphNode key={n.name} title={n.name} icon={n.icon} sub={n.detail} tint={n.tint} width={150} selected={demo.selectedNode === n.name} onTap={() => demo.setSelectedNode(n.name)} />;
  return (
    <WorkspaceScaffold toolGroups={CATALOG.show.groups} toolArmGroup={CATALOG.show.armGroup}
      leftTabs={[{ id: "Scenes", icon: "rectangle-group" }, { id: "Nodes", icon: "nodes" }]} leftPanels={leftPanels} leftActions={leftActions}
      center={(
        <div className="graph-canvas" onClick={() => demo.setSelectedNode(null)}>
          <DotGrid />
          <div className="graph-group" onClick={(e) => e.stopPropagation()}>
            <span className="graph-group-title"><Sym name="rectangle-group" size={10} weight="semibold" />Scene · Intro</span>
            <div className="graph-row">{node(NODES[0])}{node(NODES[1])}<div className="aui-kit-stack-8" style={{ gap: 20 }}>{node(NODES[2])}{node(NODES[3])}{node(NODES[4])}</div></div>
          </div>
        </div>
      )}
      left={(id) => id === "Scenes" ? (
        <div className="stack-0">
          <Row icon="video" label="Intro" detail="0:12" tint={AD.warn} selected />
          <Row icon="video" label="Greeting" detail="0:30" /><Row icon="video" label="Idle loop" detail="∞" /><Row icon="video" label="Roar" detail="0:08" /><Row icon="video" label="Goodbye" detail="0:15" />
          <Divider style={{ marginTop: 4 }} />
          <button type="button" className="aui-kit-plain add-scene" onClick={() => demo.setStatus("Add scene (placeholder)")}><Sym name="plus" size={12} />Add scene</button>
        </div>
      ) : (
        <div className="stack-0">{NODES.map((n) => <ListRow key={n.name} icon={n.icon} title={n.name} detail={n.detail} selected={demo.selectedNode === n.name} onClick={() => demo.setSelectedNode(n.name)} />)}</div>
      )}
      inspector={demo.selectedNode ? (<><span className="aui-kit-caption">{demo.selectedNode.toUpperCase()}</span>{(NODE_FIELDS[demo.selectedNode] ?? [["—", "—"]]).map(([l, v, u]) => <Field key={l} label={l} value={v} unit={u} />)}</>) : <p className="aui-kit-hint" style={{ padding: "18px 0" }}>No selection</p>} tray={tray} />
  );
}

export function HardwareWorkspace({ app }: { app: AppState }) {
  const demo = useDemo();
  const [leftPanels, leftActions] = usePanelStack(() => panelStack(["Controller", "Channels"], ["Channels"], "left"));
  const tray = useTray(app, "hardware");
  const mateFor = (c: ServoChannel) => demo.mates.find((m) => m.id === c.mateID);
  const degrees = (c: ServoChannel) => { const m = mateFor(c); return m ? commandedDegrees(m.value, c.trimDegrees, c.inverted) : 0; };
  const fraction = (c: ServoChannel) => { const m = mateFor(c); return m ? fractionOf(degrees(c), m.minValue, m.maxValue) : 0; };
  const selected = demo.channels.find((c) => c.id === demo.selectedChannelID);
  const isSel = (c: ServoChannel) => !demo.controllerSelected && demo.selectedChannelID === c.id;
  const pick = (c: ServoChannel) => { demo.setSelectedChannelID(c.id); demo.setControllerSelected(false); };

  // Keeps one channel per driven mate — adds new ones, drops removed mates.
  useEffect(() => {
    const driven = demo.mates.filter((m) => mateType(m.type).driven);
    const kept = demo.channels.filter((c) => driven.some((m) => m.id === c.mateID)).map((c) => ({ ...c, name: driven.find((m) => m.id === c.mateID)!.name }));
    const used = new Set(kept.map((c) => c.channel));
    let next = 0;
    for (const m of driven) if (!kept.some((c) => c.mateID === m.id)) { while (used.has(next)) next += 1; used.add(next); kept.push({ id: `ch-${m.id}`, mateID: m.id, channel: next, name: m.name, trimDegrees: 0, inverted: false, minPulse: 500, maxPulse: 2500 }); }
    if (kept.length !== demo.channels.length || kept.some((c, i) => c.name !== demo.channels[i]?.name)) demo.setChannels(kept);
    if (!demo.selectedChannelID && kept[0]) demo.setSelectedChannelID(kept[0].id);
  }, [demo.mates]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (c: ServoChannel) => demo.setChannels(demo.channels.map((x) => (x.id === c.id ? c : x)));
  const home = (c: ServoChannel) => { const m = mateFor(c); if (!m) return; const raw = 0 - c.trimDegrees; demo.setMates(demo.mates.map((x) => (x.id === m.id ? { ...x, value: c.inverted ? -raw : raw } : x))); };

  const controllerInspector = (
    <>
      <span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4, color: demo.armed ? AD.danger : undefined }}>PCA9685 · CONTROLLER</span>
      <DeviceIdentity icon="cpu" name="PCA9685" detail="USB · /dev/tty.usb" tint={demo.armed ? AD.danger : AD.ok} />
      <PropertyField label="Firmware" value="v0.3.1" /><PropertyField label="Protocol" value="Wire v0" /><PropertyField label="Channels" value={String(demo.channels.length)} /><PropertyField label="Rate" value="50" unit="Hz" /><PropertyField label="Latency" value="3.1" unit="ms" />
      <Divider />
      <button type="button" className="arm-btn" data-armed={demo.armed || undefined} aria-pressed={demo.armed} onClick={() => demo.setArmed(!demo.armed)}><Sym name={demo.armed ? "bolt" : "bolt-slash"} size={12} />{demo.armed ? "ARMED — live" : "DISARMED"}</button>
      <p style={{ fontSize: 10, color: demo.armed ? AD.danger : AD.text3 }}>{demo.armed ? "Motion is being sent to hardware." : "Safe. Servos hold last position."}</p>
    </>
  );
  const calibrate = selected && (
    <div className="aui-kit-stack-11">
      <span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4 }}>{selected.name.toUpperCase()} · CH{selected.channel}</span>
      <PropertyField label="Live angle" value={degrees(selected).toFixed(1)} unit="°" /><PropertyField label="Pulse" value={pulseOf(fraction(selected), selected.minPulse, selected.maxPulse).toFixed(0)} unit="µs" />
      <Divider />
      <StepperField label="Trim" value={selected.trimDegrees} step={1} unit="°" onChange={(trimDegrees) => update({ ...selected, trimDegrees })} />
      <ToggleLine label="Invert direction" isOn={selected.inverted} onChange={(inverted) => update({ ...selected, inverted })} size="small" />
      <StepperField label="Min pulse" value={selected.minPulse} step={50} unit="µs" onChange={(minPulse) => update({ ...selected, minPulse })} />
      <StepperField label="Max pulse" value={selected.maxPulse} step={50} unit="µs" onChange={(maxPulse) => update({ ...selected, maxPulse })} />
      <span className="aui-kit-caption">MAP RANGE</span>
      <CalibrationRangeBar start={(selected.minPulse - 500) / 2000 + 0.05} end={(selected.maxPulse - 500) / 2000 - 0.05} minLabel={`${selected.minPulse}µs`} maxLabel={`${selected.maxPulse}µs`} />
      <div className="aui-kit-hstack-8"><Pill icon="undo" label="Invert" active={selected.inverted} onClick={() => update({ ...selected, inverted: !selected.inverted })} /><Pill icon="target" label="Center" onClick={() => home(selected)} /></div>
      <p className="aui-kit-hstack-6 aui-kit-t3" style={{ fontSize: 10 }}><Sym name="info" size={11} />Trim per unit; real servos drift a few %.</p>
      <Divider />
      <button type="button" className="aui-kit-wide-btn" onClick={() => home(selected)}><Sym name="home" size={11} />Home this servo</button>
    </div>
  );

  return (
    <WorkspaceScaffold toolGroups={CATALOG.hardware.groups} toolArmGroup={CATALOG.hardware.armGroup}
      leftTabs={[{ id: "Controller", icon: "cpu" }, { id: "Channels", icon: "sliders" }]} leftPanels={leftPanels} leftActions={leftActions}
      center={(
        <div className="center-stack">
          <div className="graph-canvas" style={{ flex: 1 }}>
            <DotGrid />
            <div className="graph-group" style={{ padding: 22 }}>
              <div className="graph-row" style={{ gap: 40, alignItems: "flex-start" }}>
                <GraphNode title="PCA9685" icon="cpu" sub="USB · Wire v0" tint={demo.armed ? AD.danger : AD.ok} width={150} big selected={demo.controllerSelected} badge={{ text: demo.armed ? "Armed" : "Disarmed", on: demo.armed }} onTap={() => demo.setControllerSelected(true)} />
                {demo.channels.length === 0 ? <span className="aui-kit-t3 aui-kit-s11" style={{ paddingTop: 20 }}>No channels bound</span>
                  : <div className="channel-grid">{demo.channels.map((c) => <GraphNode key={c.id} title={c.name} icon="sliders" sub={`CH${c.channel} · ${Math.round(degrees(c))}°`} tint={AD.accent2} width={140} selected={isSel(c)} onTap={() => pick(c)} />)}</div>}
              </div>
            </div>
          </div>
          <PanelCard title="Servos" subtitle={demo.isPlaying ? "live · playing" : "live"} icon="sliders-panel" tint={AD.accent2} style={{ height: 210, margin: 12, flexShrink: 0 }}>
            <div className="aui-kit-scroll" style={{ flex: 1 }}>
              {demo.channels.length === 0 && <p className="aui-kit-hint" style={{ padding: "24px 0" }}>Bound channels appear here once the rig has driven mates.</p>}
              {demo.channels.map((c) => <div key={c.id}><ServoTrack name={c.name} channel={c.channel} degrees={degrees(c)} fraction={fraction(c)} selected={isSel(c)} armed={demo.armed} onTap={() => pick(c)} /><Divider style={{ opacity: 0.5 }} /></div>)}
            </div>
          </PanelCard>
        </div>
      )}
      left={(id) => id === "Controller" ? (
        <div className="stack-0"><span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4, padding: "0 0 3px", color: demo.armed ? AD.danger : undefined }}>{demo.armed ? "ARMED" : "DISARMED"}</span>
          <ListRow icon="cpu" title="PCA9685" detail="USB" selected={demo.controllerSelected} statusColor={demo.armed ? AD.danger : AD.ok} onClick={() => demo.setControllerSelected(true)} /></div>
      ) : (
        <div className="stack-0"><span className="aui-kit-caption" style={{ fontSize: 8.5, letterSpacing: 0.4, padding: "0 0 3px" }}>{demo.channels.length} BOUND</span>
          {demo.channels.length === 0 && <p className="aui-kit-hint">Author driven mates in Rig — each one binds to a servo channel.</p>}
          {demo.channels.map((c) => <ListRow key={c.id} icon="sliders" title={c.name} detail={`CH${c.channel}`} selected={isSel(c)} statusColor={demo.armed ? AD.ok : undefined} onClick={() => pick(c)} />)}</div>
      )}
      inspector={demo.controllerSelected || !selected ? controllerInspector : calibrate} tray={tray} />
  );
}
