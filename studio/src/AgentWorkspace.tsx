import { useState } from 'react';
import { WorkspaceAgent } from '@aether/ui';
import type { AssistantMessage } from '@aether/ui/concept-widgets';
import { studioAgentService } from '@aether/session/agent';
export function AgentWorkspace({ app }: { app: string }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  return <div style={{ height: '100dvh', minHeight: 0, background: 'var(--aether-color-bg-panel)' }}><WorkspaceAgent service={studioAgentService} app={app} contextText={`The user is working in the ${app} workspace. No document content has been attached.`} detail={`Aether ${app}`} messages={messages} onMessages={setMessages}/></div>;
}
