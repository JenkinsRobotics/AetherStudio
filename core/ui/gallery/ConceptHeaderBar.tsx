import { useState } from "react";
import { AetherIcon, Avatar, Button, Checkbox, DocumentBar, IconButton, Menu, Popover, TextField } from "../src";
import "./ConceptHeaderBar.css";

const PAGES = [
  { id: "portfolio", label: "Portfolio" },
  { id: "markets", label: "Markets" },
  { id: "futures", label: "Futures", children: ["Overview", "Watchlist", "Positions"] },
  { id: "pulse", label: "Pulse" },
  { id: "trade", label: "Trade", children: ["Spot", "Orders", "History"] },
  { id: "square", label: "Square", children: ["Discover", "Following", "Saved"] },
  { id: "earnings", label: "Earnings" },
] as const;
type Panel = "search" | "settings" | "notifications" | "support" | "profile";
const PANEL_TITLE: Record<Panel, string> = { search: "Search pages", settings: "Header settings", notifications: "Notifications", support: "Help & shortcuts", profile: "Your profile" };

/** Gallery-only concept composed from the existing header, element and overlay standards. */
export function ConceptHeaderBar() {
  const [active, setActive] = useState("portfolio"), [destination, setDestination] = useState("Portfolio");
  const [light, setLight] = useState(false), [compact, setCompact] = useState(true);
  const [alerts, setAlerts] = useState(true), [unread, setUnread] = useState(true);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [panel, setPanel] = useState<{ id: Panel; anchor: HTMLElement } | null>(null);
  const theme = `concept-header-theme${light ? " concept-header-theme--light" : ""}`;
  const parent = PAGES.find(page => page.id === menu?.id);
  const matches = PAGES.filter(page => page.label.toLowerCase().includes(query.trim().toLowerCase()));
  function navigate(id: string, title: string) { setActive(id); setDestination(title); setMenu(null); setPanel(null); }
  function togglePanel(id: Panel, anchor: HTMLElement) { setMenu(null); setPanel(panel?.id === id ? null : { id, anchor }); }
  function utility(id: Panel, icon: string, label: string) {
    return <IconButton appearance="glyph" label={label} aria-haspopup="dialog" aria-expanded={panel?.id === id}
      onClick={event => togglePanel(id, event.currentTarget)}><AetherIcon name={icon}/></IconButton>;
  }
  return <div className="concept-header-specimen">
    <p className="concept-header-intro">A compact navigation concept with a white selected pill, dropdown pages and a quiet utility row.</p>
    <div className={`concept-header-frame ${theme}`} data-compact={compact}>
      <DocumentBar windowChrome={false} className="concept-header-bar"
        leading={<Button appearance="link" className="concept-header-brand" aria-label="Aether home" onClick={() => navigate("portfolio", "Portfolio")}>
          <AetherIcon name="circle"/><strong>Aether</strong>
        </Button>}
        center={<nav aria-label="Concept app navigation" className="concept-header-pages">
          {PAGES.map(page => <Button key={page.id} appearance="link" className="concept-header-page"
            aria-current={active === page.id ? "page" : undefined}
            aria-haspopup={"children" in page ? "menu" : undefined}
            aria-expanded={"children" in page ? menu?.id === page.id : undefined}
            onClick={event => {
              setPanel(null);
              if ("children" in page) setMenu(menu?.id === page.id ? null : { id: page.id, anchor: event.currentTarget });
              else navigate(page.id, page.label);
            }}><span>{page.label}</span>{"children" in page && <AetherIcon name="chevron-down"/>}</Button>)}
        </nav>}
        trailing={<>
          {utility("search", "search", "Search pages")}
          <span className="concept-header-divider" aria-hidden="true"/>
          {utility("settings", "settings", "Header settings")}
          <IconButton appearance="glyph" label={light ? "Use dark appearance" : "Use light appearance"} aria-pressed={light} onClick={() => setLight(!light)}><AetherIcon name={light ? "appearance-light" : "appearance-dark"}/></IconButton>
          <span className="concept-header-notification">{utility("notifications", "bell", "Notifications")}{alerts && unread && <span className="concept-header-unread" aria-label="Unread notification"/>}</span>
          {utility("support", "comment", "Help & shortcuts")}
          <IconButton appearance="glyph" label="Your profile" aria-haspopup="dialog" aria-expanded={panel?.id === "profile"} onClick={event => togglePanel("profile", event.currentTarget)}><Avatar name="Alex Morgan" size="small"/></IconButton>
        </>}/>
    </div>
    <p className="concept-header-status" role="status">{destination} selected</p>
    <Menu open={!!menu} anchor={menu?.anchor ?? null} ariaLabel={`${parent?.label ?? "Navigation"} pages`}
      applicationCommands={false} placement="bottom-start" className={`${theme} concept-header-menu`}
      items={parent && "children" in parent ? parent.children.map(label => ({ id: label, label, kind: "radio", checked: destination === `${parent.label} / ${label}` })) : []}
      onSelect={label => { if (parent) navigate(parent.id, `${parent.label} / ${label}`); }} onClose={() => setMenu(null)}/>
    <Popover open={!!panel} anchor={panel?.anchor ?? null} ariaLabel={panel ? PANEL_TITLE[panel.id] : "Header controls"}
      placement="bottom-end" focus="first" onClose={() => setPanel(null)} className={`${theme} concept-header-popover`}>
      <strong>{panel ? PANEL_TITLE[panel.id] : ""}</strong>
      {panel?.id === "search" && <>
        <TextField aria-label="Find a page" placeholder="Find a page…" value={query} onChange={event => setQuery(event.target.value)}/>
        <div className="concept-header-results">{matches.map(page => <Button key={page.id} appearance="link" onClick={() => navigate(page.id, page.label)}>{page.label}<AetherIcon name="chevron-right"/></Button>)}</div>
        {!matches.length && <p>No pages match “{query}”.</p>}
      </>}
      {panel?.id === "settings" && <>
        <Checkbox label="Compact header" checked={compact} onChange={event => setCompact(event.target.checked)}/>
        <Checkbox label="Notification indicator" checked={alerts} onChange={event => setAlerts(event.target.checked)}/>
      </>}
      {panel?.id === "notifications" && <><p>{unread ? "Your weekly portfolio summary is ready." : "You’re all caught up."}</p>{unread && <Button appearance="flat" onClick={() => setUnread(false)}>Mark as read</Button>}</>}
      {panel?.id === "support" && <><p>Use Tab to move between header controls. Open a dropdown with Enter, then use the arrow keys to choose a page.</p><p>Press Esc to close any menu.</p></>}
      {panel?.id === "profile" && <><div className="concept-header-profile"><Avatar name="Alex Morgan"/><span><strong>Alex Morgan</strong><small>Personal workspace · Demo account</small></span></div><Button appearance="flat" onClick={() => { setPanel(null); navigate("portfolio", "Portfolio"); }}>View portfolio</Button></>}
    </Popover>
  </div>;
}
