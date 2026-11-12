import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordDay, recordDayLabel } from '../src/recordDay.ts';

test('groups business dates and timestamps by Manila calendar day', () => {
  assert.equal(recordDay('2026-11-13'), '2026-11-13');
  assert.equal(recordDay('2026-11-12T17:00:00Z'), '2026-11-13');
  assert.equal(recordDay('invalid'), '');
  assert.equal(recordDay(), '');
  assert.equal(recordDayLabel(''), 'Date unavailable');
});
