import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AssistantPanel, type AssistantMessage } from './AssistantPanel';
import { Button } from './Button';
import { AdvisorWelcome, advisorQuestions } from './AdvisorWelcome';
import { AgentTurn, type AgentAction } from './AgentTurn';
import type { AgentService, AgentPlugin, AgentJob, AgentInteraction } from './AgentServices';

export interface WorkspaceAgentProps {
  service: AgentService; app: string; contextText: string; detail?: string;
  messages: readonly AssistantMessage[]; onMessages: (messages: AssistantMessage[]) => void;
  toolbar?: ReactNode; context?: ReactNode; composerActions?: ReactNode; notice?: string;
  onLocalSubmit?: (text: string) => void;
  interaction?: AgentInteraction;
}
interface ActiveTurn {
  id: string; assistant: string; base: AssistantMessage[]; contextKey?: string;
  turn: AgentTurn; service: AgentService;
}
/** Shared agent UI. The host transport and product context are supplied by its owner. */
export function WorkspaceAgent({ service, app, contextText, detail, messages, onMessages, toolbar, context, composerActions, notice, onLocalSubmit, interaction }: WorkspaceAgentProps) {
  const [plugins, setPlugins] = useState<AgentPlugin[]>([]), [provider, setProvider] = useState('');
  const [models, setModels] = useState<{id: string; name: string}[]>([]), [model, setModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState(''), [job, setJob] = useState<AgentJob | null>(null), [starting, setStarting] = useState(false);
  const callbacks = useRef({ onMessages, messages, interaction }); callbacks.current = { onMessages, messages, interaction };
  const [activity, setActivity] = useState<AgentAction[]>([]);
  const active = useRef<ActiveTurn | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const ready = plugins.filter(p => p.enabled && p.runtimeReady && p.account.connected);
  async function refresh() {
    try { const result = await service.call<{ plugins: AgentPlugin[] }>('catalog'); if (alive.current) { setPlugins(result.plugins); setProvider(current => result.plugins.some(p => p.id === current && p.enabled && p.account.connected) ? current : result.plugins.find(p => p.enabled && p.runtimeReady && p.account.connected)?.id || ''); } }
    catch { if (alive.current) setPlugins([]); }
  }
  useEffect(() => {
    alive.current = true; void refresh();
    const focus = () => void refresh(); window.addEventListener('focus', focus);
    const leaving = () => {
      const previous = active.current; generation.current++;
      previous?.turn.stop(); active.current = null; setJob(null); setStarting(false);
      if (previous) void previous.service.call('cancel', {id: previous.id}).catch(() => {});
    };
    window.addEventListener('pagehide', leaving);
    return () => { alive.current = false; generation.current++; active.current?.turn.stop(); window.removeEventListener('focus', focus); window.removeEventListener('pagehide', leaving); if (active.current) void service.call('cancel', { id: active.current.id }).catch(() => {}); };
  }, [service]);
  useEffect(() => {
    setModels([]); setModel(''); setLoadingModels(Boolean(provider)); if (!provider) return;
    let disposed = false, id = '', timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const result = await service.call<AgentJob>('job', { id }); if (disposed) return;
        if (result.state === 'running') timer = setTimeout(() => void poll(), 700);
        else { setLoadingModels(false); if (result.state === 'completed') setModels(result.models); else if (result.error) setError(result.error); }
      } catch (e) { if (!disposed) { setLoadingModels(false); setError((e as Error).message); } }
    };
    void service.call<AgentJob>('models', { provider }).then(result => { id = result.id; if (disposed) void service.call('cancel', { id }).catch(() => {}); else void poll(); }).catch(e => { if (!disposed) { setLoadingModels(false); setError(e.message); } });
    return () => { disposed = true; clearTimeout(timer); if (id) void service.call('cancel', { id }).catch(() => {}); };
  }, [provider, service]);
  useLayoutEffect(() => {
    // Startup and tool work belong to one workspace and one host service.
    generation.current++; setStarting(false);
    const previous = active.current;
    if (previous) {
      previous.turn.stop(); active.current = null; setJob(null);
      void previous.service.call('cancel', {id: previous.id}).catch(() => {});
    }
  }, [app, interaction?.contextKey, service]);
  async function submit(text: string) {
    if (starting || active.current) return;
    if (!provider) { onLocalSubmit?.(text); if (!onLocalSubmit) setError('Install and connect a provider in Studio Plugins.'); return; }
    const requestGeneration = ++generation.current;
    const base: AssistantMessage[] = [...callbacks.current.messages, { id: crypto.randomUUID(), role: 'user', text }];
    setStarting(true); setError(''); setActivity([]); callbacks.current.onMessages(base);
    const requestedInteraction = interaction;
    try {
      const result = await service.call<AgentJob>('chat', { app, provider, model, context: contextText, messages: base.map(m => ({ role: m.role, content: m.text })), ...(requestedInteraction ? {tools: requestedInteraction.tools} : {}) });
      if (!alive.current || generation.current !== requestGeneration) { void service.call('cancel', { id: result.id }).catch(() => {}); return; }
      const current: ActiveTurn = {
        id: result.id, assistant: crypto.randomUUID(), base, contextKey: requestedInteraction?.contextKey,
        service,
        turn: new AgentTurn({
          id: result.id, service, interaction: requestedInteraction,
          isCurrent: () => alive.current && active.current === current && callbacks.current.interaction?.contextKey === current.contextKey,
          onJob: value => {
            if (!alive.current || active.current !== current) return;
            setJob(value);
            if (value.text) callbacks.current.onMessages([...base, {id: current.assistant, role: 'assistant', text: value.text}]);
          },
          onActions: value => { if (alive.current && active.current === current) setActivity(value); },
          onEnd: error => {
            if (!alive.current || active.current !== current) return;
            active.current = null; setJob(null);
            if (error) { setError(error); void service.call('cancel', {id: current.id}).catch(() => {}); }
          },
        }),
      };
      active.current = current; setJob(result); current.turn.start();
    } catch (e) { if (alive.current && generation.current === requestGeneration) setError((e as Error).message); }
    finally { if (alive.current && generation.current === requestGeneration) setStarting(false); }
  }
  const running = starting || job?.state === 'running';
  return <AssistantPanel title="Aether Agent" heading="AI Advisor" layout="agent" welcome={<AdvisorWelcome hasContext={!!contextText.trim()}/>} suggestions={advisorQuestions(app)}
    onRate={(id, rating) => onMessages(messages.map(message => message.id === id ? {...message, rating} : message))} detail={detail} messages={messages} busy={running} disabled={loadingModels || (!provider && !onLocalSubmit)}
    onStop={() => {
      const stoppedGeneration = ++generation.current, stopped = active.current;
      // Release the local composer immediately. A late cancellation/startup
      // response belongs to this request, never to the next conversation turn.
      stopped?.turn.stop(); active.current = null; setJob(null); setStarting(false);
      if (stopped) void service.call('cancel', { id: stopped.id }).catch(e => {
        if (alive.current && generation.current === stoppedGeneration) setError(e.message);
      });
    }}
    status={provider ? `${ready.find(p => p.id === provider)?.name || 'Agent'} · ${running ? 'Working…' : 'Connected'}` : 'Not connected · Prompts stay local'}
    notice={error || (loadingModels ? 'Loading available models…' : notice)} toolbar={<>{toolbar}<a href="/?plugins" target="_blank" rel="noopener noreferrer" title="Manage agent plugins">Plugins</a></>}
    context={<>{context}{activity.length > 0 && <details aria-label="Agent actions" open={running}><summary>Actions · {activity.length}</summary><ol>{activity.map(item => <li key={item.id}>{item.name.replace(/^aether_/, '').replaceAll('_', ' ')} · {item.state}{item.image && <img alt="Preview sent to agent" src={`data:${item.image.mimeType};base64,${item.image.data}`} style={{display:'block',width:160,maxHeight:160,objectFit:'contain',background:'#fff'}}/>}</li>)}</ol></details>}</>} onSubmit={text => void submit(text)}
    composerActions={<>{composerActions}{ready.length ? <>
      <select aria-label="Agent provider" value={provider} disabled={running} onChange={e => { setProvider(e.target.value); setError(''); }}>{ready.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label="Agent model" value={model} disabled={running} onChange={e => setModel(e.target.value)}><option value="">Account default</option>{models.filter(m => m.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
    </> : <Button onClick={() => window.open('/?plugins', '_blank', 'noopener,noreferrer')}>Connect agent</Button>}</>}/>
}
