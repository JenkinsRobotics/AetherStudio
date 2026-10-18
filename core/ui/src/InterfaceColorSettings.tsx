import { useEffect, useState } from "react";
import { ColorField } from "./ColorField";
import { Button } from "./Button";
import { SettingsCard, SettingsRow } from "./SettingsWindow";
import { interfaceColorFields, readInterfaceColors, resolvedInterfaceMode, setInterfaceColors, neutralInterfaceColors } from "./InterfaceColors";

function resolvedHex(token: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--aether-color-${token}`).trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  const match = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (match) return `#${match[1].repeat(2)}${match[2].repeat(2)}${match[3].repeat(2)}`;
  const rgb = raw.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
  return rgb ? `#${rgb.slice(1,4).map(n => Number(n).toString(16).padStart(2,"0")).join("")}` : "#808080";
}
export function InterfaceColorSettings() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const follow = () => refresh(n => n + 1);
    const names = ["aether-interface-colors", "aether-theme", "aether-appearance"];
    names.forEach(name => document.addEventListener(name, follow)); window.addEventListener("storage", follow);
    const observer = new MutationObserver(follow); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-aether-theme"] });
    return () => { names.forEach(name => document.removeEventListener(name, follow)); window.removeEventListener("storage", follow); observer.disconnect(); };
  }, []);
  const mode = resolvedInterfaceMode();
  const colors = readInterfaceColors(mode);
  return <SettingsCard title="Custom interface colors" caption={`Editing ${mode} mode. Changes preview immediately and are saved in this browser. Light and dark colors are kept separately.`}>
    <SettingsRow label="Color palette"><Button onClick={() => setInterfaceColors(mode, { ...colors, ...neutralInterfaceColors[mode] })}>Neutral gray</Button><Button onClick={() => setInterfaceColors(mode, {})}>Reset colors</Button></SettingsRow>
    {interfaceColorFields.map(([token, label]) => <SettingsRow key={token} label={label}><ColorField ariaLabel={label} value={colors[token] ?? resolvedHex(token)} onChange={value => setInterfaceColors(mode, { ...readInterfaceColors(mode), [token]: value })} /></SettingsRow>)}
  </SettingsCard>;
}
