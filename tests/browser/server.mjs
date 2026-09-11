// Package conformance fixture, not an application starter.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Package conformance fixture</title></head><body><h1>Package conformance fixture</h1><button>Increment saved count</button><output aria-label="Saved count"></output><script type="module">
import { parseBuildInfo } from '/build-info.js';
const info = parseBuildInfo(await (await fetch('/build-info.json')).json());
document.documentElement.dataset.revision = info.revision;
const output=document.querySelector('output');
const render=()=>output.textContent=localStorage.getItem('count')??'0';render();
document.querySelector('button').onclick=()=>{localStorage.setItem('count',String(Number(output.textContent)+1));render();};
</script></body></html>`;
const server=createServer(async(req,res)=>{
 try {
  if(req.url==='/build-info.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('packages/build-info/dist/index.js'));}
  else if(req.url==='/build-info.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({formatVersion:1,repository:'https://github.com/machinapractica/packages',revision:'a'.repeat(40),contentHash:'sha256:'+'0'.repeat(64),channel:'synthetic-test-fixture'}));}
  else if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}
  else{res.statusCode=404;res.end();}
 }catch(error){res.statusCode=500;res.end(String(error));}
});
server.listen(4179,'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
