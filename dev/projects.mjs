import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2];
if(!['install','build','test'].includes(mode))throw Error('Expected install, build or test');
for(const relative of ['core/sketch','core/session','core/ui','studio','drive']){
 const cwd=resolve(root,relative),pkg=JSON.parse(readFileSync(resolve(cwd,'package.json'),'utf8'));
 const commands=mode==='install'?[['ci']]:(mode==='build'?['build:package','build:library','build']:['test','typecheck']).filter(name=>pkg.scripts?.[name]).map(name=>['run',name]);
 for(const args of commands){
  const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,stdio:'inherit',shell:process.platform==='win32'});
  if(result.error||result.status!==0)process.exit(result.status||1);
 }
}
