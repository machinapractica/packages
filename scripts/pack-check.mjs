import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory=resolve('.artifacts');await mkdir(directory,{recursive:true});
const packages=[];
for(const name of ['testing','build-info']){
 const [pack]=JSON.parse(execFileSync('npm',['pack',`./packages/${name}`,'--json','--ignore-scripts','--pack-destination',directory],{encoding:'utf8'}));
 assert(pack.files.some(f=>f.path==='LICENSE'));assert(pack.files.some(f=>f.path==='README.md'));assert(pack.files.some(f=>f.path==='dist/index.d.ts'));
 assert(pack.files.every(f=>/^(dist\/|src\/|tsconfig.json$|LICENSE$|README.md$|CHANGELOG.md$|package.json$)/.test(f.path)),'unexpected packaged file');
 for(const file of await readdir(`packages/${name}/dist`))if(file.endsWith('.d.ts')){
  await mkdir(`api/${name}`,{recursive:true});
  const actual=await readFile(`packages/${name}/dist/${file}`,'utf8');
  const expected=await readFile(`api/${name}/${file}`,'utf8');assert.equal(actual,expected,`API report changed: ${name}/${file}`);
 }
 const bytes=await readFile(join(directory,pack.filename));
 packages.push({name:pack.name,version:pack.version,filename:pack.filename,integrity:pack.integrity,sha256:createHash('sha256').update(bytes).digest('hex'),files:pack.files.map(f=>f.path)});
}
const temp=await mkdtemp(join(tmpdir(),'mp-packed-contract-'));
try{
 await mkdir(join(temp,'artifact'));
 await writeFile(join(temp,'artifact','index.html'),'packed CLI fixture');
 await writeFile(join(temp,'package.json'),JSON.stringify({private:true,type:'module'}));
 execFileSync('npm',['install','--ignore-scripts','--no-audit','--no-fund','--offline',...packages.map(p=>join(directory,p.filename))],{cwd:temp,stdio:'pipe'});
 execFileSync('node',['--input-type=module','-e',`import assert from 'node:assert/strict';import {Recorder} from '@machinapractica/testing';import {sha256} from '@machinapractica/testing/node';import {parseBuildInfo} from '@machinapractica/build-info';import {hashArtifact} from '@machinapractica/build-info/node';assert.equal(new Recorder({scenario:'packed import',revision:'a'.repeat(40),platform:'node'}).snapshot().status,'running');assert.equal(sha256(new Uint8Array()).length,64);assert.throws(()=>parseBuildInfo({}));assert.match(await hashArtifact('artifact'),/^sha256:/);`],{cwd:temp,stdio:'pipe'});
 execFileSync(join(temp,'node_modules/.bin/mp-build-info'),['create','artifact','https://github.com/machinapractica/packages','a'.repeat(40),'packed-test'],{cwd:temp,stdio:'pipe'});
 execFileSync(join(temp,'node_modules/.bin/mp-build-info'),['verify','artifact'],{cwd:temp,stdio:'pipe'});
 // Resolve the optional Playwright peer from its already-installed, pinned package; no registry fetch.
 execFileSync('npm',['install','--ignore-scripts','--no-audit','--no-fund','--offline',resolve('node_modules/@playwright/test')],{cwd:temp,stdio:'pipe'});
 execFileSync('node',['--input-type=module','-e',"import {actor,capture} from '@machinapractica/testing/playwright';if(typeof actor!=='function'||typeof capture!=='function')throw Error('missing adapter');"],{cwd:temp,stdio:'pipe'});
 // Type-check only public entry points from the packed install, independently of workspace sources.
 await writeFile(join(temp,'contract.mts'),`import {Recorder, type Evidence} from '@machinapractica/testing';import {parseBuildInfo,type BuildInfo} from '@machinapractica/build-info';const e:Evidence=new Recorder({scenario:'types',revision:'a',platform:'types'}).snapshot();const b:BuildInfo=parseBuildInfo({});void e;void b;`);
 execFileSync(resolve('node_modules/.bin/tsc'),['--noEmit','--strict','--module','nodenext','--target','es2022',join(temp,'contract.mts')],{cwd:temp,stdio:'pipe'});
}finally{await rm(temp,{recursive:true,force:true});}
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
await writeFile(join(directory,'release-manifest.json'),JSON.stringify({formatVersion:1,revision,dirty,verification:'packed contents, exports, CLI and public declarations passed; unit/browser results are separate verifier logs',adopters:[],publication:'unpublished',packages},null,2)+'\n');
console.log('Verified tarball contents, installed exports and public declarations for both packages.');
