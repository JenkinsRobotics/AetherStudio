import { useId, useRef, useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextField } from './TextField';

export function NewFileDialog({ title, directory, onCreate, onClose }: {
  title: string; directory: string; onCreate: (name: string) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const formID = useId();
  const submit = async () => {
    if (submitting.current || !name.trim()) return;
    submitting.current = true; setBusy(true); setError('');
    try { await onCreate(name.trim()); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'The file could not be created.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Dialog open title={title} onClose={() => { if (!submitting.current) onClose(); }} actions={<>
    <Button disabled={busy} onClick={onClose}>Cancel</Button>
    <Button primary type="submit" form={formID} disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create'}</Button>
  </>}>
    <form id={formID} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <p>Create in {directory}</p>
      <label>Name<TextField aria-label="Name" autoFocus required maxLength={180} disabled={busy} value={name} onChange={event => setName(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
    </form>
  </Dialog>;
}
