import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContactInput, isValidPHContact } from '../src/validation.ts';
import { estimateGoldValue, groupInventory, isPieceUnit, summarizeInventory, sumGemstonePieces } from '../src/inventorySummary.ts';
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
test('gold stock pools are separated by karat while dashboard grams include all karats', () => {
  const rows = [row({ category: 'GOLD', goldKarat: 14, unit: 'grams', quantityIn: 10 }), row({ category: 'GOLD', goldKarat: 18, unit: 'grams', quantityIn: 5 }), row({ category: 'GOLD', goldKarat: 14, unit: 'grams', quantityOut: 2 })];
  const result = summarizeInventory(rows, rows);
  assert.equal(result.products, 2);
  assert.equal(result.inStock, 2);
  assert.equal(result.goldGrams, 13);
});
test('empty and depleted products are counted accurately', () => {
  assert.equal(summarizeInventory([], []).products, 0);
  const rows = [row({ quantityIn: 1 }), row({ quantityOut: 1 })];
  assert.equal(summarizeInventory(rows, rows).inStock, 0);
});

test('product rows contain stock changes as children with full balance when searching a movement', async () => {
  const { groupInventory } = await import('../src/inventorySummary.ts');
  const rows = [row({ referenceId: 'IN', quantityIn: 10 }), row({ referenceId: 'OUT', itemName: ' ring BOX ', quantityOut: 3 }), row({ referenceId: 'LOSS', quantityLoss: 2 }), row({ itemName: 'Necklace box', quantityIn: 4 })];
  const groups = groupInventory(rows, [rows[1]]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].balance, 5);
  assert.deepEqual(groups[0].movements, rows.slice(0, 3));
  assert.equal(groupInventory(rows).length, 2);
});

test('grouped gold movements convert ounces to grams and other units stay separate', async () => {
  const { groupInventory } = await import('../src/inventorySummary.ts');
  const rows = [row({ category:'GOLD', unit:'troy oz', quantityIn:1 }), row({ category:'GOLD', unit:'grams', quantityOut:1.1034768 }), row({ quantityIn:2 }), row({ unit:'boxes', quantityIn:3 })];
  const groups = groupInventory(rows);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].unit, 'grams');
  assert.ok(Math.abs(groups[0].balance - 30) < 0.000001);
  assert.equal(groups[0].movements.length, 2);
  assert.deepEqual(groupInventory([]), []);
});
test('grouped gold inventory keeps each karat in its own stock pool', async () => {
  const { groupInventory } = await import('../src/inventorySummary.ts');
  const rows = [row({ category: 'GOLD', goldKarat: 10, unit: 'grams', quantityIn: 4 }), row({ category: 'GOLD', goldKarat: 24, unit: 'grams', quantityIn: 7 })];
  const groups = groupInventory(rows);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.itemName), ['Gold · 10K', 'Gold · 24K']);
});
test('stock cards sort preferred gold karats before unspecified gold, silver and gems', async () => {
  const { sortInventoryStock } = await import('../src/inventorySummary.ts');
  const products = [
    row({ category: 'GEMSTONES', itemName: 'Ruby', unit: 'pieces' }),
    row({ category: 'GOLD', goldKarat: null, itemName: 'Gold (karat unspecified)' }),
    row({ category: 'GOLD', goldKarat: 18, itemName: 'Gold · 18K' }),
    row({ category: 'SILVER', itemName: 'Silver' }),
    row({ category: 'GOLD', goldKarat: 24, itemName: 'Gold · 24K' }),
  ];
  assert.deepEqual(sortInventoryStock(products).map(product => product.itemName), ['Gold · 24K', 'Gold · 18K', 'Gold (karat unspecified)', 'Silver', 'Ruby']);
});
test('gemstone piece aliases count toward the piece tile', () => {
  const rows = [
    row({ category: 'GEMSTONES', unit: 'pcs', itemName: 'Moissanite', quantityIn: 2 }),
    row({ category: 'GEMSTONES', unit: 'pieces', itemName: 'Moissanite', quantityIn: 2 }),
    row({ category: 'GEMSTONES', unit: 'carats', itemName: 'Ruby', quantityIn: 1.5 }),
  ];
  assert.equal(sumGemstonePieces(groupInventory(rows)), 4);
  assert.equal(isPieceUnit(' PCS '), true);
});
test('gold estimate adjusts the 24K rate for known karats and excludes unknown karat', () => {
  const products = [
    row({ category: 'GOLD', goldKarat: 24, unit: 'grams', balance: 2 }),
    row({ category: 'GOLD', goldKarat: 18, unit: 'grams', balance: 10 }),
    row({ category: 'GOLD', goldKarat: 14, unit: 'grams', balance: 8 }),
    row({ category: 'GOLD', goldKarat: null, unit: 'grams', balance: 100 }),
  ];
  assert.ok(Math.abs(estimateGoldValue(products, 1000) - (2000 + 7500 + 8000 * 14 / 24)) < 0.000001);
});
