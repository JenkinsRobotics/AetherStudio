// Built CAD + real native geometry + provider tool round-trips. Only the model
// decisions and credentials are fixtures; never use this login on a live server.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {verifyEditorAgents} from './editor_agents_browser.mjs';
const {chromium}=createRequire(new URL('../../core/files/package.json',import.meta.url))('@playwright/test');
const origin=process.env.AETHER_TEST_ORIGIN,evidence=process.env.AETHER_FRONTEND_EVIDENCE;
assert.equal(new URL(origin).hostname,'127.0.0.1');
const browser=await chromium.launch({headless:true});
const errors=[];
let page;
try {
  if(evidence)await mkdir(evidence,{recursive:true});
  page=await browser.newPage({viewport:{width:1600,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/cad/');
  await page.locator('input[name="username"]').fill('editor');
  await page.locator('input[name="password"]').fill('account-test-password-2026');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForURL(origin+'/cad/',{timeout:45000});
  const results=await verifyEditorAgents(page,origin,evidence,{cadOnly:true});
  assert.deepEqual(errors,[]);
  if(evidence)await writeFile(join(evidence,'cad-browser-report.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
}catch(error){
  if(evidence&&page){await page.screenshot({path:join(evidence,'cad-browser-failure.png')});await writeFile(join(evidence,'cad-browser-failure.txt'),await page.locator('body').innerText());}
  throw error;
}finally{await browser.close();}
