import {afterEach, expect, test, vi} from "vitest";
import {cleanup,renderHook} from "@testing-library/react";
import {useDocumentConnection} from "./useDocumentConnection";
afterEach(()=>{cleanup();vi.unstubAllGlobals();history.replaceState(null,"","/");});
test("selected branch context reaches history and collaboration without polluting branch-create bodies",async()=>{
 const branch=`branch-${"a".repeat(64)}`;
 history.replaceState(null,"",`/map/?document=show&branch=${branch}`);
 const fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({ok:true,branch_id:`branch-${"b".repeat(64)}`,branch:"Child",head_revision:1,deleted:false,replayed:false})));vi.stubGlobal("fetch",fetcher);
 const {result}=renderHook(()=>useDocumentConnection({app:"map",name:"Show",flush:async()=>{}}));
 for(const action of ["history","collaboration"])await result.current.call(action);
 await result.current.call("branch_create",{name:"Child",expected_revision:1,from_revision:1});
 const bodies=fetcher.mock.calls.map(c=>JSON.parse(c[1].body));
 expect(bodies[0]).toEqual({app:"map",id:"show",branch});expect(bodies[1]).toEqual(bodies[0]);expect(bodies[2]).not.toHaveProperty("branch");
});
