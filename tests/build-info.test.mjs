import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseBuildInfo, compareBuilds, probeBuild } from '@machinapractica/build-info';
import { createBuildInfo, hashArtifact, verifyArtifact } from '@machinapractica/build-info/node';
const identity={repository:'https://github.com/machinapractica/packages',revision:'a'.repeat(40),channel:'test'};
const manifest={formatVersion:1,...identity,contentHash:'sha256:'+'0'.repeat(64)};
test('strict manifest rejects future, unknown, partial and credential-bearing formats',()=>{
 assert.deepEqual(parseBuildInfo(manifest),manifest);
 for(const value of [{...manifest,formatVersion:2},{...manifest,extra:true},{...manifest,revision:'development'},{...manifest,repository:'https://user:secret@example.com/r'}, {revision:identity.revision}])assert.throws(()=>parseBuildInfo(value));
});
test('content identity is repeatable, path-sensitive, tamper-evident, and excludes exactly its manifest',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mp-build-'));
 try {await writeFile(join(root,'index.html'),'fixture');const before=await hashArtifact(root);
 const info=await createBuildInfo(root,identity);assert.equal(info.contentHash,before);assert.deepEqual(await verifyArtifact(root),info);
 await assert.rejects(createBuildInfo(root,identity));await rename(join(root,'index.html'),join(root,'other.html'));
 assert.notEqual(await hashArtifact(root),before);await assert.rejects(verifyArtifact(root),/mismatch/);
 await rename(join(root,'other.html'),join(root,'index.html'));assert.equal(await hashArtifact(root),before);
 await writeFile(join(root,'index.html'),'tampered');await assert.rejects(verifyArtifact(root),/mismatch/);
 await symlink('index.html',join(root,'link'));await assert.rejects(hashArtifact(root),/symlink/);
 await assert.rejects(hashArtifact(root,'../excluded'),/unsafe/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('freshness respects both identities and deployment boundaries',()=>{
 assert.equal(compareBuilds(manifest,manifest).state,'current');
 assert.equal(compareBuilds(manifest,{...manifest,contentHash:'sha256:'+'1'.repeat(64)}).state,'update-available');
 assert.equal(compareBuilds(manifest,{...manifest,revision:'b'.repeat(40)}).state,'update-available');
 assert.equal(compareBuilds(manifest,{...manifest,channel:'production'}).state,'unavailable');
});
test('probe preserves subpaths, no-store, deadline, and offline/cached uncertainty',async()=>{
 const options={local:manifest,pageUrl:'https://example.com/project/',manifestUrl:'build-info.json'};
 const result=await probeBuild({...options,fetch:async(url,init)=>{assert.equal(url.href,'https://example.com/project/build-info.json');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');return Response.json(manifest);}});
 assert.equal(result.state,'current');
 for(const fetch of [async()=>{throw Error('offline');},async()=>Response.json(manifest,{headers:{'X-Machina-Practica-Build-Source':'cache'}}),async()=>new Response('not JSON')])assert.equal((await probeBuild({...options,fetch})).state,'unavailable');
 assert.equal((await probeBuild({...options,timeoutMs:5,fetch:()=>new Promise(()=>{})})).state,'unavailable');
 await assert.rejects(probeBuild({...options,manifestUrl:'https://elsewhere.test/manifest'}),/same-origin/);
});
test('retained Ark Nova manifest requires explicit mapping, never silent legacy mutation',async()=>{
 const source=await readFile('fixtures/sources/arknova/internal/buildinfo/buildinfo_test.go','utf8');
 const legacy=JSON.parse(source.match(/data := `([^`]+)`/)[1]);const original=JSON.stringify(legacy);
 assert.throws(()=>parseBuildInfo(legacy));
 const adapted=parseBuildInfo({...manifest,repository:'https://'+legacy.repository,revision:legacy.commit});
 assert.equal(adapted.revision,legacy.commit);assert.equal(JSON.stringify(legacy),original);
 // synthetic-1 is not a content digest. The caller must hash the actual artifact.
 assert.throws(()=>parseBuildInfo({...adapted,contentHash:legacy.contentVersion}));
});

test('CLI creates and verifies an artifact and fails after tampering',async()=>{
 const {execFileSync}=await import('node:child_process');const root=await mkdtemp(join(tmpdir(),'mp-cli-'));
 try{await writeFile(join(root,'index.html'),'CLI artifact');const cli='packages/build-info/dist/cli.js';
 const output=JSON.parse(execFileSync(process.execPath,[cli,'create',root,identity.repository,identity.revision,identity.channel],{encoding:'utf8'}));
 assert.equal(output.revision,identity.revision);execFileSync(process.execPath,[cli,'verify',root]);
 await writeFile(join(root,'index.html'),'changed');assert.throws(()=>execFileSync(process.execPath,[cli,'verify',root],{stdio:'pipe'}));
 }finally{await rm(root,{recursive:true,force:true});}
});
