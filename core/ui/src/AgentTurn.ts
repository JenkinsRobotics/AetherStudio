import { agentToolReply } from './AgentToolResult';
import type { AgentInteraction, AgentJob, AgentService, AgentToolCall, AgentToolReply, AgentImage } from './AgentServices';

export interface AgentAction {
  id: string; name: string; state: string; image?: AgentImage;
}
interface Action {
  call: AgentToolCall; fingerprint: string; reply?: AgentToolReply;
  state: string; failures: number; timer?: ReturnType<typeof setTimeout>;
}
interface Options {
  id: string; service: AgentService; interaction?: AgentInteraction;
  isCurrent: () => boolean;
  onJob: (job: AgentJob) => void;
  onActions: (actions: AgentAction[]) => void;
  onEnd: (error?: string) => void;
}

const POLL_MS = 400;
const REQUEST_MS = 15_000;
const ACTION_MS = 120_000;
const MAX_RECEIPT_FAILURES = 3;
const message = (error: unknown) => error instanceof Error ? error.message.slice(0, 1000) : 'The agent could not complete this action.';
class RequestTimeout extends Error {}

/** One conversation turn. Products retain all editing/undo/engine semantics.
 * Polling never waits for an engine: a revoked/cancelled job can abort a slow
 * operation before the product's guarded commit. Receipts, not edits, retry.
 */
export class AgentTurn {
  private controller = new AbortController();
  private actions = new Map<string, Action>();
  private pollTimer?: ReturnType<typeof setTimeout>;
  private started = false;
  private imagesUsed = 0;

  constructor(private options: Options) {}

  start() {
    if (this.started || this.controller.signal.aborted) return;
    this.started = true;
    this.schedule();
  }

  /** Synchronous local cancellation. The caller owns best-effort host cancel. */
  stop() {
    if (this.controller.signal.aborted) return;
    this.controller.abort();
    clearTimeout(this.pollTimer);
    for (const action of this.actions.values()) {
      clearTimeout(action.timer);
      if (action.state === 'Working') action.state = 'Cancelled';
      else if (action.state === 'Returning result' || action.state === 'Retrying result') action.state = 'Result unconfirmed';
    }
    this.publish();
  }

  private current() {
    return !this.controller.signal.aborted && this.options.isCurrent();
  }

  private publish() {
    this.options.onActions([...this.actions.values()].map(action => ({
      id: action.call.id, name: action.call.name, state: action.state,
      image: action.state === 'Done' && action.reply?.ok ? action.reply.images?.[0] : undefined,
    })));
  }

  private end(error?: string) {
    if (this.controller.signal.aborted) return;
    this.stop();
    this.options.onEnd(error);
  }

  private schedule() {
    if (!this.controller.signal.aborted) this.pollTimer = setTimeout(() => void this.poll(), POLL_MS);
  }

  /** Bound waiting even when an older transport cannot abort its network call.
   * Both late success and rejection are observed and cannot restart this turn.
   */
  private request<T>(action: string, data: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const signal = this.controller.signal;
      const finish = (error: unknown, value?: T) => {
        clearTimeout(timer); signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value as T);
      };
      const abort = () => finish(new Error('Agent stopped.'));
      const timer = setTimeout(() => finish(new RequestTimeout('Studio did not respond within 15 seconds. The agent stopped; check the document before trying again.')), REQUEST_MS);
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, {once: true});
      Promise.resolve().then(() => this.options.service.call<T>(action, data)).then(value => finish(null, value), error => finish(error));
    });
  }

  private async poll() {
    if (this.controller.signal.aborted) return;
    if (!this.options.isCurrent()) { this.end('The active workspace changed. The agent stopped.'); return; }
    try {
      const job = await this.request<AgentJob>('job', {id: this.options.id});
      if (!this.current()) { if (!this.controller.signal.aborted) this.end('The active workspace changed. The agent stopped.'); return; }
      if (job.id !== this.options.id) throw new Error('Studio returned a different agent job. The agent stopped.');
      this.options.onJob(job);
      if (job.state !== 'running') { this.end(job.error || undefined); return; }

      const call = job.tool_call;
      const working = [...this.actions.values()].find(action => !action.reply);
      if (working && call?.id !== working.call.id) throw new Error('The agent replaced an unfinished action. The agent stopped.');
      if (call) {
        const fingerprint = JSON.stringify([call.name, call.arguments]);
        let action = this.actions.get(call.id);
        if (action && action.fingerprint !== fingerprint) throw new Error('An agent action changed while retrying. The agent stopped without repeating it.');
        // A different/cleared host call confirms that the previous receipt arrived,
        // including when the HTTP acknowledgement was lost.
        this.acknowledgeOther(call.id);
        if (!action) {
          if (this.actions.size >= 48) throw new Error('The agent reached its 48-action limit.');
          action = {call, fingerprint, state: 'Working', failures: 0};
          this.actions.set(call.id, action);
          this.execute(action, job.tool_result_format === 'images-v1');
        }
        if (action.reply) await this.deliver(action);
      } else this.acknowledgeOther();
    } catch (error) {
      if (!this.controller.signal.aborted) this.end(message(error));
    }
    this.schedule();
  }

  private acknowledgeOther(currentId?: string) {
    for (const action of this.actions.values()) {
      if (action.call.id !== currentId && action.reply && (action.state === 'Returning result' || action.state === 'Retrying result')) this.acknowledge(action);
    }
  }

  private acknowledge(action: Action) {
    action.state = action.reply?.ok ? 'Done' : 'Failed: ' + (action.reply?.error || 'The editor could not complete this action.');
    this.publish();
  }

  private execute(action: Action, imagesSupported: boolean) {
    this.publish();
    action.timer = setTimeout(() => this.end('An editor action exceeded 2 minutes. The agent stopped; check the document before trying again.'), ACTION_MS);
    // Store the action before invoking a product. Even synchronous completion or
    // rejection cannot race another authenticated poll into repeating an edit.
    void (async () => {
      try {
        const interaction = this.options.interaction;
        if (!this.current()) return;
        if (!interaction || !interaction.tools.some(tool => tool.name === action.call.name)) throw new Error('This editor tool is not available.');
        const value = await interaction.execute(action.call, this.controller.signal);
        if (!this.current()) return;
        action.reply = agentToolReply(value, imagesSupported, this.imagesUsed);
        if (action.reply.ok && action.reply.images) this.imagesUsed += action.reply.images.length;
      } catch (error) {
        if (!this.current()) return;
        action.reply = {ok: false, error: message(error)};
      } finally { clearTimeout(action.timer); }
      if (!this.current()) return;
      action.state = 'Returning result'; this.publish();
    })();
  }

  private async deliver(action: Action) {
    try {
      await this.request('tool_result', {id: this.options.id, call_id: action.call.id, result: action.reply});
      if (this.current()) this.acknowledge(action);
    } catch (error) {
      if (!this.current()) return;
      action.state = 'Retrying result'; action.failures++; this.publish();
      // The next authenticated poll may show the receipt already arrived. Never
      // repeat the engine operation to resolve a missing acknowledgement.
      if (action.failures >= MAX_RECEIPT_FAILURES) throw new Error('Studio could not confirm the action result after 3 attempts. The agent stopped; check the document before trying again.');
      // A request deadline is an authority gap, not an ordinary lost receipt.
      if (error instanceof RequestTimeout) throw error;
    }
  }
}
