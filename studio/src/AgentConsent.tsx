import { useEffect, useState } from 'react';
import { Button, Checkbox, SelectField } from '@aether/ui';
import './AgentConnections.css';

type Consent = { request: { client_name: string; redirect_uri: string; resource: string }; apps: string[] };
const names: Record<string, string> = { cad: 'CAD', map: 'Map', animation: 'Animation', sketch: 'Sketch', io: 'IO', vector: 'Vector' };
async function call<T>(action: string, request: string, access?: object): Promise<T> {
  const response = await fetch(`/api/automation/authorization/${action}`, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request, ...(access ? { access } : {}) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'This connection request is unavailable. Start again from your assistant.');
  return result as T;
}
export function AgentConsent({ request, username }: { request: string; username: string }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [apps, setApps] = useState<string[]>([]);
  const [level, setLevel] = useState('read');
  const [hours, setHours] = useState('24');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void call<Consent>('read', request).then(value => { if (active) setConsent(value); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [request]);
  async function finish(approve: boolean) {
    setBusy(true); setError('');
    try {
      const result = await call<{ redirect: string }>(approve ? 'approve' : 'deny', request, approve ? {
        label: consent!.request.client_name, apps, can_write: level !== 'read', can_edit_content: level === 'content', lifetime_hours: Number(hours),
      } : undefined);
      const url = new URL(result.redirect);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('The assistant callback is invalid.');
      window.location.assign(url.href);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return <main className="agent-consent aether-home-theme"><section className="agent-connections" aria-labelledby="agent-consent-title">
    <header><h1 id="agent-consent-title">Connect to Aether</h1><p>Signed in as <strong>{username}</strong></p></header>
    {consent ? <>
      <p><strong>{consent.request.client_name}</strong> is requesting access to your Aether applications.</p>
      <p className="hint">The client supplied its name. Check the destination before connecting.</p>
      <label>Return to<code className="agent-consent__destination">{consent.request.redirect_uri}</code></label>
      <form onSubmit={event => { event.preventDefault(); void finish(true); }}>
        <fieldset disabled={busy}><legend>Allow access to</legend><div className="agent-connections__apps">{consent.apps.map(app => <Checkbox key={app} label={`Aether ${names[app] || app}`} checked={apps.includes(app)} onChange={event => setApps(current => event.target.checked ? [...current, app] : current.filter(id => id !== app))} />)}</div></fieldset>
        <div className="agent-connections__fields">
          <label>Permission<SelectField aria-label="Permission" value={level} disabled={busy} onChange={e => setLevel(e.target.value)} options={[{ value: 'read', label: 'Read documents' }, { value: 'edit', label: 'Read, rename and create versions' }, { value: 'content', label: 'Edit saved documents' }]} /></label>
          <label>Expires after<SelectField aria-label="Expires after" value={hours} disabled={busy} onChange={e => setHours(e.target.value)} options={[{ value: '1', label: '1 hour' }, { value: '24', label: '1 day' }, { value: '168', label: '7 days' }]} /></label>
        </div>
        <p>The assistant can use files your account can access in these applications. It receives a separate, expiring connection; your password is never shared. You can revoke it in Agent access.</p>
        <p className="hint">Available tools depend on the application. Edits use saved revisions. Unsaved editor changes and live selection are not exposed by this connection.</p>
        <div className="agent-consent__actions"><Button type="button" disabled={busy} onClick={() => void finish(false)}>Cancel</Button><Button primary type="submit" disabled={busy || !apps.length}>{busy ? 'Connecting…' : 'Allow connection'}</Button></div>
      </form>
    </> : !error && <p role="status">Loading connection request…</p>}
    {error && <p role="alert">{error}</p>}
  </section></main>;
}
