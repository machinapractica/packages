import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
test('every retained source and license matches its immutable inventory hash',async()=>{
 const manifest=JSON.parse(await readFile('fixtures/source-manifest.json','utf8'));
 for(const source of manifest.sources)for(const file of source.files){
  const bytes=await readFile(`fixtures/sources/${source.name}/${file.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,source.name+'/'+file.path);
 }
});
