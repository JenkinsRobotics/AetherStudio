import type { AgentService } from "@aether/ui/AgentServices";
export type { AgentService, AgentPlugin, AgentJob } from "@aether/ui/AgentServices";
export const studioAgentService: AgentService = {
  async call<T>(action: string, data = {}): Promise<T> {
    const response = await fetch(`/api/agent/${action}`, { method: 'POST', keepalive: action === 'cancel', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Studio agent service is unavailable.');
    return result as T;
  },
};
