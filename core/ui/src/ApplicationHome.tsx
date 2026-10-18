import type { ReactNode } from "react";
import type { LaunchableApp } from "./AppLauncher";
import { ApplicationIdentity, ApplicationSettings, ApplicationAccountControls } from "./ApplicationChrome";
import "./ApplicationHome.css";
import { StudioDocumentBar } from "./StudioDocumentBar";

/** Shared product-library frame. Products own navigation, storage and actions. */
export function ApplicationHomeFrame({ children, className = "", layout = "header", design = "standard" }: {
  children: ReactNode;
  className?: string;
  /** "sidebar": the ApplicationSidebar runs full height and owns identity and account. */
  layout?: "header" | "sidebar";
  design?: "standard" | "studio";
}) {
  return <div className={`aui-application-home${design === "studio" ? " aui-application-home--studio" : ""}${layout === "sidebar" ? " aui-application-home--sidebar" : ""} ${className}`}>{children}</div>;
}

/** The same library header for hosted libraries and local-first applications. */
export function ApplicationHomeHeader({ app, name, apps, search, className = "", identity = true, onSettings, design = "standard" }: {
  app: string;
  name: string;
  apps: readonly LaunchableApp[];
  search?: ReactNode;
  className?: string;
  /** false when an ApplicationSidebar shows the product, account and app launcher: keeps search only. */
  identity?: boolean;
  design?: "standard" | "studio";
  onSettings?: () => void;
}) {
  if (design === "studio" && identity) return <StudioDocumentBar className={`aui-application-home-header ${className}`}
    application={{ id: app, name, apps, onSettings }} trailing={search} />;
  return <><header className={`aui-application-home-header${identity ? "" : " aui-application-home-header--search"} ${className}`}>
    {identity && <ApplicationIdentity id={app} name={name} apps={apps} />}
    {search}
    {identity && <ApplicationAccountControls />}
  </header>
    <ApplicationSettings name={name} onSettings={onSettings} />
  </>;
}
