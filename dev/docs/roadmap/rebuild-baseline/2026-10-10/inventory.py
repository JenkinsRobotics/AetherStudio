"""Read-only snapshot of existing contracts; not a new runtime registry."""
from pathlib import Path
import ast,importlib.util,sys,json,hashlib,subprocess
root=Path('/Users/jonathanjenkins/GITHUB');platform=root/'aether-platform';sys.path.insert(0,str(platform));sys.dont_write_bytecode=True
from core.host.automation.commands import COMMANDS as HOST

def load_commands(repo,relative,name):
 p=root/repo/relative;spec=importlib.util.spec_from_file_location(name,p);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod.COMMANDS
cad=load_commands('aether-cad','service/aether_cad_service/automation.py','audit_cad_commands')
map_commands=load_commands('aether-map','service/aether_map_service/automation.py','audit_map_commands')
commands=[{'owner':owner,**c.public()} for owner,cs in [('platform',HOST),('cad',cad),('map',map_commands)] for c in cs]
assert len({c['id'] for c in commands})==len(commands)
assert all('expected_revision' in c['inputSchema']['required'] for c in commands if c['writes'])
bridge=root/'aether-animation/aether_animation/bridge.py';tree=ast.parse(bridge.read_text());values={n.targets[0].id:n.value for n in tree.body if isinstance(n,ast.Assign) and len(n.targets)==1 and isinstance(n.targets[0],ast.Name)}
capabilities=ast.literal_eval(values['CAPABILITIES']);registered=[ast.literal_eval(k) for k in values['_VERBS'].keys];assert set(capabilities)==set(registered)
paths=['aether-platform/core/host/automation/commands.py','aether-platform/core/host/automation/__init__.py','aether-cad/service/aether_cad_service/automation.py','aether-map/service/aether_map_service/automation.py','aether-animation/aether_animation/bridge.py','aether-platform/core/host/server.py']
routes=[]
for n in ast.walk(ast.parse((platform/'core/host/server.py').read_text())):
 if isinstance(n,ast.Constant) and isinstance(n.value,str) and n.value.startswith('/api/'):
  routes.append({'literal':n.value,'line':n.lineno})
result={'snapshot_version':1,'date':'2026-10-10','purpose':'Phase 0 as-built contract inventory; never consumed as a second runtime source of truth','commits':{name:subprocess.check_output(['git','rev-parse','HEAD'],cwd=root/name,text=True).strip() for name in ['aether-platform','aether-cad','aether-map','aether-animation']},'source_sha256':{path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in paths},'automation':{'catalog_schema_version':1,'run_request_shape':{'id':'command name','arguments':'validated product/platform fields'},'run_success_shape':{'command':'command name','result':'current command-specific object'},'counts':{'platform':len(HOST),'cad':len(cad),'map':len(map_commands)},'commands':commands,'gaps':['No public typed result schema per command','No declared per-command undo contract (saved history is not live editor undo)','No durable idempotency key/result replay contract','No shared explicit protocol version on each run request','No shared cancellation/progress/job contract','Current schemas expose saved documents, not full UI command coverage']},'animation_bridge':{'source':'aether-animation/aether_animation/bridge.py','protocol_version':ast.literal_eval(values['PROTOCOL_VERSION']),'capability_count':len(capabilities),'capabilities':capabilities,'coverage_note':'Capability names checked against dispatch; argument/result/effect schemas still require per-verb inventory. Not registered as platform automation commands.'},'host_api_literal_candidates':{'note':'Static source path literals only, including prefixes; NOT an exhaustive endpoint registry or permission classification. Dynamic library/drive actions and product-owned endpoints need separate inventory.','items':routes}}
p=Path('/tmp/aether-rebuild-phase0/command-inventory.json');p.write_text(json.dumps(result,indent=2)+'\n');print('Platform/CAD/Map commands:',len(HOST),len(cad),len(map_commands));print('Animation capabilities:',len(capabilities));print('Validated unique command IDs, mutation revision fields and capability/dispatch agreement.')
