import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { command, environment } from './protocol.mjs';
const cli = fileURLToPath(new URL('../tests/native_documents/official_cli_fixture.mjs', import.meta.url));
test('operator-native executable receives literal arguments without a shell', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aether-native-provider-'));
  try {
    const options = await environment(root, 'claude');
    let output = '';
    await command('/bin/echo', ['$(exit 71); ${HOME}', 'two words'], options,
      { text: chunk => output += chunk });
    assert.equal(output, '$(exit 71); ${HOME} two words\n');
    await assert.rejects(command('echo', ['unexpected'], options), /Operator CLI entrypoint/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
async function request(provider, action, directory, message = 'hello') {
  const adapter = fileURLToPath(new URL(`./${provider}.mjs`, import.meta.url));
  const child = spawn(process.execPath, [adapter, action, directory, cli], {
    env: { HOME: directory, ANTHROPIC_API_KEY: 'must-not-be-inherited', GEMINI_API_KEY: 'must-not-be-inherited' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  const lines = createInterface({input:child.stdout});
  lines.on('line', raw=>{const event=JSON.parse(raw);if(event.type==='tool_call'){assert.equal(event.name,'aether_sketch_draw');assert.deepEqual(event.arguments,{width:20});child.stdin.write(JSON.stringify({type:'tool_result',id:event.id,result:{ok:true,value:{shape_id:'rectangle-one'},images:[{mimeType:'image/png',data:'a'.repeat(100000),width:1,height:1}]}})+'\n');}});
  child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
  if (action === 'chat') child.stdin.write(JSON.stringify({ messages: [{ role: 'user', content: message }], model: '', instructions: 'Fixture only', ...(message==='tools'?{tools:[{name:'aether_sketch_draw',description:'Draw',inputSchema:{type:'object',properties:{width:{type:'number'}}}}]}:{}) })+'\n');
  const timer = setTimeout(() => child.kill(), 6000);
  const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject); });
  clearTimeout(timer);
  return { code, stderr, events: stdout.trim() ? stdout.trim().split('\n').map(JSON.parse) : [] };
}
for (const provider of ['claude', 'gemini']) {
  test(`${provider}: official CLI protocol, isolated environment, subscription login/models/chat`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'aether-provider-'));
    try {
      const directory = join(root, provider); await mkdir(directory, { mode: 0o700 });
      const login = await request(provider, 'login', directory);
      assert.equal(login.code, 0, login.stderr); assert.ok(login.events.some(e => e.type === 'connected'));
      assert.ok(login.events.some(e => e.type === 'login' && e.acceptsCode === false));
      const models = await request(provider, 'models', directory);
      assert.equal(models.code, 0); assert.ok(models.events.some(e => e.type === 'models' && e.models.some(m => m.id === '')));
      const chat = await request(provider, 'chat', directory);
      assert.equal(chat.code, 0); assert.ok(chat.events.some(e => e.type === 'delta')); assert.equal(chat.events.at(-1).type, 'done');
      for (const mode of ['failed', 'malformed']) {
        const failed = await request(provider, 'chat', directory, mode);
        assert.equal(failed.code, 1); assert.equal(failed.stderr, ''); assert.ok(!failed.events.some(e => e.type === 'done'));
      }
      const edited = await request(provider, 'chat', directory, 'tools');
      assert.equal(edited.code,0,edited.stderr); assert.equal(edited.events.filter(e=>e.type==='tool_call').length,1);
      assert.ok(edited.events.some(e=>e.type==='delta'&&e.text.includes('rectangle-one')));
      if (provider === 'claude') {
        const fallback = await request(provider, 'chat', directory, 'fallback');
        assert.equal(fallback.code, 0); assert.equal(fallback.events[0].text, 'Claude fallback response');
        assert.equal((await request(provider, 'chat', directory, 'huge')).code, 1);
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
