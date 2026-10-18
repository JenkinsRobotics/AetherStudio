// Local protocol fixture, no network or real provider account.
import assert from 'node:assert/strict';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2), acp = args.includes('--acp');
const home = process.env.HOME;
assert.ok(home && process.cwd().startsWith(await realpath(home)));
assert.equal(process.env.OPENAI_API_KEY, undefined);
assert.equal(process.env.ANTHROPIC_API_KEY, undefined);
assert.equal(process.env.GEMINI_API_KEY, undefined);
assert.equal(process.env.NODE_OPTIONS, undefined);
const out = value => process.stdout.write(JSON.stringify(value) + '\n');
await writeFile(join(home, 'process.json'), JSON.stringify({ pid: process.pid }), { mode: 0o600 });
const valueAfter = flag => args[args.indexOf(flag) + 1];
let marker = '';
try { marker = await readFile(join(home, 'behavior.txt'), 'utf8'); } catch {}
async function editor(config) {
  assert.ok(config && config.command === process.execPath);
  const child = spawn(config.command, config.args, {env: {...process.env, ...config.env}, stdio: ['pipe','pipe','pipe']});
  const lines = createInterface({input: child.stdout});
  let serial = 0; const pending = new Map();
  lines.on('line', raw => {const reply = JSON.parse(raw); pending.get(reply.id)?.(reply.result); pending.delete(reply.id);});
  const rpc = (method, params = {}) => new Promise(resolve => {const id = ++serial; pending.set(id, resolve); child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
  try {
    const init = await rpc('initialize', {protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'fixture',version:'1'}});
    assert.deepEqual(init.capabilities,{tools:{}});
    const list = await rpc('tools/list'); assert.equal(list.tools.length,1); assert.equal(list.tools[0].name,'aether_sketch_draw');
    const result = await rpc('tools/call',{name:list.tools[0].name,arguments:{width:20}});
    assert.equal(result.isError,false); assert.equal(JSON.parse(result.content[0].text).shape_id,'rectangle-one');
    if(result.content[1]) {assert.equal(result.content[1].type,'image');assert.equal(result.content[1].mimeType,'image/png');assert.equal(result.content[1].data,'a'.repeat(100000));
      const echo=acp?{jsonrpc:'2.0',method:'session/update',params:{update:{sessionUpdate:'tool_call_update',content:result.content}}}:{type:'user',message:{content:[{type:'tool_result',content:result.content}]}};
      await new Promise(resolve=>process.stdout.write(JSON.stringify(echo)+'\n',resolve));}
    return 'Editor created rectangle-one';
  } finally {child.kill();}
}
if (!acp) {
  assert.equal(process.env.CLAUDE_CONFIG_DIR, home);
  if (args[0] === 'auth' && args[1] === 'login') {
    assert.ok(args.includes('--claudeai'));
    process.stderr.write('https://claude.ai/oauth/authorize?fixture=true\n');
    if (marker === 'hang-login') { setInterval(() => {}, 1000); await new Promise(() => {}); }
    await writeFile(join(home, 'fixture-credential'), 'local-only', { mode: 0o600 });
    process.exit(0);
  }
  if (args[0] === 'auth' && args[1] === 'status') {
    await readFile(join(home, 'fixture-credential'));
    out({ loggedIn: true, authMethod: 'claude.ai', email: 'local-fixture@example.invalid' }); process.exit(0);
  }
  assert.ok(args.includes('-p') && args.includes('--strict-mcp-config') && args.includes('--no-session-persistence'));
  assert.equal(valueAfter('--tools'), ''); assert.equal(valueAfter('--setting-sources'), '');
  const mcp = JSON.parse(valueAfter('--mcp-config')).mcpServers;
  if (mcp.aether) assert.equal(valueAfter('--allowedTools'), 'mcp__aether__aether_sketch_draw');
  else assert.deepEqual(mcp, {});
  const lines = createInterface({ input: process.stdin });
  lines.once('line', async raw => {
    const mode = JSON.parse(raw)[0].content;
    if (mode === 'tools') {const result = await editor(mcp.aether); out({type:'result',is_error:false,subtype:'success',result});process.exit(0);}
    if (mode === 'malformed') { process.stdout.write('{broken\n'); process.exit(0); }
    if (mode === 'huge') { process.stdout.write('x'.repeat(70000)); return; }
    if (mode === 'failed') { process.stderr.write('SECRET TOKEN'); out({ type: 'result', is_error: true, subtype: 'error' }); process.exit(1); }
    if (mode === 'hang') { setInterval(() => {}, 1000); return; }
    if (mode !== 'fallback') out({ type: 'stream_event', event: { delta: { type: 'text_delta', text: 'Claude fixture response' } } });
    out({ type: 'result', is_error: false, subtype: 'success', result: 'Claude fallback response' }); process.exit(0);
  });
} else {
  assert.equal(process.env.GEMINI_CLI_HOME, home);
  assert.equal(process.env.GEMINI_FORCE_FILE_STORAGE, 'true');
  const settings = JSON.parse(await readFile(join(home, '.gemini/settings.json')));
  assert.deepEqual(settings.tools.core, []); if(settings.mcpServers.aether) assert.equal(settings.mcpServers.aether.trust,true); else assert.deepEqual(settings.mcpServers, {});
  assert.deepEqual(settings.hooks, {}); assert.deepEqual(settings.context.fileName, []);
  const lines = createInterface({ input: process.stdin });
  let pendingPrompt, denied = 0;
  lines.on('line', raw => {
    const rpc = JSON.parse(raw);
    const reply = result => out({ jsonrpc: '2.0', id: rpc.id, result });
    switch (rpc.method) {
      case 'initialize': assert.deepEqual(rpc.params.clientCapabilities, {}); reply({ protocolVersion: 1 }); break;
      case 'authenticate':
        assert.equal(rpc.params.methodId, 'oauth-personal');
        if (process.env.NO_BROWSER !== 'true') process.stderr.write('https://accounts.google.com/o/oauth2/auth?fixture=true\n');
        if (marker === 'hang-login') return;
        reply({}); break;
      case 'session/new':
        assert.deepEqual(rpc.params.mcpServers, []); assert.ok(rpc.params.cwd.startsWith(home));
        reply({ sessionId: 'fixture-session', models: { availableModels: [{ modelId: '', name: 'Account default' }, { modelId: 'fixture-model', name: 'Fixture' }] } }); break;
      case 'session/set_model': assert.equal(rpc.params.sessionId, 'fixture-session'); reply({}); break;
      case 'session/prompt': {
        assert.equal(process.env.NO_BROWSER, 'true');
        const text = rpc.params.prompt[0].text;
        if (text.includes('"content":"tools"')) {void editor(settings.mcpServers.aether).then(text=>{out({jsonrpc:'2.0',method:'session/update',params:{update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text}}}});reply({stopReason:'end_turn'});});return;}
        if (text.includes('"content":"hang"')) return;
        if (text.includes('"content":"failed"')) { reply({ stopReason: 'cancelled' }); return; }
        if (text.includes('"content":"malformed"')) { process.stdout.write('{broken\n'); return; }
        pendingPrompt = rpc.id;
        out({ jsonrpc: '2.0', id: 'permission-test', method: 'session/request_permission', params: {} });
        out({ jsonrpc: '2.0', id: 'filesystem-test', method: 'fs/read_text_file', params: { path: '/etc/passwd' } });
        break;
      }
      default:
        if (rpc.id === 'permission-test') { assert.equal(rpc.result.outcome.outcome, 'cancelled'); denied++; }
        if (rpc.id === 'filesystem-test') { assert.equal(rpc.error.code, -32601); denied++; }
        if (denied === 2) {
          out({ jsonrpc: '2.0', method: 'session/update', params: { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Gemini fixture response; tools denied' } } } });
          out({ jsonrpc: '2.0', id: pendingPrompt, result: { stopReason: 'end_turn' } });
        }
    }
  });
}
