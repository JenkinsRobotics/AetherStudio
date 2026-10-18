import {afterEach, beforeEach, expect, test, vi} from 'vitest';
import {AgentTurn, type AgentAction} from './AgentTurn';
import type {AgentInteraction, AgentJob, AgentService, AgentToolCall} from './AgentServices';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const tool = {name:'aether_map_surface_create', description:'Create a surface', inputSchema:{type:'object'}};
const action: AgentToolCall = {id:'one', name:tool.name, arguments:{width_px:200}};
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(yes => {resolve = yes;});
  return {promise, resolve};
};
function fixture(implementation: AgentInteraction['execute'] = async () => ({})) {
  const execute = vi.fn(implementation);
  let current = true;
  let job = {id:'chat',state:'running',text:'',tool_call:action,tool_result_format:'images-v1'} as AgentJob;
  const serviceCall = vi.fn(async (kind: string) => kind === 'job' ? job : {});
  const onEnd = vi.fn(), onJob = vi.fn(), onActions = vi.fn<(value: AgentAction[]) => void>();
  const turn = new AgentTurn({id:'chat',service:{call:serviceCall} as AgentService,
    interaction:{contextKey:'show-one',tools:[tool],execute},isCurrent:()=>current,onEnd,onJob,onActions});
  turn.start();
  return {turn, execute, serviceCall, onEnd, onJob, onActions,
    setCurrent: (value: boolean) => {current = value;}, setJob: (value: Partial<AgentJob>) => {job = {...job,...value};},
    states: () => onActions.mock.calls.at(-1)?.[0]};
}
const tick = (ms=400) => vi.advanceTimersByTimeAsync(ms);

test('polls during a slow engine and aborts on lost authority before commit', async () => {
  const work = deferred(); let changed = false;
  const f = fixture(vi.fn(async (_call,signal) => {await work.promise;signal.throwIfAborted();changed=true;return {}; }));
  await tick(1200);
  expect(f.execute).toHaveBeenCalledTimes(1);
  expect(f.serviceCall.mock.calls.filter(([kind]) => kind === 'job')).toHaveLength(3);
  f.serviceCall.mockRejectedValueOnce(new Error('Access revoked.'));
  await tick();
  expect(f.execute.mock.calls[0][1].aborted).toBe(true);
  expect(f.onEnd).toHaveBeenCalledWith('Access revoked.');
  expect(f.states()?.[0].state).toBe('Cancelled');
  work.resolve({}); await tick(2000);
  expect(changed).toBe(false);
  expect(f.serviceCall.mock.calls.some(([kind])=>kind==='tool_result')).toBe(false);
  expect(f.onEnd).toHaveBeenCalledTimes(1);
});

test.each(['cancelled','failed','completed'] as const)('host %s stops an unfinished operation without a late result', async state => {
  const work = deferred();
  const f = fixture(vi.fn(()=>work.promise)); await tick();
  f.setJob({state}); await tick();
  expect(f.execute.mock.calls[0][1].aborted).toBe(true);
  work.resolve({}); await tick(2000);
  expect(f.serviceCall.mock.calls.some(([kind])=>kind==='tool_result')).toBe(false);
  expect(f.onEnd).toHaveBeenCalledTimes(1);
});

test('engine deadline stops the turn and ignores late completion', async () => {
  const work = deferred();
  const f = fixture(vi.fn(()=>work.promise)); await tick(120_400);
  expect(f.onEnd).toHaveBeenCalledWith(expect.stringContaining('exceeded 2 minutes'));
  expect(f.execute.mock.calls[0][1].aborted).toBe(true);
  work.resolve({}); await tick();
  expect(f.serviceCall.mock.calls.some(([kind])=>kind==='tool_result')).toBe(false);
});

test('an unresponsive status request stops local work after 15 seconds', async () => {
  const work = deferred(), status = deferred();
  const f = fixture(vi.fn(()=>work.promise)); await tick();
  f.serviceCall.mockImplementationOnce(()=>status.promise as Promise<never>);
  await tick(15_400);
  expect(f.onEnd).toHaveBeenCalledWith(expect.stringContaining('within 15 seconds'));
  expect(f.execute.mock.calls[0][1].aborted).toBe(true);
  status.resolve({id:'chat',state:'running',tool_call:action}); work.resolve({}); await tick();
  expect(f.execute).toHaveBeenCalledTimes(1);
  expect(f.serviceCall.mock.calls.some(([kind])=>kind==='tool_result')).toBe(false);
});

