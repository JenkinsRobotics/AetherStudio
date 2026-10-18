// Actual Animation browser client against the disposable native host/engine.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const [origin, cookie, root] = process.argv.slice(2);
const require = createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium} = require('@playwright/test');
const productRequire = createRequire(resolve(root,'web/package.json'));
const {build} = productRequire('esbuild');
const compiled = await build({
  entryPoints:[resolve(root,'web/src/engine.ts')], bundle:true,write:false,
  format:'iife',globalName:'Animation',
  define:{'import.meta.env.VITE_ENGINE_URL':JSON.stringify(origin+'/animation')},
});
const text = await readFile(resolve(root,'examples/pan_tilt_head.character.anima'),'utf8');
const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext();
  await context.addCookies([{name:'aether_native_session',value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
  const page = await context.newPage();
  await page.goto(origin+'/healthz');
  await page.addScriptTag({content:compiled.outputFiles[0].text});
  const result = await page.evaluate(async text => {
    const first = await Animation.loadCharacter(text);
    const pose = await Animation.resolvePose(first.handle,{});
    const serialized = await Animation.serializeCharacter(first.rig);
    const revision = await Animation.saveFile('native-browser.character.anima',serialized.text);
    const saved = await Animation.fetchCharacterText('native-browser.character.anima');
    const reopened = await Animation.loadCharacter(saved);
    const reopenedPose = await Animation.resolvePose(reopened.handle,{});
    let conflict = false;
    try { await Animation.saveFile('native-browser.character.anima','stale',null); }
    catch(error) { conflict = error.status === 409; }
    const rpc = async (method,params) => {
      const response=await fetch('/animation/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:1,method,params})});
      const value=await response.json();
      if (!response.ok || !value.ok) throw new Error('Render RPC failed');
      return value.result;
    };
    const canvas=await rpc('canvas2d.new',{canvas:{width:16,height:16,sources:[{id:'s',kind:'image',asset:'image.png'}],surfaces:[{id:'s',source:'s'}]}});
    const render=await rpc('canvas2d.render_frame',{handle:canvas.handle});
    const image=new Image(); image.src='data:image/png;base64,'+render.png_base64;
    await image.decode();
    const matrix=await rpc('canvas2d.matrix_preview',{handle:canvas.handle,target:{width:1,height:1}});
    return {parts:Object.keys(pose.parts),reopenedParts:Object.keys(reopenedPose.parts),sameText:saved===serialized.text,revision,conflict,
      renderSize:[image.naturalWidth,image.naturalHeight],matrix:matrix.rows};
  },text);
  assert.ok(result.parts.length>0);
  assert.deepEqual(result.reopenedParts,result.parts);
  assert.equal(result.sameText,true);
  assert.match(result.revision,/^[a-f0-9]{64}$/);
  assert.equal(result.conflict,true);
  assert.deepEqual(result.renderSize,[16,16]);
  assert.deepEqual(result.matrix,[[[255,0,0]]]);
  console.log(JSON.stringify({browser:'Chromium',actualAnimationClient:true,load:true,resolvePose:true,serialize:true,saveReopen:true,staleSaveRejected:true,rasterImageDecode:true,matrixPixels:true}));
} finally { await browser.close(); }
