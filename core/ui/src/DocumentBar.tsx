import type { ReactNode } from "react";
import { ApplicationIdentity, ApplicationSettings, type ApplicationIdentityProps } from "./ApplicationChrome";
import { WorkspaceQuickControls } from "./WorkspaceQuickControls";

export interface DocumentBarProps {
  /** Standard app identity, launcher, settings and account chrome. Omit in embedded demos. */
  application?: ApplicationIdentityProps & { onSettings?: () => void; onShare?: () => void };
  /** Direct layout/docking and window controls, immediately before Settings. */
  viewControls?: ReactNode;
  /** App-supplied account presentation; omitted uses the Studio host account mount. */
  account?: ReactNode;
  /** Used until the user saves header icon preferences for this app. */
  defaultHeaderPins?: readonly string[];
  /** Compact utilities place Settings before the pinned icons, matching reading/tab order. */
  compactControls?: boolean;
  /** Left cluster: home button, project name, save state, commands. */
  leading?: ReactNode;
  /** Centered on the window (usually workspace <Tabs>). */
  center?: ReactNode;
  /** Right cluster: engine status, layout preset button, window menus. */
  trailing?: ReactNode;
  className?: string;
  /** Transparent lets the parent workspace show through without a frame or blur. */
  variant?: "standard" | "transparent";
  /** Disable for embedded component previews. */
  windowChrome?: boolean;
}

/** The shared top app-window row (Swift `StudioDocumentBar`): leading and
 *  trailing clusters with the center slot truly window-centered. */
export function DocumentBar({ leading, center, trailing, className, variant = "standard", windowChrome = true, application, viewControls, account, defaultHeaderPins, compactControls }: DocumentBarProps) {
  const classes = ["aui-document-bar"];
  if (variant === "transparent") classes.push("aui-document-bar--transparent");
  if (className) classes.push(className);
  return (
    <><header data-application={application?.id} className={classes.join(" ")} data-aether-window-drag-region={windowChrome ? "true" : undefined}>
      <div className="aui-document-bar-cluster">
        {windowChrome && <span className="aui-native-titlebar-space" aria-hidden="true" />}
        {/* The app name leads; the launcher joins the controls on the right. */}
        {application && <ApplicationIdentity {...application} launcher={false} />}
        {leading}
      </div>
      {center ? <div className="aui-document-bar-center">{center}</div> : null}
      <div className="aui-document-bar-cluster aui-document-bar-cluster--trailing">
        {trailing}
        {application ? <WorkspaceQuickControls appID={application.id} appName={application.name} defaultPinnedIDs={defaultHeaderPins} onSettings={application.onSettings} apps={application.apps ?? []} viewControls={viewControls} onShare={application.onShare} account={account} compact={compactControls}/> : viewControls}
      </div>
    </header>
    {application && <ApplicationSettings appID={application.id} name={application.name} onSettings={application.onSettings} enabled={windowChrome} />}</>
  );
}