test('lost acknowledgments retry the same receipt and never the edit', async () => {
  const f = fixture(); await tick();
  f.serviceCall.mockImplementation(async kind => {
    if (kind === 'job') return {id:'chat',state:'running',tool_call:action};
    throw new Error('Acknowledgment lost.');
  });
  await tick(1200);
  expect(f.execute).toHaveBeenCalledTimes(1);
  const receipts = f.serviceCall.mock.calls.filter(([kind])=>kind==='tool_result');
  expect(receipts).toHaveLength(3);
  expect(receipts[0]).toEqual(receipts[1]);
  expect(f.onEnd).toHaveBeenCalledWith(expect.stringContaining('after 3 attempts'));
  expect(f.states()?.[0].state).toBe('Result unconfirmed');
});

test('new host call acknowledges the previous receipt after a lost response', async () => {
  const f = fixture(); await tick();
  f.serviceCall.mockImplementationOnce(async()=>({id:'chat',state:'running',tool_call:action}));
  f.serviceCall.mockRejectedValueOnce(new Error('Acknowledgment lost.'));
  await tick();
  f.setJob({tool_call:{...action,id:'two'}}); await tick();
  expect(f.execute).toHaveBeenCalledTimes(2);
  expect(f.states()?.[0].state).toBe('Done');
  expect(f.states()?.[1].id).toBe('two');
  f.turn.stop();
});

test('reusing a call ID with changed arguments stops without executing again', async () => {
  const f = fixture(); await tick();
  f.setJob({tool_call:{...action,arguments:{width_px:400}}}); await tick();
  expect(f.execute).toHaveBeenCalledTimes(1);
  expect(f.onEnd).toHaveBeenCalledWith(expect.stringContaining('changed while retrying'));
});

test.each([null,{...action,id:'two'}])('withdrawn/replaced in-flight action aborts instead of overlapping', async tool_call => {
  const work = deferred(); const f = fixture(vi.fn(()=>work.promise)); await tick();
  f.setJob({tool_call}); await tick();
  expect(f.execute).toHaveBeenCalledTimes(1);
  expect(f.execute.mock.calls[0][1].aborted).toBe(true);
  expect(f.onEnd).toHaveBeenCalledWith(expect.stringContaining('unfinished action'));
  work.resolve({}); await tick();
});

test('context loss cancels a pending action', async () => {
  const work = deferred(); const f = fixture(vi.fn(()=>work.promise)); await tick();
  f.setCurrent(false); await tick();
  expect(f.execute.mock.calls[0][1].aborted).toBe(true);
  expect(f.onEnd).toHaveBeenCalledWith(expect.stringContaining('workspace changed'));
  work.resolve({}); await tick();
});

test('explicit stop is idempotent and cannot emit late UI updates', async () => {
  const work = deferred(); const f = fixture(vi.fn(()=>work.promise)); await tick();
  f.turn.stop(); const calls=f.onActions.mock.calls.length;
  f.turn.stop(); f.turn.start(); work.resolve({}); await tick(2000);
  expect(f.onActions).toHaveBeenCalledTimes(calls);
  expect(f.onEnd).not.toHaveBeenCalled();
});

test('a different job response cannot invoke tools', async () => {
  const f = fixture(); f.setJob({id:'other'}); await tick();
  expect(f.execute).not.toHaveBeenCalled();
  expect(f.onEnd).toHaveBeenCalledWith(expect.stringContaining('different agent job'));
});

test('images appear only after delivery is confirmed', async () => {
  const image={mimeType:'image/png',width:1,height:1,data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUioAAAAASUVORK5CYII='};
  const f = fixture(vi.fn(async()=>({type:'aether.tool-content',value:{},images:[image]})));
  await tick(); expect(f.states()?.[0].image).toBeUndefined();
  await tick(); expect(f.states()?.[0].image).toEqual(image);
  f.turn.stop();
});
