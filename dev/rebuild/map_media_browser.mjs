// Existing Map upload/read/delete adapter against real disposable native HTTP.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const [origin,cookie]=process.argv.slice(2);
const root=fileURLToPath(new URL('../../../Aether-Map/',import.meta.url));
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const {build}=await import(createRequire(resolve(root,'package.json')).resolve('vite'));
const entry=resolve(root,'__media_browser.ts');
const bundle=await build({configFile:false,root,logLevel:'error',base:'/__media_fixture/',publicDir:false,plugins:[{
 name:'media-fixture',resolveId(id){if(id===entry)return entry;},load(id){if(id===entry)return `import {uploadMedia,mediaUrl,deleteMedia} from './src/api'; window.mediaAdapter={uploadMedia,mediaUrl,deleteMedia};`;}
}],build:{write:false,minify:false,rollupOptions:{input:entry,output:{entryFileNames:'media.js'}}}});
const outputs=(Array.isArray(bundle)?bundle:[bundle]).flatMap(v=>v.output);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 await context.addCookies([{name:'aether_native_session',value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
 const page=await context.newPage();
 await page.route(origin+'/__media_fixture/**',route=>{const file=outputs.find(v=>v.fileName===new URL(route.request().url()).pathname.slice('/__media_fixture/'.length));assert.ok(file);return route.fulfill({body:file.type==='chunk'?file.code:file.source,contentType:'text/javascript'});});
 await page.route(origin+'/map/index.html',route=>route.fulfill({body:'<!doctype html><html><body></body></html>',contentType:'text/html'}));
 await page.goto(origin+'/map/index.html');
 await page.addScriptTag({type:'module',url:origin+'/__media_fixture/media.js'});
 await page.waitForFunction(()=>!!window.mediaAdapter);
 const result=await page.evaluate(async()=>{
   const {uploadMedia,mediaUrl,deleteMedia}=window.mediaAdapter;
   const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;canvas.getContext('2d').fillRect(0,0,8,8);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   await uploadMedia(new File([blob],'preview.png',{type:'image/png'}),'browser.png');
   const image=new Image();image.src=mediaUrl({file:'browser.png'});await image.decode();
   const dimensions=[image.naturalWidth,image.naturalHeight];
   const range=await fetch(image.src,{headers:{Range:'bytes=0-7'}});
   const signature=Array.from(new Uint8Array(await range.arrayBuffer()));
   const deleted=await deleteMedia('browser.png');
   const missing=(await fetch(image.src)).status;
   return {dimensions,signature,range:range.status,deleted,missing};
 });
 assert.deepEqual(result,{dimensions:[8,8],signature:[137,80,78,71,13,10,26,10],range:206,deleted:true,missing:404});
 console.log(JSON.stringify({browser:'Chromium',actualMapMediaAdapter:true,...result}));
}finally{await browser.close();}
