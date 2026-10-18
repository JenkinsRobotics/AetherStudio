import { afterEach, expect, test, vi } from "vitest";
import { fileLinkRequest, newSharingLink, memberUpdateRequest, directoryCreateRequest, documentRequest, DocumentError, workspacePreferenceRequest, fileFavoriteRequest, fileRecycleRequest, fileEditRequest, fileCreateRequest, fileGrantRequest, fileCopyRequest } from "./documents";
import { AutosaveSession, readRecovery } from "./autosave";
const file = { id: "show", name: "Show", revision: 1, writable: true };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); sessionStorage.clear(); history.replaceState(null, "", "/"); });
test("creation carries the Drive destination, mutation ID and owning app", async () => {
  history.replaceState(null, "", "/?driveOrganization=company&driveWorkspace=design&driveParent=folder");
  const fetcher = vi.fn().mockResolvedValue(reply(file)); vi.stubGlobal("fetch", fetcher);
  await documentRequest("map", "create", { app: "cad", name: "Show", scope: "personal", data_base64: "e30=" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("/api/library/create");
  expect(options.credentials).toBe("same-origin");
  expect(JSON.parse(options.body)).toMatchObject({ app: "map", organization: "company", workspace: "design", parent: "folder", scope: "workspace", operation_id: expect.any(String) });
});
test("explicit mutation IDs are preserved and reads do not allocate mutations", async () => {
  const fetcher = vi.fn().mockResolvedValue(reply({ ...file, data_base64: "e30=" })); vi.stubGlobal("fetch", fetcher);
  await documentRequest("cad", "save", { operation_id: "exact-replay", id: "show", expected_revision: 1 });
  fetcher.mockResolvedValue(reply({ ...file, data_base64: "e30=" }));
  await documentRequest("cad", "read", { id: "show", branch: "Main" });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).operation_id).toBe("exact-replay");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ app: "cad", id: "show", branch: "Main" });
});
test.each(["network", "invalid-json", "missing-metadata", "unknown-execution", "legacy-5xx"])("uncertain %s saves block retries and retain newer draft recovery", async (kind) => {
  vi.useFakeTimers();
  const fetcher = vi.fn();
  if (kind === "network") fetcher.mockRejectedValue(new TypeError("Lost reply"));
  if (kind === "invalid-json") fetcher.mockResolvedValue(new Response("<html>"));
  if (kind === "missing-metadata") fetcher.mockResolvedValue(reply({ ok: true }));
  if (kind === "unknown-execution") fetcher.mockResolvedValue(reply({ error: "Timeout", execution: "unknown" }, 504));
  if (kind === "legacy-5xx") fetcher.mockResolvedValue(reply({ error: "Internal error" }, 500));
  vi.stubGlobal("fetch", fetcher);
  const queue = new AutosaveSession({ key: "recovery", base: null, save: async (text: string) => { await documentRequest("map", "create", { data_base64: text }); return null; } });
  try {
    queue.write("original");
    await expect(queue.flush()).rejects.toMatchObject({ retryable: false, detail: { code: "outcome_unknown", operation_id: expect.any(String) } });
    queue.write("newer");
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(queue.flush()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(queue.state.phase).toBe("conflict");
    expect(queue.dirty).toBe(true);
    expect(readRecovery("recovery")).toMatchObject({ text: "newer", base: null, blocked: expect.any(String) });
  } finally { queue.dispose(); }
});
test.each([409, 413, 501])("a rejected %s mutation stays blocked", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "Unsupported or conflicting request", execution: "rejected" }, status)));
  await expect(documentRequest("map", "save", {})).rejects.toMatchObject({ status, retryable: false });
});
test("native admission rejection can retry without transport retrying itself", async () => {
  const fetcher = vi.fn().mockResolvedValue(reply({ error: "Busy", execution: "not_started" }, 429)); vi.stubGlobal("fetch", fetcher);
  await expect(documentRequest("map", "create", {})).rejects.toMatchObject({ status: 429, retryable: true });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("failed reads do not pretend a write may have occurred", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Offline")));
  await expect(documentRequest("map", "read", { id: "show" })).rejects.toBeInstanceOf(TypeError);
});
test("malformed read metadata cannot replace the current document", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ ...file, revision: 0 })));
  await expect(documentRequest("map", "read", {})).rejects.toBeInstanceOf(DocumentError);
});

