import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forbiddenWaits } from '../packages/testing/tooling/policy.mjs';

test('fixed wait syntax, aliases and common promise sleeps are rejected', () => {
  for (const source of [
    'await page.waitForTimeout(100)', "await page['waitForTimeout'](100)",
    'await page?.waitForTimeout(100)', 'const pause = page.waitForTimeout',
    'const { waitForTimeout: pause } = page',
    "import {setTimeout as sleep} from 'node:timers/promises'; await sleep(100)",
    "import * as timers from 'timers/promises'; await timers.setTimeout(100)",
    'await new Promise(done => setTimeout(done, 100))',
    'await new Promise(done => setTimeout(() => done(), 100))',
  ]) assert.equal(forbiddenWaits(source, 'example.spec.ts').length, 1, source);
});
test('comments, examples, observable waits and failure deadlines remain valid', () => {
  assert.deepEqual(forbiddenWaits(`// page.waitForTimeout(100)\nconst example='page.waitForTimeout(100)';
    await expect(page.getByText('Connected')).toBeVisible();
    await new Promise((resolve, reject) => setTimeout(() => reject(new Error('deadline')), 5000));`, 'example.spec.js'), []);
});
test('invalid test source fails closed', () => {
  assert.throws(() => forbiddenWaits('const =', 'example.spec.ts'));
});
