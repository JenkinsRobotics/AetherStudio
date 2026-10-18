import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { AetherIcon } from './AetherIcon';
import { IconButton } from './IconButton';
import { Menu } from './Menu';
import './CollectionView.css';

export interface CollectionControl {
  id: string; label: string; icon: ReactNode; disabled?: boolean; separatorBefore?: boolean;
  shortcut?: 'Delete' | 'F2'; onClick: () => void;
}
/** Docking remains owned by WorkspaceShell; its commands join the collection menu. */
export const CollectionHost = createContext<{ title?: string; controls?: readonly CollectionControl[] }>({});

/** One command location for every collection: two primary buttons and overflow. */
export function CollectionActions({ controls = [], primaryControls, label = 'Item controls' }: {
  controls?: readonly CollectionControl[]; primaryControls?: readonly CollectionControl[]; label?: string;
}) {
  const host = useContext(CollectionHost), [open, setOpen] = useState(false), anchor = useRef<HTMLDivElement>(null);
  const unique = (items: readonly CollectionControl[]) => items.filter((item, i) => items.findIndex(other => other.id === item.id) === i);
  const own = unique([...(primaryControls ?? []), ...controls]);
  const preferred = primaryControls ?? [
    own.find(c => /folder/i.test(c.id)),
    own.find(c => /settings/i.test(c.id)),
    own.find(c => !/folder/i.test(c.id) && /^(new|add|create)/i.test(c.id)),
  ].filter((c): c is CollectionControl => Boolean(c));
  const primary = unique(preferred).slice(0, 2);
  const commands = unique([...own, ...(host.controls ?? [])]).filter(c => !primary.some(p => p.id === c.id));
  if (!primary.length && !commands.length) return null;
  return <div className="aui-collection-actions" role="group" aria-label={label} ref={anchor}>
    {primary.map(control => <IconButton key={control.id} label={control.label} disabled={control.disabled}
      onClick={control.onClick}>{control.icon}</IconButton>)}
    {commands.length > 0 && <IconButton label={`More ${label}`} aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen(!open)}><AetherIcon name="more" /></IconButton>}
    {open && commands.length > 0 && <Menu className="aui-collection-popup" open anchor={anchor.current} placement="bottom-end" ariaLabel={label}
      items={commands.map(c => ({ id: c.id, label: c.label, icon: c.icon, disabled: c.disabled, shortcut: c.shortcut, separatorBefore: c.separatorBefore }))}
      onSelect={id => { commands.find(c => c.id === id)?.onClick(); setOpen(false); }} onClose={() => setOpen(false)} />}
  </div>;
}

export function CollectionView({ title, headerActions, filter, children, footer, controls, primaryControls, controlsLabel, className = '', id, onKeyDown }: {
  title?: string; headerActions?: ReactNode; filter?: ReactNode; children: ReactNode; footer?: ReactNode;
  controls?: readonly CollectionControl[]; primaryControls?: readonly CollectionControl[]; controlsLabel?: string;
  className?: string; id?: string; onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}) {
  const host = useContext(CollectionHost);
  return <div id={id} className={`aui-collection ${className}`} onKeyDown={onKeyDown}>
    <header className="aui-collection-heading"><strong>{title ?? host.title ?? 'Items'}</strong><span className="aui-collection-heading-actions">{headerActions}<CollectionActions controls={controls} primaryControls={primaryControls} label={controlsLabel} /></span></header>
    {filter && <div className="aui-collection-search">{filter}</div>}
    {children}
    {footer}
  </div>;
}
