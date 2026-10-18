// Shared version/history controls against the disposable native Map document.
import assert from "node:assert/strict";
import {join} from "node:path";
export async function verifyBrowserBranches(page, origin, evidence, sourceID) {
  const post = (action, data) => page.evaluate(async ({action,data}) => {
    const response=await fetch(`/api/library/${action}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({app:"map",...data})});
    const value=await response.json();if(!response.ok)throw new Error(`${action}: ${response.status} ${JSON.stringify(value)}`);return value;
  },{action,data});
  const original=await post("read",{id:sourceID});
  const file=await post("create",{name:"Branch browser fixture",kind:"file",scope:"personal",data_base64:original.data_base64,operation_id:crypto.randomUUID()});
  const open=async(branch="Main")=>{
    await page.goto(`${origin}/map/index.html?document=${encodeURIComponent(file.id)}${branch==="Main"?"":`&branch=${encodeURIComponent(branch)}`}`);
    await page.waitForFunction(()=>document.querySelectorAll("svg.map-overlay").length>0);
  };
  const historyPanel=async()=>{
    if(!await page.getByRole("region",{name:"Versions and history",exact:true}).isVisible())await page.getByLabel("Version control",{exact:true}).first().click();
    await page.getByRole("region",{name:"Versions and history",exact:true}).waitFor();
  };
  const responseFor=action=>page.waitForResponse(r=>new URL(r.url()).pathname===`/api/library/${action}`);
  await open();await page.getByLabel("Create version",{exact:true}).first().click();
  await page.getByRole("dialog").getByLabel("Name",{exact:true}).fill("Experiment");
  const forked=responseFor("branch_create");
  await page.getByRole("dialog").getByRole("button",{name:"Create branch",exact:true}).click();
  const forkReply=await forked;assert.equal(forkReply.status(),200);
  const forkBody=forkReply.request().postDataJSON(), branch=(await forkReply.json()).branch_id;
  assert.match(branch,/^branch-[0-9a-f]{64}$/);assert.equal(forkBody.branch,undefined);assert.equal(forkBody.expected_revision,1);
  await page.getByRole("dialog").waitFor({state:"hidden"});await historyPanel();
  await page.getByRole("button",{name:"Workspace Experiment",exact:true}).click({button:"right"});
  page.once("dialog",d=>d.accept("Renamed experiment"));const renamed=responseFor("branch_rename");
  await page.getByRole("menuitem",{name:"Rename workspace",exact:true}).click();
  const renameReply=await renamed;assert.equal(renameReply.status(),200);assert.equal(renameReply.request().postDataJSON().branch,branch);
  await page.getByRole("button",{name:"Workspace Renamed experiment",exact:true}).dblclick();
  await page.waitForURL(url=>url.searchParams.get("branch")===branch);
  await page.waitForFunction(()=>document.querySelectorAll("svg.map-overlay").length>0);
  await page.getByRole("tab").filter({hasText:"Branch browser fixture · Renamed experiment"}).waitFor();
  // The first write succeeds at the server, but the browser loses its reply.
  const requests=[];
  await page.route("**/api/library/version",async route=>{
    requests.push(route.request().postDataJSON());
    if(requests.length===1){const response=await route.fetch();assert.equal(response.status(),200);await route.abort("failed");}
    else await route.continue();
  });
  await page.getByLabel("Create version",{exact:true}).first().click();
  await page.getByRole("dialog").getByLabel("Name",{exact:true}).fill("Retained branch checkpoint");
  await page.getByRole("dialog").getByRole("button",{name:"Create version",exact:true}).click();
  await page.getByRole("button",{name:"Retry original change",exact:true}).waitFor();
  const retried=responseFor("version");await page.getByRole("button",{name:"Retry original change",exact:true}).click();
  const retryReply=await retried;assert.equal(retryReply.status(),200);assert.equal((await retryReply.json()).replayed,true);
  assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0].branch,branch);
  await page.unroute("**/api/library/version");await page.getByRole("dialog").waitFor({state:"hidden"});
  await page.getByRole("button",{name:"Comments",exact:true}).first().click();
  await page.getByLabel("Comments text",{exact:true}).fill("Anchored to the permanent branch");
  const commented=responseFor("collaboration_mutate");
  await page.getByRole("form",{name:"Comment composer"}).getByRole("button",{name:"Add",exact:true}).click();
  const commentReply=await commented;assert.equal(commentReply.status(),200);
  const discussion=await commentReply.json();assert.equal(discussion.mutation_replay,"operation_id");assert.equal(discussion.comments[0].branch_id,branch);
  // Create distinct valid Map content on each side. Only the UI resolves the conflict.
  const main=await post("read",{id:file.id}), edit=await post("read",{id:file.id,branch});
  const content=width=>{const show=JSON.parse(Buffer.from(original.data_base64,"base64").toString());show.output.width=width;return Buffer.from(JSON.stringify(show)).toString("base64");};
  const changedBranch=await post("save",{id:file.id,branch,expected_revision:edit.revision,data_base64:content(1918),operation_id:crypto.randomUUID()});
  const changedMain=await post("save",{id:file.id,expected_revision:main.revision,data_base64:content(1922),operation_id:crypto.randomUUID()});
  await open();await historyPanel();
  await page.getByRole("button",{name:"Workspace Main",exact:true}).click({button:"right"});
  await page.getByRole("menuitem",{name:"Merge into Main",exact:true}).click();
  await page.getByLabel("Merge source",{exact:true}).selectOption(branch);
  const conflict=responseFor("merge");await page.getByRole("button",{name:"Merge into Main",exact:true}).click();
  const conflictReply=await conflict;assert.equal(conflictReply.status(),409);
  assert.deepEqual((await conflictReply.json()).detail,{conflict:true,source_head:changedBranch.revision,target_head:changedMain.revision});
  const resolved=responseFor("merge");await page.getByRole("button",{name:"Use source file",exact:true}).click();
  const resolvedReply=await resolved;assert.equal(resolvedReply.status(),200);
  assert.equal(resolvedReply.request().postDataJSON().expected_source_revision,changedBranch.revision);
  assert.equal(resolvedReply.request().postDataJSON().expected_revision,changedMain.revision);
  await page.waitForFunction(()=>document.querySelectorAll("svg.map-overlay").length>0);
  await historyPanel();
  await page.getByRole("button",{name:"Workspace Renamed experiment",exact:true}).click({button:"right"});
  page.once("dialog",d=>d.accept());const deleted=responseFor("branch_delete");
  await page.getByRole("menuitem",{name:"Delete merged workspace",exact:true}).click();
  const deleteReply=await deleted;assert.equal(deleteReply.status(),200);assert.equal(deleteReply.request().postDataJSON().branch,branch);
  const after=await post("history",{id:file.id});assert.equal(after.branch_identity,"stable");
  assert.equal(after.branches.length,1);assert.equal(after.versions.filter(v=>v.name==="Retained branch checkpoint").length,1);
  assert.equal(after.versions.find(v=>v.name==="Retained branch checkpoint").branch_id,branch);
  assert.ok(after.versions.some(v=>v.origin==="automatic"));
  if(evidence)await page.screenshot({path:join(evidence,"map-native-branch-history.png")});
  return {stableIdentity:true,renameOpen:true,exactRetry:true,branchComment:true,guardedConflict:true,mergeCheckpoint:true,deletePreservesHistory:true};
}
