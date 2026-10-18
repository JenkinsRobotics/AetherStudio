import assert from "node:assert/strict";
import {join} from "node:path";

/** Real built Map panels and native SSE; remote writes use a separate HTTP client. */
export async function verifyBrowserLiveChanges(page, origin, evidence, templateId) {
  const post = async (action, data) => {
    const response = await page.request.post(`${origin}/api/library/${action}`, {
      headers:{Origin:origin}, data:{app:"map",...(!["read","history","collaboration"].includes(action)?{operation_id:crypto.randomUUID()}:{}),...data},
    });
    assert.equal(response.status(),200,`${action}: ${await response.text()}`);
    return response.json();
  };
  const original=await post("read",{id:templateId});
  const file=await post("create",{name:"Live updates fixture",kind:"file",scope:"personal",data_base64:original.data_base64});
  await page.addInitScript(()=>{
    window.__liveChangeEvents=0;
    const Native=window.EventSource;
    window.EventSource=class extends Native {
      constructor(...args){super(...args);this.addEventListener("state",()=>window.__liveChangeEvents++);}
    };
  });
  await page.goto(`${origin}/map/index.html?document=${encodeURIComponent(file.id)}`);
  await page.waitForFunction(()=>document.querySelectorAll("svg.map-overlay").length>0);
  if(!await page.getByRole("region",{name:"Versions and history",exact:true}).isVisible())await page.getByLabel("Version control",{exact:true}).first().click();
  await page.waitForFunction(()=>window.__liveChangeEvents>0);
  const events=await page.evaluate(()=>window.__liveChangeEvents);
  const before=await post("history",{id:file.id});
  await post("version",{id:file.id,name:"Remote milestone",expected_revision:before.branches[0].head_revision});
  await page.getByRole("button",{name:"Version Remote milestone",exact:true}).waitFor({timeout:8000});
  assert.ok(await page.evaluate(()=>window.__liveChangeEvents)>events,"Metadata change arrived through real SSE");
  await page.getByRole("button",{name:"Document notes",exact:true}).first().click();
  await page.getByRole("button",{name:"Edit document notes",exact:true}).click();
  await page.getByLabel("Document notes text",{exact:true}).fill("My unsaved live draft");
  const current=await post("collaboration",{id:file.id});
  await page.context().setOffline(true);
  await page.getByText("Live updates are disconnected. Your draft is kept. Reconnecting…",{exact:true}).first().waitFor({timeout:10000});
  assert.equal(await page.getByLabel("Document notes text",{exact:true}).inputValue(),"My unsaved live draft");
  assert.ok(await page.getByRole("button",{name:"Save notes",exact:true}).isDisabled());
  await post("collaboration_mutate",{id:file.id,collection:"notes",operation:"update",expected_revision:current.revision,value:{text:"Remote notes while disconnected"}});
  await page.context().setOffline(false);
  await page.waitForFunction(()=>{
    const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Save notes");return b && !b.disabled;
  },{},{timeout:15000});
  assert.equal(await page.getByLabel("Document notes text",{exact:true}).inputValue(),"My unsaved live draft");
  const conflict=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/library/collaboration_mutate");
  await page.getByRole("button",{name:"Save notes",exact:true}).click();
  assert.equal((await conflict).status(),409);
  await page.getByRole("group",{name:"Review conflicting edit",exact:true}).waitFor();
  await page.getByText("Remote notes while disconnected",{exact:true}).waitFor();
  assert.equal(await page.getByLabel("Document notes text",{exact:true}).inputValue(),"My unsaved live draft");
  const after=await post("history",{id:file.id});
  assert.equal(after.revisions.length,before.revisions.length,"Notifications and note conflict never save product content");
  if(evidence)await page.screenshot({path:join(evidence,"map-live-reconnect-draft.png")});
  return {nativeSse:true,remoteMilestone:true,offlineReconnect:true,draftRetained:true,originalConflictGuard:true,contentUnchanged:true};
}
