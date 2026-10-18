/** Public Sign in with ChatGPT; no API keys or private ChatGPT endpoints. */
import { createServer } from 'node:http';
import { randomBytes, createHash, createPublicKey, verify, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, chmod, rename } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [action, directory] = process.argv.slice(2);
const main = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
const lines = main ? createInterface({ input: process.stdin }) : null;
const firstInput = main ? new Promise(resolve => lines.once('line', line => resolve(JSON.parse(line)))) : null;
const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
const AUTH = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const file = directory ? join(directory, 'account.json') : '';

async function read() { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }
async function save(value) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(file + '.tmp', JSON.stringify(value), { mode: 0o600 });
  await chmod(file + '.tmp', 0o600); await rename(file + '.tmp', file);
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(response.status === 401 ? 'Account sign-in expired. Reconnect in Plugins.' : `Provider request failed (${response.status}). Check account access and usage limits.`);
  return response;
}
async function token(body) { return (await request(AUTH + '/api/accounts/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...body, resource: RESOURCE }) })).json(); }
async function identity(jwt, clientId, nonce, subject) {
  const parts = jwt?.split('.') ?? []; if (parts.length !== 3) throw new Error('Invalid identity response.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url'));
  const discovery = await (await request(AUTH + '/.well-known/openid-configuration')).json();
  if (new URL(discovery.jwks_uri).origin !== AUTH) throw new Error('Invalid identity key origin.');
  const { keys } = await (await request(discovery.jwks_uri)).json();
  const key = keys.find(k => k.kid === header.kid && k.kty === 'RSA');
  if (header.alg !== 'RS256' || !key || !verify('RSA-SHA256', Buffer.from(parts.slice(0, 2).join('.')), createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error('Identity signature verification failed.');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
  if (claims.iss !== discovery.issuer || ![claims.aud].flat().includes(clientId) || claims.exp <= Date.now() / 1000 || !claims.sub || (nonce && claims.nonce !== nonce) || (subject && claims.sub !== subject)) throw new Error('Identity verification failed.');
  return { subject: claims.sub, label: claims.email || claims.name || 'ChatGPT account' };
}
async function access() {
  let account = await read(); if (!account?.refreshToken) throw new Error('Sign in with ChatGPT in Plugins.');
  if (account.expires <= Date.now() + 60000) {
    const result = await token({ grant_type: 'refresh_token', refresh_token: account.refreshToken, client_id: account.clientId });
    if (result.id_token) await identity(result.id_token, account.clientId, null, account.subject);
    account = { ...account, accessToken: result.access_token, refreshToken: result.refresh_token || account.refreshToken, expires: Date.now() + result.expires_in * 1000 };
    await save(account);
  }
  return account;
}
export function signInCallback(url, {redirect, state, clientId}) {
  const parsed=new URL(url),expected=new URL(redirect);
  if(parsed.origin!==expected.origin||parsed.pathname!==expected.pathname||parsed.searchParams.get('state')!==state)return null;
  if(parsed.searchParams.has('error'))throw new Error('Account sign-in was declined.');
  const value=parsed.searchParams.get('code'),returned=parsed.searchParams.get('client_id');
  // Returning authorizations may omit client_id. They may not replace the
  // selected account's registration with another one.
  if(clientId&&returned&&returned!==clientId)return null;
  const issued=returned||clientId;
  if(!value||!issued?.startsWith('oaiapp_'))return null;
  return {value,clientId:issued};
}
async function login() {
  const previous = await read(); const hostID = previous?.hostID || `urn:uuid:${randomUUID()}`;
  if (!previous) await save({ hostID });
  const state = randomBytes(32).toString('base64url'), nonce = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
  let resolveCode; const code = new Promise(resolve => { resolveCode = resolve; });
  let redirect;
  function accept(url) {
    const result=signInCallback(url,{redirect,state,clientId:previous?.clientId});
    if(!result)return false;
    resolveCode(result); return true;
  }
  const server = createServer((req, res) => {
    try { const ok = accept(`http://127.0.0.1:${server.address().port}${req.url}`); res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end(ok ? 'Sign-in received. Return to Aether Studio.' : 'Invalid sign-in response.'); }
    catch { res.writeHead(400); res.end('Sign-in declined.'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  redirect = `http://127.0.0.1:${server.address().port}/auth/callback`;
  const params = new URLSearchParams({ client_id: previous?.clientId || 'dynamic_agent_client', agent_name_hint: 'Aether Studio', ext_agent_host_id: hostID, response_type: 'code', redirect_uri: redirect, scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct', resource: RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') });
  emit({ type: 'login', url: AUTH + '/api/accounts/authorize?' + params, acceptsCode: true, instruction: 'Complete sign-in in your browser. If Studio is on another computer and the final localhost page cannot open, paste that full callback URL here.' });
  const receive = line => { try { accept(JSON.parse(line).code); } catch { /* Invalid pasted URLs never complete authorization. */ } };
  lines.on('line', receive);
  try {
    const result = await Promise.race([code, new Promise((_, reject) => setTimeout(() => reject(new Error('Sign-in expired. Try again.')), 600000).unref())]);
    await save({...previous,hostID,clientId:result.clientId});
    const tokens = await token({ grant_type: 'authorization_code', code: result.value, client_id: result.clientId, code_verifier: verifier, redirect_uri: redirect });
    if (!tokens.scope?.split(' ').includes('chatgpt.tokens.use.direct')) throw new Error('ChatGPT plan usage was not authorized.');
    const user = await identity(tokens.id_token, result.clientId, nonce, previous?.subject);
    await save({ ...user, hostID, clientId: result.clientId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expires: Date.now() + tokens.expires_in * 1000 });
    emit({ type: 'connected', label: user.label });
  } finally { server.close(); lines.off('line', receive); }
}
async function run() {
  if (action === 'login') return login();
  const account = await access(); const headers = { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' };
  if (action === 'status') { emit({ type: 'connected', label: account.label }); return; }
  const catalog = await (await request(RESOURCE + '/models', { headers })).json();
  const models = (catalog.models || []).filter(m => m.visibility === 'list').map(m => ({ id: m.slug, name: m.display_name }));
  if (action === 'models') { emit({ type: 'models', models }); return; }
  const input = await firstInput;
  const model = input.model || models[0]?.id;
  if (!models.some(m => m.id === model)) throw new Error('Choose a model available to this account.');
  await runResponses(input, body => request(RESOURCE + '/responses', { method: 'POST', headers, body: JSON.stringify({ ...body, model }) }), emit, call => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { lines.off('line', receive); reject(new Error('Editor response expired.')); }, 120000);
    const receive = raw => {
      let value; try { value = JSON.parse(raw); } catch { return; }
      if (value.type !== 'tool_result' || value.id !== call.id) return;
      clearTimeout(timer); lines.off('line', receive); resolve(value.result);
    };
    lines.on('line', receive); emit({ type: 'tool_call', ...call });
  }));
}
/** Stateless Responses loop: retain all output items, including encrypted reasoning. */
export async function runResponses(input, post, publish, execute) {
  const tools = input.tools || [], history = [...input.messages];
  const ids = new Set(); let calls = 0;
  for (let turn = 0; turn <= 48; turn++) {
    const response = await post({ input: history, instructions: input.instructions, stream: true, store: false,
      tools: tools.map(t => ({ type: 'function', name: t.name, description: t.description, parameters: t.inputSchema, strict: false })),
      parallel_tool_calls: false, include: ['reasoning.encrypted_content'] });
    const output = await consumeStream(response, publish);
    history.push(...output);
    const requested = output.filter(item => item.type === 'function_call');
    if (!requested.length) return;
    for (const item of requested) {
      if (++calls > 48 || !tools.some(t => t.name === item.name) || typeof item.call_id !== 'string' || ids.has(item.call_id)) throw new Error('Invalid or excessive editor tool calls.');
      ids.add(item.call_id);
      let result, args;
      try { args = JSON.parse(item.arguments); } catch { /* Return an actionable tool error to the model. */ }
      if (!args || typeof args !== 'object' || Array.isArray(args) || JSON.stringify(args).length > 32768) result = { ok: false, error: 'Tool arguments must be a bounded JSON object.' };
      else result = await execute({ id: item.call_id, name: item.name, arguments: args });
      const { images, ...metadata } = result;
      history.push({ type: 'function_call_output', call_id: item.call_id,
        output: result.ok && images?.length ? [
          { type: 'input_text', text: JSON.stringify(metadata) },
          ...images.map(image => ({ type: 'input_image', image_url: `data:${image.mimeType};base64,${image.data}`, detail: 'auto' })),
        ] : JSON.stringify(metadata) });
    }
  }
  throw new Error('Editor tool limit reached.');
}
export async function consumeStream(response, publish) {
  let buffer = '', complete = false, output = [], bytes = 0;
  const decoder = new TextDecoder();
  function consume(line) {
    line = line.trim();
    if (!line.startsWith('data: ') || line === 'data: [DONE]') return;
    const event = JSON.parse(line.slice(6));
    if (event.type === 'response.output_text.delta') publish({ type: 'delta', text: event.delta });
    if (event.type === 'response.completed') { complete = true; output = event.response?.output || []; }
    if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) throw new Error('The provider did not complete the response. Check account access and usage limits.');
  }
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > 2 * 1024 * 1024) throw new Error('Provider response limit.');
    buffer += decoder.decode(chunk, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      consume(buffer.slice(0, index)); buffer = buffer.slice(index + 1);
    }
  }
  buffer += decoder.decode(); if (buffer.trim()) consume(buffer);
  if (!complete || !Array.isArray(output)) throw new Error('The response was interrupted.');
  return output;
}
export { identity };
if (main) run().then(async () => { await new Promise(resolve => process.stdout.write('{\"type\":\"done\"}\n', resolve)); process.exit(0); }).catch(error => { emit({ type: 'error', message: error.message }); process.exit(1); });
