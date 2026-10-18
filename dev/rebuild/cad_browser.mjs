// Disposable native host qualification using the CAD editor's actual browser adapters.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import assert from 'node:assert/strict';
const [origin, cookie, fixture] = process.argv.slice(2);
const root=resolve(dirname(fixture),'../../..');
const require=createRequire(new URL('../../core/files/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const cadRequire=createRequire(resolve(root,'package.json'));
const {build}=cadRequire('esbuild');
const compiled=await build({stdin:{contents:`export {buildWithFreeCAD,describeGeometryEngine} from './src/freecad-geometry'; export {solveAssembly,assemblyMateKinds} from './src/freecad-assembly';`,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'iife',globalName:'CAD'});
const requests=JSON.parse(await readFile(resolve(dirname(fixture),'browser-requests.json'),'utf8'));
const browser=await chromium.launch({headless:true});
try {
    const context=await browser.newContext();
    await context.addCookies([{name:'aether_native_session',value:cookie,url:origin,httpOnly:true,sameSite:'Strict'}]);
    const page=await context.newPage();
    await page.goto(origin+'/healthz');
    await page.addScriptTag({content:compiled.outputFiles[0].text});
    const result=await page.evaluate(async ({requests})=>{
        const engine=await CAD.describeGeometryEngine();
        const part=await CAD.buildWithFreeCAD(requests.geometry.features);
        const kinds=await CAD.assemblyMateKinds();
        const assembly=await CAD.solveAssembly(requests.assembly);
        const exported=await fetch('/api/cad/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(requests.export)}).then(r=>r.json());
        const analysis=await fetch('/api/cad/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(requests.analysis)}).then(r=>r.json());
        return {engine,volume:part.volumeMillimetersCubed,parts:part.parts.length,kinds,assembly,exportPrefix:atob(exported.data_base64).slice(0,13),section:analysis.bodies[0].volume_mm3};
    },{requests});
    assert.equal(result.engine.ok,true);
    assert.equal(result.engine.command,undefined);
    assert.ok(Math.abs(result.volume-1000)<1e-6);
    assert.equal(result.parts,1);
    assert.ok(result.kinds.includes('fastened'));
    assert.equal(result.assembly.status,'ok');
    assert.ok(result.assembly.instances[1].placement_mm.every(x=>Math.abs(x)<1e-6));
    assert.equal(result.exportPrefix,'ISO-10303-21;');
    assert.ok(Math.abs(result.section-400)<1e-6);
    console.log(JSON.stringify({browser:'Chromium',actualCadClient:true,geometryVolume_mm3:result.volume,sectionVolume_mm3:result.section,assembly:'fastened mate solved',export:'STEP',engine:result.engine.engine}));
} finally {await browser.close();}
