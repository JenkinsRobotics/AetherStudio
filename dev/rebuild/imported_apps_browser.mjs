// Imported ownership sessions are test-only, supplied privately by the rehearsal.
// No original password or credential is logged; no external device is contacted.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const input=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.equal(new URL(input.origin).hostname,'127.0.0.1');
assert.ok(!['8780','8781'].includes(new URL(input.origin).port));
const output=dirname(process.argv[2]);
const browser=await chromium.launch({headless:true});
const report={browser:'Chromium',mapEditors:0,cadEditors:0,cadSolidBodies:0,externalRequestsBlocked:0,pageErrors:[],apiFailures:[]};
try {
  for (const [index,account] of input.accounts.entries()) {
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addCookies([{name:'aether_native_session',value:account.token,url:input.origin,httpOnly:true,sameSite:'Strict'}]);
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if (url.origin===input.origin || ['data:','blob:'].includes(url.protocol)) return route.continue();
      report.externalRequestsBlocked++;return route.abort();
    });
    const page=await context.newPage();
    page.on('pageerror',error=>report.pageErrors.push(error.message));
    page.on('response',response=>{
      const url=new URL(response.url());
      if (url.origin===input.origin && url.pathname.startsWith('/api/') && response.status()>=400) report.apiFailures.push(`${response.status()} ${url.pathname}`);
    });
    for (const app of ['map','cad']) {
      if (!account[app]) continue;
      await page.goto(`${input.origin}/${app}/index.html?document=${encodeURIComponent(account[app])}`);
      if (app==='map') await page.locator('svg.map-overlay').first().waitFor({timeout:45000});
      else {
        // The shell renders before FreeCAD finishes rebuilding the saved file.
        // A loading overlay is not evidence that its geometry actually opened.
        await page.waitForTimeout(4000);
        await page.screenshot({path:join(output,`cad-opening-${index}.png`)});
        await writeFile(join(output,`cad-opening-${index}.json`),JSON.stringify(await page.evaluate(()=>({
          text:document.body.innerText,
          parts:document.querySelector('.cad-parts-list')?.outerHTML,
        }))),{mode:0o600});
        // Imported project containers may intentionally open an empty Part Studio.
        // Require the completed native rebuild, not a body in every document.
        await page.waitForFunction(()=>/Opened .+ from your server\. FreeCAD rebuilt \d+ history entries/.test(document.body.innerText),null,{timeout:90000});
        await page.getByText('Rebuilding exact feature history',{exact:true}).waitFor({state:'hidden',timeout:90000});
        report.cadSolidBodies+=await page.locator('.cad-parts-list [role="option"]').count();
      }
      // Allow initial asset/engine requests and automatic document normalization.
      await page.waitForTimeout(1500);
      await page.screenshot({path:join(output,`imported-${app}-${index}.png`)});
      report[app+'Editors']++;
    }
    await context.close();
  }
  assert.ok(report.mapEditors+report.cadEditors>0);
  if (report.cadEditors) assert.ok(report.cadSolidBodies>0,'The imported CAD fixture must render at least one solid.');
  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(report.apiFailures,[]);
  await writeFile(join(output,'browser-report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(report));
} catch(error) {
  for (const [i,context] of browser.contexts().entries()) for (const [j,page] of context.pages().entries()) {
    await page.screenshot({path:join(output,`failed-${i}-${j}.png`)}).catch(()=>{});
  }
  throw error;
} finally {
  await browser.close();
}
