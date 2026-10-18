// Official Claude CLI, isolated subscription login and workspace conversations and explicitly supplied editor tools.
import { command, emit, environment, input, loginScanner, main } from './protocol.mjs';
import { editorTools } from './editor-tools.mjs';
const [action, directory, cli] = process.argv.slice(2);
await main(async () => {
  if (action !== 'chat') process.stdin.resume(); // Observe the host lifetime pipe.
  const options = await environment(directory, 'claude');
  if (action === 'login') {
    const scan = loginScanner(['claude.ai', 'platform.claude.com', 'console.anthropic.com']);
    await command(cli, ['auth', 'login', '--claudeai'], options, { text: scan, stderr: scan });
  }
  if (['login', 'models'].includes(action)) {
    let output = '';
    await command(cli, ['auth', 'status'], options, { text: chunk => {
      output += chunk; if (output.length > 65536) throw new Error('Account output limit');
    } });
    const account = JSON.parse(output);
    if (!account.loggedIn || !['claude.ai', 'oauth'].includes(account.authMethod)) throw new Error('Subscription sign-in required');
    if (action === 'login') emit({ type: 'connected', label: account.email || 'Claude account' });
    else emit({ type: 'models', models: [
      { id: '', name: 'Account default' }, { id: 'sonnet', name: 'Sonnet' },
      { id: 'opus', name: 'Opus' }, { id: 'haiku', name: 'Haiku' },
    ] });
    return;
  }
  if (action !== 'chat') throw new Error('Unknown action');
  const payload = await input();
  const bridge = await editorTools(payload.tools);
  const mcp = bridge ? { aether: { command: bridge.command, args: bridge.args, env: bridge.env } } : {};
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--tools', '', '--strict-mcp-config', '--mcp-config', JSON.stringify({ mcpServers: mcp }),
    '--setting-sources', '', '--no-session-persistence', '--system-prompt', payload.instructions];
  if (bridge) args.push('--allowedTools', ...payload.tools.map(tool => 'mcp__aether__' + tool.name));
  if (payload.model) args.push('--model', payload.model);
  let complete = false, streamed = false;
  try { await command(cli, args, options, { ...(bridge ? { maxRecordBytes: 512 * 1024, maxOutputBytes: 6 * 1024 * 1024 } : {}), body: JSON.stringify(payload.messages) + '\n', line: raw => {
    const event = JSON.parse(raw);
    if (event.type === 'stream_event' && event.event?.delta?.type === 'text_delta') {
      emit({ type: 'delta', text: event.event.delta.text }); streamed = true;
    }
    if (event.type === 'result') {
      complete = event.is_error !== true && event.subtype === 'success';
      if (complete && !streamed) emit({ type: 'delta', text: event.result || '' });
    }
  } });
  if (!complete) throw new Error('Incomplete response');
  } finally { bridge?.close(); }
});
