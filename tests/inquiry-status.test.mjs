import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inquiryBucket, inquiryMatchesTab } from '../src/inquiryStatus.ts';

test('quoted pending inquiry has the same badge status and tab classification', () => {
  assert.equal(inquiryBucket('Pending', 100000), 'Quoted');
  assert.equal(inquiryMatchesTab('Pending', 100000, 'Quoted'), true);
  assert.equal(inquiryMatchesTab('Pending', 100000, 'Pending'), false);
  assert.equal(inquiryMatchesTab('Pending', 0, 'Pending'), true);
});

test('converted and closed inquiries share their tab and badge categories', () => {
  assert.equal(inquiryBucket('Finished', 100000), 'Converted to job');
  assert.equal(inquiryMatchesTab('Approved', 0, 'Converted to job'), true);
  assert.equal(inquiryMatchesTab('Rejected', 0, 'Closed'), true);
});
