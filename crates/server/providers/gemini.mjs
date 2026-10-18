// Official Gemini CLI ACP transport. Only explicitly supplied editor MCP tools; no filesystem or terminal tools.
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { emit, environment, input, launch, loginScanner, main, observe } from './protocol.mjs';
import { editorTools } from './editor-tools.mjs';
const [action, directory, cli] = process.argv.slice(2);
await main(async () => {
  if (!['login', 'models', 'chat'].includes(action)) throw new Error('Unknown action');
  if (action !== 'chat') process.stdin.resume(); // Observe the host lifetime pipe.
  const payload = action === 'chat' ? await input() : null;
  const options = await environment(directory, 'gemini');
  const bridge = await editorTools(payload?.tools);
  const config = join(directory, '.gemini'); await mkdir(config, { recursive: true, mode: 0o700 });
  await writeFile(join(config, 'settings.json'), JSON.stringify({
    tools: { core: [] }, security: { folderTrust: { enabled: false } },
    telemetry: { enabled: false }, mcpServers: bridge ? { aether: { command: bridge.command, args: bridge.args, env: bridge.env, trust: true, includeTools: payload.tools.map(t => t.name) } } : {}, hooks: {}, context: { fileName: [] },
  }), { mode: 0o600 });
  if (action !== 'login') options.env.NO_BROWSER = 'true';
  const child = launch(cli, ['--acp'], options);
  let serial = 0, closed = false; const waiting = new Map();
  const send = value => child.stdin.write(JSON.stringify(value) + '\n');
  const fail = error => {
    closed = true;
    for (const pending of waiting.values()) pending.reject(error || new Error('Connection closed'));
    waiting.clear();
  };
  observe(child, { ...(bridge ? { maxRecordBytes: 512 * 1024, maxOutputBytes: 6 * 1024 * 1024 } : {}), stderr: action === 'login' ? loginScanner(['accounts.google.com']) : undefined,
    end: fail,
    line: raw => {
      const event = JSON.parse(raw);
      if (event.method && Object.hasOwn(event, 'id')) {
        if (event.method === 'session/request_permission') send({ jsonrpc: '2.0', id: event.id, result: { outcome: { outcome: 'cancelled' } } });
        else send({ jsonrpc: '2.0', id: event.id, error: { code: -32601, message: 'Host tools are not available.' } });
      } else if (event.method === 'session/update' && action === 'chat') {
        const update = event.params?.update;
        if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') emit({ type: 'delta', text: update.content.text });
      } else if (Object.hasOwn(event, 'id') && waiting.has(event.id)) {
        const pending = waiting.get(event.id); waiting.delete(event.id);
        if (event.error) pending.reject(new Error('Provider request failed'));
        else pending.resolve(event.result || {});
      }
    },
  });
  const rpc = (method, params) => new Promise((resolve, reject) => {
    if (closed) return reject(new Error('Connection closed'));
    const id = ++serial;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('Provider timeout')); child.kill(); }, action === 'login' ? 590000 : 180000);
    waiting.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    send({ jsonrpc: '2.0', id, method, params });
  });
  try {
    await rpc('initialize', { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: 'aether-studio', version: '0.1.0' } });
    await rpc('authenticate', { methodId: 'oauth-personal' });
    if (action === 'login') { emit({ type: 'connected', label: 'Google account' }); return; }
    const session = await rpc('session/new', { cwd: options.work, mcpServers: [] });
    if (action === 'models') {
      const models = session.models?.availableModels;
      emit({ type: 'models', models: models?.length ? models.map(m => ({ id: m.modelId, name: m.name })) : [{ id: '', name: 'Account default' }] }); return;
    }
    if (payload.model) await rpc('session/set_model', { sessionId: session.sessionId, modelId: payload.model });
    const result = await rpc('session/prompt', { sessionId: session.sessionId, prompt: [{ type: 'text', text: payload.instructions + '\n\n' + JSON.stringify(payload.messages) }] });
    if (result.stopReason !== 'end_turn') throw new Error('Incomplete response');
  } finally { child.kill(); bridge?.close(); }
});