test("refresh during an in-flight create cannot replay it with a new mutation ID", async () => {
  vi.useFakeTimers();
  let complete!: (base: null) => void;
  const save = vi.fn(() => new Promise<null>(resolve => { complete = resolve; }));
  const first = new AutosaveSession({ key: "refresh", base: null, save });
  first.write("new document");
  const saving = first.flush();
  const recovery = readRecovery<null>("refresh")!;
  expect(recovery.blocked).toEqual(expect.any(String));
  first.dispose();
  const reopened = new AutosaveSession({ key: "refresh", base: null, save });
  try {
    reopened.recover(recovery);
    reopened.write("newer draft");
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(reopened.flush()).rejects.toThrow("interrupted");
    expect(save).toHaveBeenCalledTimes(1);
    expect(readRecovery("refresh")).toMatchObject({ text: "newer draft", blocked: expect.any(String) });
  } finally { reopened.dispose(); complete(null); await saving; }
});

test("collaboration reads do not allocate mutation IDs or claim unknown writes", async () => {
  const fetcher = vi.fn().mockResolvedValue(reply({revision:0,comments:[]}));
  vi.stubGlobal("fetch", fetcher);
  await documentRequest("map", "collaboration", {id:"show"});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({app:"map",id:"show"});
  fetcher.mockRejectedValue(new TypeError("Offline"));
  await expect(documentRequest("map","collaboration",{id:"show"})).rejects.toBeInstanceOf(TypeError);
});
test("release transitions carry stable operation IDs and preserve all guards", async () => {
  const fetcher = vi.fn().mockImplementation(async () => reply({ok:true,status:"candidate"}));
  vi.stubGlobal("fetch", fetcher);
  const guards={id:"show",name:"V1",expected_revision:2,expected_status:"version",expected_status_updated:0,status:"candidate"};
  await documentRequest("map","version_status",guards);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({...guards,app:"map",operation_id:expect.any(String)});
  await documentRequest("map","version_status",{...guards,operation_id:"retry-original"});
  expect(JSON.parse(fetcher.mock.calls[1][1].body).operation_id).toBe("retry-original");
});
test.each(["network","malformed-success","unknown-execution"])("uncertain %s release changes never imply that the release was unchanged", async (kind) => {
  const fetcher=vi.fn();
  if(kind==="network")fetcher.mockRejectedValue(new TypeError("Lost response"));
  if(kind==="malformed-success")fetcher.mockResolvedValue(new Response("<html>"));
  if(kind==="unknown-execution")fetcher.mockResolvedValue(reply({error:"Timeout",execution:"unknown"},504));
  vi.stubGlobal("fetch",fetcher);
  await expect(documentRequest("cad","version_status",{operation_id:"release-attempt"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:"release-attempt"}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("workspace preferences carry replay IDs without claiming a product app", async () => {
  const fetcher=vi.fn().mockImplementation(async()=>reply({workspaces:[],applied_revision:1,replayed:false}));
  vi.stubGlobal("fetch",fetcher);
  await workspacePreferenceRequest("workspace_favorite",{workspace:"shared",favorite:true});
  expect(fetcher.mock.calls[0][0]).toBe("/api/drive/workspace_favorite");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({workspace:"shared",favorite:true,operation_id:expect.any(String)});
  await workspacePreferenceRequest("workspace_open",{workspace:"shared",operation_id:"exact-open-retry"});
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({workspace:"shared",operation_id:"exact-open-retry"});
});
test("workspace preference client remains compatible with the preserved host response", async()=>{
  vi.stubGlobal("fetch",vi.fn().mockImplementation(async()=>reply({workspaces:[{id:"shared",favorite:true}]})));
  await expect(workspacePreferenceRequest("workspace_favorite",{workspace:"shared",favorite:true})).resolves.toEqual({workspaces:[{id:"shared",favorite:true}]});
});
test.each(["network","malformed-response"])("uncertain workspace %s writes are never silently replayed", async(kind)=>{
  const fetcher=vi.fn();
  if(kind==="network")fetcher.mockRejectedValue(new TypeError("Lost response"));
  else fetcher.mockResolvedValue(reply({ok:true}));
  vi.stubGlobal("fetch",fetcher);
  await expect(workspacePreferenceRequest("workspace_open",{workspace:"shared",operation_id:"open-attempt"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:"open-attempt"}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("file favorites use stable operation IDs and preserve legacy response compatibility", async()=>{
  const fetcher=vi.fn().mockImplementation(async()=>reply({ok:true}));
  vi.stubGlobal("fetch",fetcher);
  await fileFavoriteRequest({id:"file",favorite:true});
  expect(fetcher.mock.calls[0][0]).toBe("/api/drive/favorite");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({id:"file",favorite:true,operation_id:expect.any(String)});
  await fileFavoriteRequest({id:"file",favorite:false,operation_id:"exact-favorite-retry"});
  expect(JSON.parse(fetcher.mock.calls[1][1].body).operation_id).toBe("exact-favorite-retry");
});
test.each(["network","invalid-json","malformed-success","invalid-favorite","invalid-revision","invalid-replay"])("uncertain file favorite %s never silently retries", async(kind)=>{
  const fetcher=vi.fn();
  if(kind==="network")fetcher.mockRejectedValue(new TypeError("Lost reply"));
  else if(kind==="invalid-json")fetcher.mockResolvedValue(new Response("not json",{status:200}));
  else fetcher.mockResolvedValue(reply(kind==="malformed-success"?{}:kind==="invalid-favorite"?{ok:true,favorite:"no"}:kind==="invalid-revision"?{ok:true,applied_revision:0}:{ok:true,replayed:"yes"}));
  vi.stubGlobal("fetch",fetcher);
  await expect(fileFavoriteRequest({id:"file",favorite:true,operation_id:"favorite-attempt"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:"favorite-attempt"}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("uncertain personal preferences explain checking the result without claiming draft recovery",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new TypeError("Lost reply")));
  await expect(fileFavoriteRequest({id:"file",favorite:true})).rejects.toThrow("Refresh to check before trying again");
});


test.each(["trash", "restore"] as const)("Drive %s preserves the selected guard and one operation ID", async action => {
  const fetcher = vi.fn().mockResolvedValue(reply({ok:true,operation_id:"chosen",replayed:false,resource:{id:"show",structure_revision:8,trashed:action === "trash"}}));
  vi.stubGlobal("fetch",fetcher);
  await fileRecycleRequest(action,{id:"show",expected_structure_revision:7,operation_id:"chosen"});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(`/api/drive/${action}`);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({id:"show",expected_structure_revision:7,operation_id:"chosen"});
});
test.each(["network", "wrong-resource", "wrong-operation", "bad-json"])("Drive recycling blocks uncertain %s responses without automatic retries", async kind => {
  const fetcher=vi.fn();
  if (kind === "network") fetcher.mockRejectedValue(new TypeError("Lost"));
  else if (kind === "bad-json") fetcher.mockResolvedValue(new Response("<html>"));
  else fetcher.mockResolvedValue(reply({ok:true,operation_id:kind === "wrong-operation" ? "other" : "chosen",replayed:false,resource:{id:kind === "wrong-resource" ? "other" : "show",structure_revision:2,trashed:true}}));
  vi.stubGlobal("fetch",fetcher);
  await expect(fileRecycleRequest("trash",{id:"show",expected_structure_revision:1,operation_id:"chosen"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:"chosen"}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("Drive recycling remains compatible with the original host acknowledgement", async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(reply({ok:true})));
  await expect(fileRecycleRequest("restore",{id:"show"})).resolves.toEqual({ok:true});
});


test("Drive file rename sends the selected content revision", async () => {
  const fetcher=vi.fn().mockResolvedValue(reply({...file,revision:5,operation_id:"rename-id",replayed:false}));vi.stubGlobal("fetch",fetcher);
  await fileEditRequest("rename",{id:"show",kind:"file",name:"Changed",expected_revision:4,operation_id:"rename-id"});
  expect(fetcher.mock.calls[0][0]).toBe("/api/drive/rename");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({expected_revision:4,operation_id:"rename-id"});
});
test("Drive folder move sends the chosen destination and selected guard only once", async () => {
  const fetcher=vi.fn().mockResolvedValue(reply({ok:true,operation_id:"move-id",replayed:false,resource:{id:"show",structure_revision:3}}));vi.stubGlobal("fetch",fetcher);
  await fileEditRequest("move",{id:"show",destination:{organization:"default",workspace:null,parent:"folder"},expected_structure_revision:2,operation_id:"move-id"});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({expected_structure_revision:2,destination:{parent:"folder"}});
});
test.each(["rename","move"] as const)("Drive %s rejects malformed or uncertain acknowledgements",async action=>{
  const fetcher=vi.fn().mockResolvedValue(reply({ok:true}));vi.stubGlobal("fetch",fetcher);
  await expect(fileEditRequest(action,{id:"show"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown"}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});


test("Drive creation preserves an explicit location despite an editor URL destination",async()=>{
 history.replaceState(null,"","/?driveOrganization=wrong&driveWorkspace=wrong&driveParent=wrong");
 const fetcher=vi.fn().mockResolvedValue(reply({...file,operation_id:"create-id",replayed:false}));vi.stubGlobal("fetch",fetcher);
 await fileCreateRequest({operation_id:"create-id",organization:"chosen",workspace:null,parent:"target",kind:"folder",name:"Folder"});
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({operation_id:"create-id",organization:"chosen",workspace:null,parent:"target",kind:"folder",name:"Folder"});
 expect(fetcher).toHaveBeenCalledTimes(1);
});
test("Drive creation lost acknowledgement cannot silently create another file",async()=>{
 const fetcher=vi.fn().mockRejectedValue(new TypeError("Offline"));vi.stubGlobal("fetch",fetcher);
 await expect(fileCreateRequest({name:"New"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:expect.any(String)}});
 expect(fetcher).toHaveBeenCalledTimes(1);
});

test("preserves the inspected direct grant and verifies native acknowledgements", async () => {
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,id:"show",user:"bob",role:"viewer",applied_role:"viewer",operation_id:"share-id",replayed:false})));
  vi.stubGlobal("fetch",fetcher);
  await fileGrantRequest({id:"show",user:"bob",role:"viewer",expected_role:null,operation_id:"share-id"});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({id:"show",user:"bob",expected_role:null,operation_id:"share-id"});
  fetcher.mockResolvedValue(new Response(JSON.stringify({ok:true,id:"other",user:"bob",role:"viewer",applied_role:"viewer",operation_id:"share-id",replayed:false})));
  await expect(fileGrantRequest({id:"show",user:"bob",role:"viewer",expected_role:null,operation_id:"share-id"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown"}});
});
test("never automatically repeats sharing after losing its acknowledgement", async () => {
  const fetcher=vi.fn().mockRejectedValue(new Error("connection lost"));vi.stubGlobal("fetch",fetcher);
  await expect(fileGrantRequest({id:"show",user:"bob",role:"remove",expected_role:"viewer"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:expect.any(String)}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("copy preserves the inspected revisions and explicit destination", async () => {
  const fetcher=vi.fn().mockResolvedValue(reply({...file,id:"copy",operation_id:"copy-id",replayed:false}));vi.stubGlobal("fetch",fetcher);
  await fileCopyRequest({id:"source",operation_id:"copy-id",expected_revision:3,expected_structure_revision:2,destination:{organization:"default",parent:null}});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({id:"source",operation_id:"copy-id",expected_revision:3,expected_structure_revision:2,destination:{organization:"default",parent:null}});
  fetcher.mockResolvedValue(reply({...file,operation_id:"wrong",replayed:false}));
  await expect(fileCopyRequest({id:"source",operation_id:"copy-id"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown"}});
});
test("copy does not create another item after a lost reply", async () => {
  const fetcher=vi.fn().mockRejectedValue(new Error("connection lost"));vi.stubGlobal("fetch",fetcher);
  await expect(fileCopyRequest({id:"source",expected_revision:1,expected_structure_revision:1,destination:{organization:"default"}})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:expect.any(String)}});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test.each(["organization_create", "workspace_create"] as const)("directory %s preserves identity and never retries an uncertain result",async action=>{
 const fetcher=vi.fn().mockResolvedValue(reply({id:"new-space",operation_id:"chosen",replayed:false}));vi.stubGlobal("fetch",fetcher);
 await directoryCreateRequest(action,{name:"Engineering",organization:"chosen-org",operation_id:"chosen"});
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({name:"Engineering",organization:"chosen-org",operation_id:"chosen"});
 fetcher.mockResolvedValue(reply({id:"new-space",operation_id:"different",replayed:false}));
 await expect(directoryCreateRequest(action,{name:"Engineering",operation_id:"chosen"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:"chosen"}});
 fetcher.mockRejectedValue(new Error("lost reply"));
 await expect(directoryCreateRequest(action,{name:"Engineering"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:expect.any(String)}});
 expect(fetcher).toHaveBeenCalledTimes(3);
});
test("directory creation still accepts the original host identity response",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(reply({id:"legacy-company",organizations:[],workspaces:[]})));
 await expect(directoryCreateRequest("organization_create",{name:"Company"})).resolves.toMatchObject({id:"legacy-company"});
});

test("member updates preserve the observed direct role and correlate replies",async()=>{
 const data={organization:"company",workspace:"team",user:"person",role:"editor",expected_role:null,operation_id:"member-op"};
 const ack={ok:true,...data,member_id:"person-id",applied_role:"editor",replayed:false};
 const fetcher=vi.fn().mockResolvedValue(reply(ack));vi.stubGlobal("fetch",fetcher);
 await memberUpdateRequest(data);
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(data);
 for(const changes of [{operation_id:"wrong"},{user:"other"},{organization:"other"},{workspace:null},{member_id:""},{role:"member"},{applied_role:"invalid"}]) {
  fetcher.mockResolvedValue(reply({...ack,...changes}));
  await expect(memberUpdateRequest(data)).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown"}});
 }
});
test("member update lost replies are not retried and legacy acknowledgments remain accepted",async()=>{
 const fetcher=vi.fn().mockRejectedValue(new Error("lost reply"));vi.stubGlobal("fetch",fetcher);
 await expect(memberUpdateRequest({organization:"company",user:"person",role:"member",expected_role:null})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:expect.any(String)}});
 expect(fetcher).toHaveBeenCalledTimes(1);
 fetcher.mockResolvedValue(reply({ok:true}));
 await expect(memberUpdateRequest({organization:"company",user:"person",role:"remove",expected_role:"member"})).resolves.toEqual({ok:true});
});


test("sharing capability has 256 bits and retry preserves the exact request", async () => {
  const request = newSharingLink("file", "viewer", 7);
  expect(request.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(newSharingLink("file", "viewer", 7).token).not.toBe(request.token);
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("lost reply")).mockResolvedValueOnce(reply({id:"link", url:`/drive/?share=${request.token}`, operation_id:request.operation_id, active:true, revoked:false, expires:1000, replayed:true}));
  vi.stubGlobal("fetch",fetcher);
  await expect(fileLinkRequest("link_create",request)).rejects.toMatchObject({detail:{code:"outcome_unknown",operation_id:request.operation_id}});
  await expect(fileLinkRequest("link_create",request)).resolves.toMatchObject({id:"link",replayed:true});
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
});
test("sharing rejects forged reply URLs and treats revocation failures as uncertain", async () => {
  const request=newSharingLink("file","viewer",7);
  for (const url of ["https://untrusted.example/", "/drive/?share=weak"]) {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(reply({id:"link",url})));
    await expect(fileLinkRequest("link_create",request)).rejects.toMatchObject({detail:{code:"outcome_unknown"}});
  }
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new TypeError("offline")));
  await expect(fileLinkRequest("link_revoke",{id:"file",link:"link",operation_id:"revoke"})).rejects.toMatchObject({detail:{code:"outcome_unknown",operation_id:"revoke"}});
});

test("branch reads and saves reject another branch's otherwise valid file",async()=>{
 const branch=`branch-${"a".repeat(64)}`;
 vi.stubGlobal("fetch",vi.fn().mockImplementation(async()=>reply({id:"show",name:"Show",revision:2,writable:true,data_base64:"e30=",branch_id:`branch-${"b".repeat(64)}`})));
 await expect(documentRequest("map","read",{id:"show",branch})).rejects.toMatchObject({status:502,retryable:false});
 await expect(documentRequest("map","save",{id:"show",branch,operation_id:"same-save"})).rejects.toMatchObject({detail:{code:"outcome_unknown",operation_id:"same-save"}});
});
test("branch milestone acknowledgements must match the captured target",async()=>{
 const branch=`branch-${"a".repeat(64)}`;
 const fetcher=vi.fn().mockImplementation(async()=>reply({ok:true,branch_id:branch,branch:"Renamed",head_revision:2,deleted:false,replayed:false}));vi.stubGlobal("fetch",fetcher);
 await expect(documentRequest("map","branch_rename",{id:"show",branch,new_name:"Renamed",expected_revision:2,operation_id:"rename"})).resolves.toMatchObject({ok:true});
 await expect(documentRequest("map","branch_rename",{id:"show",branch,new_name:"Different",expected_revision:2,operation_id:"rename-other"})).rejects.toMatchObject({detail:{code:"outcome_unknown"}});
 fetcher.mockImplementation(async()=>reply({ok:true,merged:true,revision:3,target:"Main",branch_id:null,source_head:9,replayed:true}));
 await expect(documentRequest("map","merge",{id:"show",source:branch,target:"Main",expected_source_revision:2,expected_revision:1})).rejects.toMatchObject({detail:{code:"outcome_unknown"}});
});
