import { useRef, useState } from "react";
import { AetherIcon } from "./AetherIcon";
import { AppIcon } from "./AppIcon";
import { Popover } from "./Popover";
import type { OverlayPlacement } from "./overlay-position";

export interface LaunchableApp {
  id: string;
  name: string;
  description?: string;
  /** Where the app opens. */
  url: string;
  /** Registered but not built yet: listed, described, not openable. */
  comingSoon?: boolean;
}

export interface AppLauncherProps {
  apps: readonly LaunchableApp[];
  /** The app whose window this is, marked as current in the list. */
  currentID?: string;
  /** The suite home, offered above the list. */
  homeUrl?: string;
  homeName?: string;
  /** Text beside the icon (sidebar row form); hidden when its sidebar collapses. */
  label?: string;
  className?: string;
  placement?: OverlayPlacement;
}

/**
 * The suite's app launcher: the first control in an application header, the
 * way Microsoft 365's waffle is. Every Aether application is one click away
 * from every other.
 *
 * Presentational by design — it takes the list rather than fetching it, so the
 * design system stays free of host semantics and the owning application keeps
 * deciding which apps a person may see.
 */
export function AppLauncher({
  apps,
  currentID,
  homeUrl = "/",
  homeName = "Aether Studio",
  label,
  className = "aui-app-launcher-button",
  placement = "bottom-start",
}: AppLauncherProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${homeName} applications`}
        title="Apps"
        onClick={() => setOpen((value) => !value)}
      >
        {label
          ? <><span className="aui-app-launcher-icon" aria-hidden="true"><AetherIcon name="apps" /></span><span className="aui-sidebar-label">{label}</span></>
          : <AetherIcon name="apps" />}
      </button>

      <Popover
        open={open}
        anchor={button.current}
        onClose={() => setOpen(false)}
        ariaLabel={`${homeName} applications`}
        placement={placement}
        focus="first"
        className="aui-app-launcher"
      >
        <a className="aui-app-launcher-home" href={homeUrl}>
          <AppIcon app="studio" size={20} />
          <span>{homeName}</span>
        </a>
        <div className="aui-app-launcher-grid" role="menu">
          {apps.map((app) =>
            app.comingSoon ? (
              <span
                key={app.id}
                className="aui-app-launcher-app is-soon"
                role="menuitem"
                aria-disabled="true"
                title={`${app.name} — not built yet`}
              >
                <AppIcon app={app.id} size={32} />
                <strong>{app.name}</strong>
                <small>Coming soon</small>
              </span>
            ) : (
              <a
                key={app.id}
                className="aui-app-launcher-app"
                role="menuitem"
                href={app.url}
                aria-current={app.id === currentID ? "page" : undefined}
                title={app.description ?? app.name}
              >
                <AppIcon app={app.id} size={32} />
                <strong>{app.name}</strong>
                {app.description ? <small>{app.description}</small> : null}
              </a>
            ),
          )}
        </div>
      </Popover>
    </>
  );
}
