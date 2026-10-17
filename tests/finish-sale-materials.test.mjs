import assert from "node:assert/strict";
import test from "node:test";
import { finishSaleMaterials, materialQuantityError } from "../src/inventorySummary.ts";

const movement = (data = {}) => ({ referenceId: "STOCK-IN", category: "PACKAGING", unit: "pieces", itemName: "Ring box", quantityIn: 0, quantityOut: 0, quantityLoss: 0, ...data });

test("material picker pools movements once per stock item and uses the current available stock", () => {
  const result = finishSaleMaterials([
    movement({ quantityIn: 10, balance: 10 }),
    movement({ referenceId: "STOCK-OUT", quantityOut: 4, balance: 6 }),
    movement({ referenceId: "STOCK-LOSS", quantityLoss: 1, balance: 5 }),
    movement({ referenceId: "GOLD", category: "GOLD", unit: "grams", quantityIn: 50 }),
    movement({ referenceId: "TOOLS", category: "TOOLS", quantityIn: 10 }),
    movement({ referenceId: "EMPTY", itemName: "Empty bag", quantityIn: 1, quantityOut: 1 }),
    movement({ referenceId: "SILVER", category: "SILVER", itemName: "Silver wire", unit: "grams", quantityIn: 2 }),
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].itemName, "Ring box");
  assert.equal(result[0].available, 5);
  assert.equal(result[0].referenceId, "STOCK-IN");
  assert.equal(result[0].unit, "pcs");
  assert.equal(result[1].unit, "g");
});

test("quantity validation allows exact stock and fractional usage but rejects missing, invalid, and excess quantities", () => {
  assert.equal(materialQuantityError("2", 2, "pcs"), "");
  assert.equal(materialQuantityError("0.25", 0.5, "g"), "");
  for (const value of ["", " ", "0", "-1", "invalid", "Infinity"]) assert.match(materialQuantityError(value, 2, "pcs"), /greater than zero/);
  assert.equal(materialQuantityError("3", 2, "pcs"), "Only 2 pcs available.");
  assert.equal(materialQuantityError("0.6", 0.5, "g"), "Only 0.5 g available.");
});
