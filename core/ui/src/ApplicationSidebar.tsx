import { useState, type MouseEvent, type ReactNode } from "react";
import { AetherIcon, type AetherIconName } from "./AetherIcon";
import { AppMark } from "./AppMark";
import { AppWordmark, resolveAppWordmark, type AppWordmarkName } from "./AppWordmark";
import { AppLauncher, type LaunchableApp } from "./AppLauncher";
import { CollapsibleSidebar, SidebarLabel, SidebarToggle } from "./CollapsibleSidebar";
import { AppearanceToggle } from "./StudioChrome";
import { ThemeMenu } from "./ThemeMenu";
import "./ApplicationSidebar.css";

export interface SidebarItem {
  id: string;
  label: string;
  /** A shared glyph name, or a custom tile (e.g. a workspace initial). */
  icon: AetherIconName | ReactNode;
  /** Count or short status shown at the row's end; hidden in the rail. */
  badge?: number | string;
  current?: boolean;
  disabled?: boolean;
  href?: string;
  onSelect?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
}

export interface SidebarSection {
  id: string;
  /** Group title; the captioned variant retains it in the collapsed rail. */
  title?: string;
  items: readonly SidebarItem[];
}

export function SidebarRow({ item }: { item: SidebarItem }) {
  const icon = typeof item.icon === "string" ? <AetherIcon name={item.icon as AetherIconName} /> : item.icon;
  const body = <>
    <span className="aui-application-sidebar-icon" aria-hidden="true">{icon}</span>
    <SidebarLabel>{item.label}</SidebarLabel>
    {item.badge !== undefined && <span className="aui-application-sidebar-badge">{item.badge}</span>}
  </>;
  // title gives the icon-only rail its tooltip; aria-label keeps the name when labels are hidden.
  const shared = { onContextMenu: item.onContextMenu, className: "aui-application-sidebar-row", title: item.label, "aria-label": item.label, "aria-current": item.current ? "page" as const : undefined };
  return item.href && !item.disabled
    ? <a {...shared} href={item.href} onClick={item.onSelect}>{body}</a>
    : <button {...shared} type="button" disabled={item.disabled} onClick={item.onSelect}>{body}</button>;
}

/** Sections of navigation rows. Rendered by ApplicationSidebar; exported for app-owned layouts. */
export function SidebarNavigation({ sections, ariaLabel, captions = false }: { sections: readonly SidebarSection[]; ariaLabel: string; captions?: boolean }) {
  // One navigation landmark per section, named by its caption.
  return <div className="aui-application-sidebar-navigation">
    {sections.map((section) => <nav key={section.id} className="aui-application-sidebar-section" aria-label={section.title ?? ariaLabel}>
      {section.title && captions ? <div className="aui-application-sidebar-caption">{section.title}</div> : null}
      {section.title && !captions ? <SidebarGroup title={section.title}>{section.items.map(item => <SidebarRow key={item.id} item={item} />)}</SidebarGroup> : section.items.map(item => <SidebarRow key={item.id} item={item} />)}
    </nav>)}
  </div>;
}

/**
 * The standard Aether sidebar. Products provide sections and commands; the host
 * owns identity (the account mount in the footer). Collapses to an icon rail.
 */
