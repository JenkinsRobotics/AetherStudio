// @vitest-environment jsdom
import {afterEach, expect, test, vi} from "vitest";
import {act, cleanup, renderHook} from "@testing-library/react";
import {useDocumentMutation} from "./useDocumentMutation";
import type {DocumentConnection} from "./DocumentServices";
afterEach(cleanup);
const unknown = () => Object.assign(new Error("Reply lost"), {detail:{code:"outcome_unknown"}});
function connection(): DocumentConnection {
  return {key:"map:first:Main",name:"First",flush:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),call:vi.fn()};
}
test("collaboration retry retains original draft and revision, even after later edits",async()=>{
  const c=connection(), recovered=vi.fn(async()=>{});
  vi.mocked(c.call).mockRejectedValueOnce(unknown()).mockResolvedValueOnce({revision:5,replayed:true});
  const {result}=renderHook(()=>useDocumentMutation(c,recovered,true));
  const data={expected_revision:4,value:{text:"original"}};
  await act(async()=>{await expect(result.current.send("collaboration_mutate",data)).rejects.toThrow("Reply lost");});
  expect(result.current.canRetry).toBe(true);
  data.expected_revision=6;data.value.text="edited";
  await act(async()=>{await expect(result.current.send("collaboration_mutate",data)).rejects.toThrow("Resolve the previous change");await result.current.retry();});
  expect(vi.mocked(c.call).mock.calls[1]).toEqual(vi.mocked(c.call).mock.calls[0]);
  expect(vi.mocked(c.call).mock.calls[1][1]).toMatchObject({expected_revision:4,value:{text:"original"},operation_id:expect.any(String)});
  expect(recovered).toHaveBeenCalledWith("collaboration_mutate",{revision:5,replayed:true});
  expect(result.current.uncertain).toBe(false);
});
test("unknown legacy writes are retained but never replayed without a server guarantee",async()=>{
  const c=connection();vi.mocked(c.call).mockRejectedValue(unknown());
  const {result}=renderHook(()=>useDocumentMutation(c,async()=>{}));
  await act(async()=>{await expect(result.current.send("version",{})).rejects.toThrow();});
  expect(result.current.uncertain).toBe(true);expect(result.current.canRetry).toBe(false);
  await act(async()=>{await result.current.retry();});expect(c.call).toHaveBeenCalledTimes(1);
});
test("a rejected retry releases the pending change without reporting success",async()=>{
  const c=connection(), recovered=vi.fn(async()=>{});
  vi.mocked(c.call).mockRejectedValueOnce(unknown()).mockRejectedValueOnce(new Error("Access removed"));
  const {result}=renderHook(()=>useDocumentMutation(c,recovered,true));
  await act(async()=>{await expect(result.current.send("version",{})).rejects.toThrow();});
  await act(async()=>{await expect(result.current.retry()).rejects.toThrow("Access removed");});
  expect(result.current.uncertain).toBe(false);expect(recovered).not.toHaveBeenCalled();
});
test("late unknown outcomes from an old document cannot be retried on a new document",async()=>{
  const c=connection();let reject!: (error:Error)=>void;
  vi.mocked(c.call).mockImplementation(()=>new Promise((_resolve,no)=>{reject=no;}));
  const {result,rerender}=renderHook(({key})=>useDocumentMutation({...c,key},async()=>{},true),{initialProps:{key:"first"}});
  let request!:Promise<unknown>;
  act(()=>{request=result.current.send("version",{}).catch(e=>e);});
  rerender({key:"second"});
  await act(async()=>{reject(unknown());await request;});
  expect(result.current.uncertain).toBe(false);
  await act(async()=>{await result.current.retry();});expect(c.call).toHaveBeenCalledTimes(1);
});
