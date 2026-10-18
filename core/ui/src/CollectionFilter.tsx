import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { AetherIcon } from './AetherIcon';
import { Menu } from './Menu';

export interface CollectionFilterOption { id: string; label: string; icon?: ReactNode }
export interface CollectionFilterProps {
  query: string; onQueryChange: (query: string) => void;
  options?: readonly CollectionFilterOption[]; value?: string; onChange?: (id: string) => void;
  ariaLabel: string; inputRef?: RefObject<HTMLInputElement | null>; inputID?: string;
  /** Rows the filter is showing; omitted means no count is announced. */
  resultCount?: number;
}
export function CollectionFilter({ query, onQueryChange, options = [], value = 'all', onChange, ariaLabel, inputRef, inputID, resultCount }: CollectionFilterProps) {
  // How many rows the filter is showing, announced the way SearchField does it,
  // so a person filtering a long tree can see the query is working.
  const countLabel = resultCount === undefined ? null
    : `${resultCount.toLocaleString()} ${resultCount === 1 ? 'result' : 'results'}`;
  const anchor = useRef<HTMLDivElement>(null), [open, setOpen] = useState(false);
  const choices = [{ id: 'all', label: 'All Items', icon: <AetherIcon name="items" /> }, ...options.filter(o => o.id !== 'all')];
  const current = choices.find(o => o.id === value) ?? choices[0];
  return <div className="aui-collection-filter" ref={anchor}>
    <span className="aui-collection-filter-icon" aria-hidden>{query ? <AetherIcon name="search" /> : current.icon ?? <AetherIcon name="items" />}</span>
    <input id={inputID} ref={inputRef} type="search" aria-label={ariaLabel} placeholder={current.label} value={query}
      onChange={e => onQueryChange(e.target.value)} onKeyDown={e => {
        if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); onQueryChange(''); }
        if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); setOpen(true); }
      }} />
    {countLabel ? <output className="aui-collection-filter-count" aria-live="polite">{countLabel}</output> : null}
    {query && <button type="button" aria-label={`Clear ${ariaLabel}`} onClick={() => onQueryChange('')}><AetherIcon name="close" /></button>}
    <button type="button" aria-label={`${ariaLabel} types`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><AetherIcon name="sort-chevron" /></button>
    {open && <div className="aui-collection-filter-menu"><Menu className="aui-collection-popup" open style={{ width: Math.max(200, anchor.current?.getBoundingClientRect().width ?? 240) }} anchor={anchor.current} ariaLabel={`${ariaLabel} types`} onClose={() => setOpen(false)}
      items={choices.map(o => ({ ...o, kind: 'radio', checked: o.id === current.id }))}
      onSelect={id => { onChange?.(id); setOpen(false); }} /></div>}
  </div>;
}
