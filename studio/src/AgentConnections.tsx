import { useEffect, useState } from 'react';
import { Button, Checkbox, SelectField, TextField } from '@aether/ui';
import './AgentConnections.css';

type Connection = { id: string; label: string; apps: string[]; can_write: boolean; can_edit_content: boolean; expires: number; active: boolean };
type App = { id: string; name: string };
type Listing = { connections: Connection[]; apps: App[]; bridge?: string; saved_content_editing_available?: boolean };

async function call<T>(action: string, data = {}): Promise<T> {
  const response = await fetch(`/api/automation/connections/${action}`, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The agent connection could not be updated.');
  return result as T;
}

export function AgentConnections() {
  const [listing, setListing] = useState<Listing>({ connections: [], apps: [] });
  const [label, setLabel] = useState(''), [selected, setSelected] = useState<string[]>([]);
  const [access, setAccess] = useState('read'), [hours, setHours] = useState('24');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [issued, setIssued] = useState<{ id: string; token: string } | null>(null);
  useEffect(() => {
    let active = true;
    void call<Listing>('list').then(value => { if (active) setListing(value); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function create() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await call<{ connection: Connection; token: string }>('create', { label, apps: selected, can_write: access !== 'read', can_edit_content: access === 'content', lifetime_hours: Number(hours) });
      setIssued({ id: result.connection.id, token: result.token });
      setListing(current => ({ ...current, connections: [result.connection, ...current.connections] }));
      setLabel('');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      await call('revoke', { id });
      setListing(current => ({ ...current, connections: current.connections.map(item => item.id === id ? { ...item, active: false } : item) }));
      if (issued?.id === id) setIssued(null);
      setNotice('Agent access revoked.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(issued!.token); setNotice('Connection key copied.'); }
    catch { setError('Select the connection key and copy it manually.'); }
  }
  return <section className="agent-connections" aria-labelledby="agent-connections-title">
    <header><h2 id="agent-connections-title">Agent access</h2><p>Connect an external assistant to saved Aether documents. Choose its applications and access level; revoke access at any time.</p></header>
    <p className="hint">Agents can inspect saved files and version history. Available editing commands depend on the server and application. Choose editing access separately; existing connections keep their original permissions. External connections operate on saved documents; unsaved editor changes and selection are not exposed.</p>
    <div className="agent-connections__key"><h3>Connect with your Studio sign-in</h3><p>Add this MCP server URL in a compatible assistant. It will open Aether so you can choose applications and permissions.</p><TextField aria-label="MCP server URL" value={`${location.origin}/mcp`} readOnly onFocus={event => event.target.select()} /><p className="hint">Use the server’s configured HTTPS address from other workstations. A localhost address is reachable only on this computer. Cloud assistants need a reachable server or their supported private connection. Local CLI/MCP connections below remain available.</p></div>
    <form onSubmit={event => { event.preventDefault(); void create(); }}>
      <div className="agent-connections__fields">
        <label>Connection name<TextField value={label} maxLength={80} placeholder="My assistant" disabled={busy} onChange={event => setLabel(event.target.value)} required /></label>
        <label>Access<SelectField value={access} disabled={busy} onChange={event => setAccess(event.target.value)} options={[{ value: 'read', label: 'Read documents' }, { value: 'edit', label: 'Read, rename and create versions' }, ...(listing.saved_content_editing_available === false ? [] : [{ value: 'content', label: 'Edit saved documents' }])]} /></label>
        <label>Expires after<SelectField value={hours} disabled={busy} onChange={event => setHours(event.target.value)} options={[{ value: '1', label: '1 hour' }, { value: '24', label: '1 day' }, { value: '168', label: '7 days' }]} /></label>
      </div>
      <fieldset disabled={busy}><legend>Applications</legend><div className="agent-connections__apps">{listing.apps.map(app => <Checkbox key={app.id} label={app.name} checked={selected.includes(app.id)} onChange={event => setSelected(current => event.target.checked ? [...current, app.id] : current.filter(id => id !== app.id))} />)}</div></fieldset>
      <p className="hint">Access covers files your account can access in the selected applications. File permissions still apply. Saved edits create recoverable history; reload an open editor to see them.</p>
      <Button primary type="submit" disabled={busy || !label.trim() || !selected.length || !!issued}>Create connection</Button>
    </form>
    {issued && <div className="agent-connections__key" role="region" aria-label="New agent connection">
      <p>Save this connection key in your assistant’s local configuration. It is shown only here and will disappear when you leave.</p>
      <TextField aria-label="Connection key" value={issued.token} readOnly autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} />
      <div><Button onClick={() => void copy()}>Copy key</Button><Button onClick={() => { setIssued(null); setNotice('Connection key dismissed.'); }}>Done</Button></div>
    </div>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="agent-connections__list" aria-label="Your agent connections">{listing.connections.map(item => {
      const active = item.active && item.expires * 1000 > Date.now();
      return <article key={item.id}><div><strong>{item.label}</strong><p>{item.apps.map(id => listing.apps.find(app => app.id === id)?.name || id).join(', ')} · {item.can_edit_content ? 'Edit saved documents' : item.can_write ? 'Read, rename and create versions' : 'Read only'}</p><small>{active ? `Expires ${new Date(item.expires * 1000).toLocaleString()}` : 'Inactive'}</small></div><Button disabled={busy || !active} onClick={() => void revoke(item.id)}>Revoke</Button></article>;
    })}{!listing.connections.length && <p className="hint">No agent connections yet.</p>}</div>
    {listing.saved_content_editing_available === false && <p className="hint">This server currently supports reading documents, renaming them and creating named versions. Product editing commands are still being migrated.</p>}
    <details><summary>Connect a local MCP client</summary><p>Run <code>aether-agent mcp</code> from your Studio installation. The command catalog shows which operations your connection can use. Set <code>AETHER_SERVER_URL</code> to your local server address (for example <code>http://localhost:8780</code>) and <code>AETHER_AUTOMATION_TOKEN</code> to your connection key in the client’s private environment settings.</p><p>This adapter connects to a server on the same computer. For an assistant on another computer, use the MCP URL above with your Studio sign-in.</p></details>
  </section>;
}
