import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const [origin,secret]=process.argv.slice(2);
const browser=await chromium.launch({headless:true});
let page;
try {
  page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#setup='+secret);
  await page.getByRole('button',{name:'Let’s get started'}).click();
  await page.getByLabel('Workspace name',{exact:true}).fill('Browser Company');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Full name',{exact:true}).fill('Browser Administrator');
  await page.getByLabel('Email address',{exact:true}).fill('browser@example.test');
  await page.getByLabel('Administrator username',{exact:true}).fill('browseradmin');
  await page.getByLabel('Password',{exact:true}).fill('browser-first-run-password-2026');
  await page.getByLabel('Confirm password',{exact:true}).fill('browser-first-run-password-2026');
  await page.getByText('Setup authorized on this host. No code to enter.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Finish setup'}).click();
  await page.getByRole('heading',{name:'Browser Company is ready.',exact:true}).waitFor();
  const state=await page.evaluate(async()=>(await fetch('/api/status')).json());
  assert.equal(state.name,'Browser Company');assert.equal(state.user.role,'admin');assert.equal(state.apps.some(a=>a.id==='map'),true);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({browser:'Chromium',actualStudioSetup:true,operatorKey:true,createAdmin:true,signIn:true,selectedApps:true}));
}catch(error){
  console.error(JSON.stringify({body:await page.locator('body').innerText(),status:await page.evaluate(async()=>(await fetch('/api/status')).json())}));
  throw error;
}finally{await browser.close();}
