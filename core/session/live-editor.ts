import type { AgentInteraction, AgentToolCall } from '@aether/ui/AgentServices';
import { agentToolReply } from '@aether/ui/AgentToolResult';

export type EditorTransport = <T>(action: string, data: Record<string, unknown>) => Promise<T>;
export const studioEditorTransport: EditorTransport = async (action, data) => {
  const response = await fetch(`/api/automation/editor/${action}`, {
    method: 'POST', credentials: 'same-origin', keepalive: action === 'close',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    signal: AbortSignal.timeout(6000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(typeof result.error === 'string' ? result.error : 'Editor access ended. Reconnect from this panel.');
  return result;
};
interface Registration { editor: string; secret: string }
/** Transport only. The product interaction remains the sole editing authority. */
export class LiveEditorConnection {
  private registration?: Registration;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private active?: { id: string; controller: AbortController; timeout: ReturnType<typeof setTimeout> };
  private delivered = new Set<string>();
  constructor(private transport: EditorTransport, private current: () => AgentInteraction,
    private status: (state: 'off' | 'connecting' | 'shared' | 'working' | 'error', text: string) => void) {}
  async start(app: string, document: string) {
    this.stop();
    const generation = this.generation, interaction = this.current();
    this.status('connecting', 'Connecting this editor…');
    try {
      const registration = await this.transport<Registration>('register', { app, document,
        context: interaction.contextKey, tools: interaction.tools });
      if (generation !== this.generation || this.current().contextKey !== interaction.contextKey) {
        void this.transport('close', { ...registration }).catch(() => {}); return;
      }
      this.registration = registration;
      this.status('shared', 'Shared with your authorized agents while this panel is open.');
      void this.poll(generation, interaction.contextKey);
    } catch (error) {
      if (generation === this.generation) { this.stop(); this.status('error', (error as Error).message); }
    }
  }
  stop() {
    this.generation++;
    clearTimeout(this.timer);
    if (this.active) { this.active.controller.abort(); clearTimeout(this.active.timeout); }
    const previous = this.registration;
    this.registration = undefined; this.active = undefined; this.delivered.clear();
    if (previous) void this.transport('close', { ...previous }).catch(() => {});
    this.status('off', '');
  }
  private async poll(generation: number, context: string) {
    if (generation !== this.generation || !this.registration) return;
    if (this.current().contextKey !== context) { this.stop(); return; }
    try {
      const reply = await this.transport<{ call?: AgentToolCall }>('poll', {
        ...this.registration, ...(this.active ? { running: this.active.id } : {}),
      });
      if (generation !== this.generation) return;
      if (reply.call && !this.active) {
        if (this.delivered.has(reply.call.id)) throw Error('Duplicate delivery refused. Inspect the editor before continuing.');
        this.delivered.add(reply.call.id);
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); this.stop(); this.status('error', 'The operation timed out. Inspect the editor and receipt before continuing.'); }, 110000);
        this.active = { id: reply.call.id, controller, timeout };
        this.status('working', `Agent: ${reply.call.name}`);
        void this.execute(reply.call, controller, generation, context);
      }
      this.timer = setTimeout(() => void this.poll(generation, context), 1000);
    } catch (error) {
      if (generation === this.generation) {
        const wasWorking = !!this.active;
        this.stop(); this.status('error', `${(error as Error).message}${wasWorking ? ' The outcome may be unknown; inspect before retrying.' : ''}`);
      }
    }
  }
  private async execute(call: AgentToolCall, controller: AbortController, generation: number, context: string) {
    let result;
    try {
      controller.signal.throwIfAborted();
      const interaction = this.current();
      if (interaction.contextKey !== context || !interaction.tools.some(t => t.name === call.name)) throw Error('The editor or tool changed.');
      result = agentToolReply(await interaction.execute(call, controller.signal), true, 0);
    } catch (error) { result = { ok: false, error: String((error as Error)?.message ?? error).slice(0, 1800) }; }
    if (generation !== this.generation || !this.registration || controller.signal.aborted) return;
    try {
      // Retry receipts through editor.result; never execute again to repair a lost reply.
      await this.transport('reply', { ...this.registration, operation: call.id, result });
      if (generation !== this.generation) return;
      clearTimeout(this.active?.timeout); this.active = undefined;
      this.status('shared', result.ok ? 'Agent operation completed.' : `Agent operation refused: ${result.error}`);
    } catch {
      if (generation === this.generation) { this.stop(); this.status('error', 'Result delivery failed. Inspect the editor and receipt before another edit.'); }
    }
  }
}
