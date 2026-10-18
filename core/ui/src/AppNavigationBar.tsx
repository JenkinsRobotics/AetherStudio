import type { ReactNode } from "react";
import { AppWordmark, resolveAppWordmark, type AppWordmarkName } from "./AppWordmark";
import { Button } from "./Button";
import { DocumentBar } from "./DocumentBar";
import "./AppNavigationBar.css";

export interface AppNavigationItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface AppNavigationBarProps {
  brand: string;
  /** Registered app identity; canonical Aether brand names are recognized automatically. */
  app?: AppWordmarkName;
  mark?: ReactNode;
  items: readonly AppNavigationItem[];
  activeID: string;
  onNavigate: (id: string) => void;
  onHome: () => void;
  /** Right-aligned pinned utilities, Share, menus and account controls supplied by the application. */
  actions?: ReactNode;
  className?: string;
}

/** Left-aligned grouped page navigation composed in the standard DocumentBar container.
 * Narrow containers move the page row below the identity and actions. */
export function AppNavigationBar({ brand, app, mark, items, activeID, onNavigate, onHome, actions, className }: AppNavigationBarProps) {
  const identity = app ?? resolveAppWordmark(brand);
  return <div className={["aui-app-navigation", className].filter(Boolean).join(" ")}>
    <DocumentBar windowChrome={false} className="aui-app-navigation__bar"
      leading={<Button appearance="link" className="aui-app-navigation__brand" aria-label={`${brand} home`} onClick={onHome}>
        {identity ? <AppWordmark app={identity} size={32} decorative/> : <>{mark && <span aria-hidden="true">{mark}</span>}<strong>{brand}</strong></>}
      </Button>}
      center={<nav aria-label={brand} className="aui-app-navigation__pages">
        {items.map(item => <Button key={item.id} appearance="link" disabled={item.disabled}
          aria-current={item.id === activeID ? "page" : undefined}
          onClick={() => onNavigate(item.id)}>{item.label}</Button>)}
      </nav>}
      trailing={actions}/>
  </div>;
}
