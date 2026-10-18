// Actual built CAD/Sketch/Map + native HTTP/provider job + real FreeCAD rebuild.
// Only the model is scripted. Every operation runs through the shipped editor.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {verifyAssemblyRecipes} from './cad_assembly_browser.mjs';

export async function verifyEditorAgents(page,origin,evidence,{cadOnly=false}={}) {
  // Retain only this disposable fixture's receipts; no real provider/account data.
  const receipts=[];
  const record=request=>{if(new URL(request.url()).pathname==='/api/agent/tool_result'){
    const data=request.postDataJSON();receipts.push({...data,result:{...data.result,images:data.result.images?.map(({width,height,mimeType})=>({width,height,mimeType}))}});
  }};
  page.on('request',record);
  const call=async(path,data)=>page.evaluate(async({path,data})=>{
    const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!response.ok)throw Error(`${path}: ${response.status}`);return response.json();
  },{path,data});
  if(cadOnly)await call('agent/install',{provider:'chatgpt'});
  await call('agent/enable',{provider:'chatgpt'});
  const login=await call('agent/login',{provider:'chatgpt'});
  for(let i=0;i<100;i++){
    const job=await call('agent/job',{id:login.id});if(job.login)break;
    await page.waitForTimeout(30);
  }
  await call('agent/code',{id:login.id,code:'editor-fixture'});
  for(let i=0;i<100;i++){
    const job=await call('agent/job',{id:login.id});if(job.state==='completed')break;
    await page.waitForTimeout(30);
  }
  const create=async(app,filename,doc)=>call('library/create',{app,kind:'file',scope:'personal',operation_id:randomUUID(),name:filename,data_base64:Buffer.from(JSON.stringify(doc)).toString('base64')});
  const read=async(app,id)=>{const file=await call('library/read',{app,id});return JSON.parse(Buffer.from(file.data_base64,'base64').toString());};
  const saved=async(app,id,predicate)=>{
    for(let i=0;i<120;i++){const doc=await read(app,id);if(predicate(doc))return doc;await page.waitForTimeout(100);}
    throw Error('Agent edit was not saved by the normal document client.');
  };
  const send=async(prompt)=>{
    const input=page.getByRole('textbox',{name:'Ask Aether Agent',exact:true});
    await input.waitFor();
    for(let i=0;i<100&&await input.isDisabled();i++)await page.waitForTimeout(50);
    await input.fill(prompt);
    const previous=await page.getByText('Verified '+prompt,{exact:true}).count();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    try {
      await page.waitForFunction(({text,previous})=>[...document.querySelectorAll('[role=log]')].some(node=>(node.textContent?.split(text).length??1)-1>previous) ||
        [...document.querySelectorAll('[role=status]')].some(node=>node.textContent?.includes('provider request failed')), {text:'Verified '+prompt,previous}, {timeout:90000});
      await page.getByText('Verified '+prompt,{exact:true}).nth(previous).waitFor({timeout:5000});
    } catch(error) {
      if(evidence)await writeFile(join(evidence,'editor-tool-receipts.json'),JSON.stringify(receipts,null,2));
      throw error;
    }
    await page.getByRole('button',{name:'Stop response',exact:true}).waitFor({state:'hidden'});
  };
  const previewPixels=async(name,points)=>{
    const image=page.locator('img[alt="Preview sent to agent"]').last();
    const result=await image.evaluate(async(img,points)=>{
      await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
      const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
      return {width:c.width,height:c.height,source:img.src,pixels:points.map(([x,y])=>[...ctx.getImageData(Math.floor(x*c.width),Math.floor(y*c.height),1,1).data])};
    },points);
    assert.ok(result.width<=1024&&result.height<=1024);
    if(evidence)await writeFile(join(evidence,name+'.png'),Buffer.from(result.source.split(',')[1],'base64'));
    return result.pixels;
  };
  const cad=await create('cad','Agent fixture.acpart',{format:'aether-part',formatVersion:3,documentId:randomUUID(),name:'Agent fixture',units:'millimeter',features:[]});
  await page.goto(`${origin}/cad/index.html?document=${cad.id}`);
  // The startup status message can be replaced by viewport initialization;
  // use the actual document identity and rendered bodies as readiness evidence.
  await page.getByRole('button',{name:'Document name and actions',exact:true}).filter({hasText:'Agent fixture'}).waitFor({timeout:90000});
  await page.getByRole('button',{name:'AI advisor',exact:true}).click();
  await send('cad-create-editor-fixture');
  const solid=await saved('cad',cad.id,d=>d.features.length===2);
  assert.equal(solid.features[1].distanceMillimeters,5);
  assert.equal(await page.locator('.cad-parts-list [role="option"]').count(),1);
  if(evidence)await page.screenshot({path:join(evidence,'agent-cad-solid.png')});
  await send('cad-undo-editor-fixture');await saved('cad',cad.id,d=>d.features.length===1);
  assert.equal(await page.locator('.cad-parts-list [role="option"]').count(),0);
  await send('cad-redo-editor-fixture');await saved('cad',cad.id,d=>d.features.length===2);
  await page.reload();
  await page.locator('.cad-parts-list [role="option"]').first().waitFor({timeout:90000});
  assert.equal(await page.locator('.cad-parts-list [role="option"]').count(),1);
  // Discover all six domains through the real tray, including declared gaps.
  await page.getByRole('tab',{name:'Features',exact:true}).click();
  for(const domain of ['Part','Assembly','Sketch','Curve','Solid','Drawing'])
    assert.equal(await page.getByRole('button',{name:domain+' tools',exact:true}).count(),1);
  await page.getByRole('button',{name:'Solid tools',exact:true}).click();
  await page.getByRole('menuitem',{name:'Create',exact:true}).click();
  await page.getByRole('menuitem',{name:'Cone',exact:true}).click();
  const coneDialog=page.getByRole('dialog',{name:'Cone',exact:true});
  await coneDialog.waitFor();
  assert.equal(await coneDialog.getByLabel('Radius',{exact:true}).inputValue(),'10');
  await coneDialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox',{name:'Search CAD commands',exact:true}).fill('cone');
  await page.getByRole('option',{name:/Cone/}).click();
  await coneDialog.waitFor();
  await coneDialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Part tools',exact:true}).click();
  await page.getByRole('menuitem',{name:'Additional construction',exact:true}).click();
  assert.equal(await page.getByRole('menuitem',{name:'Work axis',exact:true}).isDisabled(),true);
  await page.keyboard.press('Escape');
  if(evidence)await page.screenshot({path:join(evidence,'cad-feature-domains.png')});
  // Both feature additions form one normal history edit through the agent.
  if(!await page.getByRole('textbox',{name:'Ask Aether Agent',exact:true}).isVisible())
    await page.getByRole('button',{name:'AI advisor',exact:true}).click();
  await send('cad-cone-editor-fixture');
  const cone=await saved('cad',cad.id,d=>d.features.length===4);
  assert.equal(cone.features[3].type,'revolve');
  assert.deepEqual(cone.features[2].profile.pointsMillimeters,[[0,0],[8,0],[0,24]]);
  assert.equal(await page.locator('.cad-parts-list [role="option"]').count(),2);
  await send('cad-undo-editor-fixture');await saved('cad',cad.id,d=>d.features.length===2);
  await send('cad-redo-editor-fixture');await saved('cad',cad.id,d=>d.features.length===4);
  await page.reload();
  await page.locator('.cad-parts-list [role="option"]').nth(1).waitFor({timeout:90000});
  assert.equal(await page.locator('.cad-parts-list [role="option"]').count(),2);
  if(evidence)await page.screenshot({path:join(evidence,'agent-cad-cone-reopened.png')});
  const plate=await create('cad','CAD AI plate.acpart',{format:'aether-part',formatVersion:3,documentId:randomUUID(),name:'CAD AI plate',units:'millimeter',features:[]});
  await page.goto(`${origin}/cad/index.html?document=${plate.id}`);
  await page.getByRole('button',{name:'Document name and actions',exact:true}).filter({hasText:'CAD AI plate'}).waitFor({timeout:90000});
  await page.getByRole('button',{name:'AI advisor',exact:true}).click();
  await send('cad-program-editor-fixture');const plateDocument=await saved('cad',plate.id,d=>d.features.length===4);
  await page.locator('.cad-parts-list [role="option"]').first().waitFor();
  // Frame the actual result as a user would; preview itself must not move it.
  await page.locator('canvas.viewport-canvas').focus();await page.keyboard.press('f');
  await send('cad-preview-editor-fixture');
  const pixels=await previewPixels('agent-cad-proof',[[.2,.2],[.5,.5],[.8,.8]]);
  assert.ok(pixels.every(p=>p[3]===255));assert.ok(new Set(pixels.map(p=>p.join(','))).size>1,'CAD snapshot contains no visible model');
  assert.deepEqual(await read('cad',plate.id),plateDocument);
  await send('cad-undo-editor-fixture');await saved('cad',plate.id,d=>d.features.length===0);
  await send('cad-redo-editor-fixture');await saved('cad',plate.id,d=>d.features.length===4);
  await page.reload();await page.locator('.cad-parts-list [role="option"]').first().waitFor({timeout:90000});
  const assemblyRecipes=await verifyAssemblyRecipes(page,origin,evidence,call,send);
  if(!cadOnly){
  const sketch=await create('sketch','Agent drawing.aethersketch',{format:'aethersketch',version:2,widthPx:1200,heightPx:800,layers:[{id:randomUUID(),name:'Layer 1',visible:true,locked:false,paths:[]}]});
  await page.goto(`${origin}/sketch/index.html?document=${sketch.id}`);
  await page.getByRole('button',{name:'AI advisor',exact:true}).click();
  await send('sketch-create-editor-fixture');
  await saved('sketch',sketch.id,d=>d.layers[0].paths.length===2);
  assert.equal(await page.locator('svg.sketch-canvas g[data-path-id]').count(),2);
  if(evidence)await page.screenshot({path:join(evidence,'agent-sketch-drawing.png')});
  const beforePreview=await read('sketch',sketch.id);
  await send('sketch-preview-editor-fixture');
  assert.deepEqual(await previewPixels('agent-sketch-preview',[[150/1200,150/800],[480/1200,180/800],[.8,.8]]),[[52,86,170,255],[238,136,85,255],[255,255,255,255]]);
  assert.deepEqual(await read('sketch',sketch.id),beforePreview);
  await send('sketch-undo-editor-fixture');await saved('sketch',sketch.id,d=>d.layers[0].paths.length===0);
  await send('sketch-redo-editor-fixture');await saved('sketch',sketch.id,d=>d.layers[0].paths.length===2);
  await page.reload();await page.locator('svg.sketch-canvas g[data-path-id]').first().waitFor();
  assert.equal(await page.locator('svg.sketch-canvas g[data-path-id]').count(),2);
  const map=await create('map','Agent show.aethermap',{version:7,output:{width:1920,height:1080},outputs:[],media:[],unassignedSurfaces:[],activeSceneId:'scene',
    playback:{mode:'once'},scenes:[{id:'scene',name:'Agent scene',durationS:50,surfaces:[],artboard:{widthPx:1920,heightPx:1080}}],
    pool:[{id:'red',name:'Red',source:{mediaId:null,rect:[0,0,1920,1080],fill:'#ff0000'}}],tracks:[],visuals:[],timelines:[]});
  await page.goto(`${origin}/map/index.html?document=${map.id}`);
  await page.getByRole('button',{name:'AI advisor',exact:true}).click();
  await send('map-create-editor-fixture');
  const mapped=await saved('map',map.id,d=>d.scenes[0].surfaces.length===1&&d.visuals.some(v=>v.assetID==='red'));
  assert.deepEqual(mapped.scenes[0].surfaces[0].corners,[[100,150],[900,150],[900,600],[100,600]]);
  assert.ok(mapped.timelines.some(t=>t.surfaceID===mapped.scenes[0].surfaces[0].id));
  if(evidence)await page.screenshot({path:join(evidence,'agent-map-surface.png')});
  const beforeMask=await read('map',map.id);
  await send('map-preview-editor-fixture');
  assert.deepEqual(await previewPixels('agent-map-mask-preview',[[500/1920,300/1080],[10/1920,10/1080]]),[[255,255,255,255],[0,0,0,255]]);
  assert.deepEqual(await read('map',map.id),beforeMask);
  await send('map-undo-editor-fixture');await saved('map',map.id,d=>!d.visuals.some(v=>v.assetID==='red'));
  await send('map-redo-editor-fixture');await saved('map',map.id,d=>d.visuals.some(v=>v.assetID==='red'));
  await page.reload();
  await page.getByRole('button',{name:'AI advisor',exact:true}).waitFor();
  if(!await page.getByRole('textbox',{name:'Ask Aether Agent',exact:true}).isVisible())await page.getByRole('button',{name:'AI advisor',exact:true}).click();
  await send('map-inspect-editor-fixture');
  assert.deepEqual((await read('map',map.id)).scenes[0].surfaces[0].corners,[[100,150],[900,150],[900,600],[100,600]]);
  }
  await call('agent/disable',{provider:'chatgpt'});
  // Reloading the editor refreshes its model catalogue. Stop that job before
  // disconnecting; the host deliberately returns 409 while processes exit.
  await page.goto(origin);
  await page.waitForFunction(async()=>{
    const response=await fetch('/api/agent/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'chatgpt'})});
    if(response.status===409)return false;
    if(!response.ok)throw Error('Fixture disconnect failed: '+response.status);
    return true;
  });
  page.off('request',record);
  if(evidence)await writeFile(join(evidence,'editor-tool-receipts.json'),JSON.stringify(receipts,null,2));
  return {assemblyRecipes,cadAIProgram:true,cadExactProof:true,cadViewportProof:true,cadSketch:true,cadNativeSolid:true,...(!cadOnly?{drawingShapes:true,drawingPixels:true,mapMaskPixels:true,mapSurfaces:true,mapComposition:true}:{}),undo:true,redo:true,saveReopen:true,scriptedModel:true};
}
