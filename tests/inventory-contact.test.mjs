import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContactInput, isValidPHContact } from '../src/validation.ts';
import { summarizeInventory } from '../src/inventorySummary.ts';
const row = (data = {}) => ({ category: 'BOXES', unit: 'pieces', itemName: 'Ring box', quantityIn: 0, quantityOut: 0, quantityLoss: 0, ...data });
test('contact typing/pasting removes non-digits, preserves zero, and caps at 11', () => {
  assert.equal(normalizeContactInput('abc09-123 456789xyz999'), '09123456789');
  assert.equal(normalizeContactInput('+63 912-345-6789'), '09123456789');
  assert.equal(normalizeContactInput('letters'), '');
  assert.equal(isValidPHContact('09123456789'), true);
  assert.equal(isValidPHContact('0912345678'), false);
  assert.equal(isValidPHContact('+639123456789'), false);
});
test('product stock sums movements rather than cumulative ledger snapshots', () => {
  const rows = [row({ quantityIn: 10, balance: 10 }), row({ quantityOut: 3, balance: 7 }), row({ quantityLoss: 2, balance: 5 })];
  assert.deepEqual(summarizeInventory(rows, rows), { entries: 3, products: 1, inStock: 1, quantities: [['pieces', 5]], goldGrams: 0 });
});
test('filtered ledger entry keeps whole-product balance and separates units', () => {
  const rows = [row({ quantityIn: 10 }), row({ quantityOut: 8 }), row({ unit: 'boxes', quantityIn: 3 }), row({ category: 'SILVER', unit: 'grams', quantityIn: 5 })];
  assert.deepEqual(summarizeInventory(rows, [rows[0]]).quantities, [['pieces', 2]]);
  assert.deepEqual(summarizeInventory(rows, rows).quantities, [['boxes', 3], ['grams', 5], ['pieces', 2]]);
});
test('gold uses one pool across descriptions and troy-ounce/gram units', () => {
  const rows = [row({ category: 'GOLD', unit: 'troy oz', quantityIn: 1 }), row({ category: 'GOLD', unit: 'grams', itemName: 'Different gold', quantityOut: 1.1034768 })];
  const result = summarizeInventory(rows, rows);
  assert.equal(result.products, 1); assert.ok(Math.abs(result.goldGrams - 30) < 0.000001);
});
test('empty and depleted products are counted accurately', () => {
  assert.equal(summarizeInventory([], []).products, 0);
  const rows = [row({ quantityIn: 1 }), row({ quantityOut: 1 })];
  assert.equal(summarizeInventory(rows, rows).inStock, 0);
});
