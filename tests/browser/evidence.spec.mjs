import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Recorder } from '@machinapractica/testing';
import { actor, capture } from '@machinapractica/testing/playwright';
import { createEvidenceDirectory, writeEvidence, sha256 } from '@machinapractica/testing/node';
const origin='http://127.0.0.1:4179';
test('ordinary actions retain actor-isolated semantic evidence',async({browser},testInfo)=>{
 await mkdir(testInfo.outputDir,{recursive:true});const directory=await createEvidenceDirectory(testInfo.outputDir,'receipts');
 const phone=await actor(browser,{name:'phone',viewport:{width:390,height:844},origins:[origin]});
 const table=await actor(browser,{name:'table',viewport:{width:1280,height:800},origins:[origin]});
 const recorder=new Recorder({scenario:testInfo.title,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),platform:`${process.platform}/chromium`,artifact:'package-dist; synthetic browser fixture'});
 try{
  await recorder.step({description:'Two people open independent storage',action:async()=>{await phone.page.goto(origin);await table.page.goto(origin);},ready:async()=>{await expect(phone.page.locator('html')).toHaveAttribute('data-revision','a'.repeat(40));await expect(table.page.locator('html')).toHaveAttribute('data-revision','a'.repeat(40));},checks:[{description:'Both saved counts begin at zero',check:async()=>{await expect(phone.page.getByLabel('Saved count')).toHaveText('0');await expect(table.page.getByLabel('Saved count')).toHaveText('0');}}],stabilize:async()=>{await phone.page.evaluate(()=>document.fonts.ready);await table.page.evaluate(()=>document.fonts.ready);},capture:async(index)=>[await capture(phone.page,directory,index,'phone'),await capture(table.page,directory,index,'table')]});
  await recorder.step({description:'Phone changes only its saved count',action:async()=>{await phone.page.getByRole('button',{name:'Increment saved count'}).click();},ready:async()=>{await expect(phone.page.getByLabel('Saved count')).toHaveText('1');},checks:[{description:'Phone retains one after reload; table still has zero',check:async()=>{await phone.page.reload();await expect(phone.page.getByLabel('Saved count')).toHaveText('1');await expect(table.page.getByLabel('Saved count')).toHaveText('0');phone.assertNetwork();table.assertNetwork();}}],stabilize:async()=>{await phone.page.evaluate(()=>document.fonts.ready);},capture:async index=>[await capture(phone.page,directory,index,'phone'),await capture(table.page,directory,index,'table')]});
 }finally{
  const evidence=recorder.finish();await writeEvidence(directory,evidence);
  for(const step of evidence.steps)for(const image of step.captures)expect(sha256(await readFile(`${directory}/${image.path}`))).toBe(image.sha256);
  await testInfo.attach('walkthrough',{path:`${directory}/walkthrough.md`,contentType:'text/markdown'});
  await Promise.all([phone.close(),table.close()]);
 }
});
test('unexpected HTTP and WebSocket origins fail the network contract',async({browser})=>{
 const isolated=await actor(browser,{name:'phone',viewport:{width:390,height:844},origins:[origin]});
 try{
  await isolated.page.goto(origin);
  await isolated.page.evaluate(async()=>{await fetch('https://unexpected.invalid/data').catch(()=>{});await new Promise(resolve=>{const socket=new WebSocket('wss://unexpected.invalid/socket');socket.onclose=resolve;socket.onerror=resolve;});});
  expect(()=>isolated.assertNetwork()).toThrow(/unexpected.invalid/);
 }finally{await isolated.close();}
});

test('opt-in time and randomness are repeatable; endpoint policy stays explicit',async({browser})=>{
 const options={name:'fixed',viewport:{width:390,height:844},origins:[origin],clock:1700000000000,seed:7,allowRequest:url=>['/','/build-info.js','/build-info.json'].includes(url.pathname)};
 const first=await actor(browser,options);const second=await actor(browser,options);
 try{
  await Promise.all([first.page.goto(origin),second.page.goto(origin)]);
  const values=page=>page.evaluate(()=>[Date.now(),Math.random(),Math.random()]);
  expect(await values(first.page)).toEqual(await values(second.page));
  await first.page.evaluate(()=>fetch('/forbidden').catch(()=>{}));expect(()=>first.assertNetwork()).toThrow();
  second.assertNetwork();
 }finally{await Promise.all([first.close(),second.close()]);}
});
