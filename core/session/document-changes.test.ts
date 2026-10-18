// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { subscribeDocumentChanges } from "./document-changes";
class Source extends EventTarget {
  static all: Source[] = [];
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { super(); Source.all.push(this); }
  state(id = "file", token = "a", writable = true) {
    this.dispatchEvent(new MessageEvent("state", {data: JSON.stringify({schema:1,document_id:id,state_token:`state-${token.repeat(64)}`,main_revision:1,latest_revision:2,collaboration_revision:0,writable})}));
  }
}
let stop: (() => void)[];
beforeEach(() => {
  stop = []; Source.all = []; vi.useFakeTimers();
  vi.stubGlobal("EventSource", Source);
  vi.stubGlobal("fetch", vi.fn(async () => ({ok:true,json:async()=>({capabilities:{document_changes:1}})})));
});
afterEach(() => { stop.forEach(fn=>fn()); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function start(listener = vi.fn(), app="map", id="file") {
  const dispose = subscribeDocumentChanges(app,id,listener); stop.push(dispose);
  await vi.advanceTimersByTimeAsync(0);
  return {listener,dispose};
}
test("shared document connections notify panels once per state and release only after the last subscriber", async () => {
  const a=await start(), b=await start();
  expect(Source.all).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(1);
  const source=Source.all[0]; source.state(); source.state();
  expect(a.listener).toHaveBeenCalledTimes(1); expect(b.listener).toHaveBeenCalledWith({kind:"state",writable:true});
  a.dispose(); source.state("file","b",false);
  expect(a.listener).toHaveBeenCalledTimes(1); expect(b.listener).toHaveBeenLastCalledWith({kind:"state",writable:false});
  expect(source.close).not.toHaveBeenCalled(); b.dispose(); expect(source.close).toHaveBeenCalledOnce();
});
test("reconnect renegotiates capability and invalidates even when its initial token is unchanged", async () => {
  const {listener}=await start(); const old=Source.all[0]; old.state(); old.onerror!();
  expect(listener).toHaveBeenLastCalledWith({kind:"unavailable"}); expect(old.close).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(999); expect(Source.all).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1); expect(Source.all).toHaveLength(2);
  old.state("file","b"); expect(listener).toHaveBeenCalledTimes(2);
  Source.all[1].state(); expect(listener).toHaveBeenCalledTimes(3);
  expect(fetch).toHaveBeenCalledTimes(2);
});
test("legacy and unsupported hosts keep polling without opening a stream", async () => {
  vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({capabilities:{}})} as Response);
  const {listener}=await start(); expect(Source.all).toHaveLength(0);
  expect(listener).toHaveBeenCalledWith({kind:"fallback"});
});
test("wrong-document, malformed and future-schema snapshots never refresh a panel", async () => {
  const {listener}=await start(); Source.all[0].state("different");
  expect(listener).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenLastCalledWith({kind:"unavailable"});
  await vi.advanceTimersByTimeAsync(1000);
  Source.all[1].dispatchEvent(new MessageEvent("state",{data:'{"schema":2}'}));
  expect(listener).toHaveBeenLastCalledWith({kind:"unavailable"});
  await vi.advanceTimersByTimeAsync(2000);
  Source.all[2].dispatchEvent(new MessageEvent("state",{data:'invalid'}));
  expect(listener.mock.calls.every(c=>c[0].kind==="unavailable")).toBe(true);
});
test("unmount cancels retries and late capability responses cannot create a connection", async () => {
  let resolve!: (v:Response)=>void;
  vi.mocked(fetch).mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const {listener,dispose}=await start(); dispose();
  resolve({ok:true,json:async()=>({capabilities:{document_changes:1}})} as Response);
  await vi.advanceTimersByTimeAsync(60000);
  expect(Source.all).toHaveLength(0); expect(listener).not.toHaveBeenCalled();
});
test("offline retries back off and subscriptions stay isolated by app and document", async () => {
  const a=await start(), b=await start(vi.fn(),"cad","other");
  Source.all[0].state(); expect(a.listener).toHaveBeenCalledOnce(); expect(b.listener).not.toHaveBeenCalled();
  Source.all[1].dispatchEvent(new Event("unavailable"));
  await vi.advanceTimersByTimeAsync(1000); Source.all[2].onerror!();
  await vi.advanceTimersByTimeAsync(1999); expect(Source.all).toHaveLength(3);
  await vi.advanceTimersByTimeAsync(1); expect(Source.all).toHaveLength(4);
  b.dispose(); await vi.advanceTimersByTimeAsync(60000); expect(Source.all).toHaveLength(4);
  expect(a.listener).toHaveBeenCalledOnce();
});

test("browser offline closes a lingering stream and online resumes without waiting for backoff", async () => {
  const {listener,dispose}=await start(); const first=Source.all[0]; first.state();
  window.dispatchEvent(new Event("offline"));
  expect(first.close).toHaveBeenCalledOnce(); expect(listener).toHaveBeenLastCalledWith({kind:"unavailable"});
  window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(0);
  expect(Source.all).toHaveLength(2); Source.all[1].state();
  expect(listener).toHaveBeenLastCalledWith({kind:"state",writable:true});
  dispose();window.dispatchEvent(new Event("online"));await vi.advanceTimersByTimeAsync(30000);
  expect(Source.all).toHaveLength(2);
});

test("account replacement closes the old session stream before accepting any further state", async () => {
  vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({user:{id:"alice"},capabilities:{document_changes:1}})} as Response);
  const {listener}=await start(); const first=Source.all[0];first.state();
  document.dispatchEvent(new CustomEvent("aether-account",{detail:{id:"alice"}}));expect(first.close).not.toHaveBeenCalled();
  document.dispatchEvent(new CustomEvent("aether-account",{detail:{id:"bob"}}));expect(first.close).toHaveBeenCalledOnce();
  expect(listener).toHaveBeenLastCalledWith({kind:"unavailable"});
  first.state("file","b");expect(listener).toHaveBeenCalledTimes(2);
});
