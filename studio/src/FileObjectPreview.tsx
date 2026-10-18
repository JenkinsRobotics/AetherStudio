import { useEffect, useRef, useState } from 'react';
import { FileIcon } from '@aether/ui';
import { api } from '@aether/session/library/api';
import './FileObjectPreview.css';

interface PreviewFile { id:string; name:string; kind:string; revision:number; }
// Small, memory-only revision cache; never writes user geometry to local storage.
const previews = new Map<string, Promise<{image:string|null; reason?:string}>>();
let queue: Promise<unknown> = Promise.resolve();
if (typeof document !== 'undefined') document.addEventListener('aether-account', () => previews.clear());
function requestPreview(app:string, file:PreviewFile) {
  const key = `${app}/${file.id}/${file.revision}`;
  const existing = previews.get(key); if (existing) return existing;
  const task = queue.then(async () => {
    // Revision reads neither change the document nor mark it recently opened.
    const saved = await api<{data_base64:string}>('/api/library/read_revision', {app, id:file.id, revision:file.revision});
    const bytes = Uint8Array.from(atob(saved.data_base64), char => char.charCodeAt(0));
    const moduleURL = '/cad/preview-document.js';
    const product: {previewDocument:(content:string) => Promise<string|null>} = await import(/* @vite-ignore */ moduleURL);
    return {image: await product.previewDocument(new TextDecoder().decode(bytes)), reason:undefined};
  }).catch(error => ({image:null, reason:error instanceof Error ? error.message : "Preview unavailable"}));
  queue = task; previews.set(key,task);
  if (previews.size > 48) previews.delete(previews.keys().next().value!);
  return task;
}

/** Display a real saved object where supported, otherwise keep the file's own icon. */
export function FileObjectPreview({file, app, size = 'row', enabled = true}: {
  file:PreviewFile; app:string; size?:'row'|'gallery'|'details'; enabled?:boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [image,setImage] = useState<string|null>(null);
  const [reason,setReason] = useState("");
  const supported = app === 'cad' && file.kind === 'file' && /\.(acpart|cadpart)$/i.test(file.name);
  useEffect(() => {
    setImage(null); setReason("");
    if (!enabled || !supported) return;
    let live = true;
    const load = () => { setReason("Loading preview…"); void requestPreview(app,file).then(value => { if(live) {setImage(value.image); setReason(value.reason ?? "");} }); };
    const observer = new IntersectionObserver(entries => {
      if(entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, {rootMargin:'120px'});
    if(ref.current) observer.observe(ref.current);
    return () => { live=false; observer.disconnect(); };
  }, [app,file.id,file.revision,file.name,enabled,supported]);
  return <span ref={ref} className="library-object-preview" data-size={size} data-preview-supported={supported} data-preview-enabled={enabled} title={image ? `Saved object preview: ${file.name}` : `${file.name} — ${reason || "file type icon"}`}>
    {enabled && image ? <img src={image} alt={`Preview of ${file.name}`} /> : <FileIcon file={{...file,app}} size={size === 'row' ? 28 : 64}/>}
  </span>;
}
