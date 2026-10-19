import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from '../src/apiConfig.ts';

test('demo accepts its pinned backend and refuses shop or missing API configuration', () => {
  const demo = 'https://golddemo-api.vercel.app';
  assert.equal(resolveApiBaseUrl(`${demo}/`, demo), demo);
  for (const configured of [undefined, '', '/api', 'https://nilosgold.vercel.app', 'https://other.example']) {
    assert.throws(() => resolveApiBaseUrl(configured, demo), /does not match/);
  }
});

test('generic local development keeps a relative API fallback', () => {
  assert.equal(resolveApiBaseUrl(), '/api');
});

test('demo branch blocks inherited shop API settings even if its pin is missing', () => {
  assert.throws(() => resolveApiBaseUrl('https://nilosgold.vercel.app', undefined, 'feature/white-label-demo'), /does not match/);
  assert.throws(() => resolveApiBaseUrl(undefined, undefined, 'feature/white-label-demo'), /does not match/);
});
