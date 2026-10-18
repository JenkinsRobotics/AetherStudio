import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { WorkspaceAgent } from './WorkspaceAgent';
import type { AssistantMessage } from './AssistantPanel';
import type { AgentService, AgentInteraction } from './AgentServices';

function harness(call: ReturnType<typeof vi.fn>) {
  const service = { call } as AgentService;
  function Demo() {
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    return <WorkspaceAgent service={service} app="map" contextText="Scene One" messages={messages} onMessages={setMessages}/>;
  }
  return render(<Demo/>);
}
const provider = { id: 'test', name: 'Test provider', enabled: true, runtimeReady: true, account: { connected: true } };

test('offline agent has one disabled composer and directs users to Plugins', async () => {
  await act(async () => { harness(vi.fn().mockResolvedValue({ plugins: [] })); });
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
  expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('link', { name: 'Plugins' }).getAttribute('href')).toBe('/?plugins');
});

const editTool = {name: 'aether_sketch_draw', description: 'Draw a rectangle', inputSchema: {type: 'object', properties: {}}};
function editingFixture(execute: AgentInteraction['execute'], options: {retry?: boolean; unknown?: boolean; images?: boolean} = {}) {
  let receipts = 0;
  const call = vi.fn(async (action, data) => {
    if (action === 'catalog') return {plugins: [provider]};
    if (action === 'models') return {id: 'models', state: 'running'};
    if (action === 'job' && data.id === 'models') return {state: 'completed', models: []};
    if (action === 'chat') return {id: 'chat', state: 'running'};
    if (action === 'tool_result') { receipts++; if (options.retry && receipts === 1) throw Error('Lost acknowledgment'); return {}; }
    if (action === 'job') return {tool_result_format: options.images ? 'images-v1' : undefined, id: 'chat', state: receipts >= (options.retry ? 2 : 1) ? 'completed' : 'running', text: '',
      tool_call: {id: 'one', name: options.unknown ? 'unadvertised' : editTool.name, arguments: {width: 20}}};
    return {};
  });
  const service = {call} as AgentService;
  function Demo({scope = 'drawing-one', host = service, app = 'sketch'}: {scope?: string; host?: AgentService; app?: string}) {
    const [messages, onMessages] = useState<AssistantMessage[]>([]);
    return <WorkspaceAgent service={host} app={app} contextText="Drawing" messages={messages} onMessages={onMessages}
      interaction={{contextKey: scope, tools: [editTool], execute}}/>;
  }
  return {call, Demo};
}
async function sendEdit() {
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false));
  await act(async()=>{fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Draw a rectangle'}});
  fireEvent.click(screen.getByRole('button', {name: 'Send'}));});
}
test('editor action executes once across a lost receipt and returns the actual result', async () => {
  const execute = vi.fn(async () => ({shape_id: 'rectangle-one'}));
  const {call, Demo} = editingFixture(execute, {retry: true});
  render(<Demo/>); await sendEdit();
  await waitFor(() => expect(call.mock.calls.filter(c => c[0] === 'tool_result')).toHaveLength(2), {timeout: 2500});
  expect(execute).toHaveBeenCalledTimes(1);
  expect(call).toHaveBeenCalledWith('tool_result', {id: 'chat', call_id: 'one', result: {ok: true, value: {shape_id: 'rectangle-one'}}});
  expect(screen.getByText(/sketch draw · Done/)).toBeTruthy();
});
test('unknown tools return a failure without calling the product', async () => {
  const execute = vi.fn(async () => ({}));
  const {call, Demo} = editingFixture(execute, {unknown: true});
  render(<Demo/>); await sendEdit();
  await waitFor(() => expect(call).toHaveBeenCalledWith('tool_result', expect.objectContaining({result: {ok: false, error: 'This editor tool is not available.'}})));
  expect(execute).not.toHaveBeenCalled();
});
test('switching documents aborts an in-flight editor operation', async () => {
  let finish!: () => void;
  const execute = vi.fn((_call, signal: AbortSignal) => new Promise(resolve => { finish = () => resolve({changed: !signal.aborted}); }));
  const {call, Demo} = editingFixture(execute);
  const view = render(<Demo/>); await sendEdit();
  await waitFor(() => expect(execute).toHaveBeenCalledOnce());
  view.rerender(<Demo scope="drawing-two"/>);
  expect(execute.mock.calls[0][1].aborted).toBe(true);
  await act(async () => { finish(); });
  await waitFor(() => expect(call).toHaveBeenCalledWith('cancel', {id: 'chat'}));
  expect(call.mock.calls.some(c => c[0] === 'tool_result')).toBe(false);
});

