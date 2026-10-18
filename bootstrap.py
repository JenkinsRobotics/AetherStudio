"""Install separated local apps without touching the existing installation."""
from pathlib import Path
import argparse,json,subprocess,sys,venv
from suite import projects as configured_projects
root=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--python-only',action='store_true');args=p.parse_args()
if not (3,11)<=sys.version_info[:2]<(3,13):raise SystemExit('Use Python 3.11 or 3.12')
projects=configured_projects()
if not (root/'.venv').exists():venv.create(root/'.venv',with_pip=True)
python=root/'.venv'/('Scripts/python.exe' if sys.platform=='win32' else 'bin/python')
subprocess.run([str(python),'-m','pip','install','-e',str(projects['animation'])+'[dev,media]','-e',str(projects['cad']),'-e',str(projects['map']),'-e',str(root)+'[dev]'],check=True)
if not args.python_only:
 for folder in [projects['cad']/'aether-engine',root/'core/sketch',root/'core/session',root/'core/ui',root/'studio',*[path/('web' if name=='animation' else '') for name,path in projects.items()]]:
  subprocess.run(['npm.cmd' if sys.platform=='win32' else 'npm','ci'],cwd=folder,check=True)
  package=json.loads((folder/'package.json').read_text())
  if 'build' in package.get('scripts',{}):subprocess.run(['npm.cmd' if sys.platform=='win32' else 'npm','run','build'],cwd=folder,check=True)
print('Prepared. Start with .venv/bin/python -m core.host serve --data /an/explicit/separate/data-directory')
