import { ApplicationContextMenu } from './ApplicationContextMenu';
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { AppWordmark, type AppWordmarkName } from "./AppWordmark";
import { AppMark } from "./AppMark";
import { appWordmarkData } from "@aether/assets/branding/wordmarks/data";
import { AppIcon } from "./AppIcon";
import { AppLauncher, type LaunchableApp } from "./AppLauncher";
import { AetherIcon } from "./AetherIcon";
import { MenuButton } from "./Menu";
import { storedAppearance, setAetherAppearance, type AppearanceMode } from "./StudioChrome";
import { SettingsWindow } from "./SettingsWindow";
import "./ApplicationChrome.css";

export interface ApplicationIdentityProps {
  id: string;
  name: string;
  homeUrl?: string;
  onHome?: (event: MouseEvent<HTMLAnchorElement>) => void;
  apps?: readonly LaunchableApp[];
  /** false when the app launcher is placed elsewhere (editor headers put it on the right). */
  launcher?: boolean;
  /** false shows the icon alone (home button), e.g. in an editor whose tabs carry the names. */
  showName?: boolean;
  /** Defaults to the approved wordmark; icon is retained for custom/legacy integrations. */
  identityStyle?: "icon" | "wordmark";
}

/** Host catalog is presentation data; the server decides which apps are visible. */
export function ApplicationIdentity({ id, name, homeUrl = `/${id}/`, onHome, apps, launcher = true, showName = true, identityStyle = "wordmark" }: ApplicationIdentityProps) {
  const wordmark = identityStyle === "wordmark" && Object.hasOwn(appWordmarkData.apps, id);
  return <div className={`aui-application-identity${wordmark ? " aui-application-identity--wordmark" : ""}`}>
    {launcher && <AppLauncher apps={apps ?? []} currentID={id} />}
    <a href={homeUrl} onClick={onHome} aria-label={`${name} home`} title={`${name} home`}>{wordmark ? showName ? <AppWordmark app={id as AppWordmarkName} size={36} decorative/> : <AppMark app={id as AppWordmarkName} size={36}/> : <AppIcon app={id} size={36} />}</a>
    {showName && !wordmark && <strong>{name}</strong>}
  </div>;
}

/** Own the host gear's Settings command while this application header is mounted.
 * Capture prevents retained editor listeners opening a second settings window. */
export function ApplicationSettings({ name, appID, onSettings, enabled = true }: { name: string; appID?: string; onSettings?: () => void; enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const handler = useRef(onSettings);
  handler.current = onSettings;
  useEffect(() => {
    if (!enabled) return;
    const show = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (handler.current) handler.current(); else setOpen(true);
    };
    document.addEventListener("aether-open-settings", show, true);
    return () => document.removeEventListener("aether-open-settings", show, true);
  }, [enabled]);
  return <><ApplicationContextMenu name={name} enabled={enabled} /><SettingsWindow open={open} title={`${name} settings`} headerAppID={appID} sections={[]}
    activePaneID="" onSelectPane={() => undefined} onClose={() => setOpen(false)}>{null}</SettingsWindow></>;
}

/** One settings gear followed by the host identity, also usable without a host. */
export function ApplicationAccountControls() {
  const [mode, setMode] = useState(storedAppearance);
  useEffect(() => {
    const sync = () => setMode(storedAppearance());
    document.addEventListener("aether-appearance", sync);
    window.addEventListener("storage", sync);
    return () => { document.removeEventListener("aether-appearance", sync); window.removeEventListener("storage", sync); };
  }, []);
  return <div className="aui-application-account">
    <MenuButton label="Settings" className="aui-icon-button" placement="bottom-end" items={[
      { id: "settings", label: "Settings", icon: <AetherIcon name="settings" /> },
      ...(["system", "light", "dark"] as const).map((value, index) => ({ id: value, label: value === "system" ? "Follow system theme" : value === "light" ? "Light" : "Dark", kind: "radio" as const, checked: mode === value, separatorBefore: index === 0, heading: index === 0 ? "Color mode" : undefined })),
    ]} onSelect={id => {
      if (id === "settings") document.dispatchEvent(new CustomEvent("aether-open-settings", { cancelable: true }));
      else setAetherAppearance(id as AppearanceMode);
    }}><AetherIcon name="settings" /></MenuButton>
    <div data-aether-account="" />
  </div>;
}
