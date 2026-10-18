/** UI-facing agent contract; adapters own transport. */
export interface AgentJob {
  id: string; provider: string; kind: string; state: 'running' | 'completed' | 'failed' | 'cancelled';
  text: string; error: string; models: { id: string; name: string }[];
  login: { url: string; instruction: string; acceptsCode?: boolean } | null;
  tool_result_format?: 'images-v1';
  tool_call?: AgentToolCall | null;
}
export interface AgentTool { name: string; description: string; inputSchema: Record<string, unknown>; }
export interface AgentToolCall { id: string; name: string; arguments: Record<string, unknown>; }
/** The product owns validation, engine evaluation, undo and persistence.
 * Async tools must observe signal and recheck document identity immediately
 * before committing. Cancellation does not undo edits already committed. The
 * shared runner polls authority during tools and stops a turn after 2 minutes
 * per action; it never retries execute to recover a missing result receipt.
 */
export interface AgentInteraction {
  contextKey: string;
  tools: readonly AgentTool[];
  execute: (call: AgentToolCall, signal: AbortSignal) => Promise<unknown>;
}
export interface AgentPlugin {
  id: string; name: string; publisher: string; description: string; version: string;
  documentation: string; signIn: string; installed: boolean; enabled: boolean; runtimeReady: boolean;
  account: { connected?: boolean; label?: string; verifiedAt?: number };
  capabilities: { chat: boolean; imageGeneration: boolean; videoGeneration: boolean };
  job: AgentJob | null;
}
export interface AgentService { call<T>(action: string, data?: Record<string, unknown>): Promise<T>; }

/** Pixels are private tool data, delivered only to the selected provider. */
export interface AgentImage { mimeType: 'image/png'; data: string; width: number; height: number; }
export interface AgentToolContent { type: 'aether.tool-content'; value: unknown; images: [AgentImage]; }
export type AgentToolReply = {ok: true; value: unknown; images?: AgentImage[]} | {ok: false; error: string};
