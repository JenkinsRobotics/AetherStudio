// Reject relative source imports crossing independently owned packages.
import {readFileSync, readdirSync} from "node:fs";
import {resolve, dirname, relative, extname} from "node:path";
import {dependencySpecifiers} from "./package-boundaries.mjs";
import {fileURLToPath} from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(process.env.AETHER_PROJECTS_FILE || resolve(root,"projects.json"));
const manifest = JSON.parse(readFileSync(manifestPath,"utf8"));
const roots = ["core/ui", "core/session", "core/sketch", "core/assets", "studio"].map(p=>resolve(root,p));
const selected = process.argv.slice(2);
for (const name of selected) if (!(name in manifest.projects)) throw new Error(`Unknown product: ${name}`);
for (const [name,p] of Object.entries(manifest.projects)) if (!selected.length || selected.includes(name)) roots.push(resolve(dirname(manifestPath),p));
const cad = manifest.projects.cad && resolve(dirname(manifestPath),manifest.projects.cad);
const inside = (path, directory) => directory && (path === directory || path.startsWith(directory + "/"));
const ignored = new Set(["node_modules",".git","dist","dist-lib","dist-library",".venv","migration","test-results",".verification","dev","public","vendor"," REFERENCE CAD"]);
const errors=[];
function walk(dir, owner) {
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    if (entry.isSymbolicLink()) continue;
    const path=resolve(dir,entry.name);
    if (entry.isDirectory()) {if(!ignored.has(entry.name)&&!entry.name.startsWith("."))walk(path,owner);continue;}
    if(![".ts",".tsx",".js",".jsx",".mjs",".css"].includes(extname(path)))continue;
    const text=readFileSync(path,"utf8");
    for (const specifier of dependencySpecifiers(text, extname(path))) {
      const value = specifier.replace(/^!/, "").split(/[?#]/)[0];
      const local = value.startsWith(".") || value.startsWith("/");
      if (local) {
        const target=resolve(dirname(path),value);
        const rel=relative(owner,target);
        if(rel===".."||rel.startsWith("../"))errors.push(`${relative(root,path)}: ${specifier}`);
      }
      const core = value === "@aether/core" || value.startsWith("@aether/core/");
      const gallery = inside(path, resolve(root,"core/ui/gallery"));
      if(core && owner !== cad && !gallery)errors.push(`${relative(root,path)}: CAD-owned engine ${specifier}`);
      if(inside(path,resolve(root,"core/ui/src")) && /^@aether\/(?!assets(?:\/|$)|ui(?:\/|$))/.test(value))
        errors.push(`${relative(root,path)}: UI must not depend on ${specifier}`);
      if(inside(path,resolve(root,"core/sketch/src")) && /^(?:@aether\/|react(?:-dom)?(?:\/|$)|three(?:\/|$)|@react-three\/)/.test(value))
        errors.push(`${relative(root,path)}: sketch geometry must not depend on ${specifier}`);
    }
  }
}
for (const owner of roots) walk(owner,owner);
if(errors.length){console.error(errors.join("\n"));process.exit(1);}
console.log(`Package boundaries: ${roots.length} roots, zero source crossings or forbidden engine/UI imports.`);
