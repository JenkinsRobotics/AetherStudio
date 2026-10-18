import { useEffect, useState } from 'react';
import { AetherIcon, Button, TextField } from '@aether/ui';
import { studioAgentService as service, type AgentJob, type AgentPlugin } from '@aether/session/agent';
import chatgptIcon from '@aether/assets/branding/providers/chatgpt.webp';
import claudeIcon from '@aether/assets/branding/providers/claude.png';
import geminiIcon from '@aether/assets/branding/providers/gemini.png';
import './PluginMarketplace.css';
import { filterPlugins, pluginStatus, pluginControls } from './plugin-catalog';
import { AgentConnections } from './AgentConnections';

const providerIcons: Record<string, string | undefined> = { chatgpt: chatgptIcon, claude: claudeIcon, gemini: geminiIcon };

export function PluginMarketplace({ admin, app, canManage = admin }: { admin: boolean; app?: string; canManage?: boolean }) {
  const [plugins, setPlugins] = useState<AgentPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState(''), [tab, setTab] = useState('all');
  const [error, setError] = useState(''), [busy, setBusy] = useState('');
  const [jobs, setJobs] = useState<Record<string, AgentJob>>({});
  const [code, setCode] = useState('');
  async function refresh() {
    const result = await service.call<{ plugins: AgentPlugin[] }>('catalog');
    setPlugins(result.plugins);
    setJobs(previous => { const next = { ...previous }; for (const p of result.plugins) if (p.job) next[p.id] = p.job; return next; });
  }
  useEffect(() => { let alive = true; setLoading(true); setError(''); void service.call<{ plugins: AgentPlugin[] }>('catalog').then(r => { if (alive) { setPlugins(r.plugins); setJobs(Object.fromEntries(r.plugins.filter(p => p.job).map(p => [p.id, p.job!]))); } }).catch(e => alive && setError(e.message)).finally(() => alive && setLoading(false)); return () => { alive = false; }; }, [attempt]);
  const running = Object.values(jobs).filter(j => j.state === 'running').map(j => j.id).join(',');
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const poll = async () => {
      for (const id of running.split(',')) {
        try {
          const job = await service.call<AgentJob>('job', { id });
          if (!alive) return;
          setJobs(j => ({ ...j, [job.provider]: job }));
          if (job.state !== 'running') await refresh();
        } catch (e) { if (alive) setError((e as Error).message); }
      }
    };
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => { await poll(); if (alive) timer = setTimeout(() => void tick(), 900); };
    void tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [running]);
  async function act(provider: string, action: string) {
    setBusy(provider); setError(''); setCode('');
    try {
      const result = await service.call<AgentJob | { plugins: AgentPlugin[] }>(action, { provider });
      if ('id' in result) setJobs(j => ({ ...j, [provider]: result }));
      else { setPlugins(result.plugins); setJobs(j => { const next = { ...j }; delete next[provider]; return next; }); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  const shown = filterPlugins(plugins, tab, query);
  return <section className="studio-plugins" aria-label="Plugins">
    <div className="page-heading"><div><h1>Plugins</h1><p>{admin ? 'Install and manage plugins for this Aether Studio installation.' : 'Connect your agents. Use them across your Aether workspaces.'}</p></div><span className="badge">{admin ? 'Installation management' : 'Personal account sign-in'}</span></div>
    {!admin && !app && <AgentConnections />}
    <div className="studio-plugins__filters"><div role="group" aria-label="Plugin filter">{[['all','All plugins'],['installed','Installed'],['connected','Connected']].map(([id,label])=><Button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</Button>)}</div><TextField aria-label="Search plugins" placeholder="Search plugins…" value={query} onChange={e => setQuery(e.target.value)}/><div role="group" aria-label="Plugin view"><Button aria-label="Gallery view" aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')}><AetherIcon name="grid-2"/></Button><Button aria-label="List view" aria-pressed={layout==='list'} onClick={()=>setLayout('list')}><AetherIcon name="items"/></Button></div></div>
    {app && <p className="hint">Connect your own AI account to use an advisor across Aether apps.</p>}
    {error && <div role="alert"><p>{error}</p><Button onClick={() => setAttempt(value => value + 1)}>Retry</Button></div>}
    {loading && <p role="status">Loading plugins…</p>}
    <div className={`studio-plugins__grid studio-plugins__grid--${layout}`}>{shown.map(p => {
      const controls = pluginControls(p, admin, canManage);
      const available = p.capabilities.chat || p.capabilities.imageGeneration || p.capabilities.videoGeneration;
      const currentJob = jobs[p.id];
      const personalJob = currentJob?.kind === 'login' || currentJob?.kind === 'disconnect';
      const job = (admin === !personalJob || canManage) ? currentJob : undefined;
      const working = busy === p.id || currentJob?.state === 'running';
      return <article key={p.id} className="studio-plugin" aria-label={`${p.name} plugin`}>
        <header><div className="studio-plugin__icon">{providerIcons[p.id] ? <img src={providerIcons[p.id]} alt="" width={28} height={28}/> : <AetherIcon name="aether"/>}</div><div><h2>{p.name}</h2><span>{p.publisher} · Aether integration</span></div><span className="badge">{pluginStatus(p)}</span></header>
        <p>{p.description}</p>{available && <div className="studio-plugin__capabilities">{p.capabilities.chat && <><span>Workspace advisor</span></>}<span>Account sign-in</span></div>}
        {!admin && <div className="studio-plugin__account"><AetherIcon name="character"/><span>{p.account.connected ? p.account.label : 'Not signed in'}</span></div>}
        <div className="studio-plugin__actions">
          {controls.install && <Button primary disabled={working || !available} onClick={() => void act(p.id, 'install')}>{p.installed ? 'Repair installation' : 'Install'}</Button>}
          {controls.enable && <Button disabled={working} onClick={() => void act(p.id, p.enabled ? 'disable' : 'enable')}>{p.enabled ? 'Disable' : 'Enable'}</Button>}
          {controls.login && <Button primary disabled={working} onClick={() => void act(p.id, 'login')}>{p.account.connected ? 'Reconnect' : p.signIn}</Button>}
          {!admin && p.account.connected && <Button disabled={working} onClick={() => void act(p.id, 'disconnect')}>Disconnect</Button>}
          {admin && p.installed && <details><summary>Manage</summary><Button disabled={working} onClick={() => void act(p.id, 'uninstall')}>Uninstall and disconnect accounts</Button></details>}
          {controls.askAdmin && <span>{available ? 'Ask an administrator to install' : 'Not available on this server'}</span>}
          {!admin && p.installed && !p.enabled && <span>Disabled for Studio{canManage ? '. Enable to sign in.' : '. Contact an administrator.'}</span>}
          {!admin && p.installed && !p.runtimeReady && !canManage && <span>Installation needs repair by an administrator.</span>}
        </div>
        {job?.state === 'running' && <div className="studio-plugin__job" role="status"><span>{job.kind === 'login' ? 'Waiting for account sign-in…' : `${job.kind === 'install' ? 'Installing' : job.kind === 'disconnect' ? 'Disconnecting' : 'Removing'}…`}</span>
          {job.login && <><p>{job.login.instruction}</p><a className="text-link" href={job.login.url} target="_blank" rel="noopener noreferrer">Continue to {p.name}</a>
            {job.login.acceptsCode && <form onSubmit={e => { e.preventDefault(); void service.call('code', { id: job.id, code }).then(() => setCode('')).catch(e => setError(e.message)); }}><TextField aria-label="Sign-in callback URL" value={code} onChange={e => setCode(e.target.value)} placeholder="Callback URL (only if needed)"/><Button type="submit" disabled={!code.trim()}>Complete sign-in</Button></form>}</>}
          <Button onClick={() => void service.call<AgentJob>('cancel', { id: job.id }).then(result => setJobs(j => ({ ...j, [p.id]: result }))).catch(e => setError(e.message))}>Cancel</Button></div>}
        {job?.state === 'failed' && <p role="alert">{job.error}</p>}
        <footer><span>v{p.version}</span><a href={p.documentation} target="_blank" rel="noopener noreferrer">Provider documentation</a></footer>
      </article>;
    })}</div>
    {!loading && !error && !shown.length && <p className="empty">No plugins match this view.</p>}
    <p className="hint">{admin ? 'Plugin installation and enablement apply across Studio. Return to your personal workspace to connect your own agent accounts.' : 'Your account stays personal. Advisors can discuss workspace context; document editing and media generation are not connected. Claude and Gemini sign-in currently require a browser on the Studio host. Your provider’s plan and usage limits apply.'}</p>
  </section>;
}
