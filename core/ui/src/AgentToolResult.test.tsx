import { expect, test } from 'vitest';
import { agentToolContent, agentToolReply } from './AgentToolResult';
import type { AgentImage } from './AgentServices';
const image: AgentImage = { mimeType: 'image/png', width: 1, height: 1,
  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUioAAAAASUVORK5CYII=' };
test('JSON receipts are backward compatible and images are separate from metadata', () => {
  expect(agentToolReply({ count: 2 }, false, 0)).toEqual({ ok: true, value: { count: 2 } });
  expect(agentToolReply(undefined, false, 0)).toEqual({ ok: true, value: null });
  expect(agentToolReply(agentToolContent({kind:'drawing'}, image), true, 0)).toEqual({ ok: true, value: {kind:'drawing'}, images:[image] });
});
test('rejects unqualified hosts and exhausted image budgets', () => {
  expect(() => agentToolReply(agentToolContent({}, image), false, 0)).toThrow('does not support');
  expect(() => agentToolReply(agentToolContent({}, image), true, 8)).toThrow('Preview limit');
});
test('rejects remote/SVG/spoofed/oversized preview envelopes', () => {
  for (const patch of [{width: 2}, {height: 0}, {width: 1025}, {data:'https://example.test/image.png'},
    {data:image.data.slice(0,-8)}, {data:'a'.repeat(350000)}, {mimeType:'image/svg+xml'}]) {
    expect(() => agentToolReply(agentToolContent({}, {...image,...patch} as AgentImage), true, 0)).toThrow();
  }
  expect(() => agentToolReply(agentToolContent('x'.repeat(33000), image), true, 0)).toThrow('too large');
});
