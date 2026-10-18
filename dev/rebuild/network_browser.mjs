import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const [origin,cookie,port]=process.argv.slice(2);
const next='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext();
  await context.addCookies([{name:'aether_native_session',value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/?workspace=admin&section=network');
  await page.getByRole('heading',{name:'Server & network',exact:true}).waitFor();
  await page.getByLabel('Workspace name',{exact:true}).fill('Native network fixture');
  await page.getByLabel('Port',{exact:true}).fill(port);
  await page.getByLabel(/^Public URL/).fill(next);
  await page.getByRole('button',{name:'Save settings',exact:true}).click();
  await page.getByRole('heading',{name:'Restart required',exact:true}).waitFor();
  await page.getByRole('button',{name:'Restart host and reconnect',exact:true}).click();
  await page.waitForURL(url=>url.origin===next);
  await page.goto(next+'/?workspace=admin&section=network');
  await page.getByRole('heading',{name:'Server & network',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Workspace name',{exact:true}).inputValue(),'Native network fixture');
  assert.equal(await page.getByRole('heading',{name:'Restart required',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({actualStudioBrowser:true,networkSave:true,restart:true,reconnect:true,sessionPreserved:true}));
} finally {await browser.close();}