test('switching hosts cancels through the old service even with the same document key', async () => {
  let finish!: () => void;
  const execute = vi.fn((_call, _signal: AbortSignal) => new Promise(resolve => {finish=()=>resolve({});}));
  const {call, Demo} = editingFixture(execute);
  const view=render(<Demo/>); await sendEdit();
  await waitFor(()=>expect(execute).toHaveBeenCalledOnce());
  const otherCall=vi.fn(async (action:string)=>action==='catalog'?{plugins:[]}:{});
  view.rerender(<Demo host={{call:otherCall} as AgentService}/>);
  expect(execute.mock.calls[0][1].aborted).toBe(true);
  await waitFor(()=>expect(call).toHaveBeenCalledWith('cancel',{id:'chat'}));
  expect(otherCall).not.toHaveBeenCalledWith('cancel',{id:'chat'});
  await act(async()=>{finish();});
  expect(call.mock.calls.some(c=>c[0]==='tool_result')).toBe(false);
  expect(otherCall.mock.calls.some(c=>c[0]==='tool_result')).toBe(false);
});

test('switching applications cancels a turn whose document key happens to match', async () => {
  let finish!: () => void;
  const execute=vi.fn((_call,_signal:AbortSignal)=>new Promise(resolve=>{finish=()=>resolve({});}));
  const {call,Demo}=editingFixture(execute);
  const view=render(<Demo/>);await sendEdit();
  await waitFor(()=>expect(execute).toHaveBeenCalledOnce());
  view.rerender(<Demo app="map"/>);
  expect(execute.mock.calls[0][1].aborted).toBe(true);
  await act(async()=>{finish();});
  expect(call.mock.calls.some(c=>c[0]==='tool_result')).toBe(false);
  expect(screen.queryByText(/sketch draw · Done/)).toBeNull();
});

test('leaving a cached page releases the composer and drops late editor completion', async () => {
  let finish!: () => void;
  const execute=vi.fn((_call,_signal:AbortSignal)=>new Promise(resolve=>{finish=()=>resolve({});}));
  const {call,Demo}=editingFixture(execute);
  render(<Demo/>); await sendEdit();
  await waitFor(()=>expect(execute).toHaveBeenCalledOnce());
  fireEvent(window,new Event('pagehide'));
  expect(execute.mock.calls[0][1].aborted).toBe(true);
  expect(screen.getByRole('button',{name:'Send'})).toBeTruthy();
  await act(async()=>{finish();});
  expect(call.mock.calls.some(c=>c[0]==='tool_result')).toBe(false);
});

test('streamed replies use the shared composer, product context, and cancellation', async () => {
  let chat = false;
  const call = vi.fn(async (action, data) => {
    if (action === 'catalog') return { plugins: [provider] };
    if (action === 'models') return { id: 'models', state: 'running' };
    if (action === 'job' && data.id === 'models') return { state: 'completed', models: [{ id: 'm', name: 'Model One' }] };
    if (action === 'chat') { chat = true; return { id: 'chat', state: 'running' }; }
    if (action === 'job' && chat) return { id: 'chat', state: 'running', text: 'A partial answer' };
    return { id: data.id, state: 'cancelled' };
  });
  const view = harness(call);
  await waitFor(() => expect(screen.getByRole('option', { name: 'Model One' })).toBeTruthy());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help with this scene' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByText('A partial answer')).toBeTruthy());
  expect(call).toHaveBeenCalledWith('chat', expect.objectContaining({ app: 'map', context: 'Scene One', messages: [{ role: 'user', content: 'Help with this scene' }] }));
  fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
  await waitFor(() => expect(call).toHaveBeenCalledWith('cancel', { id: 'chat' }));
  view.unmount();
});

