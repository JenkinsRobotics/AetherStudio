import { useCallback, useState } from "react";
import { AetherIcon, Button, Checkbox, FloatingToolbar, FloatingToolbarMenu, IconButton, NumberField, Popover } from "../../src";
import { modelStudioEnvironment } from "../../src/model-studio-presets";
import type { Plane, RenderSettings, ViewSettings } from "./PlasticityViewport";
import "./ModelWorkspaceControls.css";

export type ModelWorkspace = "design" | "render" | "simulation";
export const MODEL_WORKSPACES = [{ id:"design", label:"Design" }, { id:"render", label:"Render" }, { id:"simulation", label:"Simulation" }] as const;
export const DEFAULT_RENDER_SETTINGS: RenderSettings = { exposure:modelStudioEnvironment.exposure, groundShadows:true };

export function ModelWorkspaceControls({ workspace, onWorkspace, settings, onSettings, plane, onPlane, render, onRender, onMaterials }: {
  workspace: ModelWorkspace; onWorkspace: (workspace: ModelWorkspace) => void;
  settings: ViewSettings; onSettings: (settings: ViewSettings) => void;
  plane: Plane; onPlane: (kind: string) => void;
  render: RenderSettings; onRender: (settings: RenderSettings) => void; onMaterials: () => void;
}) {
  const [popup, setPopup] = useState<{kind:"environment" | "simulation"; anchor:HTMLElement} | null>(null);
  const close = useCallback(() => setPopup(null), []);
  const displays = [
    { id:"shaded", label:"Solid", icon:"cube-filled" },
    { id:"edges", label:"Shaded with edges", icon:"cube" },
    { id:"wireframe", label:"Wireframe", icon:"cube-transparent" },
  ];
  const display = displays[settings.wireframe ? 2 : settings.edges ? 1 : 0];
  const nextDisplay = displays[(displays.indexOf(display) + 1) % displays.length];
  const planes = ["", "XY", "YZ", "XZ"];
  const nextPlane = planes[(planes.indexOf(plane.kind) + 1) % planes.length];
  const planeLabel = plane.kind === "selection" ? "Selection" : plane.kind === "camera" ? "Camera" : plane.kind || "Hidden";
  return <>
    <FloatingToolbar ariaLabel="Workspace controls" variant="document" className="ps-workspace-control" groups={[]} onAction={() => {}}
      leading={<FloatingToolbarMenu label="Change workspace" items={MODEL_WORKSPACES.map(item => ({...item,kind:"radio",checked:workspace === item.id}))}
        onSelect={id => { close(); onWorkspace(id as ModelWorkspace); }}><span>{MODEL_WORKSPACES.find(item => item.id === workspace)?.label}</span><AetherIcon name="chevron-down" /></FloatingToolbarMenu>}
      trailing={<>
        {workspace === "design" && <>
          <IconButton label={`Display style: ${display.label}`} title={`${display.label} · Click for ${nextDisplay.label}`} appearance="glyph" size="small" data-active="true" data-display={display.id}
            onClick={() => onSettings({...settings,wireframe:nextDisplay.id === "wireframe",edges:nextDisplay.id === "edges"})}><AetherIcon name={display.icon}/></IconButton>
          <IconButton label={`Construction plane: ${planeLabel}`} title={`${planeLabel} construction plane · Click for ${nextPlane || "hidden planes"}`} appearance="glyph" size="small" aria-pressed={!!plane.kind} data-plane={plane.kind || "hidden"}
            onClick={() => onPlane(nextPlane)}><AetherIcon name={plane.kind === "selection" ? "cursor" : plane.kind === "camera" ? "camera" : "planes-axes"}/></IconButton>
        </>}
        {workspace === "render" && <>
          <IconButton label="Materials" appearance="glyph" size="small" onClick={onMaterials}><AetherIcon name="palette"/></IconButton>
          <IconButton label="Environment" appearance="glyph" size="small" aria-haspopup="dialog" aria-expanded={popup?.kind === "environment"} aria-pressed={popup?.kind === "environment"} onClick={event => setPopup(popup?.kind === "environment" ? null : {kind:"environment",anchor:event.currentTarget})}><AetherIcon name="lighting"/></IconButton>
        </>}
        {workspace === "simulation" && <>
          <IconButton label="Study" appearance="glyph" size="small" aria-haspopup="dialog" aria-expanded={popup?.kind === "simulation"} aria-pressed={popup?.kind === "simulation"} onClick={event => setPopup(popup?.kind === "simulation" ? null : {kind:"simulation",anchor:event.currentTarget})}><AetherIcon name="bolt"/></IconButton>
          <IconButton label="Run simulation" appearance="glyph" size="small" disabled title="No simulation solver is connected in this demo."><AetherIcon name="play" /></IconButton>
          <span className="ps-workspace-preview">Preview</span>
        </>}
      </>} />
    <Popover open={!!popup} anchor={popup?.anchor ?? null} onClose={close} focus="first" ariaLabel={popup?.kind === "environment" ? "Render environment" : "Simulation study"} className="ps-workspace-popover">
      {popup?.kind === "environment" ? <>
        <strong>Model Studio environment</strong>
        <label>Exposure<NumberField aria-label="Render exposure" value={render.exposure} min={.2} max={3} step={.05} onCommit={exposure => onRender({...render,exposure})} /></label>
        <Checkbox label="Ground shadows" checked={render.groundShadows} onChange={event => onRender({...render,groundShadows:event.target.checked})} />
        <Button onClick={() => onRender({...DEFAULT_RENDER_SETTINGS})}>Reset to preset</Button>
      </> : <><strong>Simulation preview</strong><p>No simulation solver is connected in this demo. Study setup, solving and results are unavailable.</p></>}
    </Popover>
  </>;
}
