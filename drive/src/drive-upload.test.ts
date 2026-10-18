import { beforeEach, expect, test, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("@aether/session/library/drive-api", () => ({
  driveRequest: request,
  encodeFile: async (file: File) => btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer()))),
}));
import { uploadToDrive } from "./drive-upload";
const destination = { organization: "default" };
const run = (file: File) => uploadToDrive(file, destination, file.name, () => {}, () => false);
beforeEach(() => {request.mockReset();});
test("lost begin reply reuses the reservation key", async () => {
  const file=new File(["abc"],"lost-begin",{lastModified:1});
  let operation="";
  request.mockImplementation(async(action,data)=>{
    if(action==="upload_begin") { if(!operation) {operation=data.operation_id;throw new Error("reply lost");} expect(data.operation_id).toBe(operation);return {id:"u1",offset:0}; }
    if(action==="upload_chunk") return {offset:3};
    return {id:"file",revision:1};
  });
  await expect(run(file)).rejects.toThrow("reply lost");
  await expect(run(file)).resolves.toMatchObject({id:"file",revision:1});
});
test("lost completion reply resumes and does not send committed chunks twice", async () => {
  const file=new File(["abc"],"lost-finish",{lastModified:1});let finishes=0;
  request.mockImplementation(async action=>{
    if(action==="upload_begin") return {id:"u2",offset:0};
    if(action==="upload_chunk") return {offset:3};
    if(action==="upload_status") return {offset:3,size:3,chunks:[{size:3,digest:"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}]};
    if(!finishes++) throw new Error("reply lost");return {id:"same-file",revision:1};
  });
  await expect(run(file)).rejects.toThrow("reply lost");
  await expect(run(file)).resolves.toMatchObject({id:"same-file",revision:1});
  expect(request.mock.calls.filter(([a])=>a==="upload_begin")).toHaveLength(1);
  expect(request.mock.calls.filter(([a])=>a==="upload_chunk")).toHaveLength(1);
});
test("network failure checking a reservation never begins a replacement upload", async () => {
  const file=new File(["abc"],"status-failure",{lastModified:1});
  request.mockImplementation(async action=>{if(action==="upload_begin")return {id:"u3",offset:0};throw new Error("offline");});
  await expect(run(file)).rejects.toThrow("offline");
  await expect(run(file)).rejects.toThrow("offline");
  expect(request.mock.calls.filter(([a])=>a==="upload_begin")).toHaveLength(1);
});
test("same name, size and timestamp cannot resume with different bytes", async () => {
  const file=new File(["abc"],"changed-file",{lastModified:1});
  request.mockImplementation(async action=>{
    if(action==="upload_begin")return {id:"u4",offset:0};
    if(action==="upload_chunk")return {offset:3};
    if(action==="upload_status")return {offset:3,size:3,chunks:[{size:3,digest:"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}]};
    throw new Error("offline");
  });
  await expect(run(file)).rejects.toThrow("offline");
  await expect(run(new File(["bad"],"changed-file",{lastModified:1}))).rejects.toThrow("differs");
  expect(request.mock.calls.filter(([a])=>a==="upload_finish")).toHaveLength(1);
});
test("cancellation also stops an empty upload before publication",async()=>{
  request.mockImplementation(async action=>action==="upload_begin"?{id:"u5",offset:0}:{ok:true});
  await expect(uploadToDrive(new File([],"empty-cancel"),destination,"empty",()=>{},()=>true)).rejects.toThrow("cancelled");
  expect(request.mock.calls.map(([a])=>a)).toEqual(["upload_begin","upload_cancel"]);
});
test("an incomplete completion response preserves the reservation",async()=>{
  const file=new File([],"malformed-finish",{lastModified:1});let finish=0;
  request.mockImplementation(async action=>{
    if(action==="upload_begin")return {id:"u6",offset:0};
    if(action==="upload_status")return {offset:0,size:0,state:"complete",chunks:[]};
    return finish++?{id:"saved",revision:1}:{};
  });
  await expect(run(file)).rejects.toThrow("may already be saved");
  await expect(run(file)).resolves.toMatchObject({id:"saved"});
  expect(request.mock.calls.filter(([a])=>a==="upload_begin")).toHaveLength(1);
});
