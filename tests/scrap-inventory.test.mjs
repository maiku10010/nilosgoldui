import test from "node:test";
import assert from "node:assert/strict";
import { groupInventory, finishSaleMaterials, sortInventoryStock, estimateGoldValue } from "../src/inventorySummary.ts";
const movement = (karat, quantityIn) => ({ referenceId: `S-${karat}`, itemName: "Scrap gold", category: "SCRAP", unit: "grams", goldKarat: karat, quantityIn, quantityOut: 0, quantityLoss: 0 });
test("scrap appears in stock cards and retains separate karats without inflating usable gold value", () => {
  const rows = [movement(18, .2), movement(14, .3)];
  const products = groupInventory(rows);
  assert.equal(products.length, 2);
  assert.equal(products[0].goldKarat, 18);
  assert.equal(products[0].balance, .2);
  assert.equal(products[0].itemName, "Scrap gold · 18K");
  assert.equal(sortInventoryStock(products).length, 2);
  assert.equal(estimateGoldValue(products, 8000), 0);
  assert.deepEqual(finishSaleMaterials(rows), []);
});
