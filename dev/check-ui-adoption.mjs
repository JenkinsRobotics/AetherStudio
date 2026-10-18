import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const expected=read(resolve(root,'core/ui/package.json')).version;
const projects=read(resolve(root,'projects.json')).projects;
const targets=[['Studio','studio'],['Drive','drive'],...Object.entries(projects).filter(([name])=>name!=='drive')];
const errors=[];
for(const [name,path] of targets){
 let dir=resolve(root,path);
 if(!existsSync(resolve(dir,'package.json')) && existsSync(resolve(dir,'web/package.json')))dir=resolve(dir,'web');
 const manifest=read(resolve(dir,'package.json'));
 if(!manifest.dependencies?.['@aether/ui']?.endsWith(`aether-ui-${expected}.tgz`))errors.push(`${name}: manifest does not use UI ${expected}`);
 for(const [pkg,key] of [['ui','version'],['session','peerDependencies']]){
  const file=resolve(dir,`node_modules/@aether/${pkg}/package.json`);
  if(!existsSync(file)){errors.push(`${name}: install dependencies before checking`);continue;}
  const data=read(file), actual=key==='version'?data.version:data.peerDependencies?.['@aether/ui'];
  if(actual!==expected)errors.push(`${name}: installed ${pkg} uses UI ${actual}, expected ${expected}`);
 }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`All ${targets.length} frontends use Aether UI ${expected}, with matching session peers.`);
