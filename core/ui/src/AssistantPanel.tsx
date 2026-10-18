import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AetherIcon, type AetherIconName } from "./AetherIcon";
import { IconButton } from "./IconButton";
import "./ConceptWidgets.css";
import { AdvisorWelcome } from "./AdvisorWelcome";
import "./AdvisorPanel.css";

export interface AssistantMessage { id: string; role: "assistant" | "user"; text: string; rating?: number; }
export interface AssistantPanelProps { title: string; heading?: string; welcome?: ReactNode; onRate?: (id: string, rating: number) => void; detail?: string; status?: string; messages: readonly AssistantMessage[]; suggestions?: readonly string[]; showModes?: boolean; density?: "compact" | "comfortable"; layout?: "card" | "agent"; toolbar?: ReactNode; headerActions?: ReactNode; context?: ReactNode; composerActions?: ReactNode; notice?: string; busy?: boolean; disabled?: boolean; onStop?: () => void; onSubmit?: (text: string) => void; }

export function AssistantPanel({ title, heading, welcome, onRate, detail, status = "Prototype", messages, suggestions = [], showModes = true, density = "compact", layout = "card", toolbar, headerActions, context, composerActions, notice, busy = false, disabled = false, onStop, onSubmit }: AssistantPanelProps) {
  const [mode, setMode] = useState("chat"); const [draft, setDraft] = useState("");
  const promptId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const body = bodyRef.current; if (body) body.scrollTop = messages.length ? body.scrollHeight : 0; }, [messages]);
  const submit = (event: FormEvent) => { event.preventDefault(); const text = draft.trim(); if (!text || busy || disabled) return; onSubmit?.(text); setDraft(""); };
  if (layout === "agent") return <section className="aui-agent-chat" aria-label={title}>
    <header className="aui-agent-chat__header"><h3>{heading ?? title}</h3><span className="aui-agent-chat__beta">Pre-alpha</span>{headerActions && <div className="aui-agent-chat__header-actions">{headerActions}</div>}</header>
    {(detail || toolbar) && <div className="aui-agent-chat__toolbar"><span title={detail}>{detail}</span>{toolbar}</div>}
    <div ref={bodyRef} className="aui-agent-chat__conversation" role="log" aria-label="Conversation" aria-live="polite">
      {messages.length ? messages.map(message => <div key={message.id} className={`aui-assistant-panel__message aui-agent-chat__message aui-agent-chat__message--${message.role}`}>
        {message.text}
        {message.role === "assistant" && message.text && <div className="aui-advisor-rating" role="group" aria-label="Rate this response" title="Your rating stays with this conversation">
          {[1, 2, 3, 4, 5].map(value => <IconButton key={value} label={`Rate ${value} of 5`} disabled={busy}
            aria-pressed={(message.rating ?? ratings[message.id]) === value} data-filled={value <= (message.rating ?? ratings[message.id] ?? 0)}
            onClick={() => { setRatings(current => ({...current, [message.id]: value})); onRate?.(message.id, value); }}><AetherIcon name="star"/></IconButton>)}
        </div>}
      </div>) : <div className="aui-agent-chat__welcome">
        {welcome ?? <AdvisorWelcome hasContext={!!context}/>}
        {!!suggestions.length && <div className="aui-agent-chat__samples"><h4>Sample questions</h4>{suggestions.map(suggestion => <button type="button" key={suggestion} onClick={() => { setDraft(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>)}</div>}
      </div>}
    </div>
    <div className="aui-agent-chat__bottom">
      {notice && <div className="aui-agent-chat__notice" role="status">{notice}</div>}
      <label className="aui-agent-chat__prompt-label" htmlFor={promptId}>Prompt</label>
      <form className="aui-agent-chat__composer" onSubmit={submit}>
        {context && <div className="aui-agent-chat__context">{context}</div>}
        <textarea id={promptId} ref={inputRef} disabled={disabled} aria-label={`Ask ${title}`} placeholder={messages.length ? "Ask for follow-up changes" : "Ask anything…"} rows={3} value={draft} onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/>
        <div className="aui-agent-chat__controls">{composerActions}{busy ? <IconButton type="button" label="Stop response" onClick={onStop}><AetherIcon name="stop"/></IconButton> : <IconButton type="submit" label="Send" disabled={disabled || !draft.trim()}><AetherIcon name="arrow-up"/></IconButton>}</div>
      </form>
      <div className="aui-agent-chat__status">{status}</div>
      <p className="aui-agent-chat__disclaimer">AI can make mistakes. Review its work.</p>
    </div>
  </section>;
  return <section className="aui-assistant-panel" data-density={density} style={showModes ? undefined : { gridTemplateRows: "auto minmax(110px, 1fr) auto" }} aria-label={title}>
    <header><AetherIcon name="aether" /><div><strong>{title}</strong><span>{detail}</span></div><small>{status}</small></header>
    {showModes && <div className="aui-assistant-panel__modes">{[["voice","animate"],["chat","comment"],["docs","document"],["ideas","lighting"]] .map(([id, icon]) => <button key={id} type="button" aria-label={`${id} mode`} aria-pressed={mode === id} onClick={() => setMode(id)}><AetherIcon name={icon as AetherIconName} /></button>)}</div>}
    <div className="aui-assistant-panel__body">{messages.map((message) => <div key={message.id} className={`aui-assistant-panel__message aui-assistant-panel__message--${message.role}`}>{message.text}</div>)}{suggestions.length ? <div className="aui-assistant-panel__suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div> : null}</div>
    <form onSubmit={submit}><input aria-label={`Ask ${title}`} placeholder={`Ask ${title}…`} value={draft} onChange={(event) => setDraft(event.target.value)} /><IconButton type="submit" label="Send"><AetherIcon name="export" /></IconButton></form>
  </section>;
}
