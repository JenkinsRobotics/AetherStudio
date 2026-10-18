// Matched API slice, not a rendering benchmark or a company-load certificate.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { cpus, platform, release, totalmem } from 'node:os';
import path from 'node:path';

const original = process.env.AETHER_AB_ORIGINAL;
const output = process.env.AETHER_AB_EVIDENCE;
assert(original && output, 'Explicit original checkout and evidence paths are required');
await mkdir(output, {recursive:true, mode:0o700});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = ['core/host/server.py', 'core/host/state.py', 'core/host/library.py'];
const originalHashes = Object.fromEntries(await Promise.all(files.map(async f => [f,hash(await readFile(path.join(original,f)))])));
const plan = {
  version:1, scope:'Warm authenticated HTTP API, one account with independent per-worker documents',
  concurrency:[1,4,16], repeats:3, requestsPerCell:96, warmups:16,
  workloads:['status','read','save'], payloadBytes:65536,
  build:'Rust cargo test --release; original Python source via same installed Python environment',
  nativeConfiguration:'Shipping local-host8 connection pool,4 document handlers,20 admission slots,45s deadline, native persisted presentation settings',
  rules:'Matched payloads; alternating A/B order; no retries; all status/errors recorded; content/revision readback required; any error blocks qualification.',
  regressionReview:'Native median trial p95 > 1.2 times original requires investigation; exploratory API budget, not a release gate.',
  exclusions:['cold startup','memory/CPU attribution','real users/WebSockets','CAD geometry','Map playback','network/TLS','full product parity'],
};
await writeFile(path.join(output,'plan.json'),JSON.stringify(plan,null,2));
const python=process.env.AETHER_AB_PYTHON || path.resolve('.venv/bin/python');
const legacy = spawn(python,['-B',path.resolve('dev/rebuild/server_ab_legacy.py')],{
  cwd:original,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:['ignore','pipe','pipe'],
});
let stderr=''; legacy.stderr.on('data',b=>stderr+=b);
let stopped=false;
const stop=()=>{if(!stopped){stopped=true;legacy.kill('SIGTERM');}};
process.on('exit',stop); process.on('SIGTERM',()=>{stop();process.exit(143);});
const deadline=setTimeout(()=>{stop();console.error('A/B deadline exceeded');process.exit(1);},450000);
const rows=[];
try {
  const first=await new Promise((resolve,reject)=>{
    const rl=createInterface({input:legacy.stdout});
    rl.once('line',line=>{rl.close();resolve(JSON.parse(line));});
    legacy.once('exit',code=>reject(new Error(`Original host exited ${code}: ${stderr}`)));
  });
  const hosts={A:{...first},B:{origin:process.env.AETHER_AB_NATIVE_ORIGIN,cookie:process.env.AETHER_AB_NATIVE_COOKIE}};
  async function call(h,route,body) {
    const start=performance.now();
    try {
      const response=await fetch(h.origin+route,{method:body===undefined?'GET':'POST',headers:{Origin:h.origin,Cookie:h.cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
      const value=await response.json();
      return {ms:performance.now()-start,status:response.status,value};
    } catch(error) {return {ms:performance.now()-start,status:0,error:String(error)};}
  }
  const base=Buffer.alloc(plan.payloadBytes,97).toString('base64');
  for(const [label,h] of Object.entries(hosts)) {
    h.docs=[];
    for(let i=0;i<16;i++) {
      const r=await call(h,'/api/library/create',{app:'map',scope:'personal',kind:'file',name:`AB ${i}`,operation_id:`ab-create-${i}`,data_base64:base});
      assert.equal(r.status,200,JSON.stringify(r));
      h.docs.push({id:r.value.id,revision:1,content:base});
    }
    console.log(`${label}: disposable host ready with16 documents`);
  }
  let serial=0;
  async function run(label,workload,concurrency,count,trial,warmup=false) {
    const h=hosts[label], samples=[];
    let next=0;
    const started=performance.now();
    await Promise.all(Array.from({length:concurrency},async(_,worker)=>{
      while(next++<count) {
        const doc=h.docs[worker]; let body,route;
        if(workload==='status') route='/api/status';
        else {
          route='/api/library/'+workload;
          body={app:'map',id:doc.id,branch:'Main'};
          if(workload==='save') {
            const bytes=Buffer.alloc(plan.payloadBytes,97);
            bytes.write(`${trial}/${worker}/${doc.revision+1}`);
            Object.assign(body,{expected_revision:doc.revision,operation_id:`ab-save-${serial++}`,data_base64:bytes.toString('base64')});
          }
        }
        const r=await call(h,route,body);
        let valid=r.status===200;
        if(valid && workload==='save') {
          valid=r.value.revision===doc.revision+1;
          if(valid) {doc.revision=r.value.revision;doc.content=body.data_base64;}
        } else if(valid && workload==='read') valid=r.value.revision===doc.revision && r.value.data_base64===doc.content;
        else if(valid && workload==='status') valid=r.value.user?.username==='editor';
        samples.push({ms:r.ms,status:r.status,valid,...(r.error?{error:r.error}:{})});
      }
    }));
    const elapsedMs=performance.now()-started;
    const values=samples.map(x=>x.ms).sort((a,b)=>a-b);
    const pct=p=>values[Math.ceil(values.length*p)-1];
    const row={label,workload,concurrency,trial,warmup,count:samples.length,elapsedMs,requestsPerSecond:samples.length/elapsedMs*1000,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),errors:samples.filter(s=>!s.valid).length,samples};
    rows.push(row);
    await writeFile(path.join(output,'raw.json'),JSON.stringify(rows,null,2));
    console.log(`${label} ${workload} c${concurrency} trial${trial}${warmup?' warmup':''}: p95=${row.p95Ms.toFixed(2)}ms errors=${row.errors}`);
  }
  for(const workload of plan.workloads) for(const concurrency of plan.concurrency) {
    for(const label of ['A','B']) await run(label,workload,concurrency,plan.warmups,0,true);
    for(let trial=1;trial<=plan.repeats;trial++) {
      for(const label of trial%2?['A','B']:['B','A']) await run(label,workload,concurrency,plan.requestsPerCell,trial);
    }
  }
  for(const h of Object.values(hosts)) for(const doc of h.docs) {
    const r=await call(h,'/api/library/read',{app:'map',id:doc.id});
    assert.equal(r.status,200); assert.equal(r.value.revision,doc.revision); assert.equal(r.value.data_base64,doc.content);
    const stale=await call(h,'/api/library/save',{app:'map',id:doc.id,operation_id:`stale-${serial++}`,expected_revision:1,data_base64:base});
    assert.equal(stale.status,409,'Both implementations must reject stale saves');
  }
  for(const f of files) assert.equal(hash(await readFile(path.join(original,f))),originalHashes[f]);
  const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
  const comparisons=[];
  for(const workload of plan.workloads) for(const concurrency of plan.concurrency) {
    const groups=Object.fromEntries(['A','B'].map(label=>{
      const cells=rows.filter(r=>!r.warmup&&r.label===label&&r.workload===workload&&r.concurrency===concurrency);
      return [label,{p50Ms:median(cells.map(r=>r.p50Ms)),p95Ms:median(cells.map(r=>r.p95Ms)),requestsPerSecond:median(cells.map(r=>r.requestsPerSecond)),errors:cells.reduce((s,r)=>s+r.errors,0)}];
    }));
    comparisons.push({workload,concurrency,...groups,nativeP95ChangePercent:(groups.B.p95Ms/groups.A.p95Ms-1)*100,reviewRegression:groups.B.p95Ms>groups.A.p95Ms*1.2});
  }
  const result={plan,environment:{platform:platform(),release:release(),cpu:cpus()[0].model,logicalCpus:cpus().length,memoryBytes:totalmem(),node:process.version,python:execFileSync(python,['--version'],{encoding:'utf8'}).trim(),rust:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim()},storage:{A:first.storage,B:JSON.parse(process.env.AETHER_AB_NATIVE_STORAGE)},originalHashes,comparisons,contentReadback:true,staleSaveRefusal:true,errors:rows.reduce((s,r)=>s+r.errors,0),limitations:'Single-account loopback API slice with distinct documents per worker. Same Node client and default HTTP connection behavior for both. Original SQLite versus native PostgreSQL/object-store; not isolated language comparison. Rust host in release test process. Existing background apps remain running. No full-migration or company-load claim.'};
  await writeFile(path.join(output,'report.json'),JSON.stringify(result,null,2));
  assert.equal(result.errors,0,'API errors or content mismatch block qualification; see raw.json');
} finally {clearTimeout(deadline);stop();await writeFile(path.join(output,'legacy-stderr.log'),stderr);}
