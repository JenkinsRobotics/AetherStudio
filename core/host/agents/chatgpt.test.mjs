import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { identity, consumeStream, runResponses, signInCallback } from './chatgpt.mjs';

test('new and returning sign-in callbacks retain the selected registration and bind state/origin',()=>{
  const pending={redirect:'http://127.0.0.1:1455/auth/callback',state:'attempt'};
  const url=pending.redirect+'?state=attempt&code=one';
  assert.equal(signInCallback(url,pending),null);
  assert.deepEqual(signInCallback(url+'&client_id=oaiapp_first',pending),{value:'one',clientId:'oaiapp_first'});
  const returning={...pending,clientId:'oaiapp_first'};
  assert.deepEqual(signInCallback(url,returning),{value:'one',clientId:'oaiapp_first'});
  assert.equal(signInCallback(url+'&client_id=oaiapp_other',returning),null);
  assert.equal(signInCallback(url.replace('attempt','foreign'),returning),null);
  assert.equal(signInCallback(url.replace('127.0.0.1','localhost'),returning),null);
  assert.equal(signInCallback(url.replace('/auth/callback','/callback'),returning),null);
  assert.throws(()=>signInCallback(pending.redirect+'?state=attempt&error=access_denied',returning),/declined/);
});

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'test' };
function jwt(extra = {}, algorithm = 'RS256') {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, kid: 'test' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ iss: 'https://auth.openai.com', aud: 'oaiapp_test', exp: Date.now() / 1000 + 60, sub: 'person-1', nonce: 'nonce', email: 'person@example.test', ...extra })).toString('base64url');
  const input = `${header}.${claims}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), pair.privateKey).toString('base64url')}`;
}
test('account identity requires a valid signature, issuer, audience, expiry, nonce and subject', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => new Response(JSON.stringify(String(url).endsWith('openid-configuration') ? { issuer: 'https://auth.openai.com', jwks_uri: 'https://auth.openai.com/jwks' } : { keys: [jwk] }));
  try {
    assert.deepEqual(await identity(jwt(), 'oaiapp_test', 'nonce'), { subject: 'person-1', label: 'person@example.test' });
    for (const change of [{ iss: 'https://evil.test' }, { aud: 'other-client' }, { exp: 0 }, { nonce: 'wrong' }, { sub: '' }]) await assert.rejects(identity(jwt(change), 'oaiapp_test', 'nonce'));
    await assert.rejects(identity(jwt(), 'oaiapp_test', null, 'someone-else'));
    await assert.rejects(identity(jwt({}, 'none'), 'oaiapp_test', 'nonce'));
    const tampered = jwt().split('.'); tampered[1] = Buffer.from(JSON.stringify({ sub: 'other' })).toString('base64url');
    await assert.rejects(identity(tampered.join('.'), 'oaiapp_test', 'nonce'));
  } finally { globalThis.fetch = original; }
});
test('Responses carries reasoning and tool receipts into a multi-step editing conversation', async () => {
  const inputs = [], calls = [], deltas = [];
  const tool = { name: 'aether_sketch_draw', description: 'Draw', inputSchema: {type: 'object', properties: {}} };
  const reasoning = {type: 'reasoning', id: 'reason1', encrypted_content: 'opaque'};
  const post = async body => {
    inputs.push(structuredClone(body));
    return inputs.length === 1 ? response([{type: 'response.completed', response: {output: [reasoning,
      {type: 'function_call', call_id: 'c1', name: tool.name, arguments: '{"width":20}'}]}}]) :
      response([{type: 'response.output_text.delta', delta: 'Created the rectangle.'}, {type: 'response.completed', response: {output: [{type: 'message', role: 'assistant', content: []}]}}]);
  };
  await runResponses({messages: [{role: 'user', content: 'Draw a rectangle'}], tools: [tool]}, post, e => deltas.push(e.text), async call => { calls.push(call); return {ok: true, value: {shape_id: 'r1'}}; });
  assert.deepEqual(calls, [{id: 'c1', name: tool.name, arguments: {width: 20}}]);
  assert.deepEqual(inputs[1].input[1], reasoning);
  assert.equal(JSON.parse(inputs[1].input.at(-1).output).value.shape_id, 'r1');
  assert.equal(inputs[0].parallel_tool_calls, false);
  assert.equal(inputs[0].store, false);
  assert.deepEqual(deltas, ['Created the rectangle.']);
});
test('an unadvertised provider tool never executes', async () => {
  let executed = false;
  await assert.rejects(runResponses({messages: [], tools: []}, async () => response([{type: 'response.completed', response: {output: [
    {type: 'function_call', call_id: 'c1', name: 'shell', arguments: '{}'}]}}]), () => {}, async () => { executed = true; }), /Invalid/);
  assert.equal(executed, false);
});
const response = events => new Response(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''));
test('a stream is successful only after the completed terminal event', async () => {
  const deltas = [];
  await consumeStream(response([{ type: 'response.output_text.delta', delta: 'Hello' }, { type: 'response.completed' }]), e => deltas.push(e.text));
  assert.deepEqual(deltas, ['Hello']);
  for (const terminal of [[], [{ type: 'response.failed' }], [{ type: 'response.incomplete' }], [{ type: 'error' }]]) {
    await assert.rejects(consumeStream(response([{ type: 'response.output_text.delta', delta: 'Partial' }, ...terminal]), () => {}));
  }
});

test('visual tool receipts use image input content rather than a base64 JSON string', async () => {
  const tool = {name:'aether_sketch_preview',description:'Preview',inputSchema:{type:'object',properties:{}}};
  const requests=[];
  await runResponses({messages:[],tools:[tool]}, async body=>{
    requests.push(structuredClone(body));
    return response([{type:'response.completed',response:{output:requests.length===1?[{type:'function_call',call_id:'preview',name:tool.name,arguments:'{}'}]:[]}}]);
  },()=>{},async()=>({ok:true,value:{kind:'drawing'},images:[{mimeType:'image/png',data:'pixel-fixture',width:1,height:1}]}));
  assert.deepEqual(requests[1].input.at(-1).output,[
    {type:'input_text',text:'{"ok":true,"value":{"kind":"drawing"}}'},
    {type:'input_image',image_url:'data:image/png;base64,pixel-fixture',detail:'auto'},
  ]);
});
