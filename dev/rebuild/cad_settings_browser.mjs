// Exercise the real React settings dialog against a disposable Rust host.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
const [origin,cookie,fixture]=process.argv.slice(2);
const root=resolve(dirname(fixture),'../../..');
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const {build}=await import(createRequire(resolve(root,'package.json')).resolve('vite'));
const entry=resolve(root,'__settings_browser.tsx');
const bundle=await build({configFile:false,root,logLevel:'error',base:'/__settings_fixture/',publicDir:false,plugins:[{
 name:'settings-fixture',resolveId(id){if(id===entry)return entry;},load(id){if(id===entry)return `
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {CADDocumentSettings,loadDocumentMetadata,documentAPI} from './src/react/CADDocumentSettings';
 import {configureDocumentSession} from './src/document-session';
 import {documentRequest} from '@aether/session/documents';
 import '@aether/ui/tokens.css';import '@aether/ui/widgets.css';
 let mount;globalThis.SettingsFixture={loadDocumentMetadata,documentRequest,documentAPI,
 show(id,branch,action,revision=1){history.replaceState(null,'','/cad/index.html?document='+id+'&branch='+branch);
 configureDocumentSession(()=>({id,revision,writable:true}),()=>{});
 mount?.unmount();document.body.innerHTML='<div id="root"></div>';mount=createRoot(document.getElementById('root'));
 mount.render(<CADDocumentSettings action={action} onClose={()=>{}}/>);}};
 `;}
}],build:{write:false,minify:false,rollupOptions:{input:entry,output:{entryFileNames:'settings.js'}}}});
const outputs=(Array.isArray(bundle)?bundle:[bundle]).flatMap(v=>v.output);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 await context.addCookies([{name:'aether_native_session',value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
 const page=await context.newPage();
 await page.route(origin+'/__settings_fixture/**',route=>{const file=outputs.find(v=>v.fileName===new URL(route.request().url()).pathname.slice('/__settings_fixture/'.length));assert.ok(file);return route.fulfill({body:file.type==='chunk'?file.code:file.source,contentType:file.fileName.endsWith('.css')?'text/css':file.fileName.endsWith('.wasm')?'application/wasm':'text/javascript'});});
 await page.route(origin+'/cad/index.html**',route=>route.fulfill({body:'<!doctype html><html><body>Reloaded saved CAD document</body></html>',contentType:'text/html'}));
 await page.goto(origin+'/healthz');
 for(const css of outputs.filter(v=>v.fileName.endsWith('.css')))await page.addStyleTag({url:origin+'/__settings_fixture/'+css.fileName});
 await page.addScriptTag({type:'module',url:origin+'/__settings_fixture/settings.js'});
 await page.waitForFunction(()=>!!globalThis.SettingsFixture);
 const project=await page.evaluate(async()=>{
  const p=await SettingsFixture.documentRequest('cad','project_create',{name:'Browser settings',operation_id:'browser-project'});
  const b=await SettingsFixture.documentRequest('cad','branch_create',{id:p.id,name:'Design',operation_id:'browser-branch',expected_revision:1,from_revision:1});
  SettingsFixture.show(p.id,b.branch_id,'units');return {id:p.id,branch:b.branch_id};
 });
 await page.locator('#unit-length').selectOption('in');
 const saved=page.waitForResponse(r=>r.url().endsWith('/api/library/cad_operation'));
 await page.getByRole('button',{name:'Save',exact:true}).click();
 const reply=await saved; assert.equal(reply.status(),200);assert.equal(reply.request().postDataJSON().branch,project.branch);assert.ok(reply.request().postDataJSON().operation_id);
 // Query through the same browser session after its actual reload.
 const request=async(action,data)=>{const r=await context.request.post(origin+'/api/library/'+action,{headers:{origin},data:{app:'cad',...data}});assert.equal(r.status(),200,await r.text());return r.json();};
 const branch=await request('cad_metadata',{id:project.id,branch:project.branch});
 const main=await request('cad_metadata',{id:project.id});
 assert.equal(branch.revision,2);assert.equal(branch.settings.units.length.unit,'in');assert.notEqual(main.settings.units.length.unit,'in');assert.equal(main.revision,1);
 const remount=async(id,action,revision)=>{
  await page.getByText('Reloaded saved CAD document').waitFor();
  await page.goto(origin+'/healthz');
  await page.addScriptTag({type:'module',url:origin+'/__settings_fixture/settings.js'});
  await page.waitForFunction(()=>!!globalThis.SettingsFixture);
  await page.evaluate(({id,action,revision})=>SettingsFixture.show(id,'Main',action,revision),{id,action,revision});
 };
 const folder=await request('create',{operation_id:'browser-folder',name:'Browser destination',kind:'folder',data_base64:''});
 await remount(project.id,'move',1);
 await page.getByRole('button',{name:'▱ Browser destination',exact:true}).click();
 const moved=page.waitForResponse(r=>r.url().endsWith('/api/library/cad_operation'));
 await page.getByRole('button',{name:'Move here',exact:true}).click();
 assert.equal((await moved).status(),200);
 const movedFile=await request('read',{id:project.id});assert.equal(movedFile.parent,folder.id);
 const old={format:'aether-part',formatVersion:3,documentId:'browser-source',name:'Linked browser source',features:[]};
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64');
 const source=await request('create',{operation_id:'browser-source',name:'Source.acpart',data_base64:encode(old)});
 const linked=await request('project_edit',{id:project.id,expected_revision:movedFile.revision,operation_id:'browser-link',operation:'link_part',source_id:source.id,source_revision:1});
 await request('save',{id:source.id,expected_revision:1,operation_id:'browser-source-new',data_base64:encode({...old,name:'Changed source'})});
 await remount(project.id,'update',linked.revision);
 await page.getByRole('checkbox').check();
 const refreshed=page.waitForResponse(r=>r.url().endsWith('/api/library/cad_operation'));
 await page.getByRole('button',{name:'Apply selected updates',exact:true}).click();
 assert.equal((await refreshed).status(),200);
 const metadata=await request('cad_metadata',{id:project.id});assert.equal(metadata.updates[0].current,2);
 console.log(JSON.stringify({browser:'Chromium',actualReactSettingsDialog:true,units:'in',branchSaved:true,mainUnchangedByBranchEdit:true,folderMove:true,linkedSourceRefresh:true}));
}finally{await browser.close();}
