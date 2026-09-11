import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const name=process.env.RELEASE_PACKAGE;
assert(['testing','build-info'].includes(name),'unsupported package');
const release=JSON.parse(await readFile('.artifacts/release-manifest.json','utf8'));
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(release.revision,revision,'reverify this revision');
const selected=release.packages.find(p=>p.name===`@machinapractica/${name}`);
assert(selected && /^0\.\d+\.\d+-alpha\.\d+$/.test(selected.version),'only experimental alpha releases');
assert.equal(selected.filename,`machinapractica-${name}-${selected.version}.tgz`);
const path=`.artifacts/${selected.filename}`;
assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),selected.sha256,'tarball changed after verification');
const publish=process.env.RELEASE_PUBLISH==='true';
if(publish){
 assert.equal(process.env.GITHUB_REPOSITORY,'machinapractica/packages');
 assert.equal(process.env.GITHUB_REF,'refs/heads/main');
 assert.equal(release.dirty,false,'release must be verified from a clean checkout');
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','release checkout changed');
 assert(process.env.ACTIONS_ID_TOKEN_REQUEST_URL,'GitHub OIDC required');
}
execFileSync('npm',['publish',path,'--access','public','--tag','alpha','--provenance',...(publish?[]:['--dry-run'])],{stdio:'inherit'});
