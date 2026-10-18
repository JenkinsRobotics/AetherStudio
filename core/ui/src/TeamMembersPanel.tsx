import { useState } from "react";
import { DashboardCard } from "./DashboardCards";
import { Avatar } from "./Avatar";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { Popover } from "./Popover";
import "./WorkflowWidgets.css";
export interface TeamMember { id: string; name: string; email: string; credits: number; avatar?: string; }
export interface TeamMembersPanelProps { members: readonly TeamMember[]; onInvite: (email: string) => void; onCreditChange: (id: string, credits: number) => void; onRemove: (id: string) => void; totalCredits: number; }
export function TeamMembersPanel({ members, onInvite, onCreditChange, onRemove, totalCredits }: TeamMembersPanelProps) {
  const [email, setEmail] = useState("");
  const [editor, setEditor] = useState<{ id: string; anchor: HTMLElement; credits: number } | null>(null);
  const member = members.find(item => item.id === editor?.id);
  const allocated = members.filter(item => item.id !== editor?.id).reduce((sum, item) => sum + item.credits, 0);
  const maximum = Math.max(0, totalCredits - allocated);
  return <DashboardCard contentOnly density="compact" title="Team members" className="aui-workflow"><div className="aui-workflow-stack">
    <form className="aui-workflow-actions" onSubmit={e => { e.preventDefault(); onInvite(email.trim()); setEmail(""); }}><TextField type="email" aria-label="Team member email" value={email} required onChange={e => setEmail(e.target.value)} placeholder="Enter team member’s email" /><Button type="submit">Invite</Button></form>
    <ul className="aui-workflow-members">{members.map(person => <li key={person.id}><Avatar name={person.name} src={person.avatar} /><span><strong>{person.name}</strong><small>{person.email}</small></span><Button aria-label={`Edit credits for ${person.name}`} onClick={e => setEditor({ id: person.id, anchor: e.currentTarget, credits: person.credits })}>{person.credits.toLocaleString()}</Button></li>)}</ul>
    <Popover open={Boolean(editor && member)} anchor={editor?.anchor ?? null} onClose={() => setEditor(null)} ariaLabel="Member credit limit" focus="first">
      {editor && member && <form className="aui-workflow aui-workflow-stack aui-workflow-credit" onSubmit={e => { e.preventDefault(); if (Number.isInteger(editor.credits) && editor.credits >= 0 && editor.credits <= maximum) { onCreditChange(editor.id, editor.credits); setEditor(null); } }}><strong>{member.name}</strong><label className="aui-workflow-field">Monthly credit limit<TextField type="number" required min={0} max={maximum} value={editor.credits} onChange={e => setEditor({ ...editor, credits: Number(e.target.value) })} /></label><p className="aui-workflow-hint">{allocated.toLocaleString()} of {totalCredits.toLocaleString()} credits are assigned to other members.</p><div className="aui-workflow-actions"><Button primary type="submit">Update</Button><Button onClick={() => setEditor(null)}>Cancel</Button></div><Button appearance="flat" onClick={() => { onRemove(editor.id); setEditor(null); }}>Remove member</Button></form>}
    </Popover>
  </div></DashboardCard>;
}
