import assert from "node:assert/strict";
import test from "node:test";
import { costingSummary, goldStockError, goldStockSources, gramsToMilligrams, milligramsToGrams } from "../src/goldStock.ts";

const row = (data = {}) => ({ referenceId: "18K-IN", category: "GOLD", goldKarat: 18, unit: "grams", itemName: "Gold · 18K", quantityIn: "1.2", quantityOut: "0", quantityLoss: "0", ...data });

test("only gold used counts against available source stock", () => {
  const [source] = goldStockSources([row()]);
  assert.equal(source.availableMg, 1200);
  assert.equal(goldStockError("1", "0.2", source), "");
  assert.equal(goldStockError("1.201", "0.201", source), "Insufficient Gold · 18K: gold used must not exceed 1.2 g available.");
  assert.equal(goldStockError("1.2", "2", source), "");
  assert.equal(gramsToMilligrams("0.001"), 1);
  assert.equal(gramsToMilligrams("0.0001"), null);
  assert.equal(gramsToMilligrams("-0.1"), null);
  assert.equal(milligramsToGrams(1200), "1.2");
});

test("sources keep karats separate, subtract all movements, and restore only the job being edited", () => {
  const inventory = [row(), row({ referenceId: "14K-IN", goldKarat: 14, quantityIn: "5" }),
    row({ referenceId: "18K-OUT", jobCostId: "JOB-1", quantityIn: "0", quantityOut: "1", quantityLoss: ".2" })];
  assert.equal(goldStockSources(inventory).find(source => source.karat === 18).availableMg, 0);
  assert.equal(goldStockSources(inventory, "JOB-1").find(source => source.karat === 18).availableMg, 1200);
  assert.equal(goldStockSources(inventory, "JOB-2").find(source => source.karat === 18).availableMg, 0);
  assert.equal(goldStockSources(inventory).find(source => source.karat === 14).availableMg, 5000);
});

test("troy ounce stock is converted with integer arithmetic before milligram availability is displayed", () => {
  const [source] = goldStockSources([row({ unit: "troy oz", quantityIn: "1" }), row({ referenceId: "OUT", quantityIn: "0", quantityOut: "1.1034768" })]);
  assert.equal(source.availableMg, 30000);
});

test("itemized gold and scrap costs both contribute to total, profit and low-margin calculations", () => {
  const summary = costingSummary("1", "0.2", "8000", "500", "1000", "15000");
  assert.equal(summary.gold, 8000);
  assert.equal(summary.scrap, 1600);
  assert.equal(summary.total, 11100);
  assert.equal(summary.profit, 3900);
  assert.equal(summary.margin, 26);
  assert.equal(costingSummary("0.001", "0", "8000", "0", "0", "10").gold, 8);
  assert.equal(costingSummary("0.0005", "0", "8000", "0", "0", "10").gold, 4);
});

test("customer gold bypasses shop availability but validates weights", () => {
  assert.equal(goldStockError("100", "1", undefined, true), "");
  assert.match(goldStockError("-1", "0", undefined, true), /non-negative/);
  assert.match(goldStockError("1", "0.0001", undefined, true), /3 decimal/);
});
