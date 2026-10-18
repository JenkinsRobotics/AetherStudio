import { sidebarDesignOptions, type SidebarDesign } from "../src/SidebarDesignMenu";
import { useEffect, useState } from "react";
import {
  AetherIcon,
  AppearanceToggle,
  SegmentedControl,
  SelectField,
  SettingsCard,
  SettingsRow,
  SettingsWindow,
  type LayoutPreset,
  type SettingsSection,
} from "../src/index";

import { studioSettings, useAnimationStudioPreference, type StudioSetting } from "./AnimationStudioPreferences";

const sections: readonly SettingsSection[] = [
  { title: "General", panes: [
    { id: "workspace", label: "Workspace", icon: <AetherIcon name="folder" /> },
    { id: "layout", label: "Layout", icon: <AetherIcon name="layout" /> },
    { id: "ui", label: "UI", icon: <AetherIcon name="window" /> },
  ] },
  { title: "Viewport", panes: [
    { id: "renderer", label: "Renderer", icon: <AetherIcon name="cube" /> },
    { id: "appearance", label: "Appearance", icon: <AetherIcon name="appearance" /> },
    { id: "materials", label: "Materials & Edges", icon: <AetherIcon name="palette" /> },
    { id: "lighting", label: "Lighting", icon: <AetherIcon name="lighting" /> },
    { id: "navigation", label: "Navigation", icon: <AetherIcon name="mouse" /> },
  ] },
  { title: "Advanced", panes: [
    { id: "developer", label: "Developer", icon: <AetherIcon name="hammer" /> },
  ] },
];

const paneCopy: Record<string, { title: string; caption: string; card: string }> = {
  workspace: { title: "Workspace", caption: "Control project recovery and workspace behavior.", card: "Project sessions" },
  ui: { title: "UI", caption: "Choose the scale and motion of the Aether Animation Studio interface.", card: "Interface" },
  renderer: { title: "Renderer", caption: "Configure the viewport rendering backend and quality.", card: "Viewport renderer" },
  appearance: { title: "Appearance", caption: "Choose viewport color and environment presentation.", card: "Viewport appearance" },
  materials: { title: "Materials & Edges", caption: "Control material preview and model edge display.", card: "Model presentation" },
  lighting: { title: "Lighting", caption: "Set the default lighting rig for authoring views.", card: "Studio lighting" },
  navigation: { title: "Navigation", caption: "Tune orbit, pan, zoom, and selection navigation.", card: "Viewport navigation" },
  developer: { title: "Developer", caption: "Inspect diagnostics used while building Aether applications.", card: "Development tools" },
};

function PaneHeader({ title, caption }: { title: string; caption: string }) {
  return <header className="animation-settings-pane-header">
    <span><AetherIcon name="layout" /></span>
    <div><h2>{title}</h2><p>{caption}</p></div>
  </header>;
}

export function AnimationStudioSettings(props: {
  open: boolean;
  initialPane?: string;
  preset: LayoutPreset;
  panelsOnOuterEdge: boolean;
  sidebarDesign: SidebarDesign;
  onSidebarDesignChange: (value: SidebarDesign) => void;
  onPresetChange: (preset: LayoutPreset) => void;
  onPanelsOnOuterEdgeChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const [activePane, setActivePane] = useState("layout");
  useEffect(() => { if (props.open && props.initialPane) setActivePane(props.initialPane); }, [props.open, props.initialPane]);
  const info = paneCopy[activePane];

  return <SettingsWindow
    open={props.open}
    title="Aether Animation Studio Settings"
    sections={sections as SettingsSection[]}
    activePaneID={activePane}
    onSelectPane={setActivePane}
    onClose={props.onClose}
    presentation="floating"
    size="standard"
  >
    {activePane === "layout" ? <>
      <PaneHeader title="Layout" caption="Control the app-global Studio mode and panel relationship." />
      <SettingsCard>
        <SettingsRow label="Default Studio mode" stacked>
          <SegmentedControl
            ariaLabel="Default Studio mode"
            value={props.preset}
            onChange={(id) => props.onPresetChange(id as LayoutPreset)}
            options={[
              { id: "floating", label: "Floating" },
              { id: "docked", label: "Docked" },
              { id: "canvas", label: "Canvas" },
            ]}
          />
        </SettingsRow>
        <p className="animation-settings-help">The selected default is applied to new workspace sessions and this preview.</p>
      </SettingsCard>
      <SettingsCard>
        <SettingsRow label="Sidebar design">
          <SelectField aria-label="Sidebar design" value={props.sidebarDesign} options={sidebarDesignOptions.map(option => ({value:option.id,label:option.label}))} onChange={event => props.onSidebarDesignChange(event.target.value as SidebarDesign)} />
        </SettingsRow>
        {props.sidebarDesign === "rail" && <SettingsRow
          label="Push panels to the outer edge"
          caption="Keeps the panel margin while moving the icon rail inboard."
        >
          <input
            className="aui-switch"
            type="checkbox"
            aria-label="Push panels to the outer edge"
            checked={props.panelsOnOuterEdge}
            onChange={(event) => props.onPanelsOnOuterEdgeChange(event.target.checked)}
          />
        </SettingsRow>}
      </SettingsCard>
    </> : <>
      <PaneHeader title={info.title} caption={info.caption} />
      <SettingsCard title={info.card}>
        {activePane === "workspace" ? <SettingsRow label="Default project location" caption="Browser concept documents are stored on this device, separately from product projects."><span>Browser storage</span></SettingsRow> : null}
        {activePane === "ui" ? <SettingsRow label="Appearance"><AppearanceToggle/></SettingsRow> : null}
        {activePane === "renderer" ? <SettingsRow label="Render engine" caption="The web concept uses a sample Three.js viewport. Native Metal and RealityKit require the archived macOS app."><SelectField disabled value="three" options={[{value:"three",label:"Three.js · WebGL"},{value:"metal",label:"Native Metal (macOS)"},{value:"reality",label:"RealityKit (macOS)"}]}/></SettingsRow> : null}
        {(studioSettings[activePane] ?? []).map((setting) => <PreferenceRow key={setting.id} setting={setting}/>)}
        {["appearance", "materials", "lighting", "navigation"].includes(activePane) ? <p className="animation-settings-help">These are device-local preview defaults. Engine-specific options are retained for reference; this concept does not configure a production renderer or hardware.</p> : null}
      </SettingsCard>
    </>}
  </SettingsWindow>;
}

export function PreferenceRow({setting}: {setting: StudioSetting}) {
  const [value, setValue] = useAnimationStudioPreference(setting.id, setting.initial);
  return <SettingsRow label={setting.label} caption={setting.caption}>
    {typeof setting.initial === "boolean" ? <input className="aui-switch" type="checkbox" aria-label={setting.label} checked={Boolean(value)} onChange={(event) => setValue(event.target.checked)}/>
      : setting.options ? <SelectField aria-label={setting.label} value={String(value)} onChange={(event) => setValue(event.target.value)} options={setting.options.map((label) => ({value:label,label:label[0].toUpperCase()+label.slice(1)}))}/>
      : typeof setting.initial === "number" ? <label className="animation-preference-range"><input type="range" aria-label={setting.label} min={setting.min} max={setting.max} step={setting.step} value={Number(value)} onChange={(event) => setValue(Number(event.target.value))}/><output>{value}</output></label>
      : <input aria-label={setting.label} type={setting.color ? "color" : "text"} value={String(value)} onChange={(event) => setValue(event.target.value)}/>}
  </SettingsRow>;
}
