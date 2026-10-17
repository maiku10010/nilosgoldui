import test from "node:test";
import assert from "node:assert/strict";
import { groupInventory, finishSaleMaterials, sortInventoryStock, estimateGoldValue, inventoryStockKey } from "../src/inventorySummary.ts";
const movement = (karat, quantityIn) => ({ referenceId: `S-${karat}`, itemName: "Scrap gold", category: "SCRAP", unit: "grams", goldKarat: karat, quantityIn, quantityOut: 0, quantityLoss: 0 });
test("scrap has one stock card across all source karats while movement purity remains reviewable", () => {
  const rows = [movement(18, .1), movement(14, .2)];
  const products = groupInventory(rows);
  assert.equal(products.length, 1);
  assert.equal(products[0].goldKarat, null);
  assert.equal(products[0].balance, .3);
  assert.equal(products[0].itemName, "Scrap gold");
  assert.deepEqual(products[0].movements.map(row => row.goldKarat), [18, 14]);
  assert.equal(inventoryStockKey(rows[0]), inventoryStockKey(rows[1]));
  assert.equal(sortInventoryStock(products).length, 1);
  assert.equal(estimateGoldValue(products, 8000), 0);
  assert.deepEqual(finishSaleMaterials(rows), []);
});
test("scrap stock includes correcting out movements using exact milligrams", () => {
  const rows = [movement(18, .1), movement(14, .2), { ...movement(18, 0), quantityOut: .125 }];
  assert.equal(groupInventory(rows)[0].balance, .175);
  assert.equal(groupInventory(rows, [rows[0]])[0].movements.length, 3);
});
