// Real Studio consent UI + HTTP MCP + FreeCAD, exclusively on a disposable host.
import assert from 'node:assert/strict';
import {verifyLiveEditors} from './live_editors_browser.mjs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const {chromium} = createRequire(new URL('../../core/files/package.json', import.meta.url))('@playwright/test');
const origin = process.env.AETHER_TEST_ORIGIN, evidence = process.env.AETHER_FRONTEND_EVIDENCE;
assert.equal(new URL(origin).hostname, '127.0.0.1');
let received;
const callback = createServer((req, res) => { received = new URL(req.url, 'http://localhost'); res.end('Aether connected. You can close this window.'); });
await new Promise(resolve => callback.listen(0, '127.0.0.1', resolve));
const redirect = `http://127.0.0.1:${callback.address().port}/callback`;
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:1000}}), errors = [];
page.on('pageerror', e => errors.push(e.message));
const verifier = 'aether-browser-fixture-012345678901234567890123456789';
const json = async response => { const data=await response.json(); assert.equal(response.ok,true,JSON.stringify(data)); return data; };
const post = (path, body, headers={}) => fetch(origin+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
try {
  if(evidence) await mkdir(evidence,{recursive:true});
  const registration=await json(await post('/oauth/register',{client_name:'CAD test assistant',redirect_uris:[redirect],token_endpoint_auth_method:'none'}));
  const parameters=new URLSearchParams({client_id:registration.client_id,redirect_uri:redirect,response_type:'code',resource:origin+'/mcp',state:'browser-state',code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')});
  await page.goto(origin+'/oauth/authorize?'+parameters);
  await page.locator('input[name="username"]').fill('editor');
  await page.locator('input[name="password"]').fill('account-test-password-2026');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('heading',{name:'Connect to Aether',exact:true}).waitFor({timeout:45000});
  await page.getByText('CAD test assistant',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Allow connection',exact:true}).isEnabled(),false);
  await page.getByRole('checkbox',{name:'Aether CAD',exact:true}).check();
  await page.getByRole('checkbox',{name:'Aether Map',exact:true}).check();
  await page.getByLabel('Permission',{exact:true}).selectOption('content');
  if(evidence) await page.screenshot({path:join(evidence,'agent-consent.png')});
  await page.getByRole('button',{name:'Allow connection',exact:true}).click();
  await page.waitForURL(redirect+'?**');
  assert.equal(received.searchParams.get('state'),'browser-state');
  const exchanged=await json(await fetch(origin+'/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:registration.client_id,redirect_uri:redirect,resource:origin+'/mcp',code:received.searchParams.get('code'),code_verifier:verifier})}));
  const mcp=async(method,params)=>json(await post('/mcp',{jsonrpc:'2.0',id:randomUUID(),method,params},{authorization:'Bearer '+exchanged.access_token,'mcp-protocol-version':'2025-11-25'}));
  const initialized=await mcp('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'browser-fixture',version:'1'}});
  assert.equal(initialized.result.protocolVersion,'2025-11-25');
  const tools=(await mcp('tools/list',{})).result.tools;
  assert.ok(tools.some(t=>t.name==='cad_part_runprogram'));
  assert.ok(tools.some(t=>t.name.startsWith('map_')));
  await page.goto(origin+'/?account=1');
  const api=(path,data)=>page.evaluate(async({path,data})=>{
    const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}); const result=await r.json(); if(!r.ok)throw Error(JSON.stringify(result));return result;
  },{path,data});
  const doc={format:'aether-part',formatVersion:16,documentId:randomUUID(),name:'MCP plate',units:'millimeter',features:[]};
  const file=await api('/api/library/create',{app:'cad',kind:'file',scope:'personal',operation_id:randomUUID(),name:'MCP plate.acpart',data_base64:Buffer.from(JSON.stringify(doc)).toString('base64')});
  const program={version:1,steps:[
    {id:'outline',tool:'aether_cad_sketch_rectangle',arguments:{plane:'XY',x_mm:0,y_mm:0,width_mm:80,height_mm:50}},
    {id:'plate',tool:'aether_cad_extrude',arguments:{profile_id:{$ref:'outline.feature_id'},depth_mm:10,operation:'new'}},
    {id:'circle',tool:'aether_cad_sketch_circle',arguments:{plane:'XY',offset_mm:10,center_x_mm:40,center_y_mm:25,radius_mm:5}},
    {id:'bore',tool:'aether_cad_extrude',arguments:{profile_id:{$ref:'circle.feature_id'},depth_mm:10,operation:'cut',target_body_id:{$ref:'plate.body_id'}}}
  ]};
  const built=await mcp('tools/call',{name:'cad_part_runprogram',arguments:{app:'cad',id:file.id,expected_revision:1,program_json:JSON.stringify(program)},_meta:{'aether/operationId':'oauth-native-plate'}});
  assert.equal(built.result?.isError,false,JSON.stringify(built));
  const proof=await mcp('tools/call',{name:'cad_part_verify',arguments:{app:'cad',id:file.id,density_kg_m3:7800}});
  assert.equal(proof.result?.isError,false,JSON.stringify(proof));
  const saved=await api('/api/library/read',{app:'cad',id:file.id});
  const document=JSON.parse(Buffer.from(saved.data_base64,'base64').toString());
  assert.equal(document.features.length,4);
  const values=proof.result.structuredContent;
  const bodies=values.result?.measurements;
  assert.ok(bodies,JSON.stringify(values));
  const volume=bodies[0].volume_mm3;
  assert.ok(Math.abs(volume-(40000-Math.PI*25*10))<0.00001);
  const liveEditors=await verifyLiveEditors(page,origin,evidence,mcp,api,program);
  const connections=await api('/api/automation/connections/list',{});
  const grant=connections.connections.find(c=>c.label==='CAD test assistant');
  assert.deepEqual([...grant.apps].sort(),['cad','map']);
  await api('/api/automation/connections/revoke',{id:grant.id});
  assert.equal((await post('/mcp',{jsonrpc:'2.0',id:1,method:'ping'},{authorization:'Bearer '+exchanged.access_token})).status,401);
  // Denying a second request returns to the client without creating another grant.
  await page.goto(origin+'/oauth/authorize?'+parameters);
  await page.getByRole('heading',{name:'Connect to Aether',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.waitForURL(redirect+'?**');
  assert.equal(received.searchParams.get('error'),'access_denied');
  await page.goto(origin+'/?section=plugins');
  await page.getByRole('heading',{name:'Agent access',exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'MCP server URL',exact:true}).inputValue(),origin+'/mcp');
  if(evidence)await page.locator('section.agent-connections').screenshot({path:join(evidence,'agent-connections.png')});
  assert.deepEqual(errors,[]);
  const report={liveEditors,signIn:true,consent:true,explicitApps:true,pkceExchange:true,httpMCP:true,cadProgram:true,nativeVolumeMm3:volume,savedFeatures:4,revocation:true,cancel:true,realProviderInference:false};
  if(evidence)await writeFile(join(evidence,'agent-access-browser-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}catch(error){
  if(evidence){await page.screenshot({path:join(evidence,'agent-access-failure.png')});await writeFile(join(evidence,'agent-access-failure.txt'),JSON.stringify(errors)+'\n'+await page.locator('body').innerText());}
  throw error;
}finally{await browser.close();callback.close();}
