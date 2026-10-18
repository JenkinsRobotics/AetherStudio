import { useState } from "react";
import { DashboardCard } from "./DashboardCards";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { AetherIcon } from "./AetherIcon";
import { TextField } from "./TextField";
import { Menu } from "./Menu";
import "./WorkflowWidgets.css";
export interface SequenceItem { id: string; label: string; group: string; }
export interface SequenceMessage { id: string; title: string; description: string; }
export interface SequenceBrowserProps { items: readonly SequenceItem[]; selected: string; onSelect: (id: string) => void; onAdd: () => void; onRename: (id: string, name: string) => void; onCommand: (id: string, command: string) => void; messages: readonly SequenceMessage[]; selectedMessage: string; onMessageSelect: (id: string) => void; onAddMessage: () => void; onGenerate: () => void; }
export function SequenceBrowser({ items, selected, onSelect, onAdd, onRename, onCommand, messages, selectedMessage, onMessageSelect, onAddMessage, onGenerate }: SequenceBrowserProps) {
  const [query, setQuery] = useState(""), [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const groups = [...new Set(items.map(item => item.group))];
  return <DashboardCard contentOnly density="compact" title="Sequences" className="aui-workflow aui-workflow-sequences" action={<div className="aui-workflow-actions"><IconButton appearance="glyph" label="Search sequences" aria-pressed={searching} onClick={() => { setSearching(value => !value); setQuery(""); }}><AetherIcon name="search" /></IconButton><IconButton appearance="glyph" label="New sequence" onClick={onAdd}><AetherIcon name="plus" /></IconButton></div>}>
    <div className="aui-workflow-columns"><div className="aui-workflow-sequence-list">
      {searching && <TextField aria-label="Find sequence" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find sequence" />}
      {groups.map(group => <div key={group}><button type="button" className="aui-workflow-group" aria-expanded={!collapsed.has(group)} onClick={() => setCollapsed(old => { const next = new Set(old); if (next.has(group)) next.delete(group); else next.add(group); return next; })}><AetherIcon name={collapsed.has(group) ? "chevron-right" : "chevron-down"} />{group}</button>
        {(!collapsed.has(group) || query) && items.filter(item => item.group === group && item.label.toLowerCase().includes(query.toLowerCase())).map(item => <div key={item.id} className="aui-workflow-sequence-row" data-selected={selected === item.id}>
          {renaming?.id === item.id ? <form onSubmit={e => { e.preventDefault(); if (renaming.name.trim()) onRename(item.id, renaming.name.trim()); setRenaming(null); }}><TextField autoFocus aria-label="Sequence name" value={renaming.name} onChange={e => setRenaming({ ...renaming, name: e.target.value })} onKeyDown={e => { if (e.key === "Escape") setRenaming(null); }} /></form> : <button type="button" title={item.label} aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}>{item.label}</button>}
          <IconButton appearance="glyph" label={`Options for ${item.label}`} onClick={e => setMenu({ id: item.id, anchor: e.currentTarget })}><AetherIcon name="more" /></IconButton>
        </div>)}
      </div>)}
      {query && !items.some(item => item.label.toLowerCase().includes(query.toLowerCase())) && <p className="aui-workflow-hint">No sequences found.</p>}
    </div><div className="aui-workflow-message-list"><header><strong>Messages</strong><IconButton appearance="glyph" label="New message" onClick={onAddMessage}><AetherIcon name="plus" /></IconButton></header>
      {messages.map(message => <button type="button" key={message.id} aria-pressed={selectedMessage === message.id} onClick={() => onMessageSelect(message.id)}><strong>{message.title}</strong><small>{message.description}</small></button>)}
      {!messages.length && <p className="aui-workflow-hint">Add your first message.</p>}<Button onClick={onGenerate} disabled={!messages.length}>Generate all</Button>
    </div></div>
    <Menu open={Boolean(menu)} anchor={menu?.anchor ?? null} ariaLabel="Sequence commands" applicationCommands={false} onClose={() => setMenu(null)} items={[{ id: "rename", label: "Rename", icon: <AetherIcon name="notes" /> }, { id: "duplicate", label: "Duplicate", icon: <AetherIcon name="copy" /> }, { id: "move", label: "Move to team space", icon: <AetherIcon name="collection-folder" /> }, { id: "delete", label: "Delete", icon: <AetherIcon name="delete" /> }]} onSelect={command => { if (menu) { if (command === "rename") setRenaming({ id: menu.id, name: items.find(item => item.id === menu.id)?.label ?? "" }); else onCommand(menu.id, command); } setMenu(null); }} />
  </DashboardCard>;
}
