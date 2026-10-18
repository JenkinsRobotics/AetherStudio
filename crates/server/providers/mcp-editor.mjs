// stdio MCP server launched only by the isolated provider adapter.
import { createInterface } from 'node:readline';
const endpoint = new URL(process.env.AETHER_EDITOR_TOOL_ENDPOINT);
if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || !/^\/[a-f0-9]{64}$/.test(endpoint.pathname)) process.exit(1);
const reply = value => process.stdout.write(JSON.stringify(value) + '\n');
const lines = createInterface({ input: process.stdin });
lines.on('close', () => process.exit(0));
lines.on('line', async line => {
  let message;
  try {
    if (Buffer.byteLength(line) > 40000) throw Error();
    message = JSON.parse(line);
    if (!Object.hasOwn(message, 'id')) return;
    let result;
    if (message.method === 'initialize') result = {
      protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'aether-editor', version: '1.0.0' },
    };
    else if (message.method === 'ping') result = {};
    else if (['tools/list', 'tools/call'].includes(message.method)) {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: message.method, params: message.params }), signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw Error();
      result = await response.json();
    } else {
      reply({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Only editor tools are available.' } }); return;
    }
    reply({ jsonrpc: '2.0', id: message.id, result });
  } catch { reply({ jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32602, message: 'Editor tool request failed.' } }); }
});
