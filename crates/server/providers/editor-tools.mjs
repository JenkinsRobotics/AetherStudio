// Private, per-job MCP bridge to the originating browser editor. It has no
// filesystem, shell, network-fetch or arbitrary JavaScript execution tools.
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requestTool } from './protocol.mjs';

export async function editorTools(tools = []) {
  if (!tools.length) return null;
  const secret = randomBytes(32).toString('hex');
  let busy = false;
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST' || req.url !== '/' + secret || req.headers.origin) {
      res.writeHead(403); res.end('{}'); return;
    }
    try {
      let text = '';
      for await (const chunk of req) {
        text += chunk;
        if (Buffer.byteLength(text) > 40000) throw Error('Request too large');
      }
      const { method, params } = JSON.parse(text);
      let result;
      if (method === 'tools/list') result = { tools };
      else if (method === 'tools/call') {
        if (busy || !tools.some(tool => tool.name === params?.name) || !params.arguments ||
            typeof params.arguments !== 'object' || Array.isArray(params.arguments)) throw Error('Unavailable editor tool');
        busy = true;
        try {
          const reply = await requestTool({ id: randomUUID(), name: params.name, arguments: params.arguments });
          result = { content: [{ type: 'text', text: JSON.stringify(reply.ok ? reply.value : { error: reply.error }) },
            ...(reply.ok ? (reply.images || []).map(image => ({ type: 'image', mimeType: image.mimeType, data: image.data })) : [])], isError: !reply.ok };
        } finally { busy = false; }
      } else throw Error('Unknown method');
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Editor tool request failed.' }));
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {
    command: process.execPath,
    args: [fileURLToPath(new URL('./mcp-editor.mjs', import.meta.url))],
    env: { AETHER_EDITOR_TOOL_ENDPOINT: `http://127.0.0.1:${server.address().port}/${secret}` },
    close: () => { server.closeAllConnections(); server.close(); },
  };
}
