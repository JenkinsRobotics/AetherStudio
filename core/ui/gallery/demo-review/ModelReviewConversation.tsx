import type { CommentImage } from "../../src/DocumentServices";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { AetherIcon, Avatar, Button, Checkbox, Dialog, FieldRow, IconButton, MenuButton, SegmentedControl, SelectField, TextField, type CollaborationItem, type DocumentCollaboration } from "../../src";
import { localReview } from "./local-review";
import { modelReviewSeed } from "./model-review-seed";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewModelPreview } from "./ReviewModelPreview";
import "./model-review-conversation.css";

import { modelTaskCards } from './model-task-cards';
import { modelReviewTags, parseReviewTags } from './model-review-tags';

const statuses = [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Completed' }];
const stamp = (item: CollaborationItem) => new Date(item.created * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dueLabel = (due?: string) => due ? new Date(`${due}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';

/** Gallery presentation on the existing local DocumentConnection contract.
 * DockPanel owns the frame; the workspace owns the document name and tray toggles. */
export function ModelReviewConversation({ documentName, selectedName }: { documentName: string; selectedName?: string }) {
  const cardSelectId = useId();
  const context = useRef({ name: documentName, selected: selectedName });
  context.current = { name: documentName, selected: selectedName };
  const [state, setState] = useState(modelReviewSeed);
  const [connection] = useState(() => localReview(() => context.current, state));
  const [tab, setTab] = useState('comments'), [commentDraft, setCommentDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [cards, setCards] = useState(modelTaskCards);
  const [targetCard, setTargetCard] = useState('body');
  const [showCompletedCards, setShowCompletedCards] = useState(false);
  const [cardEditor, setCardEditor] = useState<{ id?: string; name: string } | null>(null);
  const [editingCard, setEditingCard] = useState('body');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [tagFilter, setTagFilter] = useState(''), [commentQuery, setCommentQuery] = useState('');
  const [tagsByItem, setTagsByItem] = useState(modelReviewTags), [editingTags, setEditingTags] = useState('');
  const [filter, setFilter] = useState('all'), [commentFilter, setCommentFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false), [query, setQuery] = useState(''), [assignee, setAssignee] = useState('all');
  const [reply, setReply] = useState<CollaborationItem | null>(null), [editing, setEditing] = useState<CollaborationItem | null>(null);
  const stream = useRef<HTMLDivElement>(null);
  const previousCounts = useRef({ comments: state.comments.length, tasks: state.tasks.length });
  useEffect(() => {
    const previous = previousCounts.current;
    if (stream.current && tab === 'comments' && state.comments.length > previous.comments) stream.current.scrollTop = stream.current.scrollHeight;
    if (stream.current && tab === 'tasks' && state.tasks.length > previous.tasks) {
      const addedId = state.tasks.at(-1)?.id;
      const row = Array.from(stream.current.querySelectorAll<HTMLElement>('[data-task-id]')).find(element => element.dataset.taskId === addedId);
      if (row) stream.current.scrollTop += row.getBoundingClientRect().bottom - stream.current.getBoundingClientRect().bottom;
    }
    previousCounts.current = { comments: state.comments.length, tasks: state.tasks.length };
  }, [state.comments.length, state.tasks, tab]);
  useEffect(() => { if (stream.current) stream.current.scrollTop = 0; }, [tab]);
  const [sort, setSort] = useState('status');
  const tagsFor = (item: CollaborationItem): string[] => tagsByItem[item.id] ?? (item.parent ? tagsByItem[item.parent] : undefined) ?? [];
  function editReviewItem(item: CollaborationItem) { setEditing({ ...item }); setEditingTags(tagsFor(item).join(', ')); }
  function closeEditor() { setEditing(null); }
  function editTask(item: CollaborationItem) {
    editReviewItem(item);
    setEditingCard(cards.find(card => card.taskIds.includes(item.id))?.id ?? cards[0].id);
  }
  function saveCard() {
    const name = cardEditor?.name.trim();
    if (!name) return;
    const id = cardEditor?.id ?? crypto.randomUUID();
    setCards(current => cardEditor?.id ? current.map(card => card.id === id ? { ...card, name } : card) : [...current, { id, name, taskIds: [] }]);
    setTargetCard(id); setCardEditor(null); setFilter('all'); setQuery(''); setAssignee('all');
  }
  const person = (id: string) => state.members.find(p => p.id === id)?.name ?? 'You';
  const initials = (id: string) => id === 'local' ? 'You J' : id === 'lindsay' ? 'Lindsay B' : 'Devon S';
  const avatar = (id: string, small = false) => <span className="ps-review-avatar" data-person={id}><Avatar name={initials(id)} size={small ? 'small' : 'standard'}/></span>;
  async function mutate(collection: 'comments' | 'tasks', value: Partial<CollaborationItem>, id?: string, cardId?: string) {
    if (busy) return false;
    setBusy(true); setError('');
    try {
      const latest = await connection.call<DocumentCollaboration>('collaboration');
      const next = await connection.call<DocumentCollaboration>('collaboration_mutate', { collection, operation: id ? 'update' : 'add', item: id, value, expected_revision: latest.revision });
      if (!id && tagFilter) {
        const added = next[collection].filter(item => !latest[collection].some(existing => existing.id === item.id));
        setTagsByItem(current => ({ ...current, ...Object.fromEntries(added.map(item => [item.id, [tagFilter]])) }));
      }
      if (collection === 'tasks' && !id && cardId) {
        const added = next.tasks.filter(task => !latest.tasks.some(existing => existing.id === task.id));
        setCards(current => current.map(card => card.id === cardId ? { ...card, taskIds: [...card.taskIds, ...added.map(task => task.id)] } : card));
      }
      setState(next);
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  async function submit(images: CommentImage[], reference: boolean, revision: boolean) {
    const text = commentDraft.trim();
    if (!text) return false;
    const ok = await mutate('comments', { text, ...(images.length ? { attachments: images } : {}),
      ...(reference ? { reference_name: selectedName ?? documentName } : {}), ...(revision ? { revision: 12 } : {}),
      ...(reply ? { parent: reply.parent ?? reply.id } : {}) });
    if (ok) { setCommentDraft(''); setReply(null); }
    return ok;
  }
  async function submitTask(images: CommentImage[], reference: boolean, revision: boolean) {
    const text = taskDraft.trim();
    if (!text) return false;
    const ok = await mutate('tasks', { text, status: 'open', assignee: 'local',
      ...(images.length ? { attachments: images } : {}), ...(reference ? { reference_name: selectedName ?? documentName } : {}),
      ...(revision ? { revision: 12 } : {}) }, undefined, targetCard);
    if (ok) { setTaskDraft(''); setFilter('all'); setQuery(''); setAssignee('all'); }
    return ok;
  }
  const tasks = state.tasks.filter(t => !t.deleted);
  const tagOptions = [{ value: '', label: 'All tags' }, ...Array.from(new Set([...Object.values(tagsByItem).flat(), tagFilter].filter(Boolean))).sort().map(tag => ({ value: tag, label: tag }))];
  const visibleTasks = tasks.filter(t => (!tagFilter || tagsFor(t).includes(tagFilter)) && (filter === 'all' || t.status === filter) && (assignee === 'all' || t.assignee === assignee) && `${t.text} ${t.reference_name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const sorted = [...visibleTasks].sort((a, b) => sort === 'due' ? (a.due ?? '9999').localeCompare(b.due ?? '9999') : statuses.findIndex(s => s.value === a.status) - statuses.findIndex(s => s.value === b.status));
  const cardViews = cards.map(card => {
    const members = tasks.filter(task => card.taskIds.includes(task.id));
    const completed = members.length > 0 && members.every(task => task.status === 'done');
    const items = sorted.filter(task => card.taskIds.includes(task.id));
    const done = members.filter(task => task.status === 'done').length;
    const progress = members.filter(task => task.status === 'in_progress').length;
    return { ...card, members, completed, items, done, progress };
  });
  const completedCards = cardViews.filter(card => card.completed).length;
  const shownCards = cardViews.filter(card => (!card.completed || showCompletedCards || filter === 'done') && (card.items.length || (!card.members.length && !tagFilter && filter === 'all' && !query && assignee === 'all')));
  const cardOptions = cardViews.map(card => ({ value: card.id, label: `${card.name}${card.completed ? ' · Completed' : ''}` }));
  const matchingThreads = new Set(state.comments.filter(c => !c.deleted && (!tagFilter || tagsFor(c).includes(tagFilter)) && `${c.text} ${c.reference_name ?? ''}`.toLowerCase().includes(commentQuery.toLowerCase())).map(c => c.parent ?? c.id));
  const threads = new Set(state.comments.filter(c => !c.deleted && !c.parent && matchingThreads.has(c.id) && (commentFilter === 'all' || (commentFilter === 'resolved' ? c.resolved : !c.resolved))).map(c => c.id));
  const comments = state.comments.filter(c => !c.deleted && threads.has(c.parent ?? c.id));
  const tagContext = tagFilter ? <button className="ps-review-context-chip" type="button" onClick={() => setTagFilter('')} aria-label={`Clear tag filter: ${tagFilter}`}><AetherIcon name="tag"/>{tagFilter}<AetherIcon name="close"/></button> : undefined;
  function taskRow(item: CollaborationItem) {
    return <div className="ps-review-task-row" key={item.id} data-task-id={item.id} data-status={item.status}>
      <input type="checkbox" aria-label={`Complete ${item.text}`} checked={item.status === 'done'} disabled={busy} onChange={() => void mutate('tasks', { status: item.status === 'done' ? 'open' : 'done' }, item.id)}/>
      <button type="button" className="ps-review-task-title" aria-label={`Edit task: ${item.text}`} title={`${item.text} · ${item.reference_name ?? documentName}${item.revision ? ` · Main v${item.revision}` : ''}`} onClick={() => editTask(item)}><strong>{item.text}</strong></button>
      <span className="ps-review-task-person" title={`Assigned to ${person(item.assignee ?? 'local')}`}>{avatar(item.assignee ?? 'local', true)}</span>
      <time className="ps-review-task-due" dateTime={item.due} title={item.due ? `Due ${item.due}` : 'No due date'}>{dueLabel(item.due)}</time>
      <MenuButton className="ps-review-task-status" title={statuses.find(s => s.value === item.status)?.label} label={`Status for ${item.text}`} disabled={busy} items={statuses.slice(1).map(s => ({ id: s.value, label: s.label, kind: 'radio' as const, checked: item.status === s.value }))} onSelect={status => void mutate('tasks', { status: status as CollaborationItem['status'] }, item.id)}><span>{statuses.find(s => s.value === item.status)?.label}</span></MenuButton>
      <MenuButton className="ps-review-more" label={`Actions for ${item.text}`} items={[{ id: 'edit', label: 'Edit task', icon: <AetherIcon name="pencil"/> }]} onSelect={() => editTask(item)}><AetherIcon name="more"/></MenuButton>
    </div>;
  }
  return <section className="ps-review-conversation" aria-label="Comments and tasks">
    <div className="ps-review-toolbar">
      <SegmentedControl ariaLabel="Review section" className="ps-review-conversation-tabs" value={tab} onChange={setTab} options={[{ id: 'comments', label: 'Comments', icon: <AetherIcon name="comment"/> }, { id: 'tasks', label: 'Tasks', icon: <AetherIcon name="tasks"/> }]}/>
      <div className="ps-review-toolbar-tools">
        {tab === 'comments' ? <SelectField aria-label="Comment filter" icon={<AetherIcon name="filter"/>} value={commentFilter} onChange={e => setCommentFilter(e.target.value)} options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }]}/> : <SelectField aria-label="Task status filter" icon={<AetherIcon name="filter"/>} title={statuses.find(status => status.value === filter)?.label} value={filter} onChange={e => setFilter(e.target.value)} options={statuses}/>}
        <SelectField aria-label="Review tag filter" title={tagFilter || 'All tags'} icon={<AetherIcon name="tag"/>} value={tagFilter} onChange={e => setTagFilter(e.target.value)} options={tagOptions}/>
        <IconButton label="Review filters" aria-pressed={filtersOpen} size="small" onClick={() => setFiltersOpen(v => !v)}><AetherIcon name="filter"/></IconButton>
        <MenuButton className="ps-review-more" label="Review options" items={[{ id: 'all', label: 'Show all review items' }, { id: 'open', label: 'Show open items' }]} onSelect={id => { setFilter(id); setCommentFilter(id); setTagFilter(''); setCommentQuery(''); setQuery(''); setAssignee('all'); setShowCompletedCards(id === 'all'); }}><AetherIcon name="more"/></MenuButton>
      </div>
    </div>
    {filtersOpen && <div className="ps-review-filters">{tab === 'comments' ? <TextField aria-label="Search comments" placeholder="Search comments…" value={commentQuery} onChange={e => setCommentQuery(e.target.value)}/> : <><TextField aria-label="Search tasks" placeholder="Search tasks…" value={query} onChange={e => setQuery(e.target.value)}/><SelectField aria-label="Task assignee filter" value={assignee} onChange={e => setAssignee(e.target.value)} options={[{ value: 'all', label: 'Everyone' }, ...state.members.map(p => ({ value: p.id, label: p.name }))]}/><SelectField aria-label="Sort tasks" value={sort} onChange={e => setSort(e.target.value)} options={[{ value: 'status', label: 'By status' }, { value: 'due', label: 'By due date' }]}/><Checkbox className="ps-review-completed-filter" label="Show completed cards" checked={showCompletedCards} onChange={e => setShowCompletedCards(e.target.checked)}/></>}</div>}
    {error && <div role="alert" className="ps-review-error">{error}</div>}
    <div ref={stream} className="ps-review-stream" role={tab === 'comments' ? 'log' : 'region'} aria-label={tab === 'comments' ? 'Design comments' : 'Design tasks'}>
      {tab === 'comments' ? comments.map(item => <article className={`ps-review-message${item.parent ? ' ps-review-message-reply' : ''}`} key={item.id}>
        {avatar(item.author)}<div className="ps-review-message-content">
          <div className="ps-review-message-meta"><strong>{person(item.author)}</strong><time>{stamp(item)}</time>{item.resolved && <span className="ps-review-resolved"><AetherIcon name="check"/>Resolved</span>}
            <MenuButton className="ps-review-more" label={`Comment actions: ${item.text}`} items={[{ id: 'reply', label: 'Reply', icon: <AetherIcon name="comment"/> }, { id: 'resolve', label: item.resolved ? 'Reopen discussion' : 'Resolve discussion', icon: <AetherIcon name="check"/> }, { id: 'edit', label: 'Edit comment', icon: <AetherIcon name="pencil"/> }]} onSelect={id => { if (id === 'reply') setReply(item); else if (id === 'edit') editReviewItem(item); else void mutate('comments', { resolved: !item.resolved }, item.id); }}><AetherIcon name="more"/></MenuButton>
          </div>
          <p>{item.text}</p>
          {!!tagsFor(item).length && <div className="ps-review-item-tags">{tagsFor(item).map(tag => <button type="button" key={tag} onClick={() => setTagFilter(tag)} aria-label={`Filter by tag: ${tag}`}><AetherIcon name="tag"/>{tag}</button>)}</div>}
          {item.id === 'wall-review' && <ReviewModelPreview/>}{item.id === 'clearance-review' && <ReviewModelPreview clearance/>}
          {item.attachments?.map((image, i) => <a className="ps-review-image" key={i} href={image.data_url} download={image.name}><img alt={image.name} src={image.data_url}/></a>)}
          {item.revision && <div className="ps-review-version"><span><AetherIcon name="cube"/></span><div><strong>{documentName}_Main v{item.revision}</strong><small>Version reference · Main workspace</small></div></div>}
          {item.reference_name && item.id !== 'wall-review' && item.id !== 'clearance-review' && <small className="ps-review-reference"><AetherIcon name="cube"/>{item.reference_name}</small>}
        </div>
      </article>) : <>
        {shownCards.map(card => <section className="ps-review-task-card" key={card.id} aria-label={`${card.name} tasks`} data-completed={card.completed} data-current={targetCard === card.id}>
          <header>
            <span className="ps-review-progress" style={{ '--review-done': `${card.members.length ? card.done / card.members.length * 100 : 0}%`, '--review-progress': `${card.members.length ? (card.done + card.progress) / card.members.length * 100 : 0}%` } as CSSProperties} aria-hidden="true"/>
            <div><button type="button" className="ps-review-card-title" title={card.name} aria-label={`Add tasks to ${card.name}`} onClick={() => setTargetCard(card.id)}>{card.name}</button><small>{card.completed ? 'Completed' : `${card.members.length - card.done - card.progress} Open · ${card.progress} In progress`}</small></div>
            <MenuButton className="ps-review-more" label={`Card actions: ${card.name}`} items={[{ id: 'add', label: 'Add task to card', icon: <AetherIcon name="plus"/> }, { id: 'rename', label: 'Rename card', icon: <AetherIcon name="pencil"/> }]} onSelect={id => { if (id === 'rename') setCardEditor({ id: card.id, name: card.name }); else { setTargetCard(card.id); stream.current?.parentElement?.querySelector<HTMLTextAreaElement>('[aria-label="New task"]')?.focus(); } }}><AetherIcon name="more"/></MenuButton>
          </header>
          {card.items.filter(task => task.status !== 'done').map(taskRow)}
          {!!card.items.some(task => task.status === 'done') && <details className="ps-review-completed-tasks" open={card.completed || filter === 'done' || undefined}><summary>Completed <span>{card.items.filter(task => task.status === 'done').length}</span></summary>{card.items.filter(task => task.status === 'done').map(taskRow)}</details>}
          {!card.members.length && <p className="ps-review-empty">Add the first task below.</p>}
        </section>)}
        {!shownCards.length && <p className="ps-review-empty">No active tasks match this view. Use filters to see completed cards.</p>}

      </>}
      {tab === 'comments' && !comments.length && <p className="ps-review-empty">No comments in this view.</p>}
    </div>
    <div hidden={tab !== 'comments'}><ReviewComposer task={false} value={commentDraft} onChange={setCommentDraft} busy={busy} selectedName={selectedName} context={tagContext} reply={reply ? person(reply.author) : undefined} onCancelReply={() => setReply(null)} onSubmit={submit}/></div>
    <div hidden={tab !== 'tasks'}><small className="ps-review-task-count">{cards.length - completedCards} active cards · {completedCards} completed</small><ReviewComposer task value={taskDraft} onChange={setTaskDraft} busy={busy} selectedName={selectedName} onCancelReply={() => {}} onSubmit={submitTask} context={<>{tagContext}<div className="ps-review-card-target"><label htmlFor={cardSelectId}>Add to</label><SelectField id={cardSelectId} aria-label="Add task to card" value={targetCard} options={cardOptions} onChange={e => setTargetCard(e.target.value)}/><IconButton size="small" label="New task card" onClick={() => setCardEditor({ name: '' })}><AetherIcon name="plus"/></IconButton></div></>}/></div>
    <Dialog open={!!cardEditor} title={cardEditor?.id ? 'Rename task card' : 'New task card'} onClose={() => setCardEditor(null)} actions={<><Button onClick={() => setCardEditor(null)}>Cancel</Button><Button primary disabled={!cardEditor?.name.trim()} onClick={saveCard}>{cardEditor?.id ? 'Save name' : 'Create card'}</Button></>}>
      {cardEditor && <form onSubmit={e => { e.preventDefault(); saveCard(); }}><FieldRow label="Card name"><TextField autoFocus aria-label="Task card name" placeholder="Component or work area" value={cardEditor.name} onChange={e => setCardEditor({ ...cardEditor, name: e.target.value })}/></FieldRow></form>}
    </Dialog>
    <Dialog open={!!editing} title={tab === 'tasks' ? 'Edit task' : 'Edit comment'} onClose={closeEditor} actions={<><Button onClick={closeEditor}>Cancel</Button><Button primary disabled={busy || !editing?.text.trim()} onClick={async () => { if (editing && await mutate(tab === 'tasks' ? 'tasks' : 'comments', editing, editing.id)) {
      if (tab === 'tasks') setCards(current => current.map(card => ({ ...card, taskIds: [...card.taskIds.filter(id => id !== editing.id), ...(card.id === editingCard ? [editing.id] : [])] })));
      setTagsByItem(current => ({ ...current, [editing.id]: parseReviewTags(editingTags) }));
      setEditing(null);
    } }}>Save changes</Button></>}>
      {editing && <><FieldRow label={tab === 'tasks' ? 'Task' : 'Comment'}><TextField aria-label="Review item text" value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })}/></FieldRow><FieldRow label="Tags"><TextField aria-label="Review item tags" placeholder="Design, Clearance" value={editingTags} onChange={e => setEditingTags(e.target.value)}/></FieldRow>{tab === 'tasks' && <><FieldRow label="Card"><SelectField aria-label="Task card" value={editingCard} options={cardOptions} onChange={e => setEditingCard(e.target.value)}/></FieldRow><FieldRow label="Status"><SelectField aria-label="Task status" value={editing.status ?? 'open'} options={statuses.slice(1)} onChange={e => setEditing({ ...editing, status: e.target.value as CollaborationItem['status'] })}/></FieldRow><FieldRow label="Reference"><span>{editing.reference_name ?? documentName}{editing.revision ? ` · Main v${editing.revision}` : ''}</span></FieldRow>{editing.attachments?.map((image, i) => <a className="ps-review-image" key={i} href={image.data_url} download={image.name}><img src={image.data_url} alt={image.name}/></a>)}<FieldRow label="Assignee"><SelectField aria-label="Task assignee" value={editing.assignee} options={state.members.map(p => ({ value: p.id, label: p.name }))} onChange={e => setEditing({ ...editing, assignee: e.target.value })}/></FieldRow><FieldRow label="Due date"><TextField type="date" aria-label="Task due date" value={editing.due ?? ''} onInput={e => { const due = e.currentTarget.value; setEditing(item => item ? { ...item, due } : null); }} onChange={e => { const due = e.target.value; setEditing(item => item ? { ...item, due } : null); }}/></FieldRow></>}</>}
    </Dialog>
  </section>;
}
