// Actual installed Home factory, session transport and CAD project adapter.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
const [origin,cookie,fixture]=process.argv.slice(2);
const root=resolve(dirname(fixture),'../../..');
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const {build}=createRequire(resolve(root,'package.json'))('esbuild');
async function compile(contents){return (await build({stdin:{contents,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm'})).outputFiles[0].text;}
const factory=await compile(`import {createNativeFile} from '@aether/session/library/create-native-file'; import {documentRequest} from '@aether/session/documents'; globalThis.ProjectFactory={createNativeFile,documentRequest};`);
const adapter=await compile(`import * as host from './src/host-library'; globalThis.ProjectHost=host;`);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 await context.addCookies([{name:'aether_native_session',value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
 const page=await context.newPage();
 await page.goto(origin+'/healthz');
 await page.addScriptTag({type:'module',content:factory});
 await page.waitForFunction(()=>!!globalThis.ProjectFactory);
 const opened=await page.evaluate(async()=>{
  const {createNativeFile,documentRequest}=ProjectFactory;
  const p=await createNativeFile('cad','project','Browser wheel',{});
  const fork=await documentRequest('cad','branch_create',{id:p.id,name:'Browser branch',operation_id:'browser-fork',expected_revision:1,from_revision:1});
  history.replaceState(null,'','/cad/index.html?document='+encodeURIComponent(p.id)+'&branch='+encodeURIComponent(fork.branch_id));
  return {id:p.id,branch:fork.branch_id};
 });
 await page.addScriptTag({type:'module',content:adapter});
 await page.waitForFunction(()=>!!globalThis.ProjectHost);
 const result=await page.evaluate(async({id,branch})=>{
  const file=await ProjectHost.loadHostedFile();ProjectHost.markHostedClean();
  const part=JSON.parse(await file.text());
  const changed=await ProjectHost.editHostedProject('add_part','Browser bracket');
  const url=ProjectHost.projectItemURL(changed.project.parts[1].id,'part');
  const main=await ProjectFactory.documentRequest('cad','project_read',{id});
  return {part,changed,url,main,branch};
 },opened);
 assert.equal(result.part.format,'aether-part');
 assert.equal(result.changed.project.parts.length,2);
 assert.equal(result.changed.revision,2);
 assert.equal(result.changed.branch_id,opened.branch);
 assert.equal(result.main.project.parts.length,1);
 assert.ok(result.url.includes('&branch='+opened.branch));
 console.log(JSON.stringify({browser:'Chromium',actualHomeFactory:true,actualCadProjectAdapter:true,create:'project',open:'embedded Part',edit:'add Part on branch',mainUnchanged:true}));
}finally{await browser.close();}
