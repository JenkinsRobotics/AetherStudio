/** The Rex-era CenterTray for a workspace: the item list from the model plus the three popover bodies the old build showed. */
import { AD, EnvironmentPanel, Field, Pill, Sym, type TrayItem } from "../../src/Kit";
import type { AppState } from "./AnimationMockupApp";
import { TRAY_ITEMS, useDemo, type Workspace } from "./model";

export function useTray(app: Pick<AppState, "render" | "setRender">, workspace: keyof typeof TRAY_ITEMS): TrayItem[] {
  const demo = useDemo();
  const part = demo.parts.find((p) => p.id === demo.selectedPartID);
  const popovers = {
    display: (
      <div className="aui-kit-stack-10" style={{ padding: 14, width: 240 }}>
        <span className="aui-kit-caption">DISPLAY</span>
        <div className="aui-kit-hstack-8"><Pill icon="grid-3" label="Shaded" active /><Pill icon="cube" label="Wireframe" /></div>
      </div>
    ),
    environment: <EnvironmentPanel prefs={app.render} onChange={app.setRender} />,
    performance: (
      <div className="aui-kit-stack-8" style={{ padding: 14, width: 260 }}>
        <div className="aui-kit-between"><span className="aui-kit-caption">IMPORT · LIVE</span>
          <button type="button" className="aui-kit-plain" aria-label="Pin live stats" aria-pressed={app.render.pinPerformance} style={{ color: app.render.pinPerformance ? AD.accent : AD.text3 }} onClick={() => app.setRender({ ...app.render, pinPerformance: !app.render.pinPerformance })}><Sym name="unpin" size={11} weight="semibold" /></button></div>
        <Field label="Faces" value={String(part?.faces ?? 0)} /><Field label="Edges" value={String(part?.edges ?? 0)} /><Field label="Triangles" value={String(part?.triangles ?? 0)} />
        <Field label="Read" value={String(Math.round((part?.importMs ?? 0) * 0.4))} unit="ms" /><Field label="Mesh" value={String(Math.round((part?.importMs ?? 0) * 0.6))} unit="ms" /><Field label="Kernel" value="OCCT 7.8.1" />
      </div>
    ),
  };
  return TRAY_ITEMS[workspace].map((item) => ({
    icon: item.icon, label: item.label, popover: item.popover ? popovers[item.popover] : undefined,
    onSelect: item.label === "Import" ? demo.importModel : () => demo.setStatus(`${item.label} (${workspace as Workspace} tray)`),
  }));
}