test('closing before chat startup completes cancels the arriving request', async () => {
  let complete!: (value: unknown) => void;
  const call = vi.fn(async (action, data) => {
    if (action === 'catalog') return { plugins: [provider] };
    if (action === 'models') return { id: 'models', state: 'running' };
    if (action === 'job') return { state: 'completed', models: [] };
    if (action === 'chat') return new Promise(resolve => { complete = resolve; });
    return { id: data.id, state: 'cancelled' };
  });
  const view = harness(call);
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  await act(async () => { view.unmount(); complete({ id: 'late', state: 'running' }); });
  await waitFor(() => expect(call).toHaveBeenCalledWith('cancel', { id: 'late' }));
});

test('Stop releases the composer even when cancellation fails', async () => {
  const call = vi.fn(async (action, data) => {
    if (action === 'catalog') return { plugins: [provider] };
    if (action === 'models') return { id: 'models', state: 'running' };
    if (action === 'job' && data.id === 'models') return { state: 'completed', models: [] };
    if (action === 'chat') return { id: 'chat', state: 'running' };
    if (action === 'cancel') throw new Error('Connection lost while cancelling.');
    return { id: 'chat', state: 'running', text: '' };
  });
  harness(call);
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(call).toHaveBeenCalledWith('chat', expect.anything()));
  fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy());
  expect(screen.getByText('Connection lost while cancelling.')).toBeTruthy();
});

test('a stopped startup cannot release or overwrite the next response', async () => {
  const starts: Array<(value: unknown) => void> = [];
  const call = vi.fn(async (action, data) => {
    if (action === 'catalog') return { plugins: [provider] };
    if (action === 'models') return { id: 'models', state: 'running' };
    if (action === 'job' && data.id === 'models') return { state: 'completed', models: [] };
    if (action === 'chat') return new Promise(resolve => starts.push(resolve));
    if (action === 'cancel') throw new Error('Old request cancellation failed');
    return { id: data.id, state: 'running', text: '' };
  });
  harness(call);
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false));
  const send = (text: string) => {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  };
  send('First');
  await waitFor(() => expect(starts).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
  send('Second');
  await waitFor(() => expect(starts).toHaveLength(2));
  await act(async () => { starts[0]({ id: 'old', state: 'running' }); });
  expect(screen.getByRole('button', { name: 'Stop response' })).toBeTruthy();
  expect(screen.queryByText('Old request cancellation failed')).toBeNull();
  await act(async () => { starts[1]({ id: 'new', state: 'running' }); });
  expect(screen.getByRole('button', { name: 'Stop response' })).toBeTruthy();
  expect(call).toHaveBeenCalledWith('cancel', { id: 'old' });
});

test('image receipt is delivered once across retries, without putting pixels in chat text', async () => {
  const image = {mimeType: 'image/png',width:1,height:1,data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUioAAAAASUVORK5CYII='};
  const execute = vi.fn(async () => ({type:'aether.tool-content',value:{kind:'drawing'},images:[image]}));
  const {call, Demo} = editingFixture(execute, {retry:true,images:true});
  render(<Demo/>); await sendEdit();
  await waitFor(() => expect(call.mock.calls.filter(c=>c[0]==='tool_result')).toHaveLength(2), {timeout:2500});
  expect(execute).toHaveBeenCalledTimes(1);
  expect(call).toHaveBeenCalledWith('tool_result', {id:'chat',call_id:'one',result:{ok:true,value:{kind:'drawing'},images:[image]}});
  expect(document.body.textContent).not.toContain(image.data);
});
