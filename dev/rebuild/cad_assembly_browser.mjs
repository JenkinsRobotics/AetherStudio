import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

export async function verifyAssemblyRecipes(page,origin,evidence,call,send) {
  const created=await call('library/project_create',{app:'cad',name:'Assembly recipe fixture',operation_id:randomUUID(),packaging:'assembly',scope:'personal'});
  const assemblyID=created.project.assemblies[0].id;
  const url=`${origin}/cad/index.html?document=${created.id}&assembly=${assemblyID}`;
  const read=async()=>{
    const file=await call('library/read',{app:'cad',id:created.id});
    return JSON.parse(execFileSync('python3',['-c','import sys,io,zipfile; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("state/graph.json").decode())'],{input:Buffer.from(file.data_base64,'base64'),encoding:'utf8'}));
  };
  const saved=async (count,parts)=>{
    for(let i=0;i<120;i++){const graph=await read();if(graph.instances.length===count&&(parts===undefined||graph.part_definitions.length===parts))return graph;await page.waitForTimeout(100);}
    throw Error(`Assembly autosave did not reach ${count} instances`);
  };
  await page.goto(url);
  await page.getByRole('button',{name:'Document name and actions',exact:true}).filter({hasText:'Assembly recipe fixture'}).waitFor({timeout:90000});
  await page.getByRole('tab',{name:'Features',exact:true}).click();
  await page.getByRole('button',{name:'Assembly tools',exact:true}).click();
  await page.getByRole('menuitem',{name:'Templates and structure',exact:true}).click();
  await page.getByRole('menuitem',{name:'Part template',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Build Assembly from JSON',exact:true});await dialog.waitFor();
  const build=async()=>{
    await dialog.getByRole('button',{name:'Build and insert',exact:true}).click();
    await page.waitForFunction(()=>{
      const d=document.querySelector('[data-assembly-recipe]');
      return !d||(!d.querySelector('button[type=submit]')?.disabled&&d.querySelector('[role=status]')?.textContent);
    },null,{timeout:90000});
    if(await dialog.count())throw Error(await dialog.getByRole('status').innerText());
  };
  await build();const template=await saved(0,1);
  await page.getByRole('button',{name:'Assembly tools',exact:true}).click();
  await page.getByRole('menuitem',{name:'Templates and structure',exact:true}).click();
  await page.getByRole('menuitem',{name:'Linear instance array',exact:true}).click();
  await dialog.waitFor();
  await dialog.getByRole('combobox',{name:'Part template',exact:true}).selectOption(template.part_definitions[0].id);
  const spec=JSON.parse(await dialog.getByRole('textbox',{name:'Assembly recipe',exact:true}).inputValue());assert.equal(spec.patterns[0].count,4);
  await build();
  const first=await saved(4);assert.equal(first.part_definitions.length,1);
  assert.deepEqual(first.instances.map(i=>i.rest_transform.position_m[0]).sort((a,b)=>a-b),[0,.02,.04,.06]);
  await page.getByRole('button',{name:'AI advisor',exact:true}).click();
  await send('cad-assembly-create-editor-fixture');const after=await saved(8);assert.equal(after.part_definitions.length,1);
  await send('cad-assembly-undo-editor-fixture');await saved(4);
  await send('cad-assembly-redo-editor-fixture');await saved(8);
  await page.reload();
  await page.getByRole('button',{name:'Document name and actions',exact:true}).filter({hasText:'Assembly recipe fixture'}).waitFor({timeout:90000});
  await page.getByRole('button',{name:'AI advisor',exact:true}).click();
  await send('cad-assembly-inspect-editor-fixture');
  const rendered=page.getByRole('treeitem',{name:/^(Block:1|Row:[234]) · Body 1/});
  await rendered.nth(7).waitFor({timeout:90000});
  assert.equal(await rendered.count(),8);
  assert.equal((await read()).instances.length,8);
  if(evidence)await page.screenshot({path:join(evidence,'cad-assembly-recipe-reopened.png')});
  return {instances:8,partTemplates:1,ui:true,agent:true,undo:true,redo:true,saveReopen:true};
}
