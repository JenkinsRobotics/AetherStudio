// External HTTP MCP controls the actual open product editors; no model fixture.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
export async function verifyLiveEditors(page,origin,evidence,mcp,api,program) {
 const tool=async(name,args,op)=>{
  const r=await mcp('tools/call',{name,arguments:args,...(op?{_meta:{'aether/operationId':op}}:{})});
  assert.equal(r.result?.isError,false,JSON.stringify(r));return r.result;
 };
 const create=(app,name,doc)=>api('/api/library/create',{app,kind:'file',scope:'personal',operation_id:randomUUID(),name,data_base64:Buffer.from(JSON.stringify(doc)).toString('base64')});
 const saved=async(app,id,test)=>{
  for(let i=0;i<100;i++){
   const file=await api('/api/library/read',{app,id});const doc=JSON.parse(Buffer.from(file.data_base64,'base64').toString());
   if(test(doc))return doc;await page.waitForTimeout(150);
  }throw Error('Live agent edit was not saved by the ordinary editor.');
 };
 const shared=async(app,doc)=>{
  await page.getByRole('button',{name:'Share this editor',exact:true}).click();
  await page.getByRole('button',{name:'Stop sharing editor',exact:true}).waitFor();
  for(let i=0;i<40;i++){
   const list=(await tool('editor_list',{})).structuredContent.editors;
   const editor=list.find(e=>e.document===doc&&e.app===app);
   if(editor){const info=(await tool('editor_inspect',{editor:editor.editor})).structuredContent;assert.ok(info.editor.tools.length>=16);return editor.editor;}
   await page.waitForTimeout(100);
  }throw Error('Editor did not register. '+await page.locator('.aui-live-editor-access').innerText());
 };
 const invoke=async(editor,name,args={})=>{
  const operation=randomUUID();await tool('editor_invoke',{editor,name,arguments:args,operation},operation);
  for(let i=0;i<300;i++){
   const result=await tool('editor_result',{editor,operation});const receipt=result.structuredContent.live_editor;
   if(receipt.state==='completed'){assert.equal(receipt.reply.ok,true,JSON.stringify(receipt));return {result,value:receipt.reply.value};}
   assert.ok(['queued','running'].includes(receipt.state),JSON.stringify(receipt));await page.waitForTimeout(200);
  }throw Error('Live call did not complete: '+name);
 };
 const cad=await create('cad','External live plate.acpart',{format:'aether-part',formatVersion:16,documentId:randomUUID(),name:'External live plate',units:'millimeter',features:[]});
 await page.goto(`${origin}/cad/index.html?document=${cad.id}`);
 await page.getByRole('button',{name:'AI advisor',exact:true}).waitFor({timeout:20000});
 await page.getByRole('button',{name:'AI advisor',exact:true}).click();
 const editor=await shared('cad',cad.id);
 await invoke(editor,'aether_cad_run_program',{program_json:JSON.stringify(program)});
 await saved('cad',cad.id,d=>d.features.length===4);
 const proof=(await invoke(editor,'aether_cad_verify')).value;
 assert.ok(JSON.stringify(proof).includes('volume_mm3'),JSON.stringify(proof));
 const preview=await invoke(editor,'aether_cad_preview');assert.ok(preview.result.content.some(c=>c.type==='image'&&c.mimeType==='image/png'));
 if(evidence)await page.screenshot({path:join(evidence,'external-cad-editor.png')});
 await invoke(editor,'aether_cad_undo');await saved('cad',cad.id,d=>d.features.length===0);
 await invoke(editor,'aether_cad_redo');await saved('cad',cad.id,d=>d.features.length===4);
 await page.getByRole('button',{name:'Stop sharing editor',exact:true}).click();
 assert.ok(!(await tool('editor_list',{})).structuredContent.editors.some(e=>e.editor===editor));
 const map=await create('map','External live show.aethermap',{version:7,output:{width:1920,height:1080},outputs:[],media:[],unassignedSurfaces:[],activeSceneId:'scene',playback:{mode:'once'},scenes:[{id:'scene',name:'External scene',durationS:50,surfaces:[],artboard:{widthPx:1920,heightPx:1080}}],pool:[],tracks:[],visuals:[],timelines:[]});
 await page.goto(`${origin}/map/index.html?document=${map.id}`);await page.getByRole('button',{name:'AI advisor',exact:true}).click();
 const mapEditor=await shared('map',map.id);
 await invoke(mapEditor,'aether_map_surface_create',{scene_id:'scene',name:'External surface'});
 await saved('map',map.id,d=>d.scenes[0].surfaces.length===1);
 await invoke(mapEditor,'aether_map_undo');await saved('map',map.id,d=>d.scenes[0].surfaces.length===0);
 await invoke(mapEditor,'aether_map_redo');const mapped=await saved('map',map.id,d=>d.scenes[0].surfaces.length===1);
 await invoke(mapEditor,'aether_map_surface_bounds',{scene_id:'scene',surface_id:mapped.scenes[0].surfaces[0].id,x_px:100,y_px:150,width_px:800,height_px:450});
 const placed=await saved('map',map.id,d=>d.scenes[0].surfaces[0].corners[0][0]===100);
 assert.deepEqual(placed.scenes[0].surfaces[0].corners,[[100,150],[900,150],[900,600],[100,600]]);
 const mask=await invoke(mapEditor,'aether_map_mapping_preview',{scene_id:'scene'});assert.ok(mask.result.content.some(c=>c.type==='image'));
 if(evidence)await page.screenshot({path:join(evidence,'external-map-editor.png')});
 await page.reload();await page.getByRole('button',{name:'AI advisor',exact:true}).waitFor();
 assert.ok(!(await tool('editor_list',{})).structuredContent.editors.some(e=>e.editor===mapEditor));
 await saved('map',map.id,d=>d.scenes[0].surfaces.length===1);
 const report={externalMCP:true,explicitEditorSharing:true,cadProgram:true,cadExactProof:proof,cadPNG:true,mapSurface:true,mapPNG:true,undoRedo:true,ordinaryAutosave:true,reloadEndsSharing:true,realProviderInference:false};
 if(evidence)await writeFile(join(evidence,'live-editor-browser-report.json'),JSON.stringify(report,null,2));
 return report;
}
