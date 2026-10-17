import test from "node:test";
import assert from "node:assert/strict";
import { changeCostingService, optionalCostValue, applyInquiryToCosting } from "../src/costingForm.ts";
import { stripDisallowedFields } from "../src/lib/serviceRules.ts";
import { costingSummary } from "../src/goldStock.ts";
const custom = { serviceType: "Custom", goldSourceId: "18K-IN", goldUsed: "1", goldScrap: ".2", goldCostPerG: "8000", stoneCost: "500", laborCost: "1000", sellingPrice: "15000", clientName: "Mia", note: null };
test("changing services clears only hidden fields, preserves metadata and never restores stale costs", () => {
  const resized = changeCostingService(custom, "Resize");
  assert.equal(resized.stoneCost, "");
  assert.equal(resized.goldUsed, "1");
  assert.equal(changeCostingService(resized, "Custom").stoneCost, "");
  const cleaning = changeCostingService(resized, "Cleaning");
  for (const key of ["goldSourceId", "goldUsed", "goldScrap", "goldCostPerG", "stoneCost"]) assert.equal(cleaning[key], "");
  assert.equal(cleaning.laborCost, "1000");
  assert.equal(cleaning.sellingPrice, "15000");
  assert.equal(cleaning.clientName, "Mia");
  assert.equal(cleaning.note, null);
  assert.equal(custom.stoneCost, "500");
  const back = changeCostingService(cleaning, "Repair");
  assert.equal(back.goldUsed, "");
  assert.equal(back.goldSourceId, "");
});
test("Cleaning sends null fields over JSON and summary uses labor only even with stale input", () => {
  const payload = JSON.parse(JSON.stringify(stripDisallowedFields("Cleaning", custom)));
  for (const key of ["goldSourceId", "goldUsed", "goldScrap", "goldCostPerG", "stoneCost"]) assert.equal(payload[key], null);
  assert.equal(payload.laborCost, "1000");
  const summary = costingSummary(custom.goldUsed, custom.goldScrap, custom.goldCostPerG, custom.stoneCost, custom.laborCost, custom.sellingPrice, "Cleaning");
  assert.equal(summary.total, 1000);
  assert.equal(summary.profit, 14000);
  assert.equal(summary.margin, 14000 / 15000 * 100);
  assert.equal(summary.gold, 0);
  assert.equal(summary.scrap, 0);
});

test("optional stone cost stays null when blank and contributes zero only to the live calculation", () => {
  for (const value of ["", "   "]) assert.equal(optionalCostValue(value), null);
  assert.equal(optionalCostValue("0"), 0);
  assert.equal(optionalCostValue("6105.25"), 6105.25);
  assert.equal(optionalCostValue("1.005"), 1.01);
  assert.ok(Number.isNaN(optionalCostValue("invalid")));
  for (const type of ["Repair", "Custom"]) {
    const payload = stripDisallowedFields(type, { stoneCost: optionalCostValue("") });
    assert.equal(JSON.parse(JSON.stringify(payload)).stoneCost, null);
    const summary = costingSummary("1", "0", "8000", "", "1000", "15000", type);
    assert.equal(summary.total, 9000);
    assert.equal(summary.profit, 6000);
  }
});

test("selecting an inquiry inherits its type, clears hidden fields and replaces any previous override", () => {
  const inquiry = { inquiryId: "INQ-1", serviceType: "Cleaning", customerName: "Mia", contactInfo: "09228651975", quotedPrice: 1500 };
  const selected = applyInquiryToCosting(custom, inquiry);
  assert.equal(selected.serviceType, "Cleaning");
  assert.equal(selected.clientName, "Mia");
  assert.equal(selected.sellingPrice, "1500");
  assert.equal(selected.inquiryId, "INQ-1");
  for (const key of ["goldSourceId", "goldUsed", "goldCostPerG", "goldScrap", "stoneCost"]) assert.equal(selected[key], "");
  const overridden = changeCostingService(selected, "Repair");
  assert.equal(overridden.serviceType, "Repair");
  const next = applyInquiryToCosting(overridden, { ...inquiry, inquiryId: "INQ-2", serviceType: "Custom" });
  assert.equal(next.serviceType, "Custom");
  assert.equal(next.inquiryId, "INQ-2");
  assert.equal(custom.serviceType, "Custom");
});
