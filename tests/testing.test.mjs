import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Recorder, poll, compareRgba, relativePath, walkthrough } from '@machinapractica/testing';
import { createEvidenceDirectory, writeCapture, writeEvidence, sha256 } from '@machinapractica/testing/node';
const identity = { scenario: 'launch', revision: 'a'.repeat(40), platform: 'unit-fixture' };
const valid = { path: '001-phone.png', sha256: '0'.repeat(64), actor: 'phone', viewport: { width: 400, height: 800 } };
const step = (order) => ({ description: 'Launch', action: async()=>{order.push('action');}, ready: async()=>{order.push('ready');}, checks: [{description:'Visible outcome',check:async()=>{order.push('assert');}}], stabilize:async()=>{order.push('stabilize');}, capture:async(index)=>{order.push('capture');return [{...valid,path:`${index}-phone.png`}];} });
test('completed receipts are ordered, isolated from mutation, and documented', async()=>{
 const order=[]; const recorder=new Recorder(identity); await recorder.step(step(order));
 assert.deepEqual(order,['action','ready','assert','stabilize','capture']);
 const snapshot=recorder.snapshot(); snapshot.steps[0].checks.push('never ran');
 const done=recorder.finish(); assert.equal(done.status,'passed');
 assert.doesNotMatch(walkthrough(done),/never ran/); assert.match(walkthrough(done),/Visible outcome/);
 await assert.rejects(recorder.step(step([])),/finished/);
});
test('failed assertion prevents capture and retains earlier successful steps', async()=>{
 const recorder=new Recorder(identity);await recorder.step(step([]));const order=[];const fail=step(order);
 fail.checks[0].check=async()=>{throw new Error('wrong actor data');};
 await assert.rejects(recorder.step(fail),/wrong actor data/);
 assert.deepEqual(order,['action','ready']);assert.equal(recorder.finish().status,'failed');
 assert.equal(recorder.snapshot().steps.length,1);
});
test('deadline cannot later append a passing receipt', async()=>{
 const recorder=new Recorder(identity,10);const spec=step([]);let release;
 spec.checks[0].check=()=>new Promise(resolve=>{release=resolve;});
 await assert.rejects(recorder.step(spec),/deadline/);release();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(recorder.finish().status,'failed');assert.equal(recorder.snapshot().steps.length,0);
});
test('readiness has last observation and does not retry observation errors', async()=>{
 let n=0; assert.equal(await poll({label:'count',timeoutMs:100,intervalMs:1,observe:async()=>++n,ready:v=>v===3}),3);
 await assert.rejects(poll({label:'visible',timeoutMs:10,intervalMs:1,observe:async()=>({visible:false}),ready:v=>v.visible}),/last observation:.*false/);
 let attempts=0;await assert.rejects(poll({label:'broken',timeoutMs:100,observe:async()=>{attempts++;throw Error('broken');},ready:()=>false}));assert.equal(attempts,1);
});
test('exact pixels count channels once and reject invalid decoded images',()=>{
 const a={width:1,height:1,data:new Uint8Array([1,2,3,4])};const b={...a,data:new Uint8Array([9,8,3,4])};
 assert.deepEqual(compareRgba(a,b),{equal:false,differentPixels:1});assert.equal(compareRgba(a,a).equal,true);
 assert.throws(()=>compareRgba({...a,data:new Uint8Array(3)},b),/RGBA/);
});
test('paths cannot escape or inject links',()=>{
 for(const p of ['../outside','/absolute','a\\b','a/../b','https:evil','a%2fb','a.png>evil','a\nfile'])assert.equal(relativePath(p),false,p);
});
test('owned output never overwrites a capture or directory',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'mp-evidence-'));
 try {const directory=await createEvidenceDirectory(parent,'actor-1');await assert.rejects(createEvidenceDirectory(parent,'actor-1'));
 const bytes=new Uint8Array([1,2,3]);const receipt=await writeCapture(directory,1,'phone',valid.viewport,bytes);
 assert.equal(receipt.sha256,sha256(await readFile(join(directory,receipt.path))));
 await assert.rejects(writeCapture(directory,1,'phone',valid.viewport,bytes));
 const recorder=new Recorder(identity);const spec=step([]);spec.capture=async()=>[receipt];await recorder.step(spec);await writeEvidence(directory,recorder.finish());
 assert.match(await readFile(join(directory,'walkthrough.md'),'utf8'),/Status: passed/);
 await symlink(directory,join(parent,'linked'));await assert.rejects(createEvidenceDirectory(join(parent,'linked'),'child'));
 }finally{await rm(parent,{recursive:true,force:true});}
});

test('review records bind candidate bytes, source and rendering platform',async()=>{
 const {reviewMatches}=await import('@machinapractica/testing');const review={candidateSha256:valid.sha256,revision:identity.revision,platform:identity.platform,reviewer:'maintainer'};
 assert.equal(reviewMatches(valid,identity,review),true);
 for(const change of [{revision:'b'.repeat(40)},{platform:'another-platform'},{candidateSha256:'1'.repeat(64)},{reviewer:''}])assert.equal(reviewMatches(valid,identity,{...review,...change}),false);
});
test('production harness cleans up after use failure and startup failure',async()=>{
 const {withProcess}=await import('@machinapractica/testing/node');let pid;
 await assert.rejects(withProcess({command:process.execPath,args:['-e',"console.log(process.pid);setInterval(()=>{},1000)"],onOutput:text=>{pid=Number(text.trim());},ready:()=>poll({label:'pid',timeoutMs:1000,observe:async()=>pid,ready:Boolean})},async()=>{throw Error('scenario failed');}),/production process failed/);
 assert.throws(()=>process.kill(pid,0));
 await assert.rejects(withProcess({command:process.execPath,args:['-e',"console.error('startup broken');process.exit(2)"],ready:()=>new Promise(()=>{}),timeoutMs:100},async()=>{}),/startup broken/);
});

test('logs and traces are hashed and linked without converting failed steps into passes',async()=>{
 const {writeArtifact}=await import('@machinapractica/testing/node');const parent=await mkdtemp(join(tmpdir(),'mp-log-'));
 try{const directory=await createEvidenceDirectory(parent,'scenario');const log=await writeArtifact(directory,'failure.log','log',new TextEncoder().encode('assertion failed'));
 const recorder=new Recorder(identity);const bad=step([]);bad.action=async()=>{throw Error('failure');};await assert.rejects(recorder.step(bad));recorder.addArtifact(log);
 assert.equal(recorder.finish().status,'failed');assert.match(walkthrough(recorder.snapshot()),/failure.log/);
 assert.throws(()=>recorder.addArtifact(log),/duplicate/);await assert.rejects(writeArtifact(directory,'evidence.json','log',new Uint8Array()),/reserved/);
 }finally{await rm(parent,{recursive:true,force:true});}
});
