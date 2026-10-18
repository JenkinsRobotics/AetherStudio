"""Create independently packaged migration candidates; never alter the source checkout.

Candidates are snapshots, not a cutover. Refuses nonempty destinations and records
source hashes so concurrent changes cannot disappear at final migration.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
EXCLUDE = {'.git', '.venv', 'node_modules', 'dist', 'dist-lib', 'build', 'coverage',
           'test-results', 'playwright-report', '__pycache__', '.pytest_cache', '.ruff_cache',
           '.DS_Store', '.vite', '.idea', '.codex', '.agents'}
PROJECTS = {'aether-cad': 'Aether CAD', 'aether-map': 'aether-map',
            'aether-animation': 'aether-animation', 'aether-sketch': 'aether-sketch',
            'aether-vector': 'aether-vector', 'aether-io': 'aether-io'}
PACKAGES = {'core/assets': '@aether/assets', 'core/ui': '@aether/ui',
            'core/session': '@aether/session', 'core/sketch': '@aether/sketch'}
TEXT = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'}

def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)

def json_write(path, value):
    write(path, json.dumps(value, indent=2) + '\n')

def copy_tree(source, target, inventory):
    for path in sorted(source.rglob('*')):
        rel = path.relative_to(source)
        if any(part in EXCLUDE or part.endswith(('.app', '.egg-info')) for part in rel.parts):
            continue
        if path.is_symlink():
            continue
        if not path.is_file() or path.name.startswith('.env') or path.suffix in {'.pyc', '.tsbuildinfo', '.pem', '.key'}:
            continue
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        inventory[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()

# External globs become asset-owned catalog modules. Consumers no longer reach
# through ../core/assets; their bundler only sees the installed asset package.
GLOB = re.compile(r'import\.meta\.glob(?:<([^>]+)>)?\(\s*([\'\"])([^\'\"]+)\2\s*,\s*(\{.*?\})\s*\)', re.S)
QUOTED = re.compile(r'([\'\"])((?:\.\./)+[^\'\"\n]+)\1')

def asset_catalog(original, pattern, options, assets):
    absolute = Path(os.path.normpath(str(original.parent / pattern)))
    relative = str(absolute.relative_to(ROOT / 'core/assets'))
    expanded = [relative]
    brace = re.search(r'\{([^}]+)\}', relative)
    if brace:
        expanded = [relative[:brace.start()] + item + relative[brace.end():] for item in brace[1].split(',')]
    matches = sorted({p for part in expanded for p in (ROOT/'core/assets').glob(part) if p.is_file()})
    if not matches:
        raise ValueError(f'Empty asset catalog: {original}: {pattern}')
    ident = hashlib.sha256((pattern + options).encode()).hexdigest()[:14]
    lines, entries = ['/// <reference types="vite/client" />'], []
    query = re.search(r'query:\s*[\'\"]([^\'\"]+)', options)
    for i, path in enumerate(matches):
        key = os.path.relpath(path, original.parent)
        if not key.startswith('.'): key = './' + key
        if path.suffix == '.json':
            value = json.dumps(json.loads(path.read_text()))
        else:
            location = '../' + str(path.relative_to(ROOT/'core/assets')) + (query[1] if query else '')
            lines.append(f'import asset{i} from {json.dumps(location)};')
            value = f'asset{i}'
        entries.append(f'{json.dumps(key)}: {value}')
    lines.append('const catalog = {\n' + ',\n'.join(entries) + '\n};\nexport default catalog;\n')
    write(assets/'catalogs'/f'{ident}.ts', '\n'.join(lines))
    return f'@aether/assets/catalogs/{ident}'

def transform_file(path, original, assets):
    source = path.read_text()
    additions = []
    def replace_glob(m):
        target = Path(os.path.normpath(str(original.parent / m[3])))
        if not target.is_relative_to(ROOT/'core/assets'): return m[0]
        module = asset_catalog(original, m[3], m[4], assets)
        name = f'packagedAssets{len(additions)}'
        additions.append(f'import {name} from {json.dumps(module)};')
        return f'({name} as Record<string, {m[1] or "unknown"}>)'
    source = GLOB.sub(replace_glob, source)
    # Tests must resolve their own dependencies rather than the UI's dev dependencies.
    source = re.sub(r'new URL\([\s]*[\'\"][^\'\"]*core/ui/package\.json[\'\"],\s*import\.meta\.url\s*\)', 'import.meta.url', source)
    def replace_path(m):
        spec = m[2]
        # Paths used to index a catalog intentionally retain their original keys.
        if any(part in spec for part in ('*', '${')): return m[0]
        absolute = Path(os.path.normpath(str(original.parent / spec.split('?')[0])))
        for folder, package in PACKAGES.items():
            base = ROOT/folder
            if absolute.is_relative_to(base) and not original.is_relative_to(base):
                sub = str(absolute.relative_to(base))
                if package == '@aether/ui' and sub.startswith('src/'):
                    sub = sub[4:]
                if sub.endswith(('.ts','.tsx')): sub = sub.rsplit('.',1)[0]
                return m[1] + package + '/' + sub + ('?' + spec.split('?',1)[1] if '?' in spec else '') + m[1]
        return m[0]
    source = QUOTED.sub(replace_path, source)
    write(path, ('\n'.join(additions)+'\n' if additions else '') + source)

def package_metadata(path, name, files, dependencies=None):
    p = path/'package.json'
    data = json.loads(p.read_text()) if p.exists() else {}
    data.update(name=name, version='0.2.0-alpha.1', private=True, files=files)
    exports = data.setdefault('exports', {})
    if name == '@aether/assets': exports['./*'] = './*'
    exports['./package.json'] = './package.json'
    for entry in path.rglob('*.ts*'):
        if any(x in EXCLUDE for x in entry.parts) or '.test.' in entry.name: continue
        rel = str(entry.relative_to(path))
        if not any(rel.startswith(f.rstrip('/')+'/') or rel == f for f in files): continue
        key = rel.removesuffix('.tsx').removesuffix('.ts')
        if name == '@aether/ui' and key.startswith('src/'): key=key[4:]
        exports.setdefault('./'+key, './'+rel)
    if dependencies: data.setdefault('dependencies', {}).update(dependencies)
    data.get('devDependencies', {}).pop('@aether/core', None)
    json_write(p, data)


def extract(destination):
    if destination.exists() and any(destination.iterdir()):
        raise ValueError(f'Refusing nonempty destination: {destination}')
    destination.mkdir(parents=True, exist_ok=True)
    inventory={}
    platform=destination/'aether-platform'
    assets=platform/'core/assets'
    for source in ['core', 'studio', 'dev', '.github']:
        # Only platform-relevant dev tools are retained below; no source app copies.
        copy_tree(ROOT/source, platform/source, inventory)
    for file in ['AGENTS.md','CONVENTIONS.md','README.md','LICENSE','package.json']:
        if (ROOT/file).exists():
            write(platform/file, (ROOT/file).read_text())
    for project, source in PROJECTS.items():
        copy_tree(ROOT/source, destination/project, inventory)
    copy_tree(ROOT/'aether_animation', destination/'aether-animation/aether_animation', inventory)
    shutil.copy2(ROOT/'pyproject.toml', destination/'aether-animation/pyproject.toml')
    copy_tree(ROOT/'examples', destination/'aether-animation/examples', inventory)
    copy_tree(ROOT/'aether-player', destination/'aether-map/player', inventory)
    # Preserve product engine demos with CAD; shared UI no longer depends on CAD.
    gallery=platform/'core/ui/gallery'
    cadgallery=destination/'aether-cad/gallery'
    shutil.copytree(gallery/'features', cadgallery/'features')
    shutil.copy2(gallery/'TransformGizmoDemo.tsx', cadgallery/'TransformGizmoDemo.tsx')
    for file in (cadgallery/'features').glob('*.ts'):
        file.write_text(re.sub(r'([\'\"])../../src/([^\'\"]+)\1', r'\1@aether/ui/\2\1', file.read_text()))
    for file in (gallery/'features').glob('*.ts'):
        if file.name=='index.ts': continue
        if file.name=='shared.ts': file.unlink(); continue
        names=re.findall(r'export function (build\w+Demo)',file.read_text())
        write(file, '\n'.join(f'export function {name}(host: HTMLElement) {{ const a=document.createElement("a"); a.href="/cad/gallery/index.html"; a.textContent="Open the CAD feature gallery"; host.append(a); }}' for name in names)+'\n')
    write(gallery/'TransformGizmoDemo.tsx', 'export function TransformGizmoDemo() { return <a href="/cad/gallery/index.html">Open the CAD transform gallery</a>; }\n')
    # Convert shared imports in each copied source using its original location.
    mappings=[(platform/'core',ROOT/'core'),(platform/'studio',ROOT/'studio')]
    mappings += [(destination/p,ROOT/s) for p,s in PROJECTS.items()]
    for dest, origin in mappings:
        for path in list(dest.rglob('*')):
            if path.is_file() and path.suffix in TEXT and 'catalogs' not in path.parts:
                original=origin/path.relative_to(dest)
                if original.exists(): transform_file(path,original,assets)
    ui=platform/'core/ui'
    config=(ui/'vite.config.ts').read_text()
    config=re.sub(r'const engine = .*?;\n', '', config)
    config=re.sub(r'  resolve: \{.*?\n  \},\n', '', config, flags=re.S)
    config=config.replace('["..", engine]', '[".."]')
    write(ui/'vite.config.ts',config)
    package_metadata(assets,'@aether/assets',['branding','cad','electronics','fonts','icon-packs','icons','illustrations','licenses','themes','catalogs','README.md'])
    package_metadata(ui,'@aether/ui',['src','tokens'], {'@aether/assets':'0.2.0-alpha.1'})
    package_metadata(platform/'core/session','@aether/session',[p.name for p in (platform/'core/session').iterdir() if p.suffix in {'.ts','.tsx','.js','.css'} and '.test.' not in p.name], {'@aether/ui':'0.2.0-alpha.1'})
    package_metadata(platform/'core/sketch','@aether/sketch',['src'])
    # Manifest and locks are normalized after immutable package archives are packed.
    for project in PROJECTS:
        root=destination/project/('web' if project=='aether-animation' else '')
        data=json.loads((root/'package.json').read_text())
        data['dependencies'].update({'@aether/ui':'0.2.0-alpha.1','@aether/session':'0.2.0-alpha.1','@aether/assets':'0.2.0-alpha.1'})
        for name,value in data['dependencies'].items():
            if name=='@aether/sketch': data['dependencies'][name]='0.2.0-alpha.1'
        data.setdefault('devDependencies',{}).setdefault('jsdom','^25.0.1')
        json_write(root/'package.json',data)
        for config in root.glob('vite.config.*'):
            source=config.read_text().replace("'../core'", "'.'").replace('"../core"','"."').replace('"../../core"','"."')
            write(config,source)
    # Standalone CAD reference gallery retains real engine-backed examples.
    write(cadgallery/'index.html','<div id="root"></div><script type="module" src="./main.tsx"></script>\n')
    write(cadgallery/'main.tsx','''import { createRoot } from 'react-dom/client';
import { useRef, useEffect } from 'react';
import { TransformGizmoDemo } from './TransformGizmoDemo';
import * as features from './features';
import '@aether/ui/tokens.css';
import '@aether/ui/widgets.css';
function Gallery() { const host=useRef<HTMLDivElement>(null); useEffect(()=>{ if(host.current) host.current.dataset.aetherFeatureHost='true'; },[]); return <><h1>CAD reference tools</h1><TransformGizmoDemo/><div ref={host}/>{Object.entries(features).map(([name,build])=><button key={name} onClick={()=>host.current&&build(host.current)}>{name}</button>)}</>; }
createRoot(document.getElementById('root')!).render(<Gallery/>);
''')
    config=destination/'aether-cad/vite.config.ts'
    write(config,config.read_text().replace("input: { app: 'index.html',", "input: { app: 'index.html', gallery: 'gallery/index.html',"))
    # Drive gets a separately built entry, with its own authenticated host route.
    drive=destination/'aether-drive'; drive.mkdir()
    copy_tree(ROOT/'studio', drive, inventory)
    for file in drive.rglob('*'):
        if file.is_file() and file.suffix in TEXT: transform_file(file,ROOT/'studio'/file.relative_to(drive),assets)
    # Initially preserve the proven sign-in/admin shell rather than inventing a second auth flow.
    # This deliberate transitional coupling is recorded in MIGRATION.json and must be removed at cutover.
    dp=json.loads((drive/'package.json').read_text());dp['name']='aether-drive'
    dp['scripts']['build']='tsc --noEmit && vite build'
    dp['scripts'].pop('check:theme',None)
    dp['dependencies'].update({'@aether/ui':'0.2.0-alpha.1','@aether/session':'0.2.0-alpha.1','@aether/assets':'0.2.0-alpha.1'})
    json_write(drive/'package.json',dp)
    studio=platform/'studio/package.json'; sp=json.loads(studio.read_text());sp['scripts']['build']='tsc --noEmit && vite build'
    sp['dependencies'].update({'@aether/ui':'0.2.0-alpha.1','@aether/session':'0.2.0-alpha.1','@aether/assets':'0.2.0-alpha.1'})
    json_write(studio,sp)
    # Re-run catalog export enumeration after Drive adds any additional entries.
    package_metadata(assets,'@aether/assets',json.loads((assets/'package.json').read_text())['files'])
    for project in [platform,*[destination/p for p in PROJECTS],drive]:
        write(project/'.gitignore','node_modules/\ndist/\n.venv/\n__pycache__/\n*.pyc\n*.tsbuildinfo\ntest-results/\nplaywright-report/\n.env*\n.DS_Store\n')
        write(project/'MIGRATION.md',f'''# {project.name} — migration candidate

Snapshot extracted from the current Aether Studio working tree, including
uncommitted source changes. This is not yet the production source of truth.
Do not edit the old and new copies concurrently. The original installation is
untouched. See ../MIGRATION.json for verification and cutover gates.

Shared dependencies are installed from versioned archives in vendor/, never
from a source folder in the original checkout. Run npm ci then npm run build
(in web/ for Animation; studio/ for platform). Do not publish until licenses,
application registration and runtime acceptance are verified.
''')
    json_write(destination/'MIGRATION.json',{'schema':1,'source':str(ROOT),'sourceRevision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceFiles':inventory,'projects':['aether-platform',*PROJECTS,'aether-drive'],'status':'candidate','cutoverGates':['all independent builds/tests','host runtime registration and product-service extraction','Drive/Studio source ownership separation','history migration and remote mapping','native desktop packaging and acceptance'],'artcraft':'Architecture reference only. No ArtCraft source imported.'})
    return destination

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--destination',type=Path,required=True)
    args=p.parse_args();print(extract(args.destination.resolve()))
