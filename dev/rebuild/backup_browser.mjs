// Built Studio against disposable native HTTP/PostgreSQL. No network mocks.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const [origin,cookie]=process.argv.slice(2);
const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext();
  await context.addCookies([{name:'aether_native_session',value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
  const page=await context.newPage();page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/?workspace=admin&section=backups');
  await page.getByRole('heading',{name:'Backups',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Backup destination on server',{exact:true}).count(),0);
  await page.getByLabel('Automatic backups',{exact:true}).selectOption('24');
  await page.getByRole('button',{name:'Save backup settings',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Backup settings saved.'}).waitFor();
  await page.getByRole('button',{name:'Create backup',exact:true}).click();
  const link=page.getByRole('link',{name:'Download',exact:true});
  await link.waitFor();
  const [download]=await Promise.all([page.waitForEvent('download'),link.click()]);
  assert.equal(await download.failure(),null);
  assert.match(download.suggestedFilename(),/^studio-[0-9a-f]{32}\.zip$/);
  await page.reload();await link.waitFor();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({actualStudioBrowser:true,create:true,verifiedDownload:true,reload:true}));
} finally {await browser.close();}
