import { afterEach, expect, test, vi } from "vitest";
import { api } from "./library/api";
afterEach(() => { vi.unstubAllGlobals(); history.replaceState(null,"","/"); });
test("Home folder creation carries an operation ID and keeps its selected location", async () => {
  history.replaceState(null,"","/?driveOrganization=unrelated&driveWorkspace=elsewhere");
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"folder",name:"Folder",revision:1,writable:true,kind:"folder"})));
  vi.stubGlobal("fetch",fetcher);
  await api("/api/library/create",{app:"map",name:"Folder",kind:"folder",organization:"chosen",workspace:null,parent:"selected",scope:"personal"});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({app:"map",kind:"folder",operation_id:expect.any(String),organization:"chosen",workspace:null,parent:"selected",scope:"personal"});
});
test("Home import and rename retain explicit operations and guards", async () => {
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"file",name:"Show",revision:2,writable:true})));
  vi.stubGlobal("fetch",fetcher);
  await api("/api/library/rename",{app:"map",id:"file",name:"Show",expected_revision:1,operation_id:"rename-id"});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({expected_revision:1,operation_id:"rename-id"});
  fetcher.mockRejectedValue(new Error("lost reply"));
  await expect(api("/api/library/create",{app:"map",name:"Imported",data_base64:"e30="})).rejects.toMatchObject({message:"The server may have applied this change, but its reply was lost. Refresh to check before trying again.",status:0,retryable:false,detail:{code:"outcome_unknown",operation_id:expect.any(String)}});
  expect(fetcher).toHaveBeenCalledTimes(2);
});
test("Home read requests stay read-only and unrelated APIs retain their own contracts", async () => {
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({files:[]}))));vi.stubGlobal("fetch",fetcher);
  await api("/api/library/list",{app:"map",view:"personal"});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({app:"map",view:"personal"});
  await api("/api/drive/context",{});
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({});
});

test("product factories creating through Drive use its guarded transport too", async () => {
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"map-file",name:"Show",revision:1,writable:true})));
  vi.stubGlobal("fetch",fetcher);
  await api("/api/drive/create",{app:"map",name:"Show",data_base64:"e30=",organization:"chosen"});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({app:"map",operation_id:expect.any(String),organization:"chosen"});
});

test("CAD project creation and editing use guarded operation IDs, reads do not", async () => {
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"project",name:"Wheel.acad",revision:1,writable:true,project:{parts:[],assemblies:[]}})));
  vi.stubGlobal("fetch",fetcher);
  await api("/api/library/project_create",{app:"cad",name:"Wheel",packaging:"project"});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({operation_id:expect.any(String),app:"cad",packaging:"project"});
  fetcher.mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({project:{parts:[],assemblies:[]}}))));
  await api("/api/library/project_read",{app:"cad",id:"project"});
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({app:"cad",id:"project"});
  fetcher.mockRejectedValue(new Error("lost reply"));
  await expect(api("/api/library/project_edit",{app:"cad",id:"project",expected_revision:1,operation:"add_part",operation_id:"fixed"})).rejects.toMatchObject({retryable:false,detail:{code:"outcome_unknown",operation_id:"fixed"}});
  expect(fetcher).toHaveBeenCalledTimes(3);
});
