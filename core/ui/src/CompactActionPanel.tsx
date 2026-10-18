import { useState } from "react";
import { AetherIcon } from "./AetherIcon";
import "./ConceptInspectors.css";

export interface CompactActionPanelProps {
  primaryLabel?: string;
  primaryShortcut?: string;
  settingsShortcut?: string;
  initialTheme?: "light" | "dark";
  onPrimary?: () => void;
  onSettings?: () => void;
}

/** Independent theme preview, matching the native compact command specimen. */
export function CompactActionPanel({ primaryLabel = "New Query", primaryShortcut = "⌘N", settingsShortcut = "⌘S", initialTheme = "dark", onPrimary, onSettings }: CompactActionPanelProps) {
  const [theme, setTheme] = useState(initialTheme);
  const [selected, setSelected] = useState("query");
  const [count, setCount] = useState(0);
  return <div className={`aui-compact-action-panel is-${theme}`}>
    <button type="button" className="primary" aria-pressed={selected === "query"} onClick={() => { setSelected("query"); setCount((n) => n + 1); onPrimary?.(); }}><AetherIcon name="plus"/><strong>{primaryLabel}</strong><kbd>{primaryShortcut}</kbd></button>
    <button type="button" aria-pressed={selected === "settings"} onClick={() => { setSelected("settings"); onSettings?.(); }}><AetherIcon name="settings"/><strong>Settings</strong><kbd>{settingsShortcut}</kbd></button>
    <div role="group" aria-label="Panel theme">{(["light", "dark"] as const).map((mode) => <button type="button" key={mode} aria-pressed={theme === mode} onClick={() => setTheme(mode)}><AetherIcon name={mode === "light" ? "appearance-light" : "appearance-dark"}/>{mode === "light" ? "Light" : "Dark"}</button>)}</div>
    <output>{count ? `Created query ${count}` : "Commands are interactive"}</output>
  </div>;
}
