import type {ReactNode} from "react";
import "./ApplicationList.css";
import {MenuButton} from "./Menu";
import {AetherIcon} from "./AetherIcon";

/** A consistent list heading. Counts belong to selection feedback, not page titles. */
export function ApplicationListHeading({children, description}: {children:ReactNode; description?:ReactNode}) {
  return <header className="aui-application-list-heading"><h2>{children}</h2>{description && <p>{description}</p>}</header>;
}
/** Filters, optional name search and commands always precede list content. */
export function ApplicationListControls({filters, search, actions}: {filters?:ReactNode; search?:ReactNode; actions?:ReactNode}) {
  return <div className="aui-application-list-controls">
    {filters && <div className="aui-application-list-filters">{filters}</div>}
    {search && <div className="aui-application-list-search">{search}</div>}
    {actions && <div className="aui-application-list-actions">{actions}</div>}
  </div>;
}

/** Sort/view pickers use the same menu surface and keyboard model as context menus. */
export function ListToolMenu({label,ariaLabel,icon,items,onPick}: {label:ReactNode;ariaLabel?:string;icon?:ReactNode;items:{id:string;label:string;icon?:ReactNode;checked?:boolean}[];onPick:(id:string)=>void}) {
 return <MenuButton className="aui-list-tool-menu" label={ariaLabel ?? (typeof label === "string" ? label : "Options")} items={items.map(item=>({...item,kind:item.checked === undefined ? "command" as const : "radio" as const}))} onSelect={onPick} placement="bottom-end">{icon}{label}<AetherIcon name="chevron-right"/></MenuButton>;
}
