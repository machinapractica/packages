#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createBuildInfo, verifyArtifact } from './node.js';
import { parseBuildInfo, probeBuild } from './index.js';
const [command, ...args] = process.argv.slice(2);
try {
  let result;
  if (command === 'create' && args.length === 4) {
    result = await createBuildInfo(args[0]!, { repository: args[1]!, revision: args[2]!, channel: args[3]! });
  } else if (command === 'verify' && args.length === 1) {
    result = await verifyArtifact(args[0]!);
  } else if (command === 'probe' && args.length === 3) {
    result = await probeBuild({ local: parseBuildInfo(JSON.parse(await readFile(args[0]!, 'utf8'))), pageUrl: args[1]!, manifestUrl: args[2]! });
    if (result.state === 'unavailable') process.exitCode = 1;
  } else throw new Error('Usage: mp-build-info create DIRECTORY REPOSITORY REVISION CHANNEL | verify DIRECTORY | probe LOCAL_MANIFEST PAGE_URL MANIFEST_URL');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
