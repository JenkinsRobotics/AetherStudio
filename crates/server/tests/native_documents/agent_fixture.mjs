// No network or real credentials. Exercises the actual subprocess contract.
import { createInterface } from 'node:readline';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const [action, directory] = process.argv.slice(2);
const emit = v => process.stdout.write(JSON.stringify(v) + '\n');
await writeFile(join(directory, 'process.json'), JSON.stringify({ pid: process.pid, env: Object.keys(process.env) }));
if (action === 'login') {
  emit({ type: 'login', url: 'https://auth.openai.com/api/accounts/authorize?fixture=true', acceptsCode: true });
  const lines = createInterface({ input: process.stdin });
  lines.once('line', async line => {
    const input = JSON.parse(line);
    if (input.code === 'hang') { setInterval(() => {}, 1000); return; }
    if (input.code === 'bad-url') { emit({ type: 'login', url: 'https://auth.openai.com.attacker.invalid/' }); process.exit(0); }
    await writeFile(join(directory, 'fixture-credential.json'), JSON.stringify({ secret: 'DO-NOT-EXPOSE', label: input.code }));
    emit({ type: 'connected', label: input.code }); emit({ type: 'done' }); process.exit(0);
  });
} else if (action === 'models') {
  emit({ type: 'models', models: [{ id: 'fixture-model', name: 'Fixture model' }] }); emit({ type: 'done' }); process.exit(0);
} else {
  const lines = createInterface({ input: process.stdin });
  lines.once('line', async line => {
    const input = JSON.parse(line), mode = input.messages.filter(m=>m.role==='user').at(-1).content;
    if (mode.endsWith('-editor-fixture')) {
      let serial=0;
      const tool=async(name,args={})=>{
        const reply=new Promise(resolve=>lines.once('line',raw=>resolve(JSON.parse(raw))));
        emit({type:'tool_call',id:'editor'+(++serial),name,arguments:args});
        const response=await reply;if(!response.result.ok)throw Error(response.result.error);
        if(name.endsWith('_preview')) {
          const image=response.result.images?.[0];
          if(!image||image.mimeType!=='image/png'||!image.data.startsWith('iVBOR')||image.width>1024||image.height>1024)throw Error('Bounded preview missing');
        }
        return response.result.value;
      };
      if(mode==='cad-create-editor-fixture') {
        await tool('aether_cad_inspect');
        const sketch=await tool('aether_cad_sketch_rectangle',{plane:'XY',x_mm:0,y_mm:0,width_mm:40,height_mm:20});
        const body=await tool('aether_cad_extrude',{profile_id:sketch.feature_ids[0],depth_mm:5,operation:'new'});
        if(body.body_count!==1)throw Error('Native body missing');
        await tool('aether_cad_inspect');
      }else if(mode==='cad-cone-editor-fixture'){
        const created=await tool('aether_cad_solid_primitive',{kind:'cone',radius_mm:8,height_mm:24});
        if(created.body_count!==2||created.feature_ids.length!==2)throw Error('Exact primitive missing');
        const refs=await tool('aether_cad_feature_references',{feature_id:created.feature_ids[1]});
        if(refs.total!==1||refs.references[0].id!==created.feature_ids[0]||refs.topology_verified!==false)throw Error('Canonical history references differ');
      }else if(mode==='cad-program-editor-fixture'){
        const docs=await tool('aether_cad_docs',{name:'aether_cad_run_program'});
        if(docs.module!=='AetherCAD.AI'||docs.tools.length!==1)throw Error('CAD discovery differs');
        const program=JSON.parse(docs.example.arguments.program_json);
        program.steps.push({id:'bore',tool:'aether_cad_sketch_circle',arguments:{plane:'XY',center_x_mm:40,center_y_mm:25,radius_mm:5,offset_mm:10}},
          {id:'cut',tool:'aether_cad_extrude',arguments:{profile_id:{$ref:'bore.feature_id'},target_body_id:{$ref:'plate.body_id'},depth_mm:10,operation:'cut'}});
        const built=await tool(docs.example.tool,{program_json:JSON.stringify(program)});
        if(built.body_count!==1||built.feature_count!==4||!built.steps.plate.body_id)throw Error('Atomic program differs');
        const proof=await tool('aether_cad_verify',{density_kg_m3:7800});
        const shape=proof.measurements[0];
        const volume=40000-Math.PI*25*10;
        if(proof.source!=='native-exact-solids'||proof.total_bodies!==1||Math.abs(shape.volume_mm3-volume)>1e-5||Math.abs(shape.mass_kg-volume*7800/1e9)>1e-8)throw Error('Native proof differs');
      }else if(mode==='cad-preview-editor-fixture'){
        const preview=await tool('aether_cad_preview');if(preview.source!=='current-viewport'||preview.changed!==false)throw Error('CAD preview mislabeled');
      }else if(mode==='cad-assembly-create-editor-fixture'){
        const source=await tool('aether_cad_assembly_inspect');
        source.example.instances[0].position_mm=[0,20,0];
        const result=await tool('aether_cad_assembly_compose',{recipe_json:JSON.stringify(source.example)});
        if(result.instance_count!==8||Object.keys(result.ids.instances).length!==4)throw Error('Assembly creation differs');
      }else if(mode==='cad-assembly-undo-editor-fixture')await tool('aether_cad_assembly_undo');
      else if(mode==='cad-assembly-redo-editor-fixture')await tool('aether_cad_assembly_redo');
      else if(mode==='cad-assembly-inspect-editor-fixture'){
        const result=await tool('aether_cad_assembly_inspect');if(result.instances.length!==8||result.parts.length!==1)throw Error('Reopened assembly differs');
      }else if(mode==='cad-undo-editor-fixture')await tool('aether_cad_undo');
      else if(mode==='cad-redo-editor-fixture')await tool('aether_cad_redo');
      else if(mode==='sketch-create-editor-fixture'){
        const drawing=await tool('aether_sketch_inspect');
        await tool('aether_sketch_draw',{layer_id:drawing.layers[0].id,shapes:[
          {kind:'rectangle',x_px:100,y_px:100,width_px:200,height_px:120,fill:'#3456aa'},
          {kind:'ellipse',x_px:400,y_px:100,width_px:160,height_px:160,fill:'#ee8855'},
        ]});
        const result=await tool('aether_sketch_inspect');if(result.total_shapes!==2)throw Error('Drawing missing');
      }else if(mode==='sketch-preview-editor-fixture'){const preview=await tool('aether_sketch_preview');if(preview.kind!=='drawing')throw Error('Wrong preview');}
      else if(mode==='sketch-undo-editor-fixture')await tool('aether_sketch_undo');
      else if(mode==='sketch-redo-editor-fixture')await tool('aether_sketch_redo');
      else if(mode==='map-create-editor-fixture'){
        const show=await tool('aether_map_show_inspect');
        const {created}=await tool('aether_map_surface_create',{scene_id:show.active_scene_id,name:'Agent wall'});
        await tool('aether_map_surface_bounds',{scene_id:show.active_scene_id,surface_id:created.surface_id,x_px:100,y_px:150,width_px:800,height_px:450});
        const timelines=await tool('aether_map_show_inspect',{section:'timelines'});
        const timeline=timelines.items.find(t=>t.surface_id===created.surface_id);
        const tracks=await tool('aether_map_show_inspect',{section:'tracks'});
        const track=tracks.items.find(t=>t.timeline_id===timeline.id&&t.kind==='video');
        const assets=await tool('aether_map_show_inspect',{section:'assets'});
        await tool('aether_map_asset_place',{asset_id:assets.items[0].id,track_id:track.id,start_s:0});
        const composed=await tool('aether_map_show_evaluate',{scene_id:show.active_scene_id,time_s:1});
        if(composed.total_layers!==1||composed.layers[0].kind!=='fill')throw Error('Map composition missing');
      }else if(mode==='map-preview-editor-fixture'){const show=await tool('aether_map_show_inspect');const preview=await tool('aether_map_mapping_preview',{scene_id:show.active_scene_id});if(preview.kind!=='mapping_mask'||!preview.excludes.includes('media'))throw Error('Mask mislabeled');}
      else if(mode==='map-undo-editor-fixture')await tool('aether_map_undo');
      else if(mode==='map-redo-editor-fixture')await tool('aether_map_redo');
      else if(mode==='map-inspect-editor-fixture'){
        const surfaces=await tool('aether_map_show_inspect',{section:'surfaces'});
        if(surfaces.total!==1||JSON.stringify(surfaces.items[0].corners)!=='[[100,150],[900,150],[900,600],[100,600]]')throw Error('Map reopen geometry differs');
        const scene=await tool('aether_map_show_inspect');
        const composed=await tool('aether_map_show_evaluate',{scene_id:scene.active_scene_id,time_s:1});
        if(composed.total_layers!==1)throw Error('Map reopened composition missing');
      }
      else throw Error('Unknown fixture');
      emit({type:'delta',text:`Verified ${mode}`});emit({type:'done'});process.exit(0);
    }
    if(mode==='image-budget') {
      for(let index=0;index<9;index++) {
        const pending=new Promise(resolve=>lines.once('line',raw=>resolve(JSON.parse(raw))));
        emit({type:'tool_call',id:'image'+index,name:input.tools[0].name,arguments:{}});
        const response=await pending;
        if(index<8&&!response.result.images?.length)throw Error('Image missing');
        if(index===8&&response.result.ok)throw Error('Budget did not stop');
      }
      emit({type:'done'});process.exit(0);
    }
    if (mode === 'tools' || mode === 'unknown-tool') {
      emit({type:'tool_call',id:'edit1',name:mode==='unknown-tool'?'shell':input.tools[0].name,arguments:{width:20}});
      lines.once('line', raw => {
        const response=JSON.parse(raw);
        emit({type:'delta',text:JSON.stringify(response.result)});
        // Keep the lease alive briefly to exercise duplicate receipt handling.
        setTimeout(()=>{emit({type:'done'});process.exit(0);},100);
      }); return;
    }
    if (mode === 'hang') { emit({ type: 'delta', text: 'partial' }); setInterval(() => {}, 1000); return; }
    if (mode === 'close-stdout') { process.stdout.end(); setInterval(() => {}, 1000); return; }
    if (mode === 'huge') { process.stdout.write('a'.repeat(70000)); setInterval(() => {}, 1000); return; }
    if (mode === 'stderr') { process.stderr.write('SECRET diagnostics'); emit({ type: 'error', message: 'SECRET provider diagnostic' }); process.exit(1); }
    const account = JSON.parse(await readFile(join(directory, 'fixture-credential.json')));
    emit({ type: 'delta', text: `Hello ${account.label}` }); emit({ type: 'done' }); process.exit(0);
  });
}
