import {afterEach, describe, expect, it, vi} from 'vitest';
import {LiveEditorConnection, type EditorTransport} from './live-editor';
import type {AgentInteraction} from '@aether/ui/AgentServices';
const tool={name:'aether_cad_inspect',description:'Inspect',inputSchema:{type:'object',properties:{}}};
const call={id:'one',name:tool.name,arguments:{}};
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
afterEach(()=>vi.useRealTimers());
function fixture(){
 vi.useFakeTimers();let pending:any={call};
 const transport=vi.fn<EditorTransport>(async(action)=>action==='register'?{editor:'editor',secret:'secret'}:action==='poll'?pending:{received:true});
 const interaction:AgentInteraction={contextKey:'part:1',tools:[tool],execute:vi.fn(async()=>({changed:true}))};
 const status=vi.fn();const connection=new LiveEditorConnection(transport as EditorTransport,()=>interaction,status);
 return {transport,interaction,status,connection,reply:(value:any)=>pending=value};
}
describe('external live editor delivery',()=>{
 it('uses product commands; duplicate deliveries never execute twice',async()=>{
  const f=fixture();await f.connection.start('cad','doc');await flush();
  expect(f.interaction.execute).toHaveBeenCalledTimes(1);
  expect(f.transport).toHaveBeenCalledWith('reply',expect.objectContaining({operation:'one',result:{ok:true,value:{changed:true}}}));
  await vi.advanceTimersByTimeAsync(1000);expect(f.interaction.execute).toHaveBeenCalledTimes(1);
  expect(f.status).toHaveBeenLastCalledWith('error',expect.stringContaining('Duplicate'));
 });
 it('checks authority during asynchronous operations and aborts on revocation',async()=>{
  const f=fixture();let signal:AbortSignal|undefined;
  f.interaction.execute=vi.fn(async(_call,s)=>{signal=s;return new Promise(()=>{});});
  await f.connection.start('cad','doc');await flush();f.transport.mockImplementation(async()=>{throw Error('Access revoked');});
  await vi.advanceTimersByTimeAsync(1000);expect(signal?.aborted).toBe(true);
  expect(f.status).toHaveBeenLastCalledWith('error',expect.stringContaining('unknown'));
 });
 it('lost result acknowledgement does not reexecute',async()=>{
  const f=fixture(),base=f.transport.getMockImplementation()!;
  f.transport.mockImplementation(async(action,data)=>{if(action==='reply')throw Error('offline');return base(action,data);});
  await f.connection.start('cad','doc');await flush();await vi.advanceTimersByTimeAsync(3000);
  expect(f.interaction.execute).toHaveBeenCalledTimes(1);expect(f.status).toHaveBeenLastCalledWith('error',expect.stringContaining('delivery failed'));
 });
 it('document switches abort work',async()=>{
  const f=fixture();let signal:AbortSignal|undefined;
  f.interaction.execute=vi.fn(async(_call,s)=>{signal=s;return new Promise(()=>{});});
  await f.connection.start('cad','doc');await flush();f.interaction.contextKey='another';
  await vi.advanceTimersByTimeAsync(1000);expect(signal?.aborted).toBe(true);
  expect(f.transport).toHaveBeenCalledWith('close',{editor:'editor',secret:'secret'});
 });
 it('cancels a registration arriving after stop',async()=>{
  const f=fixture();let resolve!:(v:any)=>void;
  f.transport.mockImplementation(async(action)=>action==='register'?new Promise(r=>resolve=r):{});
  const opening=f.connection.start('cad','doc');f.connection.stop();resolve({editor:'late',secret:'s'});await opening;
  expect(f.transport).toHaveBeenCalledWith('close',{editor:'late',secret:'s'});expect(f.interaction.execute).not.toHaveBeenCalled();
 });
 it('forwards product refusal without inventing a successful mutation',async()=>{
  const f=fixture();f.interaction.execute=vi.fn(async()=>{throw Error('Finish sketch first');});
  await f.connection.start('cad','doc');await flush();
  expect(f.transport).toHaveBeenCalledWith('reply',expect.objectContaining({result:{ok:false,error:'Finish sketch first'}}));f.connection.stop();
 });
});