export function ApplicationSidebar({ id, name, app, icon, homeUrl, brand = true, action, sections, settings, apps, currentApp, children, footerTools, footer, className, userLabel = "My workspace", toggleInContent = false, selection = "solid", defaultCollapsed, variant = "standard" }: {
  /** Captioned retains group labels. Studio uses a stacked brand, dark surface and larger rows. Both collapse from their brand. */
  variant?: "standard" | "captioned" | "studio";
  /** "solid": accent-filled current row; "tint": a soft accent wash with accent text. */
  selection?: "solid" | "tint";
  defaultCollapsed?: boolean;
  /** Stable storage key; independent of the currently selected workspace. */
  id: string;
  toggleInContent?: boolean;
  userLabel?: ReactNode;
  name: string;
  /** Registered app identity. Canonical Aether names are also recognized automatically. */
  app?: AppWordmarkName;
  /** Fallback artwork for custom applications. Registered apps use wordmark/A artwork. */
  icon?: ReactNode;
  /** Brand home link for standard navigation; captioned navigation uses its brand to collapse. */
  homeUrl?: string;
  /** false when a page header already shows the product identity. */
  brand?: boolean;
  /** Primary command above the navigation, e.g. "Create or upload". */
  action?: ReactNode;
  sections?: readonly SidebarSection[];
  /** Adds the pinned Settings row; without `onSelect` it opens the app's shared settings window. */
  settings?: Partial<SidebarItem> | true;
  /** Adds the suite app launcher below Settings. */
  apps?: readonly LaunchableApp[];
  /** The app this sidebar belongs to, marked current in the launcher. */
  currentApp?: string;
  children?: ReactNode;
  footerTools?: ReactNode;
  /** Optional app document/status footer; omitting this retains tools, settings and account. */
  footer?: ReactNode;
  className?: string;
}) {
  const settingsItem: SidebarItem | null = settings ? {
    id: "settings", label: "Settings", icon: "settings",
    onSelect: () => document.dispatchEvent(new CustomEvent("aether-open-settings", { cancelable: true })),
    ...(settings === true ? {} : settings),
  } : null;
  const identity = app ?? resolveAppWordmark(name);
  const brandContent = identity ? <>
    <span className="aui-application-sidebar-mark" aria-hidden="true"><AppMark app={identity} size={variant === "standard" ? 32 : 40}/></span>
    <SidebarLabel><AppWordmark app={identity} size={variant === "standard" ? 32 : 40} appearance={variant === "studio" ? "dark" : "auto"} decorative/></SidebarLabel>
  </> : <>{icon}<SidebarLabel><strong>{name}</strong></SidebarLabel></>;
  const brandToggle = variant !== "standard" && !toggleInContent;
  return <CollapsibleSidebar id={id} ariaLabel={`${name} sidebar`} className={`aui-application-sidebar${variant !== "standard" ? ` aui-application-sidebar--${variant}` : ""}${selection === "tint" ? " aui-application-sidebar--tint" : ""}${className ? ` ${className}` : ""}`} toggle="custom" defaultCollapsed={defaultCollapsed}
    footer={footer ?? <>
      {footerTools && <div className="aui-application-sidebar-tools">{footerTools}</div>}
      {(settingsItem || apps) && <div className="aui-application-sidebar-settings">
        {settingsItem && <SidebarRow item={settingsItem} />}
        {apps && <AppLauncher apps={apps} currentID={currentApp} label="Apps" className="aui-application-sidebar-row" placement="top-start" />}
      </div>}
      <div className="aui-application-sidebar-profile" data-aether-account="" data-aether-account-layout="sidebar">
        <div className="aui-application-sidebar-fallback"><SidebarLabel>Local preview</SidebarLabel><ThemeMenu /><AppearanceToggle /></div>
      </div>
    </>}>
    <div className={`aui-application-sidebar-brand${identity ? " aui-application-sidebar-brand--wordmark" : ""}${brand ? "" : " aui-application-sidebar-brand--toggle-only"}`}>
      {brand && (brandToggle
        ? <SidebarToggle className="aui-application-sidebar-brand-toggle">{brandContent}</SidebarToggle>
        : <a href={homeUrl} aria-label={`${name} home`} title={name}>{brandContent}</a>)}
      {brandToggle && !brand && <SidebarToggle />}
    </div>
    {action && <div className="aui-application-sidebar-action">{action}</div>}
    {variant === "standard" && !toggleInContent && <div className="aui-application-sidebar-user"><SidebarLabel>{userLabel}</SidebarLabel><SidebarToggle /></div>}
    <div className="aui-application-sidebar-content">
      {sections && <SidebarNavigation sections={sections} ariaLabel={name} captions={variant === "captioned"} />}
      {children}
    </div>
  </CollapsibleSidebar>;
}

export function SidebarGroup({title, children, storageKey}: {title:string; children:ReactNode; storageKey?:string}) {
 const [expanded,setExpanded]=useState(()=>{try{return !storageKey || localStorage.getItem(storageKey) !== "false";}catch{return true;}});
 return <><button type="button" className="aui-application-sidebar-disclosure" aria-label={`${expanded ? "Hide" : "Show"} ${title}`} aria-expanded={expanded} onClick={()=>{setExpanded(!expanded);try{if(storageKey)localStorage.setItem(storageKey,String(!expanded));}catch{/* device preference only */}}}><SidebarLabel>{title}</SidebarLabel><AetherIcon name={expanded ? "chevron-down" : "chevron-up"}/></button>{expanded && children}</>;
}
export function WorkspaceIcon({name}: {name:string}) {
 return <span className="aui-workspace-monogram">{name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase()}</span>;
}
