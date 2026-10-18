// Native Studio's provider adapters. Rust owns authorization and process lifetime.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, isAbsolute, extname } from 'node:path';
import { createInterface } from 'node:readline';

export const emit = value => process.stdout.write(JSON.stringify(value) + '\n');
let lines, pendingTool;
export const input = () => new Promise((resolve, reject) => {
  lines = createInterface({ input: process.stdin });
  lines.once('line', line => {
    try { resolve(JSON.parse(line)); } catch { reject(new Error('Invalid input')); }
  });
  lines.on('line', line => {
    if (!pendingTool) return;
    try {
      const value = JSON.parse(line);
      if (value.type !== 'tool_result' || value.id !== pendingTool.id) return;
      pendingTool.resolve(value.result); pendingTool = null;
    } catch { pendingTool.reject(new Error('Invalid tool result')); pendingTool = null; }
  });
});
export function requestTool(call) {
  if (!lines || pendingTool) return Promise.reject(new Error('Editor tool already running'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pendingTool = null; reject(new Error('Editor response expired')); }, 120000);
    pendingTool = { id: call.id, resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } };
    emit({ type: 'tool_call', ...call });
  });
}
export async function environment(directory, provider) {
  if (!isAbsolute(directory)) throw new Error('Private absolute directory required');
  const work = join(directory, 'workspace');
  await mkdir(work, { recursive: true, mode: 0o700 });
  return { work, env: {
    HOME: directory, TMPDIR: directory, LANG: 'en_US.UTF-8',
    ...(provider === 'claude' ? { CLAUDE_CONFIG_DIR: directory } : {
      GEMINI_CLI_HOME: directory, GEMINI_FORCE_FILE_STORAGE: 'true',
    }),
  } };
}
export function loginScanner(hosts) {
  let buffer = ''; const seen = new Set();
  return chunk => {
    buffer = (buffer + chunk).slice(-16000);
    for (const match of buffer.matchAll(/https:\/\/[^\s\x1b]+(?=[\s\x1b])/g)) {
      const candidate = match[0];
      let url; try { url = new URL(candidate); } catch { continue; }
      if (!hosts.includes(url.hostname) || url.username || url.password || url.port || seen.has(candidate)) continue;
      if (seen.size >= 16) throw new Error('Excessive authorization prompts');
      seen.add(candidate); emit({ type: 'login', url: candidate, acceptsCode: false });
    }
  };
}
export function launch(cli, args, options) {
  if (!isAbsolute(cli)) throw new Error('Operator CLI entrypoint required');
  // Official CLIs may ship JavaScript or a platform-native executable. Both
  // paths are operator-owned; never resolve a browser command through a shell.
  const javascript = ['.js', '.mjs', '.cjs'].includes(extname(cli));
  return spawn(javascript ? process.execPath : cli, javascript ? [cli, ...args] : args, {
    cwd: options.work, env: options.env, stdio: ['pipe', 'pipe', 'pipe'],
  });
}
// Provider output is untrusted. Bound both individual records and total bytes,
// including stderr, before passing any text to the native event boundary.
export function observe(child, { line, text, stderr, end, maxRecordBytes = 65536, maxOutputBytes = 2 * 1024 * 1024 } = {}) {
  let pending = '', bytes = 0, stopped = false;
  const failed = error => { if (!stopped) { stopped = true; child.kill(); end?.(error); } };
  function data(chunk, isError) {
    if (stopped) return;
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxOutputBytes) return failed(new Error('Provider output limit'));
    try {
      if (isError) { stderr?.(chunk); return; }
      text?.(chunk);
      if (!line) return;
      pending += chunk;
      for (;;) {
        const newline = pending.indexOf('\n');
        if (newline < 0) break;
        if (Buffer.byteLength(pending.slice(0, newline)) > maxRecordBytes) throw new Error('Provider record limit');
        const record = pending.slice(0, newline); pending = pending.slice(newline + 1);
        if (record.trim()) line(record);
      }
      if (Buffer.byteLength(pending) > maxRecordBytes) throw new Error('Provider record limit');
    } catch (error) { failed(error); }
  }
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => data(chunk, false));
  child.stderr.on('data', chunk => data(chunk, true));
  child.stdin.on('error', failed); child.on('error', failed);
  child.on('close', code => {
    if (stopped) return;
    stopped = true;
    try { if (line && pending.trim()) line(pending); end?.(code === 0 ? null : new Error('Provider exited')); }
    catch (error) { end?.(error); }
  });
  return failed;
}
export function command(cli, args, options, { body, line, text, stderr, maxRecordBytes, maxOutputBytes } = {}) {
  return new Promise((resolve, reject) => {
    const child = launch(cli, args, options);
    observe(child, { line, text, stderr, maxRecordBytes, maxOutputBytes, end: error => error ? reject(error) : resolve() });
    child.stdin.end(body);
  });
}
export async function main(run) {
  try {
    await run();
    // Waiting for the final write also drains earlier deltas. process.exit()
    // immediately after write() can otherwise truncate a response on a pipe.
    await new Promise((resolve, reject) => process.stdout.write('{"type":"done"}\n', error => error ? reject(error) : resolve()));
    process.exit(0);
  }
  catch { process.exit(1); } // Never expose raw credential-bearing diagnostics.
}
