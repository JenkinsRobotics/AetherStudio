import React, { useLayoutEffect, useState } from 'react';
import { Button } from '@aether/ui';
import type { AgentInteraction } from '@aether/ui/AgentServices';
import { LiveEditorConnection, studioEditorTransport } from './live-editor';

/** Explicit local opt-in. Leaving this panel or document ends sharing. */
export function LiveEditorAccess({ app, documentID, interaction }: {
  app: 'cad' | 'map'; documentID: string | null; interaction: AgentInteraction;
}) {
  const current = React.useRef(interaction); current.current = interaction;
  const [state, setState] = useState('off'), [message, setMessage] = useState('');
  const [connection] = useState(() => new LiveEditorConnection(studioEditorTransport, () => current.current,
    (next, text) => { setState(next); setMessage(text); }));
  useLayoutEffect(() => {
    connection.stop();
    const stop = () => connection.stop(); window.addEventListener('pagehide', stop);
    return () => { connection.stop(); window.removeEventListener('pagehide', stop); };
  }, [connection, documentID, interaction.contextKey]);
  if (!documentID) return null;
  const enabled = state === 'shared' || state === 'working' || state === 'connecting';
  return <div className="aui-live-editor-access" aria-label="External agent access">
    <Button onClick={() => enabled ? connection.stop() : void connection.start(app, documentID)}>
      {enabled ? 'Stop sharing editor' : 'Share this editor'}
    </Button>
    <p role="status">{message || 'Let connected agents use this editor’s tools and undo. Requires Studio content-edit access.'}</p>
  </div>;
}
