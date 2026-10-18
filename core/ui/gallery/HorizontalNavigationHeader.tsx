import { useId, useRef, useState } from "react";
import { AppMark, Avatar, Popover, SidebarNavigation, SidebarRow } from "../src";
import { referenceSections } from "./NavBarsDemo";
import "./HorizontalNavigationHeader.css";

/** Review variant of the captioned sidebar; shares its navigation data and rows. */
export function HorizontalNavigationHeader() {
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState("settings");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountButton = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const sections = referenceSections.map(section => ({ ...section, items: section.items.map(item => ({
    ...item, current: selected === item.id, onSelect: () => { setSelected(item.id); setAccountOpen(false); },
  })) }));

  return <div className="horizontal-header-specimen">
    <p>The captioned sidebar arranged horizontally. Click the A to hide the strip; click it again to bring everything back.</p>
    <header className="horizontal-navigation-header" aria-label="Collapsible navigation header" data-expanded={expanded}>
      <button type="button" className="horizontal-header-brand" aria-label={`${expanded ? "Collapse" : "Expand"} navigation header`}
        title={`${expanded ? "Collapse" : "Expand"} navigation header`} aria-expanded={expanded} aria-controls={contentId}
        onClick={() => { setAccountOpen(false); setExpanded(value => !value); }}>
        <AppMark app="cad" size={40}/>
      </button>
      <div id={contentId} className="horizontal-header-content" hidden={!expanded}>
        <SidebarNavigation sections={sections} ariaLabel="Aether CAD" captions/>
        <div className="horizontal-header-utilities">
          <SidebarRow item={{ id: "settings", label: "Settings", icon: "settings", current: selected === "settings", onSelect: () => { setSelected("settings"); setAccountOpen(false); } }}/>
          <span className="horizontal-header-divider" aria-hidden="true"/>
          <button type="button" ref={accountButton} className="horizontal-header-account" aria-label="Your profile" title="Your profile"
            aria-haspopup="dialog" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}>
            <Avatar name="Alex Morgan" size="small"/>
          </button>
        </div>
      </div>
    </header>
    <Popover open={accountOpen && expanded} anchor={accountButton.current} ariaLabel="Header profile" placement="bottom-end" focus="first" onClose={() => setAccountOpen(false)}>
      <div className="horizontal-header-profile"><Avatar name="Alex Morgan"/><span><strong>Alex Morgan</strong><small>Personal workspace · Demo account</small></span></div>
    </Popover>
  </div>;
}
