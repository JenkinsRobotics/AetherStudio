import { useEffect, useState } from "react";
import { AetherIcon } from "./AetherIcon";
import { MenuButton, type MenuItem } from "./Menu";
import { activeAetherTheme, activeAetherViewportTheme, setAetherTheme, setAetherViewportTheme } from "./StudioChrome";
import { aetherThemes, aetherViewportThemes } from "./themes";
import { SettingsWindow } from "./SettingsWindow";
import { SharedAppearanceSettings } from "./SharedAppearanceSettings";

/** Header control: the interface theme from the pack, and the viewport theme
 * on top of it. Persists per device and follows changes made anywhere else. */
export function ThemeMenu() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(activeAetherTheme);
  const [viewport, setViewport] = useState(activeAetherViewportTheme);
  useEffect(() => {
    const follow = () => { setTheme(activeAetherTheme()); setViewport(activeAetherViewportTheme()); };
    document.addEventListener("aether-theme", follow);
    window.addEventListener("storage", follow);
    return () => { document.removeEventListener("aether-theme", follow); window.removeEventListener("storage", follow); };
  }, []);
  const current = aetherThemes.find((t) => t.id === theme)?.name ?? theme;
  const items: MenuItem[] = [
    ...aetherThemes.map((t, i): MenuItem => ({ id: `theme:${t.id}`, label: t.name, kind: "radio", checked: t.id === theme, heading: i === 0 ? "Interface theme" : undefined })),
    { id: "viewport:", label: "Theme default", kind: "radio", checked: !viewport, separatorBefore: true, heading: "Viewport" },
    ...aetherViewportThemes.map((v): MenuItem => ({ id: `viewport:${v.id}`, label: v.name, kind: "radio", checked: v.id === viewport })),
    { id: "settings", label: "Appearance & icons…", separatorBefore: true, icon: <AetherIcon name="settings" /> },
  ];
  return (
    <><MenuButton label={`Interface theme: ${current}`} className="aui-icon-button" items={items}
      onSelect={(id) => { if (id === "settings") setSettingsOpen(true); else if (id.startsWith("theme:")) setAetherTheme(id.slice(6)); else setAetherViewportTheme(id.slice(9) || null); }}>
      <AetherIcon name="palette" />
    </MenuButton>
    <SettingsWindow open={settingsOpen} title="Aether appearance settings" sections={[]}
      activePaneID="" onSelectPane={() => undefined} onClose={() => setSettingsOpen(false)}>
      <SharedAppearanceSettings />
    </SettingsWindow></>
  );
}
