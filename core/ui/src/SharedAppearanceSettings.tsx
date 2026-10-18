import { InterfaceColorSettings } from "./InterfaceColorSettings";
import { useEffect, useState } from "react";
import { activeAetherTheme, activeAetherViewportTheme, setAetherAppearance, setAetherTheme, setAetherViewportTheme, storedAppearance, type AppearanceMode } from "./StudioChrome";
import { aetherThemes, aetherViewportThemes } from "./themes";
import { setToolIconPack, useGlobalToolIconPack, type ToolIconPack } from "./ToolIconTheme";
import { SettingsCard, SettingsRow } from "./SettingsWindow";
import { SelectField } from "./SelectField";

/** One device preference surface, reused by every application settings window. */
export function SharedAppearanceSettings() {
  const [theme, updateTheme] = useState(activeAetherTheme);
  const [viewport, updateViewport] = useState(activeAetherViewportTheme);
  const [mode, updateMode] = useState(storedAppearance);
  const pack = useGlobalToolIconPack();
  useEffect(() => {
    const follow = () => { updateTheme(activeAetherTheme()); updateViewport(activeAetherViewportTheme()); updateMode(storedAppearance()); };
    document.addEventListener("aether-theme", follow);
    document.addEventListener("aether-appearance", follow);
    window.addEventListener("storage", follow);
    return () => { document.removeEventListener("aether-theme", follow); document.removeEventListener("aether-appearance", follow); window.removeEventListener("storage", follow); };
  }, []);
  return <><SettingsCard title="Appearance" caption="Shared across Aether applications on this browser.">
    <SettingsRow label="Color mode"><SelectField aria-label="Color mode" value={mode}
      options={[{value:"system",label:"System"},{value:"light",label:"Light"},{value:"dark",label:"Dark"}]}
      onChange={event => setAetherAppearance(event.target.value as AppearanceMode)} /></SettingsRow>
    <SettingsRow label="Interface theme"><SelectField aria-label="Interface theme" value={theme}
      options={aetherThemes.map(theme => ({value:theme.id,label:theme.name}))}
      onChange={event => setAetherTheme(event.target.value)} /></SettingsRow>
    <SettingsRow label="Viewport theme"><SelectField aria-label="Viewport theme" value={viewport ?? ""}
      options={[{value:"",label:"Theme default"},...aetherViewportThemes.map(theme=>({value:theme.id,label:theme.name}))]}
      onChange={event => setAetherViewportTheme(event.target.value || null)} /></SettingsRow>
    <SettingsRow label="Tool icon pack"><SelectField aria-label="Tool icon pack" value={pack}
      options={[{value:"classic",label:"Aether Classic"},{value:"graphite-ribbon",label:"Graphite Ribbon — Illustrated Ribbon Tools"}]}
      onChange={event => setToolIconPack(event.target.value as ToolIconPack)} /></SettingsRow>
  </SettingsCard><InterfaceColorSettings /></>;
}
