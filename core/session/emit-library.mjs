// Ship JavaScript and declarations, so consumers do not need our JSX compiler settings.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname, relative, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { transformSync } from 'esbuild';
const root=process.cwd(), source=resolve(root,'library'), target=resolve(root,'dist-library');
const declarations=mkdtempSync(resolve(tmpdir(),'aether-session-declarations-'));
const config={compilerOptions:{target:'ES2022',lib:['ES2022','DOM','DOM.Iterable'],module:'ESNext',moduleResolution:'bundler',jsx:'react-jsx',strict:true,skipLibCheck:true,declaration:true,emitDeclarationOnly:true,outDir:declarations,rootDir:'.',types:['vite/client']},include:['library'],exclude:['library/**/*.test.*']};
writeFileSync('tsconfig.library.json',JSON.stringify(config,null,2)+'\n');
// Shared library adapters may use the package's public root transports. Emit
// declarations with the complete source root, then retain the public library layout.
try {
  execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.library.json'],{stdio:'inherit'});
  cpSync(resolve(declarations,'library'),target,{recursive:true});
} finally {
  rmSync(declarations,{recursive:true,force:true});
}
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory()){walk(path);continue;}if(item.name.includes('.test.')||item.name.endsWith('.d.ts'))continue;const dest=resolve(target,relative(source,path));mkdirSync(dirname(dest),{recursive:true});if(['.ts','.tsx'].includes(extname(path))){const result=transformSync(readFileSync(path,'utf8'),{loader:extname(path)==='.tsx'?'tsx':'ts',jsx:'automatic',format:'esm',target:'es2022',sourcefile:relative(source,path)});writeFileSync(dest.replace(/\.tsx?$/,'.js'),result.code);}else copyFileSync(path,dest);}}
walk(source);
// Node ESM also consumes this package (through test runners). Include exact
// extensions rather than relying on a browser bundler's extension inference.
function fixImports(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory()){fixImports(path);continue;}if(!path.endsWith('.js')&&!path.endsWith('.d.ts'))continue;const text=readFileSync(path,'utf8').replace(/(from\s*|import\s*|import\(\s*)(["'])(\.[^"']+)\2/g,(all,prefix,quote,spec)=>{if(existsSync(resolve(dirname(path),spec+'.js')))return prefix+quote+spec+'.js'+quote;if(existsSync(resolve(dirname(path),spec,'index.js')))return prefix+quote+spec+'/index.js'+quote;return all;});writeFileSync(path,text);}}
fixImports(target);
console.log('Compiled Aether session library JavaScript and declarations.');
