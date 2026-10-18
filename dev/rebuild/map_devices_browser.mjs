// Qualify the existing Map Players panel against the disposable Rust host.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const [origin,cookie,code]=process.argv.slice(2);
const root=fileURLToPath(new URL('../../../Aether-Map/',import.meta.url));
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const {build}=await import(createRequire(resolve(root,'package.json')).resolve('vite'));
const entry=resolve(root,'__devices_browser.tsx');
const bundle=await build({configFile:false,root,logLevel:'error',base:'/__devices_fixture/',publicDir:false,plugins:[{
 name:'devices-fixture',resolveId(id){if(id===entry)return entry;},load(id){if(id===entry)return `
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {DeviceManager} from './src/panels/DeviceManager';
 import '@aether/ui/tokens.css';import '@aether/ui/widgets.css';
 document.body.innerHTML='<div id="root"></div>';
 createRoot(document.getElementById('root')).render(<DeviceManager documentID="browser-show" installerURL="${origin}/api/map/install.sh" dirty={false}/>);
 `;}
}],build:{write:false,minify:false,rollupOptions:{input:entry,output:{entryFileNames:'devices.js'}}}});
const outputs=(Array.isArray(bundle)?bundle:[bundle]).flatMap(v=>v.output);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 await context.addCookies([{name:'aether_native_session',value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
 const page=await context.newPage();
 await page.route(origin+'/__devices_fixture/**',route=>{const file=outputs.find(v=>v.fileName===new URL(route.request().url()).pathname.slice('/__devices_fixture/'.length));assert.ok(file);return route.fulfill({body:file.type==='chunk'?file.code:file.source,contentType:file.fileName.endsWith('.css')?'text/css':'text/javascript'});});
 await page.route(origin+'/map/index.html',route=>route.fulfill({body:'<!doctype html><html><body></body></html>',contentType:'text/html'}));
 await page.goto(origin+'/map/index.html');
 for(const css of outputs.filter(v=>v.fileName.endsWith('.css')))await page.addStyleTag({url:origin+'/__devices_fixture/'+css.fileName});
 await page.addScriptTag({type:'module',url:origin+'/__devices_fixture/devices.js'});
 await page.getByRole('button',{name:'Pair a device',exact:true}).click();
 await page.getByPlaceholder('000000').fill(code);
 async function clickAndCheck(name,endpoint){const result=page.waitForResponse(r=>r.url().endsWith('/api/map/devices/'+endpoint));await page.getByRole('button',{name,exact:true}).click();assert.equal((await result).status(),200);}
 await clickAndCheck('Pair','claim');
 await page.getByRole('button',{name:'Rename Workshop Pi',exact:true}).click();
 await page.getByRole('dialog',{name:'Rename device'}).getByRole('textbox').fill('Browser projector');
 await clickAndCheck('Rename','rename');
 await page.getByRole('button',{name:'Rename Browser projector',exact:true}).waitFor();
 await clickAndCheck('Deploy this show','assign');
 await page.getByText('Assignment saved.',{exact:false}).waitFor();
 await clickAndCheck('Stop','assign');
 await page.getByRole('button',{name:'Stop',exact:true}).waitFor({state:'detached'});
 await clickAndCheck('Forget Browser projector','forget');
 await page.getByText('No devices yet',{exact:true}).waitFor();
 console.log(JSON.stringify({browser:'Chromium',actualMapPlayersPanel:true,pair:true,rename:true,assign:true,stop:true,forget:true,physicalPi:false}));
}finally{await browser.close();}
