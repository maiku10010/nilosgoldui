import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundTwo } from '../src/rounding.ts';
test('job costing rounds parsed costs and calculated values to cents', () => {
  assert.equal(roundTwo('1234.567'), 1234.57);
  assert.equal(roundTwo(1.005), 1.01);
  assert.equal(roundTwo(0.1 + 0.2), 0.3);
  assert.equal(roundTwo(100 / 3), 33.33);
  assert.ok(Number.isNaN(roundTwo('invalid')));
});
