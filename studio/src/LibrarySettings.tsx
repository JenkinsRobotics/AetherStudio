import { useState } from "react";
import { SettingsWindow, SettingsCard, SettingsRow, SelectField, Button, NumberField } from "@aether/ui";
import { defaultLibraryPreferences, type LibraryPreferences } from "./library-preferences";

export function LibrarySettings({ app = "cad", open, name, workspace, preferences, onChange, onClose }: {
  app?: string; open: boolean; name: string; workspace: string; preferences: LibraryPreferences;
  onChange: (value: LibraryPreferences) => void; onClose: () => void;
}) {
  const [pane, setPane] = useState("general");
  const set = (patch: Partial<LibraryPreferences>) => onChange({ ...preferences, ...patch });
  return <SettingsWindow open={open} title={`${name} settings`} sections={[{title: name, panes: [{id:"general",label:"General"},{id:"workspace",label:"Default workspace"},...(app === "cad" ? [{id:"units",label:"Units"}] : []),{id:"extensions",label:"Extensions"}]}]} activePaneID={pane} onSelectPane={setPane} onClose={onClose}>
    {pane === "general" ? <SettingsCard title="General" caption="App preferences are saved in this browser. Changes to startup defaults apply the next time you open the library.">
      <SettingsRow label="Start page"><SelectField aria-label="Start page" value={preferences.startPage} options={[{value:"home",label:"Home"},{value:"personal",label:"My files"},{value:"workspace",label:workspace}]} onChange={e => set({startPage:e.target.value as LibraryPreferences["startPage"]})}/></SettingsRow>
      <SettingsRow label="Default file view"><SelectField aria-label="Default file view" value={preferences.view} options={[{value:"list",label:"List"},{value:"grid",label:"Grid"}]} onChange={e => set({view:e.target.value as "list"|"grid"})}/></SettingsRow>
      <SettingsRow label="Table thumbnails" caption="Gallery and Details always try to show the saved object. Empty or unsupported files use a file icon."><SelectField aria-label="Table thumbnails" value={preferences.objectPreviews ? "preview" : "icon"} options={[{value:"preview",label:"Object previews"},{value:"icon",label:"File type icons"}]} onChange={e => set({objectPreviews:e.target.value === "preview"})}/></SettingsRow>
      <SettingsRow label="What’s new"><SelectField aria-label="Show updates" value={preferences.showUpdates ? "show" : "hide"} options={[{value:"show",label:"Show on Home"},{value:"hide",label:"Hide on Home"}]} onChange={e => set({showUpdates:e.target.value === "show"})}/></SettingsRow>
      <Button onClick={() => onChange({...defaultLibraryPreferences})}>Reset app defaults</Button>
    </SettingsCard> : pane === "workspace" ? <SettingsCard title="Default workspace" caption="Choose where files created from Home are saved. Creating inside a folder or workspace continues to use that location.">
      {app === "cad" && <SettingsRow label="Default design"><SelectField aria-label="Default design" value={preferences.designKind} options={[{value:"part",label:"Part Design"},{value:"assembly",label:"Assembly Design"},{value:"project",label:"Hybrid Design"}]} onChange={e => set({designKind:e.target.value as LibraryPreferences["designKind"]})}/></SettingsRow>}
      <SettingsRow label="New file location"><SelectField aria-label="New file location" value={preferences.destination} options={[{value:"personal",label:"My files"},{value:"workspace",label:workspace}]} onChange={e => set({destination:e.target.value as "personal"|"workspace"})}/></SettingsRow>
      <p>Editor docking and panel placement are managed in the editor’s Layout settings. Toolbars, sidebar tabs and spacing are available in the shared settings below.</p>
    </SettingsCard> : pane === "units" ? <SettingsCard title="New document units" caption="Applies to newly created CAD documents. Existing documents retain their own Workspace units. Geometry is stored in millimeters; these preferences control input and display.">
      <SettingsRow label="Length"><SelectField aria-label="Default length unit" value={preferences.lengthUnit} options={[{value:"mm",label:"Millimeters"},{value:"cm",label:"Centimeters"},{value:"m",label:"Meters"},{value:"in",label:"Inches"},{value:"ft",label:"Feet"}]} onChange={e => set({lengthUnit:e.target.value as LibraryPreferences["lengthUnit"]})}/></SettingsRow>
      <SettingsRow label="Angle"><SelectField aria-label="Default angle unit" value={preferences.angleUnit} options={[{value:"deg",label:"Degrees"},{value:"rad",label:"Radians"}]} onChange={e => set({angleUnit:e.target.value as "deg"|"rad"})}/></SettingsRow>
      <SettingsRow label="Display decimals"><NumberField aria-label="Default display decimals" min={0} max={8} precision={0} value={preferences.decimals} onCommit={value => set({decimals:value})}/></SettingsRow>
    </SettingsCard> : <SettingsCard title="Extensions" caption="Installed extensions and agent connections are managed by Aether Studio. Availability depends on your account and server permissions.">
      <p>Open the extension manager to review installed plugins and available connections.</p>
      <Button onClick={() => location.assign("/?section=plugins")}>Manage extensions</Button>
      <p>Installing third-party tool extensions is not supported yet.</p>
    </SettingsCard>}
  </SettingsWindow>;
}
