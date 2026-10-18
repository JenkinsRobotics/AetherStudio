/**
 * Library widgets no showcase page rendered before the refinement pass
 * (dev/docs/roadmap/Aether_UI_Showcase_Refinement.md § 6), each as one flat
 * captioned row in the section where its kind lives. `KitGaps` renders inside
 * the demo theme scope; `LibraryGaps` renders `@aether/ui` widgets outside it.
 */
import { useState } from "react";
import {
  AD, CurveInspector, DockingWorkspace, MouseControlDiagram, MoveGizmo, NewCharacterDialog, PanelCard, PropSection, PropertyField, Range, StackCard,
  Switch, ThemeSwatchStrip, WaveformLane,
} from "../../src/Kit";
import { Button, CollectionFilter, NumberField, WorkspaceSwitcher } from "../../src/index";
import { SpecimenBoard } from "../../src/ConceptWidgets";
import { Variant } from "../Variants";
import { SECTION } from "./inventory";

export function KitGaps({ section }: { section: string }) {
  const [on, setOn] = useState(true);
  const [hue, setHue] = useState(0.35);
  switch (section) {
    case SECTION.toggles: return <>
      <Variant label="animation-studio Switch · small and mini"><div className="aui-kit-hstack-8"><Switch checked={on} onChange={setOn} label="Show edges" /><Switch checked={!on} onChange={(v) => setOn(!v)} label="Snap" size="mini" /></div></Variant>
      <Variant label="animation-studio Range · gradient track (native UIDevMaterialSlider)"><div style={{ width: 220 }}><Range ariaLabel="Hue" value={hue} onChange={setHue} gradient={["#ff453a", "#ffd60a", "#30d158", "#0a84ff", "#bf5af2", "#ff453a"]} /></div></Variant>
    </>;
    case SECTION.settings: return <Variant label="animation-studio MouseControlDiagram (native navigation settings legend)"><div style={{ width: 400, maxWidth: "100%" }}><MouseControlDiagram profile="Onshape" orbit="Right-drag" pan="Middle-drag" zoom="Scroll wheel" special="Shift-drag · pan" /></div></Variant>;
    case SECTION.timelines: return <>
      <Variant label="animation-studio WaveformLane"><div style={{ position: "relative", width: 320, height: 56, overflow: "hidden", borderRadius: 6, background: "var(--aether-color-bg-app)" }}><WaveformLane /></div></Variant>
      <Variant label="animation-studio CurveInspector"><div style={{ width: 280 }}><CurveInspector /></div></Variant>
    </>;
    case SECTION.viewports: return <Variant label="animation-studio MoveGizmo"><div style={{ position: "relative", width: 220, height: 150 }}><MoveGizmo /></div></Variant>;
    case SECTION.inspectors: return <Variant label="animation-studio PropSection · collapsible inspector groups"><div style={{ width: 260 }}>
      <PropSection title="Transform"><PropertyField label="Position X" value="125.00" unit="mm" /><PropertyField label="Rotation Z" value="45.0" unit="deg" /></PropSection>
      <PropSection title="Information" defaultOpen={false}><PropertyField label="Triangles" value="18,204" /></PropSection></div></Variant>;
    case SECTION.dialogs: return <Variant label="animation-studio NewCharacterDialog"><NewCharacterDialog onCreate={() => {}} onCancel={() => {}} /></Variant>;
    case SECTION.layouts: return <Variant label="animation-studio DockingWorkspace" wide><DockingWorkspaceDemo /></Variant>;
    case SECTION.rail: return <Variant label="animation-studio StackCard · floating panel card"><StackCard id="clips" title="Clips" icon="film-stack" floating width={220} onClose={() => {}}><div style={{ padding: 10, fontSize: 11 }}>Greeting · Idle · Curious</div></StackCard></Variant>;
    default: return null;
  }
}

/** Full-window concept, launched from Workspaces rather than embedded in a widget page. */
export function DockingWorkspaceDemo() {
  const [angle, setAngle] = useState(22);
  return <div data-aether-kit="" style={{ display: "flex", width: "100%", height: "100%", minHeight: 0 }}>
    <DockingWorkspace leftPlacement="floating" rightPlacement="floating" leftWidth={220} rightWidth={260}
      left={<PanelCard title="Browser" subtitle="Project content" icon="folder"><div style={{ padding: 10 }}>Characters · Parts · Assets</div></PanelCard>}
      right={<PanelCard title="Inspector" subtitle="Head Pan" icon="sliders"><div style={{ padding: 10 }}><NumberField aria-label="Angle" value={angle} unit="°" onValueChange={value => setAngle(value ?? 0)} /></div></PanelCard>}
      center={<div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--aether-color-text-dim)" }}>Floating browser and inspector</div>} />
  </div>;
}

export function LibraryGaps({ section }: { section: string }) {
  const [workspace, setWorkspace] = useState("rig");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  switch (section) {
    case SECTION.tokens: return <Variant label="animation-studio ThemeSwatchStrip"><ThemeSwatchStrip colors={[AD.accent, AD.accent2, AD.purple, AD.warn, AD.ok, AD.danger]} /></Variant>;
    case SECTION.header: return <Variant label="@aether/ui WorkspaceSwitcher"><WorkspaceSwitcher workspaces={[{ id: "rig", label: "Rig" }, { id: "animate", label: "Animate" }, { id: "show", label: "Show", disabled: true, disabledReason: "No scene in this project yet." }]} workspaceID={workspace} onSelect={setWorkspace} /></Variant>;
    case SECTION.lists: return <Variant label="@aether/ui CollectionFilter"><div style={{ width: 300 }}><CollectionFilter ariaLabel="Filter parts" query={query} onQueryChange={setQuery} value={scope} onChange={setScope} options={[{ id: "parts", label: "Parts" }, { id: "mates", label: "Mates" }]} /></div></Variant>;
    case SECTION.panels: return <Variant label="@aether/ui SpecimenBoard · the comparison board itself, as a widget" wide>
      <div data-widget-specimen="specimen-board" style={{ width: "100%" }}><SpecimenBoard eyebrow="SPECIMEN BOARD" title="Two specimens" detail="The board is a widget; the showcase no longer nests one per tab." sections={[{ id: "buttons", title: "Buttons", detail: "", minimumWidth: 200, maximumWidth: 260, specimens: [
        { id: "primary", title: "Primary", detail: "default", icon: "window", idealSize: "120 × 40", previewHeight: 60, content: <Button primary>Create</Button> },
        { id: "quiet", title: "Quiet", detail: "disabled", icon: "window", idealSize: "120 × 40", previewHeight: 60, content: <Button disabled>Unavailable</Button> },
      ] }]} /></div></Variant>;
    default: return null;
  }
}
