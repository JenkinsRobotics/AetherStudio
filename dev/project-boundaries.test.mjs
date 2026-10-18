import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
function fixture(source, file="product/src/main.ts") {
 const root=mkdtempSync(join(tmpdir(),'aether-boundary-'));
 try {
  for(const p of ['dev','core/ui','core/session','core/sketch','core/assets','studio','product/src'])mkdirSync(join(root,p),{recursive:true});
  writeFileSync(join(root,'projects.json'),JSON.stringify({schema:1,projects:{product:'./product'}}));
  mkdirSync(join(root,file,".."),{recursive:true});
  writeFileSync(join(root,file),source);
  copyFileSync(new URL('./package-boundaries.mjs',import.meta.url),join(root,'dev/package-boundaries.mjs'));
  copyFileSync(new URL('./check-project-boundaries.mjs',import.meta.url),join(root,'dev/check-project-boundaries.mjs'));
  return spawnSync(process.execPath,[join(root,'dev/check-project-boundaries.mjs')],{encoding:'utf8',env:{...process.env,AETHER_PROJECTS_FILE:join(root,'projects.json')}});
 } finally {rmSync(root,{recursive:true,force:true});}
}
test('package imports and local product modules pass',()=>assert.equal(fixture('import x from "@aether/ui"; import y from "./local";').status,0));
test('relative imports into platform source fail',()=>{const result=fixture('import x from "../../core/ui/src/Button";');assert.equal(result.status,1);assert.match(result.stderr,/core\/ui/);});
test('dynamic imports cannot bypass package boundaries',()=>assert.equal(fixture('const x=import("../../core/session/documents");').status,1));

test('CAD package aliases cannot leak into other products',()=>assert.equal(fixture('import {x} from "@aether/core/engine";').status,1));
test('UI source cannot depend on session transport',()=>assert.equal(fixture('import {x} from "@aether/session";','core/ui/src/example.ts').status,1));
test('sketch geometry cannot import renderers',()=>assert.equal(fixture('import {x} from "three";','core/sketch/src/example.ts').status,1));
test('shared UI may consume shared artwork',()=>assert.equal(fixture('import {x} from "@aether/assets";','core/ui/src/example.ts').status,0));
test('source examples and comments are not imports',()=>assert.equal(fixture(`// import x from "../../core/ui/src/Button";\nconst example = 'import("@aether/core")';`).status,0));
test('glob and URL imports cannot bypass boundaries',()=>{
 assert.equal(fixture('const assets=import.meta.glob("../../core/assets/*.svg");').status,1);
 assert.equal(fixture('new URL("../../core/assets/logo.svg", import.meta.url);').status,1);
});
