import type { CommentImage } from "../../src/DocumentServices";
import { useRef, useState, type ReactNode } from "react";
import { AetherIcon, IconButton, MenuButton } from "../../src";

export function ReviewComposer({ task, value, onChange, onSubmit, busy, selectedName, reply, onCancelReply, context }: {
  context?: ReactNode; task: boolean; value: string; onChange: (text: string) => void; busy: boolean;
  selectedName?: string; reply?: string; onCancelReply: () => void;
  onSubmit: (attachments: CommentImage[], reference: boolean, revision: boolean) => Promise<boolean>;
}) {
  const input = useRef<HTMLTextAreaElement>(null), files = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<CommentImage[]>([]), [reference, setReference] = useState(false), [revision, setRevision] = useState(false), [error, setError] = useState("");
  async function addImages(list: FileList | null) {
    if (!list) return;
    setError("");
    try {
      const added: CommentImage[] = [];
      for (const file of Array.from(list).slice(0, 3 - images.length)) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) throw Error('Choose PNG, JPEG or WebP images under 2 MB.');
        const data_url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('Could not read this image.')); reader.readAsDataURL(file); });
        added.push({ name: file.name, data_url });
      }
      setImages(current => [...current, ...added].slice(0, 3));
    } catch (e) { setError((e as Error).message); }
  }
  function action(id: string) {
    if (id === 'image') files.current?.click();
    else if (id === 'reference') setReference(v => !v);
    else if (id === 'revision') setRevision(v => !v);
    else { onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}@Lindsay `); input.current?.focus(); }
  }
  return <div className="ps-review-compose-wrap">
    {reply && <div className="ps-review-replying">Replying to {reply}<IconButton label="Cancel reply" size="small" onClick={onCancelReply}><AetherIcon name="close"/></IconButton></div>}
    {error && <small role="alert">{error}</small>}
    <form className="ps-review-composer aui-agent-chat__composer" aria-label={task ? 'Task composer' : 'Comment composer'} onSubmit={async e => { e.preventDefault(); if (await onSubmit(images, reference, revision)) { setImages([]); setReference(false); setRevision(false); } }}>
      {context}
      {!!images.length && <div className="ps-review-attachments">{images.map((image, i) => <span key={`${image.name}-${i}`}><img src={image.data_url} alt={image.name}/><IconButton size="small" label={`Remove ${image.name}`} onClick={() => setImages(v => v.filter((_, n) => n !== i))}><AetherIcon name="close"/></IconButton></span>)}</div>}
      {reference && <button type="button" className="ps-review-context-chip" onClick={() => setReference(false)}><AetherIcon name="cube"/>{selectedName ?? 'Whole model'}<AetherIcon name="close"/></button>}
      {revision && <button type="button" className="ps-review-context-chip" onClick={() => setRevision(false)}>Main · v12<AetherIcon name="close"/></button>}
      <textarea ref={input} rows={2} aria-label={task ? 'New task' : 'Write a comment'} placeholder={task ? 'Add a task for this design…' : 'Add a comment or ask a question…'} value={value} onChange={e => onChange(e.target.value)} disabled={busy}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}/>
      <div className="ps-review-composer-actions">
        <input ref={files} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" aria-label="Attach review images" onChange={e => { void addImages(e.target.files); e.target.value = ''; }}/>
        <MenuButton className="ps-review-add" label="Add to draft" placement="top-start" disabled={busy} items={[
          { id: 'image', label: 'Attach images', icon: <AetherIcon name="image"/> },
          { id: 'reference', label: reference ? 'Remove model reference' : 'Reference selected part', icon: <AetherIcon name="cube"/> },
          { id: 'revision', label: revision ? 'Remove version reference' : 'Reference Main v12', icon: <AetherIcon name="history"/> },
          { id: 'mention', label: 'Mention Lindsay', icon: <AetherIcon name="comment"/> },
        ]} onSelect={action}><AetherIcon name="plus"/></MenuButton>
        <IconButton size="small" label="Mention Lindsay" disabled={busy} onClick={() => action('mention')}><span aria-hidden>@</span></IconButton>
        <IconButton size="small" label="Reference selected part" aria-pressed={reference} disabled={busy} onClick={() => action('reference')}><AetherIcon name="cube"/></IconButton>
        <IconButton size="small" label="Attach images" disabled={busy || images.length >= 3} onClick={() => action('image')}><AetherIcon name="image"/></IconButton>
        <span className="ps-review-compose-kind"><AetherIcon name={task ? 'tasks' : 'pencil'}/>{task ? 'Task' : 'Comment'}</span>
        <IconButton className="ps-review-send" type="submit" label={task ? 'Add task' : reply ? 'Send reply' : 'Send comment'} disabled={busy || !value.trim()}><AetherIcon name="arrow-up"/></IconButton>
      </div>
    </form>
  </div>;
}
